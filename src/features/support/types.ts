export { SUPPORT_API } from './api/supportApiConfig';

export type SupportTicketStatus = 'Open' | 'New' | 'Assigned' | 'Accepted' | 'InProgress' | 'WaitingForCustomer' | 'Resolved' | 'Closed' | 'Reopened' | string;
export type UserTicketDisplayStatus = 'Processing' | 'ActionRequired' | 'Resolved' | 'Closed' | string;
export type SupportUserRole = 'Owner' | 'PropertyOwner' | 'Commuter' | 'Admin';
export type SupportMessageType = 'User' | 'Admin' | 'System' | 'Customer';

export type CommuterIssueCode =
  | 'GATE_STUCK'
  | 'SPOT_OCCUPIED'
  | 'REFUND_REQUEST'
  | 'DUPLICATE_CHARGE'
  | 'OTHER';

export type PropertyOwnerIssueCode =
  | 'RENTER_OVERSTAY'
  | 'IOT_OFFLINE'
  | 'OWNER_PAYOUT'
  | 'OTHER';

export type SupportIssueCode = CommuterIssueCode | PropertyOwnerIssueCode | string;
export type QuickIssueCode = SupportIssueCode;

export interface QuickIssueTemplate {
  issueCode: SupportIssueCode;
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  defaultMessage?: string;
  requiresBooking?: boolean;
  requiresClaimAmount?: boolean;
  requiresEvidence?: boolean;
  role?: string;
}

export interface SelfUnlockGateInput {
  bookingId?: number | null;
  action?: 'Enter' | 'Exit';
}

export interface SelfUnlockGateResult {
  success: boolean;
  message: string;
  commandId?: string | null;
  bookingId?: number | null;
  action?: 'Enter' | 'Exit' | string;
  suggestUrgentTicket?: boolean;
  executedAt?: string;
}

export interface TicketRefundSummary {
  disputeId?: number;
  disputeReference?: string;
  disputeType?: string;
  status: string;
  statusLabel?: string;
  claimAmount?: number;
  amount?: number;
  approvedAmount?: number | null;
  currency?: string;
  reason?: string | null;
  decision?: string | null;
  decisionReason?: string | null;
  requiredEvidence?: string | null;
  customerMessage?: string | null;
  evidenceDeadlineAt?: string | null;
  decidedAt?: string | null;
  updatedAt?: string | null;
}

export interface SupportViewer {
  userId: number;
  name: string;
  email: string;
  role: SupportUserRole;
  token: string;
}

export interface SupportAttachment {
  attachmentId: string | number;
  fileName: string;
  contentType: string;
  size?: number;
  fileSize?: number;
  url?: string | null;
  fileUrl?: string | null;
  isPrivate?: boolean;
  createdAt: string;
}

export interface SupportMessage {
  messageId: string | number;
  ticketId: string | number;
  senderUserId: number | null;
  senderName: string;
  senderRole: string;
  messageType?: string;
  message?: string;
  body?: string;
  isInternal?: boolean;
  attachments: SupportAttachment[];
  createdAt: string;
}

export interface SupportAuditTimelineEvent {
  auditEventId: number | string;
  objectType: string;
  objectId: number | string;
  objectReference: string;
  action: string;
  actorUserId: number | null;
  actorName: string;
  actorRole: string;
  previousState: string | null;
  newState: string;
  detail: string;
  timestamp: string;
}

export interface SupportTicket {
  ticketId: string | number;
  ticketReference: string;
  ticketType?: string;
  issueCode?: SupportIssueCode | null;
  source?: string;
  category?: string;
  priority?: string;
  status: SupportTicketStatus;
  userDisplayStatus?: UserTicketDisplayStatus | null;
  userStatusLabel?: string | null;
  subject: string;
  description?: string;
  claimAmount?: number | null;
  customerUserId: number;
  customerName: string;
  customerEmail: string;
  customerRole?: string;
  createdByUserId?: number;
  assignedAdminUserId?: number | null;
  assignedAdminName?: string | null;
  assignedTeam?: string | null;
  conversationId?: number | null;
  conversationReference?: string | null;
  workflowRunId?: number | null;
  workflowRunReference?: string | null;
  bookingId?: number | null;
  bookingReference?: string | null;
  parkingSpotId?: number | null;
  vehicleId?: number | null;
  operationalIncidentId?: number | null;
  incidentReference?: string | null;
  disputeInvestigationId?: number | null;
  disputeReference?: string | null;
  refundSummary?: TicketRefundSummary | null;
  acceptedAt?: string | null;
  firstResponseAt?: string | null;
  firstResponseDueAt?: string | null;
  resolvedAt?: string | null;
  resolutionDueAt?: string | null;
  closedAt?: string | null;
  resolutionCode?: string | null;
  internalSummary?: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  messages: SupportMessage[];
  attachments?: SupportAttachment[];
  auditTimeline?: SupportAuditTimelineEvent[];
}

