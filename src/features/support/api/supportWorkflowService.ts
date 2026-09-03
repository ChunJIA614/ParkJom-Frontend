import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type {
  ExecuteWorkflowRunInput,
  SupportContextData,
  SupportWorkflowDefinition,
  SupportWorkflowRun,
} from '../types';

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    throw new Error(await readApiError(response, fallback));
  }
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
  const response = await apiRequest(`/support/context${query}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  return readJson<SupportContextData>(response, 'Unable to load user support context.');
}

/**
 * 2. List Active Support Workflows
 * GET /api/support/workflows
 */
export async function listSupportWorkflows(token: string): Promise<SupportWorkflowDefinition[]> {
  const response = await apiRequest('/support/workflows', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  return readJson<SupportWorkflowDefinition[]>(response, 'Unable to load support workflows.');
}

/**
 * 3. Get Support Workflow Schema
 * GET /api/support/workflows/{workflowKey}
 */
export async function getSupportWorkflowSchema(
  token: string,
  workflowKey: string,
): Promise<SupportWorkflowDefinition> {
  const response = await apiRequest(`/support/workflows/${encodeURIComponent(workflowKey)}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  return readJson<SupportWorkflowDefinition>(response, `Unable to load workflow schema for "${workflowKey}".`);
}

/**
 * 4. Execute Support Workflow Run
 * POST /api/support/workflows/{workflowKey}/runs
 */
export async function executeWorkflowRun(
  token: string,
  workflowKey: string,
  input: ExecuteWorkflowRunInput,
): Promise<SupportWorkflowRun> {
  const response = await apiRequest(`/support/workflows/${encodeURIComponent(workflowKey)}/runs`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      answers: input.answers ?? {},
      bookingId: input.bookingId ?? null,
      vehicleId: input.vehicleId ?? null,
      clientRequestId: input.clientRequestId || `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }),
  });

  return readJson<SupportWorkflowRun>(response, 'Unable to execute support workflow triage.');
}

/**
 * 5. Get Workflow Run Status
 * GET /api/support/workflow-runs/{runId}
 */
export async function getWorkflowRunStatus(
  token: string,
  runId: number | string,
): Promise<SupportWorkflowRun> {
  const response = await apiRequest(`/support/workflow-runs/${encodeURIComponent(runId)}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  return readJson<SupportWorkflowRun>(response, `Unable to load workflow run status for #${runId}.`);
}
