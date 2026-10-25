import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export const isNativeApp = Capacitor.isNativePlatform();

export async function watchDeviceLocation(
  onPosition: (position: { lat: number; lng: number; accuracy: number }) => void,
  onError: (error: { code?: number | string }) => void,
): Promise<() => void> {
  if (!isNativeApp) {
    if (!navigator.geolocation) {
      onError({ code: 2 });
      return () => undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => onPosition({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      onError,
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }

  try {
    const permissions = await Geolocation.checkPermissions();
    if (permissions.location !== 'granted') await Geolocation.requestPermissions();
  } catch (error) {
    onError({ code: 1 });
    return () => undefined;
  }

  let watchId: string;
  try {
    watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000, interval: 30_000 },
      (position, error) => {
        if (error || !position) {
          onError({
            code: error?.code === 'OS-PLUG-GLOC-0003'
              ? 1
              : error?.code === 'OS-PLUG-GLOC-0010' ? 3 : 2,
          });
          return;
        }
        onPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
    );
  } catch {
    onError({ code: 2 });
    return () => undefined;
  }

  return () => { void Geolocation.clearWatch({ id: watchId }); };
}

export interface DeviceLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

export class DeviceLocationError extends Error {
  /** Mirrors the GeolocationPositionError codes: 1 = denied, 2 = unavailable, 3 = timeout. */
  code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = 'DeviceLocationError';
    this.code = code;
  }
}

const locationErrorMessages: Record<number, string> = {
  1: 'Location permission was denied. Allow location access for this site or app, then try again.',
  2: 'Your location is unavailable right now. Move somewhere with a clearer view of the sky and try again.',
  3: 'Getting your location timed out. Check your signal and try again.',
};

/**
 * One-shot location read for an explicit "verify" action.
 *
 * `watchDeviceLocation` is the streaming variant used for live tracking; this
 * resolves a single fix and rejects with a readable message so the caller can
 * surface a real reason instead of assuming success.
 */
export async function getDeviceLocation(timeoutMs = 12_000): Promise<DeviceLocation> {
  const toLocation = (coords: { latitude: number; longitude: number; accuracy: number }): DeviceLocation => ({
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
  });

  const fail = (code: number): never => {
    throw new DeviceLocationError(locationErrorMessages[code] ?? locationErrorMessages[2], code);
  };

  if (!isNativeApp) {
    if (!navigator.geolocation) fail(2);

    return new Promise<DeviceLocation>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(toLocation(position.coords)),
        (error) => reject(new DeviceLocationError(
          locationErrorMessages[error.code] ?? locationErrorMessages[2],
          error.code,
        )),
        { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
      );
    });
  }

  try {
    const permissions = await Geolocation.checkPermissions();
    if (permissions.location !== 'granted') {
      const requested = await Geolocation.requestPermissions();
      if (requested.location !== 'granted') fail(1);
    }
  } catch {
    fail(1);
  }

  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: timeoutMs,
    });
    return toLocation(position.coords);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    fail(code === 'OS-PLUG-GLOC-0003' ? 1 : code === 'OS-PLUG-GLOC-0011' ? 3 : 2);
  }

  return fail(2);
}
