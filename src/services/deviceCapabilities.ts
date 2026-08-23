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
