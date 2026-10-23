import { apiRequest, readApiError } from '@/services/apiClient';
import type { PublicParkingSpotResponse } from '../types';

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

  return payload;
}
