import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import { publishLocalSupportEvent } from '../realtime/supportRealtime';
import type {
  CloseSupportTicketInput,
  CreateAdminSupportTicketInput,
  CreateSupportTicketInput,
  ReassignSupportTicketInput,
  ReopenSupportTicketInput,
  SupportAttachment,
  SupportAuditTimelineEvent,
  SupportMessage,
  SupportTicket,
  SupportTicketStatus,
  SupportViewer,
  TransitionSupportTicketStatusInput,
} from '../types';

const STORAGE_KEY = 'parkjom.supportTickets.v1';
const useRemoteApi = () => import.meta.env.VITE_SUPPORT_API_MODE !== 'local';
const now = () => new Date().toISOString();
const makeId = () => crypto.randomUUID();

const readLocalTickets = (): SupportTicket[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? (parsed as SupportTicket[]) : [];
  } catch {
    return [];
  }
};

const writeLocalTickets = (tickets: SupportTicket[]) => {
  const persisted = tickets.map((ticket) => ({
    ...ticket,
    messages: (ticket.messages || []).map((message) => ({
      ...message,
      attachments: (message.attachments || []).map((attachment) => ({
        ...attachment,
        url: attachment.url?.startsWith('blob:') ? null : attachment.url,
        fileUrl: attachment.fileUrl?.startsWith('blob:') ? null : attachment.fileUrl,
      })),
    })),
  }));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
};

export const normalizeAttachment = (att: any): SupportAttachment => {
  if (!att) {
    return {
      attachmentId: makeId(),
      fileName: 'attachment',
      contentType: 'application/octet-stream',
      size: 0,
      fileSize: 0,
      url: null,
      fileUrl: null,
      isPrivate: false,
      createdAt: now(),
    };
  }
  const fileUrl = att.fileUrl || att.url || null;
  const size = att.fileSize ?? att.size ?? 0;
  return {
    attachmentId: att.attachmentId ?? makeId(),
    fileName: att.fileName || 'attachment',
    contentType: att.contentType || 'application/octet-stream',
    size,
    fileSize: size,
    url: fileUrl,
    fileUrl,
    isPrivate: att.isPrivate ?? false,
    createdAt: att.createdAt || now(),
  };
};

export const normalizeMessage = (raw: any): SupportMessage => {
  if (!raw) {
    return {
      messageId: makeId(),
      ticketId: '',
      senderUserId: null,
      senderName: 'Support',
      senderRole: 'User',
      messageType: 'User',
      message: '',
      body: '',
      isInternal: false,
      createdAt: now(),
      attachments: [],
    };
  }

  const rawAttachments = Array.isArray(raw.attachments) ? raw.attachments : [];
  const attachments = rawAttachments.map(normalizeAttachment);
  const text = raw.body || raw.message || '';

  return {
    messageId: raw.messageId ?? makeId(),
    ticketId: raw.ticketId ?? '',
    senderUserId: raw.senderUserId ?? null,
    senderName: raw.senderName || 'User',
    senderRole: raw.senderRole || 'Customer',
    messageType:
      raw.senderRole === 'Admin'
        ? 'Admin'
        : raw.senderRole === 'Customer'
        ? 'User'
        : raw.messageType || 'User',
    message: text,
    body: text,
    isInternal: Boolean(raw.isInternal),
    createdAt: raw.createdAt || now(),
    attachments,
  };
};

