import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type {
  CreatePublicParkingLotInput,
  PublicParkingCheckoutStripeResponse,
  PublicParkingLot,
  PublicParkingSession,
} from '../types';

function getAuthToken(): string | undefined {
  try {
    const raw = localStorage.getItem('parkjom_user');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return parsed.token || undefined;
  } catch {
    return undefined;
  }
}

function getAuthHeaders(contentType?: string): HeadersInit {
  const token = getAuthToken();
  return token
    ? authorizationHeaders(token, contentType)
    : contentType
    ? { 'Content-Type': contentType }
    : {};
}

export async function fetchPublicLots(includeAll: boolean = false): Promise<PublicParkingLot[]> {
  const url = includeAll ? '/api/public-parking/lots?all=true' : '/api/public-parking/lots';
  const res = await apiRequest(url);
  if (!res.ok) {
    const err = await readApiError(res, 'Failed to fetch public parking lots');
    throw new Error(err);
  }
  return res.json();
}

export async function fetchPublicLot(id: number): Promise<PublicParkingLot> {
  const res = await apiRequest(`/api/public-parking/lots/${id}`);
  if (!res.ok) {
    const err = await readApiError(res, 'Failed to fetch parking lot details');
    throw new Error(err);
  }
  return res.json();
}

export async function recordPublicEntry(lotId: number, carPlateNumber: string): Promise<PublicParkingSession> {
  const res = await apiRequest('/api/public-parking/entry', {
    method: 'POST',
    headers: getAuthHeaders('application/json'),
    body: JSON.stringify({ publicParkingLotId: lotId, carPlateNumber }),
  });

  if (!res.ok) {
    const err = await readApiError(res, 'Failed to record entry');
    throw new Error(err);
  }
  return res.json();
}

export async function lookupPublicSession(query: string): Promise<PublicParkingSession> {
  const res = await apiRequest(`/api/public-parking/sessions/lookup?query=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const err = await readApiError(res, 'No active parking session found');
    throw new Error(err);
  }
  return res.json();
}

export async function checkoutPublicWallet(sessionCode: string): Promise<PublicParkingSession> {
  const res = await apiRequest(`/api/public-parking/sessions/${encodeURIComponent(sessionCode)}/checkout-wallet`, {
    method: 'POST',
    headers: getAuthHeaders('application/json'),
  });

  if (!res.ok) {
    const err = await readApiError(res, 'Wallet checkout failed');
    throw new Error(err);
  }
  return res.json();
}

export async function checkoutPublicStripe(
  sessionCode: string,
  returnTarget: 'web' | 'native' = 'web'
): Promise<PublicParkingCheckoutStripeResponse> {
  const res = await apiRequest(
    `/api/public-parking/sessions/${encodeURIComponent(sessionCode)}/checkout-stripe?returnTarget=${returnTarget}`,
    {
      method: 'POST',
      headers: getAuthHeaders('application/json'),
    }
  );

  if (!res.ok) {
    const err = await readApiError(res, 'Stripe checkout initialization failed');
    throw new Error(err);
  }
  return res.json();
}

export async function recordPublicExit(lotId: number, carPlateNumber: string): Promise<PublicParkingSession> {
  const res = await apiRequest('/api/public-parking/exit', {
    method: 'POST',
    headers: getAuthHeaders('application/json'),
    body: JSON.stringify({ publicParkingLotId: lotId, carPlateNumber }),
  });

  if (!res.ok) {
    const err = await readApiError(res, 'Failed to record vehicle exit');
    throw new Error(err);
  }
  return res.json();
}

export async function createOwnerPublicLot(data: CreatePublicParkingLotInput): Promise<PublicParkingLot> {
  const res = await apiRequest('/api/owner/public-parking/lots', {
    method: 'POST',
    headers: getAuthHeaders('application/json'),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await readApiError(res, 'Failed to create public parking area');
    throw new Error(err);
  }
  return res.json();
}

export async function updateOwnerPublicLot(
  id: number,
  data: Partial<CreatePublicParkingLotInput>
): Promise<PublicParkingLot> {
  const res = await apiRequest(`/api/owner/public-parking/lots/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders('application/json'),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await readApiError(res, 'Failed to update public parking area');
    throw new Error(err);
  }
  return res.json();
}

export async function fetchOwnerLotSessions(lotId: number): Promise<PublicParkingSession[]> {
  const res = await apiRequest(`/api/owner/public-parking/lots/${lotId}/sessions`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await readApiError(res, 'Failed to fetch lot sessions');
    throw new Error(err);
  }
  return res.json();
}

export async function fetchOwnerPublicLots(): Promise<PublicParkingLot[]> {
  const res = await apiRequest('/api/owner/public-parking/lots', {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    return fetchPublicLots();
  }
  return res.json();
}

export async function reviewOwnerPublicLot(
  lotId: number,
  review: { status: 1 | 2 | 3 | 'Approved' | 'Rejected'; reviewNotes?: string; iotDeviceUuid?: string }
): Promise<PublicParkingLot> {
  const res = await apiRequest(`/api/public-parking/lots/${lotId}/review`, {
    method: 'POST',
    headers: getAuthHeaders('application/json'),
    body: JSON.stringify(review),
  });
  if (!res.ok) {
    const err = await readApiError(res, 'Failed to update lot review status');
    throw new Error(err);
  }
  return res.json();
}

export async function uploadPublicParkingPhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiRequest('/api/owner/public-parking/upload-photo', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const err = await readApiError(res, 'Failed to upload photo');
    throw new Error(err);
  }
  const data = await res.json();
  return data.url;
}

export async function uploadPublicParkingDocument(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiRequest('/api/owner/public-parking/upload-document', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const err = await readApiError(res, 'Failed to upload document');
    throw new Error(err);
  }
  const data = await res.json();
  return data.url;
}

export async function deletePublicLot(lotId: number): Promise<void> {
  const res = await apiRequest(`/api/public-parking/lots/${lotId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await readApiError(res, 'Failed to delete public parking lot');
    throw new Error(err);
  }
}
