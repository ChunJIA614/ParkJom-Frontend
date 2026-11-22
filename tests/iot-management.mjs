import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
const { outputFiles } = buildSync({ entryPoints: ['src/services/iotManagementApi.ts'], bundle: true, write: false, format: 'esm', define: { 'import.meta.env.VITE_API_BASE': '"/api"' } });
const api = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].contents).toString('base64'));
const token = 'operator-token', calls = [], responses = [], methods = [], caches = [];
const ui = new EventTarget(); let rejectedSessions = 0;
ui.addEventListener('parkjom:auth-rejected', () => rejectedSessions++); globalThis.window = ui;
globalThis.fetch = async (path, options) => {
  assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer ' + token);
  calls.push({ path, body: options.body ? JSON.parse(options.body) : undefined }); methods.push(options.method || 'GET'); caches.push(options.cache);
  const response = responses.shift(); assert.ok(response, 'Unexpected request: ' + path);
  return Response.json(response.body, { status: response.status ?? 200 });
};
const uuid = '123e4567-e89b-12d3-a456-426614174000';
const device = { deviceUuid: uuid, deviceStatus: 'Online', isAssigned: true, parkingSpotId: 31, lastHeartbeatAt: null };
const reply = data => responses.push({ body: { success: true, data } });
reply(device); await api.registerIoTDevice(token, uuid); assert.deepEqual(calls.at(-1), { path: '/api/iot/register', body: { deviceUuid: uuid } });
reply({ otp: '032581', expiresAtUtc: '2026-11-22T12:00:00Z' }); await api.generateIoTBindingOtp(token, uuid); assert.equal(calls.at(-1).path, '/api/iot/gen-otp');
reply(device); await api.bindIoTDevice(token, 31, '032581'); assert.deepEqual(calls.at(-1), { path: '/api/iot/bind', body: { parkingSpotId: 31, otp: '032581' } });
for (const [fn, route] of [[api.listOwnerIoTDevices, '/api/owner/iot/devices'], [api.listAdminIoTDevices, '/api/admin/iot/devices']]) {
  reply([device]); assert.deepEqual(await fn(token), [device]); assert.equal(calls.at(-1).path, route); assert.equal(methods.at(-1), 'GET');
}
const status = { deviceUuid: uuid, bookingId: 42, heartbeatStatus: 'online', lastHeartbeatAt: '2026-11-22T08:00:00Z', checkedAt: '2026-11-22T08:00:05Z', offlineAfterSeconds: 90, distanceCm: 75, sensorStatus: 'ok', bollardPosition: 'UNLOCKED', receivedAt: '2026-11-22T08:00:00Z', parkingSpot: { parkingSpotId: 31, parkingLabel: 'A-31', propertyId: 3, propertyName: 'Fixture' } };
for (const [target, query] of [[{ bookingId: 42 }, 'bookingId=42'], [{ deviceUuid: uuid }, 'deviceUuid=' + uuid], [{ parkingSpotId: 31 }, 'parkingSpotId=31']]) {
  reply(status); assert.deepEqual(await api.getIoTStatus(token, target), status); assert.deepEqual(calls.at(-1), { path: '/api/iot/status?' + query, body: undefined }); assert.equal(methods.at(-1), 'GET'); assert.equal(caches.at(-1), 'no-store');
}
const empty = { ...status, bollardPosition: null, receivedAt: null, distanceCm: null, sensorStatus: 'unknown', heartbeatStatus: 'unknown' };
reply(empty); assert.deepEqual(await api.getIoTStatus(token, { bookingId: 42 }), empty, 'Empty history is a valid unknown state');
const unavailable = { ...status, distanceCm: null, sensorStatus: 'unavailable' };
reply(unavailable); assert.equal((await api.getIoTStatus(token, { bookingId: 42 })).sensorStatus, 'unavailable');
reply({ ...status, heartbeatStatus: 'offline', receivedAt: '2020-01-01T00:00:00Z' }); assert.equal((await api.getIoTStatus(token, { bookingId: 42 })).receivedAt, '2020-01-01T00:00:00Z', 'Do not relabel an old reading as fresh');
reply({ ...status, bollardPosition: 'OTHER' }); await assert.rejects(api.getIoTStatus(token, { bookingId: 42 }), /invalid status/);
reply({ ...status, distanceCm: -1 }); await assert.rejects(api.getIoTStatus(token, { bookingId: 42 }), /invalid distance/);
reply(unavailable); assert.equal((await api.scanIoTStatus(token, uuid)).sensorStatus, 'unavailable'); assert.deepEqual(calls.at(-1), { path: '/api/iot/' + uuid + '/status/scan', body: undefined }); assert.equal(methods.at(-1), 'POST');
responses.push({ status: 504, body: { success: false, message: 'Scan timed out.' } }); await assert.rejects(api.scanIoTStatus(token, uuid), /Scan timed out/);
for (const target of [{}, { bookingId: 0 }, { parkingSpotId: -1 }, { bookingId: 42, parkingSpotId: 31 }, { deviceUuid: '8' }]) {
  const before = calls.length; await assert.rejects(api.getIoTStatus(token, target)); assert.equal(calls.length, before);
}
const confirmed = (position, bookingId = null) => ({ executionStatus: 'confirmed_success', bollardPosition: position, bookingId, deviceUuid: uuid });
for (const [fn, route, body, position] of [
  [() => api.ownerUnlockParkingSpot(token, 31), '/api/owner/iot/parking-spots/31/unlock', undefined, 'UNLOCKED'],
  [() => api.ownerLockParkingSpot(token, 31), '/api/owner/iot/parking-spots/31/lock', undefined, 'LOCKED'],
  [() => api.adminLockBooking(token, 42), '/api/admin/iot/lock', { bookingId: 42 }, 'LOCKED'],
  [() => api.adminUnlockBooking(token, 42), '/api/admin/iot/unlock', { bookingId: 42 }, 'UNLOCKED'],
  [() => api.adminUnlockParkingSpot(token, 31), '/api/admin/iot/unlock', { parkingSpotId: 31 }, 'UNLOCKED'],
  [() => api.adminLockParkingSpot(token, 31), '/api/admin/iot/lock', { parkingSpotId: 31 }, 'LOCKED'],
  [() => api.adminUnlockDevice(token, uuid), '/api/admin/iot/unlock', { deviceUuid: uuid }, 'UNLOCKED'],
  [() => api.adminLockDevice(token, uuid), '/api/admin/iot/lock', { deviceUuid: uuid }, 'LOCKED'],
]) { reply(confirmed(position)); await fn(); assert.deepEqual(calls.at(-1), { path: route, body }); assert.equal(methods.at(-1), 'POST'); }
reply(confirmed('LOCKED')); await assert.rejects(api.adminUnlockDevice(token, uuid), /did not confirm/);
responses.push({ status: 504, body: { success: false, errorCode: 'DEVICE_ACK_TIMEOUT', message: 'Device acknowledgement timed out.' } });
await assert.rejects(api.adminUnlockDevice(token, uuid), error => error instanceof api.IoTCommandError && error.needsPositionCheck);
responses.push({ status: 409, body: { success: false, errorCode: 'OBSTACLE_DETECTED', message: 'Obstacle detected.' } });
await assert.rejects(api.adminLockDevice(token, uuid), error => error instanceof api.IoTCommandError && !error.needsPositionCheck);
const count = calls.length; assert.throws(() => api.adminUnlockDevice(token, '8'), /UUID/); assert.equal(calls.length, count);
responses.push({ status: 403, body: { success: false, message: 'Outside role scope.' } }); await assert.rejects(api.getIoTStatus(token, { deviceUuid: uuid }), /Outside role scope/);
assert.equal(rejectedSessions, 0, 'Business authorization errors do not clear the session'); assert.equal(responses.length, 0);
console.log('Canonical IoT routes, GET selectors, empty/stale/partial status, explicit scans, admin JSON targets, acknowledgements, and session preservation passed.');
