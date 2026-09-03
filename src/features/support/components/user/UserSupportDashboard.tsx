import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  AlertOctagon,
  ArrowLeft,
  ArrowRight,
  Bot,
  CalendarClock,
  Car,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  CreditCard,
  FileCheck2,
  FileSearch,
  HelpCircle,
  Landmark,
  LifeBuoy,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Radio,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  TicketCheck,
  User,
  UserCheck,
  UserRound,
  Wallet,
  WalletCards,
  Workflow,
  Wrench,
  X,
  ExternalLink,
  FileText,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';
import {
  createAutobotMessage,
  generateAutobotReply,
  loadPersistedBotMessages,
  persistBotMessage,
} from '../../services/supportBotService';
import { cn } from '@/lib/utils';
import {
  closeCustomerConversation,
  escalateConversationToTicket,
  getConversationDetails,
  listMyConversations,
  sendCustomerConversationMessage,
  startConversation,
} from '../../api/supportConversationService';
import {
  customerUploadDisputeEvidence,
  getCustomerDisputeDetails,
  listMyDisputes,
} from '../../api/supportDisputeService';
import { createSupportTicket } from '../../api/supportTicketService';
import {
  executeWorkflowRun,
  getSupportContext,
  getWorkflowRunStatus,
  listSupportWorkflows,
} from '../../api/supportWorkflowService';
import type {
  CustomerDisputeDetail,
  CustomerDisputeItem,
  SupportBookingContext,
  SupportContextData,
  SupportConversation,
  SupportConversationDetail,
  SupportConversationMessage,
  SupportVehicleContext,
  SupportViewer,
  SupportWorkflowDefinition,
  SupportWorkflowRun,
} from '../../types';

interface UserSupportDashboardProps {
  viewer: SupportViewer;
  ticketWorkspace: ReactNode;
}

type UserView = 'home' | 'quick-help' | 'live-chat' | 'cases' | 'disputes';

// Built-in fallback workflows matching the backend preset schema
const fallbackWorkflows: SupportWorkflowDefinition[] = [
  {
    workflowKey: 'parking-access',
    title: 'I cannot enter or exit',
    description: 'Urgent gate, barrier, or parking entry/exit issues.',
    version: '1.0',
    category: 'ParkingAccess',
    estimatedResponseTime: '24/7 Immediate triage',
    options: [
      { key: 'enter', label: 'Cannot Enter Gate/Barrier', description: 'Unable to pass entry barrier or scanner not responding' },
      { key: 'exit', label: 'Cannot Exit Parking', description: 'Barrier will not open to exit the parking facility' },
      { key: 'validation', label: 'Plate/QR Validation Failed', description: 'Camera or QR reader failed to validate booking' },
    ],
    steps: [
      { stepId: 'issue', question: 'Are you trying to enter or exit?', type: 'choice', allowedAnswers: ['enter', 'exit', 'validation'], required: true },
      { stepId: 'trapped', question: 'Are you or your vehicle currently trapped inside or outside?', type: 'choice', allowedAnswers: ['yes', 'no'], required: true },
      { stepId: 'safetyRisk', question: 'Is there any immediate safety hazard or blocking traffic?', type: 'choice', allowedAnswers: ['yes', 'no'], required: true },
    ],
  },
  {
    workflowKey: 'booking',
    title: 'Booking problem',
    description: 'Issues with booking details, cancellation, timing, or missing reservations.',
    version: '1.0',
    category: 'Booking',
    estimatedResponseTime: 'Within 15 minutes',
    options: [
      { key: 'missing', label: 'Booking not found', description: 'Confirmed booking is not showing up in your account' },
      { key: 'location', label: 'Wrong parking location', description: 'Booking assigned to incorrect property or spot' },
      { key: 'cancel', label: 'Cannot cancel booking', description: 'Cancel button not available or error during cancellation' },
      { key: 'time', label: 'Incorrect booking time', description: 'Start or end time is different from expected' },
      { key: 'expired', label: 'Booking shown as expired', description: 'Booking marked expired prematurely' },
      { key: 'other', label: 'Other booking issue', description: 'General booking inquiry' },
    ],
    steps: [
      { stepId: 'issue', question: 'What problem are you experiencing with your booking?', type: 'choice', allowedAnswers: ['missing', 'location', 'cancel', 'time', 'expired', 'other'], required: true },
      { stepId: 'details', question: 'Please describe the issue or desired modification:', type: 'text', allowedAnswers: [], required: false },
    ],
  },
  {
    workflowKey: 'payment-refund',
    title: 'Payment or refund issue',
    description: 'Inquiries regarding charges, duplicate debits, refund status, or disputes.',
    version: '1.0',
    category: 'Payment',
    estimatedResponseTime: 'Within 30 minutes',
    options: [
      { key: 'paid-missing', label: 'Payment successful but booking missing', description: 'Card/Wallet charged but no booking created' },
      { key: 'refund', label: 'Refund status inquiry', description: 'Checking status of pending refund' },
      { key: 'failed', label: 'Payment failed', description: 'Payment checkout failed or timed out' },
      { key: 'duplicate', label: 'Charged twice (Duplicate charge)', description: 'Double debit for the same booking session' },
      { key: 'unknown', label: 'Unrecognized charge', description: 'I do not recognize this transaction on my statement' },
      { key: 'other', label: 'Other payment issue', description: 'Other wallet or card related issues' },
    ],
    steps: [
      { stepId: 'issue', question: 'What type of payment issue are you reporting?', type: 'choice', allowedAnswers: ['paid-missing', 'refund', 'failed', 'duplicate', 'unknown', 'other'], required: true },
      { stepId: 'transactionRef', question: 'Transaction or Reference Number (if available):', type: 'text', allowedAnswers: [], required: false },
    ],
  },
  {
    workflowKey: 'account-vehicle-owner',
    title: 'Account, vehicle or owner support',
    description: 'Help with profile verification, vehicle details, or host payouts.',
    version: '1.0',
    category: 'Account',
    estimatedResponseTime: 'Within 1 hour',
    options: [
      { key: 'account-access', label: 'Cannot access account / Login problem', description: 'Password, OTP, or account locked' },
      { key: 'vehicle', label: 'Vehicle information incorrect', description: 'Plate number update or vehicle registration error' },
      { key: 'verification', label: 'Account or spot verification status', description: 'Pending identity or spot document review' },
      { key: 'payout', label: 'Owner payout status', description: 'Host withdrawal or earnings status' },
      { key: 'listing', label: 'Parking listing problem', description: 'Host spot listing, rates, or calendar configuration' },
      { key: 'payout-dispute', label: 'Owner payout dispute', description: 'Disagreement on commission or payout amount' },
      { key: 'security', label: 'Account security / Impersonation', description: 'Suspected unauthorized access or compromised credentials' },
    ],
    steps: [
      { stepId: 'issue', question: 'Select the specific issue:', type: 'choice', allowedAnswers: ['account-access', 'vehicle', 'verification', 'payout', 'listing', 'payout-dispute', 'security'], required: true },
    ],
  },
];

const ownerFallbackWorkflows: SupportWorkflowDefinition[] = [
  {
    workflowKey: 'barrier-iot-offline',
    title: 'IoT Barrier & Sensor Disruption',
    description: 'Hardware gate controller offline, heartbeat timeout, or vehicle sensor malfunction.',
    version: '1.0',
    category: 'Hardware',
    estimatedResponseTime: 'Immediate IoT Operations Triage',
    options: [
      { key: 'gateway-offline', label: 'ESP32 / Barrier Controller Offline', description: 'Controller missed heartbeats for over 10 minutes' },
      { key: 'arm-stuck', label: 'Barrier Arm Stuck or Mechanical Jam', description: 'Barrier arm will not raise or lower on command' },
      { key: 'loop-sensor', label: 'Ground Loop Detector Fault', description: 'Sensor not detecting vehicles entering bay' },
    ],
    steps: [
      { stepId: 'issue', question: 'What hardware failure are you experiencing?', type: 'choice', allowedAnswers: ['gateway-offline', 'arm-stuck', 'loop-sensor'], required: true },
      { stepId: 'hazard', question: 'Is the barrier currently blocking incoming or outgoing traffic?', type: 'choice', allowedAnswers: ['yes', 'no'], required: true },
    ],
  },
  {
    workflowKey: 'commuter-overstay',
    title: 'Commuter Overstay Violation',
    description: 'A vehicle has remained parked past its reserved booking time.',
    version: '1.0',
    category: 'Operations',
    estimatedResponseTime: 'Within 10 minutes',
    options: [
      { key: 'blocking-next', label: 'Overstay Blocking Next Reservation', description: 'Next scheduled commuter is unable to park' },
      { key: 'extended-unpaid', label: 'Prolonged Unpaid Overstay (>1 hr)', description: 'Vehicle still occupying bay without paying extension' },
    ],
    steps: [
      { stepId: 'issue', question: 'What is the nature of the overstay?', type: 'choice', allowedAnswers: ['blocking-next', 'extended-unpaid'], required: true },
      { stepId: 'vehiclePlate', question: 'Offending vehicle license plate number:', type: 'text', allowedAnswers: [], required: true },
    ],
  },
  {
    workflowKey: 'host-payout-dispute',
    title: 'Host Payout & Earnings Settlement',
    description: 'Inquiries regarding monthly withdrawal, commission fee breakdown, or bank deposit.',
    version: '1.0',
    category: 'Payment',
    estimatedResponseTime: 'Within 30 minutes',
    options: [
      { key: 'payout-delayed', label: 'Pending Payout Withdrawal Delayed', description: 'Payout requested but not yet deposited in bank' },
      { key: 'commission-calc', label: 'Platform Fee / Commission Discrepancy', description: 'Question regarding platform fee deduction' },
      { key: 'penalty-credit', label: 'Overstay Penalty Not Credited', description: 'Penalty fine paid by commuter not showing in balance' },
    ],
    steps: [
      { stepId: 'issue', question: 'What is your payout inquiry?', type: 'choice', allowedAnswers: ['payout-delayed', 'commission-calc', 'penalty-credit'], required: true },
    ],
  },
  {
    workflowKey: 'bay-calibration',
    title: 'Bay Listing & Sensor Calibration',
    description: 'Update parking bay photo verification, camera angle, or fix false occupancy reports.',
    version: '1.0',
    category: 'Account',
    estimatedResponseTime: 'Within 1 hour',
    options: [
      { key: 'false-occupied', label: 'Bay Shown As Occupied When Empty', description: 'Sensor false positive reporting bay as occupied' },
      { key: 'spot-photos', label: 'Update Spot Photos & Verification', description: 'Submit updated bay photographs for admin verification' },
    ],
    steps: [
      { stepId: 'issue', question: 'What configuration help is required?', type: 'choice', allowedAnswers: ['false-occupied', 'spot-photos'], required: true },
    ],
  },
];

