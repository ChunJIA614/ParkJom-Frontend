import SystemSelect from '@/components/ui/SystemSelect';
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
  adminRequestCustomerEvidence,
  adminUploadDisputeEvidence,
  assignDisputeCase,
  finalizeDisputeDecision,
  getAdminDisputeDetails,
  linkTicketToDispute as apiLinkTicketToDispute,
  listAdminDisputes,
} from '../../api/supportDisputeService';
import {
  acknowledgeIncident as apiAcknowledgeIncident,
  assignIncidentResponder as apiAssignIncidentResponder,
  createOperationalIncident as apiCreateOperationalIncident,
  executeAccessOverride as apiExecuteAccessOverride,
  getOperationalIncidentDetails,
  linkTicketFromIncident as apiLinkTicketFromIncident,
  linkTicketToIncident as apiLinkTicketToIncident,
  listOperationalIncidents as apiListOperationalIncidents,
  transitionIncidentStatus as apiTransitionIncidentStatus,
} from '../../api/supportIncidentService';
import { connectSupportRealtime } from '../../realtime/supportRealtime';
import type {
  AccessOverrideResult,
  AdminDashboardMetrics,
  DisputeCase,
  OnCallRosterStatus,
  OperationalIncidentDetail,
  OperationalIncidentItem,
  SupportAuditLogResponse,
  SupportViewer,
  TestOnCallAlertResult,
} from '../../types';
import { cleanSupportText } from '../../utils/supportText';

interface AdminSupportDashboardProps {
  viewer: SupportViewer;
  ticketWorkspace: ReactNode;
}

