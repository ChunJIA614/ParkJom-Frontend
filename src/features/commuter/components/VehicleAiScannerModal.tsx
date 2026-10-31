import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  ShieldCheck,
  Unlock,
  RefreshCw,
} from 'lucide-react';
import {
  compressFileToDataUrl,
  scanVehicleWithVision,
  verifyBarrierPlateWithVision,
  type VehicleVisionScanData,
  type BarrierPlateVerifyData,
} from '../api/vehicleVisionApi';

interface VehicleAiScannerModalProps {
  open: boolean;
  mode: 'onboarding' | 'barrier';
  token: string;
  bookingId?: number | null;
  expectedPlate?: string;
  expectedVehicleSummary?: string;
  onClose: () => void;
  onApplyVehicle?: (extracted: {
    numberPlate: string;
    brand: string;
    model: string;
    color: string;
  }) => void;
  onBarrierVerified?: (result: BarrierPlateVerifyData) => void;
}

export default function VehicleAiScannerModal({
  open,
  mode,
  token,
  bookingId,
  expectedPlate,
  expectedVehicleSummary,
  onClose,
  onApplyVehicle,
  onBarrierVerified,
}: VehicleAiScannerModalProps) {
  const [activeInputTab, setActiveInputTab] = useState<'upload' | 'camera'>('upload');
  const [cameraStreamActive, setCameraStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [onboardingResult, setOnboardingResult] = useState<VehicleVisionScanData | null>(null);
  const [barrierResult, setBarrierResult] = useState<BarrierPlateVerifyData | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraStreamActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    setScanError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraStreamActive(true);
    } catch {
      setCameraStreamActive(false);
      setCameraError(
        'Live camera is unavailable or permission was denied. Please use Photo Upload above.',
      );
    }
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      setPreviewDataUrl(null);
      setOnboardingResult(null);
      setBarrierResult(null);
      setScanError(null);
      setCameraError(null);
      return;
    }
    if (activeInputTab === 'camera') {
      void startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, activeInputTab]);

  if (!open) return null;

  const runVisionAnalysis = async (dataUrl: string) => {
    setPreviewDataUrl(dataUrl);
    setIsScanning(true);
    setScanError(null);
    setOnboardingResult(null);
    setBarrierResult(null);

    try {
      if (mode === 'onboarding') {
        const res = await scanVehicleWithVision(token, {
          imageBase64: dataUrl,
          mimeType: 'image/jpeg',
        });
        setOnboardingResult(res);
      } else {
        const res = await verifyBarrierPlateWithVision(token, {
          bookingId,
          expectedPlate,
          imageBase64: dataUrl,
          mimeType: 'image/jpeg',
        });
        setBarrierResult(res);
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Vision AI scan failed. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCaptureCameraFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 800;
    canvas.height = video.videoHeight || 520;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopCamera();
    void runVisionAnalysis(dataUrl);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressFileToDataUrl(file);
      await runVisionAnalysis(compressed);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Unable to read image file.');
    } finally {
      event.target.value = '';
    }
  };

  const activeBoundingBox = onboardingResult?.boundingBox ?? barrierResult?.boundingBox ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vision-scanner-title"
      className="fixed inset-0 z-[1260] flex items-center justify-center p-3 sm:p-4"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
        onClick={() => !isScanning && onClose()}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[#e8eaed] dark:border-white/10 bg-white dark:bg-[#141417] shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#f1f3f4] dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e8f0fe] dark:bg-blue-950/60 text-[#007AFF]">
              <Sparkles size={18} />
            </span>
            <div>
              <h3 id="vision-scanner-title" className="text-[15px] font-bold text-[#111] dark:text-white">
                {mode === 'onboarding'
                  ? 'Vision AI Vehicle & Plate Scanner'
                  : 'ALPR Smart Barrier Verification'}
              </h3>
              <p className="text-[11px] text-[#5f6368] dark:text-[#A1A1AA]">
                {mode === 'onboarding'
                  ? 'Extracts JPJ number plate, brand, model & color automatically'
                  : `Cross-verifying physical vehicle against reservation plate ${expectedPlate || 'on file'}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isScanning}
            aria-label="Close Vision AI scanner"
            className="rounded-lg p-1.5 text-[#5f6368] dark:text-[#A1A1AA] hover:bg-[#f1f3f4] dark:hover:bg-[#202025] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#f1f3f4] dark:bg-[#1E1E24] p-1 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveInputTab('upload')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition cursor-pointer ${
                activeInputTab === 'upload'
                  ? 'bg-white dark:bg-[#2A2A32] text-[#007AFF] shadow-xs'
                  : 'text-[#5f6368] dark:text-[#A1A1AA]'
              }`}
            >
              <Upload size={13} />
              <span>Upload Photo</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveInputTab('camera')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition cursor-pointer ${
                activeInputTab === 'camera'
                  ? 'bg-white dark:bg-[#2A2A32] text-[#007AFF] shadow-xs'
                  : 'text-[#5f6368] dark:text-[#A1A1AA]'
              }`}
            >
              <Camera size={13} />
              <span>Live Camera</span>
            </button>
          </div>

          {activeInputTab === 'upload' && (
            <div className="rounded-2xl border-2 border-dashed border-[#dadce0] dark:border-white/15 bg-[#f8f9fa] dark:bg-[#18181C] p-5 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload size={26} className="mx-auto text-[#007AFF] mb-2" />
              <p className="text-[13px] font-semibold text-[#111] dark:text-white">
                Upload a car photo or JPJ road tax image
              </p>
              <p className="text-[11px] text-[#5f6368] dark:text-[#A1A1AA] mt-1">
                Supports JPG, PNG, WebP. Automatically compressed on-device before analysis.
              </p>
              <button
                type="button"
                disabled={isScanning}
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#0066d6] transition cursor-pointer"
              >
                <Upload size={14} />
                Choose Photo
              </button>
            </div>
          )}

          {activeInputTab === 'camera' && (
            <div className="space-y-2.5">
              <div className="relative h-56 w-full rounded-2xl bg-black overflow-hidden border border-white/15 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                {/* ALPR Target Reticle */}
                <div className="pointer-events-none absolute inset-x-10 bottom-7 h-16 rounded-xl border-2 border-[#007AFF] bg-[#007AFF]/10 flex items-center justify-center">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white bg-black/60 px-2 py-0.5 rounded">
                    Align License Plate Here
                  </span>
                </div>
                {cameraError && (
                  <div className="absolute inset-0 bg-black/85 p-4 flex flex-col items-center justify-center text-center">
                    <AlertTriangle size={24} className="text-amber-400 mb-2" />
                    <p className="text-xs text-white/90 leading-relaxed">{cameraError}</p>
                  </div>
                )}
              </div>
              {cameraStreamActive && (
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={handleCaptureCameraFrame}
                  className="w-full py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] text-white text-[12px] font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Camera size={15} />
                  Capture &amp; Run ALPR
                </button>
              )}
            </div>
          )}

          {/* Annotated Vision Preview + Bounding Box */}
          {previewDataUrl && (
            <div className="relative rounded-2xl overflow-hidden border border-[#dadce0] dark:border-white/10 bg-black">
              <img
                src={previewDataUrl}
                alt="Scanned vehicle preview"
                className="w-full max-h-52 object-contain mx-auto"
              />
              {isScanning && (
                <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center text-white gap-2">
                  <Loader2 size={28} className="animate-spin text-[#007AFF]" />
                  <p className="text-[12px] font-semibold">Running Multimodal ALPR &amp; JPJ Validator…</p>
                </div>
              )}
              {!isScanning && activeBoundingBox && (
                <div
                  className="pointer-events-none absolute border-2 border-emerald-400 bg-emerald-400/15 rounded-md shadow-[0_0_12px_rgba(16,185,129,0.7)] transition-all"
                  style={{
                    top: `${(activeBoundingBox.yMin / 1000) * 100}%`,
                    left: `${(activeBoundingBox.xMin / 1000) * 100}%`,
                    height: `${Math.max(8, ((activeBoundingBox.yMax - activeBoundingBox.yMin) / 1000) * 100)}%`,
                    width: `${Math.max(15, ((activeBoundingBox.xMax - activeBoundingBox.xMin) / 1000) * 100)}%`,
                  }}
                >
                  <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-mono font-bold text-black">
                    ALPR {(onboardingResult?.confidence ?? barrierResult?.confidence ?? 0.96) * 100 >= 1 ? Math.round((onboardingResult?.confidence ?? barrierResult?.confidence ?? 0.96) * 100) : 96}%
                  </span>
                </div>
              )}
            </div>
          )}

          {scanError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900/50 p-3 text-[12px] text-rose-700 dark:text-rose-300"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{scanError}</span>
            </div>
          )}

          {/* Onboarding Result Card */}
          {onboardingResult && !isScanning && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 text-[12px] font-bold">
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Vehicle Extracted Successfully</span>
                </div>
                <span className="rounded-full bg-emerald-200/80 dark:bg-emerald-900/60 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-900 dark:text-emerald-200">
                  {Math.round(onboardingResult.confidence * 100)}% Confidence
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-xl bg-white dark:bg-[#141417] p-2.5 border border-black/[0.06] dark:border-white/10">
                  <span className="text-[10px] font-semibold uppercase text-[#5f6368] dark:text-[#A1A1AA]">
                    JPJ Number Plate
                  </span>
                  <p className="font-mono text-[15px] font-bold text-[#111] dark:text-white mt-0.5">
                    {onboardingResult.formattedPlate}
                  </p>
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {onboardingResult.jpjRegion}
                  </p>
                </div>
                <div className="rounded-xl bg-white dark:bg-[#141417] p-2.5 border border-black/[0.06] dark:border-white/10">
                  <span className="text-[10px] font-semibold uppercase text-[#5f6368] dark:text-[#A1A1AA]">
                    Make, Model &amp; Color
                  </span>
                  <p className="text-[13px] font-bold text-[#111] dark:text-white mt-0.5">
                    {onboardingResult.brand} {onboardingResult.model}
                  </p>
                  <p className="text-[11px] text-[#5f6368] dark:text-[#A1A1AA] mt-0.5">
                    Color: <strong>{onboardingResult.color}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#5f6368] dark:text-[#A1A1AA]">
                <span>Engine: {onboardingResult.engineUsed}</span>
                {onboardingResult.isValidJpjFormat && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                    <ShieldCheck size={12} /> JPJ Syntax Validated
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  onApplyVehicle?.({
                    numberPlate: onboardingResult.numberPlate,
                    brand: onboardingResult.brand,
                    model: onboardingResult.model,
                    color: onboardingResult.color,
                  });
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] text-white text-[12px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <CheckCircle2 size={15} />
                Apply to Vehicle Form
              </button>
            </div>
          )}

          {/* Barrier Verification Result Card */}
          {barrierResult && !isScanning && (
            <div
              className={`rounded-2xl border p-4 space-y-3 ${
                barrierResult.verified
                  ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30'
                  : 'border-rose-200 dark:border-rose-800/60 bg-rose-50/70 dark:bg-rose-950/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className={`flex items-center gap-1.5 text-[12px] font-bold ${
                    barrierResult.verified
                      ? 'text-emerald-800 dark:text-emerald-300'
                      : 'text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {barrierResult.verified ? (
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />
                  )}
                  <span>
                    {barrierResult.status === 'exact_match'
                      ? 'ALPR Exact Match Confirmed'
                      : barrierResult.status === 'near_match'
                      ? 'ALPR Verified (Homoglyph Tolerance)'
                      : 'Security Alert: Vehicle Plate Mismatch'}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold ${
                    barrierResult.verified
                      ? 'bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                      : 'bg-rose-200/80 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  {Math.round(barrierResult.similarityScore * 100)}% Match
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-xl bg-white dark:bg-[#141417] p-2.5 border border-black/[0.06] dark:border-white/10">
                  <span className="text-[10px] font-semibold uppercase text-[#5f6368] dark:text-[#A1A1AA]">
                    Expected Reservation Plate
                  </span>
                  <p className="font-mono text-[14px] font-bold text-[#111] dark:text-white mt-0.5">
                    {barrierResult.expectedPlate}
                  </p>
                </div>
                <div className="rounded-xl bg-white dark:bg-[#141417] p-2.5 border border-black/[0.06] dark:border-white/10">
                  <span className="text-[10px] font-semibold uppercase text-[#5f6368] dark:text-[#A1A1AA]">
                    Camera Detected Plate
                  </span>
                  <p className="font-mono text-[14px] font-bold text-[#111] dark:text-white mt-0.5">
                    {barrierResult.formattedDetectedPlate}
                  </p>
                  <p className="text-[10px] text-[#5f6368] dark:text-[#A1A1AA] mt-0.5">
                    {barrierResult.brand} {barrierResult.model} · {barrierResult.color}
                  </p>
                </div>
              </div>

              {barrierResult.verified ? (
                <button
                  type="button"
                  onClick={() => {
                    onBarrierVerified?.(barrierResult);
                    onClose();
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Unlock size={15} />
                  Confirm Vehicle &amp; Enable Barrier Release
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setBarrierResult(null);
                    setPreviewDataUrl(null);
                  }}
                  className="w-full py-2 rounded-xl bg-white dark:bg-[#202025] border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[12px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw size={14} />
                  Scan Another Vehicle
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