const navigation: { id: UserView; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Help Center', icon: LifeBuoy },
  { id: 'quick-help', label: 'Quick Triage', icon: Workflow },
  { id: 'live-chat', label: 'Live Assistant', icon: MessagesSquare },
  { id: 'cases', label: 'My Tickets', icon: TicketCheck },
  { id: 'disputes', label: 'Disputes & Refunds', icon: ShieldAlert },
];

function getCategoryMeta(category: string, workflowKey: string): { icon: LucideIcon; badge: string; isUrgent?: boolean } {
  const normCategory = (category || '').toLowerCase();
  const normKey = (workflowKey || '').toLowerCase();

  if (normCategory.includes('access') || normKey.includes('access') || normKey.includes('barrier')) {
    return { icon: Siren, badge: '24/7 Urgent', isUrgent: true };
  }
  if (normCategory.includes('booking') || normKey.includes('booking')) {
    return { icon: CalendarClock, badge: 'Self-Service' };
  }
  if (normCategory.includes('payment') || normCategory.includes('refund') || normKey.includes('payment')) {
    return { icon: CreditCard, badge: 'Billing & Refund' };
  }
  if (normCategory.includes('hardware') || normKey.includes('hardware') || normKey.includes('bollard')) {
    return { icon: Wrench, badge: 'Hardware Triage' };
  }
  if (normCategory.includes('dispute') || normKey.includes('dispute') || normKey.includes('overstay')) {
    return { icon: ShieldAlert, badge: 'Dispute' };
  }
  if (normCategory.includes('account') || normCategory.includes('owner') || normKey.includes('account')) {
    return { icon: UserRound, badge: 'Account & Host' };
  }
  return { icon: Workflow, badge: 'Guided Triage' };
}

function formatContextDate(value?: string | null) {
  if (!value) return 'N/A';
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

function formatDateTime(value?: string | null) {
  return formatContextDate(value);
}

function mergeWithBotMessages(detail: SupportConversationDetail): SupportConversationDetail {
  const botMsgs = loadPersistedBotMessages(detail.conversationId);
  if (botMsgs.length === 0) return detail;
  const existingIds = new Set(detail.messages.map((m) => String(m.messageId)));
  const missingBotMsgs = botMsgs.filter((bm) => !existingIds.has(String(bm.messageId)));
  if (missingBotMsgs.length === 0) return detail;
  const combined = [...detail.messages, ...missingBotMsgs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  return { ...detail, messages: combined };
}

function renderFormattedBotText(text: string) {
  const paragraphs = text.split('\n');
  return paragraphs.map((para, pIdx) => {
    if (!para.trim()) {
      return <div key={pIdx} className="h-1.5" />;
    }
    const parts = para.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return (
      <p key={pIdx} className="leading-relaxed">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={idx} className="font-bold text-[#0F172A]">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith('*') && part.endsWith('*')) {
            return (
              <em key={idx} className="text-[#64748B] italic">
                {part.slice(1, -1)}
              </em>
            );
          }
          return part;
        })}
      </p>
    );
  });
}

