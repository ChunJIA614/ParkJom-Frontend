import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
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
  Clock3,
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
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createSupportTicket } from '../../api/supportTicketService';
import type { SupportViewer } from '../../types';

interface UserSupportDashboardProps {
  viewer: SupportViewer;
  ticketWorkspace: ReactNode;
}

type UserView = 'home' | 'quick-help' | 'live-chat' | 'cases';
type Answer = 'yes' | 'no' | '';

interface WorkflowOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface WorkflowDefinition {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  badge: string;
  options: WorkflowOption[];
}

interface WorkflowOutcome {
  object: 'Resolved Automatically' | 'Tracked Support Ticket' | 'Operational Emergency Incident' | 'Financial Dispute Investigation';
  title: string;
  description: string;
  priority: string;
  team: string;
  createsTicket: boolean;
  tone: 'success' | 'warning' | 'danger' | 'info';
}

interface ChatMessage {
  id: string;
  sender: 'support' | 'user';
  message: string;
  time: string;
}

// Commuter-specific workflows (Clean neutral styling)
const commuterWorkflows: WorkflowDefinition[] = [
  {
    id: 'access',
    title: 'Barrier, Gate & Access',
    description: 'Bollard won\'t lower, boom gate unrecognized, or trapped at parking site.',
    icon: Siren,
    badge: 'Urgent',
    options: [
      { id: 'enter', label: 'Cannot enter parking bay (Bollard / Gate closed)' },
      { id: 'exit', label: 'Cannot leave parking site (Exit barrier blocked)' },
      { id: 'validation', label: 'License plate / QR code not recognised at barrier' },
      { id: 'occupied', label: 'My booked bay is occupied by another car' },
    ],
  },
  {
    id: 'booking',
    title: 'Booking & Timing',
    description: 'Modify station location, extend parking hours, cancel, or fix expired pass.',
    icon: CalendarClock,
    badge: 'Self-Service',
    options: [
      { id: 'missing', label: 'Paid booking not showing on my dashboard' },
      { id: 'location', label: 'Selected wrong train station or parking bay' },
      { id: 'cancel', label: 'Need to cancel and request refund' },
      { id: 'time', label: 'Extend parking session time' },
      { id: 'expired', label: 'Booking shown as expired prematurely' },
    ],
  },
  {
    id: 'payment',
    title: 'Payments & Wallet',
    description: 'Payment confirmation, wallet balance discrepancy, or refund review.',
    icon: CreditCard,
    badge: 'Billing',
    options: [
      { id: 'paid-missing', label: 'Charged via Stripe but booking not confirmed' },
      { id: 'duplicate', label: 'Charged twice for single parking booking' },
      { id: 'wallet-topup', label: 'Wallet top-up not reflected in balance' },
      { id: 'refund', label: 'Check status of pending refund' },
      { id: 'unknown', label: 'Unrecognised charge on my statement' },
    ],
  },
  {
    id: 'vehicle',
    title: 'Vehicle & Account Profile',
    description: 'Update number plate, change rental car plate, or security settings.',
    icon: Car,
    badge: 'Account',
    options: [
      { id: 'plate-change', label: 'Switch plate to rental / replacement car for active booking' },
      { id: 'vehicle-add', label: 'Unable to add secondary vehicle' },
      { id: 'account-access', label: 'Account sign-in or Google auth trouble' },
      { id: 'notifications', label: 'Not receiving WhatsApp / SMS entry alerts' },
    ],
  },
];

