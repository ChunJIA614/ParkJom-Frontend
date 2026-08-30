import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import { publishLocalSupportEvent } from '../realtime/supportRealtime';
import type {
  CreateAdminSupportTicketInput,
  CreateSupportTicketInput,
  SupportAttachment,
  SupportMessage,
  SupportTicket,
  SupportTicketStatus,
  SupportViewer,
} from '../types';

const STORAGE_KEY = 'parkjom.supportTickets.v1';
const useRemoteApi = () => import.meta.env.VITE_SUPPORT_API_MODE === 'remote';
const now = () => new Date().toISOString();
const makeId = () => crypto.randomUUID();

const readLocalTickets = (): SupportTicket[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed as SupportTicket[] : [];
  } catch {
    return [];
  }
};

const writeLocalTickets = (tickets: SupportTicket[]) => {
  const persisted = tickets.map((ticket) => ({
    ...ticket,
    messages: ticket.messages.map((message) => ({
      ...message,
      attachments: message.attachments.map((attachment) => ({
        ...attachment,
        url: attachment.url?.startsWith('blob:') ? null : attachment.url,
      })),
    })),
  }));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
};

const makeAttachments = (files: File[]): SupportAttachment[] => files.map((file) => ({
  attachmentId: makeId(),
  fileName: file.name,
  contentType: file.type || 'application/octet-stream',
  size: file.size,
  url: URL.createObjectURL(file),
  createdAt: now(),
}));

const makeMessage = (
  ticketId: string,
  sender: SupportViewer,
  message: string,
  files: File[],
  messageType: SupportMessage['messageType'] = sender.role === 'Admin' ? 'Admin' : 'User',
): SupportMessage => ({
  messageId: makeId(),
  ticketId,
  senderUserId: sender.userId,
  senderName: sender.name,
  senderRole: sender.role,
  messageType,
  message,
  attachments: makeAttachments(files),
  createdAt: now(),
});

const publish = (type: 'ticket.created' | 'ticket.updated' | 'message.created' | 'ticket.closed', ticketId: string) =>
  publishLocalSupportEvent({ type, ticketId, occurredAt: now() });

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw new Error(await readApiError(response, fallback));
  const payload = await response.json().catch(() => null) as { success?: boolean; message?: string; data?: T } | null;
  if (!payload || payload.success === false || payload.data === undefined) {
    throw new Error(payload?.message || fallback);
  }
  return payload.data;
}

const appendFiles = (form: FormData, files: File[]) => files.forEach((file) => form.append('attachments', file));

