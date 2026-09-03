import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Clock,
  Clock3,
  CreditCard,
  Download,
  ExternalLink,
  FileCheck2,
  FileSearch,
  FileText,
  Headphones,
  History,
  Inbox,
  Info,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  Loader2,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  PhoneCall,
  Plus,
  Radio,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TicketCheck,
  Upload,
  UploadCloud,
  User,
  UserCheck,
  Users,
  Wifi,
  Workflow,
  Wrench,
  X,
  Zap,
  Sliders,
  Settings2,
  Bell,
  Phone,
  Sparkles,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getAdminDashboardMetrics,
  getOnCallRosterStatus,
  querySupportAuditTimeline,
  testOnCallAlert,
  updateOnCallPolicy,
} from '../../api/supportCommandCenterService';
import {
  closeAdminConversation,
  createAdminTicketFromConversation,
  dispatchWorkflowToConversation,
  getConversationDetails,
  listAdminConversationQueue,
  sendAdminConversationMessage,
} from '../../api/supportConversationService';
import {
  adminRequestCustomerEvidence,
  adminUploadDisputeEvidence,
  assignDisputeCase,
  finalizeDisputeDecision,
  linkTicketToDispute as apiLinkTicketToDispute,
  listAdminDisputes,
} from '../../api/supportDisputeService';
import {
  acknowledgeIncident as apiAcknowledgeIncident,
  assignIncidentResponder as apiAssignIncidentResponder,
  createOperationalIncident as apiCreateOperationalIncident,
  executeAccessOverride as apiExecuteAccessOverride,
  getOperationalIncidentDetails,
  linkTicketToIncident as apiLinkTicketToIncident,
  listOperationalIncidents as apiListOperationalIncidents,
  transitionIncidentStatus as apiTransitionIncidentStatus,
} from '../../api/supportIncidentService';
import { createAdminSupportTicket } from '../../api/supportTicketService';
import type {
  AccessOverrideResult,
  AdminDashboardMetrics,
  DisputeCase,
  DisputeEvidence,
  OnCallPolicy,
  OnCallRosterStatus,
  OperationalIncidentDetail,
  OperationalIncidentItem,
  SupportAuditEvent,
  SupportAuditLogResponse,
  SupportConversation,
  SupportConversationDetail,
  SupportViewer,
  TestOnCallAlertResult,
} from '../../types';

interface AdminSupportDashboardProps {
  viewer: SupportViewer;
  ticketWorkspace: ReactNode;
}

