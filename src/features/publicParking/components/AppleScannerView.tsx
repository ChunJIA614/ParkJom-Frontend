import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Flashlight,
  RefreshCw,
  SwitchCamera,
  X,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Sparkles,
  Car,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  compressFileToDataUrl,
  scanVehicleWithVision,
  type VehicleVisionScanData,
} from '@/features/commuter/api/vehicleVisionApi';
import {
  attachStreamToVideo,
  captureVideoFrameDataUrl,
  describeCameraError,
  hasMultipleVideoInputs,
  openCameraStream,
  setTrackTorch,
  stopMediaStream,
  supportsTrackTorch,
  type CameraFacingMode,
} from '@/services/cameraStream';

interface AppleScannerViewProps {
  onScanPlate: (plate: string) => void;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
}

type CameraStatus = 'starting' | 'ready' | 'error';

export const AppleScannerView: React.FC<AppleScannerViewProps> = ({
  onScanPlate,
  onClose,
  title = 'AI Vehicle Plate Scanner',
  subtitle = 'Position the car plate inside the viewfinder or upload a photo',
}) => {
  const { user } = useAuth();
  const token = user?.token || (() => {
    try {
      const raw = localStorage.getItem('parkjom_user');
      return raw ? JSON.parse(raw).token : '';
    } catch {
      return '';
    }
  })();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [manualPlate, setManualPlate] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('environment');
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('starting');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<VehicleVisionScanData | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const releaseCamera = useCallback(() => {
    stopMediaStream(streamRef.current, videoRef.current);
    streamRef.current = null;
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const startCamera = useCallback(
    async (preferredFacing: CameraFacingMode) => {
      const requestId = ++cameraRequestRef.current;
      releaseCamera();
      setCameraStatus('starting');
      setCameraError(null);

      try {
        const stream = await openCameraStream(preferredFacing);
        if (requestId !== cameraRequestRef.current || !videoRef.current) {
          stopMediaStream(stream);
          return;
        }

        streamRef.current = stream;
        const videoEl = videoRef.current;
        await attachStreamToVideo(videoEl, stream);

        if (requestId !== cameraRequestRef.current) {
          stopMediaStream(stream, videoEl);
          return;
        }

        const primaryTrack = stream.getVideoTracks()[0];
        primaryTrack?.addEventListener(
          'ended',
          () => {
            if (streamRef.current === stream) {
              streamRef.current = null;
              setTorchOn(false);
              setTorchSupported(false);
              setCameraStatus('error');
              setCameraError('Camera stream ended unexpectedly. Tap Retry Camera to reconnect.');
            }
          },
          { once: true },
        );

        setTorchSupported(supportsTrackTorch(stream));
        setCameraStatus('ready');
        void hasMultipleVideoInputs().then((multi) => {
          if (requestId === cameraRequestRef.current) {
            setCanSwitchCamera(multi);
          }
        });
      } catch (err) {
        if (requestId !== cameraRequestRef.current) return;
        releaseCamera();
        setCameraStatus('error');
        setCameraError(describeCameraError(err));
      }
    },
    [releaseCamera],
  );

  useEffect(() => {
    void startCamera(facingMode);
    return () => {
      cameraRequestRef.current += 1;
      releaseCamera();
    };
  }, [facingMode, releaseCamera, startCamera]);

  const handleToggleTorch = async () => {
    if (!streamRef.current || !torchSupported) return;
    const next = !torchOn;
    const applied = await setTrackTorch(streamRef.current, next);
    if (applied) {
      setTorchOn(next);
    } else {
      setTorchSupported(false);
    }
  };

  // Run AI Vision ALPR on compressed image data URL
  const runAiVisionScan = async (dataUrl: string) => {
    setIsScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      const result = await scanVehicleWithVision(token, {
        imageBase64: dataUrl,
        mimeType: 'image/jpeg',
      });

      setScanResult(result);
      setManualPlate(result.formattedPlate || result.numberPlate);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Could not detect vehicle license plate.');
    } finally {
      setIsScanning(false);
    }
  };

  // Snapshot frame from live video feed
  const handleCaptureFromCamera = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const dataUrl = captureVideoFrameDataUrl(video, canvasRef.current, 1280, 0.88);
      setCapturedPhotoUrl(dataUrl);
      await runAiVisionScan(dataUrl);
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : 'Camera frame is not ready yet. Please wait a moment and try again.',
      );
    }
  };

  // Upload photo from device
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsScanning(true);
      const dataUrl = await compressFileToDataUrl(file);
      setCapturedPhotoUrl(dataUrl);
      await runAiVisionScan(dataUrl);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to process selected file.');
      setIsScanning(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Confirm detected or manual plate to release barrier
  const handleConfirmPlate = (plateToUse?: string) => {
    const plate = (plateToUse || manualPlate || scanResult?.formattedPlate || scanResult?.numberPlate || '').trim();
    if (!plate) return;

    const cleaned = plate.toUpperCase().replace(/\s+/g, ' ');
    onScanPlate(cleaned);
  };

  const handleRetake = () => {
    setCapturedPhotoUrl(null);
    setScanResult(null);
    setScanError(null);
    if (cameraStatus !== 'ready') {
      void startCamera(facingMode);
    }
  };

  const showLiveVideo = cameraStatus === 'ready' && !capturedPhotoUrl;
  const showReticle = Boolean(capturedPhotoUrl) || cameraStatus === 'ready';

  return (
    <div className="fixed inset-0 z-[1600] flex flex-col bg-black text-white select-none animate-in fade-in duration-200">
      {/* Hidden file input for vehicle photos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/80 px-4 pt-6 pb-3 backdrop-blur-xl sm:px-6 sm:pt-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-2 truncate text-base font-semibold tracking-tight text-white sm:text-lg">
              <Sparkles className="h-4 w-4 shrink-0 text-[#0a84ff]" />
              <span className="truncate">{title}</span>
            </h2>
            <span className="shrink-0 rounded-full border border-[#0a84ff]/35 bg-[#0a84ff]/15 px-2 py-0.5 text-[10px] font-bold text-[#409cff]">
              Gemini ALPR
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-neutral-400">{subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/12 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20 active:scale-95"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Upload Photo</span>
          </button>

          {canSwitchCamera && !capturedPhotoUrl && (
            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
              className="cursor-pointer rounded-xl border border-white/12 bg-white/10 p-2 text-white transition-all hover:bg-white/20 active:scale-90"
              title="Switch Camera"
              aria-label="Switch Camera"
            >
              <SwitchCamera className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleToggleTorch()}
            disabled={!showLiveVideo || !torchSupported}
            className={`rounded-xl border p-2 transition-all duration-200 ${
              torchOn
                ? 'cursor-pointer border-amber-300 bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.5)] active:scale-90'
                : 'border-white/12 bg-white/10 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40'
            }`}
            title={torchSupported ? 'Toggle Flashlight' : 'Flashlight not available on this camera'}
            aria-label="Toggle Flashlight"
          >
            <Flashlight className="h-4 w-4" />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-white/12 bg-white/10 p-2 text-white transition-all hover:bg-white/20 active:scale-90"
              aria-label="Close scanner"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Viewfinder Section */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-neutral-950 p-4 sm:p-6">
        {/* Live video element stays mounted so stream attachment never races against state */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onPlaying={() => setCameraStatus('ready')}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
            showLiveVideo ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        />

        {/* Captured Photo / Uploaded File Preview */}
        {capturedPhotoUrl && (
          <img
            src={capturedPhotoUrl}
            alt="Captured vehicle"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* Camera Starting / Unavailable Overlay (shown only when no photo & no active stream) */}
        {!capturedPhotoUrl && cameraStatus !== 'ready' && (
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/12 bg-[#141417]/95 p-6 text-center shadow-2xl">
            {cameraStatus === 'starting' ? (
              <div className="space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0a84ff]/15 text-[#0a84ff]">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
                <p className="text-sm font-semibold text-white">Starting live camera…</p>
                <p className="text-xs leading-relaxed text-neutral-400">
                  Allow camera access if prompted by your browser, or upload a car photo below.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff9f0a]/15 text-[#ff9f0a]">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-white">Live camera unavailable</p>
                  <p className="text-xs leading-relaxed text-neutral-300">
                    {cameraError || 'Could not start the camera stream. Check permissions or upload a photo.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => void startCamera(facingMode)}
                    className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-[#0a84ff] px-4 text-xs font-semibold text-white transition hover:bg-[#2491ff] active:scale-95"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-semibold text-white transition hover:bg-white/20 active:scale-95"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload Photo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Clear Viewfinder Reticle (never blurred over the live camera stream) */}
        {showReticle && (
          <div className="relative z-10 aspect-[16/9] w-full max-w-md overflow-hidden rounded-3xl border-2 border-white/30 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]">
            {/* Corner Guides */}
            <div className="pointer-events-none absolute top-3 left-3 h-6 w-6 rounded-tl-xl border-t-3 border-l-3 border-white" />
            <div className="pointer-events-none absolute top-3 right-3 h-6 w-6 rounded-tr-xl border-t-3 border-r-3 border-white" />
            <div className="pointer-events-none absolute bottom-3 left-3 h-6 w-6 rounded-bl-xl border-b-3 border-l-3 border-white" />
            <div className="pointer-events-none absolute right-3 bottom-3 h-6 w-6 rounded-br-xl border-r-3 border-b-3 border-white" />

            {/* Live framing hint */}
            {!isScanning && !scanResult && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-3 py-1 text-[11px] font-medium text-white/90">
                  Align license plate inside frame
                </span>
              </div>
            )}

            {/* Animated Laser Scanning Line */}
            {isScanning && (
              <div className="pointer-events-none absolute inset-x-4 h-0.5 animate-[scan-line_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-[#0a84ff] to-transparent shadow-[0_0_14px_#0a84ff]" />
            )}

            {/* Recognition Feedback Overlay */}
            {scanResult && !isScanning && (
              <div className="animate-in zoom-in-95 absolute inset-0 flex flex-col items-center justify-center bg-black/75 p-4 text-center backdrop-blur-md">
                <CheckCircle2 className="mb-1.5 h-8 w-8 text-[#30d158]" />
                {/* Authentic Malaysian JPJ Plate Design */}
                <div className="my-1 inline-block rounded-xl border-2 border-neutral-700 bg-black px-5 py-2 shadow-xl">
                  <span className="font-mono text-2xl font-black tracking-widest text-white">
                    {scanResult.formattedPlate || scanResult.numberPlate}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-300">
                  <Car className="h-3.5 w-3.5 text-[#0a84ff]" />
                  <span>
                    {scanResult.brand} {scanResult.model} • {scanResult.color}
                  </span>
                </div>
                <span className="mt-0.5 text-[10px] text-[#30d158]">
                  AI Confidence: {Math.round(scanResult.confidence * 100)}%
                </span>
              </div>
            )}

            {/* Scanning Progress Banner */}
            {isScanning && (
              <div className="absolute inset-x-0 bottom-3 text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/80 px-3 py-1 text-[11px] font-semibold text-white shadow-lg backdrop-blur-md">
                  <RefreshCw className="h-3 w-3 animate-spin text-[#0a84ff]" />
                  Analyzing license plate with Gemini AI…
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Control Tray: Shutter Capture + Confirmation */}
      <div className="space-y-3.5 border-t border-white/10 bg-black/90 px-4 pt-4 pb-6 sm:px-5 sm:pb-8">
        {scanError && (
          <div className="mx-auto flex max-w-xl items-center justify-between gap-2 rounded-2xl border border-[#ff453a]/30 bg-[#ff453a]/15 p-3 text-xs text-[#ff8980]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#ff453a]" />
              <span>{scanError}</span>
            </div>
            <button
              type="button"
              onClick={handleRetake}
              className="shrink-0 cursor-pointer text-[11px] font-semibold underline hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Camera Shutter / Retake Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {capturedPhotoUrl ? (
            <button
              type="button"
              onClick={handleRetake}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-white/12 bg-white/10 px-5 text-xs font-semibold text-white transition hover:bg-white/20 active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retake / Rescan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleCaptureFromCamera()}
              disabled={isScanning || cameraStatus !== 'ready'}
              className="flex h-12 cursor-pointer items-center gap-2 rounded-full bg-[#0071e3] px-7 text-xs font-semibold text-white shadow-[0_4px_20px_rgba(0,113,227,0.38)] transition-all hover:bg-[#0077ed] active:scale-95 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none dark:bg-[#0a84ff] dark:hover:bg-[#2491ff]"
            >
              <Camera className="h-4 w-4" />
              <span>{isScanning ? 'Scanning Plate…' : 'Scan Live Plate with AI'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-11 cursor-pointer items-center gap-1.5 rounded-2xl border border-white/12 bg-white/10 px-4 text-xs font-semibold text-white transition hover:bg-white/20 active:scale-95"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Photo</span>
          </button>
        </div>

        {/* Plate Confirmation Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirmPlate();
          }}
          className="mx-auto flex max-w-xl flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={manualPlate}
              onChange={(e) => setManualPlate(e.target.value.toUpperCase())}
              placeholder="Enter or verify plate (e.g. VEE 8492)"
              className="h-11 w-full rounded-2xl border border-white/15 bg-white/10 px-4 font-mono text-sm uppercase tracking-wider text-white placeholder-neutral-400 transition-all focus:border-[#0a84ff] focus:ring-2 focus:ring-[#0a84ff]/30 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!manualPlate.trim() && !scanResult}
            className="flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-[#248a3d] px-6 text-xs font-semibold text-white shadow-[0_4px_16px_rgba(48,209,88,0.28)] transition-all duration-200 hover:bg-[#30d158] hover:text-black active:scale-95 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Confirm &amp; Open Barrier</span>
          </button>
        </form>
      </div>
    </div>
  );
};
