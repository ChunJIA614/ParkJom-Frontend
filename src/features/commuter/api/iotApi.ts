import { apiRequest, authorizationHeaders } from '@/services/apiClient';

const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const CHALLENGE_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const PROOF_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

type Characteristic = EventTarget & {
  value?: DataView;
  startNotifications(): Promise<unknown>;
  writeValue(bytes: Uint8Array): Promise<void>;
  writeValueWithResponse?(bytes: Uint8Array): Promise<void>;
  writeValueWithoutResponse?(bytes: Uint8Array): Promise<void>;
};

type BollardDevice = {
  name?: string;
  gatt?: {
    connected: boolean;
    disconnect(): void;
    connect(): Promise<{
      getPrimaryService(uuid: string): Promise<{
        getCharacteristic(uuid: string): Promise<Characteristic>;
      }>;
    }>;
  };
};

type BollardBluetooth = {
  getDevices?(): Promise<BollardDevice[]>;
  requestDevice(options: { filters: { name: string }[]; optionalServices: string[] }): Promise<BollardDevice>;
};

export type UnlockChallenge = {
  bookingId: number;
  challengeId: string;
  nonce: string;
  deviceUuid: string;
  expiresAt: string;
  bleServiceUuid: string;
};

type CommandConfirmation = { executionStatus: string; bollardPosition: string };

function requireBluetooth(): BollardBluetooth {
  if (!globalThis.isSecureContext) {
    throw new Error('Open ParkJom over HTTPS to unlock with Bluetooth.');
  }
  const bluetooth = (navigator as Navigator & { bluetooth?: BollardBluetooth }).bluetooth;
  if (!bluetooth) {
    throw new Error('Bluetooth unlock is unavailable here. Open ParkJom in Chrome on Android or a desktop browser that supports Web Bluetooth.');
  }
  return bluetooth;
}

function acquireGpsLocation() {
  return new Promise<{ latitude: number; longitude: number; accuracyMeters: number; timestamp: string }>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location services are unavailable in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        timestamp: new Date(position.timestamp).toISOString(),
      }),
      (error) => reject(new Error(error.code === 1
        ? 'Allow location access to unlock your bollard.'
        : 'Unable to get a fresh location. Check location services and try again.')),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  });
}

async function postBollardRequest<T>(
  token: string,
  bookingId: number,
  action: 'unlock/challenge' | 'unlock' | 'lock',
  body?: object,
): Promise<{ data: T; message: string }> {
  const response = await apiRequest(`/iot/${bookingId}/${action}`, {
    method: 'POST',
    headers: authorizationHeaders(token, body ? 'application/json' : undefined),
    body: body ? JSON.stringify(body) : undefined,
  }, { preserveSessionOnForbidden: true });
  const result = await response.json().catch(() => null) as {
    success?: boolean;
    message?: string;
    title?: string;
    data?: T;
  } | null;
  if (!response.ok || !result?.success || !result.data) {
    throw new Error(result?.message || result?.title || `Bollard request failed (HTTP ${response.status}).`);
  }
  return { data: result.data, message: result.message ?? '' };
}

export function isUnlockChallengeCurrent(challenge: UnlockChallenge): boolean {
  return Date.parse(challenge.expiresAt) > Date.now();
}

function requireCurrentChallenge(challenge: UnlockChallenge): void {
  if (!isUnlockChallengeCurrent(challenge)) {
    throw new Error('The unlock request expired. Tap Unlock to start again.');
  }
}

export async function prepareBollardUnlock(token: string, bookingId: number, signal: AbortSignal): Promise<UnlockChallenge> {
  requireBluetooth();
  const location = await acquireGpsLocation();
  signal.throwIfAborted();
  const { data } = await postBollardRequest<Omit<UnlockChallenge, 'bookingId'>>(
    token, bookingId, 'unlock/challenge', { location },
  );
  const challenge = { ...data, bookingId, bleServiceUuid: data.bleServiceUuid || SERVICE_UUID };
  if (!challenge.challengeId || !challenge.nonce || !challenge.deviceUuid) {
    throw new Error('The server did not return an unlock challenge for this booking.');
  }
  requireCurrentChallenge(challenge);
  return challenge;
}