export async function listSupportTickets(
  viewer: SupportViewer,
  status?: SupportTicketStatus,
  search = '',
): Promise<SupportTicket[]> {
  if (!useRemoteApi()) {
    const normalized = search.trim().toLowerCase();
    return readLocalTickets()
      .filter((ticket) => (
        viewer.role === 'Admin'
        || ticket.customerUserId === viewer.userId
        || ticket.customerEmail.toLowerCase() === viewer.email.toLowerCase()
      ))
      .filter((ticket) => !status || ticket.status === status)
      .filter((ticket) => !normalized || [ticket.ticketReference, ticket.subject, ticket.customerName, ticket.customerEmail]
        .some((value) => value.toLowerCase().includes(normalized)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const params = new URLSearchParams({ page: '1', pageSize: '100' });
  if (status) params.set('status', status);
  if (search.trim()) params.set('search', search.trim());
  const path = viewer.role === 'Admin' ? '/admin/support/tickets' : '/support/tickets/mine';
  const response = await apiRequest(`${path}?${params}`, { headers: authorizationHeaders(viewer.token) });
  return readJson<SupportTicket[]>(response, 'Unable to load support tickets.');
}

export async function createSupportTicket(viewer: SupportViewer, input: CreateSupportTicketInput) {
  if (!useRemoteApi()) {
    const ticketId = makeId();
    const createdAt = now();
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
      status: 'Open',
      createdAt,
      updatedAt: createdAt,
      acceptedAt: null,
      closedAt: null,
      messages: [makeMessage(ticketId, viewer, input.message.trim(), input.files)],
    };
    writeLocalTickets([ticket, ...readLocalTickets()]);
    publish('ticket.created', ticketId);
    return ticket;
  }

  const form = new FormData();
  form.append('subject', input.subject.trim());
  form.append('message', input.message.trim());
  appendFiles(form, input.files);
  const response = await apiRequest('/support/tickets', {
    method: 'POST',
    headers: authorizationHeaders(viewer.token),
    body: form,
  });
  return readJson<SupportTicket>(response, 'Unable to create this support ticket.');
}

export async function createAdminSupportTicket(
  viewer: SupportViewer,
  input: CreateAdminSupportTicketInput,
) {
  if (!useRemoteApi()) {
    const ticketId = makeId();
    const createdAt = now();
    const customerUserId = Math.abs([...input.customerEmail].reduce((value, character) => value * 31 + character.charCodeAt(0), 7));
    const ticket: SupportTicket = {
      ticketId,
      ticketReference: `TKT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      customerUserId,
      customerName: input.customerName.trim(),
      customerEmail: input.customerEmail.trim(),
      customerRole: input.customerRole,
      createdByUserId: viewer.userId,
      assignedAdminUserId: viewer.userId,
      assignedAdminName: viewer.name,
      subject: input.subject.trim(),
      status: 'InProgress',
      createdAt,
      updatedAt: createdAt,
      acceptedAt: createdAt,
      closedAt: null,
      messages: [makeMessage(ticketId, viewer, input.message.trim(), input.files)],
    };
    writeLocalTickets([ticket, ...readLocalTickets()]);
    publish('ticket.created', ticketId);
    return ticket;
  }

  const form = new FormData();
  form.append('customerName', input.customerName.trim());
  form.append('customerEmail', input.customerEmail.trim());
  form.append('customerRole', input.customerRole);
  form.append('subject', input.subject.trim());
  form.append('message', input.message.trim());
  appendFiles(form, input.files);
  const response = await apiRequest('/admin/support/tickets', {
    method: 'POST', headers: authorizationHeaders(viewer.token), body: form,
  });
  return readJson<SupportTicket>(response, 'Unable to open this support ticket.');
}

export async function acceptSupportTicket(viewer: SupportViewer, ticketId: string) {
  if (!useRemoteApi()) {
    const tickets = readLocalTickets();
    const ticket = tickets.find((item) => item.ticketId === ticketId);
    if (!ticket || ticket.status !== 'Open') throw new Error('This ticket is no longer available to accept.');
    const acceptedAt = now();
    ticket.status = 'InProgress';
    ticket.assignedAdminUserId = viewer.userId;
    ticket.assignedAdminName = viewer.name;
    ticket.acceptedAt = acceptedAt;
    ticket.updatedAt = acceptedAt;
    ticket.messages.push(makeMessage(ticketId, viewer, `${viewer.name} accepted this ticket.`, [], 'System'));
    writeLocalTickets(tickets);
    publish('ticket.updated', ticketId);
    return ticket;
  }
  const response = await apiRequest(`/admin/support/tickets/${encodeURIComponent(ticketId)}/accept`, {
    method: 'POST', headers: authorizationHeaders(viewer.token, 'application/json'), body: '{}',
  });
  return readJson<SupportTicket>(response, 'Unable to accept this support ticket.');
}

export async function sendSupportMessage(viewer: SupportViewer, ticketId: string, message: string, files: File[]) {
  if (!useRemoteApi()) {
    const tickets = readLocalTickets();
    const ticket = tickets.find((item) => item.ticketId === ticketId);
    if (!ticket) throw new Error('Support ticket not found.');
    if (ticket.status === 'Closed') throw new Error('This ticket is closed and cannot receive new messages.');
    if (viewer.role === 'Admin' && ticket.status === 'Open') throw new Error('Accept this ticket before replying.');
    if (
      viewer.role !== 'Admin'
      && ticket.customerUserId !== viewer.userId
      && ticket.customerEmail.toLowerCase() !== viewer.email.toLowerCase()
    ) throw new Error('You cannot access this ticket.');
    const nextMessage = makeMessage(ticketId, viewer, message.trim(), files);
    ticket.messages.push(nextMessage);
    ticket.updatedAt = nextMessage.createdAt;
    writeLocalTickets(tickets);
    publish('message.created', ticketId);
    return nextMessage;
  }
  const form = new FormData();
  form.append('message', message.trim());
  appendFiles(form, files);
  const response = await apiRequest(`/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: 'POST', headers: authorizationHeaders(viewer.token), body: form,
  });
  return readJson<SupportMessage>(response, 'Unable to send this message.');
}

export async function closeSupportTicket(viewer: SupportViewer, ticketId: string, closingMessage: string) {
  if (!useRemoteApi()) {
    const tickets = readLocalTickets();
    const ticket = tickets.find((item) => item.ticketId === ticketId);
    if (!ticket || ticket.status === 'Closed') throw new Error('This ticket is already closed.');
    const closedAt = now();
    if (closingMessage.trim()) ticket.messages.push(makeMessage(ticketId, viewer, closingMessage.trim(), []));
    ticket.messages.push(makeMessage(ticketId, viewer, 'Ticket closed.', [], 'System'));
    ticket.status = 'Closed';
    ticket.closedAt = closedAt;
    ticket.updatedAt = closedAt;
    writeLocalTickets(tickets);
    publish('ticket.closed', ticketId);
    return ticket;
  }
  const response = await apiRequest(`/admin/support/tickets/${encodeURIComponent(ticketId)}/close`, {
    method: 'POST',
    headers: authorizationHeaders(viewer.token, 'application/json'),
    body: JSON.stringify({ closingMessage: closingMessage.trim() }),
  });
  return readJson<SupportTicket>(response, 'Unable to close this support ticket.');
}
