import { apiRequest, authorizationHeaders } from '@/services/apiClient';

export function searchMalaysiaLocations(query: string): Promise<Response> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=my&limit=3`;
  return fetch(url);
}

export function registerParking(token: string, formData: FormData): Promise<Response> {
  return apiRequest('/owner/parking/register', {
    method: 'POST',
    headers: authorizationHeaders(token),
    body: formData,
  });
}

export const createParking = registerParking;