type AdminView = 'menu' | 'command' | 'conversations' | 'tickets' | 'incidents' | 'disputes' | 'on-call' | 'audit';

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  badge?: string;
}) {
  return (
    <div className="rounded-lg border border-black/[0.06] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#F5F5F7] text-[#1D1D1F]">
          <Icon className="h-4.5 w-4.5" />
        </span>
        {badge && (
          <span className="rounded-md border border-black/[0.06] bg-[#F5F5F7] px-2 py-0.5 text-[9px] font-semibold text-[#6E6E73]">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-[#1D1D1F]">{value}</p>
      <p className="mt-0.5 text-xs font-bold text-[#1D1D1F]">{label}</p>
      <p className="mt-0.5 text-[11px] text-[#6E6E73]">{detail}</p>
    </div>
  );
}

function formatMsgDate(value?: string | null) {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat('en-MY', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return value;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat('en-MY', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return value;
  }
}

export default function AdminSupportDashboard({ viewer, ticketWorkspace }: AdminSupportDashboardProps) {
  const [activeView, setActiveView] = useState<AdminView>('menu');
  const [conversationSearch, setConversationSearch] = useState('');
  const [reply, setReply] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Live Queue & Conversation Details state
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [selectedConversationDetail, setSelectedConversationDetail] = useState<SupportConversationDetail | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [dispatchingWorkflow, setDispatchingWorkflow] = useState(false);
  const [closingConv, setClosingConv] = useState(false);
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);

  // Ticket creation modal state
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('ParkingAccess');
  const [ticketPriority, setTicketPriority] = useState('P1');
  const [ticketTeam, setTicketTeam] = useState('ParkingOperations');
  const [ticketSummary, setTicketSummary] = useState('');
  const [ticketCreating, setTicketCreating] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  // ── Operational Incidents State ──
  const [incidents, setIncidents] = useState<OperationalIncidentItem[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);
  const [selectedIncidentDetail, setSelectedIncidentDetail] = useState<OperationalIncidentDetail | null>(null);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [loadingIncidentDetail, setLoadingIncidentDetail] = useState(false);
  const [incidentFilter, setIncidentFilter] = useState<string>('All');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [incidentActionLoading, setIncidentActionLoading] = useState(false);
  const [showIncidentDetails, setShowIncidentDetails] = useState(false);
  const [incidentActionMenuOpen, setIncidentActionMenuOpen] = useState(false);
  const [mobileIncidentDetailOpen, setMobileIncidentDetailOpen] = useState(false);
  const [showIncidentAudit, setShowIncidentAudit] = useState(false);

  // Incident Modals
  const [createIncidentOpen, setCreateIncidentOpen] = useState(false);
  const [assignIncidentOpen, setAssignIncidentOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [transitionIncidentOpen, setTransitionIncidentOpen] = useState(false);
  const [linkTicketOpen, setLinkTicketOpen] = useState(false);

  // Incident Modal Fields
  const [incTitle, setIncTitle] = useState('Main Entrance Barrier Stuck Offline');
  const [incDescription, setIncDescription] = useState('IoT gate controller heartbeat timed out for 10 minutes.');
  const [incPriority, setIncPriority] = useState('P0');
  const [incType, setIncType] = useState('GateOffline');
  const [incPropertyId, setIncPropertyId] = useState('1');
  const [incAssignedTeam, setIncAssignedTeam] = useState('ParkingOperations');
  const [incInitialTicketReference, setIncInitialTicketReference] = useState('');
  const [createIncidentError, setCreateIncidentError] = useState<string | null>(null);

  const [assignTeam, setAssignTeam] = useState('ParkingOperations');
  const [assignUserId, setAssignUserId] = useState('1');
  const [assignError, setAssignError] = useState<string | null>(null);

  const [overrideBookingId, setOverrideBookingId] = useState('4');
  const [overrideReason, setOverrideReason] = useState('Driver trapped at barrier during system offline');
  const [overrideAction, setOverrideAction] = useState('RemoteOpenGate');
  const [overrideResult, setOverrideResult] = useState<AccessOverrideResult | null>(null);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const [incToStatus, setIncToStatus] = useState('Resolved');
  const [incRootCause, setIncRootCause] = useState('Power supply rebooted; hardware online.');
  const [transitionIncError, setTransitionIncError] = useState<string | null>(null);

  const [linkTicketId, setLinkTicketId] = useState('');
  const [linkTicketError, setLinkTicketError] = useState<string | null>(null);

  // ── Financial Disputes State ──
  const [disputes, setDisputes] = useState<DisputeCase[]>([]);
  const [selectedDisputeId, setSelectedDisputeId] = useState<number | null>(null);
  const [selectedDisputeDetail, setSelectedDisputeDetail] = useState<DisputeCase | null>(null);
  const [loadingDisputes, setLoadingDisputes] = useState(false);
  const [disputeFilter, setDisputeFilter] = useState<string>('All');
  const [disputeSearch, setDisputeSearch] = useState('');
  const [disputeActionLoading, setDisputeActionLoading] = useState(false);
  const [showDisputeDetails, setShowDisputeDetails] = useState(false);
  const [disputeActionMenuOpen, setDisputeActionMenuOpen] = useState(false);
  const [mobileDisputeDetailOpen, setMobileDisputeDetailOpen] = useState(false);
  const [showDisputeAudit, setShowDisputeAudit] = useState(false);

  // Dispute Modals
  const [assignDisputeOpen, setAssignDisputeOpen] = useState(false);
  const [requestEvidenceOpen, setRequestEvidenceOpen] = useState(false);
  const [uploadDisputeEvidenceOpen, setUploadDisputeEvidenceOpen] = useState(false);
  const [decisionDisputeOpen, setDecisionDisputeOpen] = useState(false);
  const [linkTicketDisputeOpen, setLinkTicketDisputeOpen] = useState(false);

  // Dispute Form Fields
  const [dspAssignTeam, setDspAssignTeam] = useState('Finance');
  const [dspAssignUserId, setDspAssignUserId] = useState('8');
  const [dspAssignStatus, setDspAssignStatus] = useState('EvidenceReview');
  const [dspAssignError, setDspAssignError] = useState<string | null>(null);

  const [dspReqMessage, setDspReqMessage] = useState('Please upload bank transaction screenshot showing deduction.');
  const [dspReqDays, setDspReqDays] = useState('3');
  const [dspReqError, setDspReqError] = useState<string | null>(null);

  const [dspEvType, setDspEvType] = useState('GatewayLog');
  const [dspEvFile, setDspEvFile] = useState<File | null>(null);
  const [dspEvNotes, setDspEvNotes] = useState('Stripe webhook log showing charge status.');
  const [dspEvError, setDspEvError] = useState<string | null>(null);

  const [dspDecision, setDspDecision] = useState('ApproveReversal');
  const [dspDecisionReason, setDspDecisionReason] = useState('Verified double deduction on bank record');
  const [dspApprovedAmount, setDspApprovedAmount] = useState('15.00');
  const [dspDecisionError, setDspDecisionError] = useState<string | null>(null);

  const [dspLinkTicketId, setDspLinkTicketId] = useState('');
  const [dspLinkTicketError, setDspLinkTicketError] = useState<string | null>(null);

  // ── Command Center Dashboard Metrics State ──
  const [dashboardMetrics, setDashboardMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // ── 24/7 On-Call Escalation State ──
  const [onCallStatus, setOnCallStatus] = useState<OnCallRosterStatus | null>(null);
  const [loadingOnCall, setLoadingOnCall] = useState(false);
  const [onCallError, setOnCallError] = useState<string | null>(null);

  // Test Alert Modal
  const [testAlertOpen, setTestAlertOpen] = useState(false);
  const [testAlertChannel, setTestAlertChannel] = useState('Push');
  const [testAlertUserId, setTestAlertUserId] = useState<number>(1);
  const [testAlertMessage, setTestAlertMessage] = useState('Test alert notification from ParkJom Command Center');
  const [testingAlert, setTestingAlert] = useState(false);
  const [testAlertResult, setTestAlertResult] = useState<TestOnCallAlertResult | null>(null);
  const [testAlertError, setTestAlertError] = useState<string | null>(null);

  // Edit Policy Modal
  const [editPolicyOpen, setEditPolicyOpen] = useState(false);
  const [p0BackupDelay, setP0BackupDelay] = useState<number>(2);
  const [p0SupervisorDelay, setP0SupervisorDelay] = useState<number>(5);
  const [p0ManagerDelay, setP0ManagerDelay] = useState<number>(15);
  const [p1BackupDelay, setP1BackupDelay] = useState<number>(5);
  const [p1SupervisorDelay, setP1SupervisorDelay] = useState<number>(15);
  const [p1ManagerDelay, setP1ManagerDelay] = useState<number>(30);
  const [policyChannels, setPolicyChannels] = useState<string[]>(['Push', 'SMS', 'Phone', 'Email']);
  const [autoEscalateEnabled, setAutoEscalateEnabled] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  // ── Audit Log Timeline State ──
  const [auditLogResponse, setAuditLogResponse] = useState<SupportAuditLogResponse | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState<string>('All');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditError, setAuditError] = useState<string | null>(null);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  };

  // Fetch command center dashboard metrics
  const fetchDashboardMetrics = async () => {
    if (!viewer.token) return;
    setLoadingMetrics(true);
    setMetricsError(null);
    try {
      const data = await getAdminDashboardMetrics(viewer.token);
      setDashboardMetrics(data);
    } catch (err) {
      setMetricsError(err instanceof Error ? err.message : 'Unable to load dashboard metrics.');
    } finally {
      setLoadingMetrics(false);
    }
  };

  // Fetch on-call roster and policy
  const fetchOnCallStatus = async () => {
    if (!viewer.token) return;
    setLoadingOnCall(true);
    setOnCallError(null);
    try {
      const data = await getOnCallRosterStatus(viewer.token);
      setOnCallStatus(data);
      if (data.primaryResponder?.userId) {
        setTestAlertUserId(data.primaryResponder.userId);
      }
      if (data.policy) {
        setP0BackupDelay(data.policy.p0BackupDelayMinutes);
        setP0SupervisorDelay(data.policy.p0SupervisorDelayMinutes);
        setP0ManagerDelay(data.policy.p0ManagerDelayMinutes);
        setP1BackupDelay(data.policy.p1BackupDelayMinutes);
        setP1SupervisorDelay(data.policy.p1SupervisorDelayMinutes);
        setP1ManagerDelay(data.policy.p1ManagerDelayMinutes);
        setAutoEscalateEnabled(data.policy.autoEscalateEnabled);
        if (data.policy.notificationChannels) {
          setPolicyChannels(data.policy.notificationChannels.split(',').map((s) => s.trim()).filter(Boolean));
        }
      }
    } catch (err) {
      setOnCallError(err instanceof Error ? err.message : 'Unable to load on-call roster.');
    } finally {
      setLoadingOnCall(false);
    }
  };

  // Test on-call alert notification
  const handleTestAlert = async (e: FormEvent) => {
    e.preventDefault();
    if (!viewer.token) return;
    setTestingAlert(true);
    setTestAlertError(null);
    setTestAlertResult(null);
    try {
      const res = await testOnCallAlert(viewer.token, {
        channel: testAlertChannel,
        targetUserId: Number(testAlertUserId),
        testMessage: testAlertMessage,
      });
      setTestAlertResult(res);
      showNotice(`Test alert dispatched via ${res.channel} to ${res.recipient}.`);
      void fetchOnCallStatus();
      void fetchAuditLogs();
    } catch (err) {
      setTestAlertError(err instanceof Error ? err.message : 'Unable to dispatch test alert.');
    } finally {
      setTestingAlert(false);
    }
  };

  // Update on-call escalation policy
  const handleSavePolicy = async (e: FormEvent) => {
    e.preventDefault();
    if (!viewer.token) return;
    setSavingPolicy(true);
    setPolicyError(null);
    try {
      const updated = await updateOnCallPolicy(viewer.token, {
        p0BackupDelayMinutes: Number(p0BackupDelay),
        p0SupervisorDelayMinutes: Number(p0SupervisorDelay),
        p0ManagerDelayMinutes: Number(p0ManagerDelay),
        p1BackupDelayMinutes: Number(p1BackupDelay),
        p1SupervisorDelayMinutes: Number(p1SupervisorDelay),
        p1ManagerDelayMinutes: Number(p1ManagerDelay),
        enabledChannels: policyChannels,
        autoEscalateEnabled: autoEscalateEnabled,
      });
      setEditPolicyOpen(false);
      showNotice('On-call escalation policy successfully updated.');
      if (onCallStatus) {
        setOnCallStatus({ ...onCallStatus, policy: updated });
      }
      void fetchOnCallStatus();
      void fetchAuditLogs();
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : 'Unable to save on-call policy.');
    } finally {
      setSavingPolicy(false);
    }
  };

  // Fetch support audit event timeline
  const fetchAuditLogs = async () => {
    if (!viewer.token) return;
    setLoadingAudit(true);
    setAuditError(null);
    try {
      const data = await querySupportAuditTimeline(viewer.token, auditPage, 100, auditFilter);
      setAuditLogResponse(data);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'Unable to load audit logs.');
    } finally {
      setLoadingAudit(false);
    }
  };

  // Fetch admin conversations queue
  const fetchQueue = async () => {
    if (!viewer.token) return;
    setLoadingQueue(true);
    try {
      const response = await listAdminConversationQueue(viewer.token, 1, 50);
      const items = response?.items || [];
      setConversations(items);
      if (items.length > 0 && selectedConversationId === null) {
        setSelectedConversationId(items[0].conversationId);
      }
    } catch {
      // Continue gracefully
    } finally {
      setLoadingQueue(false);
    }
  };

  // Fetch operational incidents from backend
  const fetchIncidents = async () => {
    if (!viewer.token) return;
    setLoadingIncidents(true);
    try {
      const response = await apiListOperationalIncidents(
        viewer.token,
        1,
        50,
        incidentFilter === 'All' ? undefined : incidentFilter
      );
      const items = response?.items || [];
      setIncidents(items);
      if (items.length > 0 && selectedIncidentId === null) {
        setSelectedIncidentId(items[0].incidentId);
      }
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Unable to load operational incidents.');
    } finally {
      setLoadingIncidents(false);
    }
  };

  // Fetch dispute cases from backend
  const fetchDisputes = async () => {
    if (!viewer.token) return;
    setLoadingDisputes(true);
    try {
      const response = await listAdminDisputes(
        viewer.token,
        1,
        50,
        disputeFilter === 'All' ? undefined : disputeFilter
      );
      const items = response?.items || [];
      setDisputes(items);
      if (items.length > 0 && selectedDisputeId === null) {
        setSelectedDisputeId(items[0].disputeId);
        setSelectedDisputeDetail(items[0]);
      } else if (selectedDisputeId !== null) {
        const found = items.find((d) => d.disputeId === selectedDisputeId);
        if (found) setSelectedDisputeDetail(found);
      }
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Unable to load dispute register.');
    } finally {
      setLoadingDisputes(false);
    }
  };

  useEffect(() => {
    if (viewer.token) {
      void fetchQueue();
      void fetchDashboardMetrics();
      void fetchOnCallStatus();
      void fetchAuditLogs();
    }
  }, [viewer.token]);

  useEffect(() => {
    if (viewer.token && activeView === 'command') {
      void fetchDashboardMetrics();
    }
  }, [viewer.token, activeView]);

  useEffect(() => {
    if (viewer.token && activeView === 'on-call') {
      void fetchOnCallStatus();
    }
  }, [viewer.token, activeView]);

  useEffect(() => {
    if (viewer.token && activeView === 'audit') {
      void fetchAuditLogs();
    }
  }, [viewer.token, activeView, auditFilter, auditPage]);

  useEffect(() => {
    if (viewer.token && (activeView === 'incidents' || activeView === 'command')) {
      void fetchIncidents();
    }
  }, [viewer.token, activeView, incidentFilter]);

  useEffect(() => {
    if (viewer.token && (activeView === 'disputes' || activeView === 'command')) {
      void fetchDisputes();
    }
  }, [viewer.token, activeView, disputeFilter]);

  // Fetch conversation detail when selected
  useEffect(() => {
    if (!viewer.token || !selectedConversationId) return;
    let active = true;
    setLoadingDetail(true);

    getConversationDetails(viewer.token, selectedConversationId)
      .then((detail) => {
        if (active) setSelectedConversationDetail(detail);
      })
      .catch(() => {
        // Continue gracefully
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [viewer.token, selectedConversationId]);

  // Fetch operational incident detail when selected
  useEffect(() => {
    if (!viewer.token || !selectedIncidentId) return;
    let active = true;
    setLoadingIncidentDetail(true);

    getOperationalIncidentDetails(viewer.token, selectedIncidentId)
      .then((detail) => {
        if (active) setSelectedIncidentDetail(detail);
      })
      .catch(() => {
        const found = incidents.find((i) => i.incidentId === selectedIncidentId);
        if (active && found) {
          setSelectedIncidentDetail({
            incidentId: found.incidentId,
            incidentReference: found.incidentReference,
            incidentType: found.incidentType,
            priority: found.priority,
            status: found.status,
            title: found.title,
            description: 'Automated site telemetry alert.',
            propertyId: null,
            propertyName: null,
            parkingSpotId: null,
            spotNumber: null,
            ioTDeviceId: null,
            esp32Serial: null,
            source: 'Admin',
            assignedTeam: found.assignedTeam || 'ParkingOperations',
            assignedUserId: null,
            assignedUserName: null,
            affectedCustomerCount: found.affectedCustomerCount || 1,
            acknowledgedAt: null,
            resolvedAt: null,
            closedAt: null,
            escalationLevel: 0,
            nextEscalationAt: null,
            createdAt: found.createdAt,
            updatedAt: found.createdAt,
            linkedTickets: [],
            auditTimeline: [],
            notificationAttempts: [],
          });
        }
      })
      .finally(() => {
        if (active) setLoadingIncidentDetail(false);
      });

    return () => {
      active = false;
    };
  }, [viewer.token, selectedIncidentId, incidents]);

  // Update selected dispute detail when selected
  useEffect(() => {
    if (!selectedDisputeId || disputes.length === 0) return;
    const found = disputes.find((d) => d.disputeId === selectedDisputeId);
    if (found) setSelectedDisputeDetail(found);
  }, [selectedDisputeId, disputes]);

  const visibleConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((c) =>
      [String(c.conversationId), c.conversationReference, c.customerName, c.customerEmail, c.lastMessageSnippet || '']
        .some((v) => v.toLowerCase().includes(query))
    );
  }, [conversations, conversationSearch]);

  const visibleIncidents = useMemo(() => {
    const query = incidentSearch.trim().toLowerCase();
    if (!query) return incidents;
    return incidents.filter((inc) =>
      [inc.incidentReference, inc.title, inc.incidentType, inc.assignedTeam || '']
        .some((v) => v.toLowerCase().includes(query))
    );
  }, [incidents, incidentSearch]);

  const visibleDisputes = useMemo(() => {
    const query = disputeSearch.trim().toLowerCase();
    if (!query) return disputes;
    return disputes.filter((d) =>
      [d.disputeReference, d.customerName, d.customerEmail, d.disputeType, d.reason]
        .some((v) => v && v.toLowerCase().includes(query))
    );
  }, [disputes, disputeSearch]);

  const openTicketFromConversation = () => {
    if (!selectedConversationDetail) return;
    setTicketSubject(`Escalated Live Chat: ${selectedConversationDetail.customerName}`);
    setTicketCategory('ParkingAccess');
    setTicketPriority('P1');
    setTicketTeam('ParkingOperations');
    setTicketSummary(`Originating live chat reference: ${selectedConversationDetail.conversationReference}\nUser inquiry: ${selectedConversationDetail.lastMessageSnippet || 'No summary'}`);
    setCreateTicketOpen(true);
  };

  const createConversationTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedConversationDetail || !ticketSubject.trim() || !ticketSummary.trim()) return;
    setTicketCreating(true);
    setTicketError(null);

    try {
      const ticket = await createAdminTicketFromConversation(viewer.token, selectedConversationDetail.conversationId, {
        subject: ticketSubject.trim(),
        category: ticketCategory,
        priority: ticketPriority,
        assignedTeam: ticketTeam,
        internalSummary: ticketSummary.trim(),
      });
      showNotice(`Tracked ticket ${ticket.ticketReference} created.`);
      setCreateTicketOpen(false);
      void fetchQueue();
    } catch (err) {
      setTicketError(err instanceof Error ? err.message : 'Unable to create ticket.');
    } finally {
      setTicketCreating(false);
    }
  };

  const sendReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!reply.trim() || !selectedConversationDetail) return;
    setSendingReply(true);

    try {
      await sendAdminConversationMessage(viewer.token, selectedConversationDetail.conversationId, reply.trim(), isInternalNote);
      setReply('');
      showNotice(isInternalNote ? 'Internal note recorded.' : `Reply sent to ${selectedConversationDetail.customerName}.`);
      const updated = await getConversationDetails(viewer.token, selectedConversationDetail.conversationId);
      setSelectedConversationDetail(updated);
      void fetchQueue();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleDispatchWorkflow = async (key: string, label: string) => {
    if (!selectedConversationDetail) return;
    setDispatchingWorkflow(true);
    try {
      await dispatchWorkflowToConversation(viewer.token, selectedConversationDetail.conversationId, { key, label });
      showNotice(`Workflow recommendation "${label}" dispatched.`);
      const updated = await getConversationDetails(viewer.token, selectedConversationDetail.conversationId);
      setSelectedConversationDetail(updated);
      void fetchQueue();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Unable to dispatch workflow.');
    } finally {
      setDispatchingWorkflow(false);
    }
  };

  const handleCloseConversation = async () => {
    if (!selectedConversationDetail) return;
    setClosingConv(true);
    try {
      await closeAdminConversation(viewer.token, selectedConversationDetail.conversationId, 'Resolved by staff operator');
      showNotice(`Conversation #${selectedConversationDetail.conversationId} closed.`);
      const updated = await getConversationDetails(viewer.token, selectedConversationDetail.conversationId);
      setSelectedConversationDetail(updated);
      void fetchQueue();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Unable to close conversation.');
    } finally {
      setClosingConv(false);
    }
  };

  // ── Incident Action Handlers ──
  const handleAcknowledgeIncident = async () => {
    if (!selectedIncidentDetail || incidentActionLoading) return;
    setIncidentActionLoading(true);
    try {
      const updated = await apiAcknowledgeIncident(viewer.token, selectedIncidentDetail.incidentId);
      setSelectedIncidentDetail(updated);
      showNotice(`Incident ${updated.incidentReference} acknowledged.`);
      await fetchIncidents();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Unable to acknowledge incident.');
    } finally {
      setIncidentActionLoading(false);
    }
  };

  const handleAssignResponder = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentDetail || incidentActionLoading) return;
    setIncidentActionLoading(true);
    setAssignError(null);
    try {
      const updated = await apiAssignIncidentResponder(viewer.token, selectedIncidentDetail.incidentId, {
        assignedTeam: assignTeam,
        assignedUserId: Number(assignUserId),
      });
      setSelectedIncidentDetail(updated);
      setAssignIncidentOpen(false);
      showNotice(`Assigned to ${updated.assignedUserName || assignUserId} (${assignTeam}).`);
      await fetchIncidents();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Unable to assign responder.');
    } finally {
      setIncidentActionLoading(false);
    }
  };

  const handleExecuteOverride = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentDetail || incidentActionLoading) return;
    setIncidentActionLoading(true);
    setOverrideError(null);
    setOverrideResult(null);
    try {
      const result = await apiExecuteAccessOverride(viewer.token, selectedIncidentDetail.incidentId, {
        bookingId: Number(overrideBookingId),
        reason: overrideReason.trim(),
        action: overrideAction,
      });
      setOverrideResult(result);
      showNotice(result.message || 'Barrier access override executed successfully!');
      const updated = await getOperationalIncidentDetails(viewer.token, selectedIncidentDetail.incidentId);
      setSelectedIncidentDetail(updated);
      await fetchIncidents();
    } catch (err) {
      setOverrideError(err instanceof Error ? err.message : 'Unable to execute access override.');
    } finally {
      setIncidentActionLoading(false);
    }
  };

  const handleTransitionIncident = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentDetail || incidentActionLoading) return;
    setIncidentActionLoading(true);
    setTransitionIncError(null);
    try {
      const updated = await apiTransitionIncidentStatus(viewer.token, selectedIncidentDetail.incidentId, {
        toStatus: incToStatus,
        rootCause: incRootCause.trim(),
      });
      setSelectedIncidentDetail(updated);
      setTransitionIncidentOpen(false);
      showNotice(`Incident ${updated.incidentReference} transitioned to ${incToStatus}.`);
      await fetchIncidents();
    } catch (err) {
      setTransitionIncError(err instanceof Error ? err.message : 'Unable to transition status.');
    } finally {
      setIncidentActionLoading(false);
    }
  };

  const handleCreateIncident = async (e: FormEvent) => {
    e.preventDefault();
    if (!incTitle.trim() || !incDescription.trim() || incidentActionLoading) return;
    setIncidentActionLoading(true);
    setCreateIncidentError(null);
    try {
      const created = await apiCreateOperationalIncident(viewer.token, {
        title: incTitle.trim(),
        description: incDescription.trim(),
        priority: incPriority,
        incidentType: incType,
        propertyId: incPropertyId ? Number(incPropertyId) : undefined,
        assignedTeam: incAssignedTeam,
        initialTicketReference: incInitialTicketReference.trim() || undefined,
      });
      showNotice(`Operational incident ${created.incidentReference} created.`);
      setCreateIncidentOpen(false);
      setIncInitialTicketReference('');
      setSelectedIncidentId(created.incidentId);
      setSelectedIncidentDetail(created);
      await fetchIncidents();
    } catch (err) {
      setCreateIncidentError(err instanceof Error ? err.message : 'Unable to create incident.');
    } finally {
      setIncidentActionLoading(false);
    }
  };

  const handleLinkTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentDetail || !linkTicketId.trim() || incidentActionLoading) return;
    setIncidentActionLoading(true);
    setLinkTicketError(null);
    try {
      const ticketRef = linkTicketId.trim();
      const incRef = selectedIncidentDetail.incidentReference || selectedIncidentDetail.incidentId;
      await apiLinkTicketToIncident(viewer.token, ticketRef, incRef);
      showNotice(`Ticket ${ticketRef} linked to incident #${incRef}.`);
      setLinkTicketOpen(false);
      setLinkTicketId('');
      const updated = await getOperationalIncidentDetails(viewer.token, incRef);
      setSelectedIncidentDetail(updated);
    } catch (err) {
      setLinkTicketError(err instanceof Error ? err.message : 'Unable to link ticket.');
    } finally {
      setIncidentActionLoading(false);
    }
  };

  // ── Dispute Action Handlers ──
  const handleAssignDispute = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDisputeDetail || disputeActionLoading) return;
    setDisputeActionLoading(true);
    setDspAssignError(null);
    try {
      const updated = await assignDisputeCase(viewer.token, selectedDisputeDetail.disputeId, {
        assignedTeam: dspAssignTeam,
        assignedUserId: Number(dspAssignUserId),
        status: dspAssignStatus,
      });
      setSelectedDisputeDetail(updated);
      setAssignDisputeOpen(false);
      showNotice(`Dispute case assigned to ${updated.assignedUserName || dspAssignUserId} (${dspAssignTeam}).`);
      await fetchDisputes();
    } catch (err) {
      setDspAssignError(err instanceof Error ? err.message : 'Unable to assign dispute case.');
    } finally {
      setDisputeActionLoading(false);
    }
  };

  const handleRequestEvidence = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDisputeDetail || !dspReqMessage.trim() || disputeActionLoading) return;
    setDisputeActionLoading(true);
    setDspReqError(null);
    try {
      await adminRequestCustomerEvidence(viewer.token, selectedDisputeDetail.disputeId, {
        customerMessage: dspReqMessage.trim(),
        deadlineDays: Number(dspReqDays) || 3,
      });
      setRequestEvidenceOpen(false);
      showNotice('Evidence request dispatched to customer.');
      await fetchDisputes();
    } catch (err) {
      setDspReqError(err instanceof Error ? err.message : 'Unable to request evidence.');
    } finally {
      setDisputeActionLoading(false);
    }
  };

  const handleUploadDisputeEvidence = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDisputeDetail || !dspEvFile || disputeActionLoading) return;
    setDisputeActionLoading(true);
    setDspEvError(null);
    try {
      const evidence = await adminUploadDisputeEvidence(
        viewer.token,
        selectedDisputeDetail.disputeId,
        dspEvFile,
        dspEvType,
        dspEvNotes.trim() || undefined
      );
      showNotice(`Evidence "${evidence.fileName}" uploaded successfully.`);
      setUploadDisputeEvidenceOpen(false);
      setDspEvFile(null);
      await fetchDisputes();
    } catch (err) {
      setDspEvError(err instanceof Error ? err.message : 'Unable to upload evidence.');
    } finally {
      setDisputeActionLoading(false);
    }
  };

  const handleFinalizeDecision = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDisputeDetail || !dspDecisionReason.trim() || disputeActionLoading) return;
    setDisputeActionLoading(true);
    setDspDecisionError(null);
    try {
      const updated = await finalizeDisputeDecision(viewer.token, selectedDisputeDetail.disputeId, {
        decision: dspDecision,
        decisionReason: dspDecisionReason.trim(),
        approvedAmount: dspDecision === 'ApproveReversal' ? Number(dspApprovedAmount) : 0,
      });
      setSelectedDisputeDetail(updated);
      setDecisionDisputeOpen(false);
      showNotice(`Dispute decision '${dspDecision}' executed successfully.`);
      await fetchDisputes();
    } catch (err) {
      setDspDecisionError(err instanceof Error ? err.message : 'Unable to finalize decision.');
    } finally {
      setDisputeActionLoading(false);
    }
  };

  const handleLinkTicketToDispute = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDisputeDetail || !dspLinkTicketId.trim() || disputeActionLoading) return;
    setDisputeActionLoading(true);
    setDspLinkTicketError(null);
    try {
      const ticketRef = dspLinkTicketId.trim();
      const dspRef = selectedDisputeDetail.disputeReference || selectedDisputeDetail.disputeId;
      await apiLinkTicketToDispute(viewer.token, ticketRef, dspRef);
      showNotice(`Ticket ${ticketRef} linked to dispute #${dspRef}.`);
      setLinkTicketDisputeOpen(false);
      setDspLinkTicketId('');
      await fetchDisputes();
    } catch (err) {
      setDspLinkTicketError(err instanceof Error ? err.message : 'Unable to link ticket to dispute.');
    } finally {
      setDisputeActionLoading(false);
    }
  };

  const adminNavigation: {
    id: AdminView;
    label: string;
    description: string;
    icon: LucideIcon;
    count?: number;
    badgeLabel?: string;
  }[] = [
    {
      id: 'command',
      label: 'Command Center',
      description: 'Real-time telemetry, KPI metrics, ticket backlog trends, and operational health.',
      icon: LayoutDashboard,
      badgeLabel: 'Live KPIs',
    },
    {
      id: 'conversations',
      label: 'Live Queue',
      description: 'Real-time customer live chat triage, workflow dispatch, and ticket escalation.',
      icon: MessagesSquare,
      count: dashboardMetrics?.waitingConversationsCount ?? conversations.length,
      badgeLabel: 'Waiting Queue',
    },
    {
      id: 'tickets',
      label: 'Support Tickets',
      description: 'Customer inquiries, team assignments, SLA monitoring, and lifecycle resolution.',
      icon: TicketCheck,
      count: dashboardMetrics?.openTicketsCount,
      badgeLabel: 'Active Cases',
    },
    {
      id: 'incidents',
      label: 'Operational Incidents',
      description: 'Barrier hardware outages, IoT device telemetry, and emergency gate access overrides.',
      icon: Siren,
      count: dashboardMetrics?.activeIncidentsCount ?? incidents.filter((i) => i.status !== 'Resolved' && i.status !== 'Closed').length,
      badgeLabel: 'Hardware & Sites',
    },
    {
      id: 'disputes',
      label: 'Dispute Ledger',
      description: 'Payment disputes, overstay penalty claims, evidence reviews, and financial reversals.',
      icon: ShieldAlert,
      count: dashboardMetrics?.openDisputesCount ?? disputes.filter((d) => d.status !== 'Approved' && d.status !== 'Declined' && d.status !== 'Closed').length,
      badgeLabel: 'Financial Audits',
    },
    {
      id: 'on-call',
      label: '24/7 On-Call Escalation',
      description: 'Automated 4-tier responder shifts, failover policy schedules, and alert dispatch.',
      icon: BellRing,
      badgeLabel: 'On-Call Roster',
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      description: 'Chronological timeline of all system actions, ticket transitions, and admin overrides.',
      icon: History,
      count: auditLogResponse?.totalCount,
      badgeLabel: 'Event Logs',
    },
  ];

  // ── Render Full Menu Launchpad Page ──
  const renderMenuPage = () => {
    return (
      <div className="space-y-6" data-component="admin-menu-page">
        {/* Portal Hero Card */}
        <section className="rounded-lg border border-black/[0.06] bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F7] text-[#007AFF] shadow-2xs">
                <Headphones className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-lg font-bold text-[#0F172A] sm:text-xl">Support Operations Command Portal</h1>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Select an operational module below to access real-time queues, dispatch responses, and oversee site services.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200/60">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Operations Online
              </span>
            </div>
          </div>

          {/* Quick Metrics Ticker */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 pt-2 border-t border-black/[0.04]">
            <div className="rounded-md border border-black/[0.04] bg-[#FAFBFD] p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] block">Waiting Queue</span>
              <span className="font-mono text-lg font-bold text-[#0F172A] block mt-0.5">
                {dashboardMetrics?.waitingConversationsCount ?? conversations.length}
              </span>
            </div>
            <div className="rounded-md border border-black/[0.04] bg-[#FAFBFD] p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] block">Open Tickets</span>
              <span className="font-mono text-lg font-bold text-[#007AFF] block mt-0.5">
                {dashboardMetrics?.openTicketsCount ?? 0}
              </span>
            </div>
            <div className="rounded-md border border-black/[0.04] bg-[#FAFBFD] p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] block">Active Incidents</span>
              <span className="font-mono text-lg font-bold text-rose-600 block mt-0.5">
                {dashboardMetrics?.activeIncidentsCount ?? incidents.filter((i) => i.status !== 'Resolved' && i.status !== 'Closed').length}
              </span>
            </div>
            <div className="rounded-md border border-black/[0.04] bg-[#FAFBFD] p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] block">Open Disputes</span>
              <span className="font-mono text-lg font-bold text-amber-600 block mt-0.5">
                {dashboardMetrics?.openDisputesCount ?? disputes.filter((d) => d.status !== 'Approved' && d.status !== 'Declined' && d.status !== 'Closed').length}
              </span>
            </div>
          </div>
        </section>

        {/* Full Menu Grid (Launchpad Cards) */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Operational Modules</h2>
            <span className="text-[11px] text-[#8E8E93]">7 Functional Domains</span>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {adminNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className="group relative flex flex-col justify-between rounded-lg border border-black/[0.06] bg-white p-4.5 text-left shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all hover:border-[#007AFF]/40 hover:shadow-[0_4px_16px_rgba(0,122,255,0.08)] hover:-translate-y-0.5 cursor-pointer"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#F5F5F7] text-[#007AFF] transition-colors group-hover:bg-blue-50">
                        <Icon className="h-5 w-5" />
                      </span>
                      {typeof item.count === 'number' && item.count > 0 ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-[#0F172A] border border-slate-200/60">
                          {item.count}
                        </span>
                      ) : item.badgeLabel ? (
                        <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200/40">
                          {item.badgeLabel}
                        </span>
                      ) : null}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-[#0F172A] group-hover:text-[#007AFF] transition-colors">
                        {item.label}
                      </h3>
                      <p className="mt-1 text-xs text-[#64748B] leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-black/[0.04] flex items-center justify-between text-xs font-semibold text-[#007AFF]">
                    <span>Open Module</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Render Command Center ──
  const renderCommandCenter = () => {
    const recentTickets = dashboardMetrics?.recentTickets || [];
    const recentIncidents = dashboardMetrics?.recentIncidents || [];

    return (
      <div className="space-y-5" data-component="admin-command-center">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#1D1D1F]">
              Support & Operations Command Center
            </h2>
            <p className="text-xs text-[#6E6E73]">
              Live customer telemetry, ticket backlog, hardware disruptions, and financial settlements
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void fetchDashboardMetrics();
                void fetchIncidents();
                void fetchDisputes();
                void fetchQueue();
              }}
              disabled={loadingMetrics}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] shadow-xs hover:bg-[#F5F5F7]"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loadingMetrics && 'animate-spin text-[#007AFF]')} />
              <span>Refresh Metrics</span>
            </button>
            <div className="inline-flex items-center gap-2 rounded-md border border-black/[0.06] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] shadow-xs">
              <CircleDot className="h-3 w-3 text-[#34C759]" />
              <span>Live API Synced</span>
            </div>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            icon={MessagesSquare}
            label="Live Queue Conversations"
            value={dashboardMetrics ? String(dashboardMetrics.waitingConversationsCount) : String(conversations.length)}
            detail="Active chat requests"
            badge="Live Chat"
          />
          <MetricCard
            icon={TicketCheck}
            label="Open Support Tickets"
            value={dashboardMetrics ? String(dashboardMetrics.openTicketsCount) : '0'}
            detail="Tracked customer cases"
            badge="Ticketing"
          />
          <MetricCard
            icon={Siren}
            label="Active Site Incidents"
            value={dashboardMetrics ? String(dashboardMetrics.activeIncidentsCount) : String(incidents.filter((i) => i.status !== 'Resolved' && i.status !== 'Closed').length)}
            detail="Hardware & barrier alerts"
            badge="Operations"
          />
          <MetricCard
            icon={ShieldAlert}
            label="Open Financial Disputes"
            value={dashboardMetrics ? String(dashboardMetrics.openDisputesCount) : String(disputes.filter((d) => d.status !== 'Approved' && d.status !== 'Declined' && d.status !== 'Closed').length)}
            detail="Pending refund reviews"
            badge="Finance"
          />
          <MetricCard
            icon={Clock3}
            label="SLA At-Risk Tickets"
            value={dashboardMetrics ? String(dashboardMetrics.slaRiskTicketsCount) : '0'}
            detail="Approaching SLA deadline"
            badge="Urgent SLA"
          />
        </div>

        {/* Operational Priority Shortcuts */}
        <div className="rounded-lg border border-black/[0.06] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">Quick Action Shortcuts</h3>
            <span className="text-[10px] text-[#8E8E93]">Unified Operations Hub</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setActiveView('conversations')}
              className="flex items-center justify-between p-3 rounded-md border border-black/[0.06] bg-[#FAFBFD] hover:bg-blue-50/50 hover:border-[#007AFF]/30 transition text-left cursor-pointer"
            >
              <div>
                <p className="font-semibold text-xs text-[#1D1D1F]">Review Live Chats</p>
                <p className="text-[10px] text-[#6E6E73]">{dashboardMetrics?.waitingConversationsCount ?? conversations.length} customer inquiries</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#007AFF]" />
            </button>
            <button
              type="button"
              onClick={() => setActiveView('incidents')}
              className="flex items-center justify-between p-3 rounded-md border border-rose-200/80 bg-rose-50/40 hover:bg-rose-50 hover:border-rose-300 transition text-left cursor-pointer"
            >
              <div>
                <p className="font-semibold text-xs text-rose-800">Operational Incidents</p>
                <p className="text-[10px] text-rose-700">{dashboardMetrics?.activeIncidentsCount ?? incidents.length} active site disruptions</p>
              </div>
              <ArrowRight className="h-4 w-4 text-rose-600" />
            </button>
            <button
              type="button"
              onClick={() => setActiveView('disputes')}
              className="flex items-center justify-between p-3 rounded-md border border-amber-200/80 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-300 transition text-left cursor-pointer"
            >
              <div>
                <p className="font-semibold text-xs text-amber-800">Financial Disputes</p>
                <p className="text-[10px] text-amber-700">{dashboardMetrics?.openDisputesCount ?? disputes.length} cases under review</p>
              </div>
              <ArrowRight className="h-4 w-4 text-amber-600" />
            </button>
            <button
              type="button"
              onClick={() => setActiveView('on-call')}
              className="flex items-center justify-between p-3 rounded-md border border-indigo-200/80 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-300 transition text-left cursor-pointer"
            >
              <div>
                <p className="font-semibold text-xs text-indigo-800">24/7 On-Call Matrix</p>
                <p className="text-[10px] text-indigo-700">{onCallStatus?.primaryResponder?.name || 'Active duty roster'}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-indigo-600" />
            </button>
          </div>
        </div>

        {/* Two-Column Section: Recent Incidents & Recent Tickets */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent Operational Incidents */}
          <div className="rounded-lg border border-black/[0.06] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Siren className="h-4 w-4 text-rose-600" />
                  <h3 className="text-sm font-bold text-[#1D1D1F]">Recent Operational Incidents</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('incidents')}
                  className="text-xs font-semibold text-[#007AFF] hover:underline cursor-pointer"
                >
                  View All &rarr;
                </button>
              </div>

              {recentIncidents.length === 0 ? (
                <p className="text-xs text-[#8E8E93] py-4 text-center">No active incidents reported.</p>
              ) : (
                <div className="space-y-2">
                  {recentIncidents.map((inc) => (
                    <div
                      key={inc.incidentId}
                      className="flex items-center justify-between p-2.5 rounded-md border border-black/[0.04] bg-[#FAFBFD] hover:bg-[#F5F5F7] transition"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-rose-700">{inc.incidentReference}</span>
                          <span className={cn(
                            'rounded px-1.5 py-0.2 text-[9px] font-bold',
                            inc.priority === 'P0' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          )}>
                            {inc.priority}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-[#6E6E73]">
                            {inc.status}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-[#1D1D1F] truncate mt-1">{inc.title}</p>
                        <p className="text-[10px] text-[#8E8E93] mt-0.5">
                          Team: {inc.assignedTeam || 'ParkingOperations'} · {inc.affectedCustomerCount} affected
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIncidentId(inc.incidentId);
                          setActiveView('incidents');
                        }}
                        className="rounded-lg bg-white border border-black/[0.08] px-2.5 py-1 text-[11px] font-semibold text-[#1D1D1F] hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition shrink-0 cursor-pointer"
                      >
                        Inspect
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Support Tickets */}
          <div className="rounded-lg border border-black/[0.06] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <TicketCheck className="h-4 w-4 text-[#007AFF]" />
                  <h3 className="text-sm font-bold text-[#1D1D1F]">Recent Support Tickets</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('tickets')}
                  className="text-xs font-semibold text-[#007AFF] hover:underline cursor-pointer"
                >
                  View All &rarr;
                </button>
              </div>

              {recentTickets.length === 0 ? (
                <p className="text-xs text-[#8E8E93] py-4 text-center">No recent tickets logged.</p>
              ) : (
                <div className="space-y-2">
                  {recentTickets.slice(0, 5).map((tkt) => (
                    <div
                      key={tkt.ticketId}
                      className="flex items-center justify-between p-2.5 rounded-md border border-black/[0.04] bg-[#FAFBFD] hover:bg-[#F5F5F7] transition"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-[#007AFF]">{tkt.ticketReference}</span>
                          <span className={cn(
                            'rounded px-1.5 py-0.2 text-[9px] font-bold',
                            tkt.priority === 'P0' || tkt.priority === 'P1' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-[#6E6E73]'
                          )}>
                            {tkt.priority}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-[#6E6E73]">
                            {tkt.status}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-[#1D1D1F] truncate mt-1">{tkt.subject}</p>
                        <p className="text-[10px] text-[#8E8E93] mt-0.5">
                          {tkt.customerName} · Category: {tkt.category}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveView('tickets')}
                        className="rounded-lg bg-white border border-black/[0.08] px-2.5 py-1 text-[11px] font-semibold text-[#1D1D1F] hover:bg-blue-50 hover:text-[#007AFF] hover:border-blue-200 transition shrink-0 cursor-pointer"
                      >
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render Conversations ──
  const renderConversations = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-[#1D1D1F]">Live Support Queue</h2>
        <p className="text-xs text-[#6E6E73]">Real-time customer messaging & triage dispatch</p>
      </div>

      <section className="overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)] lg:grid lg:min-h-[580px] lg:grid-cols-[300px_minmax(0,1fr)_260px]">
        {/* Left: Queue List */}
        <div className={cn('border-b border-black/[0.06] lg:border-b-0 lg:border-r flex flex-col bg-white', mobileConversationOpen ? 'hidden lg:flex' : 'flex')}>
          <div className="p-2.5 border-b border-black/[0.06]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8E8E93]" />
              <input
                type="search"
                value={conversationSearch}
                onChange={(e) => setConversationSearch(e.target.value)}
                placeholder="Search live queue..."
                className="min-h-8 w-full rounded-md border border-black/[0.08] bg-[#F5F5F7] pl-8 pr-3 text-xs outline-none focus:border-[#007AFF] focus:bg-white"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[520px]">
            {loadingQueue ? (
              <div className="flex h-32 items-center justify-center text-xs text-[#8E8E93]">
                <Loader2 className="h-4 w-4 animate-spin text-[#007AFF]" />
              </div>
            ) : visibleConversations.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8E8E93]">No active conversations</div>
            ) : (
              visibleConversations.map((c) => {
                const isSelected = c.conversationId === selectedConversationId;
                return (
                  <button
                    key={c.conversationId}
                    type="button"
                    onClick={() => {
                      setSelectedConversationId(c.conversationId);
                      setMobileConversationOpen(true);
                    }}
                    className={cn(
                      'w-full cursor-pointer rounded-md border p-2.5 text-left transition-all',
                      isSelected
                        ? 'border-[#007AFF] bg-blue-50/40 shadow-xs'
                        : 'border-black/[0.04] bg-white hover:bg-[#F5F5F7]'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] font-bold text-[#007AFF]">{c.conversationReference}</span>
                      <span className="text-[9px] text-[#8E8E93]">{formatMsgDate(c.lastMessageAt)}</span>
                    </div>
                    <p className="mt-1 font-semibold text-xs text-[#1D1D1F] truncate">{c.customerName}</p>
                    <p className="text-[11px] text-[#6E6E73] truncate">{c.lastMessageSnippet || 'Conversation started'}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center: Message Thread */}
        <div className={cn('flex flex-col bg-[#FAFBFD] border-b border-black/[0.06] lg:border-b-0', mobileConversationOpen ? 'flex' : 'hidden lg:flex')}>
          {selectedConversationDetail ? (
            <>
              <div className="flex items-center justify-between border-b border-black/[0.06] bg-white px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileConversationOpen(false)}
                    className="cursor-pointer rounded-md p-1.5 text-[#0F172A] hover:bg-slate-100 lg:hidden min-h-[30px] min-w-[30px] flex items-center justify-center shrink-0 border border-slate-200"
                    aria-label="Back to conversations list"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <h3 className="font-bold text-xs text-[#1D1D1F]">{selectedConversationDetail.customerName}</h3>
                    <p className="text-[10px] text-[#8E8E93]">
                      {selectedConversationDetail.conversationReference} · {selectedConversationDetail.channel}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[9px] font-semibold text-[#007AFF]">
                  {selectedConversationDetail.status}
                </span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4 max-h-[420px]">
                {loadingDetail ? (
                  <div className="flex h-32 items-center justify-center text-xs text-[#8E8E93]">
                    <Loader2 className="h-4 w-4 animate-spin text-[#007AFF]" />
                  </div>
                ) : (
                  selectedConversationDetail.messages?.map((msg) => {
                    const isStaff = msg.senderRole === 'Admin';
                    return (
                      <div key={msg.messageId} className={cn('flex', isStaff ? 'justify-end' : 'justify-start')}>
                        <div
                          className={cn(
                            'max-w-[75%] rounded-lg px-3.5 py-2 text-xs',
                            msg.isInternal
                              ? 'bg-amber-50 border border-amber-200 text-amber-900'
                              : isStaff
                              ? 'bg-[#007AFF] text-white'
                              : 'bg-white border border-black/[0.06] text-[#1D1D1F]'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[9px] font-bold opacity-80">{msg.senderName}</span>
                            <span className="text-[8px] opacity-60">{formatMsgDate(msg.createdAt)}</span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={sendReply} className="border-t border-black/[0.06] bg-white p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#6E6E73]">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="rounded border-black/[0.15] text-[#007AFF]"
                    />
                    <span>Post as Internal Staff Note</span>
                  </label>
                  {isInternalNote && <span className="font-semibold text-amber-700">Internal only</span>}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={isInternalNote ? 'Write internal note for staff...' : 'Reply to customer...'}
                    className="flex-1 rounded-md border border-black/[0.08] px-3 py-2 text-xs outline-none focus:border-[#007AFF]"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !reply.trim()}
                    className="cursor-pointer rounded-md bg-[#007AFF] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50"
                  >
                    {sendingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-[#8E8E93]">
              Select a conversation to view transcript
            </div>
          )}
        </div>

        {/* Right: Context Sidebar */}
        <aside className={cn('border-t border-black/[0.06] bg-[#FAFBFD] p-3.5 lg:border-t-0 lg:border-l space-y-3.5 text-xs', mobileConversationOpen ? 'block' : 'hidden lg:block')}>
          {selectedConversationDetail && (
            <>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Context</h4>
                <div className="mt-2 space-y-0 divide-y divide-black/[0.04] text-[11px]">
                  <div className="py-1.5">
                    <p className="text-[9px] text-[#8E8E93]">Email</p>
                    <p className="font-semibold text-[#1D1D1F] truncate">{selectedConversationDetail.customerEmail}</p>
                  </div>
                  <div className="py-1.5">
                    <p className="text-[9px] text-[#8E8E93]">Booking ID</p>
                    <p className="font-mono font-bold text-[#007AFF]">{selectedConversationDetail.currentBookingId || 'None'}</p>
                  </div>
                  <div className="py-1.5">
                    <p className="text-[9px] text-[#8E8E93]">Status</p>
                    <p className="font-semibold text-[#1D1D1F]">{selectedConversationDetail.status}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Quick Actions</h4>
                <div className="mt-2 space-y-1.5">
                  <button
                    type="button"
                    onClick={openTicketFromConversation}
                    className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#007AFF] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0066D6]"
                  >
                    <TicketCheck className="h-3.5 w-3.5" /> Create Ticket
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDispatchWorkflow('parking-access', 'Parking Access Troubleshooting')}
                    disabled={dispatchingWorkflow || selectedConversationDetail.status === 'Closed'}
                    className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] disabled:opacity-50"
                  >
                    <Workflow className="h-3.5 w-3.5 text-[#007AFF]" /> Dispatch Access Workflow
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCloseConversation()}
                    disabled={closingConv || selectedConversationDetail.status === 'Closed'}
                    className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Close Conversation
                  </button>
                </div>
              </div>
            </>
          )}
        </aside>
      </section>
    </div>
  );

  // ── Render Operational Incidents & Hardware Access Override ──
  const renderIncidents = () => (
    <div className="space-y-4" data-component="operational-incidents">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#1D1D1F] sm:text-lg">
              Operational Incidents & Hardware Access
            </h2>
            <span className="rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
              {incidents.filter((i) => i.priority === 'P0').length} P0 Emergency
            </span>
          </div>
          <p className="text-xs text-[#6E6E73] mt-0.5">
            Real-time IoT barrier telemetry, automated emergency escalations, and hardware override control
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchIncidents()}
            disabled={loadingIncidents}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-black/[0.08] bg-white px-3 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loadingIncidents && 'animate-spin text-[#007AFF]')} />
            <span>Sync Incidents</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateIncidentOpen(true)}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md bg-[#007AFF] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#0066D6]"
          >
            <Plus className="h-4 w-4" />
            <span>Create Incident</span>
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] lg:grid lg:min-h-[620px] lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left: Incident Queue */}
        <div className={cn('flex flex-col border-b border-black/[0.06] lg:border-b-0 lg:border-r bg-white', mobileIncidentDetailOpen ? 'hidden lg:flex' : 'flex')}>
          <div className="p-3 border-b border-black/[0.06] space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8E8E93]" />
              <input
                type="search"
                value={incidentSearch}
                onChange={(e) => setIncidentSearch(e.target.value)}
                placeholder="Search reference, title, type..."
                className="min-h-8 w-full rounded-md border border-black/[0.08] bg-[#F5F5F7] pl-8 pr-3 text-xs outline-none focus:border-[#007AFF] focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="incident-status-filter" className="text-[11px] font-bold text-[#6E6E73] shrink-0">Status:</label>
              <div className="relative flex-1">
                <select
                  id="incident-status-filter"
                  value={incidentFilter}
                  onChange={(e) => setIncidentFilter(e.target.value)}
                  className="min-h-8 w-full cursor-pointer appearance-none rounded-md border border-black/[0.08] bg-[#F5F5F7] pl-3 pr-8 text-xs font-semibold text-[#1D1D1F] outline-none hover:bg-white focus:border-[#007AFF] focus:bg-white transition"
                >
                  <option value="All">All Incidents ({incidents.length})</option>
                  <option value="Open">Open</option>
                  <option value="Acknowledged">Acknowledged</option>
                  <option value="Escalated">Escalated</option>
                  <option value="Resolved">Resolved</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[#8E8E93]" />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[540px]">
            {loadingIncidents ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-[#6E6E73]">
                <Loader2 className="h-4 w-4 animate-spin text-[#007AFF]" />
                <span>Loading operational incidents...</span>
              </div>
            ) : visibleIncidents.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8E8E93]">
                <Siren className="h-6 w-6 mx-auto text-[#8E8E93]/60 mb-2" />
                <p className="font-bold text-[#1D1D1F]">No incidents found</p>
                <p className="text-[11px] mt-0.5">Hardware and barriers are running nominally.</p>
              </div>
            ) : (
              visibleIncidents.map((inc) => {
                const isSelected = inc.incidentId === selectedIncidentId;
                const isP0 = inc.priority === 'P0';

                return (
                  <button
                    key={inc.incidentId}
                    type="button"
                    onClick={() => {
                      setSelectedIncidentId(inc.incidentId);
                      setMobileIncidentDetailOpen(true);
                    }}
                    className={cn(
                      'w-full cursor-pointer rounded-md border p-3 text-left transition-all relative',
                      isSelected
                        ? 'border-[#007AFF]/40 bg-blue-50/50 shadow-xs ring-1 ring-[#007AFF]/20'
                        : 'border-transparent hover:border-black/[0.06] hover:bg-[#F5F5F7]/70'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-[#007AFF]">{inc.incidentReference}</span>
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.2 text-[9px] font-bold',
                            isP0 ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-amber-100 text-amber-800'
                          )}
                        >
                          {inc.priority}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-medium text-[#475569]">
                          {inc.status}
                        </span>
                      </div>
                    </div>

                    <h4 className="mt-1.5 text-xs font-bold text-[#1D1D1F] line-clamp-1">{inc.title}</h4>

                    <div className="mt-1 flex items-center justify-between text-[10px] text-[#6E6E73]">
                      <span className="truncate">{inc.assignedTeam || 'ParkingOperations'} · {inc.incidentType}</span>
                      <span className="font-medium text-[9px] shrink-0">{formatMsgDate(inc.createdAt)}</span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-[9px] text-[#8E8E93]">
                      <span>{inc.affectedCustomerCount} customer affected</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Full Incident Details */}
        <div className={cn('flex flex-col bg-white', mobileIncidentDetailOpen ? 'flex' : 'hidden lg:flex')}>
          {loadingIncidentDetail && !selectedIncidentDetail ? (
            <div className="flex min-h-[400px] flex-1 items-center justify-center text-xs text-[#6E6E73]">
              <Loader2 className="h-5 w-5 animate-spin text-[#007AFF]" />
            </div>
          ) : !selectedIncidentDetail ? (
            <div className="flex min-h-[400px] flex-1 flex-col items-center justify-center text-center p-8 text-xs text-[#8E8E93]">
              <Siren className="h-10 w-10 text-[#8E8E93]/50 mb-2" />
              <p className="font-bold text-sm text-[#1D1D1F]">Select an incident</p>
              <p className="text-xs text-[#6E6E73] mt-1 max-w-xs">
                Review automated IoT telemetry, responder assignments, gate override overrides, and escalation chains.
              </p>
            </div>
          ) : (
            <div className="p-4 sm:p-5 space-y-4">
              {/* Incident Header: Identity & Actions Row + Title Row */}
              <div className="border-b border-slate-100 pb-3 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMobileIncidentDetailOpen(false)}
                      className="cursor-pointer rounded-md p-1.5 text-[#0F172A] hover:bg-slate-100 lg:hidden min-h-[30px] min-w-[30px] flex items-center justify-center shrink-0 border border-slate-200 mr-1"
                      aria-label="Back to incidents list"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <span className="font-mono text-xs font-bold text-[#007AFF]">
                      {selectedIncidentDetail.incidentReference}
                    </span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-bold',
                        selectedIncidentDetail.priority === 'P0'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                          : 'bg-amber-100 text-amber-800'
                      )}
                    >
                      {selectedIncidentDetail.priority}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                      {selectedIncidentDetail.status}
                    </span>
                    {selectedIncidentDetail.escalationLevel > 0 && (
                      <span className="rounded bg-purple-50 border border-purple-200 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                        Level {selectedIncidentDetail.escalationLevel}
                      </span>
                    )}
                  </div>

                  {/* Right: Actions Toolbar */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowIncidentDetails((prev) => !prev)}
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition select-none',
                        showIncidentDetails
                          ? 'bg-[#0F172A] text-white shadow-2xs'
                          : 'bg-slate-100 text-[#475569] hover:bg-slate-200/80 hover:text-[#0F172A]'
                      )}
                    >
                      <Info className="h-3.5 w-3.5" />
                      <span>{showIncidentDetails ? 'Hide Info' : 'Incident Info'}</span>
                      {showIncidentDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {(selectedIncidentDetail.status === 'Open' || selectedIncidentDetail.status === 'Escalated') && (
                      <button
                        type="button"
                        onClick={handleAcknowledgeIncident}
                        disabled={incidentActionLoading}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#1D1D1F] px-3 py-1 text-xs font-semibold text-white hover:bg-black disabled:opacity-50 shadow-xs"
                      >
                        {incidentActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                        <span>Acknowledge</span>
                      </button>
                    )}

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIncidentActionMenuOpen((prev) => !prev)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 shadow-2xs transition"
                      >
                        <span>Actions</span>
                        <ChevronDown className="h-3 w-3 text-slate-400" />
                      </button>

                      {incidentActionMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIncidentActionMenuOpen(false)}
                          />
                          <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-md border border-black/[0.08] bg-white p-1 shadow-lg divide-y divide-black/[0.04] text-xs">
                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setIncidentActionMenuOpen(false);
                                  setAssignIncidentOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded cursor-pointer"
                              >
                                <Users className="h-3.5 w-3.5 text-[#007AFF]" />
                                <span>Assign Responder...</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setIncidentActionMenuOpen(false);
                                  setOverrideResult(null);
                                  setOverrideError(null);
                                  setOverrideModalOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-amber-700 hover:bg-amber-50 rounded cursor-pointer"
                              >
                                <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                                <span>Gate Override...</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setIncidentActionMenuOpen(false);
                                  setTransitionIncidentOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Resolve Status...</span>
                              </button>
                            </div>

                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setIncidentActionMenuOpen(false);
                                  setLinkTicketOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded cursor-pointer"
                              >
                                <Link2 className="h-3.5 w-3.5 text-[#007AFF]" />
                                <span>Link Support Ticket...</span>
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#0F172A] sm:text-lg">
                    {selectedIncidentDetail.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {selectedIncidentDetail.propertyName ? `${selectedIncidentDetail.propertyName} · ` : ''}
                    {selectedIncidentDetail.spotNumber ? `Bay ${selectedIncidentDetail.spotNumber} · ` : ''}
                    Logged {formatDateTime(selectedIncidentDetail.createdAt)} · Source: {selectedIncidentDetail.source}
                  </p>
                </div>
              </div>

              {/* Collapsible Incident Metadata Drawer */}
              {showIncidentDetails && (
                <div className="grid gap-3 sm:grid-cols-2 text-xs bg-slate-50/80 p-3.5 rounded-md border border-slate-200/70 animate-in fade-in-0 duration-150">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Incident Description & Symptoms
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {selectedIncidentDetail.description}
                    </p>
                    <div className="pt-1 flex items-center gap-2 text-[10px] text-slate-500">
                      <span>Type: <strong className="text-slate-800">{selectedIncidentDetail.incidentType}</strong></span>
                      <span>·</span>
                      <span>Affected: <strong className="text-slate-800">{selectedIncidentDetail.affectedCustomerCount} driver(s)</strong></span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Hardware & Facility Telemetry
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <p className="text-[9px] text-slate-400">Property</p>
                        <p className="font-semibold text-slate-800 truncate">
                          {selectedIncidentDetail.propertyName || `Property #${selectedIncidentDetail.propertyId || 'N/A'}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400">Bay / Barrier</p>
                        <p className="font-semibold text-slate-800">
                          {selectedIncidentDetail.spotNumber || 'Main Entrance Gate'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400">IoT Controller</p>
                        <p className="font-mono text-[10px] text-[#007AFF] font-bold">
                          {selectedIncidentDetail.ioTDeviceId || selectedIncidentDetail.esp32Serial || 'ESP32-GATE-01'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400">Assigned Staff</p>
                        <p className="font-semibold text-slate-800">
                          {selectedIncidentDetail.assignedUserName || 'Unassigned'} ({selectedIncidentDetail.assignedTeam || 'Operations'})
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Linked Support Tickets Section (Clean, flat, border-divided) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <TicketCheck className="h-4 w-4 text-[#007AFF]" />
                    <span>Linked Support Tickets ({selectedIncidentDetail.linkedTickets?.length || 0})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLinkTicketOpen(true)}
                    className="text-xs font-semibold text-[#007AFF] hover:underline cursor-pointer"
                  >
                    + Link Ticket
                  </button>
                </div>

                {(!selectedIncidentDetail.linkedTickets || selectedIncidentDetail.linkedTickets.length === 0) ? (
                  <p className="text-xs text-slate-400 italic py-1">No support tickets currently linked to this incident.</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-md">
                    {selectedIncidentDetail.linkedTickets.map((t) => (
                      <div
                        key={t.ticketId}
                        className="flex items-center justify-between p-2.5 hover:bg-slate-50 transition text-xs"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold text-[#007AFF]">{t.ticketReference}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-slate-600">{t.status}</span>
                            <span className="rounded bg-rose-50 border border-rose-200 px-1 py-0.2 text-[9px] font-bold text-rose-700">{t.priority}</span>
                          </div>
                          <p className="font-semibold text-xs text-slate-800 mt-0.5 truncate">{t.subject}</p>
                          <p className="text-[10px] text-slate-400">Customer: {t.customerName} ({t.customerEmail})</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Automated Escalation Broadcasts Section (Flat list, no bubble boxes) */}
              {selectedIncidentDetail.notificationAttempts && selectedIncidentDetail.notificationAttempts.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                    <BellRing className="h-4 w-4 text-purple-600" />
                    <span>Automated Escalation Broadcasts ({selectedIncidentDetail.notificationAttempts.length})</span>
                  </div>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-md">
                    {selectedIncidentDetail.notificationAttempts.map((notif) => (
                      <div
                        key={notif.notificationAttemptId}
                        className="flex items-center justify-between p-2.5 hover:bg-slate-50 transition text-xs"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800">{notif.recipient}</span>
                            <span className="rounded bg-purple-50 px-1.5 py-0.2 text-[9px] font-semibold text-purple-700 border border-purple-100">
                              {notif.channel}
                            </span>
                            <span className="text-[10px] text-slate-400">{formatDateTime(notif.sentAt || notif.createdAt)}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">{notif.message}</p>
                        </div>
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full shrink-0">
                          {notif.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Incident Audit Timeline Section */}
              {selectedIncidentDetail.auditTimeline && selectedIncidentDetail.auditTimeline.length > 0 && (
                <div className="pt-2 border-t border-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowIncidentAudit((prev) => !prev)}
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-black/[0.06] bg-slate-50/70 hover:bg-slate-100/80 px-3.5 py-2.5 text-left transition select-none"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-[#007AFF]">
                        <History className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-bold text-slate-800 text-xs">
                        Incident Audit Timeline ({selectedIncidentDetail.auditTimeline.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#6E6E73]">
                      <span className="text-[11px] font-medium">
                        {showIncidentAudit ? 'Hide timeline' : 'View history'}
                      </span>
                      {showIncidentAudit ? (
                        <ChevronUp className="h-4 w-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      )}
                    </div>
                  </button>

                  {showIncidentAudit && (
                    <div className="mt-3 relative border-l-2 border-slate-200 ml-3 space-y-2.5 pl-3.5 pt-1 transition-all">
                      {selectedIncidentDetail.auditTimeline.map((ev, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-[#007AFF] ring-4 ring-white" />
                          <div className="p-2.5 rounded-md bg-white border border-slate-200/80 shadow-2xs">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-[#007AFF]">{ev.action}</span>
                              <span className="text-slate-400">{formatDateTime(ev.timestamp)}</span>
                            </div>
                            <p className="text-xs text-slate-700 mt-0.5 leading-snug">{ev.detail}</p>
                            <div className="mt-1 flex items-center gap-1 text-[9px] text-slate-400">
                              <span>Actor:</span>
                              <span className="font-medium text-slate-600">{ev.actorName} ({ev.actorRole})</span>
                              {ev.newState && <span>· State: {ev.newState}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Create Operational Incident Modal ── */}
      {createIncidentOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Siren className="h-5 w-5 text-rose-600" />
                <div>
                  <h3 className="text-sm font-bold text-[#1D1D1F]">Create Operational Incident</h3>
                  <p className="text-[10px] text-[#6E6E73]">Log site barrier failure or emergency trapped customer</p>
                </div>
              </div>
              <button type="button" onClick={() => setCreateIncidentOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-3 text-xs">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Incident Title *</span>
                <input
                  value={incTitle}
                  onChange={(e) => setIncTitle(e.target.value)}
                  required
                  placeholder="e.g. Main Entrance Barrier Stuck Offline"
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF]"
                />
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Priority</span>
                  <select
                    value={incPriority}
                    onChange={(e) => setIncPriority(e.target.value)}
                    className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] bg-white font-bold"
                  >
                    <option value="P0">P0 - Critical Emergency</option>
                    <option value="P1">P1 - High Disruption</option>
                    <option value="P2">P2 - Moderate Latency</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Incident Type</span>
                  <select
                    value={incType}
                    onChange={(e) => setIncType(e.target.value)}
                    className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] bg-white"
                  >
                    <option value="GateOffline">Gate Offline</option>
                    <option value="UserTrapped">User Trapped</option>
                    <option value="PowerOutage">Power Outage</option>
                    <option value="HardwareFailure">Hardware Failure</option>
                    <option value="BarrierDamaged">Barrier Damaged</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Property ID</span>
                  <input
                    type="number"
                    value={incPropertyId}
                    onChange={(e) => setIncPropertyId(e.target.value)}
                    placeholder="e.g. 1"
                    className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Assigned Team</span>
                  <select
                    value={incAssignedTeam}
                    onChange={(e) => setIncAssignedTeam(e.target.value)}
                    className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] bg-white"
                  >
                    <option value="ParkingOperations">Parking Operations</option>
                    <option value="CustomerSupport">Customer Support</option>
                    <option value="Engineering">Engineering & IoT</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">
                  Initial Ticket Reference (Optional)
                </span>
                <input
                  value={incInitialTicketReference}
                  onChange={(e) => setIncInitialTicketReference(e.target.value)}
                  placeholder="e.g. TKT-2026-35442"
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] font-mono"
                />
                <p className="text-[10px] text-[#8E8E93]">
                  Directly link an originating customer support ticket when raising this incident
                </p>
              </label>

              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Detailed Description *</span>
                <textarea
                  rows={3}
                  value={incDescription}
                  onChange={(e) => setIncDescription(e.target.value)}
                  required
                  placeholder="Describe the hardware issue, error code, or telemetry logs..."
                  className="w-full rounded-md border border-black/[0.08] p-2.5 outline-none focus:border-[#007AFF]"
                />
              </label>

              {createIncidentError && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {createIncidentError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setCreateIncidentOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={incidentActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-4 py-1.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {incidentActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>Create Incident</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign Incident Responder Modal ── */}
      {assignIncidentOpen && selectedIncidentDetail && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#007AFF]" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Assign Incident Responder</h3>
              </div>
              <button type="button" onClick={() => setAssignIncidentOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAssignResponder} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Operational Team *</label>
                <select
                  value={assignTeam}
                  onChange={(e) => setAssignTeam(e.target.value)}
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] bg-white"
                >
                  <option value="ParkingOperations">Parking Operations</option>
                  <option value="CustomerSupport">Customer Support</option>
                  <option value="Engineering">Engineering</option>
                  <option value="TrustSafety">Trust & Safety</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Responder User ID *</label>
                <input
                  type="number"
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  required
                  placeholder="e.g. 1"
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF]"
                />
              </div>

              {assignError && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {assignError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setAssignIncidentOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={incidentActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#007AFF] px-4 py-1.5 font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50"
                >
                  {incidentActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                  <span>Assign Responder</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Remote Gate Access Override Modal ── */}
      {overrideModalOpen && selectedIncidentDetail && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-600" />
                <div>
                  <h3 className="text-sm font-bold text-[#1D1D1F]">Execute Barrier Override</h3>
                  <p className="text-[10px] text-[#6E6E73]">Direct IoT access bypass for trapped driver</p>
                </div>
              </div>
              <button type="button" onClick={() => setOverrideModalOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            {overrideResult ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Override Dispatched Successfully!</span>
                </div>
                <p className="text-[#1D1D1F]">{overrideResult.message}</p>
                <div className="font-mono text-[10px] text-emerald-700 bg-white/70 p-2 rounded-lg border border-emerald-200/60">
                  Command: {overrideResult.commandId}
                </div>
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="w-full rounded-md bg-emerald-600 py-1.5 font-semibold text-white hover:bg-emerald-700 text-xs mt-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleExecuteOverride} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Booking ID *</label>
                  <input
                    type="number"
                    value={overrideBookingId}
                    onChange={(e) => setOverrideBookingId(e.target.value)}
                    required
                    placeholder="e.g. 4"
                    className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Override Action</label>
                  <select
                    value={overrideAction}
                    onChange={(e) => setOverrideAction(e.target.value)}
                    className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] bg-white font-semibold"
                  >
                    <option value="RemoteOpenGate">Remote Open Barrier Gate</option>
                    <option value="ForceBarrierOpen">Force Barrier Hold Open</option>
                    <option value="RebootController">Reboot ESP32 Controller</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Justification Reason *</label>
                  <textarea
                    rows={2}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    required
                    placeholder="e.g. Driver trapped at barrier during system offline"
                    className="w-full rounded-md border border-black/[0.08] p-2.5 outline-none focus:border-[#007AFF]"
                  />
                </div>

                {overrideError && (
                  <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                    {overrideError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                  <button
                    type="button"
                    onClick={() => setOverrideModalOpen(false)}
                    className="rounded-md border border-black/[0.08] px-3.5 py-1.5 font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={incidentActionLoading}
                    className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-4 py-1.5 font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    {incidentActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                    <span>Dispatch Override</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Transition Incident Status Modal ── */}
      {transitionIncidentOpen && selectedIncidentDetail && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Transition Incident Status</h3>
              </div>
              <button type="button" onClick={() => setTransitionIncidentOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleTransitionIncident} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Target Status *</label>
                <select
                  value={incToStatus}
                  onChange={(e) => setIncToStatus(e.target.value)}
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] bg-white font-semibold"
                >
                  <option value="Resolved">Resolved (Disruption Rectified)</option>
                  <option value="Monitoring">Monitoring (Telemetry Under Observation)</option>
                  <option value="Closed">Closed (Archived)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Root Cause / Recovery Note *</label>
                <textarea
                  rows={3}
                  value={incRootCause}
                  onChange={(e) => setIncRootCause(e.target.value)}
                  required
                  placeholder="e.g. Power supply rebooted; hardware online."
                  className="w-full rounded-md border border-black/[0.08] p-2.5 outline-none focus:border-[#007AFF]"
                />
              </div>

              {transitionIncError && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {transitionIncError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setTransitionIncidentOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={incidentActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {incidentActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>Update Incident</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Link Support Ticket to Incident Modal ── */}
      {linkTicketOpen && selectedIncidentDetail && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-[#007AFF]" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Link Support Ticket</h3>
              </div>
              <button type="button" onClick={() => setLinkTicketOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleLinkTicket} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Ticket Reference or ID *</label>
                <input
                  type="text"
                  value={linkTicketId}
                  onChange={(e) => setLinkTicketId(e.target.value)}
                  required
                  placeholder="e.g. TKT-2026-35442 or 8"
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] font-mono text-xs"
                />
                <p className="text-[10px] text-[#8E8E93] mt-1">
                  Associate customer ticket (e.g. TKT-2026-35442) with incident #{selectedIncidentDetail.incidentReference}
                </p>
              </div>

              {linkTicketError && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {linkTicketError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setLinkTicketOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={incidentActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#007AFF] px-4 py-1.5 font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50"
                >
                  {incidentActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                  <span>Link Ticket</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // ── Render Financial Disputes & Reversals Console ──
  const renderDisputes = () => (
    <div className="space-y-4" data-component="dispute-register">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#1D1D1F] sm:text-lg">
              Financial Dispute Register & Reversals
            </h2>
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              {disputes.filter((d) => d.status !== 'Approved' && d.status !== 'Declined' && d.status !== 'Closed').length} Active Claims
            </span>
          </div>
          <p className="text-xs text-[#6E6E73] mt-0.5">
            Payment duplicates, card chargebacks, gateway audit logs, and automated wallet reversals
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchDisputes()}
            disabled={loadingDisputes}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-black/[0.08] bg-white px-3 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loadingDisputes && 'animate-spin text-[#007AFF]')} />
            <span>Sync Disputes</span>
          </button>
        </div>
      </div>

      {/* Main Split Section */}
      <section className="overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] lg:grid lg:min-h-[620px] lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left: Dispute Queue List */}
        <div className={cn('flex flex-col border-b border-black/[0.06] lg:border-b-0 lg:border-r bg-white', mobileDisputeDetailOpen ? 'hidden lg:flex' : 'flex')}>
          <div className="p-3 border-b border-black/[0.06] space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8E8E93]" />
              <input
                type="search"
                value={disputeSearch}
                onChange={(e) => setDisputeSearch(e.target.value)}
                placeholder="Search reference, customer, type..."
                className="min-h-8 w-full rounded-md border border-black/[0.08] bg-[#F5F5F7] pl-8 pr-3 text-xs outline-none focus:border-[#007AFF] focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="dispute-status-filter" className="text-[11px] font-bold text-[#6E6E73] shrink-0">Status:</label>
              <div className="relative flex-1">
                <select
                  id="dispute-status-filter"
                  value={disputeFilter}
                  onChange={(e) => setDisputeFilter(e.target.value)}
                  className="min-h-8 w-full cursor-pointer appearance-none rounded-md border border-black/[0.08] bg-[#F5F5F7] pl-3 pr-8 text-xs font-semibold text-[#1D1D1F] outline-none hover:bg-white focus:border-[#007AFF] focus:bg-white transition"
                >
                  <option value="All">All Disputes ({disputes.length})</option>
                  <option value="Opened">Opened</option>
                  <option value="EvidenceReview">Evidence Review</option>
                  <option value="MoreInfo">More Info</option>
                  <option value="Approved">Approved</option>
                  <option value="Declined">Declined</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[#8E8E93]" />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[540px]">
            {loadingDisputes ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-[#6E6E73]">
                <Loader2 className="h-4 w-4 animate-spin text-[#007AFF]" />
                <span>Loading financial disputes...</span>
              </div>
            ) : visibleDisputes.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8E8E93]">
                <ShieldAlert className="h-6 w-6 mx-auto text-[#8E8E93]/60 mb-2" />
                <p className="font-bold text-[#1D1D1F]">No dispute cases found</p>
                <p className="text-[11px] mt-0.5">Payment ledgers are fully reconciled.</p>
              </div>
            ) : (
              visibleDisputes.map((dsp) => {
                const isSelected = dsp.disputeId === selectedDisputeId;
                const isApproved = dsp.status === 'Approved';
                const isDeclined = dsp.status === 'Declined';

                return (
                  <button
                    key={dsp.disputeId}
                    type="button"
                    onClick={() => {
                      setSelectedDisputeId(dsp.disputeId);
                      setSelectedDisputeDetail(dsp);
                      setMobileDisputeDetailOpen(true);
                    }}
                    className={cn(
                      'w-full cursor-pointer rounded-md border p-3 text-left transition-all relative',
                      isSelected
                        ? 'border-[#007AFF]/40 bg-blue-50/50 shadow-xs ring-1 ring-[#007AFF]/20'
                        : 'border-transparent hover:border-black/[0.06] hover:bg-[#F5F5F7]/70'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-[#007AFF]">{dsp.disputeReference}</span>
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.2 text-[9px] font-bold',
                            isApproved
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isDeclined
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          )}
                        >
                          {dsp.status}
                        </span>
                        {dsp.amount > 0 && (
                          <span className="font-bold text-[10px] text-[#1D1D1F]">
                            {dsp.currency} {dsp.amount.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="mt-1.5 text-xs font-bold text-[#1D1D1F] line-clamp-1">{dsp.disputeType}</h4>
                    <p className="text-[11px] text-[#6E6E73] line-clamp-1">{dsp.reason || 'No description provided'}</p>

                    <div className="mt-1 flex items-center justify-between text-[10px] text-[#8E8E93]">
                      <span className="truncate">{dsp.customerName}</span>
                      <span className="font-medium text-[9px] shrink-0">{formatMsgDate(dsp.createdAt)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Full Dispute Case Details */}
        <div className={cn('flex flex-col bg-white', mobileDisputeDetailOpen ? 'flex' : 'hidden lg:flex')}>
          {!selectedDisputeDetail ? (
            <div className="flex min-h-[400px] flex-1 flex-col items-center justify-center text-center p-8 text-xs text-[#8E8E93]">
              <ShieldAlert className="h-10 w-10 text-[#8E8E93]/50 mb-2" />
              <p className="font-bold text-sm text-[#1D1D1F]">Select a dispute case</p>
              <p className="text-xs text-[#6E6E73] mt-1 max-w-xs">
                Review payment duplicate claims, examine uploaded bank receipts, verify gateway logs, and execute financial reversals.
              </p>
            </div>
          ) : (
            <div className="p-4 sm:p-5 space-y-4">
              {/* Dispute Header: Identity & Actions Row + Title Row */}
              <div className="border-b border-slate-100 pb-3 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMobileDisputeDetailOpen(false)}
                      className="cursor-pointer rounded-md p-1.5 text-[#0F172A] hover:bg-slate-100 lg:hidden min-h-[30px] min-w-[30px] flex items-center justify-center shrink-0 border border-slate-200 mr-1"
                      aria-label="Back to disputes list"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <span className="font-mono text-xs font-bold text-[#007AFF]">
                      {selectedDisputeDetail.disputeReference}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                      {selectedDisputeDetail.status}
                    </span>
                    <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                      {selectedDisputeDetail.disputeType}
                    </span>
                    {selectedDisputeDetail.amount > 0 && (
                      <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        {selectedDisputeDetail.currency} {selectedDisputeDetail.amount.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Right: Actions Toolbar */}
                  <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                    <button
                      type="button"
                      onClick={() => setShowDisputeDetails((prev) => !prev)}
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition select-none',
                        showDisputeDetails
                          ? 'bg-[#0F172A] text-white shadow-2xs'
                          : 'bg-slate-100 text-[#475569] hover:bg-slate-200/80 hover:text-[#0F172A]'
                      )}
                    >
                      <Info className="h-3.5 w-3.5" />
                      <span>{showDisputeDetails ? 'Hide Info' : 'Case Info'}</span>
                      {showDisputeDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {selectedDisputeDetail.status !== 'Approved' && selectedDisputeDetail.status !== 'Declined' && (
                      <button
                        type="button"
                        onClick={() => {
                          setDspApprovedAmount(String(selectedDisputeDetail.amount || '15.00'));
                          setDecisionDisputeOpen(true);
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-[0.98]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Finalize Decision</span>
                      </button>
                    )}

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setDisputeActionMenuOpen((prev) => !prev)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 shadow-2xs transition"
                      >
                        <span>Actions</span>
                        <ChevronDown className="h-3 w-3 text-slate-400" />
                      </button>

                      {disputeActionMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setDisputeActionMenuOpen(false)}
                          />
                          <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-md border border-black/[0.08] bg-white p-1 shadow-lg divide-y divide-black/[0.04] text-xs">
                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setDisputeActionMenuOpen(false);
                                  setAssignDisputeOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded cursor-pointer"
                              >
                                <Users className="h-3.5 w-3.5 text-[#007AFF]" />
                                <span>Assign Case...</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setDisputeActionMenuOpen(false);
                                  setRequestEvidenceOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-purple-700 hover:bg-purple-50 rounded cursor-pointer"
                              >
                                <Send className="h-3.5 w-3.5 text-purple-600" />
                                <span>Request Evidence...</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setDisputeActionMenuOpen(false);
                                  setUploadDisputeEvidenceOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded cursor-pointer"
                              >
                                <UploadCloud className="h-3.5 w-3.5 text-[#007AFF]" />
                                <span>Upload Proof...</span>
                              </button>
                            </div>

                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setDisputeActionMenuOpen(false);
                                  setLinkTicketDisputeOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded cursor-pointer"
                              >
                                <Link2 className="h-3.5 w-3.5 text-[#007AFF]" />
                                <span>Link Support Ticket...</span>
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#0F172A] sm:text-lg">
                    {selectedDisputeDetail.reason || 'Dispute Investigation Case'}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Claimant: {selectedDisputeDetail.customerName} ({selectedDisputeDetail.customerEmail}) · Logged {formatDateTime(selectedDisputeDetail.createdAt)}
                  </p>
                </div>
              </div>

              {/* Collapsible Dispute Metadata Drawer */}
              {showDisputeDetails && (
                <div className="grid gap-3 sm:grid-cols-2 text-xs bg-slate-50/80 p-3.5 rounded-md border border-slate-200/70 animate-in fade-in-0 duration-150">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Case & Customer Metadata
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <p className="text-[9px] text-slate-400">Customer User ID</p>
                        <p className="font-semibold text-slate-800">{selectedDisputeDetail.customerUserId}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400">Booking Reference</p>
                        <p className="font-mono text-[10px] text-[#007AFF]">
                          {selectedDisputeDetail.bookingId ? `Booking #${selectedDisputeDetail.bookingId}` : 'None'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400">Linked Ticket</p>
                        <p className="font-mono text-[10px] text-[#007AFF]">
                          {selectedDisputeDetail.ticketId ? `Ticket #${selectedDisputeDetail.ticketId}` : 'Unlinked'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400">Assigned Officer</p>
                        <p className="font-semibold text-slate-800">
                          {selectedDisputeDetail.assignedUserName || 'Unassigned'} ({selectedDisputeDetail.assignedTeam || 'Finance'})
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Settlement & Decision Status
                    </span>
                    {selectedDisputeDetail.decision ? (
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">Decision:</span>
                          <span className={cn('font-bold', selectedDisputeDetail.decision === 'ApproveReversal' ? 'text-emerald-700' : 'text-rose-700')}>
                            {selectedDisputeDetail.decision}
                          </span>
                        </div>
                        {selectedDisputeDetail.decisionReason && (
                          <p className="text-slate-600">{selectedDisputeDetail.decisionReason}</p>
                        )}
                        <p className="text-[10px] text-slate-400">
                          Decided by {selectedDisputeDetail.decidedByUserName || 'Finance'} at {formatDateTime(selectedDisputeDetail.decidedAt)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        Investigation in progress. Awaiting proof verification before executing financial reversal or settlement payout.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Evidence Files Gallery */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <FileSearch className="h-4 w-4 text-[#007AFF]" />
                    <span>Evidence Audit Register ({selectedDisputeDetail.evidences?.length || 0})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadDisputeEvidenceOpen(true)}
                    className="text-xs font-semibold text-[#007AFF] hover:underline cursor-pointer"
                  >
                    + Upload Proof File
                  </button>
                </div>

                {(!selectedDisputeDetail.evidences || selectedDisputeDetail.evidences.length === 0) ? (
                  <p className="text-xs text-slate-400 italic py-1">
                    No evidence files uploaded yet. Click &ldquo;Request Evidence&rdquo; to notify the customer.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedDisputeDetail.evidences.map((ev) => (
                      <div
                        key={ev.disputeEvidenceId}
                        className="flex flex-col justify-between p-3 rounded-md border border-slate-100 bg-slate-50/50 hover:bg-slate-50 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-[#007AFF] shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-slate-800 truncate">{ev.fileName}</p>
                              <span className="text-[9px] text-slate-400">{ev.evidenceType}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.2 text-[9px] font-semibold',
                                ev.uploadedRole === 'Admin' ? 'bg-blue-50 text-[#007AFF]' : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {ev.uploadedRole}
                            </span>
                            {ev.isVerified && (
                              <span className="rounded bg-emerald-50 px-1 py-0.2 text-[8px] font-bold text-emerald-700">
                                Verified
                              </span>
                            )}
                          </div>
                        </div>

                        {ev.description && (
                          <p className="text-[10px] text-slate-500 line-clamp-2">{ev.description}</p>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[9px] text-slate-400">
                          <span>{formatDateTime(ev.createdAt)}</span>
                          {ev.fileUrl && (
                            <a
                              href={ev.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-[#007AFF] hover:underline flex items-center gap-1"
                            >
                              <span>View File</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Audit Timeline */}
              {selectedDisputeDetail.auditTimeline && selectedDisputeDetail.auditTimeline.length > 0 && (
                <div className="pt-2 border-t border-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowDisputeAudit((prev) => !prev)}
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-black/[0.06] bg-slate-50/70 hover:bg-slate-100/80 px-3.5 py-2.5 text-left transition select-none"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-[#007AFF]">
                        <History className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-bold text-slate-800 text-xs">
                        Dispute Audit Timeline ({selectedDisputeDetail.auditTimeline.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#6E6E73]">
                      <span className="text-[11px] font-medium">
                        {showDisputeAudit ? 'Hide timeline' : 'View history'}
                      </span>
                      {showDisputeAudit ? (
                        <ChevronUp className="h-4 w-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      )}
                    </div>
                  </button>

                  {showDisputeAudit && (
                    <div className="mt-3 relative border-l-2 border-slate-200 ml-2.5 space-y-2.5 pl-3.5 pt-1 transition-all">
                      {selectedDisputeDetail.auditTimeline.map((ev, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-[#007AFF] ring-4 ring-white" />
                          <div className="p-2.5 rounded-md bg-white border border-slate-200/80 shadow-2xs">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-[#007AFF]">{ev.action}</span>
                              <span className="text-slate-400">{formatDateTime(ev.timestamp)}</span>
                            </div>
                            <p className="text-xs text-slate-700 mt-0.5 leading-snug">{ev.detail}</p>
                            <div className="mt-1 flex items-center gap-1 text-[9px] text-slate-400">
                              <span>Actor:</span>
                              <span className="font-medium text-slate-600">{ev.actorName} ({ev.actorRole})</span>
                              {ev.newState && <span>· State: {ev.newState}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Assign Dispute Modal ── */}
      {assignDisputeOpen && selectedDisputeDetail && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#007AFF]" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Assign Dispute Case</h3>
              </div>
              <button type="button" onClick={() => setAssignDisputeOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAssignDispute} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Operational Team *</label>
                <select
                  value={dspAssignTeam}
                  onChange={(e) => setDspAssignTeam(e.target.value)}
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] bg-white"
                >
                  <option value="Finance">Finance & Settlements</option>
                  <option value="Payments">Payments Support</option>
                  <option value="TrustSafety">Trust & Safety</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Assignee User ID *</label>
                <input
                  type="number"
                  value={dspAssignUserId}
                  onChange={(e) => setDspAssignUserId(e.target.value)}
                  required
                  placeholder="e.g. 8"
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Case Status</label>
                <select
                  value={dspAssignStatus}
                  onChange={(e) => setDspAssignStatus(e.target.value)}
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] bg-white font-semibold"
                >
                  <option value="EvidenceReview">Evidence Review</option>
                  <option value="MoreInfo">Waiting for More Info</option>
                  <option value="Opened">Opened</option>
                </select>
              </div>

              {dspAssignError && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {dspAssignError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setAssignDisputeOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#007AFF] px-4 py-1.5 font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50"
                >
                  {disputeActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                  <span>Assign Case</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Request Customer Evidence Modal ── */}
      {requestEvidenceOpen && selectedDisputeDetail && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-purple-600" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Request Customer Evidence</h3>
              </div>
              <button type="button" onClick={() => setRequestEvidenceOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRequestEvidence} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Prompt / Message to Customer *</label>
                <textarea
                  rows={3}
                  value={dspReqMessage}
                  onChange={(e) => setDspReqMessage(e.target.value)}
                  required
                  placeholder="e.g. Please upload bank transaction screenshot showing deduction."
                  className="w-full rounded-md border border-black/[0.08] p-2.5 outline-none focus:border-[#007AFF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Deadline (Days)</label>
                <input
                  type="number"
                  value={dspReqDays}
                  onChange={(e) => setDspReqDays(e.target.value)}
                  min="1"
                  max="30"
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF]"
                />
              </div>

              {dspReqError && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {dspReqError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setRequestEvidenceOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-4 py-1.5 font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {disputeActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span>Send Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Admin Upload Evidence Modal ── */}
      {uploadDisputeEvidenceOpen && selectedDisputeDetail && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-[#007AFF]" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Upload Audit Proof</h3>
              </div>
              <button type="button" onClick={() => setUploadDisputeEvidenceOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadDisputeEvidence} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Evidence Type *</label>
                <select
                  value={dspEvType}
                  onChange={(e) => setDspEvType(e.target.value)}
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] bg-white font-semibold"
                >
                  <option value="GatewayLog">Gateway Log (Stripe / Bank Trace)</option>
                  <option value="BankReceipt">Bank Receipt / Statement</option>
                  <option value="LedgerAudit">Internal Ledger Audit</option>
                  <option value="Other">Other Document</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Document File *</label>
                <input
                  type="file"
                  onChange={(e) => setDspEvFile(e.target.files?.[0] || null)}
                  required
                  className="w-full rounded-md border border-black/[0.08] p-2 text-xs outline-none focus:border-[#007AFF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={dspEvNotes}
                  onChange={(e) => setDspEvNotes(e.target.value)}
                  placeholder="e.g. Stripe webhook log showing charge status."
                  className="w-full rounded-md border border-black/[0.08] p-2.5 outline-none focus:border-[#007AFF]"
                />
              </div>

              {dspEvError && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {dspEvError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setUploadDisputeEvidenceOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeActionLoading || !dspEvFile}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#007AFF] px-4 py-1.5 font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50"
                >
                  {disputeActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  <span>Upload Evidence</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Finalize Dispute Decision Modal ── */}
      {decisionDisputeOpen && selectedDisputeDetail && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Finalize Dispute Decision</h3>
              </div>
              <button type="button" onClick={() => setDecisionDisputeOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFinalizeDecision} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Decision Action *</label>
                <select
                  value={dspDecision}
                  onChange={(e) => setDspDecision(e.target.value)}
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] bg-white font-bold"
                >
                  <option value="ApproveReversal">Approve Financial Reversal (Refund)</option>
                  <option value="DeclineDispute">Decline Dispute (Valid Charge)</option>
                </select>
              </div>

              {dspDecision === 'ApproveReversal' && (
                <div>
                  <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Approved Reversal Amount (MYR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={dspApprovedAmount}
                    onChange={(e) => setDspApprovedAmount(e.target.value)}
                    required
                    className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Decision Justification *</label>
                <textarea
                  rows={3}
                  value={dspDecisionReason}
                  onChange={(e) => setDspDecisionReason(e.target.value)}
                  required
                  placeholder="e.g. Verified double deduction on bank record"
                  className="w-full rounded-md border border-black/[0.08] p-2.5 outline-none focus:border-[#007AFF]"
                />
              </div>

              {dspDecisionError && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {dspDecisionError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setDecisionDisputeOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {disputeActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>Execute Decision</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Link Ticket to Dispute Modal ── */}
      {linkTicketDisputeOpen && selectedDisputeDetail && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-[#007AFF]" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Link Ticket to Dispute</h3>
              </div>
              <button type="button" onClick={() => setLinkTicketDisputeOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleLinkTicketToDispute} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Ticket Reference or ID *</label>
                <input
                  type="text"
                  value={dspLinkTicketId}
                  onChange={(e) => setDspLinkTicketId(e.target.value)}
                  required
                  placeholder="e.g. TKT-2026-35442 or 8"
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] font-mono text-xs"
                />
                <p className="text-[10px] text-[#8E8E93] mt-1">
                  Connect ticket to dispute #{selectedDisputeDetail.disputeReference}
                </p>
              </div>

              {dspLinkTicketError && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {dspLinkTicketError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setLinkTicketDisputeOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#007AFF] px-4 py-1.5 font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50"
                >
                  {disputeActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                  <span>Link Ticket</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // ── Render On-Call Escalation Matrix ──
  const renderOnCall = () => {
    const policy = onCallStatus?.policy;
    const primary = onCallStatus?.primaryResponder;
    const backup = onCallStatus?.backupResponder;
    const supervisor = onCallStatus?.supervisor;
    const manager = onCallStatus?.operationsManager;

    return (
      <div className="space-y-5" data-component="admin-on-call">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-[#1D1D1F]">
                24/7 On-Call Escalation & Alert Management
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200/60">
                Live Roster
              </span>
            </div>
            <p className="text-xs text-[#6E6E73] mt-0.5">
              Automated multi-tier dispatch, responder failover intervals, and alert transmission verification
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchOnCallStatus()}
              disabled={loadingOnCall}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loadingOnCall && 'animate-spin text-[#007AFF]')} />
              <span>Refresh Roster</span>
            </button>
            <button
              type="button"
              onClick={() => setTestAlertOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] shadow-2xs"
            >
              <Bell className="h-3.5 w-3.5 text-[#64748B]" />
              <span>Test Alert Dispatch</span>
            </button>
            <button
              type="button"
              onClick={() => setEditPolicyOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#007AFF] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6] shadow-xs"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Configure Policy Delays</span>
            </button>
          </div>
        </div>

        {/* Active Shift Header Banner */}
        <section className="rounded-lg border border-black/[0.06] bg-white p-4 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                <BellRing className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#1D1D1F]">
                    {onCallStatus?.shiftName || '24/7 Primary Shift'}
                  </h3>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200/60 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active Shift
                  </span>
                </div>
                <p className="text-xs text-[#6E6E73] mt-0.5">
                  Shift Window: {formatDateTime(onCallStatus?.shiftStart)} &mdash; {formatDateTime(onCallStatus?.shiftEnd)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Active Channels:</span>
              {(onCallStatus?.activeChannels || ['Push', 'SMS', 'Phone', 'Email']).map((ch) => (
                <span
                  key={ch}
                  className="rounded-md bg-slate-50 border border-black/[0.06] px-2 py-0.5 text-[10px] font-medium text-[#334155]"
                >
                  {ch}
                </span>
              ))}
              <span className="rounded-md bg-slate-100 border border-slate-200/60 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Auto-Escalation: {policy?.autoEscalateEnabled !== false ? 'Enforced' : 'Disabled'}
              </span>
            </div>
          </div>
        </section>

        {/* Recent Test Alert Feedback Banner */}
        {testAlertResult && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5 space-y-1 text-xs">
            <div className="flex items-center justify-between font-bold text-[#0F172A]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Test Notification Dispatched Successfully</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">{formatDateTime(testAlertResult.timestamp)}</span>
            </div>
            <p className="text-slate-700">
              Provider confirmed delivery to <strong>{testAlertResult.recipient}</strong> over <strong>{testAlertResult.channel}</strong> channel.
            </p>
            <p className="text-[11px] text-slate-500 italic">{testAlertResult.detail}</p>
          </div>
        )}

        {/* Four-Tier Responder Hierarchy Cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {/* L0 Primary */}
          <div className="flex flex-col justify-between rounded-lg border border-black/[0.06] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200/60">
                  Tier 1 · Primary Lead
                </span>
                <span className="text-[10px] text-[#8E8E93] font-mono">L0</span>
              </div>
              <h4 className="mt-2 text-sm font-bold text-[#1D1D1F]">{primary?.name || 'Unassigned'}</h4>
              <p className="text-xs text-[#6E6E73] truncate mt-0.5">{primary?.email || 'oncall@parkjom.com'}</p>
              <p className="text-xs font-mono text-[#1D1D1F] mt-1">{primary?.phone || '011-16326494'}</p>
            </div>
            <div className="pt-2 border-t border-black/[0.04] text-[10px] text-[#64748B] font-mono flex items-center justify-between">
              <span>Immediate Triage</span>
              <span>0m delay</span>
            </div>
          </div>

          {/* L1 Backup */}
          <div className="flex flex-col justify-between rounded-lg border border-black/[0.06] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200/60">
                  Tier 2 · Backup Responder
                </span>
                <span className="text-[10px] text-[#8E8E93] font-mono">L1</span>
              </div>
              <h4 className="mt-2 text-sm font-bold text-[#1D1D1F]">{backup?.name || 'Standby Backup Responder'}</h4>
              <p className="text-xs text-[#6E6E73] truncate mt-0.5">{backup?.email || 'backup-duty@parkjom.com'}</p>
              <p className="text-xs font-mono text-[#1D1D1F] mt-1">{backup?.phone || 'Automated Failover'}</p>
            </div>
            <div className="pt-2 border-t border-black/[0.04] text-[10px] text-[#64748B] font-mono flex items-center justify-between">
              <span>P0 Timeout Trigger</span>
              <span>+{policy?.p0BackupDelayMinutes ?? 2}m</span>
            </div>
          </div>

          {/* L2 Supervisor */}
          <div className="flex flex-col justify-between rounded-lg border border-black/[0.06] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200/60">
                  Tier 3 · Supervisor
                </span>
                <span className="text-[10px] text-[#8E8E93] font-mono">L2</span>
              </div>
              <h4 className="mt-2 text-sm font-bold text-[#1D1D1F]">{supervisor?.name || 'Operations Supervisor'}</h4>
              <p className="text-xs text-[#6E6E73] truncate mt-0.5">{supervisor?.email || 'supervisor@parkjom.com'}</p>
              <p className="text-xs font-mono text-[#1D1D1F] mt-1">{supervisor?.phone || 'Multi-Channel Alert'}</p>
            </div>
            <div className="pt-2 border-t border-black/[0.04] text-[10px] text-[#64748B] font-mono flex items-center justify-between">
              <span>P0 Timeout Trigger</span>
              <span>+{policy?.p0SupervisorDelayMinutes ?? 5}m</span>
            </div>
          </div>

          {/* L3 Operations Manager */}
          <div className="flex flex-col justify-between rounded-lg border border-black/[0.06] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200/60">
                  Tier 4 · Ops Manager
                </span>
                <span className="text-[10px] text-[#8E8E93] font-mono">L3</span>
              </div>
              <h4 className="mt-2 text-sm font-bold text-[#1D1D1F]">{manager?.name || 'Head of Operations'}</h4>
              <p className="text-xs text-[#6E6E73] truncate mt-0.5">{manager?.email || 'ops-director@parkjom.com'}</p>
              <p className="text-xs font-mono text-[#1D1D1F] mt-1">{manager?.phone || 'Executive Escalation'}</p>
            </div>
            <div className="pt-2 border-t border-black/[0.04] text-[10px] text-[#64748B] font-mono flex items-center justify-between">
              <span>P0 Timeout Trigger</span>
              <span>+{policy?.p0ManagerDelayMinutes ?? 15}m</span>
            </div>
          </div>
        </div>

        {/* Live Escalation Policy Matrix Table */}
        <section className="rounded-lg border border-black/[0.06] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-3">
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#1D1D1F]">Escalation Timeout Rules & Fallback Policy</h3>
              <p className="text-xs text-[#6E6E73]">Configured timeout delays before incident escalates to higher staff tiers</p>
            </div>
            <button
              type="button"
              onClick={() => setEditPolicyOpen(true)}
              className="text-xs font-semibold text-[#007AFF] hover:underline cursor-pointer"
            >
              Edit Delays &rarr;
            </button>
          </div>

          {/* Mobile Card List (sm:hidden) */}
          <div className="space-y-2.5 sm:hidden">
            {[
              {
                tier: 'Level 0',
                role: 'Initial Dispatch',
                responder: primary?.name || 'Primary Responder',
                p0: 'Immediate (0m)',
                p1: 'Immediate (0m)',
                method: 'Push + SMS',
                badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              },
              {
                tier: 'Level 1',
                role: 'Backup Escalation',
                responder: backup?.name || 'Secondary On-Call',
                p0: `+${policy?.p0BackupDelayMinutes ?? 2} mins`,
                p1: `+${policy?.p1BackupDelayMinutes ?? 5} mins`,
                method: 'Push + SMS + Phone',
                badge: 'bg-blue-50 text-[#007AFF] border-blue-200',
              },
              {
                tier: 'Level 2',
                role: 'Supervisor Escalation',
                responder: supervisor?.name || 'Operations Supervisor',
                p0: `+${policy?.p0SupervisorDelayMinutes ?? 5} mins`,
                p1: `+${policy?.p1SupervisorDelayMinutes ?? 15} mins`,
                method: 'Push + SMS + Phone + Email',
                badge: 'bg-amber-50 text-amber-800 border-amber-200',
              },
              {
                tier: 'Level 3',
                role: 'Management Escalation',
                responder: manager?.name || 'Head of Operations',
                p0: `+${policy?.p0ManagerDelayMinutes ?? 15} mins`,
                p1: `+${policy?.p1ManagerDelayMinutes ?? 30} mins`,
                method: 'All Broadcast Channels',
                badge: 'bg-purple-50 text-purple-700 border-purple-200',
              },
            ].map((item, idx) => (
              <div key={idx} className="rounded-lg border border-black/[0.06] bg-[#FAFBFD] p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold border', item.badge)}>
                      {item.tier}
                    </span>
                    <span className="font-bold text-[#1D1D1F] text-xs">{item.role}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#6E6E73]">{item.method}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-black/[0.04]">
                  <span className="text-[#6E6E73]">
                    Target: <strong className="text-[#1D1D1F] font-semibold">{item.responder}</strong>
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span className="text-rose-600 font-semibold">P0: {item.p0}</span>
                    <span className="text-[#007AFF] font-semibold">P1: {item.p1}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[580px] text-left text-xs">
              <thead>
                <tr className="border-b border-black/[0.06] text-[10px] uppercase font-bold text-[#8E8E93]">
                  <th className="pb-2">Escalation Tier</th>
                  <th className="pb-2">Target Responder</th>
                  <th className="pb-2">P0 Emergency Timeout</th>
                  <th className="pb-2">P1 High Priority Timeout</th>
                  <th className="pb-2">Notification Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                <tr>
                  <td className="py-2.5 font-bold text-[#1D1D1F]">Level 0 (Initial Dispatch)</td>
                  <td className="py-2.5 text-[#6E6E73]">{primary?.name || 'Primary Responder'}</td>
                  <td className="py-2.5 font-mono text-[#0F172A]">Immediate (0 min)</td>
                  <td className="py-2.5 font-mono text-[#0F172A]">Immediate (0 min)</td>
                  <td className="py-2.5 font-mono text-[11px] text-[#6E6E73]">Push + SMS</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-bold text-[#1D1D1F]">Level 1 (Backup Escalation)</td>
                  <td className="py-2.5 text-[#6E6E73]">{backup?.name || 'Secondary On-Call'}</td>
                  <td className="py-2.5 font-mono text-[#0F172A]">{policy?.p0BackupDelayMinutes ?? 2} minutes</td>
                  <td className="py-2.5 font-mono text-[#0F172A]">{policy?.p1BackupDelayMinutes ?? 5} minutes</td>
                  <td className="py-2.5 font-mono text-[11px] text-[#6E6E73]">Push + SMS + Phone</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-bold text-[#1D1D1F]">Level 2 (Supervisor Escalation)</td>
                  <td className="py-2.5 text-[#6E6E73]">{supervisor?.name || 'Operations Supervisor'}</td>
                  <td className="py-2.5 font-mono text-[#0F172A]">{policy?.p0SupervisorDelayMinutes ?? 5} minutes</td>
                  <td className="py-2.5 font-mono text-[#0F172A]">{policy?.p1SupervisorDelayMinutes ?? 15} minutes</td>
                  <td className="py-2.5 font-mono text-[11px] text-[#6E6E73]">Push + SMS + Phone + Email</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-bold text-[#1D1D1F]">Level 3 (Management Escalation)</td>
                  <td className="py-2.5 text-[#6E6E73]">{manager?.name || 'Head of Operations'}</td>
                  <td className="py-2.5 font-mono text-[#0F172A]">{policy?.p0ManagerDelayMinutes ?? 15} minutes</td>
                  <td className="py-2.5 font-mono text-[#0F172A]">{policy?.p1ManagerDelayMinutes ?? 30} minutes</td>
                  <td className="py-2.5 font-mono text-[11px] text-[#6E6E73]">All Broadcast Channels</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Test Alert Notification Modal ── */}
        {testAlertOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-[#1D1D1F]">Test On-Call Alert Notification</h3>
                </div>
                <button type="button" onClick={() => setTestAlertOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleTestAlert} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Dispatch Channel *</label>
                  <select
                    value={testAlertChannel}
                    onChange={(e) => setTestAlertChannel(e.target.value)}
                    className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] bg-white font-semibold"
                  >
                    <option value="Push">Push Notification</option>
                    <option value="SMS">SMS Text Alert</option>
                    <option value="Phone">Automated Phone Call</option>
                    <option value="Email">Emergency Email Broadcast</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Target User ID *</label>
                  <input
                    type="number"
                    value={testAlertUserId}
                    onChange={(e) => setTestAlertUserId(Number(e.target.value))}
                    required
                    className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF]"
                  />
                  <p className="text-[10px] text-[#8E8E93] mt-1">
                    Enter the staff responder user ID to dispatch this simulated alert to.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Alert Message *</label>
                  <textarea
                    rows={2}
                    value={testAlertMessage}
                    onChange={(e) => setTestAlertMessage(e.target.value)}
                    required
                    className="w-full rounded-md border border-black/[0.08] p-2.5 outline-none focus:border-[#007AFF]"
                  />
                </div>

                {testAlertError && (
                  <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                    {testAlertError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                  <button
                    type="button"
                    onClick={() => setTestAlertOpen(false)}
                    className="rounded-md border border-black/[0.08] px-3.5 py-1.5 font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={testingAlert}
                    className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-4 py-1.5 font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {testingAlert ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span>Dispatch Test Alert</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Configure Escalation Policy Modal ── */}
        {editPolicyOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-[#007AFF]" />
                  <h3 className="text-sm font-bold text-[#1D1D1F]">Configure Escalation Delays & Policy</h3>
                </div>
                <button type="button" onClick={() => setEditPolicyOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSavePolicy} className="space-y-4 text-xs">
                {/* P0 Delays */}
                <div className="rounded-md border border-rose-200/80 bg-rose-50/30 p-3.5 space-y-2.5">
                  <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">
                    P0 Emergency Escalation Delays (Minutes)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#1D1D1F] mb-1">L1 Backup Delay</label>
                      <input
                        type="number"
                        min="1"
                        value={p0BackupDelay}
                        onChange={(e) => setP0BackupDelay(Number(e.target.value))}
                        required
                        className="w-full rounded-lg border border-black/[0.08] p-2 bg-white outline-none focus:border-[#007AFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#1D1D1F] mb-1">L2 Supervisor</label>
                      <input
                        type="number"
                        min="1"
                        value={p0SupervisorDelay}
                        onChange={(e) => setP0SupervisorDelay(Number(e.target.value))}
                        required
                        className="w-full rounded-lg border border-black/[0.08] p-2 bg-white outline-none focus:border-[#007AFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#1D1D1F] mb-1">L3 Manager</label>
                      <input
                        type="number"
                        min="1"
                        value={p0ManagerDelay}
                        onChange={(e) => setP0ManagerDelay(Number(e.target.value))}
                        required
                        className="w-full rounded-lg border border-black/[0.08] p-2 bg-white outline-none focus:border-[#007AFF]"
                      />
                    </div>
                  </div>
                </div>

                {/* P1 Delays */}
                <div className="rounded-md border border-amber-200/80 bg-amber-50/30 p-3.5 space-y-2.5">
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                    P1 High Priority Escalation Delays (Minutes)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#1D1D1F] mb-1">L1 Backup Delay</label>
                      <input
                        type="number"
                        min="1"
                        value={p1BackupDelay}
                        onChange={(e) => setP1BackupDelay(Number(e.target.value))}
                        required
                        className="w-full rounded-lg border border-black/[0.08] p-2 bg-white outline-none focus:border-[#007AFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#1D1D1F] mb-1">L2 Supervisor</label>
                      <input
                        type="number"
                        min="1"
                        value={p1SupervisorDelay}
                        onChange={(e) => setP1SupervisorDelay(Number(e.target.value))}
                        required
                        className="w-full rounded-lg border border-black/[0.08] p-2 bg-white outline-none focus:border-[#007AFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#1D1D1F] mb-1">L3 Manager</label>
                      <input
                        type="number"
                        min="1"
                        value={p1ManagerDelay}
                        onChange={(e) => setP1ManagerDelay(Number(e.target.value))}
                        required
                        className="w-full rounded-lg border border-black/[0.08] p-2 bg-white outline-none focus:border-[#007AFF]"
                      />
                    </div>
                  </div>
                </div>

                {/* Enabled Channels & Auto Escalation */}
                <div>
                  <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1.5">Enabled Notification Channels</label>
                  <div className="flex flex-wrap gap-2">
                    {['Push', 'SMS', 'Phone', 'Email'].map((channel) => {
                      const isChecked = policyChannels.includes(channel);
                      return (
                        <label
                          key={channel}
                          className={cn(
                            'flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
                            isChecked ? 'border-[#007AFF] bg-blue-50 text-[#007AFF]' : 'border-black/[0.08] bg-white text-[#6E6E73]'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPolicyChannels([...policyChannels, channel]);
                              } else {
                                setPolicyChannels(policyChannels.filter((c) => c !== channel));
                              }
                            }}
                            className="h-3 w-3 rounded text-[#007AFF]"
                          />
                          <span>{channel}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="font-bold text-xs text-[#1D1D1F]">Automated Escalation Engine</p>
                    <p className="text-[10px] text-[#6E6E73]">Automatically bump unacknowledged incidents to the next tier</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoEscalateEnabled}
                    onChange={(e) => setAutoEscalateEnabled(e.target.checked)}
                    className="h-4 w-4 rounded text-[#007AFF]"
                  />
                </div>

                {policyError && (
                  <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                    {policyError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-black/[0.06]">
                  <button
                    type="button"
                    onClick={() => setEditPolicyOpen(false)}
                    className="rounded-md border border-black/[0.08] px-3.5 py-1.5 font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPolicy}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#007AFF] px-4 py-1.5 font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50"
                  >
                    {savingPolicy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    <span>Save Escalation Policy</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Render Audit Log Event Timeline ──
  const renderAuditLogs = () => {
    const items = auditLogResponse?.items || [];
    const filtered = items.filter((ev) => {
      if (!auditSearch.trim()) return true;
      const q = auditSearch.toLowerCase();
      return (
        ev.objectReference.toLowerCase().includes(q) ||
        ev.action.toLowerCase().includes(q) ||
        ev.actorName.toLowerCase().includes(q) ||
        (ev.detail && ev.detail.toLowerCase().includes(q))
      );
    });

    return (
      <div className="space-y-4" data-component="admin-audit-logs">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-[#1D1D1F]">
                Support & Incident Audit Trail
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-[#1D1D1F]">
                {auditLogResponse?.totalCount || items.length} Total Events
              </span>
            </div>
            <p className="text-xs text-[#6E6E73] mt-0.5">
              Immutable chronological log of ticket actions, incident overrides, on-call alerts, and financial dispute reversals
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchAuditLogs()}
              disabled={loadingAudit}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loadingAudit && 'animate-spin text-[#007AFF]')} />
              <span>Refresh Log</span>
            </button>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="flex flex-col gap-2.5 rounded-lg border border-black/[0.06] bg-white p-3 shadow-[0_2px_12px_rgba(0,0,0,0.02)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <label htmlFor="audit-filter-select" className="text-xs font-bold text-[#6E6E73] shrink-0">Entity Type:</label>
            <div className="relative min-w-[170px]">
              <select
                id="audit-filter-select"
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="min-h-8 w-full cursor-pointer appearance-none rounded-md border border-black/[0.08] bg-[#F5F5F7] pl-3 pr-8 text-xs font-semibold text-[#1D1D1F] outline-none hover:bg-white focus:border-[#007AFF] focus:bg-white transition"
              >
                <option value="All">All Entities</option>
                <option value="Ticket">Ticket Events</option>
                <option value="Incident">Incident Events</option>
                <option value="Dispute">Dispute Events</option>
                <option value="Conversation">Live Conversations</option>
                <option value="OnCall">On-Call Alerts</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[#8E8E93]" />
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#8E8E93]" />
            <input
              type="search"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Search reference, action, user..."
              className="w-full rounded-md border border-black/[0.08] bg-[#F5F5F7] pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[#007AFF] focus:bg-white"
            />
          </div>
        </div>

        {/* Audit Events Stream */}
        <section className="rounded-lg border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
          {loadingAudit ? (
            <div className="flex h-48 items-center justify-center text-xs text-[#8E8E93]">
              <Loader2 className="h-5 w-5 animate-spin text-[#007AFF]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8E8E93]">
              <History className="h-8 w-8 mx-auto text-[#8E8E93]/40 mb-2" />
              <p className="font-bold text-[#1D1D1F]">No audit log events matched</p>
              <p className="text-[11px] mt-0.5">Try clearing filters or check another entity type.</p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.04]">
              {filtered.map((ev) => {
                const isTicket = ev.objectType === 'Ticket';
                const isIncident = ev.objectType === 'Incident';
                const isDispute = ev.objectType === 'Dispute';
                const isOnCall = ev.objectType === 'OnCall';

                return (
                  <div key={ev.auditEventId} className="p-3.5 sm:p-4 hover:bg-[#FAFBFD] transition flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-[#8E8E93]">#{ev.auditEventId}</span>
                        <span
                          className={cn(
                            'rounded-md px-1.5 py-0.2 text-[9px] font-bold border',
                            isTicket && 'bg-blue-50 text-[#007AFF] border-blue-200',
                            isIncident && 'bg-rose-50 text-rose-700 border-rose-200',
                            isDispute && 'bg-amber-50 text-amber-800 border-amber-200',
                            isOnCall && 'bg-purple-50 text-purple-700 border-purple-200',
                            !isTicket && !isIncident && !isDispute && !isOnCall && 'bg-slate-100 text-slate-700 border-slate-200'
                          )}
                        >
                          {ev.objectType}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#1D1D1F]">
                          {ev.objectReference}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-[#1D1D1F]">
                          {ev.action}
                        </span>
                      </div>

                      <span className="text-[10px] text-[#8E8E93] font-mono">
                        {formatDateTime(ev.timestamp)}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-1">
                      <p className="text-[#1D1D1F] text-xs">
                        {ev.detail || `Action performed on ${ev.objectReference}`}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-[#6E6E73] shrink-0">
                        <span>Actor: <strong>{ev.actorName}</strong></span>
                        <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] font-semibold">
                          {ev.actorRole}
                        </span>
                        {(ev.previousState || ev.newState) && (
                          <span className="font-mono text-[10px] text-[#8E8E93]">
                            ({ev.previousState || 'None'} &rarr; {ev.newState || 'Current'})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  };

  return (
    <div className="space-y-4" data-component="admin-support-dashboard">
      {/* Function Sub-Page Top Header (Only shown when viewing a specific function) */}
      {activeView !== 'menu' && (
        <section className="border-b border-black/[0.06] bg-white px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveView('menu')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition active:scale-[0.98]"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-[#007AFF]" />
                <span>Back to Operations Menu</span>
              </button>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#0F172A]">
                  {adminNavigation.find((n) => n.id === activeView)?.label || 'Support Operations'}
                </span>
                {(() => {
                  const curr = adminNavigation.find((n) => n.id === activeView);
                  return typeof curr?.count === 'number' && curr.count > 0 ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-bold text-slate-700 border border-slate-200/60">
                      {curr.count}
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView('menu')}
                className="text-xs font-medium text-[#64748B] hover:text-[#007AFF] transition cursor-pointer"
              >
                All Modules &rarr;
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Floating Notice Toast */}
      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-black/[0.06] bg-white px-3.5 py-2 text-xs font-semibold text-[#1D1D1F] shadow-xs"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-[#34C759]" />
          <span>{notice}</span>
        </div>
      )}

      {/* Dynamic Views */}
      {activeView === 'menu' && renderMenuPage()}
      {activeView === 'command' && renderCommandCenter()}
      {activeView === 'conversations' && renderConversations()}
      {activeView === 'tickets' && ticketWorkspace}
      {activeView === 'incidents' && renderIncidents()}
      {activeView === 'disputes' && renderDisputes()}
      {activeView === 'on-call' && renderOnCall()}
      {activeView === 'audit' && renderAuditLogs()}

      {/* Admin Custom Ticket Creator Modal */}
      {createTicketOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-ticket-title"
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-lg border border-black/[0.08]">
            <div className="flex items-center justify-between border-b border-black/[0.06] p-4">
              <div className="flex items-center gap-2">
                <TicketCheck className="h-4.5 w-4.5 text-[#007AFF]" />
                <h3 id="admin-ticket-title" className="text-sm font-bold text-[#1D1D1F]">
                  Create Tracked Ticket from Conversation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateTicketOpen(false)}
                className="cursor-pointer rounded-lg p-1.5 text-[#8E8E93] hover:bg-[#F5F5F7]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={createConversationTicket} className="space-y-3.5 p-4 sm:p-5">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Subject *</span>
                <input
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  required
                  placeholder="Summary of issue"
                  className="min-h-9 w-full rounded-md border border-black/[0.08] px-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                />
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Category</span>
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="min-h-9 w-full rounded-md border border-black/[0.08] bg-white px-2 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                  >
                    <option value="ParkingAccess">Parking Access</option>
                    <option value="Booking">Booking</option>
                    <option value="Payment">Payment</option>
                    <option value="Account">Account</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Priority</span>
                  <select
                    value={ticketPriority}
                    onChange={(e) => setTicketPriority(e.target.value)}
                    className="min-h-9 w-full rounded-md border border-black/[0.08] bg-white px-2 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                  >
                    <option value="P0">P0 - Emergency</option>
                    <option value="P1">P1 - High</option>
                    <option value="P2">P2 - Standard</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Assigned Team</span>
                  <select
                    value={ticketTeam}
                    onChange={(e) => setTicketTeam(e.target.value)}
                    className="min-h-9 w-full rounded-md border border-black/[0.08] bg-white px-2 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                  >
                    <option value="ParkingOperations">Parking Operations</option>
                    <option value="CustomerSupport">Customer Support</option>
                    <option value="Payments">Payments</option>
                    <option value="OwnerSupport">Owner Support</option>
                    <option value="TrustSafety">Trust & Safety</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Internal Summary / Notes *</span>
                <textarea
                  value={ticketSummary}
                  onChange={(e) => setTicketSummary(e.target.value)}
                  rows={3}
                  required
                  className="w-full resize-none rounded-md border border-black/[0.08] p-2.5 text-xs leading-relaxed text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                />
              </label>

              {ticketError && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                  {ticketError}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-black/[0.06] pt-3">
                <button
                  type="button"
                  onClick={() => setCreateTicketOpen(false)}
                  className="cursor-pointer rounded-md border border-black/[0.08] px-3.5 py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ticketCreating}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#007AFF] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0066D6] disabled:opacity-50"
                >
                  {ticketCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TicketCheck className="h-3.5 w-3.5" />}
                  <span>{ticketCreating ? 'Creating...' : 'Create Ticket'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
