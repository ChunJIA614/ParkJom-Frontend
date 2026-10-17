import { apiRequest, readApiError } from '@/services/apiClient';
import type { PublicParkingSpotResponse } from '../types';

export function getNearbyParking(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<Response> {
  const params = new URLSearchParams({ latitude: latitude.toString(), longitude: longitude.toString() });
  return apiRequest(`/parking/nearby?${params.toString()}`, {
    signal,
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