export interface CreateSupportTicketInput {
  issueCode?: SupportIssueCode;
  subject?: string;
  message: string;
  category?: string;
  priority?: string;
  bookingId?: number | null;
  parkingSpotId?: number | null;
  vehicleId?: number | null;
  claimAmount?: number | null;
  files?: File[];
  attachments?: File[];
}

export interface CreateAdminSupportTicketInput extends CreateSupportTicketInput {
  customerUserId?: number;
  customerName?: string;
  customerEmail?: string;
  customerRole?: Exclude<SupportUserRole, 'Admin'> | string;
  assignedTeam?: string;
}

export interface ReassignSupportTicketInput {
  assignedTeam?: string;
  reason?: string;
  assignedAdminUserId?: number;
}

export interface TransitionSupportTicketStatusInput {
  toStatus: string;
  reason?: string;
  resolutionCode?: string;
}

export interface CloseSupportTicketInput {
  reason?: string;
}

export interface ReopenSupportTicketInput {
  reason: string;
}

export type SupportRealtimeEventType =
  | 'TicketCreated'
  | 'TicketMessageReceived'
  | 'TicketUpdated'
  | 'SelfGateUnlockExecuted'
  | 'IncidentCreated'
  | 'IncidentAcknowledged'
  | 'IncidentUpdated'
  | 'AccessOverrideExecuted'
  | 'DisputeEvidenceUploaded'
  | 'DisputeEvidenceRequested'
  | 'DisputeDecided'
  | 'ticket.created'
  | 'ticket.updated'
  | 'message.created'
  | 'ticket.closed'
  | string;

export interface SupportRealtimeEvent {
  type: SupportRealtimeEventType;
  eventType?: SupportRealtimeEventType;
  ticketId?: string | number;
  incidentId?: string | number;
  disputeId?: string | number;
  bookingId?: number | null;
  occurredAt: string;
  payload?: Record<string, unknown>;
}

export type SupportConnectionState = 'connecting' | 'live' | 'fallback' | 'offline';

// Support Context Types (GET /api/support/context)
export interface SupportBookingContext {
  bookingId: number;
  bookingReference?: string;
  parkingSpotId?: number | null;
  spotNumber?: string;
  spotCode?: string;
  parkingSpotName?: string;
  locationName?: string;
  address?: string;
  propertyAddress?: string;
  vehicleId?: number | null;
  vehiclePlate?: string;
  licensePlate?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  totalPrice?: number;
  totalAmount?: number;
  hasIoTDevice?: boolean;
  ioTDeviceStatus?: string | null;
  lastHeartbeatAt?: string | null;
}

export interface SupportVehicleContext {
  vehicleId: number;
  licensePlate?: string;
  plateNumber?: string;
  makeModel?: string;
  color?: string;
}

export interface SupportTransactionContext {
  transactionId: number;
  referenceNumber: string;
  transactionType: string;
  amount: number;
  paymentMethod: string;
  transactionStatus: string;
  createdAt: string;
}

export interface SupportAccessLogContext {
  accessLogId: number;
  actions: string;
  accessedAt: string;
  bookingId: number | null;
  ioTDeviceId: number | null;
}

