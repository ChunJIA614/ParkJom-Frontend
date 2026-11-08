import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  History,
  ImagePlus,
  Loader2,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  ShieldX,
  Video,
  VideoOff,
  XCircle,
} from 'lucide-react';
import { compressFileToDataUrl } from '@/features/commuter/api/vehicleVisionApi';
import {
  checkVehiclePlate,
  getPlateCheckHistory,
  parsePlateCheckDetails,
} from '../api/managementApi';
import { formatAgo, parseUtc } from '../lib/time';
import type { PlateCheckLog, PlateCheckResult } from '../types';

interface ManagementPlateScannerProps {
  token: string;
  knownSpots: Array<{ id: number; label: string }>;
  onOpenBooking?: (bookingId: number) => void;
}

const DECISION_COPY: Record<string, { title: string; guidance: string }> = {
  BOOKING_MATCH: {
    title: 'Access Granted',
    guidance: 'This vehicle holds an active, eligible booking for this property within its allowed hours.',
  },
  BOOKING_ACCESS_WINDOW_CLOSED: {
    title: 'Outside Allowed Window',
    guidance: 'A booking exists for this plate, but current Malaysia time falls outside the spot’s allowed day or time window.',
  },
  NO_ELIGIBLE_BOOKING: {
    title: 'No Active Booking',
    guidance: 'No confirmed or active booking matches this plate at this property right now.',
  },
  PLATE_CONFIDENCE_TOO_LOW: {
    title: 'Low Scan Confidence',
    guidance: 'Move closer or improve lighting so the plate characters are sharp, then scan again.',
  },
  INVALID_PLATE: {
    title: 'Unrecognized Plate Format',
    guidance: 'The detected characters do not match a valid Malaysian JPJ number plate. Re-frame the front or rear plate.',
  },
};

