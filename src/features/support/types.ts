export type SupportTicketStatus = 'Open' | 'New' | 'Assigned' | 'InProgress' | 'WaitingForCustomer' | 'Closed' | 'Reopened' | string;
export type SupportUserRole = 'Owner' | 'Commuter' | 'Admin';
export type SupportMessageType = 'User' | 'Admin' | 'System' | 'Customer';

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
  source?: string;
  category?: string;
  priority?: string;
  status: SupportTicketStatus;
  subject: string;
  description?: string;
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
  subject: string;
  message: string;
  category?: string;
  priority?: string;
  bookingId?: number | null;
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
  assignedTeam: string;
  reason: string;
  assignedAdminUserId?: number;
}

export interface TransitionSupportTicketStatusInput {
  toStatus: string;
  reason: string;
}

export interface CloseSupportTicketInput {
  reason: string;
}

export interface ReopenSupportTicketInput {
  reason: string;
}

export type SupportRealtimeEventType =
  | 'ticket.created'
  | 'ticket.updated'
  | 'message.created'
  | 'ticket.closed';

export interface SupportRealtimeEvent {
  type: SupportRealtimeEventType;
  ticketId: string | number;
  occurredAt: string;
}

export type SupportConnectionState = 'connecting' | 'live' | 'fallback' | 'offline';

// Support Context Types
export interface SupportBookingContext {
  bookingId: number;
  bookingReference: string;
  parkingSpotName: string;
  propertyAddress: string;
  vehiclePlate: string;
  startDate: string;
  endDate: string;
  status: string;
  totalAmount: number;
  hasIoTDevice: boolean;
  ioTDeviceStatus: string | null;
  lastHeartbeatAt: string | null;
}

export interface SupportVehicleContext {
  vehicleId: number;
  licensePlate: string;
  makeModel: string;
  color: string;
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
  userId: number;
  userName: string;
  userEmail: string;
  userType: string;
  walletBalance: number;
  activeBooking: SupportBookingContext | null;
  recentBookings: SupportBookingContext[];
  vehicles: SupportVehicleContext[];
  recentTransactions: SupportTransactionContext[];
  ownedSpots: any[];
  recentAccessLogs: SupportAccessLogContext[];
}

// Support Preset Workflow Types
export interface SupportWorkflowOption {
  key: string;
  label: string;
  description: string;
}

export interface SupportWorkflowStep {
  stepId: string;
  question: string;
  type: 'choice' | 'text' | string;
  allowedAnswers: string[];
  required: boolean;
}

export interface SupportWorkflowDefinition {
  workflowKey: string;
  title: string;
  description: string;
  version: string;
  category: string;
  estimatedResponseTime: string;
  options: SupportWorkflowOption[];
  steps: SupportWorkflowStep[];
}

// Workflow Run & Execution Types
export interface ExecuteWorkflowRunInput {
  answers: Record<string, any>;
  bookingId?: number | null;
  vehicleId?: number | null;
  clientRequestId?: string;
}

export interface WorkflowCheckResult {
  name: string;
  status: 'valid' | 'normal' | 'warning' | 'error' | string;
  detail: string;
}

export interface WorkflowRunTicket {
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
  assignedTeam: string;
  bookingId: number | null;
  operationalIncidentId: number | null;
  disputeInvestigationId: number | null;
  createdAt: string;
  updatedAt: string;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  messageCount: number;
}

export interface WorkflowRunIncident {
  incidentId: number;
  incidentReference: string;
  incidentType: string;
  priority: string;
  status: string;
  title: string;
  assignedTeam: string;
  affectedCustomerCount: number;
  createdAt: string;
}

export interface WorkflowRunDispute {
  disputeId?: number;
  disputeReference?: string;
  status?: string;
  reason?: string;
  amount?: number;
  createdAt?: string;
}

export interface SupportWorkflowRun {
  workflowRunId: number;
  runReference: string;
  outcome: string;
  priority: string;
  assignedTeam: string;
  checks: WorkflowCheckResult[];
  ticket: WorkflowRunTicket | null;
  incident: WorkflowRunIncident | null;
  dispute: WorkflowRunDispute | null;
  customerMessage: string;
  completedAt: string;
}

// Support Conversation & Live Chat Types
export type SupportConversationStatus = 'Active' | 'WaitingAdmin' | 'WaitingCustomer' | 'Closed' | 'ConvertedToTicket' | string;

export interface SupportConversationMessageAttachment {
  attachmentId?: number | string;
  fileName?: string;
  url?: string | null;
  fileUrl?: string | null;
  contentType?: string;
  size?: number;
  fileSize?: number;
}

export interface SupportConversationMessage {
  messageId: number;
  conversationId: number;
  senderUserId: number | null;
  senderName: string;
  senderRole: string;
  messageType: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  attachments?: SupportConversationMessageAttachment[];
}

export interface SupportConversation {
  conversationId: number;
  conversationReference: string;
  customerUserId: number;
  customerName: string;
  customerEmail: string;
  channel: string;
  status: SupportConversationStatus;
  assignedAdminUserId: number | null;
  assignedAdminName: string | null;
  currentBookingId: number | null;
  startedAt: string;
  lastMessageAt: string;
  closedAt: string | null;
  lastMessageSnippet: string | null;
  messageCount: number;
}

export interface SupportConversationDetail extends SupportConversation {
  contextSnapshotJson?: string | null;
  closingReason?: string | null;
  messages: SupportConversationMessage[];
  convertedTickets?: any[];
}

export interface StartConversationInput {
  channel?: string;
  initialMessage: string;
  bookingId?: number | null;
}

export interface EscalateConversationToTicketInput {
  subject: string;
  category: string;
  priority: string;
}

export interface AdminCreateTicketFromConversationInput {
  subject: string;
  category: string;
  priority: string;
  assignedTeam?: string;
  internalSummary?: string;
}

export interface AdminConversationQueueResponse {
  items: SupportConversation[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
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
  assignedTeam: string;
  assignedUserId: number;
}

export interface ExecuteAccessOverrideInput {
  bookingId: number;
  reason: string;
  action: string;
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
  rootCause: string;
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
  assignedTeam: string;
  assignedUserId: number;
  status?: string;
}

export interface RequestDisputeEvidenceInput {
  customerMessage: string;
  deadlineDays?: number;
}

export interface FinalizeDisputeDecisionInput {
  decision: string;
  decisionReason: string;
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
  waitingConversationsCount: number;
  openTicketsCount: number;
  activeIncidentsCount: number;
  openDisputesCount: number;
  slaRiskTicketsCount: number;
  recentTickets: DashboardRecentTicket[];
  recentIncidents: DashboardRecentIncident[];
  activeConversations: any[];
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
  targetUserId: number;
  testMessage: string;
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