type AdminView = 'command' | 'tickets' | 'incidents' | 'disputes' | 'on-call' | 'audit';

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
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] sm:p-5 dark:border-white/10 dark:bg-[#141417]">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#1D1D1F] dark:bg-white/10 dark:text-white">
          <Icon className="h-4.5 w-4.5" />
        </span>
        {badge && (
          <span className="rounded-full border border-black/[0.06] bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-medium text-[#6E6E73] dark:border-white/10 dark:bg-white/10 dark:text-[#A1A1AA]">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-[#1D1D1F] dark:text-white">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-[#1D1D1F] dark:text-white">{label}</p>
      <p className="mt-0.5 text-[11px] text-[#86868B] dark:text-[#A1A1AA]">{detail}</p>
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
  const [activeView, setActiveView] = useState<AdminView>('command');
  const [notice, setNotice] = useState<string | null>(null);

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

  const [dspReqEvidence, setDspReqEvidence] = useState('Bank / Card Deduction Screenshot');
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
  const [testAlertRecipient, setTestAlertRecipient] = useState('oncall@parkjom.com');
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
      if (data.primaryResponder?.email || data.primaryResponder?.phone) {
        setTestAlertRecipient(data.primaryResponder.email || data.primaryResponder.phone);
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
        recipient: testAlertRecipient,
        targetUserId: Number(testAlertUserId),
        message: testAlertMessage,
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

  // Fetch full dispute detail when selected (GET /api/admin/support/disputes/{disputeId})
  useEffect(() => {
    if (!viewer.token || !selectedDisputeId) return;
    let active = true;
    const found = disputes.find((d) => d.disputeId === selectedDisputeId);
    if (found) setSelectedDisputeDetail(found);

    getAdminDisputeDetails(viewer.token, selectedDisputeId)
      .then((detail) => {
        if (active) setSelectedDisputeDetail(detail);
      })
      .catch(() => {
        // Fallback to list item already set
      });

    return () => {
      active = false;
    };
  }, [viewer.token, selectedDisputeId, disputes]);

  // Subscribe to realtime Support events (SignalR / WebSocket)
  useEffect(() => {
    if (!viewer.token) return;
    return connectSupportRealtime({
      token: viewer.token,
      onEvent: (event) => {
        const evt = String(event.eventType || event.type || '');
        if (
          evt.includes('Incident') ||
          evt.includes('AccessOverride') ||
          evt.includes('GateUnlock')
        ) {
          void fetchIncidents();
          void fetchDashboardMetrics();
        } else if (evt.includes('Dispute')) {
          void fetchDisputes();
          void fetchDashboardMetrics();
        } else if (evt.includes('Ticket')) {
          void fetchDashboardMetrics();
        }
      },
    });
  }, [viewer.token]);

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
      try {
        await apiLinkTicketFromIncident(viewer.token, incRef, ticketRef);
      } catch {
        await apiLinkTicketToIncident(viewer.token, ticketRef, incRef);
      }
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
        requiredEvidence: dspReqEvidence.trim() || 'Supporting Receipt / Screenshot',
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
        reason: dspDecisionReason.trim(),
        decisionReason: dspDecisionReason.trim(),
        amount: dspDecision === 'ApproveReversal' ? Number(dspApprovedAmount) : undefined,
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
      label: '24/7 On-Call',
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

  // ── Render Command Center ──
  const renderCommandCenter = () => {
    const recentTickets = dashboardMetrics?.recentTickets || [];
    const recentIncidents = dashboardMetrics?.recentIncidents || [];

    return (
      <div className="space-y-5" data-component="admin-command-center">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[#1D1D1F] dark:text-white">
              Support & Operations Command Center
            </h2>
            <p className="text-xs text-[#6E6E73] dark:text-[#A1A1AA]">
              Live ticket backlog, action-required cases, hardware disruptions, and financial settlements
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void fetchDashboardMetrics();
                void fetchIncidents();
                void fetchDisputes();
              }}
              disabled={loadingMetrics}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] dark:border-white/10 dark:bg-[#242429] dark:text-white dark:hover:bg-[#2C2C32]"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 text-[#6E6E73] dark:text-[#A1A1AA]', loadingMetrics && 'animate-spin text-[#007AFF]')} />
              <span>Refresh Metrics</span>
            </button>
            <div className="inline-flex items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3.5 py-2 text-xs font-medium text-[#1D1D1F] dark:border-white/10 dark:bg-[#18181C] dark:text-white">
              <span className="h-2 w-2 rounded-full bg-[#34C759]" />
              <span>Live API Synced</span>
            </div>
          </div>
        </div>

        {/* Live Metrics Grid (5 SUPPORT_API.ADMIN.DASHBOARD KPIs) */}
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            icon={TicketCheck}
            label="Open Support Tickets"
            value={dashboardMetrics ? String(dashboardMetrics.openTicketsCount) : '0'}
            detail="Tracked customer cases"
            badge="Ticketing"
          />
          <MetricCard
            icon={AlertCircle}
            label="Action Required Tickets"
            value={dashboardMetrics ? String(dashboardMetrics.actionRequiredTicketsCount ?? 0) : '0'}
            detail="Waiting on customer reply"
            badge="Action Req"
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
        <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] sm:p-5 space-y-3 dark:border-white/10 dark:bg-[#141417]">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider dark:text-[#A1A1AA]">Quick Action Shortcuts</h3>
            <span className="text-[10px] text-[#86868B] dark:text-[#71717A]">Unified Operations Hub</span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setActiveView('tickets')}
              className="flex items-center justify-between p-3.5 rounded-xl border border-black/[0.06] bg-[#F5F5F7]/60 hover:bg-[#F5F5F7] hover:border-black/[0.12] transition text-left cursor-pointer dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
            >
              <div>
                <p className="font-medium text-xs text-[#1D1D1F] dark:text-white">Manage Support Tickets</p>
                <p className="text-[11px] text-[#6E6E73] mt-0.5 dark:text-[#A1A1AA]">{dashboardMetrics?.openTicketsCount ?? 0} open customer cases</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#86868B] dark:text-[#A1A1AA]" />
            </button>
            <button
              type="button"
              onClick={() => setActiveView('incidents')}
              className="flex items-center justify-between p-3.5 rounded-xl border border-black/[0.06] bg-[#F5F5F7]/60 hover:bg-[#F5F5F7] hover:border-black/[0.12] transition text-left cursor-pointer dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
            >
              <div>
                <p className="font-medium text-xs text-[#1D1D1F] dark:text-white">Operational Incidents</p>
                <p className="text-[11px] text-[#6E6E73] mt-0.5 dark:text-[#A1A1AA]">{dashboardMetrics?.activeIncidentsCount ?? incidents.length} active site disruptions</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#86868B] dark:text-[#A1A1AA]" />
            </button>
            <button
              type="button"
              onClick={() => setActiveView('disputes')}
              className="flex items-center justify-between p-3.5 rounded-xl border border-black/[0.06] bg-[#F5F5F7]/60 hover:bg-[#F5F5F7] hover:border-black/[0.12] transition text-left cursor-pointer dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
            >
              <div>
                <p className="font-medium text-xs text-[#1D1D1F] dark:text-white">Financial Disputes</p>
                <p className="text-[11px] text-[#6E6E73] mt-0.5 dark:text-[#A1A1AA]">{dashboardMetrics?.openDisputesCount ?? disputes.length} cases under review</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#86868B] dark:text-[#A1A1AA]" />
            </button>
            <button
              type="button"
              onClick={() => setActiveView('on-call')}
              className="flex items-center justify-between p-3.5 rounded-xl border border-black/[0.06] bg-[#F5F5F7]/60 hover:bg-[#F5F5F7] hover:border-black/[0.12] transition text-left cursor-pointer dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
            >
              <div>
                <p className="font-medium text-xs text-[#1D1D1F] dark:text-white">24/7 On-Call Matrix</p>
                <p className="text-[11px] text-[#6E6E73] mt-0.5 dark:text-[#A1A1AA]">{onCallStatus?.primaryResponder?.name || 'Active duty roster'}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#86868B] dark:text-[#A1A1AA]" />
            </button>
          </div>
        </div>

        {/* Two-Column Section: Recent Incidents & Recent Tickets */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent Operational Incidents */}
          <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] sm:p-5 flex flex-col justify-between dark:border-white/10 dark:bg-[#141417]">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Siren className="h-4 w-4 text-[#1D1D1F] dark:text-white" />
                  <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F] dark:text-white">Recent Operational Incidents</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('incidents')}
                  className="text-xs font-medium text-[#007AFF] hover:underline cursor-pointer"
                >
                  View All &rarr;
                </button>
              </div>

              {recentIncidents.length === 0 ? (
                <p className="text-xs text-[#86868B] py-4 text-center dark:text-[#71717A]">No active incidents reported.</p>
              ) : (
                <div className="space-y-2">
                  {recentIncidents.map((inc) => (
                    <div
                      key={inc.incidentId}
                      className="flex items-center justify-between p-3 rounded-xl border border-black/[0.06] bg-[#F5F5F7]/50 hover:bg-[#F5F5F7] transition dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-semibold text-[#6E6E73] dark:text-[#A1A1AA]">{inc.incidentReference}</span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-2 py-0.5 text-[9px] font-medium text-[#1D1D1F] dark:border-white/10 dark:bg-white/10 dark:text-white">
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                inc.priority === 'P0' ? 'bg-[#FF3B30]' : 'bg-[#FF9500]'
                              )}
                            />
                            {inc.priority}
                          </span>
                          <span className="rounded-full border border-black/[0.06] bg-white px-2 py-0.5 text-[9px] font-medium text-[#6E6E73] dark:border-white/10 dark:bg-white/10 dark:text-[#A1A1AA]">
                            {inc.status}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-[#1D1D1F] truncate mt-1 dark:text-white">{cleanSupportText(inc.title)}</p>
                        <p className="text-[10px] text-[#86868B] mt-0.5 dark:text-[#A1A1AA]">
                          Team: {inc.assignedTeam || 'ParkingOperations'} · {inc.affectedCustomerCount} affected
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIncidentId(inc.incidentId);
                          setActiveView('incidents');
                        }}
                        className="rounded-xl bg-white border border-black/[0.08] px-3 py-1.5 text-[11px] font-medium text-[#1D1D1F] hover:bg-[#E8E8ED] transition shrink-0 cursor-pointer dark:border-white/14 dark:bg-[#242429] dark:text-white dark:hover:bg-[#2C2C32]"
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
          <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] sm:p-5 flex flex-col justify-between dark:border-white/10 dark:bg-[#141417]">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <TicketCheck className="h-4 w-4 text-[#1D1D1F] dark:text-white" />
                  <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F] dark:text-white">Recent Support Tickets</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('tickets')}
                  className="text-xs font-medium text-[#007AFF] hover:underline cursor-pointer"
                >
                  View All &rarr;
                </button>
              </div>

              {recentTickets.length === 0 ? (
                <p className="text-xs text-[#86868B] py-4 text-center dark:text-[#71717A]">No recent tickets logged.</p>
              ) : (
                <div className="space-y-2">
                  {recentTickets.slice(0, 5).map((tkt) => (
                    <div
                      key={tkt.ticketId}
                      className="flex items-center justify-between p-3 rounded-xl border border-black/[0.06] bg-[#F5F5F7]/50 hover:bg-[#F5F5F7] transition dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-semibold text-[#6E6E73] dark:text-[#A1A1AA]">{tkt.ticketReference}</span>
                          <span className="rounded-full border border-black/[0.08] bg-white px-2 py-0.5 text-[9px] font-medium text-[#1D1D1F] dark:border-white/10 dark:bg-white/10 dark:text-white">
                            {tkt.priority}
                          </span>
                          <span className="rounded-full border border-black/[0.06] bg-white px-2 py-0.5 text-[9px] font-medium text-[#6E6E73] dark:border-white/10 dark:bg-white/10 dark:text-[#A1A1AA]">
                            {tkt.status}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-[#1D1D1F] truncate mt-1 dark:text-white">{tkt.subject}</p>
                        <p className="text-[10px] text-[#86868B] mt-0.5 dark:text-[#A1A1AA]">
                          {tkt.customerName} · Category: {tkt.category}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveView('tickets')}
                        className="rounded-xl bg-white border border-black/[0.08] px-3 py-1.5 text-[11px] font-medium text-[#1D1D1F] hover:bg-[#E8E8ED] transition shrink-0 cursor-pointer dark:border-white/14 dark:bg-[#242429] dark:text-white dark:hover:bg-[#2C2C32]"
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

  // ── Render Operational Incidents & Hardware Access Override ──
  const renderIncidents = () => (
    <div className="space-y-4" data-component="operational-incidents">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-[#1D1D1F] sm:text-lg">
              Operational Incidents & Hardware Access
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F5F7] border border-black/[0.08] px-2.5 py-0.5 text-[10px] font-medium text-[#1D1D1F]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B30]" />
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
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3.5 text-xs font-medium text-[#1D1D1F] hover:bg-[#F5F5F7]"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-[#6E6E73]', loadingIncidents && 'animate-spin text-[#007AFF]')} />
            <span>Sync Incidents</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateIncidentOpen(true)}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 text-xs font-medium text-white hover:bg-[#0066D6]"
          >
            <Plus className="h-4 w-4" />
            <span>Create Incident</span>
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] lg:grid lg:min-h-[620px] lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left: Incident Queue */}
        <div className={cn('flex flex-col border-b border-black/[0.06] lg:border-b-0 lg:border-r bg-white', mobileIncidentDetailOpen ? 'hidden lg:flex' : 'flex')}>
          <div className="p-3.5 border-b border-black/[0.06] space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#86868B]" />
              <input
                type="search"
                value={incidentSearch}
                onChange={(e) => setIncidentSearch(e.target.value)}
                placeholder="Search reference, title, type..."
                className="min-h-8 w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/70 pl-8 pr-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="incident-status-filter" className="text-[11px] font-medium text-[#6E6E73] shrink-0">Status:</label>
              <div className="relative flex-1">
                <SystemSelect
                  id="incident-status-filter"
                  value={incidentFilter}
                  onChange={(e) => setIncidentFilter(e.target.value)}
                  className="min-h-8 w-full cursor-pointer appearance-none rounded-xl border border-black/[0.08] bg-[#F5F5F7]/70 pl-3 pr-8 text-xs font-medium text-[#1D1D1F] outline-none hover:bg-[#F5F5F7] focus:border-[#007AFF] focus:bg-white transition"
                >
                  <option value="All">All Incidents ({incidents.length})</option>
                  <option value="Open">Open</option>
                  <option value="Acknowledged">Acknowledged</option>
                  <option value="Escalated">Escalated</option>
                  <option value="Resolved">Resolved</option>
                </SystemSelect>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 max-h-[540px]">
            {loadingIncidents ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-[#6E6E73]">
                <Loader2 className="h-4 w-4 animate-spin text-[#007AFF]" />
                <span>Loading operational incidents...</span>
              </div>
            ) : visibleIncidents.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#86868B]">
                <Siren className="h-6 w-6 mx-auto text-[#86868B]/60 mb-2" />
                <p className="font-semibold text-[#1D1D1F]">No incidents found</p>
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
                      'w-full cursor-pointer rounded-xl border p-3 text-left transition-all relative',
                      isSelected
                        ? 'border-black/[0.12] bg-[#F5F5F7] shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
                        : 'border-transparent hover:border-black/[0.06] hover:bg-[#F5F5F7]/60'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-[10px] font-semibold text-[#6E6E73]">{inc.incidentReference}</span>
                      <div className="flex items-center gap-1">
                        <span className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-2 py-0.5 text-[9px] font-medium text-[#1D1D1F]">
                          <span className={cn('h-1.5 w-1.5 rounded-full', isP0 ? 'bg-[#FF3B30]' : 'bg-[#FF9500]')} />
                          {inc.priority}
                        </span>
                        <span className="rounded-full border border-black/[0.06] bg-white px-2 py-0.5 text-[9px] font-medium text-[#6E6E73]">
                          {inc.status}
                        </span>
                      </div>
                    </div>

                    <h4 className="mt-1.5 text-xs font-semibold text-[#1D1D1F] line-clamp-1">{cleanSupportText(inc.title)}</h4>

                    <div className="mt-1 flex items-center justify-between text-[10px] text-[#6E6E73]">
                      <span className="truncate">{inc.assignedTeam || 'ParkingOperations'} · {inc.incidentType}</span>
                      <span className="font-medium text-[9px] shrink-0 text-[#86868B]">{formatMsgDate(inc.createdAt)}</span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-[9px] text-[#86868B]">
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
            <div className="flex min-h-[400px] flex-1 flex-col items-center justify-center text-center p-8 text-xs text-[#86868B]">
              <Siren className="h-10 w-10 text-[#86868B]/40 mb-2" />
              <p className="font-semibold text-sm text-[#1D1D1F]">Select an incident</p>
              <p className="text-xs text-[#6E6E73] mt-1 max-w-xs">
                Review automated IoT telemetry, responder assignments, gate access overrides, and escalation chains.
              </p>
            </div>
          ) : (
            <div className="p-4 sm:p-5 space-y-4">
              {/* Incident Header: Identity & Actions Row + Title Row */}
              <div className="border-b border-black/[0.06] pb-3.5 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMobileIncidentDetailOpen(false)}
                      className="cursor-pointer rounded-xl p-1.5 text-[#1D1D1F] hover:bg-[#F5F5F7] lg:hidden min-h-[30px] min-w-[30px] flex items-center justify-center shrink-0 border border-black/[0.08] mr-1"
                      aria-label="Back to incidents list"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <span className="font-mono text-xs font-semibold text-[#6E6E73]">
                      {selectedIncidentDetail.incidentReference}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-medium text-[#1D1D1F]">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          selectedIncidentDetail.priority === 'P0' ? 'bg-[#FF3B30]' : 'bg-[#FF9500]'
                        )}
                      />
                      {selectedIncidentDetail.priority}
                    </span>
                    <span className="rounded-full border border-black/[0.08] bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-medium text-[#6E6E73]">
                      {selectedIncidentDetail.status}
                    </span>
                    {selectedIncidentDetail.escalationLevel > 0 && (
                      <span className="rounded-full border border-black/[0.08] bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-medium text-[#1D1D1F]">
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
                        'inline-flex cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition select-none',
                        showIncidentDetails
                          ? 'bg-[#1D1D1F] text-white'
                          : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED]'
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
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#007AFF] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0066D6] disabled:opacity-50"
                      >
                        {incidentActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                        <span>Acknowledge</span>
                      </button>
                    )}

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIncidentActionMenuOpen((prev) => !prev)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-black/[0.08] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition"
                      >
                        <span>Actions</span>
                        <ChevronDown className="h-3 w-3 text-[#86868B]" />
                      </button>

                      {incidentActionMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIncidentActionMenuOpen(false)}
                          />
                          <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-2xl border border-black/[0.08] bg-white p-1.5 shadow-lg divide-y divide-black/[0.04] text-xs">
                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setIncidentActionMenuOpen(false);
                                  setAssignIncidentOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-lg cursor-pointer"
                              >
                                <Users className="h-3.5 w-3.5 text-[#6E6E73]" />
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
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-lg cursor-pointer"
                              >
                                <KeyRound className="h-3.5 w-3.5 text-[#6E6E73]" />
                                <span>Gate Override...</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setIncidentActionMenuOpen(false);
                                  setTransitionIncidentOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-lg cursor-pointer"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-[#6E6E73]" />
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
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-lg cursor-pointer"
                              >
                                <Link2 className="h-3.5 w-3.5 text-[#6E6E73]" />
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
                  <h3 className="text-base font-semibold tracking-tight text-[#1D1D1F] sm:text-lg">
                    {cleanSupportText(selectedIncidentDetail.title)}
                  </h3>
                  <p className="mt-0.5 text-xs text-[#6E6E73]">
                    {selectedIncidentDetail.propertyName ? `${selectedIncidentDetail.propertyName} · ` : ''}
                    {selectedIncidentDetail.spotNumber ? `Bay ${selectedIncidentDetail.spotNumber} · ` : ''}
                    Logged {formatDateTime(selectedIncidentDetail.createdAt)} · Source: {selectedIncidentDetail.source}
                  </p>
                </div>
              </div>

              {/* Collapsible Incident Metadata Drawer */}
              {showIncidentDetails && (
                <div className="grid gap-3 sm:grid-cols-2 text-xs bg-[#F5F5F7]/70 p-4 rounded-2xl border border-black/[0.06] animate-in fade-in-0 duration-150">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B] block">
                      Incident Description & Symptoms
                    </span>
                    <p className="text-xs text-[#1D1D1F] leading-relaxed whitespace-pre-wrap">
                      {cleanSupportText(selectedIncidentDetail.description)}
                    </p>
                    <div className="pt-1 flex items-center gap-2 text-[10px] text-[#6E6E73]">
                      <span>Type: <strong className="text-[#1D1D1F]">{selectedIncidentDetail.incidentType}</strong></span>
                      <span>·</span>
                      <span>Affected: <strong className="text-[#1D1D1F]">{selectedIncidentDetail.affectedCustomerCount} driver(s)</strong></span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B] block">
                      Hardware & Facility Telemetry
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <p className="text-[9px] text-[#86868B]">Property</p>
                        <p className="font-medium text-[#1D1D1F] truncate">
                          {selectedIncidentDetail.propertyName || `Property #${selectedIncidentDetail.propertyId || 'N/A'}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#86868B]">Bay / Barrier</p>
                        <p className="font-medium text-[#1D1D1F]">
                          {selectedIncidentDetail.spotNumber || 'Main Entrance Gate'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#86868B]">IoT Controller</p>
                        <p className="font-mono text-[10px] text-[#1D1D1F] font-semibold">
                          {selectedIncidentDetail.ioTDeviceId || selectedIncidentDetail.esp32Serial || 'ESP32-GATE-01'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#86868B]">Assigned Staff</p>
                        <p className="font-medium text-[#1D1D1F]">
                          {selectedIncidentDetail.assignedUserName || 'Unassigned'} ({selectedIncidentDetail.assignedTeam || 'Operations'})
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Linked Support Tickets Section */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-[#1D1D1F]">
                    <TicketCheck className="h-4 w-4 text-[#1D1D1F]" />
                    <span>Linked Support Tickets ({selectedIncidentDetail.linkedTickets?.length || 0})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLinkTicketOpen(true)}
                    className="text-xs font-medium text-[#007AFF] hover:underline cursor-pointer"
                  >
                    + Link Ticket
                  </button>
                </div>

                {(!selectedIncidentDetail.linkedTickets || selectedIncidentDetail.linkedTickets.length === 0) ? (
                  <p className="text-xs text-[#86868B] italic py-1">No support tickets currently linked to this incident.</p>
                ) : (
                  <div className="divide-y divide-black/[0.06] border border-black/[0.06] rounded-xl overflow-hidden">
                    {selectedIncidentDetail.linkedTickets.map((t) => (
                      <div
                        key={t.ticketId}
                        className="flex items-center justify-between p-3 hover:bg-[#F5F5F7]/60 transition text-xs"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-semibold text-[#6E6E73]">{t.ticketReference}</span>
                            <span className="rounded-full bg-[#F5F5F7] border border-black/[0.08] px-2 py-0.5 text-[9px] font-medium text-[#6E6E73]">{t.status}</span>
                            <span className="rounded-full bg-[#F5F5F7] border border-black/[0.08] px-2 py-0.5 text-[9px] font-medium text-[#1D1D1F]">{t.priority}</span>
                          </div>
                          <p className="font-medium text-xs text-[#1D1D1F] mt-0.5 truncate">{t.subject}</p>
                          <p className="text-[10px] text-[#86868B]">Customer: {t.customerName} ({t.customerEmail})</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Automated Escalation Broadcasts Section */}
              {selectedIncidentDetail.notificationAttempts && selectedIncidentDetail.notificationAttempts.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-black/[0.06]">
                  <div className="flex items-center gap-1.5 font-semibold text-[#1D1D1F] text-xs">
                    <BellRing className="h-4 w-4 text-[#1D1D1F]" />
                    <span>Automated Escalation Broadcasts ({selectedIncidentDetail.notificationAttempts.length})</span>
                  </div>
                  <div className="divide-y divide-black/[0.06] border border-black/[0.06] rounded-xl overflow-hidden">
                    {selectedIncidentDetail.notificationAttempts.map((notif) => (
                      <div
                        key={notif.notificationAttemptId}
                        className="flex items-center justify-between p-3 hover:bg-[#F5F5F7]/60 transition text-xs"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#1D1D1F]">{notif.recipient}</span>
                            <span className="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[9px] font-medium text-[#6E6E73] border border-black/[0.08]">
                              {notif.channel}
                            </span>
                            <span className="text-[10px] text-[#86868B]">{formatDateTime(notif.sentAt || notif.createdAt)}</span>
                          </div>
                          <p className="text-xs text-[#6E6E73] mt-0.5">{notif.message}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[9px] font-medium text-[#1D1D1F] bg-[#F5F5F7] border border-black/[0.08] px-2 py-0.5 rounded-full shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
                          {notif.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Incident Audit Timeline Section */}
              {selectedIncidentDetail.auditTimeline && selectedIncidentDetail.auditTimeline.length > 0 && (
                <div className="pt-2 border-t border-black/[0.06] text-xs">
                  <button
                    type="button"
                    onClick={() => setShowIncidentAudit((prev) => !prev)}
                    className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-black/[0.06] bg-[#F5F5F7]/70 hover:bg-[#F5F5F7] px-3.5 py-2.5 text-left transition select-none"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white border border-black/[0.06] text-[#1D1D1F]">
                        <History className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-semibold text-[#1D1D1F] text-xs">
                        Incident Audit Timeline ({selectedIncidentDetail.auditTimeline.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#6E6E73]">
                      <span className="text-[11px] font-medium">
                        {showIncidentAudit ? 'Hide timeline' : 'View history'}
                      </span>
                      {showIncidentAudit ? (
                        <ChevronUp className="h-4 w-4 text-[#86868B]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[#86868B]" />
                      )}
                    </div>
                  </button>

                  {showIncidentAudit && (
                    <div className="mt-3 relative border-l-2 border-black/[0.08] ml-3 space-y-2.5 pl-3.5 pt-1 transition-all">
                      {selectedIncidentDetail.auditTimeline.map((ev, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-[#1D1D1F] ring-4 ring-white" />
                          <div className="p-2.5 rounded-xl bg-white border border-black/[0.06]">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-semibold text-[#1D1D1F]">{ev.action}</span>
                              <span className="text-[#86868B]">{formatDateTime(ev.timestamp)}</span>
                            </div>
                            <p className="text-xs text-[#6E6E73] mt-0.5 leading-snug">{ev.detail}</p>
                            <div className="mt-1 flex items-center gap-1 text-[9px] text-[#86868B]">
                              <span>Actor:</span>
                              <span className="font-medium text-[#1D1D1F]">{ev.actorName} ({ev.actorRole})</span>
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
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Siren className="h-4 w-4 text-[#1D1D1F]" />
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">Create Operational Incident</h3>
                  <p className="text-[10px] text-[#6E6E73]">Log site barrier failure or emergency trapped customer</p>
                </div>
              </div>
              <button type="button" onClick={() => setCreateIncidentOpen(false)} className="text-[#86868B] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-3 text-xs">
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Incident Title *</span>
                <input
                  value={incTitle}
                  onChange={(e) => setIncTitle(e.target.value)}
                  required
                  placeholder="e.g. Main Entrance Barrier Stuck Offline"
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white"
                />
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Priority</span>
                  <SystemSelect
                    value={incPriority}
                    onChange={(e) => setIncPriority(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white font-medium"
                  >
                    <option value="P0">P0 - Critical Emergency</option>
                    <option value="P1">P1 - High Disruption</option>
                    <option value="P2">P2 - Moderate Latency</option>
                  </SystemSelect>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Incident Type</span>
                  <SystemSelect
                    value={incType}
                    onChange={(e) => setIncType(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white"
                  >
                    <option value="GateOffline">Gate Offline</option>
                    <option value="UserTrapped">User Trapped</option>
                    <option value="PowerOutage">Power Outage</option>
                    <option value="HardwareFailure">Hardware Failure</option>
                    <option value="BarrierDamaged">Barrier Damaged</option>
                  </SystemSelect>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Property ID</span>
                  <input
                    type="number"
                    value={incPropertyId}
                    onChange={(e) => setIncPropertyId(e.target.value)}
                    placeholder="e.g. 1"
                    className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Assigned Team</span>
                  <SystemSelect
                    value={incAssignedTeam}
                    onChange={(e) => setIncAssignedTeam(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white"
                  >
                    <option value="ParkingOperations">Parking Operations</option>
                    <option value="CustomerSupport">Customer Support</option>
                    <option value="Engineering">Engineering & IoT</option>
                  </SystemSelect>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Initial Ticket Reference (Optional)
                </span>
                <input
                  value={incInitialTicketReference}
                  onChange={(e) => setIncInitialTicketReference(e.target.value)}
                  placeholder="e.g. TKT-2026-35442"
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white font-mono"
                />
                <p className="text-[10px] text-[#86868B]">
                  Directly link an originating customer support ticket when raising this incident
                </p>
              </label>

              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Detailed Description *</span>
                <textarea
                  rows={3}
                  value={incDescription}
                  onChange={(e) => setIncDescription(e.target.value)}
                  required
                  placeholder="Describe the hardware issue, error code, or telemetry logs..."
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 p-2.5 outline-none focus:border-[#007AFF] focus:bg-white"
                />
              </label>

              {createIncidentError && (
                <div role="alert" className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-2.5 text-xs text-[#1D1D1F]">
                  {createIncidentError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setCreateIncidentOpen(false)}
                  className="rounded-xl border border-black/[0.08] px-3.5 py-1.5 font-medium text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={incidentActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-1.5 font-medium text-white hover:bg-[#0066D6] disabled:opacity-50"
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
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#1D1D1F]" />
                <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">Assign Incident Responder</h3>
              </div>
              <button type="button" onClick={() => setAssignIncidentOpen(false)} className="text-[#86868B] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAssignResponder} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Operational Team *</label>
                <SystemSelect
                  value={assignTeam}
                  onChange={(e) => setAssignTeam(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white"
                >
                  <option value="ParkingOperations">Parking Operations</option>
                  <option value="CustomerSupport">Customer Support</option>
                  <option value="Engineering">Engineering</option>
                  <option value="TrustSafety">Trust & Safety</option>
                </SystemSelect>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Responder User ID *</label>
                <input
                  type="number"
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  required
                  placeholder="e.g. 1"
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white"
                />
              </div>

              {assignError && (
                <div role="alert" className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-2.5 text-xs text-[#1D1D1F]">
                  {assignError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setAssignIncidentOpen(false)}
                  className="rounded-xl border border-black/[0.08] px-3.5 py-1.5 font-medium text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={incidentActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-1.5 font-medium text-white hover:bg-[#0066D6] disabled:opacity-50"
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
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#1D1D1F]" />
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">Execute Barrier Override</h3>
                  <p className="text-[10px] text-[#6E6E73]">Direct IoT access bypass for trapped driver</p>
                </div>
              </div>
              <button type="button" onClick={() => setOverrideModalOpen(false)} className="text-[#86868B] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            {overrideResult ? (
              <div className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-[#1D1D1F]">
                  <CheckCircle2 className="h-4 w-4 text-[#34C759]" />
                  <span>Override Dispatched Successfully!</span>
                </div>
                <p className="text-[#6E6E73]">{overrideResult.message}</p>
                <div className="font-mono text-[10px] text-[#1D1D1F] bg-white p-2 rounded-lg border border-black/[0.06]">
                  Command: {overrideResult.commandId}
                </div>
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="w-full rounded-xl bg-[#007AFF] py-2 font-medium text-white hover:bg-[#0066D6] text-xs mt-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleExecuteOverride} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Booking ID *</label>
                  <input
                    type="number"
                    value={overrideBookingId}
                    onChange={(e) => setOverrideBookingId(e.target.value)}
                    required
                    placeholder="e.g. 4"
                    className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Override Action</label>
                  <SystemSelect
                    value={overrideAction}
                    onChange={(e) => setOverrideAction(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white font-medium"
                  >
                    <option value="RemoteOpenGate">Remote Open Barrier Gate</option>
                    <option value="ForceBarrierOpen">Force Barrier Hold Open</option>
                    <option value="RebootController">Reboot ESP32 Controller</option>
                  </SystemSelect>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Justification Reason *</label>
                  <textarea
                    rows={2}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    required
                    placeholder="e.g. Driver trapped at barrier during system offline"
                    className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 p-2.5 outline-none focus:border-[#007AFF] focus:bg-white"
                  />
                </div>

                {overrideError && (
                  <div role="alert" className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-2.5 text-xs text-[#1D1D1F]">
                    {overrideError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                  <button
                    type="button"
                    onClick={() => setOverrideModalOpen(false)}
                    className="rounded-xl border border-black/[0.08] px-3.5 py-1.5 font-medium text-[#6E6E73] hover:bg-[#F5F5F7]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={incidentActionLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-1.5 font-medium text-white hover:bg-[#0066D6] disabled:opacity-50"
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
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#1D1D1F]" />
                <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">Transition Incident Status</h3>
              </div>
              <button type="button" onClick={() => setTransitionIncidentOpen(false)} className="text-[#86868B] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleTransitionIncident} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Target Status *</label>
                <SystemSelect
                  value={incToStatus}
                  onChange={(e) => setIncToStatus(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white font-medium"
                >
                  <option value="Resolved">Resolved (Disruption Rectified)</option>
                  <option value="Monitoring">Monitoring (Telemetry Under Observation)</option>
                  <option value="Closed">Closed (Archived)</option>
                </SystemSelect>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Root Cause / Recovery Note *</label>
                <textarea
                  rows={3}
                  value={incRootCause}
                  onChange={(e) => setIncRootCause(e.target.value)}
                  required
                  placeholder="e.g. Power supply rebooted; hardware online."
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 p-2.5 outline-none focus:border-[#007AFF] focus:bg-white"
                />
              </div>

              {transitionIncError && (
                <div role="alert" className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-2.5 text-xs text-[#1D1D1F]">
                  {transitionIncError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setTransitionIncidentOpen(false)}
                  className="rounded-xl border border-black/[0.08] px-3.5 py-1.5 font-medium text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={incidentActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-1.5 font-medium text-white hover:bg-[#0066D6] disabled:opacity-50"
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
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-[#1D1D1F]" />
                <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">Link Support Ticket</h3>
              </div>
              <button type="button" onClick={() => setLinkTicketOpen(false)} className="text-[#86868B] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleLinkTicket} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Ticket Reference or ID *</label>
                <input
                  type="text"
                  value={linkTicketId}
                  onChange={(e) => setLinkTicketId(e.target.value)}
                  required
                  placeholder="e.g. TKT-2026-35442 or 8"
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white font-mono text-xs"
                />
                <p className="text-[10px] text-[#86868B] mt-1">
                  Associate customer ticket (e.g. TKT-2026-35442) with incident #{selectedIncidentDetail.incidentReference}
                </p>
              </div>

              {linkTicketError && (
                <div role="alert" className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-2.5 text-xs text-[#1D1D1F]">
                  {linkTicketError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setLinkTicketOpen(false)}
                  className="rounded-xl border border-black/[0.08] px-3.5 py-1.5 font-medium text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={incidentActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-1.5 font-medium text-white hover:bg-[#0066D6] disabled:opacity-50"
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
            <h2 className="text-base font-semibold tracking-tight text-[#1D1D1F] sm:text-lg">
              Financial Dispute Register & Reversals
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F5F7] border border-black/[0.08] px-2.5 py-0.5 text-[10px] font-medium text-[#1D1D1F]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF9500]" />
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
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3.5 text-xs font-medium text-[#1D1D1F] hover:bg-[#F5F5F7]"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-[#6E6E73]', loadingDisputes && 'animate-spin text-[#007AFF]')} />
            <span>Sync Disputes</span>
          </button>
        </div>
      </div>

      {/* Main Split Section */}
      <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] lg:grid lg:min-h-[620px] lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left: Dispute Queue List */}
        <div className={cn('flex flex-col border-b border-black/[0.06] lg:border-b-0 lg:border-r bg-white', mobileDisputeDetailOpen ? 'hidden lg:flex' : 'flex')}>
          <div className="p-3.5 border-b border-black/[0.06] space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#86868B]" />
              <input
                type="search"
                value={disputeSearch}
                onChange={(e) => setDisputeSearch(e.target.value)}
                placeholder="Search reference, customer, type..."
                className="min-h-8 w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/70 pl-8 pr-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="dispute-status-filter" className="text-[11px] font-medium text-[#6E6E73] shrink-0">Status:</label>
              <div className="relative flex-1">
                <SystemSelect
                  id="dispute-status-filter"
                  value={disputeFilter}
                  onChange={(e) => setDisputeFilter(e.target.value)}
                  className="min-h-8 w-full cursor-pointer appearance-none rounded-xl border border-black/[0.08] bg-[#F5F5F7]/70 pl-3 pr-8 text-xs font-medium text-[#1D1D1F] outline-none hover:bg-[#F5F5F7] focus:border-[#007AFF] focus:bg-white transition"
                >
                  <option value="All">All Disputes ({disputes.length})</option>
                  <option value="Opened">Opened</option>
                  <option value="EvidenceReview">Evidence Review</option>
                  <option value="MoreInfo">More Info</option>
                  <option value="Approved">Approved</option>
                  <option value="Declined">Declined</option>
                </SystemSelect>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 max-h-[540px]">
            {loadingDisputes ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-[#6E6E73]">
                <Loader2 className="h-4 w-4 animate-spin text-[#007AFF]" />
                <span>Loading financial disputes...</span>
              </div>
            ) : visibleDisputes.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#86868B]">
                <ShieldAlert className="h-6 w-6 mx-auto text-[#86868B]/60 mb-2" />
                <p className="font-semibold text-[#1D1D1F]">No dispute cases found</p>
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
                      'w-full cursor-pointer rounded-xl border p-3 text-left transition-all relative',
                      isSelected
                        ? 'border-black/[0.12] bg-[#F5F5F7] shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
                        : 'border-transparent hover:border-black/[0.06] hover:bg-[#F5F5F7]/60'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-[10px] font-semibold text-[#6E6E73]">{dsp.disputeReference}</span>
                      <div className="flex items-center gap-1">
                        <span className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-2 py-0.5 text-[9px] font-medium text-[#1D1D1F]">
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              isApproved
                                ? 'bg-[#34C759]'
                                : isDeclined
                                ? 'bg-[#86868B]'
                                : 'bg-[#FF9500]'
                            )}
                          />
                          {dsp.status}
                        </span>
                        {dsp.amount > 0 && (
                          <span className="font-semibold text-[10px] text-[#1D1D1F]">
                            {dsp.currency} {dsp.amount.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="mt-1.5 text-xs font-semibold text-[#1D1D1F] line-clamp-1">{dsp.disputeType}</h4>
                    <p className="text-[11px] text-[#6E6E73] line-clamp-1">{dsp.reason || 'No description provided'}</p>

                    <div className="mt-1 flex items-center justify-between text-[10px] text-[#86868B]">
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
            <div className="flex min-h-[400px] flex-1 flex-col items-center justify-center text-center p-8 text-xs text-[#86868B]">
              <ShieldAlert className="h-10 w-10 text-[#86868B]/40 mb-2" />
              <p className="font-semibold text-sm text-[#1D1D1F]">Select a dispute case</p>
              <p className="text-xs text-[#6E6E73] mt-1 max-w-xs">
                Review payment duplicate claims, examine uploaded bank receipts, verify gateway logs, and execute financial reversals.
              </p>
            </div>
          ) : (
            <div className="p-4 sm:p-5 space-y-4">
              {/* Dispute Header: Identity & Actions Row + Title Row */}
              <div className="border-b border-black/[0.06] pb-3.5 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMobileDisputeDetailOpen(false)}
                      className="cursor-pointer rounded-xl p-1.5 text-[#1D1D1F] hover:bg-[#F5F5F7] lg:hidden min-h-[30px] min-w-[30px] flex items-center justify-center shrink-0 border border-black/[0.08] mr-1"
                      aria-label="Back to disputes list"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <span className="font-mono text-xs font-semibold text-[#6E6E73]">
                      {selectedDisputeDetail.disputeReference}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-medium text-[#1D1D1F]">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          selectedDisputeDetail.status === 'Approved'
                            ? 'bg-[#34C759]'
                            : selectedDisputeDetail.status === 'Declined'
                            ? 'bg-[#86868B]'
                            : 'bg-[#FF9500]'
                        )}
                      />
                      {selectedDisputeDetail.status}
                    </span>
                    <span className="rounded-full border border-black/[0.08] bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-medium text-[#6E6E73]">
                      {selectedDisputeDetail.disputeType}
                    </span>
                    {selectedDisputeDetail.amount > 0 && (
                      <span className="rounded-full border border-black/[0.08] bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-semibold text-[#1D1D1F]">
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
                        'inline-flex cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition select-none',
                        showDisputeDetails
                          ? 'bg-[#1D1D1F] text-white'
                          : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED]'
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
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#007AFF] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0066D6] active:scale-[0.98]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Finalize Decision</span>
                      </button>
                    )}

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setDisputeActionMenuOpen((prev) => !prev)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-black/[0.08] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition"
                      >
                        <span>Actions</span>
                        <ChevronDown className="h-3 w-3 text-[#86868B]" />
                      </button>

                      {disputeActionMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setDisputeActionMenuOpen(false)}
                          />
                          <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-2xl border border-black/[0.08] bg-white p-1.5 shadow-lg divide-y divide-black/[0.04] text-xs">
                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setDisputeActionMenuOpen(false);
                                  setAssignDisputeOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-lg cursor-pointer"
                              >
                                <Users className="h-3.5 w-3.5 text-[#6E6E73]" />
                                <span>Assign Case...</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setDisputeActionMenuOpen(false);
                                  setRequestEvidenceOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-lg cursor-pointer"
                              >
                                <Send className="h-3.5 w-3.5 text-[#6E6E73]" />
                                <span>Request Evidence...</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setDisputeActionMenuOpen(false);
                                  setUploadDisputeEvidenceOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-lg cursor-pointer"
                              >
                                <UploadCloud className="h-3.5 w-3.5 text-[#6E6E73]" />
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
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-lg cursor-pointer"
                              >
                                <Link2 className="h-3.5 w-3.5 text-[#6E6E73]" />
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
                  <h3 className="text-base font-semibold tracking-tight text-[#1D1D1F] sm:text-lg">
                    {selectedDisputeDetail.reason || 'Dispute Investigation Case'}
                  </h3>
                  <p className="mt-0.5 text-xs text-[#6E6E73]">
                    Claimant: {selectedDisputeDetail.customerName} ({selectedDisputeDetail.customerEmail}) · Logged {formatDateTime(selectedDisputeDetail.createdAt)}
                  </p>
                </div>
              </div>

              {/* Collapsible Dispute Metadata Drawer */}
              {showDisputeDetails && (
                <div className="grid gap-3 sm:grid-cols-2 text-xs bg-[#F5F5F7]/70 p-4 rounded-2xl border border-black/[0.06] animate-in fade-in-0 duration-150">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B] block">
                      Case & Customer Metadata
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <p className="text-[9px] text-[#86868B]">Customer User ID</p>
                        <p className="font-medium text-[#1D1D1F]">{selectedDisputeDetail.customerUserId}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#86868B]">Booking Reference</p>
                        <p className="font-mono text-[10px] text-[#1D1D1F]">
                          {selectedDisputeDetail.bookingId ? `Booking #${selectedDisputeDetail.bookingId}` : 'None'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#86868B]">Linked Ticket</p>
                        <p className="font-mono text-[10px] text-[#1D1D1F]">
                          {selectedDisputeDetail.ticketId ? `Ticket #${selectedDisputeDetail.ticketId}` : 'Unlinked'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#86868B]">Assigned Officer</p>
                        <p className="font-medium text-[#1D1D1F]">
                          {selectedDisputeDetail.assignedUserName || 'Unassigned'} ({selectedDisputeDetail.assignedTeam || 'Finance'})
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B] block">
                      Settlement & Decision Status
                    </span>
                    {selectedDisputeDetail.decision ? (
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-[#6E6E73]">Decision:</span>
                          <span className="font-semibold text-[#1D1D1F]">
                            {selectedDisputeDetail.decision}
                          </span>
                        </div>
                        {selectedDisputeDetail.decisionReason && (
                          <p className="text-[#6E6E73]">{selectedDisputeDetail.decisionReason}</p>
                        )}
                        <p className="text-[10px] text-[#86868B]">
                          Decided by {selectedDisputeDetail.decidedByUserName || 'Finance'} at {formatDateTime(selectedDisputeDetail.decidedAt)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[#6E6E73] text-[11px] leading-relaxed">
                        Investigation in progress. Awaiting proof verification before executing financial reversal or settlement payout.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Evidence Files Gallery */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-[#1D1D1F]">
                    <FileSearch className="h-4 w-4 text-[#1D1D1F]" />
                    <span>Evidence Audit Register ({selectedDisputeDetail.evidences?.length || 0})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadDisputeEvidenceOpen(true)}
                    className="text-xs font-medium text-[#007AFF] hover:underline cursor-pointer"
                  >
                    + Upload Proof File
                  </button>
                </div>

                {(!selectedDisputeDetail.evidences || selectedDisputeDetail.evidences.length === 0) ? (
                  <p className="text-xs text-[#86868B] italic py-1">
                    No evidence files uploaded yet. Click &ldquo;Request Evidence&rdquo; to notify the customer.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedDisputeDetail.evidences.map((ev) => (
                      <div
                        key={ev.disputeEvidenceId}
                        className="flex flex-col justify-between p-3 rounded-xl border border-black/[0.06] bg-[#F5F5F7]/50 hover:bg-[#F5F5F7] space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-[#1D1D1F] shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-xs text-[#1D1D1F] truncate">{ev.fileName}</p>
                              <span className="text-[9px] text-[#86868B]">{ev.evidenceType}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="rounded-full border border-black/[0.08] bg-white px-2 py-0.5 text-[9px] font-medium text-[#6E6E73]">
                              {ev.uploadedRole}
                            </span>
                            {ev.isVerified && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-2 py-0.5 text-[8px] font-medium text-[#1D1D1F]">
                                <span className="h-1 w-1 rounded-full bg-[#34C759]" />
                                Verified
                              </span>
                            )}
                          </div>
                        </div>

                        {ev.description && (
                          <p className="text-[10px] text-[#6E6E73] line-clamp-2">{ev.description}</p>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-black/[0.06] text-[9px] text-[#86868B]">
                          <span>{formatDateTime(ev.createdAt)}</span>
                          {ev.fileUrl && (
                            <a
                              href={ev.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-[#007AFF] hover:underline flex items-center gap-1"
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
                <div className="pt-2 border-t border-black/[0.06] text-xs">
                  <button
                    type="button"
                    onClick={() => setShowDisputeAudit((prev) => !prev)}
                    className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-black/[0.06] bg-[#F5F5F7]/70 hover:bg-[#F5F5F7] px-3.5 py-2.5 text-left transition select-none"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white border border-black/[0.06] text-[#1D1D1F]">
                        <History className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-semibold text-[#1D1D1F] text-xs">
                        Dispute Audit Timeline ({selectedDisputeDetail.auditTimeline.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#6E6E73]">
                      <span className="text-[11px] font-medium">
                        {showDisputeAudit ? 'Hide timeline' : 'View history'}
                      </span>
                      {showDisputeAudit ? (
                        <ChevronUp className="h-4 w-4 text-[#86868B]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[#86868B]" />
                      )}
                    </div>
                  </button>

                  {showDisputeAudit && (
                    <div className="mt-3 relative border-l-2 border-black/[0.08] ml-2.5 space-y-2.5 pl-3.5 pt-1 transition-all">
                      {selectedDisputeDetail.auditTimeline.map((ev, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-[#1D1D1F] ring-4 ring-white" />
                          <div className="p-2.5 rounded-xl bg-white border border-black/[0.06]">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-semibold text-[#1D1D1F]">{ev.action}</span>
                              <span className="text-[#86868B]">{formatDateTime(ev.timestamp)}</span>
                            </div>
                            <p className="text-xs text-[#6E6E73] mt-0.5 leading-snug">{ev.detail}</p>
                            <div className="mt-1 flex items-center gap-1 text-[9px] text-[#86868B]">
                              <span>Actor:</span>
                              <span className="font-medium text-[#1D1D1F]">{ev.actorName} ({ev.actorRole})</span>
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
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#1D1D1F]" />
                <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">Assign Dispute Case</h3>
              </div>
              <button type="button" onClick={() => setAssignDisputeOpen(false)} className="text-[#86868B] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAssignDispute} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Operational Team *</label>
                <SystemSelect
                  value={dspAssignTeam}
                  onChange={(e) => setDspAssignTeam(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white"
                >
                  <option value="Finance">Finance & Settlements</option>
                  <option value="Payments">Payments Support</option>
                  <option value="TrustSafety">Trust & Safety</option>
                </SystemSelect>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Assignee User ID *</label>
                <input
                  type="number"
                  value={dspAssignUserId}
                  onChange={(e) => setDspAssignUserId(e.target.value)}
                  required
                  placeholder="e.g. 8"
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Case Status</label>
                <SystemSelect
                  value={dspAssignStatus}
                  onChange={(e) => setDspAssignStatus(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white font-medium"
                >
                  <option value="EvidenceReview">Evidence Review</option>
                  <option value="MoreInfo">Waiting for More Info</option>
                  <option value="Opened">Opened</option>
                </SystemSelect>
              </div>

              {dspAssignError && (
                <div role="alert" className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-2.5 text-xs text-[#1D1D1F]">
                  {dspAssignError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setAssignDisputeOpen(false)}
                  className="rounded-xl border border-black/[0.08] px-3.5 py-1.5 font-medium text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-1.5 font-medium text-white hover:bg-[#0066D6] disabled:opacity-50"
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
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-[#1D1D1F]" />
                <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">Request Customer Evidence</h3>
              </div>
              <button type="button" onClick={() => setRequestEvidenceOpen(false)} className="text-[#86868B] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRequestEvidence} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Required Evidence Type *</label>
                <input
                  type="text"
                  value={dspReqEvidence}
                  onChange={(e) => setDspReqEvidence(e.target.value)}
                  required
                  placeholder="e.g. Bank / Card Deduction Screenshot"
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Prompt / Message to Customer *</label>
                <textarea
                  rows={3}
                  value={dspReqMessage}
                  onChange={(e) => setDspReqMessage(e.target.value)}
                  required
                  placeholder="e.g. Please upload bank transaction screenshot showing deduction."
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 p-2.5 outline-none focus:border-[#007AFF] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Deadline (Days)</label>
                <input
                  type="number"
                  value={dspReqDays}
                  onChange={(e) => setDspReqDays(e.target.value)}
                  min="1"
                  max="30"
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white"
                />
              </div>

              {dspReqError && (
                <div role="alert" className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-2.5 text-xs text-[#1D1D1F]">
                  {dspReqError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setRequestEvidenceOpen(false)}
                  className="rounded-xl border border-black/[0.08] px-3.5 py-1.5 font-medium text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-1.5 font-medium text-white hover:bg-[#0066D6] disabled:opacity-50"
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
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-[#1D1D1F]" />
                <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">Upload Audit Proof</h3>
              </div>
              <button type="button" onClick={() => setUploadDisputeEvidenceOpen(false)} className="text-[#86868B] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadDisputeEvidence} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Evidence Type *</label>
                <SystemSelect
                  value={dspEvType}
                  onChange={(e) => setDspEvType(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white font-medium"
                >
                  <option value="GatewayLog">Gateway Log (Stripe / Bank Trace)</option>
                  <option value="BankReceipt">Bank Receipt / Statement</option>
                  <option value="LedgerAudit">Internal Ledger Audit</option>
                  <option value="Other">Other Document</option>
                </SystemSelect>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Document File *</label>
                <input
                  type="file"
                  onChange={(e) => setDspEvFile(e.target.files?.[0] || null)}
                  required
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 p-2 text-xs outline-none focus:border-[#007AFF] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={dspEvNotes}
                  onChange={(e) => setDspEvNotes(e.target.value)}
                  placeholder="e.g. Stripe webhook log showing charge status."
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 p-2.5 outline-none focus:border-[#007AFF] focus:bg-white"
                />
              </div>

              {dspEvError && (
                <div role="alert" className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-2.5 text-xs text-[#1D1D1F]">
                  {dspEvError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setUploadDisputeEvidenceOpen(false)}
                  className="rounded-xl border border-black/[0.08] px-3.5 py-1.5 font-medium text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeActionLoading || !dspEvFile}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-1.5 font-medium text-white hover:bg-[#0066D6] disabled:opacity-50"
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
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#1D1D1F]" />
                <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">Finalize Dispute Decision</h3>
              </div>
              <button type="button" onClick={() => setDecisionDisputeOpen(false)} className="text-[#86868B] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFinalizeDecision} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Decision Action *</label>
                <SystemSelect
                  value={dspDecision}
                  onChange={(e) => setDspDecision(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white font-medium"
                >
                  <option value="ApproveReversal">Approve Financial Reversal (Refund)</option>
                  <option value="Decline">Decline Dispute (Valid Charge)</option>
                  <option value="NeedMoreInfo">Need More Info (Request Evidence)</option>
                </SystemSelect>
              </div>

              {dspDecision === 'ApproveReversal' && (
                <div>
                  <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Approved Reversal Amount (MYR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={dspApprovedAmount}
                    onChange={(e) => setDspApprovedAmount(e.target.value)}
                    required
                    className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white font-semibold"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Decision Justification *</label>
                <textarea
                  rows={3}
                  value={dspDecisionReason}
                  onChange={(e) => setDspDecisionReason(e.target.value)}
                  required
                  placeholder="e.g. Verified double deduction on bank record"
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 p-2.5 outline-none focus:border-[#007AFF] focus:bg-white"
                />
              </div>

              {dspDecisionError && (
                <div role="alert" className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-2.5 text-xs text-[#1D1D1F]">
                  {dspDecisionError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setDecisionDisputeOpen(false)}
                  className="rounded-xl border border-black/[0.08] px-3.5 py-1.5 font-medium text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-1.5 font-medium text-white hover:bg-[#0066D6] disabled:opacity-50"
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
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-[#1D1D1F]" />
                <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">Link Ticket to Dispute</h3>
              </div>
              <button type="button" onClick={() => setLinkTicketDisputeOpen(false)} className="text-[#86868B] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleLinkTicketToDispute} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Ticket Reference or ID *</label>
                <input
                  type="text"
                  value={dspLinkTicketId}
                  onChange={(e) => setDspLinkTicketId(e.target.value)}
                  required
                  placeholder="e.g. TKT-2026-35442 or 8"
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white font-mono text-xs"
                />
                <p className="text-[10px] text-[#86868B] mt-1">
                  Connect ticket to dispute #{selectedDisputeDetail.disputeReference}
                </p>
              </div>

              {dspLinkTicketError && (
                <div role="alert" className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-2.5 text-xs text-[#1D1D1F]">
                  {dspLinkTicketError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setLinkTicketDisputeOpen(false)}
                  className="rounded-xl border border-black/[0.08] px-3.5 py-1.5 font-medium text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-1.5 font-medium text-white hover:bg-[#0066D6] disabled:opacity-50"
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
              <h2 className="text-lg font-semibold tracking-tight text-[#1D1D1F]">
                24/7 On-Call Escalation & Alert Management
              </h2>
              <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-medium text-[#6E6E73] border border-black/[0.08]">
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
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs font-medium text-[#1D1D1F] hover:bg-[#F5F5F7]"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 text-[#6E6E73]', loadingOnCall && 'animate-spin text-[#007AFF]')} />
              <span>Refresh Roster</span>
            </button>
            <button
              type="button"
              onClick={() => setTestAlertOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs font-medium text-[#1D1D1F] hover:bg-[#F5F5F7]"
            >
              <Bell className="h-3.5 w-3.5 text-[#6E6E73]" />
              <span>Test Alert Dispatch</span>
            </button>
            <button
              type="button"
              onClick={() => setEditPolicyOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#007AFF] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#0066D6]"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Configure Policy Delays</span>
            </button>
          </div>
        </div>

        {/* Active Shift Header Banner */}
        <section className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#1D1D1F]">
                <BellRing className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">
                    {onCallStatus?.shiftName || '24/7 Primary Shift'}
                  </h3>
                  <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-medium text-[#1D1D1F] border border-black/[0.08] flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
                    Active Shift
                  </span>
                </div>
                <p className="text-xs text-[#6E6E73] mt-0.5">
                  Shift Window: {formatDateTime(onCallStatus?.shiftStart)} &mdash; {formatDateTime(onCallStatus?.shiftEnd)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">Active Channels:</span>
              {(onCallStatus?.activeChannels || ['Push', 'SMS', 'Phone', 'Email']).map((ch) => (
                <span
                  key={ch}
                  className="rounded-full bg-[#F5F5F7] border border-black/[0.06] px-2.5 py-0.5 text-[10px] font-medium text-[#1D1D1F]"
                >
                  {ch}
                </span>
              ))}
              <span className="rounded-full bg-[#F5F5F7] border border-black/[0.08] px-2.5 py-0.5 text-[10px] font-medium text-[#6E6E73]">
                Auto-Escalation: {policy?.autoEscalateEnabled !== false ? 'Enforced' : 'Disabled'}
              </span>
            </div>
          </div>
        </section>

        {/* Recent Test Alert Feedback Banner */}
        {testAlertResult && (
          <div className="rounded-2xl border border-black/[0.08] bg-[#F5F5F7] p-3.5 space-y-1 text-xs">
            <div className="flex items-center justify-between font-semibold text-[#1D1D1F]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#34C759]" />
                <span>Test Notification Dispatched Successfully</span>
              </div>
              <span className="font-mono text-[10px] text-[#86868B]">{formatDateTime(testAlertResult.timestamp)}</span>
            </div>
            <p className="text-[#6E6E73]">
              Provider confirmed delivery to <strong className="text-[#1D1D1F]">{testAlertResult.recipient}</strong> over <strong className="text-[#1D1D1F]">{testAlertResult.channel}</strong> channel.
            </p>
            <p className="text-[11px] text-[#86868B] italic">{testAlertResult.detail}</p>
          </div>
        )}

        {/* Four-Tier Responder Hierarchy Cards */}
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {/* L0 Primary */}
          <div className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-medium text-[#1D1D1F] border border-black/[0.08]">
                  Tier 1 · Primary Lead
                </span>
                <span className="text-[10px] text-[#86868B] font-mono">L0</span>
              </div>
              <h4 className="mt-2.5 text-sm font-semibold text-[#1D1D1F]">{primary?.name || 'Unassigned'}</h4>
              <p className="text-xs text-[#6E6E73] truncate mt-0.5">{primary?.email || 'oncall@parkjom.com'}</p>
              <p className="text-xs font-mono text-[#1D1D1F] mt-1">{primary?.phone || '011-16326494'}</p>
            </div>
            <div className="pt-2 border-t border-black/[0.04] text-[10px] text-[#86868B] font-mono flex items-center justify-between">
              <span>Immediate Triage</span>
              <span>0m delay</span>
            </div>
          </div>

          {/* L1 Backup */}
          <div className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-medium text-[#1D1D1F] border border-black/[0.08]">
                  Tier 2 · Backup Responder
                </span>
                <span className="text-[10px] text-[#86868B] font-mono">L1</span>
              </div>
              <h4 className="mt-2.5 text-sm font-semibold text-[#1D1D1F]">{backup?.name || 'Standby Backup Responder'}</h4>
              <p className="text-xs text-[#6E6E73] truncate mt-0.5">{backup?.email || 'backup-duty@parkjom.com'}</p>
              <p className="text-xs font-mono text-[#1D1D1F] mt-1">{backup?.phone || 'Automated Failover'}</p>
            </div>
            <div className="pt-2 border-t border-black/[0.04] text-[10px] text-[#86868B] font-mono flex items-center justify-between">
              <span>P0 Timeout Trigger</span>
              <span>+{policy?.p0BackupDelayMinutes ?? 2}m</span>
            </div>
          </div>

          {/* L2 Supervisor */}
          <div className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-medium text-[#1D1D1F] border border-black/[0.08]">
                  Tier 3 · Supervisor
                </span>
                <span className="text-[10px] text-[#86868B] font-mono">L2</span>
              </div>
              <h4 className="mt-2.5 text-sm font-semibold text-[#1D1D1F]">{supervisor?.name || 'Operations Supervisor'}</h4>
              <p className="text-xs text-[#6E6E73] truncate mt-0.5">{supervisor?.email || 'supervisor@parkjom.com'}</p>
              <p className="text-xs font-mono text-[#1D1D1F] mt-1">{supervisor?.phone || 'Multi-Channel Alert'}</p>
            </div>
            <div className="pt-2 border-t border-black/[0.04] text-[10px] text-[#86868B] font-mono flex items-center justify-between">
              <span>P0 Timeout Trigger</span>
              <span>+{policy?.p0SupervisorDelayMinutes ?? 5}m</span>
            </div>
          </div>

          {/* L3 Operations Manager */}
          <div className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-medium text-[#1D1D1F] border border-black/[0.08]">
                  Tier 4 · Ops Manager
                </span>
                <span className="text-[10px] text-[#86868B] font-mono">L3</span>
              </div>
              <h4 className="mt-2.5 text-sm font-semibold text-[#1D1D1F]">{manager?.name || 'Head of Operations'}</h4>
              <p className="text-xs text-[#6E6E73] truncate mt-0.5">{manager?.email || 'ops-director@parkjom.com'}</p>
              <p className="text-xs font-mono text-[#1D1D1F] mt-1">{manager?.phone || 'Executive Escalation'}</p>
            </div>
            <div className="pt-2 border-t border-black/[0.04] text-[10px] text-[#86868B] font-mono flex items-center justify-between">
              <span>P0 Timeout Trigger</span>
              <span>+{policy?.p0ManagerDelayMinutes ?? 15}m</span>
            </div>
          </div>
        </div>

        {/* Live Escalation Policy Matrix Table */}
        <section className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">Escalation Timeout Rules & Fallback Policy</h3>
              <p className="text-xs text-[#6E6E73]">Configured timeout delays before incident escalates to higher staff tiers</p>
            </div>
            <button
              type="button"
              onClick={() => setEditPolicyOpen(true)}
              className="text-xs font-medium text-[#007AFF] hover:underline cursor-pointer"
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
              },
              {
                tier: 'Level 1',
                role: 'Backup Escalation',
                responder: backup?.name || 'Secondary On-Call',
                p0: `+${policy?.p0BackupDelayMinutes ?? 2} mins`,
                p1: `+${policy?.p1BackupDelayMinutes ?? 5} mins`,
                method: 'Push + SMS + Phone',
              },
              {
                tier: 'Level 2',
                role: 'Supervisor Escalation',
                responder: supervisor?.name || 'Operations Supervisor',
                p0: `+${policy?.p0SupervisorDelayMinutes ?? 5} mins`,
                p1: `+${policy?.p1SupervisorDelayMinutes ?? 15} mins`,
                method: 'Push + SMS + Phone + Email',
              },
              {
                tier: 'Level 3',
                role: 'Management Escalation',
                responder: manager?.name || 'Head of Operations',
                p0: `+${policy?.p0ManagerDelayMinutes ?? 15} mins`,
                p1: `+${policy?.p1ManagerDelayMinutes ?? 30} mins`,
                method: 'All Broadcast Channels',
              },
            ].map((item, idx) => (
              <div key={idx} className="rounded-xl border border-black/[0.06] bg-[#F5F5F7]/60 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-white border border-black/[0.08] px-2 py-0.5 text-[10px] font-medium text-[#1D1D1F]">
                      {item.tier}
                    </span>
                    <span className="font-semibold text-[#1D1D1F] text-xs">{item.role}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#6E6E73]">{item.method}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-black/[0.04]">
                  <span className="text-[#6E6E73]">
                    Target: <strong className="text-[#1D1D1F] font-medium">{item.responder}</strong>
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-[#1D1D1F]">
                    <span>P0: {item.p0}</span>
                    <span>P1: {item.p1}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[580px] text-left text-xs">
              <thead>
                <tr className="border-b border-black/[0.06] text-[10px] uppercase font-semibold text-[#86868B]">
                  <th className="pb-2">Escalation Tier</th>
                  <th className="pb-2">Target Responder</th>
                  <th className="pb-2">P0 Emergency Timeout</th>
                  <th className="pb-2">P1 High Priority Timeout</th>
                  <th className="pb-2">Notification Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                <tr>
                  <td className="py-2.5 font-semibold text-[#1D1D1F]">Level 0 (Initial Dispatch)</td>
                  <td className="py-2.5 text-[#6E6E73]">{primary?.name || 'Primary Responder'}</td>
                  <td className="py-2.5 font-mono text-[#1D1D1F]">Immediate (0 min)</td>
                  <td className="py-2.5 font-mono text-[#1D1D1F]">Immediate (0 min)</td>
                  <td className="py-2.5 font-mono text-[11px] text-[#6E6E73]">Push + SMS</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold text-[#1D1D1F]">Level 1 (Backup Escalation)</td>
                  <td className="py-2.5 text-[#6E6E73]">{backup?.name || 'Secondary On-Call'}</td>
                  <td className="py-2.5 font-mono text-[#1D1D1F]">{policy?.p0BackupDelayMinutes ?? 2} minutes</td>
                  <td className="py-2.5 font-mono text-[#1D1D1F]">{policy?.p1BackupDelayMinutes ?? 5} minutes</td>
                  <td className="py-2.5 font-mono text-[11px] text-[#6E6E73]">Push + SMS + Phone</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold text-[#1D1D1F]">Level 2 (Supervisor Escalation)</td>
                  <td className="py-2.5 text-[#6E6E73]">{supervisor?.name || 'Operations Supervisor'}</td>
                  <td className="py-2.5 font-mono text-[#1D1D1F]">{policy?.p0SupervisorDelayMinutes ?? 5} minutes</td>
                  <td className="py-2.5 font-mono text-[#1D1D1F]">{policy?.p1SupervisorDelayMinutes ?? 15} minutes</td>
                  <td className="py-2.5 font-mono text-[11px] text-[#6E6E73]">Push + SMS + Phone + Email</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold text-[#1D1D1F]">Level 3 (Management Escalation)</td>
                  <td className="py-2.5 text-[#6E6E73]">{manager?.name || 'Head of Operations'}</td>
                  <td className="py-2.5 font-mono text-[#1D1D1F]">{policy?.p0ManagerDelayMinutes ?? 15} minutes</td>
                  <td className="py-2.5 font-mono text-[#1D1D1F]">{policy?.p1ManagerDelayMinutes ?? 30} minutes</td>
                  <td className="py-2.5 font-mono text-[11px] text-[#6E6E73]">All Broadcast Channels</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Test Alert Notification Modal ── */}
        {testAlertOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-[#1D1D1F]" />
                  <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">Test On-Call Alert Notification</h3>
                </div>
                <button type="button" onClick={() => setTestAlertOpen(false)} className="text-[#86868B] hover:text-[#1D1D1F]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleTestAlert} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Dispatch Channel *</label>
                  <SystemSelect
                    value={testAlertChannel}
                    onChange={(e) => setTestAlertChannel(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white font-medium"
                  >
                    <option value="Push">Push Notification</option>
                    <option value="SMS">SMS Text Alert</option>
                    <option value="Phone">Automated Phone Call</option>
                    <option value="Email">Emergency Email Broadcast</option>
                  </SystemSelect>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Recipient (Email / Phone) *</label>
                    <input
                      type="text"
                      value={testAlertRecipient}
                      onChange={(e) => setTestAlertRecipient(e.target.value)}
                      required
                      placeholder="oncall@parkjom.com or +6012..."
                      className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Target User ID</label>
                    <input
                      type="number"
                      value={testAlertUserId}
                      onChange={(e) => setTestAlertUserId(Number(e.target.value))}
                      className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 outline-none focus:border-[#007AFF] focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">Alert Message *</label>
                  <textarea
                    rows={2}
                    value={testAlertMessage}
                    onChange={(e) => setTestAlertMessage(e.target.value)}
                    required
                    className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 p-2.5 outline-none focus:border-[#007AFF] focus:bg-white"
                  />
                </div>

                {testAlertError && (
                  <div role="alert" className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-2.5 text-xs text-[#1D1D1F]">
                    {testAlertError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                  <button
                    type="button"
                    onClick={() => setTestAlertOpen(false)}
                    className="rounded-xl border border-black/[0.08] px-3.5 py-1.5 font-medium text-[#6E6E73] hover:bg-[#F5F5F7]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={testingAlert}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-1.5 font-medium text-white hover:bg-[#0066D6] disabled:opacity-50"
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
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-[#1D1D1F]" />
                  <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">Configure Escalation Delays & Policy</h3>
                </div>
                <button type="button" onClick={() => setEditPolicyOpen(false)} className="text-[#86868B] hover:text-[#1D1D1F]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSavePolicy} className="space-y-4 text-xs">
                {/* P0 Delays */}
                <div className="rounded-xl border border-black/[0.06] bg-[#F5F5F7]/70 p-3.5 space-y-2.5">
                  <span className="text-[11px] font-semibold text-[#1D1D1F] uppercase tracking-wider block">
                    P0 Emergency Escalation Delays (Minutes)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-[#6E6E73] mb-1">L1 Backup Delay</label>
                      <input
                        type="number"
                        min="1"
                        value={p0BackupDelay}
                        onChange={(e) => setP0BackupDelay(Number(e.target.value))}
                        required
                        className="w-full rounded-xl border border-black/[0.08] p-2 bg-white outline-none focus:border-[#007AFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[#6E6E73] mb-1">L2 Supervisor</label>
                      <input
                        type="number"
                        min="1"
                        value={p0SupervisorDelay}
                        onChange={(e) => setP0SupervisorDelay(Number(e.target.value))}
                        required
                        className="w-full rounded-xl border border-black/[0.08] p-2 bg-white outline-none focus:border-[#007AFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[#6E6E73] mb-1">L3 Manager</label>
                      <input
                        type="number"
                        min="1"
                        value={p0ManagerDelay}
                        onChange={(e) => setP0ManagerDelay(Number(e.target.value))}
                        required
                        className="w-full rounded-xl border border-black/[0.08] p-2 bg-white outline-none focus:border-[#007AFF]"
                      />
                    </div>
                  </div>
                </div>

                {/* P1 Delays */}
                <div className="rounded-xl border border-black/[0.06] bg-[#F5F5F7]/70 p-3.5 space-y-2.5">
                  <span className="text-[11px] font-semibold text-[#1D1D1F] uppercase tracking-wider block">
                    P1 High Priority Escalation Delays (Minutes)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-[#6E6E73] mb-1">L1 Backup Delay</label>
                      <input
                        type="number"
                        min="1"
                        value={p1BackupDelay}
                        onChange={(e) => setP1BackupDelay(Number(e.target.value))}
                        required
                        className="w-full rounded-xl border border-black/[0.08] p-2 bg-white outline-none focus:border-[#007AFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[#6E6E73] mb-1">L2 Supervisor</label>
                      <input
                        type="number"
                        min="1"
                        value={p1SupervisorDelay}
                        onChange={(e) => setP1SupervisorDelay(Number(e.target.value))}
                        required
                        className="w-full rounded-xl border border-black/[0.08] p-2 bg-white outline-none focus:border-[#007AFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[#6E6E73] mb-1">L3 Manager</label>
                      <input
                        type="number"
                        min="1"
                        value={p1ManagerDelay}
                        onChange={(e) => setP1ManagerDelay(Number(e.target.value))}
                        required
                        className="w-full rounded-xl border border-black/[0.08] p-2 bg-white outline-none focus:border-[#007AFF]"
                      />
                    </div>
                  </div>
                </div>

                {/* Enabled Channels & Auto Escalation */}
                <div>
                  <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1.5">Enabled Notification Channels</label>
                  <div className="flex flex-wrap gap-2">
                    {['Push', 'SMS', 'Phone', 'Email'].map((channel) => {
                      const isChecked = policyChannels.includes(channel);
                      return (
                        <label
                          key={channel}
                          className={cn(
                            'flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition',
                            isChecked ? 'border-[#1D1D1F] bg-[#1D1D1F] text-white' : 'border-black/[0.08] bg-[#F5F5F7] text-[#6E6E73]'
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
                            className="sr-only"
                          />
                          <span>{channel}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="font-medium text-xs text-[#1D1D1F]">Automated Escalation Engine</p>
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
                  <div role="alert" className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-2.5 text-xs text-[#1D1D1F]">
                    {policyError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-black/[0.06]">
                  <button
                    type="button"
                    onClick={() => setEditPolicyOpen(false)}
                    className="rounded-xl border border-black/[0.08] px-3.5 py-1.5 font-medium text-[#6E6E73] hover:bg-[#F5F5F7]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPolicy}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-1.5 font-medium text-white hover:bg-[#0066D6] disabled:opacity-50"
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
              <h2 className="text-lg font-semibold tracking-tight text-[#1D1D1F]">
                Support & Incident Audit Trail
              </h2>
              <span className="rounded-full bg-[#F5F5F7] border border-black/[0.08] px-2.5 py-0.5 text-[10px] font-medium text-[#1D1D1F]">
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
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs font-medium text-[#1D1D1F] hover:bg-[#F5F5F7]"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 text-[#6E6E73]', loadingAudit && 'animate-spin text-[#007AFF]')} />
              <span>Refresh Log</span>
            </button>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="flex flex-col gap-2.5 rounded-2xl border border-black/[0.06] bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <label htmlFor="audit-filter-select" className="text-xs font-medium text-[#6E6E73] shrink-0">Entity Type:</label>
            <div className="relative min-w-[170px]">
              <SystemSelect
                id="audit-filter-select"
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="min-h-8 w-full cursor-pointer appearance-none rounded-xl border border-black/[0.08] bg-[#F5F5F7]/70 pl-3 pr-8 text-xs font-medium text-[#1D1D1F] outline-none hover:bg-[#F5F5F7] focus:border-[#007AFF] focus:bg-white transition"
              >
                <option value="All">All Entities</option>
                <option value="Ticket">Ticket Events</option>
                <option value="Incident">Incident Events</option>
                <option value="Dispute">Dispute Events</option>
                <option value="OnCall">On-Call Alerts</option>
              </SystemSelect>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#86868B]" />
            <input
              type="search"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Search reference, action, user..."
              className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/70 pl-8 pr-3 py-1.5 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white"
            />
          </div>
        </div>

        {/* Audit Events Stream */}
        <section className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
          {loadingAudit ? (
            <div className="flex h-48 items-center justify-center text-xs text-[#86868B]">
              <Loader2 className="h-5 w-5 animate-spin text-[#007AFF]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#86868B]">
              <History className="h-8 w-8 mx-auto text-[#86868B]/40 mb-2" />
              <p className="font-semibold text-[#1D1D1F]">No audit log events matched</p>
              <p className="text-[11px] mt-0.5">Try clearing filters or check another entity type.</p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.04]">
              {filtered.map((ev) => (
                <div key={ev.auditEventId} className="p-3.5 sm:p-4 hover:bg-[#F5F5F7]/50 transition flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[#86868B]">#{ev.auditEventId}</span>
                      <span className="rounded-full bg-[#F5F5F7] border border-black/[0.08] px-2 py-0.5 text-[9px] font-medium text-[#1D1D1F]">
                        {ev.objectType}
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#1D1D1F]">
                        {ev.objectReference}
                      </span>
                      <span className="rounded-full bg-[#F5F5F7] border border-black/[0.06] px-2 py-0.5 text-[10px] font-medium text-[#6E6E73]">
                        {ev.action}
                      </span>
                    </div>

                    <span className="text-[10px] text-[#86868B] font-mono">
                      {formatDateTime(ev.timestamp)}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-1">
                    <p className="text-[#1D1D1F] text-xs">
                      {ev.detail || `Action performed on ${ev.objectReference}`}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-[#6E6E73] shrink-0">
                      <span>Actor: <strong className="text-[#1D1D1F] font-medium">{ev.actorName}</strong></span>
                      <span className="rounded-full bg-[#F5F5F7] border border-black/[0.06] px-2 py-0.5 text-[9px] font-medium text-[#6E6E73]">
                        {ev.actorRole}
                      </span>
                      {(ev.previousState || ev.newState) && (
                        <span className="font-mono text-[10px] text-[#86868B]">
                          ({ev.previousState || 'None'} &rarr; {ev.newState || 'Current'})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  };

  return (
    <div className="space-y-4" data-component="admin-support-dashboard">
      {/* Persistent Top Segmented Navigation Bar for the 6 SUPPORT_API.ADMIN Modules */}
      <section className="rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-1.5 dark:border-white/10 dark:bg-[#141417]">
        <div className="flex flex-wrap items-center gap-1">
          {adminNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all',
                  isActive
                    ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-[#242429] dark:text-white dark:shadow-none'
                    : 'text-[#6E6E73] hover:text-[#1D1D1F] dark:text-[#A1A1AA] dark:hover:text-white dark:hover:bg-white/[0.06]'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                      isActive
                        ? 'bg-[#F5F5F7] text-[#1D1D1F] dark:bg-white/10 dark:text-white'
                        : 'bg-white/80 text-[#6E6E73] dark:bg-white/[0.08] dark:text-[#A1A1AA]'
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Floating Notice Toast */}
      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-black/[0.06] bg-white px-4 py-2.5 text-xs font-medium text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-[#18181C] dark:text-white"
        >
          <CheckCircle2 className="h-4 w-4 text-[#34C759]" />
          <span>{notice}</span>
        </div>
      )}

      {/* Dynamic Views (SUPPORT_API.ADMIN Modules Only) */}
      {activeView === 'command' && renderCommandCenter()}
      {activeView === 'tickets' && ticketWorkspace}
      {activeView === 'incidents' && renderIncidents()}
      {activeView === 'disputes' && renderDisputes()}
      {activeView === 'on-call' && renderOnCall()}
      {activeView === 'audit' && renderAuditLogs()}
    </div>
  );
}
