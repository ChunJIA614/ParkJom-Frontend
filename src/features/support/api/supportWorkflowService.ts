import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import { SUPPORT_API } from './supportApiConfig';
import type {
  QuickIssueTemplate,
  SelfUnlockGateInput,
  SelfUnlockGateResult,
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

/**
 * 3. Self-Service Emergency Gate Unlock
 * POST /api/support/gate-unlock
 * Body (JSON): { bookingId?: number, action?: 'Enter' | 'Exit' }
 */
export async function selfUnlockGate(
  token: string,
  input: SelfUnlockGateInput = {},
): Promise<SelfUnlockGateResult> {
  const body: Record<string, unknown> = {
    action: input.action || 'Enter',
  };
  if (input.bookingId) {
    body.bookingId = Number(input.bookingId);
  }

  const response = await apiRequest(SUPPORT_API.USER.SELF_UNLOCK_GATE, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as any;
  const inner = payload?.data !== undefined ? payload.data : payload;

  if (!response.ok) {
    if (inner && (inner.suggestUrgentTicket !== undefined || inner.success === false)) {
      return {
        success: false,
        message: inner.message || payload?.message || 'Unable to unlock gate automatically.',
        commandId: inner.commandId ?? null,
        bookingId: inner.bookingId ?? input.bookingId ?? null,
        action: inner.action ?? input.action ?? 'Enter',
        suggestUrgentTicket: Boolean(inner.suggestUrgentTicket ?? payload?.suggestUrgentTicket ?? true),
        executedAt: inner.executedAt ?? new Date().toISOString(),
      };
    }
    throw new Error(
      inner?.message || payload?.message || (await readApiError(response, 'Unable to unlock gate.')),
    );
  }

  return {
    success: inner?.success ?? payload?.success ?? true,
    message: inner?.message || payload?.message || 'Gate unlock signal dispatched.',
    commandId: inner?.commandId ?? null,
    bookingId: inner?.bookingId ?? input.bookingId ?? null,
    action: inner?.action ?? input.action ?? 'Enter',
    suggestUrgentTicket: Boolean(inner?.suggestUrgentTicket ?? payload?.suggestUrgentTicket ?? false),
    executedAt: inner?.executedAt ?? new Date().toISOString(),
  };
}

