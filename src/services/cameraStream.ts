export type CameraFacingMode = 'environment' | 'user';

export class CameraUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CameraUnsupportedError';
  }
}

const FATAL_CAMERA_ERRORS = new Set([
  'NotAllowedError',
  'PermissionDeniedError',
  'SecurityError',
  'NotReadableError',
  'TrackStartError',
]);

/**
 * Progressive getUserMedia constraints from preferred HD rear/front camera down
 * to any available camera so laptops and single-camera phones never fail on
 * OverconstrainedError.
 */
export function buildCameraConstraintCandidates(
  facingMode: CameraFacingMode = 'environment',
): MediaStreamConstraints[] {
  return [
    {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    {
      video: { facingMode },
      audio: false,
    },
    {
      video: true,
      audio: false,
    },
  ];
}

export function describeCameraError(
  error: unknown,
  isSecureContext = typeof window !== 'undefined' ? window.isSecureContext : true,
): string {
  if (!isSecureContext) {
    return 'Live camera requires an HTTPS connection (or localhost). Open this page over HTTPS or use Upload Photo.';
  }

  if (error instanceof CameraUnsupportedError) {
    return error.message;
  }

  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'Camera permission was denied. Allow camera access in your browser site settings, then tap Retry Camera.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was detected on this device. Connect a camera or use Upload Photo.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return 'Camera is currently busy in another app or tab. Close the other camera stream and tap Retry Camera.';
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'The active camera could not match the requested video settings. Try switching cameras or upload a photo.';
  }

  return message || 'Unable to start the live camera. Check browser permissions or use Upload Photo.';
}

export async function openCameraStream(
  facingMode: CameraFacingMode = 'environment',
  mediaDevices: Pick<MediaDevices, 'getUserMedia'> | undefined =
    typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined,
  isSecureContext = typeof window !== 'undefined' ? window.isSecureContext : true,
): Promise<MediaStream> {
  if (!isSecureContext) {
    throw new CameraUnsupportedError(describeCameraError(null, false));
  }

  if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
    throw new CameraUnsupportedError(
      'Live camera is not supported in this browser. Please use Upload Photo instead.',
    );
  }

  let lastError: unknown = null;
  for (const constraints of buildCameraConstraintCandidates(facingMode)) {
    try {
      return await mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
      const errName = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
      if (FATAL_CAMERA_ERRORS.has(errName)) {
        throw err;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Unable to acquire a video stream from any camera.');
}

export function stopMediaStream(
  stream: MediaStream | null | undefined,
  video?: HTMLVideoElement | null,
): void {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  if (video && video.srcObject) {
    video.srcObject = null;
  }
}

export async function attachStreamToVideo(
  video: HTMLVideoElement,
  stream: MediaStream,
): Promise<void> {
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;

  await video.play().catch(() => undefined);

  if (video.readyState >= 2 && video.videoWidth > 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('playing', onReady);
      resolve();
    };
    const onReady = () => {
      void video.play().catch(() => undefined);
      finish();
    };
    const timer = window.setTimeout(finish, 3000);
    video.addEventListener('loadedmetadata', onReady);
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('playing', onReady);
  });
}

export function supportsTrackTorch(stream: MediaStream | null | undefined): boolean {
  const track = stream?.getVideoTracks()[0];
  if (!track || typeof track.getCapabilities !== 'function') return false;
  try {
    const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
    return Boolean(capabilities.torch);
  } catch {
    return false;
  }
}

export async function setTrackTorch(
  stream: MediaStream | null | undefined,
  enabled: boolean,
): Promise<boolean> {
  const track = stream?.getVideoTracks()[0];
  if (!track || typeof track.applyConstraints !== 'function') return false;
  try {
    await track.applyConstraints({
      advanced: [{ torch: enabled } as MediaTrackConstraintSet],
    });
    return true;
  } catch {
    return false;
  }
}

export async function hasMultipleVideoInputs(
  mediaDevices: Pick<MediaDevices, 'enumerateDevices'> | undefined =
    typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined,
): Promise<boolean> {
  if (!mediaDevices || typeof mediaDevices.enumerateDevices !== 'function') return false;
  try {
    const devices = await mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'videoinput').length > 1;
  } catch {
    return false;
  }
}

export function captureVideoFrameDataUrl(
  video: Pick<HTMLVideoElement, 'readyState' | 'videoWidth' | 'videoHeight'>,
  canvasTarget?: HTMLCanvasElement | null,
  maxDimension = 1280,
  quality = 0.88,
): string {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
    throw new Error('Camera feed is still initializing. Wait a moment and try again.');
  }

  let width = video.videoWidth;
  let height = video.videoHeight;
  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }

  const canvas = canvasTarget || document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not read a frame from the video stream.');
  }

  ctx.drawImage(video as HTMLVideoElement, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}
