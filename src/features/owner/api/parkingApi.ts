import { apiRequest, authorizationHeaders } from '@/services/apiClient';
import type { ParkingAvailabilityStatus } from '../types';

export function getMyParking(token: string): Promise<Response> {
  return apiRequest('/parking/my-parking', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });
}

export function configureParking(token: string, formData: FormData): Promise<Response> {
  return apiRequest('/parking/configuration', {
    method: 'POST',
    headers: authorizationHeaders(token),
    body: formData,
  });
}

export function updateParkingAvailability(
  token: string,
  parkingSpotId: number,
  availabilityStatus: ParkingAvailabilityStatus,
): Promise<Response> {
  return apiRequest('/parking/availability', {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({ parkingSpotId, availabilityStatus }),
  });
}

export function updateParkingPublication(
  token: string,
  parkingSpotId: number,
  isPublished: boolean,
): Promise<Response> {
  return apiRequest('/parking/publish', {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({ parkingSpotId, isPublished }),
  });
}
