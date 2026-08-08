import { apiRequest } from '@/services/apiClient';

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