// Owner-specific workflows (Clean neutral styling)
const ownerWorkflows: WorkflowDefinition[] = [
  {
    id: 'payout',
    title: 'Payout & Earnings',
    description: 'Weekly bank disbursement, commission fee breakdown, or payout schedule.',
    icon: Landmark,
    badge: 'Settlements',
    options: [
      { id: 'payout-delayed', label: 'Weekly payout not received in my bank account' },
      { id: 'payout-amount', label: 'Discrepancy in booking total vs payout amount' },
      { id: 'bank-change', label: 'Update bank account / DuitNow details' },
      { id: 'tax-invoice', label: 'Request monthly commission statement / invoice' },
    ],
  },
  {
    id: 'hardware',
    title: 'Smart Bollard & Hardware',
    description: 'IoT bollard offline, battery warning, mechanical jamming, or QR damaged.',
    icon: Wrench,
    badge: 'Diagnostics',
    options: [
      { id: 'bollard-stuck', label: 'Bollard stuck in raised position (unable to lower)' },
      { id: 'bollard-offline', label: 'IoT bollard status showing Offline in app' },
      { id: 'qr-damaged', label: 'Physical QR label damaged / vandalised' },
      { id: 'low-battery', label: 'Bollard low battery or solar panel obstruction' },
    ],
  },
  {
    id: 'overstay',
    title: 'Commuter Overstay & Disputes',
    description: 'Unauthorized car parked in your bay or commuter staying past booking time.',
    icon: ShieldAlert,
    badge: 'Disputes',
    options: [
      { id: 'unauthorized-car', label: 'Unauthorized car parked in my designated bay' },
      { id: 'commuter-overstay', label: 'Commuter overstayed without extending booking' },
      { id: 'property-damage', label: 'Report damage to parking bay or bollard hardware' },
      { id: 'building-access', label: 'Condo management access card / boom gate issue' },
    ],
  },
  {
    id: 'listing',
    title: 'Listing Verification & Bay Setup',
    description: 'Approval status of submitted listing, strata deed check, or pricing updates.',
    icon: FileCheck2,
    badge: 'Verification',
    options: [
      { id: 'verification-status', label: 'Check pending verification of parking listing' },
      { id: 'doc-upload', label: 'Re-upload property ownership / tenancy document' },
      { id: 'pricing-update', label: 'Update daily/monthly rates or availability schedule' },
      { id: 'delist-temporarily', label: 'Temporarily pause bay bookings for personal use' },
    ],
  },
];

const navigation: { id: UserView; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Help Center', icon: LifeBuoy },
  { id: 'quick-help', label: 'Quick Triage', icon: Workflow },
  { id: 'live-chat', label: 'Live Assistant', icon: MessagesSquare },
  { id: 'cases', label: 'My Tickets', icon: TicketCheck },
];

function calculateWorkflowOutcome(
  workflowId: string,
  issueId: string,
  trapped: Answer,
  safetyRisk: Answer,
  isOwner: boolean
): WorkflowOutcome {
  if (workflowId === 'access' || (isOwner && workflowId === 'overstay' && issueId === 'unauthorized-car')) {
    if (trapped === 'yes' || safetyRisk === 'yes') {
      return {
        object: 'Operational Emergency Incident',
        title: 'Emergency Priority Incident Dispatched',
        description: 'Your case has paged the 24/7 On-Call Parking Operations team. A priority ticket has been created to keep you updated.',
        priority: 'P0 / Immediate (under 2 mins)',
        team: '24/7 Field & Parking Operations',
        createsTicket: true,
        tone: 'danger',
      };
    }
    if (issueId === 'exit' || issueId === 'bollard-stuck') {
      return {
        object: 'Operational Emergency Incident',
        title: 'Gate & Bollard Connectivity Escalation',
        description: 'A P1 operational incident has been logged. An operator is executing remote barrier overrides and checking IoT telemetry.',
        priority: 'P1 / 5 Minutes Response',
        team: 'IoT Operations Center',
        createsTicket: true,
        tone: 'warning',
      };
    }
    return {
      object: 'Tracked Support Ticket',
      title: 'Manual Access Verification Underway',
      description: 'Your booking credential and parking bay sensor are being verified against security access logs.',
      priority: 'High / 15 Minutes Response',
      team: 'Parking Operations Team',
      createsTicket: true,
      tone: 'info',
    };
  }

  if (workflowId === 'payment' && ['duplicate', 'unknown'].includes(issueId)) {
    return {
      object: 'Financial Dispute Investigation',
      title: issueId === 'unknown' ? 'Secured Transaction Investigation Opened' : 'Duplicate Charge Reversal Under Review',
      description: 'Finance and gateway audit logs have been compiled. Reversal approval will be processed to your original payment method.',
      priority: 'High / 30 Minutes Response',
      team: issueId === 'unknown' ? 'Trust & Safety Division' : 'Payments & Settlements',
      createsTicket: true,
      tone: 'danger',
    };
  }

  if (isOwner && workflowId === 'payout') {
    return {
      object: 'Tracked Support Ticket',
      title: 'Owner Payout Audit In Progress',
      description: 'Your weekly booking receipts and payout batch have been linked for owner support review.',
      priority: 'High / 1 Hour Response',
      team: 'Owner Settlements Desk',
      createsTicket: true,
      tone: 'info',
    };
  }

  if (
    (workflowId === 'booking' && issueId === 'expired') ||
    (workflowId === 'payment' && issueId === 'wallet-topup') ||
    (workflowId === 'vehicle' && issueId === 'plate-change')
  ) {
    return {
      object: 'Resolved Automatically',
      title: 'Automated Status Synchronization Complete',
      description: 'We refreshed the transaction telemetry and synchronized your account status. Your parking pass has been updated.',
      priority: 'Completed Instantly',
      team: 'ParkJom AI Smart Engine',
      createsTicket: false,
      tone: 'success',
    };
  }

  return {
    object: 'Tracked Support Ticket',
    title: 'Support Specialist Assigned',
    description: 'We compiled all booking, vehicle, and payment context. A support agent will respond shortly.',
    priority: 'Standard / Within 30 Mins',
    team: isOwner ? 'Owner Priority Support' : 'Customer Experience Team',
    createsTicket: true,
    tone: 'info',
  };
}