export const normalizeTicket = (raw: any): SupportTicket => {
  if (!raw) {
    return {
      ticketId: makeId(),
      ticketReference: `TKT-${new Date().getFullYear()}-00000`,
      status: 'New',
      subject: '',
      customerUserId: 0,
      customerName: '',
      customerEmail: '',
      createdAt: now(),
      updatedAt: now(),
      messages: [],
      attachments: [],
      auditTimeline: [],
    };
  }

  const rawMessages = Array.isArray(raw.messages) ? raw.messages : [];
  const messages = rawMessages.map(normalizeMessage);
  const rawAttachments = Array.isArray(raw.attachments) ? raw.attachments : [];
  const attachments = rawAttachments.map(normalizeAttachment);
  const auditTimeline: SupportAuditTimelineEvent[] = Array.isArray(raw.auditTimeline) ? raw.auditTimeline : [];

  return {
    ticketId: raw.ticketId ?? makeId(),
    ticketReference: raw.ticketReference || `TKT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    ticketType: raw.ticketType || 'Custom',
    source: raw.source || 'QuickHelp',
    category: raw.category || 'General',
    priority: raw.priority || 'P2',
    status: raw.status || 'New',
    subject: raw.subject || 'Support Inquiry',
    description: raw.description || '',
    customerUserId: raw.customerUserId || 0,
    customerName: raw.customerName || 'Customer',
    customerEmail: raw.customerEmail || '',
    customerRole: raw.customerRole || 'Commuter',
    assignedAdminUserId: raw.assignedAdminUserId ?? null,
    assignedAdminName: raw.assignedAdminName ?? null,
    assignedTeam: raw.assignedTeam ?? null,
    conversationId: raw.conversationId ?? null,
    conversationReference: raw.conversationReference ?? null,
    workflowRunId: raw.workflowRunId ?? null,
    workflowRunReference: raw.workflowRunReference ?? null,
    bookingId: raw.bookingId ?? null,
    bookingReference: raw.bookingReference ?? null,
    parkingSpotId: raw.parkingSpotId ?? null,
    vehicleId: raw.vehicleId ?? null,
    operationalIncidentId: raw.operationalIncidentId ?? null,
    incidentReference: raw.incidentReference ?? null,
    disputeInvestigationId: raw.disputeInvestigationId ?? null,
    disputeReference: raw.disputeReference ?? null,
    acceptedAt: raw.acceptedAt ?? null,
    firstResponseAt: raw.firstResponseAt ?? null,
    firstResponseDueAt: raw.firstResponseDueAt ?? null,
    resolvedAt: raw.resolvedAt ?? null,
    resolutionDueAt: raw.resolutionDueAt ?? null,
    closedAt: raw.closedAt ?? null,
    resolutionCode: raw.resolutionCode ?? null,
    internalSummary: raw.internalSummary ?? null,
    createdAt: raw.createdAt || now(),
    updatedAt: raw.updatedAt || now(),
    messageCount: raw.messageCount ?? (messages.length || 1),
    messages,
    attachments,
    auditTimeline,
  };
};

const publish = (
  type: 'ticket.created' | 'ticket.updated' | 'message.created' | 'ticket.closed',
  ticketId: string | number,
) => publishLocalSupportEvent({ type, ticketId, occurredAt: now() });

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw new Error(await readApiError(response, fallback));
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    data?: T;
  } | null;
  if (!payload || payload.success === false || payload.data === undefined) {
    throw new Error(payload?.message || fallback);
  }
  return payload.data;
}

const appendFiles = (form: FormData, files?: File[]) => {
  if (!files || files.length === 0) return;
  files.forEach((file) => {
    form.append('Attachments', file, file.name);
  });
};

/**
 * List Support Tickets for Customer or Admin
 * - Customer: GET /api/support/tickets/mine
 * - Admin: GET /api/admin/support/tickets?page=1&pageSize=50
 */
export async function listSupportTickets(
  viewer: SupportViewer,
  status?: SupportTicketStatus,
  search = '',
): Promise<SupportTicket[]> {
  if (!useRemoteApi()) {
    const normalized = search.trim().toLowerCase();
    return readLocalTickets()
      .filter(
        (ticket) =>
          viewer.role === 'Admin' ||
          ticket.customerUserId === viewer.userId ||
          ticket.customerEmail.toLowerCase() === viewer.email.toLowerCase(),
      )
      .filter((ticket) => !status || ticket.status === status)
      .filter(
        (ticket) =>
          !normalized ||
          [ticket.ticketReference, ticket.subject, ticket.customerName, ticket.customerEmail].some((value) =>
            value.toLowerCase().includes(normalized),
          ),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const params = new URLSearchParams({ page: '1', pageSize: '50' });
  if (status && status !== 'All') params.set('status', status);
  if (search.trim()) params.set('search', search.trim());

  const path = viewer.role === 'Admin' ? '/admin/support/tickets' : '/support/tickets/mine';
  const response = await apiRequest(`${path}?${params}`, {
    headers: authorizationHeaders(viewer.token),
  });

  const data = await readJson<any>(response, 'Unable to load support tickets.');
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return items.map(normalizeTicket);
}

/**
 * Get Ticket Full Details
 * - Customer: GET /api/support/tickets/{ticketId}
 * - Admin: GET /api/admin/support/tickets/{ticketId}
 */
export async function getSupportTicketDetails(
  viewer: SupportViewer,
  ticketId: string | number,
): Promise<SupportTicket> {
  if (!useRemoteApi()) {
    const ticket = readLocalTickets().find((t) => String(t.ticketId) === String(ticketId));
    if (!ticket) throw new Error('Ticket not found.');
    return ticket;
  }

  const path =
    viewer.role === 'Admin'
      ? `/admin/support/tickets/${encodeURIComponent(String(ticketId))}`
      : `/support/tickets/${encodeURIComponent(String(ticketId))}`;

  const response = await apiRequest(path, {
    headers: authorizationHeaders(viewer.token),
  });

  const data = await readJson<any>(response, 'Unable to retrieve ticket details.');
  return normalizeTicket(data);
}

/**
 * Customer: POST /api/support/tickets
 * Form-data: Subject, Message, Category, Priority, BookingId, Attachments
 */
export async function createSupportTicket(
  viewer: SupportViewer,
  input: CreateSupportTicketInput,
): Promise<SupportTicket> {
  if (!useRemoteApi()) {
    const ticketId = makeId();
    const createdAt = now();
    const files = input.files || input.attachments || [];
    const localAttachments: SupportAttachment[] = files.map((file) => ({
      attachmentId: makeId(),
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      fileSize: file.size,
      url: URL.createObjectURL(file),
      fileUrl: URL.createObjectURL(file),
      isPrivate: false,
      createdAt: now(),
    }));

    const ticket: SupportTicket = {
      ticketId,
      ticketReference: `TKT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      customerUserId: viewer.userId,
      customerName: viewer.name,
      customerEmail: viewer.email,
      customerRole: viewer.role === 'Owner' ? 'Owner' : 'Commuter',
      createdByUserId: viewer.userId,
      assignedAdminUserId: null,
      assignedAdminName: null,
      subject: input.subject.trim(),
      category: input.category || 'General',
      priority: input.priority || 'P2',
      status: 'New',
      createdAt,
      updatedAt: createdAt,
      acceptedAt: null,
      closedAt: null,
      attachments: localAttachments,
      messages: [
        normalizeMessage({
          messageId: makeId(),
          ticketId,
          senderUserId: viewer.userId,
          senderName: viewer.name,
          senderRole: viewer.role,
          body: input.message.trim(),
          attachments: localAttachments,
          createdAt,
        }),
      ],
    };
    writeLocalTickets([ticket, ...readLocalTickets()]);
    publish('ticket.created', ticketId);
    return ticket;
  }

  const form = new FormData();
  form.append('Subject', input.subject.trim());
  form.append('Message', input.message.trim());
  form.append('Category', input.category || 'General');
  form.append('Priority', input.priority || 'P2');
  if (input.bookingId) {
    form.append('BookingId', String(input.bookingId));
  }
  appendFiles(form, input.files || input.attachments);

  const response = await apiRequest('/support/tickets', {
    method: 'POST',
    headers: authorizationHeaders(viewer.token),
    body: form,
  });

  const raw = await readJson<any>(response, 'Unable to create support ticket.');
  const ticket = normalizeTicket(raw);
  publish('ticket.created', ticket.ticketId);
  return ticket;
}

