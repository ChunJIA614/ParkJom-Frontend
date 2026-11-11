import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

const { outputFiles } = buildSync({
  entryPoints: ['src/services/iotManagementApi.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  define: { 'import.meta.env.VITE_API_BASE': '"/api"' },
});
const api = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`);
const token = 'operator-token';
const calls = [];
const responses = [];
const ui = new EventTarget();
let rejectedSessions = 0;
ui.addEventListener('parkjom:auth-rejected', () => rejectedSessions++);
globalThis.window = ui;

globalThis.fetch = async (path, options) => {
  assert.equal(new Headers(options.headers).get('Authorization'), `Bearer ${token}`);
  calls.push({ path, body: options.body ? JSON.parse(options.body) : undefined });
  const response = responses.shift();
  assert.ok(response, `Unexpected API request to ${path}`);
  return Response.json(response.body, { status: response.status ?? 200 });
};

const uuid = '123e4567-e89b-12d3-a456-426614174000';
const device = { deviceUuid: uuid, deviceStatus: 'Online', isAssigned: false, parkingSpotId: null };
responses.push({ status: 201, body: { success: true, message: 'Device registered.', data: device } });
await api.registerIoTDevice(token, uuid);
assert.deepEqual(calls.at(-1), { path: '/api/iot/register', body: { deviceUuid: uuid } });

responses.push({ body: { success: true, data: { otp: '123456', expiresAtUtc: '2026-11-11T12:00:00Z' } } });
await api.generateIoTBindingOtp(token, uuid);
assert.deepEqual(calls.at(-1), { path: '/api/iot/gen-otp', body: { deviceUuid: uuid } });

responses.push({ body: { success: true, data: { ...device, isAssigned: true, parkingSpotId: 31 } } });
await api.bindIoTDevice(token, uuid, 31, '123456');
assert.deepEqual(calls.at(-1), { path: '/api/iot/bind', body: { deviceUuid: uuid, parkingSpotId: 31, otp: '123456' } });

const confirmed = (command, position, bookingId = null) => ({
  success: true,
  message: `Bollard ${command.toLowerCase()} confirmed by the device.`,
  data: { bookingId, deviceUuid: uuid, command, executionStatus: 'confirmed_success', bollardPosition: position },
});
for (const test of [
  [() => api.ownerUnlockParkingSpot(token, 31), '/api/owner/iot/parking-spots/31/unlock', confirmed('UNLOCK', 'UNLOCKED')],
  [() => api.adminLockBooking(token, 214), '/api/admin/iot/214/lock', confirmed('LOCK', 'LOCKED', 214)],
  [() => api.adminUnlockBooking(token, 214), '/api/admin/iot/214/unlock', confirmed('UNLOCK', 'UNLOCKED', 214)],
  [() => api.adminUnlockBooking(token, 214, 'booking-alias'), '/api/admin/iot/bookings/214/unlock', confirmed('UNLOCK', 'UNLOCKED', 214)],
  [() => api.adminUnlockParkingSpot(token, 31), '/api/admin/iot/parking-spots/31/unlock', confirmed('UNLOCK', 'UNLOCKED')],
  [() => api.adminUnlockDevice(token, 8), '/api/admin/iot/devices/8/unlock', confirmed('UNLOCK', 'UNLOCKED')],
]) {
  responses.push({ body: test[2] });
  await test[0]();
  assert.deepEqual(calls.at(-1), { path: test[1], body: undefined });
}

responses.push({ body: { success: true, data: { ...confirmed('UNLOCK', 'LOCKED').data } } });
await assert.rejects(api.adminUnlockDevice(token, 8), /did not confirm/);

responses.push({ status: 403, body: { success: false, message: 'Only property owners can bind devices.' } });
await assert.rejects(api.bindIoTDevice(token, uuid, 31, '123456'), /Only property owners/);
assert.equal(rejectedSessions, 0, 'Business authorization errors must not clear the login session');
assert.equal(responses.length, 0);
console.log('IoT management routes, acknowledgements and session handling passed.');
