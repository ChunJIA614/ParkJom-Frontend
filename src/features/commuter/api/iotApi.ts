import { apiRequest, authorizationHeaders } from '@/services/apiClient';

const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const CHALLENGE_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const PROOF_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export interface UnlockLocationPayload {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: string;
}

export interface BleVerificationPayload {
  deviceUuid: string;
  challengeResponse: string;
  rssi?: number | null;
}

export interface UnlockChallengeApiResponse {
  success: boolean;
  errorCode?: string | null;
  message: string;
  challengeId?: string | null;
  nonce?: string | null;
  deviceUuid?: string | null;
  expiresAt?: string | null;
}

export interface BollardCommandApiResponse {
  success: boolean;
  errorCode?: string | null;
  message: string;
  bookingId?: number;
  deviceUuid?: string | null;
  action?: string | null;
  requestedAt?: string;
  acknowledgedAt?: string | null;
  distanceCm?: number | null;
  verification?: {
    gpsVerified: boolean;
    distanceMeters?: number | null;
    gpsAccuracyMeters?: number | null;
    bleVerified: boolean;
    bleRssi?: number | null;
  } | null;
}

async function acquireGpsLocation(): Promise<UnlockLocationPayload | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          timestamp: new Date(position.timestamp || Date.now()).toISOString(),
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  });
}

function expectedBleName(deviceUuid: string): string {
  const clean = deviceUuid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `ParkJom-${clean.slice(-6)}`;
}

async function requestBleProofFromEsp32(
  challengeId: string,
  nonce: string,
  deviceUuid: string,
): Promise<BleVerificationPayload | null> {
  const nav = navigator as Navigator & {
    bluetooth?: {
      getDevices?: () => Promise<any[]>;
      requestDevice: (options: any) => Promise<any>;
    };
  };

  if (!nav.bluetooth) {
    return null;
  }

  let device: any = null;
  const targetName = expectedBleName(deviceUuid);

  try {
    if (typeof nav.bluetooth.getDevices === 'function') {
      const permitted = await nav.bluetooth.getDevices();
      device =
        permitted.find(
          (item: any) =>
            item?.name === targetName || item?.name?.startsWith('ParkJom-'),
        ) ?? null;
    }

    if (!device) {
      device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SERVICE_UUID],
      });
    }

    if (!device?.gatt) {
      return null;
    }

    const server = await device.gatt.connect();
    try {
      const service = await server.getPrimaryService(SERVICE_UUID);
      const challengeCharacteristic = await service.getCharacteristic(CHALLENGE_UUID);
      const proofCharacteristic = await service.getCharacteristic(PROOF_UUID);

      await proofCharacteristic.startNotifications();

      const proofPromise = new Promise<string>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          reject(new Error('Timed out waiting for ESP32 BLE proof.'));
        }, 8000);

        const onCharacteristicChanged = (event: any) => {
          const val = event?.target?.value;
          if (!val) return;
          const text = new TextDecoder().decode(val).trim();
          if (text) {
            window.clearTimeout(timer);
            proofCharacteristic.removeEventListener(
              'characteristicvaluechanged',
              onCharacteristicChanged,
            );
            resolve(text);
          }
        };

        proofCharacteristic.addEventListener(
          'characteristicvaluechanged',
          onCharacteristicChanged,
        );
      });

      const payloadBytes = new TextEncoder().encode(
        `${challengeId}|${nonce}|${deviceUuid}`,
      );
      await challengeCharacteristic.writeValue(payloadBytes);

      let proof = '';
      try {
        proof = await proofPromise;
      } catch {
        const fallbackValue = await proofCharacteristic.readValue();
        proof = new TextDecoder().decode(fallbackValue).trim();
      }

      if (!proof) {
        return null;
      }

      return {
        deviceUuid,
        challengeResponse: proof,
        rssi: null,
      };
    } finally {
      if (device?.gatt?.connected) {
        device.gatt.disconnect();
      }
    }
  } catch {
    if (device?.gatt?.connected) {
      try {
        device.gatt.disconnect();
      } catch {
        // ignore disconnect error
      }
    }
    return null;
  }
}

/**
 * Performs the full hidden verification & unlock flow against the ParkJom backend:
 * 1) Acquires live GPS coordinates silently
 * 2) Requests an unlock challenge (`POST /api/iot/{bookingId}/unlock/challenge`)
 * 3) Exchanges BLE challenge/proof with the nearby ESP32 bollard
 * 4) Submits the unlock command (`POST /api/iot/{bookingId}/unlock`)
 * If any check fails, throws an Error containing the backend's invalid message.
 */