export interface SupportContextData {
  userId?: number;
  userName?: string;
  userEmail?: string;
  userType?: string;
  userRole?: string;
  walletBalance?: number;
  canSelfUnlockGate?: boolean;
  quickIssueTemplates?: QuickIssueTemplate[];
  activeBooking?: SupportBookingContext | null;
  recentBookings?: SupportBookingContext[];
  vehicles?: SupportVehicleContext[];
  recentVehicles?: SupportVehicleContext[];
  recentTransactions?: SupportTransactionContext[];
  ownedSpots?: any[];
  recentAccessLogs?: SupportAccessLogContext[];
}

// ── Operational Incidents & Hardware Access Override Types ──

export interface OperationalIncidentItem {
  incidentId: number;
  incidentReference: string;
  incidentType: string;
  priority: string;
  status: string;
  title: string;
  assignedTeam?: string | null;
  affectedCustomerCount: number;
  createdAt: string;
}

export interface IncidentNotificationAttempt {
  notificationAttemptId: number;
  channel: string;
  recipient: string;
  subject: string;
  message: string;
  status: string;
  attemptCount: number;
  createdAt: string;
  sentAt?: string | null;
}

export interface OperationalIncidentDetail {
  incidentId: number;
  incidentReference: string;
  incidentType: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  propertyId?: number | null;
  propertyName?: string | null;
  parkingSpotId?: number | null;
  spotNumber?: string | null;
  ioTDeviceId?: string | null;
  esp32Serial?: string | null;
  source: string;
  assignedTeam?: string | null;
  assignedUserId?: number | null;
  assignedUserName?: string | null;
  affectedCustomerCount: number;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  escalationLevel: number;
  nextEscalationAt?: string | null;
  createdAt: string;
  updatedAt: string;
  linkedTickets: SupportTicket[];
  auditTimeline: SupportAuditTimelineEvent[];
  notificationAttempts: IncidentNotificationAttempt[];
}

export interface CreateOperationalIncidentInput {
  title: string;
  description: string;
  priority: string;
  incidentType: string;
  propertyId?: number | null;
  assignedTeam: string;
  initialTicketReference?: string | null;
}

export interface AssignIncidentInput {
  assignedTeam?: string;
  assignedUserId?: number;
}

export interface ExecuteAccessOverrideInput {
  bookingId: number;
  reason: string;
  confirmation?: boolean;
  action?: string;
}

export interface AccessOverrideResult {
  success: boolean;
  commandId: string;
  message: string;
  bookingId: number;
  ioTDeviceId?: string | null;
  executedAt: string;
}

export interface LinkTicketToIncidentInput {
  incidentId?: number;
  incidentReference?: string;
}

export interface LinkTicketFromIncidentInput {
  ticketId?: number;
  ticketReference?: string;
}

export interface TransitionIncidentInput {
  toStatus: string;
  reason?: string;
  rootCause?: string;
}

export interface OperationalIncidentListResponse {
  items: OperationalIncidentItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
}

// ── Dispute Investigations & Financial Reversals Types ──

export interface DisputeEvidence {
  disputeEvidenceId: number;
  disputeId: number;
  evidenceType: string;
  fileName: string;
  fileUrl: string;
  uploadedRole: string;
  uploadedByName: string;
  isVerified: boolean;
  description?: string | null;
  createdAt: string;
}

export interface DisputeAuditTimelineEvent {
  auditEventId: number;
  objectType: string;
  objectId: number;
  objectReference: string;
  action: string;
  actorUserId: number;
  actorName: string;
  actorRole: string;
  previousState?: string | null;
  newState?: string | null;
  detail: string;
  timestamp: string;
}

export interface DisputeCase {
  disputeId: number;
  disputeReference: string;
  disputeType: string;
  status: string;
  amount: number;
  currency: string;
  reason: string;
  ticketId?: number | null;
  bookingId?: number | null;
  customerUserId: number;
  customerName: string;
  customerEmail: string;
  assignedTeam?: string | null;
  assignedUserId?: number | null;
  assignedUserName?: string | null;
  paymentId?: number | null;
  transactionId?: string | null;
  decision?: string | null;
  decisionReason?: string | null;
  approvedAmount?: number | null;
  decidedByUserId?: number | null;
  decidedByUserName?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  evidences: DisputeEvidence[];
  auditTimeline: DisputeAuditTimelineEvent[];
}

export interface CustomerDisputeItem {
  disputeId: number;
  disputeReference: string;
  disputeType: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
}

