import { apiRequest, authorizationHeaders } from '@/services/apiClient';

export function searchMalaysiaLocations(query: string): Promise<Response> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=my&limit=5&accept-language=en`;
  return fetch(url, {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
}

export function reverseGeocodeMalaysia(lat: number, lon: number): Promise<Response> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=en`;
  return fetch(url, {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
}

export function registerParking(token: string, formData: FormData): Promise<Response> {
  return apiRequest('/owner/parking/register', {
    method: 'POST',
    headers: authorizationHeaders(token),
    body: formData,
  });
}

export const createParking = registerParking;
