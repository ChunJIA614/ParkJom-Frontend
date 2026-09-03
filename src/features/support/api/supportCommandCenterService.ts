import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type {
  AdminDashboardMetrics,
  OnCallPolicy,
  OnCallRosterStatus,
  SupportAuditEvent,
  SupportAuditLogResponse,
  TestOnCallAlertInput,
  TestOnCallAlertResult,
  UpdateOnCallPolicyInput,
} from '../types';

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw new Error(await readApiError(response, fallback));
  const payload = (await response.json().catch(() => null)) as {
    code?: number;
    success?: boolean;
    message?: string;
    data?: T;
  } | null;

  if (!payload || payload.success === false || payload.data === undefined) {
    throw new Error(payload?.message || fallback);
  }
  return payload.data;
}

/**
 * 1. Command Center Dashboard Metrics
 * GET /api/admin/support/dashboard
 */
export async function getAdminDashboardMetrics(token: string): Promise<AdminDashboardMetrics> {
  const response = await apiRequest('/admin/support/dashboard', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });
  return readJson<AdminDashboardMetrics>(response, 'Unable to load command center dashboard metrics.');
}

/**
 * 2. Get On-Call Roster Status
 * GET /api/admin/support/on-call
 */
export async function getOnCallRosterStatus(token: string): Promise<OnCallRosterStatus> {
  const response = await apiRequest('/admin/support/on-call', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });
  return readJson<OnCallRosterStatus>(response, 'Unable to load on-call roster status.');
}

/**
 * 3. Test On-Call Alert Notification
 * POST /api/admin/support/on-call/test
 */
export async function testOnCallAlert(
  token: string,
  input: TestOnCallAlertInput
): Promise<TestOnCallAlertResult> {
  const response = await apiRequest('/admin/support/on-call/test', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      channel: input.channel,
      targetUserId: input.targetUserId,
      testMessage: input.testMessage.trim(),
    }),
  });
  return readJson<TestOnCallAlertResult>(response, 'Unable to dispatch test alert notification.');
}

/**
 * 4. Update Escalation & On-Call Policy
 * PUT /api/admin/support/on-call/policy
 */
export async function updateOnCallPolicy(
  token: string,
  input: UpdateOnCallPolicyInput
): Promise<OnCallPolicy> {
  const response = await apiRequest('/admin/support/on-call/policy', {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(input),
  });
  return readJson<OnCallPolicy>(response, 'Unable to update on-call escalation policy.');
}

/**
 * 5. Query Support Audit Event Timeline
 * GET /api/admin/support/audit?page=1&pageSize=100
 */
export async function querySupportAuditTimeline(
  token: string,
  page = 1,
  pageSize = 100,
  objectType?: string
): Promise<SupportAuditLogResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (objectType && objectType !== 'All') {
    params.set('objectType', objectType);
  }

  const response = await apiRequest(`/admin/support/audit?${params.toString()}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });
  return readJson<SupportAuditLogResponse>(response, 'Unable to load support audit timeline.');
}
