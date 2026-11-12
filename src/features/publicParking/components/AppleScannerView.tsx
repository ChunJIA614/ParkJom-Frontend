import React, { useEffect, useRef, useState } from 'react';
import { Camera, Flashlight, RefreshCw, X, CheckCircle2, AlertTriangle, Upload, Sparkles, Car } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  compressFileToDataUrl,
  scanVehicleWithVision,
  type VehicleVisionScanData,
} from '@/features/commuter/api/vehicleVisionApi';

interface AppleScannerViewProps {
  onScanPlate: (plate: string) => void;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [manualPlate, setManualPlate] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<VehicleVisionScanData | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    async function startCamera() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setCameraActive(true);
          }
        }
      } catch {
        setCameraActive(false);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

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
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 960;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedPhotoUrl(dataUrl);
    await runAiVisionScan(dataUrl);
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white backdrop-blur-2xl select-none animate-in fade-in duration-200">
      {/* Hidden file input for vehicle photos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Apple Navigation Bar */}
      <div className="flex items-center justify-between px-6 pt-10 pb-3 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0071e3]" /> {title}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#0071e3]/20 text-[#0071e3] border border-[#0071e3]/30">
              Gemini ALPR
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-semibold text-white flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload Photo</span>
          </button>

          <button
            type="button"
            onClick={() => setTorchOn(!torchOn)}
            className={`p-2 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
              torchOn
                ? 'bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.5)]'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title="Toggle Flashlight"
          >
            <Flashlight className="w-4 h-4" />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-90 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Viewfinder Section */}
      <div className="relative flex-1 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        {/* Real Live Video Feed or Captured Photo Preview */}
        {capturedPhotoUrl ? (
          <img
            src={capturedPhotoUrl}
            alt="Captured vehicle"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : cameraActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black flex items-center justify-center">
            <div className="text-center px-4 max-w-xs text-neutral-500 space-y-2">
              <Camera className="w-12 h-12 mx-auto opacity-40 animate-pulse" />
              <p className="text-xs font-medium text-neutral-400">Camera ready</p>
              <p className="text-[11px] text-neutral-500">Tap Capture below or Upload a photo of the car</p>
            </div>
          </div>
        )}

        {/* Apple Scanner Reticle */}
        <div className="relative w-full max-w-sm aspect-[16/9] rounded-3xl border-2 border-white/25 p-2 shadow-2xl overflow-hidden backdrop-blur-xs">
          {/* Corner Guides */}
          <div className="absolute top-3 left-3 w-6 h-6 border-t-3 border-l-3 border-white rounded-tl-xl" />
          <div className="absolute top-3 right-3 w-6 h-6 border-t-3 border-r-3 border-white rounded-tr-xl" />
          <div className="absolute bottom-3 left-3 w-6 h-6 border-b-3 border-l-3 border-white rounded-bl-xl" />
          <div className="absolute bottom-3 right-3 w-6 h-6 border-b-3 border-r-3 border-white rounded-br-xl" />

          {/* Animated Laser Scanning Line */}
          {isScanning && (
            <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-[#0071e3] to-transparent shadow-[0_0_14px_#0071e3] animate-[scan_1.5s_ease-in-out_infinite]" />
          )}

          {/* Recognition Feedback Overlay */}
          {scanResult && !isScanning && (
            <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-center p-4 backdrop-blur-md animate-in zoom-in-95">
              <CheckCircle2 className="w-8 h-8 text-[#30d158] mb-1.5" />
              {/* Authentic Malaysian JPJ Plate Design */}
              <div className="px-5 py-2 rounded-xl bg-black border-2 border-neutral-700 shadow-xl inline-block my-1">
                <span className="font-mono text-2xl font-black tracking-widest text-white">
                  {scanResult.formattedPlate || scanResult.numberPlate}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-neutral-300 mt-1">
                <Car className="w-3.5 h-3.5 text-[#0071e3]" />
                <span>
                  {scanResult.brand} {scanResult.model} • {scanResult.color}
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 mt-0.5">
                AI Confidence: {Math.round(scanResult.confidence * 100)}%
              </span>
            </div>
          )}

          {/* Scanning Progress Banner */}
          {isScanning && (
            <div className="absolute inset-x-0 bottom-3 text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-black/80 text-white backdrop-blur-md border border-white/10 shadow-lg">
                <RefreshCw className="w-3 h-3 animate-spin text-[#0071e3]" />
                Analyzing license plate with Gemini AI…
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Control Tray: Shutter Capture + Confirmation */}
      <div className="p-5 bg-gradient-to-t from-black via-black/90 to-transparent pb-8 space-y-3.5">
        {scanError && (
          <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{scanError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setCapturedPhotoUrl(null);
                setScanError(null);
              }}
              className="text-[11px] underline font-semibold text-rose-300 hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Camera Shutter / Retake Actions */}
        <div className="flex items-center justify-center gap-3">
          {capturedPhotoUrl ? (
            <button
              type="button"
              onClick={() => {
                setCapturedPhotoUrl(null);
                setScanResult(null);
                setScanError(null);
              }}
              className="h-11 px-5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-semibold text-white flex items-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retake / Rescan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCaptureFromCamera}
              disabled={isScanning || !cameraActive}
              className="h-13 px-8 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:scale-95 text-white font-semibold text-xs transition-all flex items-center gap-2 shadow-[0_4px_20px_rgba(0,113,227,0.4)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>{isScanning ? 'Scanning Plate…' : 'Scan Live Plate with AI'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-11 px-4 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-semibold text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Photo</span>
          </button>
        </div>

        {/* Plate Confirmation Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirmPlate();
          }}
          className="flex gap-2 max-w-xl mx-auto"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={manualPlate}
              onChange={(e) => setManualPlate(e.target.value.toUpperCase())}
              placeholder="Enter or verify plate (e.g. VEE 8492)"
              className="w-full h-11 px-4 rounded-2xl bg-white/10 border border-white/15 text-white placeholder-neutral-500 font-mono text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:border-transparent transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={!manualPlate.trim() && !scanResult}
            className="h-11 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold text-xs transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(16,185,129,0.3)] cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm & Open Barrier</span>
          </button>
        </form>
      </div>
    </div>
  );
};