/**
 * Admin: POST /api/admin/support/tickets
 * Form-data: CustomerUserId, Subject, Message, Category, Priority, AssignedTeam, Attachments
 */
export async function createAdminSupportTicket(
  viewer: SupportViewer,
  input: CreateAdminSupportTicketInput,
): Promise<SupportTicket> {
  if (!useRemoteApi()) {
    const ticketId = makeId();
    const createdAt = now();
    const customerUserId =
      input.customerUserId ||
      Math.abs([...(input.customerEmail || '')].reduce((value, char) => value * 31 + char.charCodeAt(0), 7));
    const files = input.files || input.attachments || [];
    const localAttachments: SupportAttachment[] = files.map((file) => ({
      attachmentId: makeId(),
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      fileSize: file.size,
      url: URL.createObjectURL(file),
      fileUrl: URL.createObjectURL(file),
      isPrivate: false,
      createdAt: now(),
    }));

    const ticket: SupportTicket = {
      ticketId,
      ticketReference: `TKT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      customerUserId,
      customerName: input.customerName?.trim() || 'Customer',
      customerEmail: input.customerEmail?.trim() || '',
      customerRole: String(input.customerRole || 'Commuter'),
      createdByUserId: viewer.userId,
      assignedAdminUserId: viewer.userId,
      assignedAdminName: viewer.name,
      assignedTeam: input.assignedTeam || 'ParkingOperations',
      subject: input.subject.trim(),
      category: input.category || 'ParkingAccess',
      priority: input.priority || 'P1',
      status: 'Assigned',
      createdAt,
      updatedAt: createdAt,
      acceptedAt: createdAt,
      closedAt: null,
      attachments: localAttachments,
      messages: [
        normalizeMessage({
          messageId: makeId(),
          ticketId,
          senderUserId: viewer.userId,
          senderName: viewer.name,
          senderRole: 'Admin',
          body: input.message.trim(),
          attachments: localAttachments,
          createdAt,
        }),
      ],
    };
    writeLocalTickets([ticket, ...readLocalTickets()]);
    publish('ticket.created', ticketId);
    return ticket;
  }

  const form = new FormData();
  form.append('CustomerUserId', String(input.customerUserId || 1));
  form.append('Subject', input.subject.trim());
  form.append('Message', input.message.trim());
  form.append('Category', input.category || 'ParkingAccess');
  form.append('Priority', input.priority || 'P1');
  form.append('AssignedTeam', input.assignedTeam || 'ParkingOperations');
  appendFiles(form, input.files || input.attachments);

  const response = await apiRequest('/admin/support/tickets', {
    method: 'POST',
    headers: authorizationHeaders(viewer.token),
    body: form,
  });

  const raw = await readJson<any>(response, 'Unable to open administrative support ticket.');
  const ticket = normalizeTicket(raw);
  publish('ticket.created', ticket.ticketId);
  return ticket;
}

/**
 * Reply to Support Ticket (Customer or Admin)
 * POST /api/support/tickets/{ticketId}/messages
 */
export async function sendSupportMessage(
  viewer: SupportViewer,
  ticketId: string | number,
  message: string,
  files?: File[],
): Promise<SupportMessage> {
  if (!useRemoteApi()) {
    const tickets = readLocalTickets();
    const ticket = tickets.find((item) => String(item.ticketId) === String(ticketId));
    if (!ticket) throw new Error('Support ticket not found.');
    if (ticket.status === 'Closed') throw new Error('This ticket is closed and cannot receive new messages.');

    const localAttachments: SupportAttachment[] = (files || []).map((file) => ({
      attachmentId: makeId(),
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      fileSize: file.size,
      url: URL.createObjectURL(file),
      fileUrl: URL.createObjectURL(file),
      isPrivate: false,
      createdAt: now(),
    }));

    const nextMessage = normalizeMessage({
      messageId: makeId(),
      ticketId,
      senderUserId: viewer.userId,
      senderName: viewer.name,
      senderRole: viewer.role,
      body: message.trim(),
      attachments: localAttachments,
      createdAt: now(),
    });

    ticket.messages.push(nextMessage);
    ticket.updatedAt = nextMessage.createdAt;
    writeLocalTickets(tickets);
    publish('message.created', ticketId);
    return nextMessage;
  }

  const form = new FormData();
  if (message.trim()) {
    form.append('Message', message.trim());
  }
  appendFiles(form, files);

  const queryParam = message.trim() ? `?Message=${encodeURIComponent(message.trim())}` : '';
  const response = await apiRequest(
    `/support/tickets/${encodeURIComponent(String(ticketId))}/messages${queryParam}`,
    {
      method: 'POST',
      headers: authorizationHeaders(viewer.token),
      body: form,
    },
  );

  const raw = await readJson<any>(response, 'Unable to send message.');
  const msg = normalizeMessage(raw);
  publish('message.created', ticketId);
  return msg;
}

/**
 * Download / Retrieve Support Attachment
 * GET /api/support/attachments/{attachmentId}
 */
export async function downloadSupportAttachment(
  token: string,
  attachmentId: string | number,
): Promise<SupportAttachment> {
  const response = await apiRequest(`/support/attachments/${encodeURIComponent(String(attachmentId))}`, {
    headers: authorizationHeaders(token),
  });

  const raw = await readJson<any>(response, 'Unable to retrieve attachment.');
  return normalizeAttachment(raw);
}

/**
 * Open or Download Attachment safely
 */
export async function downloadAndOpenAttachment(
  token: string,
  attachment: SupportAttachment,
) {
  try {
    if (attachment.attachmentId) {
      const response = await apiRequest(`/support/attachments/${encodeURIComponent(String(attachment.attachmentId))}`, {
        headers: authorizationHeaders(token),
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json().catch(() => null);
        const resolvedUrl = json?.data?.fileUrl || json?.data?.url || attachment.fileUrl || attachment.url;
        if (resolvedUrl) {
          window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
          return;
        }
      } else if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = attachment.fileName || 'attachment';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
        return;
      }
    }
  } catch {
    // Fallback to direct URL if available
  }

  const directUrl = attachment.fileUrl || attachment.url;
  if (directUrl) {
    window.open(directUrl, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Admin: Accept Support Ticket
 * POST /api/admin/support/tickets/{ticketId}/accept
 */
export async function acceptSupportTicket(
  viewer: SupportViewer,
  ticketId: string | number,
): Promise<SupportTicket> {
  if (!useRemoteApi()) {
    const tickets = readLocalTickets();
    const ticket = tickets.find((item) => String(item.ticketId) === String(ticketId));
    if (!ticket) throw new Error('Ticket not found.');
    ticket.status = 'Assigned';
    ticket.assignedAdminUserId = viewer.userId;
    ticket.assignedAdminName = viewer.name;
    ticket.acceptedAt = now();
    ticket.updatedAt = now();
    writeLocalTickets(tickets);
    publish('ticket.updated', ticketId);
    return ticket;
  }

  const response = await apiRequest(`/admin/support/tickets/${encodeURIComponent(String(ticketId))}/accept`, {
    method: 'POST',
    headers: authorizationHeaders(viewer.token, 'application/json'),
    body: '{}',
  });

  const raw = await readJson<any>(response, 'Unable to accept this ticket.');
  const ticket = normalizeTicket(raw);
  publish('ticket.updated', ticket.ticketId);
  return ticket;
}

/**
 * Admin: Reassign Support Ticket
 * POST /api/admin/support/tickets/{ticketId}/assign
 * JSON: { assignedTeam, reason, assignedAdminUserId }
 */
export async function reassignSupportTicket(
  viewer: SupportViewer,
  ticketId: string | number,
  input: ReassignSupportTicketInput,
): Promise<SupportTicket> {
  const response = await apiRequest(`/admin/support/tickets/${encodeURIComponent(String(ticketId))}/assign`, {
    method: 'POST',
    headers: authorizationHeaders(viewer.token, 'application/json'),
    body: JSON.stringify({
      assignedTeam: input.assignedTeam,
      reason: input.reason,
      assignedAdminUserId: input.assignedAdminUserId,
    }),
  });

  const raw = await readJson<any>(response, 'Unable to reassign ticket.');
  const ticket = normalizeTicket(raw);
  publish('ticket.updated', ticket.ticketId);
  return ticket;
}

/**
 * Admin: Transition Ticket Status
 * POST /api/admin/support/tickets/{ticketId}/transition
 * JSON: { toStatus, reason }
 */
export async function transitionSupportTicketStatus(
  viewer: SupportViewer,
  ticketId: string | number,
  input: TransitionSupportTicketStatusInput,
): Promise<SupportTicket> {
  const response = await apiRequest(`/admin/support/tickets/${encodeURIComponent(String(ticketId))}/transition`, {
    method: 'POST',
    headers: authorizationHeaders(viewer.token, 'application/json'),
    body: JSON.stringify({
      toStatus: input.toStatus,
      reason: input.reason,
    }),
  });

  const raw = await readJson<any>(response, 'Unable to update ticket status.');
  const ticket = normalizeTicket(raw);
  publish('ticket.updated', ticket.ticketId);
  return ticket;
}

/**
 * Admin: Close Ticket
 * POST /api/admin/support/tickets/{ticketId}/close
 * JSON: { reason }
 */
export async function closeSupportTicket(
  viewer: SupportViewer,
  ticketId: string | number,
  closingInput: string | CloseSupportTicketInput,
): Promise<SupportTicket> {
  const reasonText =
    typeof closingInput === 'string'
      ? closingInput.trim()
      : closingInput.reason?.trim() || 'Resolved and closed by staff';

  if (!useRemoteApi()) {
    const tickets = readLocalTickets();
    const ticket = tickets.find((item) => String(item.ticketId) === String(ticketId));
    if (!ticket) throw new Error('Ticket not found.');
    ticket.status = 'Closed';
    ticket.closedAt = now();
    ticket.updatedAt = now();
    writeLocalTickets(tickets);
    publish('ticket.closed', ticketId);
    return ticket;
  }

  const response = await apiRequest(`/admin/support/tickets/${encodeURIComponent(String(ticketId))}/close`, {
    method: 'POST',
    headers: authorizationHeaders(viewer.token, 'application/json'),
    body: JSON.stringify({ reason: reasonText }),
  });

  const raw = await readJson<any>(response, 'Unable to close this ticket.');
  const ticket = normalizeTicket(raw);
  publish('ticket.closed', ticket.ticketId);
  return ticket;
}

/**
 * Customer: Reopen Support Ticket
 * POST /api/support/tickets/{ticketId}/reopen
 * JSON: { reason }
 */
export async function reopenSupportTicket(
  viewer: SupportViewer,
  ticketId: string | number,
  reopenInput: string | ReopenSupportTicketInput,
): Promise<SupportTicket> {
  const reasonText =
    typeof reopenInput === 'string'
      ? reopenInput.trim()
      : reopenInput.reason?.trim() || 'Issue reopened by customer';

  const response = await apiRequest(`/support/tickets/${encodeURIComponent(String(ticketId))}/reopen`, {
    method: 'POST',
    headers: authorizationHeaders(viewer.token, 'application/json'),
    body: JSON.stringify({ reason: reasonText }),
  });

  const raw = await readJson<any>(response, 'Unable to reopen this ticket.');
  const ticket = normalizeTicket(raw);
  publish('ticket.updated', ticket.ticketId);
  return ticket;
}

/**
 * Admin: Link Ticket to Incident
 * POST /api/admin/support/tickets/{ticketIdentifier}/link-incident
 * JSON: { incidentId?: number, incidentReference?: string }
 */
export async function linkTicketToIncident(
  viewer: SupportViewer,
  ticketIdentifier: string | number,
  incidentIdentifier: string | number,
): Promise<SupportTicket> {
  const incStr = String(incidentIdentifier).trim();
  const isNumeric = /^\d+$/.test(incStr);
  const body = isNumeric
    ? { incidentId: Number(incStr), incidentReference: incStr }
    : { incidentReference: incStr };

  const response = await apiRequest(
    `/admin/support/tickets/${encodeURIComponent(String(ticketIdentifier).trim())}/link-incident`,
    {
      method: 'POST',
      headers: authorizationHeaders(viewer.token, 'application/json'),
      body: JSON.stringify(body),
    },
  );

  const raw = await readJson<any>(response, 'Unable to link ticket to incident.');
  const ticket = normalizeTicket(raw);
  publish('ticket.updated', ticket.ticketId);
  return ticket;
}

/**
 * Admin: Link Ticket to Dispute
 * POST /api/admin/support/tickets/{ticketIdentifier}/link-dispute
 * JSON: { disputeId?: number, disputeReference?: string }
 */
export async function linkTicketToDispute(
  viewer: SupportViewer,
  ticketIdentifier: string | number,
  disputeIdentifier: string | number,
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
      headers: authorizationHeaders(viewer.token, 'application/json'),
      body: JSON.stringify(body),
    },
  );

  const raw = await readJson<any>(response, 'Unable to link ticket to dispute.');
  const ticket = normalizeTicket(raw);
  publish('ticket.updated', ticket.ticketId);
  return ticket;
}



