import { apiRequest, authorizationHeaders } from '@/services/apiClient';

export interface IoTDeviceInfo {
  deviceUuid: string;
  deviceStatus: string;
  isAssigned: boolean;
  parkingSpotId: number | null;
}

export interface OwnerIoTDevice extends IoTDeviceInfo {
  lastHeartbeatAt: string | null;
  firmwareVersion?: string | null;
}

export interface IoTOtpInfo {
  otp: string;
  expiresAtUtc: string;
}

export type BollardPosition = 'LOCKED' | 'UNLOCKED';

export interface IoTCommandConfirmation {
  bookingId: number | null;
  deviceUuid: string;
  command: 'LOCK' | 'UNLOCK';
  executionStatus: string;
  bollardPosition: string;
  validationOverride?: boolean | null;
}

export class IoTCommandError extends Error {
  constructor(message: string, public readonly needsPositionCheck: boolean) {
    super(message);
    this.name = 'IoTCommandError';
  }
}

interface IoTEnvelope<T> {
  errorCode?: string;
  success?: boolean;
  message?: string;
  title?: string;
  error?: string;
  data?: T;
}

async function postIoT<T>(token: string, path: string, body?: object, signal?: AbortSignal): Promise<{ data: T; message: string }> {
  const response = await apiRequest(path, {
    method: 'POST',
    signal,
    headers: authorizationHeaders(token, body ? 'application/json' : undefined),
    body: body ? JSON.stringify(body) : undefined,
  }, { preserveSessionOnForbidden: true });
  const payload = await response.json().catch(() => null) as IoTEnvelope<T> | null;

  if (!response.ok || payload?.success === false) {
    const needsPositionCheck = response.status === 504 || response.status === 502
      || payload?.errorCode === 'DEVICE_COMMAND_IN_PROGRESS';
    throw new IoTCommandError(payload?.message || payload?.title || payload?.error || `IoT request failed (HTTP ${response.status}).`, needsPositionCheck);
  }
  if (!payload?.data) {
    throw new Error(payload?.message || 'The IoT service returned no confirmation data.');
  }
  return { data: payload.data, message: payload.message ?? '' };
}

async function sendCommand(
  token: string,
  path: string,
  expectedPosition: 'LOCKED' | 'UNLOCKED',
  target?: IoTTarget,
): Promise<{ data: IoTCommandConfirmation; message: string }> {
  const result = await postIoT<IoTCommandConfirmation>(token, path, target);
  if (
    result.data.executionStatus !== 'confirmed_success'
    || result.data.bollardPosition?.toUpperCase() !== expectedPosition
  ) {
    throw new IoTCommandError('The bollard did not confirm its final position. Check the bay before trying again.', true);
  }
  return result;
}

export async function listOwnerIoTDevices(token: string, signal?: AbortSignal): Promise<OwnerIoTDevice[]> {
  const response = await apiRequest('/owner/iot/devices', {
    headers: authorizationHeaders(token),
    signal,
  }, { preserveSessionOnForbidden: true });
  const payload = await response.json().catch(() => null) as IoTEnvelope<OwnerIoTDevice[]> | null;
  if (!response.ok || payload?.success === false || !Array.isArray(payload?.data)) {
    throw new Error(payload?.message || 'Unable to check your bollard connections.');
  }
  return payload.data;
}

export function registerIoTDevice(token: string, deviceUuid: string) {
  return postIoT<IoTDeviceInfo>(token, '/iot/register', { deviceUuid });
}

export function generateIoTBindingOtp(token: string, deviceUuid: string) {
  return postIoT<IoTOtpInfo>(token, '/iot/gen-otp', { deviceUuid });
}

export function bindIoTDevice(token: string, parkingSpotId: number, otp: string) {
  return postIoT<IoTDeviceInfo>(token, '/iot/bind', { parkingSpotId, otp });
}

export function ownerUnlockParkingSpot(token: string, parkingSpotId: number) {
  return sendCommand(token, `/owner/iot/parking-spots/${parkingSpotId}/unlock`, 'UNLOCKED');
}

export function ownerLockParkingSpot(token: string, parkingSpotId: number) {
  return sendCommand(token, `/owner/iot/parking-spots/${parkingSpotId}/lock`, 'LOCKED');
}

/** Exactly one target, shared by status GETs and the unified admin commands. */
export type IoTTarget =
  | { bookingId: number; deviceUuid?: never; parkingSpotId?: never }
  | { deviceUuid: string; bookingId?: never; parkingSpotId?: never }
  | { parkingSpotId: number; bookingId?: never; deviceUuid?: never };

