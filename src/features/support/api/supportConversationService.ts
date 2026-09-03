import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type {
  AdminConversationQueueResponse,
  AdminCreateTicketFromConversationInput,
  EscalateConversationToTicketInput,
  StartConversationInput,
  SupportConversation,
  SupportConversationDetail,
  SupportConversationMessage,
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

// ── Customer / Commuter / Owner Endpoints ──

/**
 * 1. Start Live Chat Conversation
 * POST /api/support/conversations
 */
export async function startConversation(
  token: string,
  input: StartConversationInput,
): Promise<SupportConversation> {
  const response = await apiRequest('/support/conversations', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      channel: input.channel || 'LiveChat',
      initialMessage: input.initialMessage.trim(),
      bookingId: input.bookingId ?? null,
    }),
  });

  return readJson<SupportConversation>(response, 'Unable to start support conversation.');
}

/**
 * 2. List My Conversations
 * GET /api/support/conversations?status=Open
 */
export async function listMyConversations(
  token: string,
  status?: string,
): Promise<SupportConversation[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await apiRequest(`/support/conversations${query}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  return readJson<SupportConversation[]>(response, 'Unable to load support conversations.');
}

/**
 * 3. Get Conversation Details
 * GET /api/support/conversations/{conversationId}
 */
export async function getConversationDetails(
  token: string,
  conversationId: number | string,
): Promise<SupportConversationDetail> {
  const response = await apiRequest(`/support/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  return readJson<SupportConversationDetail>(response, `Unable to load details for conversation #${conversationId}.`);
}

/**
 * 4. Send Customer Message to Conversation
 * POST /api/support/conversations/{conversationId}/messages (FormData)
 */
export async function sendCustomerConversationMessage(
  token: string,
  conversationId: number | string,
  message: string,
  isInternal = false,
  attachments?: File[],
): Promise<SupportConversationMessage> {
  const form = new FormData();
  form.append('Message', message.trim());
  form.append('IsInternal', String(isInternal));
  if (attachments && attachments.length > 0) {
    attachments.forEach((file) => form.append('attachments', file));
  }

  const response = await apiRequest(`/support/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: authorizationHeaders(token),
    body: form,
  });

  return readJson<SupportConversationMessage>(response, 'Unable to send message.');
}

/**
 * 5. Customer Close Conversation
 * POST /api/support/conversations/{conversationId}/close
 */
export async function closeCustomerConversation(
  token: string,
  conversationId: number | string,
  reason: string,
): Promise<SupportConversation> {
  const response = await apiRequest(`/support/conversations/${encodeURIComponent(conversationId)}/close`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      reason: reason.trim(),
    }),
  });

  return readJson<SupportConversation>(response, 'Unable to close conversation.');
}

/**
 * 6. Customer Escalate Conversation to Ticket
 * POST /api/support/conversations/{conversationId}/ticket
 */
export async function escalateConversationToTicket(
  token: string,
  conversationId: number | string,
  input: EscalateConversationToTicketInput,
): Promise<any> {
  const response = await apiRequest(`/support/conversations/${encodeURIComponent(conversationId)}/ticket`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      subject: input.subject.trim(),
      category: input.category || 'ParkingAccess',
      priority: input.priority || 'P1',
    }),
  });

  return readJson<any>(response, 'Unable to convert conversation to ticket.');
}

// ── Admin Endpoints ──

/**
 * 7. List Admin Conversation Queue
 * GET /api/admin/support/conversations?page=1&pageSize=20
 */
export async function listAdminConversationQueue(
  token: string,
  page = 1,
  pageSize = 20,
): Promise<AdminConversationQueueResponse> {
  const response = await apiRequest(`/admin/support/conversations?page=${page}&pageSize=${pageSize}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  return readJson<AdminConversationQueueResponse>(response, 'Unable to load admin conversation queue.');
}

/**
 * 8. Send Admin Reply / Internal Note
 * POST /api/admin/support/conversations/{conversationId}/messages (FormData)
 */
export async function sendAdminConversationMessage(
  token: string,
  conversationId: number | string,
  message: string,
  isInternal = false,
  attachments?: File[],
): Promise<SupportConversationMessage> {
  const form = new FormData();
  form.append('Message', message.trim());
  form.append('IsInternal', String(isInternal));
  if (attachments && attachments.length > 0) {
    attachments.forEach((file) => form.append('attachments', file));
  }

  const response = await apiRequest(`/admin/support/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: authorizationHeaders(token),
    body: form,
  });

  return readJson<SupportConversationMessage>(response, 'Unable to post admin message.');
}

/**
 * 9. Dispatch Preset Workflow to Chat
 * POST /api/admin/support/conversations/{conversationId}/workflow
 */
export async function dispatchWorkflowToConversation(
  token: string,
  conversationId: number | string,
  workflow: { key: string; label: string },
): Promise<SupportConversationMessage> {
  const response = await apiRequest(`/admin/support/conversations/${encodeURIComponent(conversationId)}/workflow`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      key: workflow.key,
      label: workflow.label,
    }),
  });

  return readJson<SupportConversationMessage>(response, 'Unable to dispatch workflow to conversation.');
}

/**
 * 10. Admin Reply & Close Conversation
 * POST /api/admin/support/conversations/{conversationId}/close
 */
export async function closeAdminConversation(
  token: string,
  conversationId: number | string,
  reason: string,
): Promise<SupportConversation> {
  const response = await apiRequest(`/admin/support/conversations/${encodeURIComponent(conversationId)}/close`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      reason: reason.trim(),
    }),
  });

  return readJson<SupportConversation>(response, 'Unable to close conversation.');
}

/**
 * 11. Admin Create Custom Ticket from Conversation
 * POST /api/admin/support/conversations/{conversationId}/ticket
 */
export async function createAdminTicketFromConversation(
  token: string,
  conversationId: number | string,
  input: AdminCreateTicketFromConversationInput,
): Promise<any> {
  const response = await apiRequest(`/admin/support/conversations/${encodeURIComponent(conversationId)}/ticket`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      subject: input.subject.trim(),
      category: input.category || 'ParkingAccess',
      priority: input.priority || 'P1',
      assignedTeam: input.assignedTeam || 'ParkingOperations',
      internalSummary: input.internalSummary?.trim() || '',
    }),
  });

  return readJson<any>(response, 'Unable to create ticket from conversation.');
}
