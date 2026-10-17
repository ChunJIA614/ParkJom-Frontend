import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import { publishLocalSupportEvent } from '../realtime/supportRealtime';
import { SUPPORT_API } from './supportApiConfig';
import type {
  CloseSupportTicketInput,
  CreateAdminSupportTicketInput,
  CreateSupportTicketInput,
  ReassignSupportTicketInput,
  ReopenSupportTicketInput,
  SupportAttachment,
  SupportAuditTimelineEvent,
  SupportIssueCode,
  SupportMessage,
  SupportTicket,
  SupportTicketStatus,
  SupportViewer,
  TicketRefundSummary,
  TransitionSupportTicketStatusInput,
  UserTicketDisplayStatus,
} from '../types';

const STORAGE_KEY = 'parkjom.supportTickets.v1';
const useRemoteApi = () => import.meta.env.VITE_SUPPORT_API_MODE !== 'local';
const now = () => new Date().toISOString();
const makeId = () => crypto.randomUUID();

const ISSUE_CODE_DEFAULT_SUBJECTS: Record<string, string> = {
  GATE_STUCK: 'Emergency Gate / Barrier Unlock Issue',
  SPOT_OCCUPIED: 'Reserved Parking Spot Occupied',
  REFUND_REQUEST: 'Booking Refund Request',
  DUPLICATE_CHARGE: 'Duplicate or Incorrect Charge Inquiry',
  RENTER_OVERSTAY: 'Renter Overstay on Property Spot',
  IOT_OFFLINE: 'IoT Barrier / Sensor Device Offline',
  OWNER_PAYOUT: 'Property Owner Payout & Settlement Inquiry',
  OTHER: 'General Support Inquiry',
};

export function deriveUserDisplayStatus(
  status?: string | null,
  explicitDisplayStatus?: string | null,
): UserTicketDisplayStatus {
  if (explicitDisplayStatus) return explicitDisplayStatus;
  const s = (status || '').toLowerCase();
  if (s === 'waitingforcustomer' || s === 'actionrequired') return 'ActionRequired';
  if (s === 'resolved') return 'Resolved';
  if (s === 'closed') return 'Closed';
  return 'Processing';
}

export function deriveUserStatusLabel(
  displayStatus: UserTicketDisplayStatus,
  explicitLabel?: string | null,
): string {
  if (explicitLabel) return explicitLabel;
  switch (displayStatus) {
    case 'ActionRequired':
      return 'Action Required';
    case 'Resolved':
      return 'Resolved';
    case 'Closed':
      return 'Closed';
    case 'Processing':
    default:
      return 'Processing';
  }
}

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

