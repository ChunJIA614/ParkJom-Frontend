import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

const { outputFiles } = buildSync({
  entryPoints: ['src/features/commuter/api/iotApi.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  define: { 'import.meta.env.VITE_API_BASE': '"/api"' },
});
const api = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`);
const calls = [];
const responses = [];
const ui = new EventTarget();
let rejectedSessions = 0;
ui.addEventListener('parkjom:auth-rejected', () => rejectedSessions++);
globalThis.window = ui;
globalThis.isSecureContext = true;

const data = {
  challengeId: 'test-challenge',
  nonce: 'test-nonce',
  deviceUuid: 'test-device-abcdef',
  bleServiceUuid: 'test-service',
  expiresAt: new Date(Date.now() + 30000).toISOString(),
};
const token = 'test-renter';
const bookingId = 42;
const controller = new AbortController();
const signal = controller.signal;
const reader = new EventTarget();
reader.startNotifications = async () => {};
let gpsCount = 0;
let submitted = 0;
let denyLocation = false;
let cancelChooser = false;

const device = {
  name: 'ParkJom-abcdef',
  gatt: {
    connected: false,
    async connect() {
      this.connected = true;
      return {
        async getPrimaryService(uuid) {
          assert.equal(uuid, data.bleServiceUuid);
          return {
            async getCharacteristic(uuid) {
              return uuid.startsWith('6e400003') ? reader : {
                async writeValueWithResponse(bytes) {
                  assert.equal(new TextDecoder().decode(bytes), `${data.challengeId}|${data.nonce}|${data.deviceUuid}`);
                  const proof = new TextEncoder().encode('mock-device-proof');
                  reader.value = new DataView(proof.buffer);
                  reader.dispatchEvent(new Event('characteristicvaluechanged'));
                },
              };
            },
          };
        },
      };
    },
    disconnect() { this.connected = false; },
  },
};

Object.defineProperty(globalThis, 'navigator', { value: {
  geolocation: {
    getCurrentPosition(resolve, reject, options) {
      assert.equal(options.maximumAge, 0);
      if (denyLocation) return reject({ code: 1 });
      resolve({ coords: { latitude: ++gpsCount, longitude: 101, accuracy: 5 }, timestamp: Date.now() });
    },
  },
  bluetooth: {
    async getDevices() { return [{ name: 'ParkJom-unrelated' }, device]; },
    async requestDevice(options) {
      calls.push('chooser');
      assert.ok(options.filters.some(({ name }) => name === device.name));
      assert.deepEqual(options.optionalServices, [data.bleServiceUuid]);
      if (cancelChooser) throw new DOMException('Cancelled', 'NotFoundError');
      return device;
    },
  },
} });

globalThis.fetch = async (path, options) => {
  assert.equal(new Headers(options.headers).get('Authorization'), `Bearer ${token}`);
  calls.push({ path, body: options.body && JSON.parse(options.body) });
  const response = responses.shift();
  assert.ok(response, `Unexpected API request to ${path}`);
  return Response.json(response.body, { status: response.status ?? 200 });
};

responses.push({ body: { success: true, data } });
const challenge = await api.prepareBollardUnlock(token, bookingId, signal);
assert.equal(challenge.bookingId, bookingId);
assert.equal(calls[0].path, '/api/iot/42/unlock/challenge');
assert.equal(calls[0].body.location.latitude, 1);
assert.equal(await api.findRememberedBollard(challenge), device);

const complete = (value = challenge) => api.completeBollardUnlock(token, value, { signal, onSubmitted: () => submitted++ });
await assert.rejects(complete({ ...challenge, expiresAt: '2000-01-01T00:00:00Z' }), /expired/);
assert.equal(calls.length, 1);

cancelChooser = true;
await assert.rejects(complete(), /Choose the assigned bollard/);
assert.equal(submitted, 0);
cancelChooser = false;
responses.push({ body: { success: true, message: 'Device confirmed', data: { executionStatus: 'confirmed_success', bollardPosition: 'UNLOCKED' } } });
const unlock = complete();
assert.equal(calls.at(-1), 'chooser', 'The chooser opens synchronously on the user tap');
assert.equal((await unlock).message, 'Device confirmed');
assert.equal(submitted, 1);
assert.equal(device.gatt.connected, false);
assert.equal(calls.at(-1).path, '/api/iot/42/unlock');
assert.equal(calls.at(-1).body.location.latitude, 2);
assert.deepEqual(calls.at(-1).body.bleVerification, { deviceUuid: data.deviceUuid, challengeResponse: 'mock-device-proof', rssi: null });

denyLocation = true;
await assert.rejects(complete(), /Allow location access/);
assert.equal(submitted, 1, 'Missing fresh GPS cannot send an unlock command');
assert.equal(device.gatt.connected, false);
denyLocation = false;

responses.push({ status: 403, body: { success: false, message: 'You are outside the allowed area.' } });
await assert.rejects(api.prepareBollardUnlock(token, bookingId, signal), /outside the allowed area/);
assert.equal(rejectedSessions, 0);

responses.push({ status: 504, body: { success: false, message: 'Device response timed out. Its execution status is unknown.' } });
await assert.rejects(api.performLockBollardCommand(token, bookingId), /execution status is unknown/);
assert.deepEqual(calls.at(-1), { path: '/api/iot/42/lock', body: undefined });
responses.push({ body: { success: true, data: { executionStatus: 'confirmed_success', bollardPosition: 'LOCKED' } } });
await api.performLockBollardCommand(token, bookingId);
assert.equal(gpsCount, 3, 'Lock requires no location read');

responses.push({ status: 401, body: { success: false, message: 'Session expired.' } });
await assert.rejects(api.performLockBollardCommand(token, bookingId), /Session expired/);
assert.equal(rejectedSessions, 1);
assert.equal(responses.length, 0);
console.log('Bollard flow: nested challenge, Bluetooth chooser, fresh GPS, acknowledgements and session handling passed.');
