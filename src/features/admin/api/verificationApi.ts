import { apiRequest, authorizationHeaders } from '@/services/apiClient';
import type { ParkingVerificationDecision } from '../types';

export interface VerificationRequestListOptions {
  status?: string;
  page?: number;
  pageSize?: number;
}

export function listVerificationRequests(
  token: string,
  options: VerificationRequestListOptions = {},
): Promise<Response> {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.page && options.page > 0) params.set('page', String(Math.floor(options.page)));
  if (options.pageSize && options.pageSize > 0) params.set('pageSize', String(Math.floor(options.pageSize)));

  const query = params.toString();
  return apiRequest(`/parking/verification-requests${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: authorizationHeaders(token, 'application/json'),
  });
}

export function fetchVerificationDocument(
  token: string,
  mediaFileId: string | number,
  accept: string,
): Promise<Response> {
  return apiRequest(`/media/view/document/${mediaFileId}`, {
    method: 'GET',
    headers: authorizationHeaders(token, undefined, accept),
  });
}

export function submitVerificationDecision(
  token: string,
  verificationRequestId: string | number,
  decision: ParkingVerificationDecision,
  reviewNotes: string,
): Promise<Response> {
  return apiRequest(`/parking/verification-requests/${verificationRequestId}/decision`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({ decision, review_notes: reviewNotes }),
  });
}
