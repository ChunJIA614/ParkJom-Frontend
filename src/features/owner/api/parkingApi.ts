import { apiRequest, authorizationHeaders } from '@/services/apiClient';
import type {
  ParkingAvailabilityStatus,
  ParkingAvailabilityRulesPayload,
  ParkingConfigurationPayload,
  ParkingImageUpdatePayload,
} from '../types';

export function getMyParking(token: string): Promise<Response> {
  return apiRequest('/owner/parking', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });
}

export function configureParking(token: string, formData: FormData): Promise<Response> {
  return apiRequest('/owner/parking', {
    method: 'POST',
    headers: authorizationHeaders(token),
    body: formData,
  });
}

export function updateParkingConfiguration(
  token: string,
  parkingSpotId: number,
  configuration: ParkingConfigurationPayload,
): Promise<Response> {
  return apiRequest(`/owner/parking/${parkingSpotId}/configuration`, {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(configuration),
  });
}

export function uploadParkingImages(
  token: string,
  parkingSpotId: number,
  images: File[],
): Promise<Response> {
  const formData = new FormData();
  images.forEach((image) => formData.append('images', image));

  return apiRequest(`/owner/parking/${parkingSpotId}/images`, {
    method: 'POST',
    headers: authorizationHeaders(token),
    body: formData,
  });
}

export function updateParkingImage(
  token: string,
  parkingSpotId: number,
  parkingSpotImageId: number,
  image: ParkingImageUpdatePayload,
): Promise<Response> {
  return apiRequest(`/owner/parking/${parkingSpotId}/images/${parkingSpotImageId}`, {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(image),
  });
}

export function deleteParkingImage(
  token: string,
  parkingSpotId: number,
  parkingSpotImageId: number,
  image: ParkingImageUpdatePayload,
): Promise<Response> {
  return apiRequest(`/owner/parking/${parkingSpotId}/images/${parkingSpotImageId}`, {
    method: 'DELETE',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(image),
  });
}

export function createParkingAvailabilityRules(
  token: string,
  parkingSpotId: number,
  availability: ParkingAvailabilityRulesPayload,
): Promise<Response> {
  return apiRequest(`/owner/parking/${parkingSpotId}/availability-rules`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(availability),
  });
}

export function getOwnerAvailabilityCalendar(
  token: string,
  parkingSpotId: number,
  month: string,
): Promise<Response> {
  const query = new URLSearchParams({ month });
  return apiRequest(`/owner/parking/${parkingSpotId}/availability-calendar?${query.toString()}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
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