export default function ManagementPlateScanner({
  token,
  knownSpots,
  onOpenBooking,
}: ManagementPlateScannerProps) {
  const [selectedSpotId, setSelectedSpotId] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [result, setResult] = useState<PlateCheckResult | null>(null);

  // Live camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Plate check audit history
  const [history, setHistory] = useState<PlateCheckLog[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(async (page = historyPage) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await getPlateCheckHistory(token, page, 12);
      setHistory(response.data);
      setHistoryTotal(response.totalCount);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Unable to load plate-check history.');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, token]);

  useEffect(() => {
    void loadHistory(historyPage);
  }, [historyPage, loadHistory]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    setCameraError(null);
    setScanError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported in this browser. Upload a photo instead.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      });
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : 'Camera permission was denied. Allow camera access or upload a photo.',
      );
      stopCamera();
    }
  };

  const runPlateCheck = async (dataUrl: string, mimeType = 'image/jpeg') => {
    setPreviewUrl(dataUrl);
    setScanning(true);
    setScanError(null);
    try {
      const spotNum = selectedSpotId ? Number(selectedSpotId) : null;
      const verdict = await checkVehiclePlate(token, {
        imageBase64: dataUrl,
        mimeType,
        parkingSpotId: spotNum && spotNum > 0 ? spotNum : null,
      });
      setResult(verdict);
      setHistoryPage(1);
      void loadHistory(1);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Plate scan failed. Try a clearer image.');
    } finally {
      setScanning(false);
    }
  };

  const captureCameraFrame = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setScanError('Camera frame is not ready yet. Wait a moment and try again.');
      return;
    }
    const maxDim = 960;
    let { videoWidth: width, videoHeight: height } = video;
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopCamera();
    await runPlateCheck(dataUrl, 'image/jpeg');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    stopCamera();
    try {
      const compressed = await compressFileToDataUrl(file);
      await runPlateCheck(compressed, 'image/jpeg');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Could not process the selected photo.');
    }
  };

  const decisionMeta = useMemo(() => {
    if (!result) return null;
    return DECISION_COPY[result.decisionCode] ?? {
      title: result.allowed ? 'Access Granted' : 'Access Denied',
      guidance: result.message || 'Verification completed.',
    };
  }, [result]);

  const totalHistoryPages = Math.max(1, Math.ceil(historyTotal / 12));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Capture & Spot Filter */}
        <section
          aria-labelledby="plate-capture-heading"
          className="lg:col-span-7 rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#141417] p-5 space-y-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="plate-capture-heading" className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Gatehouse Plate Scanner
              </h2>
              <p className="text-[12px] text-[#6e6e73] dark:text-[#a1a1aa] mt-0.5">
                Scan a vehicle number plate to verify an active booking at this property.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="scanner-spot-filter" className="text-[12px] font-medium text-[#6e6e73] dark:text-[#a1a1aa]">
                Bay filter
              </label>
              <select
                id="scanner-spot-filter"
                value={selectedSpotId}
                onChange={(e) => setSelectedSpotId(e.target.value)}
                className="min-h-10 rounded-xl border border-black/[0.1] dark:border-white/[0.14] bg-[#f5f5f7] dark:bg-[#1c1c1e] px-3 text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
              >
                <option value="">Any bay in property</option>
                {knownSpots.map((spot) => (
                  <option key={spot.id} value={String(spot.id)}>
                    {spot.label} (#{spot.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Camera / Image Viewport */}
          <div className="relative overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-[#0b0d12] aspect-[16/10] flex items-center justify-center">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                {/* Framing guide */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-6 sm:inset-10 rounded-2xl border-2 border-dashed border-white/60 flex items-end justify-center pb-3"
                >
                  <span className="rounded-full bg-black/65 px-3 py-1 text-[11px] font-semibold text-white">
                    Center Malaysian plate inside frame
                  </span>
                </div>
              </>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Captured vehicle frame"
                className="h-full w-full object-contain bg-black"
              />
            ) : (
              <div className="text-center px-6 py-10 space-y-2">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-white/10 text-white flex items-center justify-center">
                  <ScanLine size={24} aria-hidden="true" />
                </div>
                <p className="text-[14px] font-semibold text-white">
                  Ready to verify vehicle entry
                </p>
                <p className="text-[12px] text-white/70 max-w-sm mx-auto">
                  Start the live camera or upload a photo of the vehicle’s front or rear license plate.
                </p>
              </div>
            )}

            {scanning && (
              <div
                role="status"
                aria-live="polite"
                className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-white"
              >
                <Loader2 size={28} className="animate-spin text-[#0a84ff]" aria-hidden="true" />
                <p className="text-[13px] font-semibold">Reading Malaysian plate &amp; matching bookings…</p>
              </div>
            )}
          </div>

          {cameraError && (
            <div
              role="alert"
              className="rounded-xl border border-[#a15c00]/30 bg-[#fff8e8] dark:bg-amber-950/30 px-3.5 py-2.5 text-[12px] font-medium text-[#a15c00] dark:text-amber-300 flex items-center gap-2"
            >
              <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
              <span>{cameraError}</span>
            </div>
          )}

          {scanError && (
            <div
              role="alert"
              className="rounded-xl border border-[#c9342f]/30 bg-[#fff1f0] dark:bg-red-950/40 px-3.5 py-2.5 text-[12px] font-medium text-[#c9342f] dark:text-[#ff6961] flex items-center gap-2"
            >
              <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
              <span>{scanError}</span>
            </div>
          )}

          {/* Action bar — 44pt minimum targets */}
          <div className="flex flex-wrap items-center gap-2.5">
            {!cameraActive ? (
              <button
                type="button"
                disabled={scanning}
                onClick={() => void startCamera()}
                className="min-h-11 px-4 rounded-xl bg-[#0071e3] dark:bg-[#0a84ff] hover:bg-[#0066d6] text-white text-[13px] font-semibold inline-flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Video size={17} aria-hidden="true" />
                <span>Open Camera</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={scanning}
                  onClick={() => void captureCameraFrame()}
                  className="min-h-11 px-5 rounded-xl bg-[#248a3d] hover:bg-[#1e7433] text-white text-[13px] font-semibold inline-flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Camera size={17} aria-hidden="true" />
                  <span>Capture &amp; Verify Plate</span>
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="min-h-11 px-3.5 rounded-xl border border-black/[0.12] dark:border-white/[0.16] text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] inline-flex items-center gap-1.5"
                >
                  <VideoOff size={16} aria-hidden="true" />
                  <span>Stop Camera</span>
                </button>
              </>
            )}

            <button
              type="button"
              disabled={scanning}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-11 px-4 rounded-xl border border-black/[0.12] dark:border-white/[0.16] bg-[#f5f5f7] dark:bg-[#1c1c1e] hover:bg-black/[0.06] text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] inline-flex items-center gap-2 disabled:opacity-50"
            >
              <ImagePlus size={17} aria-hidden="true" />
              <span>Upload Plate Photo</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFileChange}
              className="sr-only"
              aria-label="Upload vehicle plate image"
            />
          </div>
        </section>

        {/* Right: Signature Gatehouse Verdict Card */}
        <section
          aria-labelledby="plate-verdict-heading"
          aria-live="polite"
          className="lg:col-span-5 rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#141417] p-5 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 id="plate-verdict-heading" className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Verification Verdict
            </h2>
            {result && (
              <span className="text-[11px] font-mono text-[#6e6e73] dark:text-[#a1a1aa]">
                {result.decisionCode}
              </span>
            )}
          </div>

          {!result ? (
            <div className="rounded-2xl border border-dashed border-black/[0.12] dark:border-white/[0.14] p-6 text-center space-y-2">
              <ShieldCheck size={28} className="mx-auto text-[#6e6e73] dark:text-[#a1a1aa]" aria-hidden="true" />
              <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                No plate scanned yet
              </p>
              <p className="text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
                Capture or upload a vehicle plate to see the detected number, confidence score, and matching booking.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Verdict Banner — pairs icon + text + high-contrast color */}
              <div
                className={`rounded-2xl border p-4 flex items-start gap-3 ${
                  result.allowed
                    ? 'border-[#248a3d]/35 bg-[#f0fdf4] dark:bg-emerald-950/35 text-[#1f6b34] dark:text-[#30d158]'
                    : 'border-[#c9342f]/35 bg-[#fff1f0] dark:bg-red-950/35 text-[#c9342f] dark:text-[#ff6961]'
                }`}
              >
                {result.allowed ? (
                  <CheckCircle2 size={24} className="shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <ShieldX size={24} className="shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div className="min-w-0 space-y-1">
                  <p className="text-[15px] font-bold">
                    {result.allowed ? 'ALLOWED — Eligible Booking Match' : `DENIED — ${decisionMeta?.title}`}
                  </p>
                  <p className="text-[12px] leading-relaxed opacity-90">
                    {result.message || decisionMeta?.guidance}
                  </p>
                </div>
              </div>

              {/* Malaysian JPJ Acrylic License Plate Specimen */}
              <div className="rounded-2xl bg-[#111318] text-white px-5 py-4 border-2 border-white/15 shadow-inner flex items-center justify-between gap-3">
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-white/60">
                    Detected JPJ Plate
                  </span>
                  <span className="mt-0.5 block font-mono text-[24px] sm:text-[28px] font-bold tracking-[0.12em]">
                    {result.formattedPlate || result.detectedPlate || 'UNREADABLE'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/60">
                    Confidence
                  </span>
                  <span
                    className={`mt-0.5 inline-block font-mono text-[15px] font-bold ${
                      result.confidence >= result.minimumConfidence ? 'text-[#30d158]' : 'text-[#ff9f0a]'
                    }`}
                  >
                    {Math.round(result.confidence * 100)}%
                  </span>
                  <span className="block text-[10px] text-white/60">
                    min {Math.round(result.minimumConfidence * 100)}%
                  </span>
                </div>
              </div>

              {/* Matched booking / bay metadata */}
              <dl className="grid grid-cols-2 gap-2.5 text-[12px]">
                <div className="rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] p-3">
                  <dt className="text-[#6e6e73] dark:text-[#a1a1aa]">Matched Booking</dt>
                  <dd className="mt-0.5 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {result.bookingId ? `#${result.bookingId}` : 'None'}
                  </dd>
                </div>
                <div className="rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] p-3">
                  <dt className="text-[#6e6e73] dark:text-[#a1a1aa]">Parking Bay</dt>
                  <dd className="mt-0.5 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {result.parkingSpotId ? `Spot #${result.parkingSpotId}` : 'Any property bay'}
                  </dd>
                </div>
              </dl>

              {result.bookingId && onOpenBooking && (
                <button
                  type="button"
                  onClick={() => onOpenBooking(result.bookingId!)}
                  className="w-full min-h-10 rounded-xl border border-[#0071e3]/30 bg-[#e8f0fe] dark:bg-[#0a84ff]/15 text-[#0071e3] dark:text-[#0a84ff] text-[13px] font-semibold hover:opacity-90 transition-opacity"
                >
                  Inspect Booking #{result.bookingId}
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Audit History of Plate Scans by this Manager */}
      <section
        aria-labelledby="plate-history-heading"
        className="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#141417] p-5 space-y-4 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History size={18} className="text-[#0071e3] dark:text-[#0a84ff]" aria-hidden="true" />
            <div>
              <h2 id="plate-history-heading" className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Recent Plate Checks
              </h2>
              <p className="text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
                Every scan performed by your management account is recorded in the property audit log.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadHistory(historyPage)}
            disabled={historyLoading}
            className="min-h-10 px-3.5 rounded-xl border border-black/[0.1] dark:border-white/[0.14] text-[12px] font-semibold inline-flex items-center gap-1.5 text-[#1d1d1f] dark:text-[#f5f5f7]"
          >
            <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>

        {historyError && (
          <div
            role="alert"
            className="rounded-xl border border-[#c9342f]/30 bg-[#fff1f0] dark:bg-red-950/40 px-3.5 py-2.5 text-[12px] text-[#c9342f] dark:text-[#ff6961]"
          >
            {historyError}
          </div>
        )}

        {historyLoading && history.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
            Loading plate-check audit log…
          </div>
        ) : history.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
            No plate checks have been recorded by this account yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] dark:border-white/[0.1] text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] dark:text-[#a1a1aa]">
                  <th className="py-2.5 pr-4">Outcome</th>
                  <th className="py-2.5 pr-4">Detected Plate</th>
                  <th className="py-2.5 pr-4">Decision</th>
                  <th className="py-2.5 pr-4">Confidence</th>
                  <th className="py-2.5 pr-4">Booking</th>
                  <th className="py-2.5">Checked (MYT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.08] text-[13px]">
                {history.map((entry) => {
                  const parsed = parsePlateCheckDetails(entry.details);
                  const allowed = entry.outcome === 'allowed';
                  const checkedDate = parseUtc(entry.checkedAtUtc);
                  return (
                    <tr key={entry.accessLogId}>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            allowed
                              ? 'bg-[#f0fdf4] dark:bg-emerald-950/40 text-[#248a3d] dark:text-[#30d158]'
                              : 'bg-[#fff1f0] dark:bg-red-950/40 text-[#c9342f] dark:text-[#ff6961]'
                          }`}
                        >
                          {allowed ? (
                            <CheckCircle2 size={12} aria-hidden="true" />
                          ) : (
                            <XCircle size={12} aria-hidden="true" />
                          )}
                          <span>{allowed ? 'Allowed' : 'Denied'}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {parsed.plate}
                      </td>
                      <td className="py-3 pr-4 text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
                        {DECISION_COPY[parsed.decision]?.title ?? parsed.decision}
                      </td>
                      <td className="py-3 pr-4 font-mono text-[12px]">
                        {parsed.confidence !== null ? `${Math.round(parsed.confidence * 100)}%` : '—'}
                      </td>
                      <td className="py-3 pr-4">
                        {entry.bookingId && onOpenBooking ? (
                          <button
                            type="button"
                            onClick={() => onOpenBooking(entry.bookingId!)}
                            className="text-[12px] font-semibold text-[#0071e3] dark:text-[#0a84ff] underline"
                          >
                            #{entry.bookingId}
                          </button>
                        ) : (
                          <span className="text-[#6e6e73] dark:text-[#a1a1aa]">—</span>
                        )}
                      </td>
                      <td className="py-3 text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} aria-hidden="true" />
                          <span>{formatAgo(checkedDate)}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalHistoryPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
            <span>
              Page {historyPage} of {totalHistoryPages} ({historyTotal} scans)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={historyPage <= 1 || historyLoading}
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                className="min-h-9 px-3 rounded-lg border border-black/[0.1] dark:border-white/[0.14] font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={historyPage >= totalHistoryPages || historyLoading}
                onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                className="min-h-9 px-3 rounded-lg border border-black/[0.1] dark:border-white/[0.14] font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