export default function UserSupportDashboard({ viewer, ticketWorkspace }: UserSupportDashboardProps) {
  const isOwner = viewer.role === 'Owner';
  const viewerFirstName = useMemo(() => viewer.name.trim().split(/\s+/)[0] || 'there', [viewer.name]);
  const activeFallbackWorkflows = isOwner ? ownerFallbackWorkflows : fallbackWorkflows;

  // Views & Tab Navigation
  const [activeView, setActiveView] = useState<UserView>('home');

  // Backend Support Context state
  const [supportContext, setSupportContext] = useState<SupportContextData | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  // Backend Workflows state
  const [workflows, setWorkflows] = useState<SupportWorkflowDefinition[]>(activeFallbackWorkflows);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [workflowsError, setWorkflowsError] = useState<string | null>(null);

  // Workflow Selection & Execution state
  const [selectedWorkflowKey, setSelectedWorkflowKey] = useState<string>(activeFallbackWorkflows[0].workflowKey);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [workflowStep, setWorkflowStep] = useState<number>(1);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [workflowSubmitting, setWorkflowSubmitting] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowRunResult, setWorkflowRunResult] = useState<SupportWorkflowRun | null>(null);
  const [refreshingRunStatus, setRefreshingRunStatus] = useState(false);

  // Live Chat & Conversations state
  const [activeConversation, setActiveConversation] = useState<SupportConversationDetail | null>(null);
  const [myConversations, setMyConversations] = useState<SupportConversation[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [chatComposer, setChatComposer] = useState('');
  const [sendingChatMessage, setSendingChatMessage] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Escalation modal state
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [escalateSubject, setEscalateSubject] = useState('Unresolved live support session');
  const [escalateCategory, setEscalateCategory] = useState('ParkingAccess');
  const [escalatePriority, setEscalatePriority] = useState('P1');
  const [escalating, setEscalating] = useState(false);
  const [escalatedTicketRef, setEscalatedTicketRef] = useState<string | null>(null);

  // ── Customer Disputes State ──
  const [myDisputes, setMyDisputes] = useState<CustomerDisputeItem[]>([]);
  const [selectedDisputeId, setSelectedDisputeId] = useState<number | null>(null);
  const [selectedDisputeDetail, setSelectedDisputeDetail] = useState<CustomerDisputeDetail | null>(null);
  const [loadingDisputes, setLoadingDisputes] = useState(false);
  const [loadingDisputeDetail, setLoadingDisputeDetail] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  // Evidence upload form
  const [uploadEvidenceOpen, setUploadEvidenceOpen] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceType, setEvidenceType] = useState('BankReceipt');
  const [evidenceNotes, setEvidenceNotes] = useState('Bank statement showing payment deduction');
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [uploadEvidenceError, setUploadEvidenceError] = useState<string | null>(null);

  const loadCustomerDisputes = async () => {
    if (!viewer.token) return;
    setLoadingDisputes(true);
    setDisputeError(null);
    try {
      const items = await listMyDisputes(viewer.token);
      setMyDisputes(items);
      if (items.length > 0 && selectedDisputeId === null) {
        setSelectedDisputeId(items[0].disputeId);
      }
    } catch (err) {
      setDisputeError(err instanceof Error ? err.message : 'Unable to load your disputes.');
    } finally {
      setLoadingDisputes(false);
    }
  };

  useEffect(() => {
    if (viewer.token && activeView === 'disputes') {
      void loadCustomerDisputes();
    }
  }, [viewer.token, activeView]);

  useEffect(() => {
    if (!viewer.token || !selectedDisputeId) return;
    let active = true;
    setLoadingDisputeDetail(true);
    getCustomerDisputeDetails(viewer.token, selectedDisputeId)
      .then((detail) => {
        if (active) setSelectedDisputeDetail(detail);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingDisputeDetail(false);
      });
    return () => {
      active = false;
    };
  }, [viewer.token, selectedDisputeId]);

  const handleUploadCustomerEvidence = async (e: FormEvent) => {
    e.preventDefault();
    if (!viewer.token || !selectedDisputeId || !evidenceFile) return;
    setUploadingEvidence(true);
    setUploadEvidenceError(null);
    try {
      await customerUploadDisputeEvidence(
        viewer.token,
        selectedDisputeId,
        evidenceFile,
        evidenceType,
        evidenceNotes.trim() || undefined
      );
      setUploadEvidenceOpen(false);
      setEvidenceFile(null);
      const updated = await getCustomerDisputeDetails(viewer.token, selectedDisputeId);
      setSelectedDisputeDetail(updated);
    } catch (err) {
      setUploadEvidenceError(err instanceof Error ? err.message : 'Unable to upload evidence.');
    } finally {
      setUploadingEvidence(false);
    }
  };

  // Fetch Support Context on mount
  useEffect(() => {
    if (!viewer.token) return;
    let active = true;
    setLoadingContext(true);
    setContextError(null);

    getSupportContext(viewer.token, selectedBookingId, selectedVehicleId)
      .then((data) => {
        if (!active) return;
        setSupportContext(data);
        if (data.activeBooking?.bookingId && selectedBookingId === null) {
          setSelectedBookingId(data.activeBooking.bookingId);
        } else if (data.recentBookings?.[0]?.bookingId && selectedBookingId === null) {
          setSelectedBookingId(data.recentBookings[0].bookingId);
        }
        if (data.vehicles?.[0]?.vehicleId && selectedVehicleId === null) {
          setSelectedVehicleId(data.vehicles[0].vehicleId);
        }
      })
      .catch((err) => {
        if (!active) return;
        setContextError(err instanceof Error ? err.message : 'Unable to load support context.');
      })
      .finally(() => {
        if (active) setLoadingContext(false);
      });

    return () => {
      active = false;
    };
  }, [viewer.token]);

  // Fetch Workflows on mount
  useEffect(() => {
    if (!viewer.token) return;
    let active = true;
    setLoadingWorkflows(true);
    setWorkflowsError(null);

    listSupportWorkflows(viewer.token)
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data) && data.length > 0) {
          setWorkflows(data);
          if (!data.some((wf) => wf.workflowKey === selectedWorkflowKey)) {
            setSelectedWorkflowKey(data[0].workflowKey);
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        setWorkflowsError(err instanceof Error ? err.message : 'Unable to load dynamic workflows.');
      })
      .finally(() => {
        if (active) setLoadingWorkflows(false);
      });

    return () => {
      active = false;
    };
  }, [viewer.token]);

  // Fetch My Conversations when switching to live-chat
  const loadConversations = async () => {
    if (!viewer.token) return;
    try {
      const list = await listMyConversations(viewer.token, 'Open');
      setMyConversations(list);
      if (list.length > 0 && !activeConversation) {
        const rawDetail = await getConversationDetails(viewer.token, list[0].conversationId);
        setActiveConversation(mergeWithBotMessages(rawDetail));
      }
    } catch {
      // Continue gracefully
    }
  };

  useEffect(() => {
    if (activeView === 'live-chat') {
      void loadConversations();
    }
  }, [activeView, viewer.token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeConversation?.messages?.length, isBotTyping]);

  // Current active workflow object
  const currentWorkflow = useMemo(() => {
    return workflows.find((wf) => wf.workflowKey === selectedWorkflowKey) || workflows[0] || fallbackWorkflows[0];
  }, [workflows, selectedWorkflowKey]);

  // Contextual booking details
  const activeOrSelectedBooking = useMemo<SupportBookingContext | null>(() => {
    if (!supportContext) return null;
    if (selectedBookingId) {
      const match = supportContext.recentBookings.find((b) => b.bookingId === selectedBookingId);
      if (match) return match;
    }
    return supportContext.activeBooking || supportContext.recentBookings[0] || null;
  }, [supportContext, selectedBookingId]);

  // Contextual vehicle details
  const activeOrSelectedVehicle = useMemo<SupportVehicleContext | null>(() => {
    if (!supportContext) return null;
    if (selectedVehicleId) {
      const match = supportContext.vehicles.find((v) => v.vehicleId === selectedVehicleId);
      if (match) return match;
    }
    return supportContext.vehicles[0] || null;
  }, [supportContext, selectedVehicleId]);

  // Handler: Start a workflow
  const startWorkflow = (workflowKey: string) => {
    const wf = workflows.find((item) => item.workflowKey === workflowKey) || workflows[0] || fallbackWorkflows[0];
    setSelectedWorkflowKey(wf.workflowKey);
    const firstOptionKey = wf.options?.[0]?.key || '';
    setAnswers({ issue: firstOptionKey });
    setWorkflowStep(1);
    setWorkflowRunResult(null);
    setWorkflowError(null);
    setActiveView('quick-help');
  };

  // Handler: Update an answer
  const handleAnswerChange = (stepId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [stepId]: value }));
  };

  // Handler: Execute resolution run
  const runWorkflow = async () => {
    const missingStep = currentWorkflow.steps.find((step) => {
      if (!step.required) return false;
      const val = answers[step.stepId];
      return val === undefined || val === null || val === '';
    });

    if (missingStep) {
      setWorkflowError(`Please answer "${missingStep.question}" before continuing.`);
      return;
    }

    setWorkflowSubmitting(true);
    setWorkflowError(null);

    try {
      const run = await executeWorkflowRun(viewer.token, currentWorkflow.workflowKey, {
        answers,
        bookingId: selectedBookingId,
        vehicleId: selectedVehicleId,
        clientRequestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      });

      setWorkflowRunResult(run);
      setWorkflowStep(3);
    } catch (err) {
      setWorkflowError(err instanceof Error ? err.message : 'Unable to complete automated triage.');
    } finally {
      setWorkflowSubmitting(false);
    }
  };

  // Handler: Refresh Workflow Run Status
  const handleRefreshRunStatus = async () => {
    if (!workflowRunResult?.workflowRunId) return;
    setRefreshingRunStatus(true);
    try {
      const updated = await getWorkflowRunStatus(viewer.token, workflowRunResult.workflowRunId);
      setWorkflowRunResult(updated);
    } catch (err) {
      setWorkflowError(err instanceof Error ? err.message : 'Failed to refresh run status.');
    } finally {
      setRefreshingRunStatus(false);
    }
  };

  // ── Live Chat Actions using Real Backend Endpoints ──

  const handleStartChat = async (initialPrompt?: string) => {
    setLoadingConversation(true);
    setChatError(null);
    setEscalatedTicketRef(null);
    try {
      const initialText = initialPrompt || `Hello, I need assistance with my account and bookings.`;
      const started = await startConversation(viewer.token, {
        channel: 'LiveChat',
        initialMessage: initialText,
        bookingId: selectedBookingId || activeOrSelectedBooking?.bookingId || null,
      });

      const rawDetail = await getConversationDetails(viewer.token, started.conversationId);
      const detail = mergeWithBotMessages(rawDetail);
      setActiveConversation(detail);
      setActiveView('live-chat');
      void loadConversations();

      // Check if this conversation already has an autobot reply
      const existingBotMsgs = loadPersistedBotMessages(started.conversationId);
      if (existingBotMsgs.length === 0) {
        setIsBotTyping(true);
        window.setTimeout(() => {
          const replyText = generateAutobotReply(initialText, {
            userName: viewer.name,
            isOwner,
            bookingSpotName: activeOrSelectedBooking?.parkingSpotName,
            bookingRef: activeOrSelectedBooking?.bookingReference,
            vehiclePlate: activeOrSelectedVehicle?.licensePlate,
            walletBalance: supportContext?.walletBalance,
          });

          const botMsg = createAutobotMessage(started.conversationId, replyText);
          persistBotMessage(started.conversationId, botMsg);

          setActiveConversation((prev) => {
            if (!prev || prev.conversationId !== started.conversationId) return prev;
            return {
              ...prev,
              messages: [...prev.messages, botMsg],
            };
          });
          setIsBotTyping(false);
        }, 750);
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to start live chat.');
    } finally {
      setLoadingConversation(false);
    }
  };

  const handleSendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const msg = chatComposer.trim();
    if (!msg || !activeConversation) return;

    setSendingChatMessage(true);
    setChatError(null);

    try {
      await sendCustomerConversationMessage(viewer.token, activeConversation.conversationId, msg, false);
      setChatComposer('');
      const rawUpdated = await getConversationDetails(viewer.token, activeConversation.conversationId);
      const updated = mergeWithBotMessages(rawUpdated);
      setActiveConversation(updated);

      // If this conversation has no admin replies yet and no bot response yet:
      const hasAdminReply = updated.messages.some((m) => m.senderRole?.toLowerCase() === 'admin');
      const hasBotReply = updated.messages.some((m) => m.senderRole?.toLowerCase() === 'bot');

      if (!hasAdminReply && !hasBotReply) {
        setIsBotTyping(true);
        window.setTimeout(() => {
          const replyText = generateAutobotReply(msg, {
            userName: viewer.name,
            isOwner,
            bookingSpotName: activeOrSelectedBooking?.parkingSpotName,
            bookingRef: activeOrSelectedBooking?.bookingReference,
            vehiclePlate: activeOrSelectedVehicle?.licensePlate,
            walletBalance: supportContext?.walletBalance,
          });

          const botMsg = createAutobotMessage(activeConversation.conversationId, replyText);
          persistBotMessage(activeConversation.conversationId, botMsg);

          setActiveConversation((prev) => {
            if (!prev || prev.conversationId !== activeConversation.conversationId) return prev;
            return {
              ...prev,
              messages: [...prev.messages, botMsg],
            };
          });
          setIsBotTyping(false);
        }, 750);
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSendingChatMessage(false);
    }
  };

  const handleCloseChat = async () => {
    if (!activeConversation) return;
    setLoadingConversation(true);
    try {
      await closeCustomerConversation(viewer.token, activeConversation.conversationId, 'Customer ended conversation session');
      const rawUpdated = await getConversationDetails(viewer.token, activeConversation.conversationId);
      setActiveConversation(mergeWithBotMessages(rawUpdated));
      void loadConversations();
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to close chat.');
    } finally {
      setLoadingConversation(false);
    }
  };

  const handleEscalateToTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeConversation) return;

    setEscalating(true);
    setChatError(null);

    try {
      const result = await escalateConversationToTicket(viewer.token, activeConversation.conversationId, {
        subject: escalateSubject.trim(),
        category: escalateCategory,
        priority: escalatePriority,
      });

      const ticketRef = result?.ticketReference || result?.ticket?.ticketReference || `TKT-${new Date().getFullYear()}-${activeConversation.conversationId}`;
      setEscalatedTicketRef(ticketRef);
      setEscalateModalOpen(false);

      const rawUpdated = await getConversationDetails(viewer.token, activeConversation.conversationId);
      setActiveConversation(mergeWithBotMessages(rawUpdated));
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to escalate conversation to ticket.');
    } finally {
      setEscalating(false);
    }
  };

  // ── Render Home ──
  const renderHome = () => (
    <div className="space-y-5">
      {/* Hero Welcome Card */}
      <section className="rounded-lg border border-black/[0.06] bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#007AFF] animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73]">
                {isOwner ? 'Owner Support & Telemetry Center' : 'Commuter Support & Telemetry Center'}
              </span>
            </div>
            <h1 className="mt-1.5 text-xl font-bold tracking-tight text-[#1D1D1F] sm:text-2xl">
              How can we help you, {viewerFirstName}?
            </h1>
            <p className="mt-1 text-xs text-[#6E6E73]">
              {isOwner
                ? 'Get assistance with parking bay verification, smart bollards, commuter disputes, and weekly payouts.'
                : 'Need help entering a parking site, adjusting a booking, or resolving a charge? Run instant triage or chat with our team.'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {isOwner ? (
              <button
                type="button"
                onClick={() => startWorkflow('barrier-iot-offline')}
                className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <Wrench className="h-3.5 w-3.5 text-rose-600" />
                <span>IoT & Hardware Help</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startWorkflow(workflows.some((w) => w.workflowKey === 'parking-access') ? 'parking-access' : workflows[0]?.workflowKey)}
                className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <Siren className="h-3.5 w-3.5 text-rose-600" />
                <span>Gate & Access Help</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveView('live-chat')}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md bg-[#007AFF] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0066D6]"
            >
              <MessagesSquare className="h-3.5 w-3.5" />
              <span>{isOwner ? 'Host Live Chat' : 'Live Chat'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Live Context Telemetry Bar */}
      {supportContext && (
        <section className="rounded-lg border border-black/[0.06] bg-gradient-to-r from-[#FAFBFD] to-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-[#007AFF]">
                <Radio className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-[#0F172A]">Live Account Telemetry</h3>
                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                    Synced
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B]">
                  User: <span className="font-semibold text-[#0F172A]">{supportContext.userName}</span> ({isOwner ? 'Parking Space Host' : supportContext.userType}) · {isOwner ? 'Host Payout Balance' : 'Wallet'}: <span className="font-semibold text-emerald-600">RM {supportContext.walletBalance.toFixed(2)}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              {isOwner ? (
                <>
                  <div className="flex items-center gap-1.5 rounded-md border border-black/[0.06] bg-white px-3 py-1.5 shadow-2xs">
                    <Landmark className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    <div className="text-left">
                      <p className="text-[9px] text-[#8E8E93] leading-none">Registered Bays</p>
                      <p className="font-semibold text-[#0F172A] text-[11px]">3 Bays Active</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md border border-black/[0.06] bg-white px-3 py-1.5 shadow-2xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <div className="text-left">
                      <p className="text-[9px] text-[#8E8E93] leading-none">Gate IoT Gateway</p>
                      <p className="font-semibold text-emerald-700 text-[11px]">Online & Synced</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {activeOrSelectedBooking ? (
                    <div className="flex items-center gap-1.5 rounded-md border border-black/[0.06] bg-white px-3 py-1.5 shadow-2xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <div className="text-left">
                        <p className="text-[9px] text-[#8E8E93] leading-none">Active / Recent Booking</p>
                        <p className="font-medium text-[#0F172A] text-[11px] truncate max-w-[200px]">
                          {activeOrSelectedBooking.parkingSpotName} ({activeOrSelectedBooking.vehiclePlate})
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#8E8E93]">No active booking</div>
                  )}

                  {supportContext.vehicles?.length > 0 && (
                    <div className="flex items-center gap-1.5 rounded-md border border-black/[0.06] bg-white px-3 py-1.5 shadow-2xs">
                      <Car className="h-3.5 w-3.5 text-[#007AFF] shrink-0" />
                      <div className="text-left">
                        <p className="text-[9px] text-[#8E8E93] leading-none">Vehicle</p>
                        <p className="font-medium text-[#0F172A] text-[11px]">
                          {activeOrSelectedVehicle?.licensePlate || supportContext.vehicles[0].licensePlate}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Guided Troubleshooting Workflows Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#1D1D1F]">
              Preset Diagnostic Workflows
            </h2>
            <p className="text-[11px] text-[#6E6E73]">
              Select a category to automatically execute real-time telemetry checks and dispatch support.
            </p>
          </div>
          {loadingWorkflows && (
            <span className="flex items-center gap-1 text-[11px] text-[#8E8E93]">
              <Loader2 className="h-3 w-3 animate-spin" /> Refreshing workflows...
            </span>
          )}
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {workflows.map((wf) => {
            const meta = getCategoryMeta(wf.category, wf.workflowKey);
            const Icon = meta.icon;

            return (
              <button
                key={wf.workflowKey}
                type="button"
                onClick={() => startWorkflow(wf.workflowKey)}
                className="group flex flex-col justify-between rounded-lg border border-black/[0.06] bg-white p-4.5 text-left shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition hover:border-[#007AFF]/40 hover:bg-[#F9FAFB] hover:shadow-sm cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-md transition',
                      meta.isUrgent ? 'bg-rose-50 text-rose-600 group-hover:bg-rose-100' : 'bg-[#F5F5F7] text-[#1D1D1F] group-hover:bg-blue-50 group-hover:text-[#007AFF]'
                    )}>
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="rounded-md bg-[#F5F5F7] px-2 py-0.5 text-[9px] font-semibold text-[#6E6E73]">
                      {wf.estimatedResponseTime || meta.badge}
                    </span>
                  </div>

                  <h3 className="mt-3.5 text-xs font-bold text-[#1D1D1F] group-hover:text-[#007AFF] transition-colors">
                    {wf.title}
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#6E6E73] line-clamp-2">
                    {wf.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between pt-2 border-t border-black/[0.04]">
                  <span className="text-[10px] text-[#8E8E93]">
                    {wf.options?.length || 0} issues covered
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-[#007AFF]">
                    <span>Start</span>
                    <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Two-Column Utility: Live Assistant & Ticket Overview */}
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Assistant Box */}
        <div className="flex flex-col justify-between rounded-lg border border-black/[0.06] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F5F5F7] text-[#007AFF]">
                  <Bot className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-[#1D1D1F]">Need Quick Answers?</h3>
                  <p className="text-[11px] text-[#6E6E73]">Ask a question or select a frequent inquiry:</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200/80 px-2 py-0.5 text-[9px] font-bold text-[#007AFF]">
                <Sparkles className="h-2.5 w-2.5" /> Instant Autobot Reply
              </span>
            </div>

            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {(isOwner
                ? [
                    'Barrier controller offline',
                    'Commuter overstayed bay',
                    'Monthly payout withdrawal',
                    'Bay sensor calibration',
                  ]
                : [
                    'Barrier not opening',
                    'Check refund status',
                    'Change license plate',
                    'Wallet top-up discrepancy',
                  ]
              ).map((promptText) => (
                <button
                  key={promptText}
                  type="button"
                  onClick={() => void handleStartChat(promptText)}
                  title="Get instant step-by-step autobot guidance & queue for live specialist"
                  className="cursor-pointer rounded-lg border border-black/[0.06] bg-[#F5F5F7] px-2.5 py-1 text-[11px] font-medium text-[#1D1D1F] hover:border-[#007AFF] hover:bg-blue-50/40 hover:text-[#007AFF] transition"
                >
                  &ldquo;{promptText}&rdquo;
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-black/[0.06] pt-3.5 text-[11px] text-[#6E6E73]">
            <span className="flex items-center gap-1.5">
              <CircleDot className="h-2.5 w-2.5 text-[#34C759]" /> Automated Triage Active
            </span>
            <button
              type="button"
              onClick={() => setActiveView('live-chat')}
              className="font-semibold text-[#007AFF] hover:underline cursor-pointer"
            >
              Start Live Chat &rarr;
            </button>
          </div>
        </div>

        {/* Tickets Tracker Summary */}
        <div className="flex flex-col justify-between rounded-lg border border-black/[0.06] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F5F5F7] text-[#1D1D1F]">
                  <TicketCheck className="h-4.5 w-4.5 text-[#007AFF]" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-[#1D1D1F]">My Support Tickets</h3>
                  <p className="text-[11px] text-[#6E6E73]">Track your ongoing cases</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('cases')}
                className="text-xs font-semibold text-[#007AFF] hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="mt-3.5 space-y-2 text-xs">
              <div className="rounded-md border border-black/[0.04] bg-[#F9FAFB] p-2.5 text-[11px] text-[#6E6E73]">
                <p className="font-semibold text-[#1D1D1F]">24/7 Operations Guarantee</p>
                <p className="text-[10px] text-[#8E8E93] mt-0.5">
                  Emergency barrier and trapped vehicle workflows trigger immediate on-call dispatch (P0).
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveView('cases')}
            className="mt-4 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-black/[0.08] bg-[#F5F5F7] py-2 text-xs font-semibold text-[#1D1D1F] hover:bg-[#EBEBEF]"
          >
            <TicketCheck className="h-3.5 w-3.5" /> Open Ticket Inbox
          </button>
        </div>
      </section>
    </div>
  );

  // ── Render Quick Help / Guided Triage ──
  const renderQuickHelp = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveView('home')}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Help Center
          </button>

          <span className="rounded-full bg-[#F5F5F7] px-3 py-0.5 text-[11px] font-semibold text-[#6E6E73]">
            Step {workflowStep} of 3
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Left Categories List */}
          <aside className="space-y-1.5">
            <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">
              Workflows
            </p>
            {workflows.map((wf) => {
              const itemMeta = getCategoryMeta(wf.category, wf.workflowKey);
              const ItemIcon = itemMeta.icon;
              const isCurrent = wf.workflowKey === selectedWorkflowKey;

              return (
                <button
                  key={wf.workflowKey}
                  type="button"
                  onClick={() => startWorkflow(wf.workflowKey)}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2.5 rounded-md border p-3 text-left transition-all',
                    isCurrent
                      ? 'border-[#007AFF] bg-blue-50/50 shadow-xs font-bold text-[#007AFF]'
                      : 'border-black/[0.06] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7]'
                  )}
                >
                  <ItemIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate text-xs">{wf.title}</span>
                </button>
              );
            })}
          </aside>

          {/* Right Step Card */}
          <section className="overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="border-b border-black/[0.06] p-5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#007AFF]">
                  {currentWorkflow.title}
                </span>
                <span className="text-[10px] font-semibold text-[#8E8E93]">
                  Est. Response: {currentWorkflow.estimatedResponseTime || 'Immediate'}
                </span>
              </div>
              <h3 className="mt-1 text-base font-bold text-[#1D1D1F]">
                {workflowStep === 1
                  ? 'Select your specific issue & context'
                  : workflowStep === 2
                  ? 'Confirm details & telemetry checks'
                  : 'Automated Diagnostic Resolution'}
              </h3>

              {/* Stepper Dots */}
              <div className="mt-3.5 grid grid-cols-3 gap-1.5">
                {[1, 2, 3].map((stepNum) => (
                  <div
                    key={stepNum}
                    className={cn(
                      'h-1 rounded-full transition-all duration-300',
                      stepNum <= workflowStep ? 'bg-[#007AFF]' : 'bg-[#E5E7EB]'
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Step 1: Issue & Context Selection */}
            {workflowStep === 1 && (
              <div className="p-5 space-y-4">
                {/* Context Selector (Booking & Vehicle) */}
                {supportContext && (supportContext.recentBookings?.length > 0 || supportContext.vehicles?.length > 0) && (
                  <div className="rounded-md border border-black/[0.06] bg-[#FAFBFD] p-3.5 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">
                      Attached Support Context
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {supportContext.recentBookings?.length > 0 && (
                        <div>
                          <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">
                            Related Booking
                          </label>
                          <select
                            value={selectedBookingId || ''}
                            onChange={(e) => setSelectedBookingId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5 text-xs text-[#1D1D1F] focus:border-[#007AFF] outline-none"
                          >
                            <option value="">None / Not booking related</option>
                            {supportContext.recentBookings.map((b) => (
                              <option key={b.bookingId} value={b.bookingId}>
                                #{b.bookingReference.slice(0, 12)}... - {b.parkingSpotName} ({b.status})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {supportContext.vehicles?.length > 0 && (
                        <div>
                          <label className="block text-[11px] font-medium text-[#1D1D1F] mb-1">
                            Related Vehicle
                          </label>
                          <select
                            value={selectedVehicleId || ''}
                            onChange={(e) => setSelectedVehicleId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5 text-xs text-[#1D1D1F] focus:border-[#007AFF] outline-none"
                          >
                            <option value="">None / Default</option>
                            {supportContext.vehicles.map((v) => (
                              <option key={v.vehicleId} value={v.vehicleId}>
                                {v.licensePlate} - {v.makeModel} ({v.color})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs text-[#6E6E73] mb-2.5">
                    Select the issue you are experiencing:
                  </p>
                  <div className="grid gap-2">
                    {currentWorkflow.options.map((opt) => {
                      const isChecked = answers.issue === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => handleAnswerChange('issue', opt.key)}
                          className={cn(
                            'flex cursor-pointer items-start justify-between gap-3 rounded-md border p-3.5 text-left text-xs font-semibold transition-all',
                            isChecked
                              ? 'border-[#007AFF] bg-blue-50/40 text-[#007AFF] ring-1 ring-[#007AFF]/20'
                              : 'border-black/[0.06] bg-white text-[#1D1D1F] hover:bg-[#F9FAFB]'
                          )}
                        >
                          <div>
                            <p className="font-semibold text-xs">{opt.label}</p>
                            {opt.description && (
                              <p className="text-[11px] font-normal text-[#6E6E73] mt-0.5">{opt.description}</p>
                            )}
                          </div>
                          <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border mt-0.5', isChecked ? 'border-[#007AFF] bg-[#007AFF] text-white' : 'border-black/[0.15]')}>
                            {isChecked && <Check className="h-2.5 w-2.5" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWorkflowError(null);
                      setWorkflowStep(2);
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0066D6]"
                  >
                    <span>Continue to Diagnostics</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Dynamic Questions & Live Telemetry Verification */}
            {workflowStep === 2 && (
              <div className="p-5 space-y-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                  {/* Telemetry from Backend Support Context */}
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">
                      Live Account & Telemetry Checks
                    </h4>
                    <div className="mt-2 divide-y divide-black/[0.04] rounded-md border border-black/[0.06] bg-[#FAFBFD]">
                      <div className="flex items-center gap-2.5 p-2.5 text-xs">
                        <User className="h-3.5 w-3.5 text-[#007AFF] shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-[#8E8E93]">User Profile</p>
                          <p className="font-medium text-[#1D1D1F] truncate">
                            {supportContext?.userName || viewer.name} ({supportContext?.userType || viewer.role})
                          </p>
                        </div>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#34C759] shrink-0" />
                      </div>

                      <div className="flex items-center gap-2.5 p-2.5 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#007AFF] shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-[#8E8E93]">Parking Spot / Booking</p>
                          <p className="font-medium text-[#1D1D1F] truncate">
                            {activeOrSelectedBooking ? `${activeOrSelectedBooking.parkingSpotName} (${activeOrSelectedBooking.status})` : 'No booking selected'}
                          </p>
                          {activeOrSelectedBooking?.propertyAddress && (
                            <p className="text-[9px] text-[#8E8E93] truncate">{activeOrSelectedBooking.propertyAddress}</p>
                          )}
                        </div>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#34C759] shrink-0" />
                      </div>

                      <div className="flex items-center gap-2.5 p-2.5 text-xs">
                        <Radio className="h-3.5 w-3.5 text-[#007AFF] shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-[#8E8E93]">Gate Hardware / IoT</p>
                          <p className="font-medium text-[#1D1D1F] truncate">
                            {activeOrSelectedBooking?.hasIoTDevice
                              ? `IoT Online (Status: ${activeOrSelectedBooking.ioTDeviceStatus || 'Active'})`
                              : 'No hardware sensor attached'}
                          </p>
                          {activeOrSelectedBooking?.lastHeartbeatAt && (
                            <p className="text-[9px] text-[#8E8E93]">Heartbeat: {formatContextDate(activeOrSelectedBooking.lastHeartbeatAt)}</p>
                          )}
                        </div>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#34C759] shrink-0" />
                      </div>

                      <div className="flex items-center gap-2.5 p-2.5 text-xs">
                        <WalletCards className="h-3.5 w-3.5 text-[#007AFF] shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-[#8E8E93]">Wallet Balance & Transactions</p>
                          <p className="font-medium text-[#1D1D1F] truncate">
                            RM {(supportContext?.walletBalance ?? 0).toFixed(2)}
                            {supportContext?.recentTransactions?.[0] && ` · Latest: ${supportContext.recentTransactions[0].transactionType} (RM ${supportContext.recentTransactions[0].amount})`}
                          </p>
                        </div>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#34C759] shrink-0" />
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Workflow Steps Questions */}
                  <div className="rounded-md border border-black/[0.06] bg-[#FAFBFD] p-3.5 space-y-3">
                    <h4 className="text-xs font-bold text-[#1D1D1F]">Verification Questions</h4>
                    
                    {currentWorkflow.steps
                      .filter((step) => step.stepId !== 'issue')
                      .map((step) => {
                        const currentVal = answers[step.stepId] ?? '';
                        return (
                          <div key={step.stepId} className="space-y-1.5">
                            <p className="text-[11px] font-medium text-[#1D1D1F]">
                              {step.question} {step.required && <span className="text-rose-600">*</span>}
                            </p>

                            {step.type === 'choice' && (
                              <div className="grid grid-cols-2 gap-1.5">
                                {step.allowedAnswers.map((ans) => {
                                  const isSelected = currentVal === ans;
                                  const isDanger = (ans === 'yes' && (step.stepId === 'trapped' || step.stepId === 'safetyRisk'));

                                  return (
                                    <button
                                      key={ans}
                                      type="button"
                                      onClick={() => handleAnswerChange(step.stepId, ans)}
                                      className={cn(
                                        'cursor-pointer rounded-lg border py-1.5 text-xs font-semibold capitalize transition',
                                        isSelected
                                          ? isDanger
                                            ? 'border-rose-500 bg-rose-50 text-rose-700'
                                            : 'border-[#007AFF] bg-blue-50 text-[#007AFF]'
                                          : 'border-black/[0.08] bg-white text-[#6E6E73] hover:text-[#1D1D1F]'
                                      )}
                                    >
                                      {ans}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {step.type === 'text' && (
                              <input
                                type="text"
                                value={currentVal}
                                onChange={(e) => handleAnswerChange(step.stepId, e.target.value)}
                                placeholder="Enter details..."
                                className="w-full rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                              />
                            )}
                          </div>
                        );
                      })}

                    {currentWorkflow.steps.filter((s) => s.stepId !== 'issue').length === 0 && (
                      <p className="text-[11px] text-[#6E6E73]">
                        No additional questions required. Click below to execute automated resolution.
                      </p>
                    )}
                  </div>
                </div>

                {workflowError && (
                  <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{workflowError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-black/[0.06] pt-3.5">
                  <button
                    type="button"
                    onClick={() => setWorkflowStep(1)}
                    className="cursor-pointer text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F]"
                  >
                    &larr; Back
                  </button>

                  <button
                    type="button"
                    onClick={() => void runWorkflow()}
                    disabled={workflowSubmitting}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50 shadow-xs"
                  >
                    {workflowSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}
                    <span>{workflowSubmitting ? 'Executing Triage...' : 'Execute Resolution'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Real Backend Resolution Outcome */}
            {workflowStep === 3 && workflowRunResult && (
              <div className="p-5 space-y-4">
                {/* Resolution Summary Banner */}
                <div className="rounded-md border border-black/[0.06] bg-[#FAFBFD] p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#34C759] shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">
                          {workflowRunResult.outcome}
                        </span>
                        <span className={cn(
                          'rounded-md px-2 py-0.5 text-[9px] font-bold',
                          workflowRunResult.priority === 'P0'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                            : workflowRunResult.priority === 'P1'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-[#007AFF] border border-blue-200'
                        )}>
                          Priority {workflowRunResult.priority}
                        </span>
                        <span className="rounded-md bg-[#F5F5F7] px-2 py-0.5 text-[9px] font-semibold text-[#6E6E73]">
                          Run Ref: {workflowRunResult.runReference}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-[#1D1D1F] mt-1.5">
                        {workflowRunResult.assignedTeam} Assigned
                      </h4>
                      <p className="mt-1 text-xs text-[#1D1D1F] leading-relaxed">
                        {workflowRunResult.customerMessage}
                      </p>
                    </div>
                  </div>
                </div>

                {/* System Checks from Backend */}
                {workflowRunResult.checks && workflowRunResult.checks.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">
                      Automated Verification Checks
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {workflowRunResult.checks.map((chk, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 rounded-md border border-black/[0.06] bg-white p-3 text-xs">
                          <CheckCircle2 className="h-4 w-4 text-[#34C759] shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-semibold text-[#1D1D1F] text-[11px]">{chk.name}</p>
                            <p className="text-[10px] text-[#6E6E73] mt-0.5 leading-tight">{chk.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Emergency Incident Banner (if generated) */}
                {workflowRunResult.incident && (
                  <div className="rounded-md border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Siren className="h-4 w-4 text-rose-600" />
                        <span>Emergency Incident Dispatched</span>
                      </div>
                      <span className="font-mono font-bold bg-white px-2 py-0.5 rounded text-[10px] text-rose-700 border border-rose-200">
                        {workflowRunResult.incident.incidentReference}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-800">
                      {workflowRunResult.incident.title}
                    </p>
                    <p className="text-[10px] text-rose-600">
                      Status: {workflowRunResult.incident.status} · Assigned: {workflowRunResult.incident.assignedTeam}
                    </p>
                  </div>
                )}

                {/* Ticket Reference Banner (if generated) */}
                {workflowRunResult.ticket && (
                  <div className="flex items-center justify-between rounded-md border border-black/[0.06] bg-white p-3.5 text-xs">
                    <div>
                      <p className="text-[10px] text-[#8E8E93]">Support Ticket Created</p>
                      <p className="font-mono font-bold text-[#007AFF] text-sm">
                        {workflowRunResult.ticket.ticketReference}
                      </p>
                      <p className="text-[10px] text-[#6E6E73] mt-0.5 truncate max-w-[280px]">
                        {workflowRunResult.ticket.subject}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveView('cases')}
                      className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#007AFF] hover:underline"
                    >
                      <span>View in Ticket Inbox</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-black/[0.06] pt-3.5">
                  <button
                    type="button"
                    onClick={() => void handleRefreshRunStatus()}
                    disabled={refreshingRunStatus}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-black/[0.08] px-3 py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7] disabled:opacity-50"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', refreshingRunStatus && 'animate-spin')} />
                    <span>{refreshingRunStatus ? 'Refreshing...' : 'Refresh Status'}</span>
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startWorkflow(selectedWorkflowKey)}
                      className="cursor-pointer rounded-md border border-black/[0.08] px-3.5 py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                    >
                      Start Over
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveView('home')}
                      className="cursor-pointer rounded-md bg-[#1D1D1F] px-4 py-1.5 text-xs font-semibold text-white hover:bg-black"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    );
  };

  // ── Render Live Chat ──
  const renderLiveChat = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setActiveView('home')}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Help Center
        </button>

        <div className="flex items-center gap-3">
          {activeConversation && (
            <button
              type="button"
              onClick={() => void handleStartChat()}
              className="text-xs font-semibold text-[#007AFF] hover:underline cursor-pointer"
            >
              + New Session
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6E6E73]">
            <CircleDot className="h-2.5 w-2.5 text-[#34C759]" /> Support Assistant Active
          </span>
        </div>
      </div>

      {!activeConversation ? (
        <section className="rounded-lg border border-black/[0.06] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#1D1D1F]">Start Live Support Session</h3>
            <p className="mt-1 text-xs text-[#6E6E73] max-w-lg">
              Connect directly with our support team. Your account context and active telemetry are attached automatically.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {(isOwner
              ? [
                  'Barrier controller offline',
                  'Commuter overstayed reserved bay',
                  'Monthly payout status inquiry',
                  'Sensor false occupancy issue',
                ]
              : [
                  'Barrier not opening at entry',
                  'I was charged twice for my booking',
                  'My license plate was not recognized',
                  'Check my refund status',
                ]
            ).map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => void handleStartChat(label)}
                disabled={loadingConversation}
                className="cursor-pointer rounded-lg border border-black/[0.06] bg-[#F5F5F7] px-3 py-1.5 text-xs font-medium text-[#1D1D1F] hover:border-[#007AFF] hover:bg-blue-50/40 hover:text-[#007AFF] disabled:opacity-50"
              >
                &ldquo;{label}&rdquo;
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleStartChat()}
            disabled={loadingConversation}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#007AFF] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0066D6] disabled:opacity-50"
          >
            {loadingConversation ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            <span>{loadingConversation ? 'Connecting session...' : 'Start Conversation'}</span>
          </button>
        </section>
      ) : (
        <section className="overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)] lg:grid lg:h-[calc(100vh-175px)] lg:min-h-[550px] lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Left Chat Meta */}
          <aside className="h-full flex flex-col min-h-0 border-b border-black/[0.06] bg-[#FAFBFD] p-4 lg:border-b-0 lg:border-r space-y-3 text-xs">
            <div className="shrink-0">
              <p className="font-bold text-[#1D1D1F]">ParkJom Support</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-slate-600 font-semibold">
                  {activeConversation.status === 'Closed' ? 'Closed' : 'Active Session'}
                </span>
              </div>
            </div>

            <div className="shrink-0 rounded-lg border border-black/[0.04] bg-white p-2.5 text-[11px] space-y-1.5">
              <div>
                <p className="text-[9px] text-[#8E8E93]">Reference</p>
                <p className="font-mono font-bold text-[#007AFF] truncate">{activeConversation.conversationReference}</p>
              </div>
              <div>
                <p className="text-[9px] text-[#8E8E93]">User</p>
                <p className="font-semibold text-[#1D1D1F] truncate">{viewer.name}</p>
              </div>
              {activeOrSelectedBooking && (
                <div>
                  <p className="text-[9px] text-[#8E8E93]">Attached Booking</p>
                  <p className="font-medium text-[#1D1D1F] truncate">
                    {activeOrSelectedBooking.parkingSpotName}
                  </p>
                </div>
              )}
            </div>

            {/* Conversation List Selector */}
            {myConversations.length > 1 && (
              <div className="flex-1 min-h-0 space-y-1 pt-1 border-t border-black/[0.04] overflow-hidden flex flex-col">
                <p className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-[#8E8E93]">Other Sessions</p>
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
                  {myConversations.map((c) => (
                    <button
                      key={c.conversationId}
                      type="button"
                      onClick={() => {
                        getConversationDetails(viewer.token, c.conversationId).then((raw) => setActiveConversation(mergeWithBotMessages(raw)));
                      }}
                      className={cn(
                        'w-full text-left p-1.5 rounded text-[10px] truncate border cursor-pointer',
                        c.conversationId === activeConversation.conversationId
                          ? 'border-[#007AFF] bg-blue-50 text-[#007AFF] font-bold'
                          : 'border-transparent hover:bg-slate-100 text-[#6E6E73]'
                      )}
                    >
                      {c.conversationReference} ({c.status})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="shrink-0 space-y-1.5 pt-1">
              <button
                type="button"
                onClick={() => setEscalateModalOpen(true)}
                className="w-full cursor-pointer rounded-lg bg-[#007AFF] py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6] shadow-xs text-center"
              >
                Escalate to Ticket
              </button>

              <button
                type="button"
                onClick={() => void handleCloseChat()}
                disabled={loadingConversation}
                className="w-full cursor-pointer rounded-lg border border-black/[0.08] bg-white py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7] disabled:opacity-50"
              >
                End Chat
              </button>
            </div>
          </aside>

          {/* Right Chat Stream */}
          <div className="h-full flex flex-col min-h-0 bg-[#FAFBFD] overflow-hidden">
            <div className="flex-1 min-h-0 space-y-3 overflow-y-auto p-4">
              {activeConversation.messages?.map((msg) => {
                const isUser = msg.senderRole?.toLowerCase() === 'customer' || msg.senderUserId === viewer.userId;
                const isAdmin = msg.senderRole?.toLowerCase() === 'admin';
                const isSystem = msg.senderRole?.toLowerCase() === 'system';
                const isBot = msg.senderRole?.toLowerCase() === 'bot' || msg.messageType?.toLowerCase() === 'bot';

                if (isSystem) {
                  return (
                    <div key={msg.messageId} className="my-2 flex justify-center">
                      <span className="inline-flex max-w-[85%] items-center gap-1.5 rounded-full border border-black/[0.06] bg-white px-3 py-1 text-center text-[10px] text-[#6E6E73] shadow-2xs">
                        <CheckCircle2 className="h-3 w-3 text-[#007AFF] shrink-0" />
                        <span>{msg.body}</span>
                      </span>
                    </div>
                  );
                }

                if (isBot) {
                  return (
                    <div key={msg.messageId} className="flex justify-start">
                      <div className="max-w-[92%] sm:max-w-[85%]">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[10px]">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[#007AFF]">
                            <Bot className="h-3 w-3" />
                          </span>
                          <span className="font-bold text-[#1D1D1F]">ParkJom Support Bot</span>
                          <span className="rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.2 text-[9px] font-bold text-[#007AFF]">
                            Automated Guidance
                          </span>
                          <span className="text-[#8E8E93]">· {formatContextDate(msg.createdAt)}</span>
                        </div>
                        <div className="rounded-xl rounded-tl-none border border-blue-100 bg-white p-3.5 sm:p-4 text-xs text-[#1D1D1F] shadow-xs space-y-2">
                          {renderFormattedBotText(msg.body)}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.messageId} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[85%] sm:max-w-[75%]', isUser && 'text-right')}>
                      <p className="mb-0.5 text-[9px] text-[#8E8E93]">
                        {isUser ? viewer.name : isAdmin ? `${msg.senderName} (Support Admin)` : msg.senderName} · {formatContextDate(msg.createdAt)}
                      </p>
                      <div
                        className={cn(
                          'rounded-lg px-3.5 py-2 text-left text-xs leading-relaxed shadow-xs',
                          isUser
                            ? 'rounded-br-sm bg-[#007AFF] text-white'
                            : 'rounded-bl-sm border border-black/[0.06] bg-white text-[#1D1D1F]'
                        )}
                      >
                        {msg.body}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isBotTyping && (
                <div className="flex justify-start">
                  <div className="max-w-[85%]">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[#007AFF]">
                        <Bot className="h-3 w-3" />
                      </span>
                      <span className="font-bold text-[#1D1D1F]">ParkJom Support Bot</span>
                      <span className="text-[#8E8E93]">typing...</span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl rounded-tl-none border border-blue-100 bg-white px-3.5 py-2.5 text-xs text-[#64748B] shadow-xs">
                      <span className="flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#007AFF] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-[#007AFF] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-[#007AFF] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                      <span className="text-[11px] font-medium text-[#6E6E73]">Generating automated diagnostic guidance...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {escalatedTicketRef && (
              <div className="shrink-0 border-t border-black/[0.06] bg-white p-3 text-xs flex items-center justify-between">
                <span className="font-medium text-[#1D1D1F]">
                  Ticket Created: <span className="font-mono font-bold text-[#007AFF]">{escalatedTicketRef}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveView('cases')}
                  className="cursor-pointer text-xs font-bold text-[#007AFF] hover:underline"
                >
                  Open in Ticket Inbox &rarr;
                </button>
              </div>
            )}

            {chatError && (
              <div className="shrink-0 border-t border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                {chatError}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="shrink-0 border-t border-black/[0.06] bg-white p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatComposer}
                  onChange={(e) => setChatComposer(e.target.value)}
                  placeholder={activeConversation.status === 'Closed' ? 'This session is closed' : 'Type a message...'}
                  disabled={activeConversation.status === 'Closed' || sendingChatMessage}
                  className="min-h-9 flex-1 rounded-md border border-black/[0.08] bg-[#F5F5F7] px-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatComposer.trim() || sendingChatMessage || activeConversation.status === 'Closed'}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-[#007AFF] text-white hover:bg-[#0066D6] disabled:opacity-40"
                  aria-label="Send message"
                >
                  {sendingChatMessage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* Escalation Modal */}
      {escalateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border border-black/[0.08] bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <TicketCheck className="h-4 w-4 text-[#007AFF]" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Escalate Conversation to Ticket</h3>
              </div>
              <button
                type="button"
                onClick={() => setEscalateModalOpen(false)}
                className="cursor-pointer text-[#8E8E93] hover:text-[#1D1D1F]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEscalateToTicket} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Subject *</label>
                <input
                  type="text"
                  value={escalateSubject}
                  onChange={(e) => setEscalateSubject(e.target.value)}
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Category</label>
                  <select
                    value={escalateCategory}
                    onChange={(e) => setEscalateCategory(e.target.value)}
                    className="w-full rounded-md border border-black/[0.08] px-2.5 py-2 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                  >
                    <option value="ParkingAccess">Parking Access</option>
                    <option value="Booking">Booking</option>
                    <option value="Payment">Payment</option>
                    <option value="Account">Account</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Priority</label>
                  <select
                    value={escalatePriority}
                    onChange={(e) => setEscalatePriority(e.target.value)}
                    className="w-full rounded-md border border-black/[0.08] px-2.5 py-2 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                  >
                    <option value="P0">P0 - Immediate Emergency</option>
                    <option value="P1">P1 - High Priority</option>
                    <option value="P2">P2 - Standard</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setEscalateModalOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={escalating || !escalateSubject.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#007AFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50"
                >
                  {escalating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TicketCheck className="h-3.5 w-3.5" />}
                  <span>{escalating ? 'Creating Ticket...' : 'Convert to Ticket'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // ── Render User Disputes & Reversals ──
  const renderUserDisputes = () => (
    <div className="space-y-4" data-component="user-disputes">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#1D1D1F] sm:text-lg">
              Financial Disputes & Refund Claims
            </h2>
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              {myDisputes.length} Cases
            </span>
          </div>
          <p className="text-xs text-[#6E6E73] mt-0.5">
            Track your payment discrepancy investigations, upload bank receipts, and review automated wallet reversals.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadCustomerDisputes()}
          disabled={loadingDisputes}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-black/[0.08] bg-white px-3 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loadingDisputes && 'animate-spin text-[#007AFF]')} />
          <span>Refresh Claims</span>
        </button>
      </div>

      <section className="overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)] lg:grid lg:min-h-[580px] lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left List */}
        <div className="flex flex-col border-b border-black/[0.06] lg:border-b-0 lg:border-r bg-white">
          <div className="p-3 border-b border-black/[0.06]">
            <p className="text-xs font-bold text-[#1D1D1F]">Your Active Claims</p>
            <p className="text-[10px] text-[#8E8E93]">Select a case to upload documents or check resolution status</p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[520px]">
            {loadingDisputes ? (
              <div className="flex h-32 items-center justify-center text-xs text-[#8E8E93]">
                <Loader2 className="h-4 w-4 animate-spin text-[#007AFF]" />
              </div>
            ) : myDisputes.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8E8E93]">
                <ShieldAlert className="h-8 w-8 mx-auto text-[#8E8E93]/40 mb-2" />
                <p className="font-bold text-[#1D1D1F]">No dispute cases found</p>
                <p className="text-[11px] mt-0.5">You have no active payment or charge disputes.</p>
              </div>
            ) : (
              myDisputes.map((dsp) => {
                const isSelected = dsp.disputeId === selectedDisputeId;
                const isApproved = dsp.status === 'Approved';
                const isDeclined = dsp.status === 'Declined';
                return (
                  <button
                    key={dsp.disputeId}
                    type="button"
                    onClick={() => setSelectedDisputeId(dsp.disputeId)}
                    className={cn(
                      'w-full cursor-pointer rounded-md border p-3 text-left transition-all',
                      isSelected
                        ? 'border-[#007AFF] bg-blue-50/40 shadow-xs'
                        : 'border-black/[0.04] bg-white hover:bg-[#F5F5F7]'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] font-bold text-[#007AFF]">{dsp.disputeReference}</span>
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
                    </div>
                    <h4 className="mt-1 text-xs font-bold text-[#1D1D1F]">{dsp.disputeType}</h4>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-[#8E8E93]">
                      <span>{formatDateTime(dsp.createdAt)}</span>
                      {dsp.amount > 0 && (
                        <span className="font-bold text-[#1D1D1F]">{dsp.currency} {dsp.amount.toFixed(2)}</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Details */}
        <div className="p-4 sm:p-5 flex flex-col bg-[#FAFBFD] space-y-4">
          {loadingDisputeDetail && !selectedDisputeDetail ? (
            <div className="flex flex-1 items-center justify-center text-xs text-[#8E8E93]">
              <Loader2 className="h-5 w-5 animate-spin text-[#007AFF]" />
            </div>
          ) : !selectedDisputeDetail ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-8 text-xs text-[#8E8E93]">
              <ShieldAlert className="h-10 w-10 text-[#8E8E93]/40 mb-2" />
              <p className="font-bold text-sm text-[#1D1D1F]">Select a dispute</p>
              <p className="text-xs text-[#6E6E73] mt-1">Review case findings and upload requested receipts.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex flex-col gap-3 border-b border-black/[0.06] pb-4 sm:flex-row sm:items-start sm:justify-between bg-white -m-4 p-4 sm:-m-5 sm:p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#007AFF]">
                      {selectedDisputeDetail.disputeReference}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-[#1D1D1F]">
                      {selectedDisputeDetail.status}
                    </span>
                    <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      {selectedDisputeDetail.disputeType}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-[#1D1D1F]">
                    {selectedDisputeDetail.reason || 'Dispute Case'}
                  </h3>
                  <p className="text-xs text-[#6E6E73] mt-0.5">
                    Submitted {formatDateTime(selectedDisputeDetail.createdAt)}
                    {selectedDisputeDetail.bookingId && ` · Booking #${selectedDisputeDetail.bookingId}`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setUploadEvidenceOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#007AFF] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6] shadow-xs"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>Upload Bank Receipt</span>
                </button>
              </div>

              {/* Status Banner */}
              {selectedDisputeDetail.status === 'Approved' ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3.5 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Reversal Approved & Processed!</span>
                  </div>
                  <p className="text-emerald-900">
                    Your claim has been accepted by our Finance department. Funds have been reversed back to your platform wallet or original payment instrument.
                  </p>
                  {selectedDisputeDetail.decisionReason && (
                    <p className="text-[11px] text-emerald-700 italic">Note: {selectedDisputeDetail.decisionReason}</p>
                  )}
                </div>
              ) : selectedDisputeDetail.status === 'Declined' ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-3.5 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800">
                    <AlertCircle className="h-4 w-4 text-rose-600" />
                    <span>Dispute Declined</span>
                  </div>
                  <p className="text-rose-900">
                    Our Finance team verified the payment gateway logs and found the charges were authorized.
                  </p>
                  {selectedDisputeDetail.decisionReason && (
                    <p className="text-[11px] text-rose-700 italic">Reason: {selectedDisputeDetail.decisionReason}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3.5 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span>Under Investigation by Finance</span>
                  </div>
                  <p className="text-amber-800">
                    We are actively cross-referencing your transaction with our gateway and bank records. If you have not uploaded a screenshot of your bank deduction, please do so below.
                  </p>
                </div>
              )}

              {/* Uploaded Evidence Files */}
              <div className="rounded-md border border-black/[0.06] bg-white p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1D1D1F]">
                    Uploaded Documents & Evidence ({selectedDisputeDetail.evidences?.length || 0})
                  </span>
                  <button
                    type="button"
                    onClick={() => setUploadEvidenceOpen(true)}
                    className="text-[11px] font-semibold text-[#007AFF] hover:underline cursor-pointer"
                  >
                    + Add More Proof
                  </button>
                </div>

                {(!selectedDisputeDetail.evidences || selectedDisputeDetail.evidences.length === 0) ? (
                  <p className="text-[11px] text-[#8E8E93] py-2">
                    No receipts or files attached to this claim yet.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedDisputeDetail.evidences.map((ev) => (
                      <div
                        key={ev.disputeEvidenceId}
                        className="flex flex-col justify-between p-3 rounded-md border border-black/[0.06] bg-[#FAFBFD] space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-[#007AFF] shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-[#1D1D1F] truncate">{ev.fileName}</p>
                              <span className="text-[9px] text-[#8E8E93]">{ev.evidenceType}</span>
                            </div>
                          </div>
                          <span className="rounded px-1.5 py-0.2 text-[9px] font-semibold bg-slate-100 text-[#6E6E73]">
                            {ev.uploadedRole}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-black/[0.04] text-[9px] text-[#8E8E93]">
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
            </>
          )}
        </div>
      </section>

      {/* ── Customer Upload Evidence Modal ── */}
      {uploadEvidenceOpen && selectedDisputeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border border-black/[0.08] bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-[#007AFF]" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Upload Bank Receipt / Statement</h3>
              </div>
              <button
                type="button"
                onClick={() => setUploadEvidenceOpen(false)}
                className="cursor-pointer text-[#8E8E93] hover:text-[#1D1D1F]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadCustomerEvidence} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Document Type *</label>
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] bg-white font-semibold"
                >
                  <option value="BankReceipt">Bank Receipt / Transaction Slip</option>
                  <option value="AccountStatement">Bank / Card Statement</option>
                  <option value="Screenshot">App Payment Screenshot</option>
                  <option value="Other">Other Supporting Document</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Choose File *</label>
                <input
                  type="file"
                  onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                  required
                  className="w-full rounded-md border border-black/[0.08] p-2 text-xs outline-none focus:border-[#007AFF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Notes / Clarification</label>
                <textarea
                  rows={2}
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="e.g. Bank statement showing the double deduction on May 10"
                  className="w-full rounded-md border border-black/[0.08] p-2.5 outline-none focus:border-[#007AFF]"
                />
              </div>

              {uploadEvidenceError && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {uploadEvidenceError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setUploadEvidenceOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingEvidence || !evidenceFile}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#007AFF] px-4 py-1.5 font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50"
                >
                  {uploadingEvidence ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                  <span>Upload Document</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4" data-component="user-support-dashboard">
      {/* Sub-Function Navigation Bar (Only shown on specific function pages) */}
      {activeView !== 'home' && (
        <section className="border-b border-black/[0.06] bg-white px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveView('home')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition active:scale-[0.98]"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-[#007AFF]" />
                <span>Back to Support Hub</span>
              </button>
              <span className="text-slate-300">|</span>
              <span className="text-xs font-bold text-[#0F172A]">
                {navigation.find((n) => n.id === activeView)?.label || 'Support Center'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveView('home')}
              className="text-xs font-medium text-[#64748B] hover:text-[#007AFF] transition cursor-pointer"
            >
              Support Hub Directory &rarr;
            </button>
          </div>
        </section>
      )}

      {/* Dynamic Views */}
      {activeView === 'home' && renderHome()}
      {activeView === 'quick-help' && renderQuickHelp()}
      {activeView === 'live-chat' && renderLiveChat()}
      {activeView === 'cases' && ticketWorkspace}
      {activeView === 'disputes' && renderUserDisputes()}
    </div>
  );
}
