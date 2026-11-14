import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSync } from 'esbuild';

const result = buildSync({
  entryPoints: ['src/services/cameraStream.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  write: false,
});

const dir = mkdtempSync(join(tmpdir(), 'pj-camera-'));
const file = join(dir, 'cameraStream.mjs');
writeFileSync(file, result.outputFiles[0].text);
const {
  CameraUnsupportedError,
  buildCameraConstraintCandidates,
  captureVideoFrameDataUrl,
  describeCameraError,
  openCameraStream,
  setTrackTorch,
  stopMediaStream,
  supportsTrackTorch,
} = await import(`file://${file.replace(/\\/g, '/')}`);

let failures = 0;
function check(name, condition) {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}`);
  }
}

const candidates = buildCameraConstraintCandidates('environment');
check('generates 3 fallback constraint candidates', candidates.length === 3);
check(
  'final fallback requests generic video track',
  candidates[2].video === true && candidates[2].audio === false,
);

let calls = 0;
const fakeStream = {
  stopped: false,
  getTracks() {
    return [{ stop: () => { this.stopped = true; } }];
  },
  getVideoTracks() {
    return [{
      getCapabilities: () => ({ torch: true }),
      applyConstraints: async () => undefined,
    }];
  },
};

const fallbackStream = await openCameraStream(
  'environment',
  {
    async getUserMedia(constraints) {
      calls += 1;
      if (calls < 3) {
        const err = new Error('Constraint not satisfied');
        err.name = 'OverconstrainedError';
        throw err;
      }
      if (constraints.video !== true) {
        throw new Error('Expected generic fallback constraint');
      }
      return fakeStream;
    },
  },
  true,
);
check('openCameraStream falls back to generic camera on OverconstrainedError', calls === 3 && fallbackStream === fakeStream);

let deniedCalls = 0;
let deniedThrown = null;
try {
  await openCameraStream(
    'environment',
    {
      async getUserMedia() {
        deniedCalls += 1;
        const err = new Error('Denied');
        err.name = 'NotAllowedError';
        throw err;
      },
    },
    true,
  );
} catch (err) {
  deniedThrown = err;
}
check('openCameraStream does not retry after NotAllowedError', deniedCalls === 1 && deniedThrown?.name === 'NotAllowedError');

let insecureThrown = null;
try {
  await openCameraStream('environment', undefined, false);
} catch (err) {
  insecureThrown = err;
}
check(
  'openCameraStream reports CameraUnsupportedError on insecure origin',
  insecureThrown instanceof CameraUnsupportedError && /HTTPS/i.test(insecureThrown.message),
);

check(
  'describeCameraError explains denied permission',
  /permission was denied/i.test(describeCameraError(Object.assign(new Error('nope'), { name: 'NotAllowedError' }), true)),
);
check(
  'describeCameraError explains missing camera',
  /No camera was detected/i.test(describeCameraError(Object.assign(new Error('missing'), { name: 'NotFoundError' }), true)),
);
check(
  'describeCameraError explains busy camera',
  /busy in another app/i.test(describeCameraError(Object.assign(new Error('busy'), { name: 'NotReadableError' }), true)),
);

let unreadyThrown = false;
try {
  captureVideoFrameDataUrl({ readyState: 1, videoWidth: 0, videoHeight: 0 });
} catch {
  unreadyThrown = true;
}
check('captureVideoFrameDataUrl rejects uninitialized video frames', unreadyThrown);

let drawnSize = null;
const mockCanvas = {
  width: 0,
  height: 0,
  getContext() {
    return {
      drawImage(_video, _x, _y, width, height) {
        drawnSize = { width, height };
      },
    };
  },
  toDataURL(mime) {
    return `data:${mime};base64,ok`;
  },
};
const captured = captureVideoFrameDataUrl(
  { readyState: 4, videoWidth: 2560, videoHeight: 1440 },
  mockCanvas,
  1280,
  0.88,
);
check(
  'captureVideoFrameDataUrl downscales large video frames proportionally',
  captured.startsWith('data:image/jpeg;base64,') && drawnSize?.width === 1280 && drawnSize?.height === 720,
);

check('supportsTrackTorch detects torch capability', supportsTrackTorch(fakeStream) === true);
check('supportsTrackTorch handles null stream safely', supportsTrackTorch(null) === false);
check('setTrackTorch returns true when constraints apply', (await setTrackTorch(fakeStream, true)) === true);

let clearedVideo = { srcObject: fakeStream };
stopMediaStream(fakeStream, clearedVideo);
check('stopMediaStream stops tracks and detaches video srcObject', fakeStream.stopped === true && clearedVideo.srcObject === null);

if (failures > 0) {
  process.exit(1);
}
