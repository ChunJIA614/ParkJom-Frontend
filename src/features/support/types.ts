export type SupportTicketStatus = 'Open' | 'InProgress' | 'Closed';
export type SupportUserRole = 'Owner' | 'Commuter' | 'Admin';
export type SupportMessageType = 'User' | 'Admin' | 'System';

export interface SupportViewer {
  userId: number;
  name: string;
  email: string;
  role: SupportUserRole;
  token: string;
}

export interface SupportAttachment {
  attachmentId: string;
  fileName: string;
  contentType: string;
  size: number;
  url: string | null;
  createdAt: string;
}

export interface SupportMessage {
  messageId: string;
  ticketId: string;
  senderUserId: number;
  senderName: string;
  senderRole: SupportUserRole;
  messageType: SupportMessageType;
  message: string;
  attachments: SupportAttachment[];
  createdAt: string;
}

export interface SupportTicket {
  ticketId: string;
  ticketReference: string;
  customerUserId: number;
  customerName: string;
  customerEmail: string;
  customerRole: Exclude<SupportUserRole, 'Admin'>;
  createdByUserId: number;
  assignedAdminUserId: number | null;
  assignedAdminName: string | null;
  subject: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  closedAt: string | null;
  messages: SupportMessage[];
}

export interface CreateSupportTicketInput {
  subject: string;
  message: string;
  files: File[];
}

export interface CreateAdminSupportTicketInput extends CreateSupportTicketInput {
  customerName: string;
  customerEmail: string;
  customerRole: Exclude<SupportUserRole, 'Admin'>;
}

export type SupportRealtimeEventType =
  | 'ticket.created'
  | 'ticket.updated'
  | 'message.created'
  | 'ticket.closed';

export interface SupportRealtimeEvent {
  type: SupportRealtimeEventType;
  ticketId: string;
  occurredAt: string;
}

export type SupportConnectionState = 'connecting' | 'live' | 'fallback' | 'offline';
