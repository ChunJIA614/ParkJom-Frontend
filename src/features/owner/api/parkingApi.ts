import { apiRequest, authorizationHeaders } from '@/services/apiClient';
import type {
  ParkingAvailabilityStatus,
  ParkingAvailabilityRulesPayload,
  CloseParkingAvailabilityPayload,
  ParkingAvailabilityRuleInput,
  ParkingConfigurationPayload,
  ParkingImageUpdatePayload,
} from '../types';

export function getMyParking(token: string): Promise<Response> {
  return apiRequest('/owner/parking/my-parking', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });
}

export function configureParking(token: string, formData: FormData): Promise<Response> {
  return apiRequest('/owner/parking/register', {
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

export function updateParkingImageOrder(
  token: string,
  parkingSpotId: number,
  image: ParkingImageUpdatePayload,
): Promise<Response> {
  return apiRequest(`/owner/parking/${parkingSpotId}/images`, {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(image),
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
  image?: ParkingImageUpdatePayload,
): Promise<Response> {
  return apiRequest(`/owner/parking/${parkingSpotId}/images/${parkingSpotImageId}`, {
    method: 'DELETE',
    headers: authorizationHeaders(token, 'application/json'),
    ...(image ? { body: JSON.stringify(image) } : {}),
  });
}

export function getOwnerAvailabilityRules(
  token: string,
  parkingSpotId: number,
): Promise<Response> {
  return apiRequest(`/owner/parking/${parkingSpotId}/availability-rules`, {
    method: 'GET',
    headers: authorizationHeaders(token),
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

export function updateAvailabilityRule(
  token: string,
  parkingSpotId: number,
  ruleId: number,
  rule: ParkingAvailabilityRuleInput,
): Promise<Response> {
  return apiRequest(`/owner/parking/${parkingSpotId}/availability-rules/${ruleId}`, {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(rule),
  });
}

export function deleteAvailabilityRule(
  token: string,
  parkingSpotId: number,
  ruleId: number,
): Promise<Response> {
  return apiRequest(`/owner/parking/${parkingSpotId}/availability-rules/${ruleId}`, {
    method: 'DELETE',
    headers: authorizationHeaders(token),
  });
}

export function closeParkingAvailabilityDates(
  token: string,
  parkingSpotId: number,
  payload: CloseParkingAvailabilityPayload,
): Promise<Response> {
  return apiRequest(`/owner/parking/${parkingSpotId}/availability-rules/close`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(payload),
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

export function getOwnerSpotBookings(
  token: string,
  parkingSpotId: number,
  params?: { month?: string; status?: string },
): Promise<Response> {
  const query = new URLSearchParams();
  if (params?.month) query.set('month', params.month);
  if (params?.status) query.set('status', params.status);
  const qStr = query.toString();
  return apiRequest(`/owner/parking/${parkingSpotId}/bookings${qStr ? `?${qStr}` : ''}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });
}

export function getOwnerSpotBookingDetail(
  token: string,
  parkingSpotId: number,
  bookingId: number,
): Promise<Response> {
  return apiRequest(`/owner/parking/${parkingSpotId}/bookings/${bookingId}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });
}

export function getOwnerBookingsCalendar(
  token: string,
  params: { spotId?: number; month?: string; status?: string },
): Promise<Response> {
  const query = new URLSearchParams();
  if (params.spotId != null) query.set('spotId', String(params.spotId));
  if (params.month) query.set('month', params.month);
  if (params.status) query.set('status', params.status);
  const qStr = query.toString();
  return apiRequest(`/owner/bookings${qStr ? `?${qStr}` : ''}`, {
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