export interface IoTStatusData {
  deviceUuid: string;
  bookingId: number | null;
  heartbeatStatus: 'online' | 'offline' | 'unknown';
  lastHeartbeatAt: string | number | null;
  checkedAt: string | number | null;
  offlineAfterSeconds: number;
  distanceCm: number | null;
  sensorStatus: 'ok' | 'unknown' | 'unavailable';
  bollardPosition: BollardPosition | null;
  receivedAt: string | number | null;
  parkingSpot: { parkingSpotId: number; parkingLabel: string; propertyId: number; propertyName: string } | null;
}

function validateTarget(target: IoTTarget): IoTTarget {
  const keys = Object.keys(target);
  if (keys.length !== 1 || !['bookingId', 'deviceUuid', 'parkingSpotId'].includes(keys[0])) throw new Error('Choose exactly one IoT target.');
  if ('deviceUuid' in target) {
    const uuid = target.deviceUuid?.trim();
    if (!uuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) throw new Error('Enter a valid device UUID.');
    return { deviceUuid: uuid };
  }
  const value = 'bookingId' in target ? target.bookingId : target.parkingSpotId;
  if (!Number.isInteger(value) || value! < 1) throw new Error('Enter a positive target ID.');
  return target;
}

function normalizeStatus(data: IoTStatusData): IoTStatusData {
  const position = data.bollardPosition?.toUpperCase() ?? null;
  if (!data.deviceUuid || (position !== null && position !== 'LOCKED' && position !== 'UNLOCKED')) throw new Error('The device returned an invalid status report.');
  if (data.distanceCm != null && (!Number.isFinite(data.distanceCm) || data.distanceCm < 0)) throw new Error('The device returned an invalid distance reading.');
  return { ...data, bollardPosition: position as BollardPosition | null, distanceCm: data.distanceCm ?? null, receivedAt: data.receivedAt ?? null,
    sensorStatus: data.sensorStatus ?? 'unknown', heartbeatStatus: data.heartbeatStatus ?? 'unknown' };
}

/** Latest stored ACK/telemetry only. Does not contact MQTT or move the device. */
export async function getIoTStatus(token: string, target: IoTTarget, signal?: AbortSignal): Promise<IoTStatusData> {
  const selected = validateTarget(target);
  const query = new URLSearchParams(Object.entries(selected).map(([key, value]) => [key, String(value)]));
  const response = await apiRequest('/iot/status?' + query.toString(), {
    method: 'GET', headers: authorizationHeaders(token), signal, cache: 'no-store',
  }, { preserveSessionOnForbidden: true });
  const payload = await response.json().catch(() => null) as IoTEnvelope<IoTStatusData> | null;
  if (!response.ok || payload?.success !== true || !payload.data) throw new Error(payload?.message || 'Unable to load the latest bollard status.');
  return normalizeStatus(payload.data);
}

/** Explicit fresh distance/position scan, available only to the device's owner/admin. */
export async function scanIoTStatus(token: string, deviceUuid: string, signal?: AbortSignal): Promise<IoTStatusData> {
  const target = validateTarget({ deviceUuid }) as { deviceUuid: string };
  const { data } = await postIoT<IoTStatusData>(token, '/iot/' + encodeURIComponent(target.deviceUuid) + '/status/scan', undefined, signal);
  return normalizeStatus(data);
}

export async function listAdminIoTDevices(token: string, signal?: AbortSignal): Promise<OwnerIoTDevice[]> {
  const response = await apiRequest('/admin/iot/devices', { headers: authorizationHeaders(token), signal }, { preserveSessionOnForbidden: true });
  const payload = await response.json().catch(() => null) as IoTEnvelope<OwnerIoTDevice[]> | null;
  if (!response.ok || payload?.success !== true || !Array.isArray(payload.data)) throw new Error(payload?.message || 'Unable to load the device inventory.');
  return payload.data;
}

export function adminLockTarget(token: string, target: IoTTarget) {
  return sendCommand(token, '/admin/iot/lock', 'LOCKED', validateTarget(target));
}
export function adminUnlockTarget(token: string, target: IoTTarget) {
  return sendCommand(token, '/admin/iot/unlock', 'UNLOCKED', validateTarget(target));
}
export const adminLockBooking = (token: string, bookingId: number) => adminLockTarget(token, { bookingId });
export const adminUnlockBooking = (token: string, bookingId: number) => adminUnlockTarget(token, { bookingId });
export const adminUnlockParkingSpot = (token: string, parkingSpotId: number) => adminUnlockTarget(token, { parkingSpotId });
export const adminLockParkingSpot = (token: string, parkingSpotId: number) => adminLockTarget(token, { parkingSpotId });
export const adminUnlockDevice = (token: string, deviceUuid: string) => adminUnlockTarget(token, { deviceUuid });
export const adminLockDevice = (token: string, deviceUuid: string) => adminLockTarget(token, { deviceUuid });
