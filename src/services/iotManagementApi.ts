import { apiRequest, authorizationHeaders } from '@/services/apiClient';

export interface IoTDeviceInfo {
  deviceUuid: string;
  deviceStatus: string;
  isAssigned: boolean;
  parkingSpotId: number | null;
}

export interface IoTOtpInfo {
  otp: string;
  expiresAtUtc: string;
}

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

async function postIoT<T>(token: string, path: string, body?: object): Promise<{ data: T; message: string }> {
  const response = await apiRequest(path, {
    method: 'POST',
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

export function registerIoTDevice(token: string, deviceUuid: string) {
  return postIoT<IoTDeviceInfo>(token, '/iot/register', { deviceUuid });
}

export function generateIoTBindingOtp(token: string, deviceUuid: string) {
  return postIoT<IoTOtpInfo>(token, '/iot/gen-otp', { deviceUuid });
}

export function bindIoTDevice(token: string, deviceUuid: string, parkingSpotId: number, otp: string) {
  return postIoT<IoTDeviceInfo>(token, '/iot/bind', { deviceUuid, parkingSpotId, otp });
}

export function ownerUnlockParkingSpot(token: string, parkingSpotId: number) {
  return sendCommand(token, `/owner/iot/parking-spots/${parkingSpotId}/unlock`, 'UNLOCKED');
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