export const normalizeRefundSummary = (raw: any): TicketRefundSummary | null => {
  if (!raw || typeof raw !== 'object') return null;
  return {
    disputeId: raw.disputeId ?? raw.disputeInvestigationId ?? undefined,
    disputeReference: raw.disputeReference ?? undefined,
    disputeType: raw.disputeType ?? raw.type ?? undefined,
    status: raw.status || 'UnderReview',
    statusLabel: raw.statusLabel ?? raw.userStatusLabel ?? undefined,
    claimAmount: raw.claimAmount ?? raw.amount ?? undefined,
    amount: raw.amount ?? raw.claimAmount ?? undefined,
    approvedAmount: raw.approvedAmount ?? null,
    currency: raw.currency || 'MYR',
    reason: raw.reason ?? null,
    decision: raw.decision ?? null,
    decisionReason: raw.decisionReason ?? null,
    requiredEvidence: raw.requiredEvidence ?? null,
    customerMessage: raw.customerMessage ?? null,
    evidenceDeadlineAt: raw.evidenceDeadlineAt ?? raw.deadline ?? null,
    decidedAt: raw.decidedAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
};

export const normalizeTicket = (raw: any): SupportTicket => {
  if (!raw) {
    return {
      ticketId: makeId(),
      ticketReference: `TKT-${new Date().getFullYear()}-00000`,
      status: 'New',
      userDisplayStatus: 'Processing',
      userStatusLabel: 'Processing',
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
  const status = raw.status || 'New';
  const userDisplayStatus = deriveUserDisplayStatus(status, raw.userDisplayStatus);
  const userStatusLabel = deriveUserStatusLabel(userDisplayStatus, raw.userStatusLabel);
  const issueCode: SupportIssueCode | null = raw.issueCode ?? null;

  return {
    ticketId: raw.ticketId ?? makeId(),
    ticketReference: raw.ticketReference || `TKT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    ticketType: raw.ticketType || 'Custom',
    issueCode,
    source: raw.source || 'QuickHelp',
    category: raw.category || 'General',
    priority: raw.priority || 'P2',
    status,
    userDisplayStatus,
    userStatusLabel,
    subject:
      raw.subject ||
      (issueCode && ISSUE_CODE_DEFAULT_SUBJECTS[issueCode]) ||
      'Support Inquiry',
    description: raw.description || '',
    claimAmount: raw.claimAmount ?? null,
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
    refundSummary: normalizeRefundSummary(raw.refundSummary),
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
  const payload = (await response.json().catch(() => null)) as any;
  if (!payload) {
    throw new Error(fallback);
  }
  if (payload.success === false && payload.data === undefined) {
    throw new Error(payload?.message || fallback);
  }
  return (payload.data !== undefined ? payload.data : payload) as T;
}

const appendFiles = (form: FormData, files?: File[]) => {
  if (!files || files.length === 0) return;
  files.forEach((file) => {
    form.append('attachments', file, file.name);
  });
};

export interface ListSupportTicketsFilterOptions {
  priority?: string;
  team?: string;
  assignee?: string;
  page?: number;
  pageSize?: number;
}

/**
 * List Support Tickets for Customer or Admin
 * - Customer: GET /api/support/tickets/mine?status=&search=
 * - Admin: GET /api/admin/support/tickets?status=&priority=&team=&assignee=&search=&page=1&pageSize=100
 */
export async function listSupportTickets(
  viewer: SupportViewer,
  status?: SupportTicketStatus,
  search = '',
  options?: ListSupportTicketsFilterOptions,
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
      .filter((ticket) => {
        if (!status || status === 'All') return true;
        return (
          ticket.status === status ||
          ticket.userDisplayStatus === status ||
          deriveUserDisplayStatus(ticket.status, ticket.userDisplayStatus) === status
        );
      })
      .filter(
        (ticket) =>
          !normalized ||
          [ticket.ticketReference, ticket.subject, ticket.customerName, ticket.customerEmail].some((value) =>
            (value || '').toLowerCase().includes(normalized),
          ),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const isAdmin = viewer.role === 'Admin';
  const params = new URLSearchParams();
  if (isAdmin) {
    params.set('page', String(options?.page ?? 1));
    params.set('pageSize', String(options?.pageSize ?? 100));
    if (options?.priority && options.priority !== 'All') params.set('priority', options.priority);
    if (options?.team && options.team !== 'All') params.set('team', options.team);
    if (options?.assignee && options.assignee !== 'All') params.set('assignee', options.assignee);
  }
  if (status && status !== 'All') params.set('status', status);
  if (search.trim()) params.set('search', search.trim());

  const path = isAdmin ? SUPPORT_API.ADMIN.TICKETS.LIST : SUPPORT_API.USER.GET_MY_TICKETS;
  const queryStr = params.toString();
  const response = await apiRequest(queryStr ? `${path}?${queryStr}` : path, {
    headers: authorizationHeaders(viewer.token),
  });

  const data = await readJson<any>(response, 'Unable to load support tickets.');
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return items.map(normalizeTicket);
}

/**
 * Get Ticket Full Details
 * - Customer: GET /api/support/tickets/{ticketId}
 * - Admin: GET /api/admin/support/tickets/{ticketIdentifier}
 */
export async function getSupportTicketDetails(
  viewer: SupportViewer,
  ticketId: string | number,
): Promise<SupportTicket> {
  if (!useRemoteApi()) {
    const ticket = readLocalTickets().find(
      (t) => String(t.ticketId) === String(ticketId) || t.ticketReference === String(ticketId),
    );
    if (!ticket) throw new Error('Ticket not found.');
    return ticket;
  }

  const path =
    viewer.role === 'Admin'
      ? SUPPORT_API.ADMIN.TICKETS.DETAIL(ticketId)
      : SUPPORT_API.USER.GET_TICKET_DETAIL(ticketId);

  const response = await apiRequest(path, {
    headers: authorizationHeaders(viewer.token),
  });

  const data = await readJson<any>(response, 'Unable to retrieve ticket details.');
  return normalizeTicket(data);
}

/**
 * Customer: POST /api/support/tickets
 * FormData: issueCode, message, bookingId?, parkingSpotId?, vehicleId?, claimAmount?, attachments?
 */
export async function createSupportTicket(
  viewer: SupportViewer,
  input: CreateSupportTicketInput,
): Promise<SupportTicket> {
  const issueCode = input.issueCode || 'OTHER';
  const resolvedSubject =
    input.subject?.trim() ||
    ISSUE_CODE_DEFAULT_SUBJECTS[issueCode] ||
    input.message.trim().slice(0, 72) ||
    'Support Inquiry';

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
      issueCode,
      customerUserId: viewer.userId,
      customerName: viewer.name,
      customerEmail: viewer.email,
      customerRole: viewer.role === 'Owner' || viewer.role === 'PropertyOwner' ? 'Owner' : 'Commuter',
      createdByUserId: viewer.userId,
      assignedAdminUserId: null,
      assignedAdminName: null,
      subject: resolvedSubject,
      category: input.category || 'General',
      priority: input.priority || (issueCode === 'GATE_STUCK' ? 'P0' : 'P2'),
      status: 'New',
      userDisplayStatus: 'Processing',
      userStatusLabel: 'Processing',
      bookingId: input.bookingId ?? null,
      parkingSpotId: input.parkingSpotId ?? null,
      vehicleId: input.vehicleId ?? null,
      claimAmount: input.claimAmount ?? null,
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
  form.append('issueCode', issueCode);
  form.append('message', input.message.trim());
  form.append('subject', resolvedSubject);
  if (input.category) {
    form.append('category', input.category);
  }
  if (input.priority) {
    form.append('priority', input.priority);
  }
  if (input.bookingId) {
    form.append('bookingId', String(input.bookingId));
  }
  if (input.parkingSpotId) {
    form.append('parkingSpotId', String(input.parkingSpotId));
  }
  if (input.vehicleId) {
    form.append('vehicleId', String(input.vehicleId));
  }
  if (input.claimAmount !== undefined && input.claimAmount !== null && !Number.isNaN(Number(input.claimAmount))) {
    form.append('claimAmount', String(input.claimAmount));
  }
  appendFiles(form, input.files || input.attachments);

  const response = await apiRequest(SUPPORT_API.USER.CREATE_TICKET, {
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
  const issueCode = input.issueCode || 'OTHER';
  const resolvedSubject =
    input.subject?.trim() ||
    ISSUE_CODE_DEFAULT_SUBJECTS[issueCode] ||
    input.message.trim().slice(0, 72) ||
    'Administrative Support Ticket';

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
      issueCode,
      customerUserId,
      customerName: input.customerName?.trim() || 'Customer',
      customerEmail: input.customerEmail?.trim() || '',
      customerRole: String(input.customerRole || 'Commuter'),
      createdByUserId: viewer.userId,
      assignedAdminUserId: viewer.userId,
      assignedAdminName: viewer.name,
      assignedTeam: input.assignedTeam || 'ParkingOperations',
      subject: resolvedSubject,
      category: input.category || 'ParkingAccess',
      priority: input.priority || 'P1',
      status: 'Assigned',
      userDisplayStatus: 'Processing',
      userStatusLabel: 'Processing',
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
  form.append('customerUserId', String(input.customerUserId || 1));
  form.append('issueCode', issueCode);
  form.append('subject', resolvedSubject);
  form.append('message', input.message.trim());
  form.append('category', input.category || 'ParkingAccess');
  form.append('priority', input.priority || 'P1');
  form.append('assignedTeam', input.assignedTeam || 'ParkingOperations');
  if (input.bookingId) {
    form.append('bookingId', String(input.bookingId));
  }
  if (input.parkingSpotId) {
    form.append('parkingSpotId', String(input.parkingSpotId));
  }
  if (input.vehicleId) {
    form.append('vehicleId', String(input.vehicleId));
  }
  if (input.claimAmount !== undefined && input.claimAmount !== null && !Number.isNaN(Number(input.claimAmount))) {
    form.append('claimAmount', String(input.claimAmount));
  }
  appendFiles(form, input.files || input.attachments);

  const response = await apiRequest(SUPPORT_API.ADMIN.TICKETS.CREATE, {
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
 * Supports isInternal: true for Admin internal notes
 */
export async function sendSupportMessage(
  viewer: SupportViewer,
  ticketId: string | number,
  message: string,
  files?: File[],
  options?: { isInternal?: boolean } | boolean,
): Promise<SupportMessage> {
  const isInternal = typeof options === 'boolean' ? options : Boolean(options?.isInternal);

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
      isInternal,
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
    form.append('message', message.trim());
  }
  if (isInternal) {
    form.append('isInternal', 'true');
  }
  appendFiles(form, files);

  const response = await apiRequest(
    SUPPORT_API.USER.SEND_MESSAGE(ticketId),
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
  const response = await apiRequest(SUPPORT_API.USER.GET_ATTACHMENT(attachmentId), {
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
      const response = await apiRequest(SUPPORT_API.USER.GET_ATTACHMENT(attachment.attachmentId), {
        headers: authorizationHeaders(token),
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json().catch(() => null);
        const resolvedUrl = json?.data?.fileUrl || json?.data?.url || json?.fileUrl || json?.url || attachment.fileUrl || attachment.url;
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
    ticket.status = 'Accepted';
    ticket.assignedAdminUserId = viewer.userId;
    ticket.assignedAdminName = viewer.name;
    ticket.acceptedAt = now();
    ticket.updatedAt = now();
    writeLocalTickets(tickets);
    publish('ticket.updated', ticketId);
    return ticket;
  }

  const response = await apiRequest(SUPPORT_API.ADMIN.TICKETS.ACCEPT(ticketId), {
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
 * JSON: { assignedAdminUserId?, assignedTeam?, reason? }
 */
export async function reassignSupportTicket(
  viewer: SupportViewer,
  ticketId: string | number,
  input: ReassignSupportTicketInput,
): Promise<SupportTicket> {
  const response = await apiRequest(SUPPORT_API.ADMIN.TICKETS.ASSIGN(ticketId), {
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
 * JSON: { toStatus, reason?, resolutionCode? }
 */
export async function transitionSupportTicketStatus(
  viewer: SupportViewer,
  ticketId: string | number,
  input: TransitionSupportTicketStatusInput,
): Promise<SupportTicket> {
  const response = await apiRequest(SUPPORT_API.ADMIN.TICKETS.TRANSITION(ticketId), {
    method: 'POST',
    headers: authorizationHeaders(viewer.token, 'application/json'),
    body: JSON.stringify({
      toStatus: input.toStatus,
      reason: input.reason,
      ...(input.resolutionCode ? { resolutionCode: input.resolutionCode } : {}),
    }),
  });

  const raw = await readJson<any>(response, 'Unable to update ticket status.');
  const ticket = normalizeTicket(raw);
  publish('ticket.updated', ticket.ticketId);
  return ticket;
}

/**
 * Customer or Admin: Close Ticket
 * - Customer: POST /api/support/tickets/{ticketId}/close { reason?: string }
 * - Admin: POST /api/admin/support/tickets/{ticketId}/close { reason?: string }
 */
export async function closeSupportTicket(
  viewer: SupportViewer,
  ticketId: string | number,
  closingInput?: string | CloseSupportTicketInput,
): Promise<SupportTicket> {
  const defaultReason =
    viewer.role === 'Admin'
      ? 'Resolved and closed by staff'
      : 'Confirmed resolved by customer';
  const reasonText =
    closingInput === undefined
      ? defaultReason
      : typeof closingInput === 'string'
      ? closingInput.trim() || defaultReason
      : closingInput.reason?.trim() || defaultReason;

  if (!useRemoteApi()) {
    const tickets = readLocalTickets();
    const ticket = tickets.find((item) => String(item.ticketId) === String(ticketId));
    if (!ticket) throw new Error('Ticket not found.');
    ticket.status = 'Closed';
    ticket.userDisplayStatus = 'Closed';
    ticket.userStatusLabel = 'Closed';
    ticket.closedAt = now();
    ticket.updatedAt = now();
    writeLocalTickets(tickets);
    publish('ticket.closed', ticketId);
    return ticket;
  }

  const endpoint =
    viewer.role === 'Admin'
      ? SUPPORT_API.ADMIN.TICKETS.CLOSE(ticketId)
      : SUPPORT_API.USER.CLOSE_TICKET(ticketId);

  const response = await apiRequest(endpoint, {
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

  const response = await apiRequest(SUPPORT_API.USER.REOPEN_TICKET(ticketId), {
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
    SUPPORT_API.ADMIN.TICKETS.LINK_INCIDENT(String(ticketIdentifier).trim()),
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
    SUPPORT_API.ADMIN.TICKETS.LINK_DISPUTE(String(ticketIdentifier).trim()),
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