export default function UserSupportDashboard({ viewer, ticketWorkspace }: UserSupportDashboardProps) {
  const isOwner = viewer.role === 'Owner';
  const availableWorkflows = isOwner ? ownerWorkflows : commuterWorkflows;

  const [activeView, setActiveView] = useState<UserView>('home');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(availableWorkflows[0].id);
  const [workflowStep, setWorkflowStep] = useState(1);
  const [selectedIssue, setSelectedIssue] = useState(availableWorkflows[0].options[0].id);
  const [trapped, setTrapped] = useState<Answer>('');
  const [safetyRisk, setSafetyRisk] = useState<Answer>('');
  const [workflowResult, setWorkflowResult] = useState<WorkflowOutcome | null>(null);
  const [workflowReference, setWorkflowReference] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowSubmitting, setWorkflowSubmitting] = useState(false);

  // Live Chat state
  const [chatStarted, setChatStarted] = useState(false);
  const [chatComposer, setChatComposer] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatConverting, setChatConverting] = useState(false);
  const [chatReference, setChatReference] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const viewerFirstName = useMemo(() => viewer.name.trim().split(/\s+/)[0] || 'there', [viewer.name]);
  const selectedWorkflow = availableWorkflows.find((item) => item.id === selectedWorkflowId) ?? availableWorkflows[0];
  const selectedIssueLabel = selectedWorkflow.options.find((item) => item.id === selectedIssue)?.label ?? selectedWorkflow.options[0].label;

  const startWorkflow = (workflowId: string) => {
    const wf = availableWorkflows.find((item) => item.id === workflowId) ?? availableWorkflows[0];
    setSelectedWorkflowId(workflowId);
    setSelectedIssue(wf.options[0].id);
    setWorkflowStep(1);
    setTrapped('');
    setSafetyRisk('');
    setWorkflowResult(null);
    setWorkflowReference(null);
    setWorkflowError(null);
    setActiveView('quick-help');
  };

  const runWorkflow = async () => {
    if (selectedWorkflowId === 'access' && (!trapped || !safetyRisk)) {
      setWorkflowError('Please answer the emergency safety confirmation questions before continuing.');
      return;
    }

    const result = calculateWorkflowOutcome(selectedWorkflowId, selectedIssue, trapped, safetyRisk, isOwner);
    setWorkflowSubmitting(true);
    setWorkflowError(null);
    try {
      if (result.createsTicket) {
        const ticket = await createSupportTicket(viewer, {
          subject: `${selectedWorkflow.title}: ${selectedIssueLabel}`,
          message: [
            `Guided Triage Category: ${selectedWorkflow.title}`,
            `Specific Issue: ${selectedIssueLabel}`,
            selectedWorkflowId === 'access' ? `Vehicle trapped: ${trapped.toUpperCase()} | Safety risk: ${safetyRisk.toUpperCase()}` : '',
            `User Role: ${viewer.role}`,
            'Telemetry attached: Active booking, bay location, vehicle plate, gateway log, bollard heartbeat.',
            `Routing decision: ${result.object} (Priority: ${result.priority}) -> Assigned to ${result.team}`,
          ].filter(Boolean).join('\n'),
          files: [],
        });
        setWorkflowReference(ticket.ticketReference);
      }
      setWorkflowResult(result);
      setWorkflowStep(3);
    } catch (error) {
      setWorkflowError(error instanceof Error ? error.message : 'Unable to complete automated triage.');
    } finally {
      setWorkflowSubmitting(false);
    }
  };

  const startChat = (initialPrompt?: string) => {
    setChatStarted(true);
    const greeting = isOwner
      ? `Hello ${viewerFirstName}! I'm ParkJom's Owner Support Assistant. How can I help you with your property listings, payouts, or bollard hardware today?`
      : `Hello ${viewerFirstName}! I'm ParkJom's Support Assistant. How can I assist you with your parking booking, gate access, or payments today?`;

    const initialMsgs: ChatMessage[] = [
      {
        id: crypto.randomUUID(),
        sender: 'support',
        message: greeting,
        time: 'Just now',
      },
    ];

    if (initialPrompt) {
      initialMsgs.push(
        {
          id: crypto.randomUUID(),
          sender: 'user',
          message: initialPrompt,
          time: 'Just now',
        },
        {
          id: crypto.randomUUID(),
          sender: 'support',
          message: `I've attached your account context for "${initialPrompt}". Let me assist you immediately or connect you with a live agent.`,
          time: 'Just now',
        }
      );
    }

    setChatMessages(initialMsgs);
    setActiveView('live-chat');
  };

  const sendChatMessage = (event: FormEvent) => {
    event.preventDefault();
    const msg = chatComposer.trim();
    if (!msg) return;

    setChatMessages((curr) => [
      ...curr,
      { id: crypto.randomUUID(), sender: 'user', message: msg, time: 'Just now' },
      {
        id: crypto.randomUUID(),
        sender: 'support',
        message: `Thank you for the details. I have attached your profile telemetry. You can continue chatting, or click "Create Tracked Ticket" below to convert this into a prioritized case.`,
        time: 'Just now',
      },
    ]);
    setChatComposer('');
  };

  const convertChatToTicket = async () => {
    if (chatConverting || chatMessages.length === 0) return;
    setChatConverting(true);
    setChatError(null);
    try {
      const transcript = chatMessages.map((m) => `${m.sender === 'user' ? viewer.name : 'ParkJom Support Assistant'}: ${m.message}`).join('\n\n');
      const ticket = await createSupportTicket(viewer, {
        subject: `Live Chat Inquiry - ${chatMessages.find((m) => m.sender === 'user')?.message.slice(0, 50) || 'Support Session'}`,
        message: `Source: Live Chat Assistant (${viewer.role})\n\n${transcript}`,
        files: [],
      });
      setChatReference(ticket.ticketReference);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to create ticket from chat.');
    } finally {
      setChatConverting(false);
    }
  };

  // ── Render Home ──
  const renderHome = () => (
    <div className="space-y-5">
      {/* Hero Welcome Card - Clean Apple/SaaS Style */}
      <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#007AFF]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73]">
                {isOwner ? 'Owner Support Center' : 'Commuter Support Center'}
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
            <button
              type="button"
              onClick={() => startWorkflow(isOwner ? 'hardware' : 'access')}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.08] bg-[#F5F5F7] px-3.5 text-xs font-semibold text-[#1D1D1F] transition hover:bg-[#EBEBEF]"
            >
              <Siren className="h-3.5 w-3.5 text-rose-600" />
              <span>{isOwner ? 'Bollard Issue' : 'Gate & Access Help'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('live-chat')}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0066D6]"
            >
              <MessagesSquare className="h-3.5 w-3.5" />
              <span>Live Chat</span>
            </button>
          </div>
        </div>
      </section>

      {/* Guided Category Grid - Uniform White Cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#1D1D1F]">
              {isOwner ? 'Owner Support Categories' : 'Guided Troubleshooting'}
            </h2>
            <p className="text-[11px] text-[#6E6E73]">
              Select a topic to automatically run diagnostic checks and route to the right team.
            </p>
          </div>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {availableWorkflows.map((wf) => {
            const Icon = wf.icon;
            return (
              <button
                key={wf.id}
                type="button"
                onClick={() => startWorkflow(wf.id)}
                className="group flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-4.5 text-left shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition hover:border-[#007AFF]/40 hover:bg-[#F9FAFB] hover:shadow-sm cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#1D1D1F] transition group-hover:bg-blue-50 group-hover:text-[#007AFF]">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="rounded-md bg-[#F5F5F7] px-2 py-0.5 text-[9px] font-semibold text-[#6E6E73]">
                      {wf.badge}
                    </span>
                  </div>

                  <h3 className="mt-3.5 text-xs font-bold text-[#1D1D1F] group-hover:text-[#007AFF] transition-colors">
                    {wf.title}
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#6E6E73]">
                    {wf.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-[#007AFF]">
                  <span>Start diagnosis</span>
                  <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Two-Column Utility: Live Assistant & Ticket Overview */}
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Assistant Box */}
        <div className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#007AFF]">
                <Bot className="h-4.5 w-4.5" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-[#1D1D1F]">Need Quick Answers?</h3>
                <p className="text-[11px] text-[#6E6E73]">Ask a question or select a frequent inquiry:</p>
              </div>
            </div>

            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {(isOwner
                ? ['Why is my payout lower this week?', 'Bollard not lowering', 'Overstayed car in bay']
                : ['Barrier not opening', 'Check my refund status', 'Change number plate']
              ).map((promptText) => (
                <button
                  key={promptText}
                  type="button"
                  onClick={() => startChat(promptText)}
                  className="cursor-pointer rounded-lg border border-black/[0.06] bg-[#F5F5F7] px-2.5 py-1 text-[11px] font-medium text-[#1D1D1F] hover:border-[#007AFF] hover:bg-blue-50/40 hover:text-[#007AFF] transition"
                >
                  &ldquo;{promptText}&rdquo;
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-black/[0.06] pt-3.5 text-[11px] text-[#6E6E73]">
            <span className="flex items-center gap-1.5">
              <CircleDot className="h-2.5 w-2.5 text-[#34C759]" /> Support active
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
        <div className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#1D1D1F]">
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
              <div className="rounded-xl border border-black/[0.04] bg-[#F9FAFB] p-2.5 text-[11px] text-[#6E6E73]">
                <p className="font-semibold text-[#1D1D1F]">Service Level Guarantee</p>
                <p className="text-[10px] text-[#8E8E93] mt-0.5">
                  Critical barrier and access cases trigger on-call paging within 2 minutes.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveView('cases')}
            className="mt-4 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] bg-[#F5F5F7] py-2 text-xs font-semibold text-[#1D1D1F] hover:bg-[#EBEBEF]"
          >
            <TicketCheck className="h-3.5 w-3.5" /> Open Ticket Inbox
          </button>
        </div>
      </section>
    </div>
  );

  // ── Render Quick Help ──
  const renderQuickHelp = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setActiveView('home')}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
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
            Categories
          </p>
          {availableWorkflows.map((wf) => {
            const Icon = wf.icon;
            const isCurrent = wf.id === selectedWorkflowId;
            return (
              <button
                key={wf.id}
                type="button"
                onClick={() => startWorkflow(wf.id)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-left transition-all',
                  isCurrent
                    ? 'border-[#007AFF] bg-blue-50/50 shadow-xs font-bold text-[#007AFF]'
                    : 'border-black/[0.06] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7]'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate text-xs">{wf.title}</span>
              </button>
            );
          })}
        </aside>

        {/* Right Step Card */}
        <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <div className="border-b border-black/[0.06] p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#007AFF]">
              {selectedWorkflow.title}
            </p>
            <h3 className="mt-1 text-base font-bold text-[#1D1D1F]">
              {workflowStep === 1
                ? 'Select your specific issue'
                : workflowStep === 2
                ? 'Review automated diagnostics'
                : 'Diagnostic Resolution'}
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

          {/* Step 1: Issue Selection */}
          {workflowStep === 1 && (
            <div className="p-5 space-y-3.5">
              <p className="text-xs text-[#6E6E73]">
                Select the issue you are facing to initialize diagnosis:
              </p>

              <div className="grid gap-2">
                {selectedWorkflow.options.map((opt) => {
                  const isChecked = selectedIssue === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedIssue(opt.id)}
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 text-left text-xs font-semibold transition-all',
                        isChecked
                          ? 'border-[#007AFF] bg-blue-50/40 text-[#007AFF] ring-1 ring-[#007AFF]/20'
                          : 'border-black/[0.06] bg-white text-[#1D1D1F] hover:bg-[#F9FAFB]'
                      )}
                    >
                      <span>{opt.label}</span>
                      <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', isChecked ? 'border-[#007AFF] bg-[#007AFF] text-white' : 'border-black/[0.15]')}>
                        {isChecked && <Check className="h-2.5 w-2.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setWorkflowError(null);
                    setWorkflowStep(2);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0066D6]"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Telemetry Checks */}
          {workflowStep === 2 && (
            <div className="p-5 space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">
                    Automated Diagnostic Checks
                  </h4>
                  <div className="mt-2 divide-y divide-black/[0.04] rounded-xl border border-black/[0.06] bg-[#FAFBFD]">
                    {[
                      { label: 'Account', val: `${viewer.name} (${viewer.role})`, icon: User },
                      { label: 'Active Bay', val: isOwner ? 'Bay 12, Level 3' : 'BKG-2026-1182 (Active)', icon: CheckCircle2 },
                      { label: 'IoT Controller', val: selectedWorkflowId === 'hardware' ? 'Offline (Check required)' : 'Online (Signal 98%)', icon: Radio },
                      { label: 'Payment Gateway', val: 'Authorization Cleared', icon: WalletCards },
                    ].map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <div key={item.label} className="flex items-center gap-2.5 p-2.5 text-xs">
                          <ItemIcon className="h-3.5 w-3.5 text-[#007AFF] shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-[#8E8E93]">{item.label}</p>
                            <p className="font-medium text-[#1D1D1F] truncate">{item.val}</p>
                          </div>
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#34C759] shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-black/[0.06] bg-[#FAFBFD] p-3.5">
                  <h4 className="text-xs font-bold text-[#1D1D1F]">Verification</h4>
                  {selectedWorkflowId === 'access' || (isOwner && selectedWorkflowId === 'overstay') ? (
                    <div className="mt-2.5 space-y-3">
                      <div>
                        <p className="text-[11px] text-[#1D1D1F]">Are you currently trapped?</p>
                        <div className="mt-1 grid grid-cols-2 gap-1.5">
                          {(['yes', 'no'] as const).map((ans) => (
                            <button
                              key={ans}
                              type="button"
                              onClick={() => setTrapped(ans)}
                              className={cn(
                                'cursor-pointer rounded-lg border py-1 text-xs font-semibold transition',
                                trapped === ans ? 'border-[#007AFF] bg-blue-50 text-[#007AFF]' : 'border-black/[0.08] bg-white text-[#6E6E73]'
                              )}
                            >
                              {ans === 'yes' ? 'Yes' : 'No'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] text-[#1D1D1F]">Is there a safety hazard?</p>
                        <div className="mt-1 grid grid-cols-2 gap-1.5">
                          {(['yes', 'no'] as const).map((ans) => (
                            <button
                              key={ans}
                              type="button"
                              onClick={() => setSafetyRisk(ans)}
                              className={cn(
                                'cursor-pointer rounded-lg border py-1 text-xs font-semibold transition',
                                safetyRisk === ans ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-black/[0.08] bg-white text-[#6E6E73]'
                              )}
                            >
                              {ans === 'yes' ? 'Yes' : 'No'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-[#6E6E73]">
                      All necessary telemetry is ready for routing.
                    </div>
                  )}
                </div>
              </div>

              {workflowError && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {workflowError}
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
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50"
                >
                  {workflowSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}
                  <span>{workflowSubmitting ? 'Processing...' : 'Execute Resolution'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Result */}
          {workflowStep === 3 && workflowResult && (
            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-black/[0.06] bg-[#FAFBFD] p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#34C759] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">
                      {workflowResult.object}
                    </span>
                    <h4 className="text-sm font-bold text-[#1D1D1F]">
                      {workflowResult.title}
                    </h4>
                    <p className="mt-1 text-xs text-[#6E6E73]">
                      {workflowResult.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-3 text-xs">
                <div className="rounded-xl border border-black/[0.06] bg-white p-3">
                  <p className="text-[10px] text-[#8E8E93]">Issue</p>
                  <p className="font-semibold text-[#1D1D1F] truncate">{selectedIssueLabel}</p>
                </div>
                <div className="rounded-xl border border-black/[0.06] bg-white p-3">
                  <p className="text-[10px] text-[#8E8E93]">Target Response</p>
                  <p className="font-semibold text-[#1D1D1F]">{workflowResult.priority}</p>
                </div>
                <div className="rounded-xl border border-black/[0.06] bg-white p-3">
                  <p className="text-[10px] text-[#8E8E93]">Assigned Team</p>
                  <p className="font-semibold text-[#1D1D1F]">{workflowResult.team}</p>
                </div>
              </div>

              {workflowReference && (
                <div className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white p-3 text-xs">
                  <div>
                    <p className="text-[10px] text-[#8E8E93]">Ticket Reference</p>
                    <p className="font-mono font-bold text-[#007AFF]">{workflowReference}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveView('cases')}
                    className="cursor-pointer text-xs font-semibold text-[#007AFF] hover:underline"
                  >
                    View in Ticket Inbox &rarr;
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-black/[0.06] pt-3.5">
                <button
                  type="button"
                  onClick={() => startWorkflow(selectedWorkflowId)}
                  className="cursor-pointer rounded-xl border border-black/[0.08] px-3.5 py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Start Over
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('home')}
                  className="cursor-pointer rounded-xl bg-[#1D1D1F] px-4 py-1.5 text-xs font-semibold text-white hover:bg-black"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );

  // ── Render Live Chat ──
  const renderLiveChat = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setActiveView('home')}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Help Center
        </button>

        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6E6E73]">
          <CircleDot className="h-2.5 w-2.5 text-[#34C759]" /> Support Assistant Active
        </span>
      </div>

      {!chatStarted ? (
        <section className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#1D1D1F]">Start Live Support Session</h3>
            <p className="mt-1 text-xs text-[#6E6E73] max-w-lg">
              Connect directly with our support team. Your account context and active telemetry are attached automatically.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {[
              isOwner ? 'Payout Breakdown Query' : 'Barrier Not Opening',
              isOwner ? 'Bollard Sensor Fault' : 'Booking Refund Status',
              'General Question',
            ].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => startChat(label)}
                className="cursor-pointer rounded-lg border border-black/[0.06] bg-[#F5F5F7] px-3 py-1.5 text-xs font-medium text-[#1D1D1F] hover:border-[#007AFF] hover:bg-blue-50/40 hover:text-[#007AFF]"
              >
                &ldquo;{label}&rdquo;
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => startChat()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#007AFF] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0066D6]"
          >
            <MessageCircle className="h-4 w-4" /> Start Conversation
          </button>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)] lg:grid lg:min-h-[580px] lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Left Chat Meta */}
          <aside className="border-b border-black/[0.06] bg-[#FAFBFD] p-4 lg:border-b-0 lg:border-r space-y-3 text-xs">
            <div>
              <p className="font-bold text-[#1D1D1F]">ParkJom Assistant</p>
              <p className="text-[10px] text-[#34C759] font-medium">Session Connected</p>
            </div>

            <div className="rounded-lg border border-black/[0.04] bg-white p-2.5 text-[11px]">
              <p className="text-[10px] text-[#8E8E93]">User</p>
              <p className="font-semibold text-[#1D1D1F] truncate">{viewer.name}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setChatStarted(false);
                setChatMessages([]);
                setChatReference(null);
              }}
              className="w-full cursor-pointer rounded-lg border border-black/[0.08] bg-white py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
            >
              End Chat
            </button>
          </aside>

          {/* Right Chat Stream */}
          <div className="flex min-h-[500px] flex-col bg-[#FAFBFD]">
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {chatMessages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div key={msg.id} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[85%] sm:max-w-[75%]', isUser && 'text-right')}>
                      <p className="mb-0.5 text-[9px] text-[#8E8E93]">
                        {isUser ? viewer.name : 'ParkJom Assistant'} · {msg.time}
                      </p>
                      <div
                        className={cn(
                          'rounded-2xl px-3.5 py-2 text-left text-xs leading-relaxed shadow-xs',
                          isUser
                            ? 'rounded-br-sm bg-[#007AFF] text-white'
                            : 'rounded-bl-sm border border-black/[0.06] bg-white text-[#1D1D1F]'
                        )}
                      >
                        {msg.message}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {chatReference && (
              <div className="border-t border-black/[0.06] bg-white p-3 text-xs flex items-center justify-between">
                <span className="font-medium text-[#1D1D1F]">
                  Ticket Created: <span className="font-mono font-bold text-[#007AFF]">{chatReference}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveView('cases')}
                  className="cursor-pointer text-xs font-bold text-[#007AFF] hover:underline"
                >
                  Open in Inbox &rarr;
                </button>
              </div>
            )}

            {chatError && (
              <div className="border-t border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                {chatError}
              </div>
            )}

            <form onSubmit={sendChatMessage} className="border-t border-black/[0.06] bg-white p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatComposer}
                  onChange={(e) => setChatComposer(e.target.value)}
                  placeholder="Type a message..."
                  className="min-h-9 flex-1 rounded-xl border border-black/[0.08] bg-[#F5F5F7] px-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!chatComposer.trim()}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#007AFF] text-white hover:bg-[#0066D6] disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>

              {chatMessages.length > 1 && !chatReference && (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void convertChatToTicket()}
                    disabled={chatConverting}
                    className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-[#007AFF] hover:underline disabled:opacity-50"
                  >
                    {chatConverting ? <Loader2 className="h-3 w-3 animate-spin" /> : <TicketCheck className="h-3 w-3" />}
                    <span>Convert to Tracked Ticket</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </section>
      )}
    </div>
  );

  return (
    <div className="space-y-4" data-component="user-support-dashboard">
      {/* Tab Navigation Ribbon - Clean Apple Style */}
      <section className="rounded-2xl border border-black/[0.06] bg-white p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] sm:px-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#007AFF]">
              <LifeBuoy className="h-4.5 w-4.5" />
            </span>
            <div>
              <p className="text-xs font-bold text-[#1D1D1F]">
                {isOwner ? 'Owner Support Center' : 'Support Center'}
              </p>
              <p className="text-[10px] text-[#6E6E73]">
                Instant diagnostics and live ticket tracking
              </p>
            </div>
          </div>

          {/* Mobile Navigation: 4-Column Grid (No horizontal swipe) */}
          <nav className="grid grid-cols-4 gap-1 rounded-xl bg-[#F5F5F7] p-1 sm:hidden" aria-label="Support navigation mobile">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex min-h-9 flex-col items-center justify-center gap-0.5 rounded-lg p-1 text-center text-[10px] font-semibold transition-all cursor-pointer',
                    isActive
                      ? 'bg-white text-[#007AFF] shadow-xs font-bold'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="truncate max-w-full">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Desktop Navigation: Horizontal Ribbon */}
          <nav className="hidden sm:flex min-w-0 gap-1 rounded-xl bg-[#F5F5F7] p-1" aria-label="Support navigation">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-7 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all',
                    isActive
                      ? 'bg-white text-[#007AFF] shadow-xs font-bold'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      {/* Dynamic Views */}
      {activeView === 'home' && renderHome()}
      {activeView === 'quick-help' && renderQuickHelp()}
      {activeView === 'live-chat' && renderLiveChat()}
      {activeView === 'cases' && ticketWorkspace}
    </div>
  );
}
