import { apiRequest, readApiError } from '@/services/apiClient';
import type { PublicParkingSpotDetail, PublicParkingSpotResponse } from '../types';

export function getNearbyParking(
  latitude: number,
  longitude: number,
  radiusKmOrSignal?: number | AbortSignal,
  signal?: AbortSignal,
): Promise<Response> {
  let radiusKm: number | undefined;
  let abortSignal: AbortSignal | undefined;

  if (typeof radiusKmOrSignal === 'number') {
    radiusKm = radiusKmOrSignal;
    abortSignal = signal;
  } else if (radiusKmOrSignal instanceof AbortSignal) {
    abortSignal = radiusKmOrSignal;
  }

  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
  });
  if (radiusKm !== undefined) {
    params.set('radiusKm', radiusKm.toString());
  }
  params.set('pageSize', '100');

  return apiRequest(`/parking/nearby?${params.toString()}`, {
    signal: abortSignal,
    headers: { Accept: 'application/json' },
  });
}

export function searchParking(query: string): Promise<Response> {
  const params = new URLSearchParams({ query });
  return apiRequest(`/parking/search?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
}

type WireRecord = Record<string, unknown>;

function readWireNumber(source: WireRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readWireString(source: WireRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

/**
 * The public parking detail contract does not guarantee coordinates. Accept
 * several common wire shapes, and treat `0,0` / out-of-range values as
 * "unknown" — a bay rendered in the Gulf of Guinea is worse than no pin.
 */
function resolveCoordinates(source: WireRecord): { latitude: number | null; longitude: number | null } {
  const latitude = readWireNumber(source, ['latitude', 'Latitude', 'lat', 'Lat']);
  const longitude = readWireNumber(source, ['longitude', 'Longitude', 'lng', 'Lng', 'lon', 'Lon']);
  if (latitude === null || longitude === null) return { latitude: null, longitude: null };
  if (latitude === 0 && longitude === 0) return { latitude: null, longitude: null };
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return { latitude: null, longitude: null };
  return { latitude, longitude };
}

function normalizeParkingDetail(
  detail: PublicParkingSpotDetail,
): PublicParkingSpotDetail {
  const source = detail as unknown as WireRecord;
  const { latitude, longitude } = resolveCoordinates(source);

  return {
    ...detail,
    latitude,
    longitude,
    stationName: readWireString(source, ['stationName', 'StationName']),
    distanceToStationMeters: readWireNumber(source, [
      'distanceToStationMeters', 'DistanceToStationMeters', 'distanceToStation', 'DistanceToStation',
    ]),
    timeToStationInMinutes: readWireNumber(source, [
      'timeToStationInMinutes', 'TimeToStationInMinutes', 'timeToStation', 'TimeToStation',
    ]),
  };
}

export async function getPublicParkingSpot(
  id: number | string,
  signal?: AbortSignal,
): Promise<PublicParkingSpotResponse> {
  const response = await apiRequest(`/public/parking/${encodeURIComponent(String(id))}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load parking spot details.'));
  }

  const payload = (await response.json().catch(() => null)) as PublicParkingSpotResponse | null;
  if (!payload || !payload.success) {
    throw new Error(payload?.message || 'Unable to load parking spot details.');
  }

  return {
    ...payload,
    data: normalizeParkingDetail(payload.data),
  };
}
