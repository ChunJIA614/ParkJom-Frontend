import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import { SUPPORT_API } from './supportApiConfig';
import type {
  AdminDashboardMetrics,
  OnCallPolicy,
  OnCallRosterStatus,
  SupportAuditLogResponse,
  TestOnCallAlertInput,
  TestOnCallAlertResult,
  UpdateOnCallPolicyInput,
} from '../types';

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw new Error(await readApiError(response, fallback));
  const payload = (await response.json().catch(() => null)) as any;

  if (!payload) {
    throw new Error(fallback);
  }
  if (payload.success === false && payload.data === undefined) {
    throw new Error(payload?.message || fallback);
  }
  return (payload.data !== undefined ? payload.data : payload) as T;
}

/**
 * 1. Command Center Dashboard Metrics
 * GET /api/admin/support/dashboard
 */
export async function getAdminDashboardMetrics(token: string): Promise<AdminDashboardMetrics> {
  const response = await apiRequest(SUPPORT_API.ADMIN.DASHBOARD, {
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
  const response = await apiRequest(SUPPORT_API.ADMIN.ON_CALL.STATUS, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });
  return readJson<OnCallRosterStatus>(response, 'Unable to load on-call roster status.');
}

/**
 * 3. Test On-Call Alert Notification
 * POST /api/admin/support/on-call/test
 * Body: { channel, recipient, message? }
 */
export async function testOnCallAlert(
  token: string,
  input: TestOnCallAlertInput,
): Promise<TestOnCallAlertResult> {
  const msg = (input.message || input.testMessage || '').trim();
  const response = await apiRequest(SUPPORT_API.ADMIN.ON_CALL.TEST_NOTIFICATION, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      channel: input.channel,
      recipient: input.recipient,
      targetUserId: input.targetUserId,
      message: msg,
      testMessage: msg,
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
  input: UpdateOnCallPolicyInput,
): Promise<OnCallPolicy> {
  const response = await apiRequest(SUPPORT_API.ADMIN.ON_CALL.UPDATE_POLICY, {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(input),
  });
  return readJson<OnCallPolicy>(response, 'Unable to update on-call escalation policy.');
}

/**
 * 5. Query Support Audit Event Timeline
 * GET /api/admin/support/audit?objectType=&objectId=&page=1&pageSize=50
 */
export async function querySupportAuditTimeline(
  token: string,
  page = 1,
  pageSize = 50,
  objectType?: string,
  objectId?: string | number,
): Promise<SupportAuditLogResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (objectType && objectType !== 'All') {
    params.set('objectType', objectType);
  }
  if (objectId !== undefined && objectId !== null && String(objectId).trim() !== '') {
    params.set('objectId', String(objectId).trim());
  }

  const response = await apiRequest(`${SUPPORT_API.ADMIN.AUDIT_LOGS}?${params.toString()}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });
  return readJson<SupportAuditLogResponse>(response, 'Unable to load support audit timeline.');
}