export interface CustomerDisputeDetail {
  disputeId: number;
  disputeReference: string;
  disputeType: string;
  status: string;
  amount: number;
  currency: string;
  reason: string;
  ticketId?: number | null;
  bookingId?: number | null;
  decision?: string | null;
  decisionReason?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  evidences: DisputeEvidence[];
}

export interface AssignDisputeInput {
  assignedTeam?: string;
  assignedUserId?: number;
  status?: string;
}

export interface RequestDisputeEvidenceInput {
  requiredEvidence?: string;
  customerMessage: string;
  deadline?: string;
  deadlineDays?: number;
}

export interface FinalizeDisputeDecisionInput {
  decision: 'ApproveReversal' | 'Decline' | 'NeedMoreInfo' | string;
  reason?: string;
  decisionReason?: string;
  amount?: number;
  approvedAmount?: number;
}

export interface LinkTicketToDisputeInput {
  disputeId?: number;
  disputeReference?: string;
}

export interface DisputeListResponse {
  items: DisputeCase[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
}

// ── Command Center Dashboard Types ──

export interface DashboardRecentTicket {
  ticketId: number;
  ticketReference: string;
  ticketType: string;
  source: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  customerUserId: number;
  customerName: string;
  customerEmail: string;
  assignedAdminName: string | null;
  assignedTeam: string | null;
  bookingId: number | null;
  operationalIncidentId: number | null;
  disputeInvestigationId: number | null;
  createdAt: string;
  updatedAt: string;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  messageCount: number;
}

export interface DashboardRecentIncident {
  incidentId: number;
  incidentReference: string;
  incidentType: string;
  priority: string;
  status: string;
  title: string;
  assignedTeam: string | null;
  affectedCustomerCount: number;
  createdAt: string;
}

export interface AdminDashboardMetrics {
  waitingConversationsCount?: number;
  openTicketsCount: number;
  actionRequiredTicketsCount?: number;
  activeIncidentsCount: number;
  openDisputesCount: number;
  slaRiskTicketsCount: number;
  recentTickets: DashboardRecentTicket[];
  recentIncidents: DashboardRecentIncident[];
  activeConversations?: any[];
}

// ── 24/7 On-Call Escalation Types ──

export interface OnCallResponder {
  userId: number;
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface OnCallPolicy {
  p0BackupDelayMinutes: number;
  p0SupervisorDelayMinutes: number;
  p0ManagerDelayMinutes: number;
  p1BackupDelayMinutes: number;
  p1SupervisorDelayMinutes: number;
  p1ManagerDelayMinutes: number;
  notificationChannels: string;
  autoEscalateEnabled: boolean;
}

export interface OnCallRosterStatus {
  scheduleId: number;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  primaryResponder: OnCallResponder | null;
  backupResponder: OnCallResponder | null;
  supervisor: OnCallResponder | null;
  operationsManager: OnCallResponder | null;
  activeChannels: string[];
  policy: OnCallPolicy;
}

export interface TestOnCallAlertInput {
  channel: string;
  recipient?: string;
  targetUserId?: number;
  message?: string;
  testMessage?: string;
}

export interface TestOnCallAlertResult {
  success: boolean;
  channel: string;
  recipient: string;
  status: string;
  detail: string;
  timestamp: string;
}

export interface UpdateOnCallPolicyInput {
  p0PrimaryDelayMinutes?: number;
  p0BackupDelayMinutes?: number;
  p0SupervisorDelayMinutes?: number;
  p0ManagerDelayMinutes?: number;
  p1BackupDelayMinutes?: number;
  p1SupervisorDelayMinutes?: number;
  p1ManagerDelayMinutes?: number;
  enabledChannels?: string[];
  autoEscalateEnabled?: boolean;
}

// ── Audit Log Timeline Types ──

export interface SupportAuditEvent {
  auditEventId: number;
  objectType: string;
  objectId: number;
  objectReference: string;
  action: string;
  actorUserId: number | null;
  actorName: string;
  actorRole: string;
  previousState: string | null;
  newState: string | null;
  detail: string | null;
  timestamp: string;
}

export interface SupportAuditLogResponse {
  items: SupportAuditEvent[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
}