export async function performHiddenUnlockFlow(
  token: string,
  bookingId: number,
): Promise<BollardCommandApiResponse> {
  const initialLocation = await acquireGpsLocation();

  const challengeResponse = await apiRequest(
    `/iot/${encodeURIComponent(String(bookingId))}/unlock/challenge`,
    {
      method: 'POST',
      headers: authorizationHeaders(token, 'application/json'),
      body: JSON.stringify({ location: initialLocation }),
    },
  );

  const challengeRaw = (await challengeResponse.json().catch(() => null)) as
    | Record<string, any>
    | null;

  const challengeData: UnlockChallengeApiResponse = {
    success: Boolean(challengeRaw?.success ?? challengeRaw?.Success),
    errorCode: challengeRaw?.errorCode ?? challengeRaw?.ErrorCode ?? null,
    message:
      challengeRaw?.message ??
      challengeRaw?.Message ??
      'Unable to verify unlock eligibility.',
    challengeId: challengeRaw?.challengeId ?? challengeRaw?.ChallengeId ?? null,
    nonce: challengeRaw?.nonce ?? challengeRaw?.Nonce ?? null,
    deviceUuid: challengeRaw?.deviceUuid ?? challengeRaw?.DeviceUuid ?? null,
    expiresAt: challengeRaw?.expiresAt ?? challengeRaw?.ExpiresAt ?? null,
  };

  if (
    !challengeResponse.ok ||
    !challengeData.success ||
    !challengeData.challengeId ||
    !challengeData.nonce ||
    !challengeData.deviceUuid
  ) {
    throw new Error(
      challengeData.message || 'Verification failed before unlocking the bollard.',
    );
  }

  const bleVerification = await requestBleProofFromEsp32(
    challengeData.challengeId,
    challengeData.nonce,
    challengeData.deviceUuid,
  );

  const unlockLocation = (await acquireGpsLocation()) ?? initialLocation;

  const unlockResponse = await apiRequest(
    `/iot/${encodeURIComponent(String(bookingId))}/unlock`,
    {
      method: 'POST',
      headers: authorizationHeaders(token, 'application/json'),
      body: JSON.stringify({
        challengeId: challengeData.challengeId,
        location: unlockLocation,
        bleVerification,
      }),
    },
  );

  const unlockRaw = (await unlockResponse.json().catch(() => null)) as
    | Record<string, any>
    | null;

  const unlockData: BollardCommandApiResponse = {
    success: Boolean(unlockRaw?.success ?? unlockRaw?.Success),
    errorCode: unlockRaw?.errorCode ?? unlockRaw?.ErrorCode ?? null,
    message:
      unlockRaw?.message ??
      unlockRaw?.Message ??
      'Failed to unlock the parking bollard.',
    bookingId: unlockRaw?.bookingId ?? unlockRaw?.BookingId ?? bookingId,
    deviceUuid: unlockRaw?.deviceUuid ?? unlockRaw?.DeviceUuid ?? null,
    action: unlockRaw?.action ?? unlockRaw?.Action ?? 'UNLOCK',
    requestedAt: unlockRaw?.requestedAt ?? unlockRaw?.RequestedAt,
    acknowledgedAt: unlockRaw?.acknowledgedAt ?? unlockRaw?.AcknowledgedAt ?? null,
    distanceCm: unlockRaw?.distanceCm ?? unlockRaw?.DistanceCm ?? null,
  };

  if (!unlockResponse.ok || !unlockData.success) {
    throw new Error(unlockData.message || 'Unable to unlock the parking bollard.');
  }

  return unlockData;
}

/**
 * Sends the lock command (`POST /api/iot/{bookingId}/lock`) to raise the bollard.
 * Throws an Error with the backend's invalid message if an obstacle is detected or command fails.
 */
export async function performLockBollardCommand(
  token: string,
  bookingId: number,
): Promise<BollardCommandApiResponse> {
  const response = await apiRequest(
    `/iot/${encodeURIComponent(String(bookingId))}/lock`,
    {
      method: 'POST',
      headers: authorizationHeaders(token, 'application/json'),
    },
  );

  const raw = (await response.json().catch(() => null)) as
    | Record<string, any>
    | null;

  const data: BollardCommandApiResponse = {
    success: Boolean(raw?.success ?? raw?.Success),
    errorCode: raw?.errorCode ?? raw?.ErrorCode ?? null,
    message:
      raw?.message ?? raw?.Message ?? 'Failed to lock the parking bollard.',
    bookingId: raw?.bookingId ?? raw?.BookingId ?? bookingId,
    deviceUuid: raw?.deviceUuid ?? raw?.DeviceUuid ?? null,
    action: raw?.action ?? raw?.Action ?? 'LOCK',
    requestedAt: raw?.requestedAt ?? raw?.RequestedAt,
    acknowledgedAt: raw?.acknowledgedAt ?? raw?.AcknowledgedAt ?? null,
    distanceCm: raw?.distanceCm ?? raw?.DistanceCm ?? null,
  };

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Unable to lock the parking bollard.');
  }

  return data;
}
