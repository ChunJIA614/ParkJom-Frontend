import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import { SUPPORT_API } from './supportApiConfig';
import type {
  AssignDisputeInput,
  DisputeCase,
  DisputeEvidence,
  DisputeListResponse,
  FinalizeDisputeDecisionInput,
  RequestDisputeEvidenceInput,
  SupportTicket,
} from '../types';
import { normalizeTicket } from './supportTicketService';

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

// ── Admin Endpoints ──

/**
 * 1. List Dispute Register
 * GET /api/admin/support/disputes?status=&type=&team=&page=1&pageSize=25
 */
export async function listAdminDisputes(
  token: string,
  page = 1,
  pageSize = 25,
  status?: string,
  type?: string,
  team?: string,
): Promise<DisputeListResponse> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status && status !== 'All') {
    query.set('status', status);
  }
  if (type && type !== 'All') {
    query.set('type', type);
  }
  if (team && team !== 'All') {
    query.set('team', team);
  }

  const response = await apiRequest(`${SUPPORT_API.ADMIN.DISPUTES.LIST}?${query.toString()}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  const raw = await readJson<any>(response, 'Unable to load dispute register.');

  if (Array.isArray(raw)) {
    return {
      items: raw,
      page: 1,
      pageSize: raw.length,
      totalCount: raw.length,
      totalPages: 1,
      hasNextPage: false,
    };
  }

  return {
    items: Array.isArray(raw?.items) ? raw.items : [],
    page: raw?.page ?? page,
    pageSize: raw?.pageSize ?? pageSize,
    totalCount: raw?.totalCount ?? 0,
    totalPages: raw?.totalPages ?? 1,
    hasNextPage: raw?.hasNextPage ?? false,
  };
}

/**
 * 1b. Get Admin Dispute Details
 * GET /api/admin/support/disputes/{disputeId}
 */
export async function getAdminDisputeDetails(
  token: string,
  disputeId: number | string,
): Promise<DisputeCase> {
  const response = await apiRequest(SUPPORT_API.ADMIN.DISPUTES.DETAIL(disputeId), {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  return readJson<DisputeCase>(response, 'Unable to retrieve dispute details.');
}

/**
 * 2. Assign Dispute Case
 * POST /api/admin/support/disputes/{disputeIdentifier}/assign
 * Body: { assignedUserId?, assignedTeam?, status? }
 */
export async function assignDisputeCase(
  token: string,
  disputeIdentifier: number | string,
  input: AssignDisputeInput,
): Promise<DisputeCase> {
  const response = await apiRequest(
    SUPPORT_API.ADMIN.DISPUTES.ASSIGN(String(disputeIdentifier).trim()),
    {
      method: 'POST',
      headers: authorizationHeaders(token, 'application/json'),
      body: JSON.stringify({
        assignedTeam: input.assignedTeam || 'Finance',
        ...(input.assignedUserId !== undefined ? { assignedUserId: Number(input.assignedUserId) } : {}),
        status: input.status || 'EvidenceReview',
      }),
    },
  );

  return readJson<DisputeCase>(response, 'Unable to assign dispute case.');
}

/**
 * 3. Admin Request Customer Evidence
 * POST /api/admin/support/disputes/{disputeIdentifier}/request-evidence
 * Body: { requiredEvidence, customerMessage, deadline?, deadlineDays? }
 */
export async function adminRequestCustomerEvidence(
  token: string,
  disputeIdentifier: number | string,
  input: RequestDisputeEvidenceInput,
): Promise<void> {
  const days = input.deadlineDays ?? 3;
  const resolvedDeadline =
    input.deadline ||
    new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const response = await apiRequest(
    SUPPORT_API.ADMIN.DISPUTES.REQUEST_EVIDENCE(String(disputeIdentifier).trim()),
    {
      method: 'POST',
      headers: authorizationHeaders(token, 'application/json'),
      body: JSON.stringify({
        requiredEvidence: input.requiredEvidence?.trim() || 'Supporting payment receipt or photo evidence',
        customerMessage: input.customerMessage.trim(),
        deadline: resolvedDeadline,
        deadlineDays: days,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to request customer evidence.'));
  }
}

/**
 * 4. Admin Upload Dispute Evidence
 * POST /api/admin/support/disputes/{disputeIdentifier}/evidence
 * FormData: evidenceType, description?, file
 */
export async function adminUploadDisputeEvidence(
  token: string,
  disputeIdentifier: number | string,
  file: File,
  evidenceType = 'GatewayLog',
  notes?: string,
): Promise<DisputeEvidence> {
  const formData = new FormData();
  formData.append('evidenceType', evidenceType);
  formData.append('file', file, file.name);
  if (notes) {
    formData.append('description', notes.trim());
    formData.append('Notes', notes.trim());
  }

  const response = await apiRequest(
    SUPPORT_API.ADMIN.DISPUTES.UPLOAD_EVIDENCE(String(disputeIdentifier).trim()),
    {
      method: 'POST',
      headers: authorizationHeaders(token),
      body: formData,
    },
  );

  return readJson<DisputeEvidence>(response, 'Unable to upload admin dispute evidence.');
}

/**
 * 5. Link Ticket to Dispute
 * POST /api/admin/support/tickets/{ticketIdentifier}/link-dispute
 * Body: { disputeId?: number, disputeReference?: string }
 */
export async function linkTicketToDispute(
  token: string,
  ticketIdentifier: number | string,
  disputeIdentifier: number | string,
): Promise<SupportTicket> {
  const dspStr = String(disputeIdentifier).trim();
  const isNumeric = /^\d+$/.test(dspStr);
  const body = isNumeric
    ? { disputeId: Number(dspStr), disputeReference: dspStr }
    : { disputeReference: dspStr };

  const response = await apiRequest(
    SUPPORT_API.ADMIN.TICKETS.LINK_DISPUTE(String(ticketIdentifier).trim()),
    {
      method: 'POST',
      headers: authorizationHeaders(token, 'application/json'),
      body: JSON.stringify(body),
    },
  );

  const raw = await readJson<any>(response, 'Unable to link ticket to dispute.');
  return normalizeTicket(raw);
}

/**
 * 6. Finalize Dispute Decision & Execute Settlement
 * POST /api/admin/support/disputes/{disputeIdentifier}/decision
 * Body: { decision: 'ApproveReversal'|'Decline'|'NeedMoreInfo', reason, amount? }
 */
export async function finalizeDisputeDecision(
  token: string,
  disputeIdentifier: number | string,
  input: FinalizeDisputeDecisionInput,
): Promise<DisputeCase> {
  const reasonText = (input.reason || input.decisionReason || '').trim();
  const resolvedAmount =
    input.amount !== undefined
      ? Number(input.amount)
      : input.approvedAmount !== undefined
      ? Number(input.approvedAmount)
      : 0;

  const response = await apiRequest(
    SUPPORT_API.ADMIN.DISPUTES.DECISION(String(disputeIdentifier).trim()),
    {
      method: 'POST',
      headers: authorizationHeaders(token, 'application/json'),
      body: JSON.stringify({
        decision: input.decision,
        reason: reasonText,
        decisionReason: reasonText,
        amount: resolvedAmount,
        approvedAmount: resolvedAmount,
      }),
    },
  );

  return readJson<DisputeCase>(response, 'Unable to finalize dispute decision.');
}

