import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import { SUPPORT_API } from './supportApiConfig';
import type {
  QuickIssueTemplate,
  SupportContextData,
} from '../types';

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    throw new Error(await readApiError(response, fallback));
  }
  const payload = (await response.json().catch(() => null)) as any;

  if (!payload) {
    throw new Error(fallback);
  }
  if (payload.success === false && payload.data === undefined) {
    throw new Error(payload.message || fallback);
  }
  return (payload.data !== undefined ? payload.data : payload) as T;
}

/**
 * 1. Get Support Context
 * GET /api/support/context?bookingId={{bookingId}}&vehicleId={{vehicleId}}
 */
export async function getSupportContext(
  token: string,
  bookingId?: number | null,
  vehicleId?: number | null,
): Promise<SupportContextData> {
  const params = new URLSearchParams();
  if (bookingId) params.set('bookingId', String(bookingId));
  if (vehicleId) params.set('vehicleId', String(vehicleId));

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiRequest(`${SUPPORT_API.USER.GET_CONTEXT}${query}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  return readJson<SupportContextData>(response, 'Unable to load user support context.');
}

/**
 * 2. Get Role-Specific Quick Issue Templates (Commuter vs PropertyOwner)
 * GET /api/support/templates
 */
export async function getSupportTemplates(token: string): Promise<QuickIssueTemplate[]> {
  const response = await apiRequest(SUPPORT_API.USER.GET_TEMPLATES, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  const data = await readJson<any>(response, 'Unable to load quick issue templates.');
  if (Array.isArray(data)) return data as QuickIssueTemplate[];
  if (Array.isArray(data?.templates)) return data.templates as QuickIssueTemplate[];
  if (Array.isArray(data?.items)) return data.items as QuickIssueTemplate[];
  return [];
}

