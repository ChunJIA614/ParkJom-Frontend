import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type {
  AssignDisputeInput,
  CustomerDisputeDetail,
  CustomerDisputeItem,
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

// ── Admin Endpoints ──

/**
 * 1. List Dispute Register
 * GET /api/admin/support/disputes?page=1&pageSize=20
 */
export async function listAdminDisputes(
  token: string,
  page = 1,
  pageSize = 20,
  status?: string,
): Promise<DisputeListResponse> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status && status !== 'All') {
    query.set('status', status);
  }

  const response = await apiRequest(`/admin/support/disputes?${query.toString()}`, {
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
 * 2. Assign Dispute Case
 * POST /api/admin/support/disputes/{disputeIdentifier}/assign
 * Body: { assignedTeam, assignedUserId, status }
 */
export async function assignDisputeCase(
  token: string,
  disputeIdentifier: number | string,
  input: AssignDisputeInput,
): Promise<DisputeCase> {
  const response = await apiRequest(
    `/admin/support/disputes/${encodeURIComponent(String(disputeIdentifier).trim())}/assign`,
    {
      method: 'POST',
      headers: authorizationHeaders(token, 'application/json'),
      body: JSON.stringify({
        assignedTeam: input.assignedTeam || 'Finance',
        assignedUserId: Number(input.assignedUserId),
        status: input.status || 'EvidenceReview',
      }),
    },
  );

  return readJson<DisputeCase>(response, 'Unable to assign dispute case.');
}

/**
 * 3. Admin Request Customer Evidence
 * POST /api/admin/support/disputes/{disputeIdentifier}/request-evidence
 * Body: { customerMessage, deadlineDays }
 */
export async function adminRequestCustomerEvidence(
  token: string,
  disputeIdentifier: number | string,
  input: RequestDisputeEvidenceInput,
): Promise<void> {
  const response = await apiRequest(
    `/admin/support/disputes/${encodeURIComponent(String(disputeIdentifier).trim())}/request-evidence`,
    {
      method: 'POST',
      headers: authorizationHeaders(token, 'application/json'),
      body: JSON.stringify({
        customerMessage: input.customerMessage.trim(),
        deadlineDays: input.deadlineDays ?? 3,
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
 * Formdata: EvidenceType, File, Notes
 */
export async function adminUploadDisputeEvidence(
  token: string,
  disputeIdentifier: number | string,
  file: File,
  evidenceType = 'GatewayLog',
  notes?: string,
): Promise<DisputeEvidence> {
  const formData = new FormData();
  formData.append('EvidenceType', evidenceType);
  formData.append('File', file, file.name);
  if (notes) {
    formData.append('Notes', notes.trim());
  }

  const response = await apiRequest(
    `/admin/support/disputes/${encodeURIComponent(String(disputeIdentifier).trim())}/evidence`,
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
    `/admin/support/tickets/${encodeURIComponent(String(ticketIdentifier).trim())}/link-dispute`,
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
 * Body: { decision, decisionReason, approvedAmount }
 */
export async function finalizeDisputeDecision(
  token: string,
  disputeIdentifier: number | string,
  input: FinalizeDisputeDecisionInput,
): Promise<DisputeCase> {
  const response = await apiRequest(
    `/admin/support/disputes/${encodeURIComponent(String(disputeIdentifier).trim())}/decision`,
    {
      method: 'POST',
      headers: authorizationHeaders(token, 'application/json'),
      body: JSON.stringify({
        decision: input.decision,
        decisionReason: input.decisionReason.trim(),
        approvedAmount: input.approvedAmount !== undefined ? Number(input.approvedAmount) : 0,
      }),
    },
  );

  return readJson<DisputeCase>(response, 'Unable to finalize dispute decision.');
}

// ── Customer Endpoints ──

/**
 * 7. List My Disputes
 * GET /api/support/disputes/mine
 */
export async function listMyDisputes(token: string): Promise<CustomerDisputeItem[]> {
  const response = await apiRequest('/support/disputes/mine', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  const raw = await readJson<any>(response, 'Unable to load your dispute history.');
  return Array.isArray(raw) ? raw : (raw?.items ?? []);
}

/**
 * 8. Get Customer Dispute Details
 * GET /api/support/disputes/{disputeIdentifier}
 */
export async function getCustomerDisputeDetails(
  token: string,
  disputeIdentifier: number | string,
): Promise<CustomerDisputeDetail> {
  const response = await apiRequest(
    `/support/disputes/${encodeURIComponent(String(disputeIdentifier).trim())}`,
    {
      method: 'GET',
      headers: authorizationHeaders(token),
    },
  );

  return readJson<CustomerDisputeDetail>(response, 'Unable to load dispute details.');
}

/**
 * 9. Upload Customer Dispute Evidence
 * POST /api/support/disputes/{disputeIdentifier}/evidence
 * Formdata: EvidenceType, File, Notes
 */
export async function customerUploadDisputeEvidence(
  token: string,
  disputeIdentifier: number | string,
  file: File,
  evidenceType = 'BankReceipt',
  notes?: string,
): Promise<DisputeEvidence> {
  const formData = new FormData();
  formData.append('EvidenceType', evidenceType);
  formData.append('File', file, file.name);
  if (notes) {
    formData.append('Notes', notes.trim());
  }

  const response = await apiRequest(
    `/support/disputes/${encodeURIComponent(String(disputeIdentifier).trim())}/evidence`,
    {
      method: 'POST',
      headers: authorizationHeaders(token),
      body: formData,
    },
  );

  return readJson<DisputeEvidence>(response, 'Unable to upload evidence.');
}