function deviceName(challenge: UnlockChallenge): string {
  return `ParkJom-${challenge.deviceUuid.slice(-6)}`;
}

export async function findRememberedBollard(challenge: UnlockChallenge): Promise<BollardDevice | undefined> {
  const devices = await requireBluetooth().getDevices?.().catch(() => []);
  return devices?.find((device) => device.name?.toLowerCase() === deviceName(challenge).toLowerCase());
}

async function exchangeProof(device: BollardDevice, challenge: UnlockChallenge): Promise<string> {
  const { gatt } = device;
  if (!gatt) throw new Error('The selected bollard cannot connect over Bluetooth.');

  try {
    const server = await gatt.connect();
    const service = await server.getPrimaryService(challenge.bleServiceUuid);
    const writer = await service.getCharacteristic(CHALLENGE_UUID);
    const reader = await service.getCharacteristic(PROOF_UUID);
    await reader.startNotifications();
    requireCurrentChallenge(challenge);

    let timer: ReturnType<typeof setTimeout> | undefined;
    let onProof: EventListener = () => {};
    const proof = new Promise<string>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('The bollard did not respond over Bluetooth. Move closer and try again.')), 7000);
      onProof = () => {
        const value = reader.value && new TextDecoder().decode(reader.value).trim();
        if (value) resolve(value);
      };
      reader.addEventListener('characteristicvaluechanged', onProof);
    });

    try {
      const bytes = new TextEncoder().encode(`${challenge.challengeId}|${challenge.nonce}|${challenge.deviceUuid}`);
      const write = writer.writeValueWithResponse ?? writer.writeValueWithoutResponse ?? writer.writeValue;
      const [response] = await Promise.all([proof, Promise.resolve().then(() => write.call(writer, bytes))]);
      return response;
    } finally {
      clearTimeout(timer);
      reader.removeEventListener('characteristicvaluechanged', onProof);
    }
  } finally {
    if (gatt.connected) gatt.disconnect();
  }
}

function confirmPosition(result: { data: CommandConfirmation; message: string }, position: 'UNLOCKED' | 'LOCKED') {
  if (result.data.executionStatus !== 'confirmed_success' || result.data.bollardPosition?.toUpperCase() !== position) {
    throw new Error('The bollard did not confirm its position. Check the bay before retrying.');
  }
  return result;
}

export async function completeBollardUnlock(
  token: string,
  challenge: UnlockChallenge,
  options: { device?: BollardDevice; signal: AbortSignal; onSubmitted: () => void },
) {
  options.signal.throwIfAborted();
  requireCurrentChallenge(challenge);
  const suffix = challenge.deviceUuid.slice(-6);
  const names = new Set([suffix, suffix.toLowerCase(), suffix.toUpperCase()]);
  // Open the chooser directly from the second tap, before waiting for GPS or a network request.
  const device = options.device ?? await requireBluetooth().requestDevice({
    filters: [...names].map((value) => ({ name: `ParkJom-${value}` })),
    optionalServices: [challenge.bleServiceUuid],
  }).catch((error: unknown) => {
    if (error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'NotAllowedError')) {
      throw new Error('Choose the assigned bollard in the Bluetooth window to continue.');
    }
    throw error;
  });
  options.signal.throwIfAborted();
  requireCurrentChallenge(challenge);
  const challengeResponse = await exchangeProof(device, challenge);
  options.signal.throwIfAborted();
  const location = await acquireGpsLocation();
  options.signal.throwIfAborted();
  requireCurrentChallenge(challenge);

  options.onSubmitted();
  const result = await postBollardRequest<CommandConfirmation>(token, challenge.bookingId, 'unlock', {
    challengeId: challenge.challengeId,
    location,
    bleVerification: { deviceUuid: challenge.deviceUuid, challengeResponse, rssi: null },
  });
  return confirmPosition(result, 'UNLOCKED');
}

export async function performLockBollardCommand(token: string, bookingId: number) {
  const result = await postBollardRequest<CommandConfirmation>(token, bookingId, 'lock');
  return confirmPosition(result, 'LOCKED');
}
