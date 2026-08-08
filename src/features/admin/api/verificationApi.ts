import { apiRequest, authorizationHeaders } from '@/services/apiClient';
import type { ParkingVerificationDecision } from '../types';

export function listVerificationRequests(token: string): Promise<Response> {
  return apiRequest('/parking/verification-requests', {
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
