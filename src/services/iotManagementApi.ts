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

interface IoTEnvelope<T> {
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
    throw new Error(payload?.message || payload?.title || payload?.error || `IoT request failed (HTTP ${response.status}).`);
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
): Promise<{ data: IoTCommandConfirmation; message: string }> {
  const result = await postIoT<IoTCommandConfirmation>(token, path);
  if (
    result.data.executionStatus !== 'confirmed_success'
    || result.data.bollardPosition?.toUpperCase() !== expectedPosition
  ) {
    throw new Error('The bollard did not confirm its final position. Check the bay before trying again.');
  }
  return result;
}

export async function listOwnerIoTDevices(token: string, signal?: AbortSignal): Promise<OwnerIoTDevice[]> {
  const response = await apiRequest('/iot/owner/devices', {
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

export async function scanBollardPosition(token: string, deviceUuid: string, signal?: AbortSignal): Promise<BollardPosition> {
  const { data } = await postIoT<{ bollardPosition?: string | null }>(
    token, `/iot/${encodeURIComponent(deviceUuid)}/status/scan`, undefined, signal,
  );
  const position = data.bollardPosition?.toUpperCase();
  if (position !== 'LOCKED' && position !== 'UNLOCKED') {
    throw new Error('The bollard did not report its position.');
  }
  return position;
}

export function adminLockBooking(token: string, bookingId: number) {
  return sendCommand(token, `/admin/iot/${bookingId}/lock`, 'LOCKED');
}

export function adminUnlockBooking(
  token: string,
  bookingId: number,
  route: 'direct' | 'booking-alias' = 'direct',
) {
  const path = route === 'booking-alias'
    ? `/admin/iot/bookings/${bookingId}/unlock`
    : `/admin/iot/${bookingId}/unlock`;
  return sendCommand(token, path, 'UNLOCKED');
}

export function adminUnlockParkingSpot(token: string, parkingSpotId: number) {
  return sendCommand(token, `/admin/iot/parking-spots/${parkingSpotId}/unlock`, 'UNLOCKED');
}

export function adminUnlockDevice(token: string, iotDeviceId: number) {
  return sendCommand(token, `/admin/iot/devices/${iotDeviceId}/unlock`, 'UNLOCKED');
}
