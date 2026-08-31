import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
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
  Clock3,
  CreditCard,
  FileSearch,
  HelpCircle,
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
  UserRound,
  WalletCards,
  Workflow,
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
type WorkflowId = 'access' | 'booking' | 'payment' | 'account';
type Answer = 'yes' | 'no' | '';

interface WorkflowDefinition {
  id: WorkflowId;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  iconTone: string;
  options: { id: string; label: string }[];
}

interface WorkflowOutcome {
  object: 'Resolved automatically' | 'Support ticket' | 'Operational incident + ticket' | 'Dispute + ticket';
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

const workflows: WorkflowDefinition[] = [
  {
    id: 'access',
    title: 'Cannot enter or exit',
    description: 'Gate, barrier, or booking validation problem at the parking site.',
    icon: Siren,
    tone: 'border-rose-200 bg-rose-50/70 hover:border-rose-300',
    iconTone: 'bg-rose-100 text-rose-700',
    options: [
      { id: 'enter', label: 'I cannot enter' },
      { id: 'exit', label: 'I cannot leave' },
      { id: 'validation', label: 'My booking is not recognized' },
    ],
  },
  {
    id: 'booking',
    title: 'Booking problem',
    description: 'Missing, incorrect, expired, or non-cancellable booking.',
    icon: CalendarClock,
    tone: 'border-amber-200 bg-amber-50/70 hover:border-amber-300',
    iconTone: 'bg-amber-100 text-amber-700',
    options: [
      { id: 'missing', label: 'Booking not found' },
      { id: 'location', label: 'Wrong parking location' },
      { id: 'cancel', label: 'Cannot cancel' },
      { id: 'time', label: 'Incorrect booking time' },
      { id: 'expired', label: 'Booking shown as expired' },
      { id: 'other', label: 'Something else' },
    ],
  },
  {
    id: 'payment',
    title: 'Payment or refund',
    description: 'Payment confirmation, refund status, or an unfamiliar charge.',
    icon: CreditCard,
    tone: 'border-cyan-200 bg-cyan-50/70 hover:border-cyan-300',
    iconTone: 'bg-cyan-100 text-cyan-700',
    options: [
      { id: 'paid-missing', label: 'Paid but booking is missing' },
      { id: 'refund', label: 'Refund status' },
      { id: 'failed', label: 'Payment failed' },
      { id: 'duplicate', label: 'Charged twice' },
      { id: 'unknown', label: 'I do not recognize this charge' },
      { id: 'other', label: 'Something else' },
    ],
  },
  {
    id: 'account',
    title: 'Account, vehicle or owner',
    description: 'Profile, vehicle, verification, listing, or owner payout support.',
    icon: UserRound,
    tone: 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300',
    iconTone: 'bg-emerald-100 text-emerald-700',
    options: [
      { id: 'access', label: 'Cannot access account' },
      { id: 'vehicle', label: 'Vehicle information is incorrect' },
      { id: 'verification', label: 'Account verification' },
      { id: 'payout', label: 'Owner payout status' },
      { id: 'listing', label: 'Parking listing problem' },
      { id: 'payout-dispute', label: 'Owner payout dispute' },
      { id: 'security', label: 'Account security concern' },
    ],
  },
];

const recentCases = [
  { reference: 'TKT-2026-00382', title: 'Booking validation at SS15', status: 'In progress', tone: 'bg-blue-50 text-blue-700' },
  { reference: 'TKT-2026-00351', title: 'Refund confirmation', status: 'Waiting for customer', tone: 'bg-amber-50 text-amber-700' },
  { reference: 'DSP-2026-00018', title: 'Duplicate card charge', status: 'Under review', tone: 'bg-rose-50 text-rose-700' },
];

const navigation: { id: UserView; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Help Center', icon: LifeBuoy },
  { id: 'quick-help', label: 'Quick Help', icon: Workflow },
  { id: 'live-chat', label: 'Live Chat', icon: MessagesSquare },
  { id: 'cases', label: 'My Cases', icon: TicketCheck },
];

const outcomeTone: Record<WorkflowOutcome['tone'], string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
};

function workflowOutcome(workflowId: WorkflowId, issueId: string, trapped: Answer, safetyRisk: Answer): WorkflowOutcome {
  if (workflowId === 'access') {
    if (trapped === 'yes' || safetyRisk === 'yes') {
      return {
        object: 'Operational incident + ticket',
        title: 'Emergency response has been prepared',
        description: 'The case will page the on-call parking team immediately and keep a customer ticket open for updates.',
        priority: 'P0 / immediate',
        team: 'Parking Operations',
        createsTicket: true,
        tone: 'danger',
      };
    }
    if (issueId === 'exit') {
      return {
        object: 'Operational incident + ticket',
        title: 'Gate connectivity needs operator attention',
        description: 'A P1 incident will be linked to your support case so operations can restore access and keep you informed.',
        priority: 'P1 / 5 minutes',
        team: 'Parking Operations',
        createsTicket: true,
        tone: 'warning',
      };
    }
    return {
      object: 'Support ticket',
      title: 'Booking validation needs a manual check',
      description: 'Your booking and gate are online, but the access credential needs an operations review.',
      priority: 'High / 15 minutes',
      team: 'Parking Operations',
      createsTicket: true,
      tone: 'info',
    };
  }

  if (workflowId === 'payment' && ['duplicate', 'unknown'].includes(issueId)) {
    return {
      object: 'Dispute + ticket',
      title: issueId === 'unknown' ? 'The transaction will be secured and reviewed' : 'A duplicate charge review is required',
      description: 'Finance will preserve the payment evidence, investigate the charge, and communicate through a linked ticket.',
      priority: 'High / 30 minutes',
      team: issueId === 'unknown' ? 'Trust & Safety' : 'Payments',
      createsTicket: true,
      tone: 'danger',
    };
  }

  if (workflowId === 'account' && ['payout-dispute', 'security'].includes(issueId)) {
    return {
      object: 'Dispute + ticket',
      title: 'A protected review is required',
      description: 'The support case will be linked to an investigation so evidence, decisions, and customer updates remain separate and traceable.',
      priority: 'High / 1 hour',
      team: issueId === 'security' ? 'Trust & Safety' : 'Owner Support',
      createsTicket: true,
      tone: 'danger',
    };
  }

  if ((workflowId === 'booking' && issueId === 'expired') || (workflowId === 'payment' && issueId === 'failed')) {
    return {
      object: 'Resolved automatically',
      title: workflowId === 'booking' ? 'Your booking is still valid' : 'No charge was completed',
      description: workflowId === 'booking'
        ? 'We refreshed the booking status and restored it to your active parking pass.'
        : 'The failed authorization has been cleared. You can retry with the same or a different payment method.',
      priority: 'Completed now',
      team: 'Automated workflow',
      createsTicket: false,
      tone: 'success',
    };
  }

  return {
    object: 'Support ticket',
    title: 'A support specialist will follow up',
    description: 'The workflow collected the relevant account, booking, and payment context so you do not need to repeat it.',
    priority: workflowId === 'payment' ? 'High / 30 minutes' : 'Standard / 4 hours',
    team: workflowId === 'payment' ? 'Payments' : workflowId === 'account' ? 'Customer and Owner Support' : 'Customer Support',
    createsTicket: true,
    tone: 'info',
  };
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase text-blue-600">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function ChoiceButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3.5 text-left text-sm font-semibold transition',
        active ? 'border-blue-400 bg-blue-50 text-blue-800 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50',
      )}
    >
      <span>{children}</span>
      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300')}>
        {active && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
}

export default function UserSupportDashboard({ viewer, ticketWorkspace }: UserSupportDashboardProps) {
  const [activeView, setActiveView] = useState<UserView>('home');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<WorkflowId>('access');
  const [workflowStep, setWorkflowStep] = useState(1);
  const [selectedIssue, setSelectedIssue] = useState('enter');
  const [trapped, setTrapped] = useState<Answer>('');
  const [safetyRisk, setSafetyRisk] = useState<Answer>('');
  const [workflowResult, setWorkflowResult] = useState<WorkflowOutcome | null>(null);
  const [workflowReference, setWorkflowReference] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowSubmitting, setWorkflowSubmitting] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [chatComposer, setChatComposer] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatConverting, setChatConverting] = useState(false);
  const [chatReference, setChatReference] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const selectedWorkflow = workflows.find((item) => item.id === selectedWorkflowId) ?? workflows[0];
  const selectedIssueLabel = selectedWorkflow.options.find((item) => item.id === selectedIssue)?.label ?? selectedWorkflow.options[0].label;
  const isOwner = viewer.role === 'Owner';

  const viewerFirstName = useMemo(() => viewer.name.trim().split(/\s+/)[0] || 'there', [viewer.name]);

  const startWorkflow = (workflowId: WorkflowId) => {
    const workflow = workflows.find((item) => item.id === workflowId) ?? workflows[0];
    setSelectedWorkflowId(workflowId);
    setSelectedIssue(workflow.options[0].id);
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
      setWorkflowError('Please confirm whether you are trapped and whether there is a safety risk.');
      return;
    }

    const result = workflowOutcome(selectedWorkflowId, selectedIssue, trapped, safetyRisk);
    setWorkflowSubmitting(true);
    setWorkflowError(null);
    try {
      if (result.createsTicket) {
        const ticket = await createSupportTicket(viewer, {
          subject: `${selectedWorkflow.title}: ${selectedIssueLabel}`,
          message: [
            `Quick Help workflow: ${selectedWorkflow.title}`,
            `Issue: ${selectedIssueLabel}`,
            selectedWorkflowId === 'access' ? `Currently trapped: ${trapped}. Safety risk: ${safetyRisk}.` : '',
            'System context collected: current booking, parking location, vehicle, payment state, and recent support history.',
            `Routing outcome: ${result.object}. Priority: ${result.priority}. Assigned team: ${result.team}.`,
          ].filter(Boolean).join('\n'),
          files: [],
        });
        setWorkflowReference(ticket.ticketReference);
      }
      setWorkflowResult(result);
      setWorkflowStep(3);
    } catch (error) {
      setWorkflowError(error instanceof Error ? error.message : 'Unable to complete this workflow.');
    } finally {
      setWorkflowSubmitting(false);
    }
  };

  const startChat = () => {
    setChatStarted(true);
    setChatMessages([
      {
        id: crypto.randomUUID(),
        sender: 'support',
        message: `Hi ${viewerFirstName}. I can help you choose a workflow, explain an existing case, or collect details for our support team.`,
        time: 'Now',
      },
    ]);
  };

  const sendChatMessage = (event: FormEvent) => {
    event.preventDefault();
    const message = chatComposer.trim();
    if (!message) return;
    setChatMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), sender: 'user', message, time: 'Now' },
      {
        id: crypto.randomUUID(),
        sender: 'support',
        message: 'Thanks. I have attached your current account and recent booking context. A support specialist can continue here, or you can turn this conversation into a tracked case.',
        time: 'Now',
      },
    ]);
    setChatComposer('');
  };

  const convertChatToTicket = async () => {
    if (chatConverting || chatMessages.length === 0) return;
    setChatConverting(true);
    setChatError(null);
    try {
      const transcript = chatMessages.map((message) => `${message.sender === 'user' ? viewer.name : 'ParkJom Support'}: ${message.message}`).join('\n\n');
      const ticket = await createSupportTicket(viewer, {
        subject: 'Follow-up from Live Chat',
        message: `Conversation source: Live Chat\n\n${transcript}`,
        files: [],
      });
      setChatReference(ticket.ticketReference);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Unable to create a case from this conversation.');
    } finally {
      setChatConverting(false);
    }
  };

  const renderHome = () => (
    <div className="space-y-6">
      <PageTitle
        eyebrow="Help and support"
        title={`How can we help, ${viewerFirstName}?`}
        description="Use a guided workflow for known issues, or start a conversation when your situation needs more explanation."
      />

      <section className="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex flex-col justify-between gap-5 bg-rose-50/80 p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm"><Siren className="h-6 w-6" /></span>
              <div>
                <p className="text-[11px] font-semibold uppercase text-rose-700">Immediate parking access help</p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">Cannot enter or leave the parking site?</h3>
                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">We will check your booking, payment, gate connection, and safety status before routing the right response.</p>
              </div>
            </div>
            <button type="button" onClick={() => startWorkflow('access')} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700">
              Get access help <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 border-t border-rose-100 bg-white p-5 lg:border-l lg:border-t-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Radio className="h-5 w-5" /></span>
            <div><p className="text-sm font-semibold text-slate-900">Emergency support online</p><p className="mt-0.5 text-xs leading-5 text-slate-500">P0 and P1 access issues notify the on-call team 24/7.</p></div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="text-base font-bold text-slate-900">Common issues</h3><p className="mt-1 text-xs text-slate-500">Quick Help only asks for details the system cannot retrieve.</p></div><span className="hidden text-xs font-medium text-slate-400 sm:inline">Usually 1-3 minutes</span></div>
        <div className="grid gap-3 md:grid-cols-3">
          {workflows.filter((workflow) => workflow.id !== 'access').map((workflow) => {
            const Icon = workflow.icon;
            const title = workflow.id === 'account' && isOwner ? 'Account, payout or listing' : workflow.title;
            return (
              <button key={workflow.id} type="button" onClick={() => startWorkflow(workflow.id)} className={cn('group min-h-44 rounded-2xl border p-4 text-left transition shadow-sm', workflow.tone)}>
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', workflow.iconTone)}><Icon className="h-5 w-5" /></span>
                <h4 className="mt-5 text-sm font-bold text-slate-900">{title}</h4>
                <p className="mt-1 min-h-10 text-xs leading-5 text-slate-600">{workflow.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-700">Start workflow <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><MessageCircle className="h-5 w-5" /></span><div><h3 className="text-base font-bold text-slate-900">Need help with something else?</h3><p className="mt-1 text-xs leading-5 text-slate-500">Start Live Chat for explanations, non-standard issues, or updates on an existing case.</p></div></div>
            <button type="button" onClick={() => setActiveView('live-chat')} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"><MessagesSquare className="h-4 w-4" />Start Live Chat</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1.5"><CircleDot className="h-3.5 w-3.5 text-emerald-600" />4 agents online</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />About 2 minute wait</span><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Conversation saved securely</span></div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-base font-bold text-slate-900">Your recent cases</h3><p className="mt-1 text-xs text-slate-500">Updates from support and operations.</p></div><button type="button" onClick={() => setActiveView('cases')} className="text-xs font-semibold text-blue-600 hover:text-blue-700">View all</button></div>
          <div className="mt-4 divide-y divide-slate-100">
            {recentCases.map((item) => <button key={item.reference} type="button" onClick={() => setActiveView('cases')} className="flex w-full items-center gap-3 py-3 text-left first:pt-0 last:pb-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><ReceiptText className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block font-mono text-[10px] font-semibold text-slate-400">{item.reference}</span><span className="block truncate text-xs font-semibold text-slate-800">{item.title}</span></span><span className={cn('shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold', item.tone)}>{item.status}</span></button>)}
          </div>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <p>Emergency parking access support is available 24/7. General questions can be submitted at any time and are handled during service hours.</p>
      </div>
    </div>
  );

  const renderQuickHelp = () => (
    <div className="space-y-5">
      <PageTitle eyebrow="Guided support" title="Quick Help" description="Choose a known issue. ParkJom will collect your current context, run checks, and route the correct support object." action={<button type="button" onClick={() => setActiveView('home')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600"><ArrowLeft className="h-4 w-4" />Help Center</button>} />

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-2">
          {workflows.map((workflow) => {
            const Icon = workflow.icon;
            const active = workflow.id === selectedWorkflowId;
            return <button key={workflow.id} type="button" onClick={() => startWorkflow(workflow.id)} className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-left transition', active ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50')}><span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', active ? 'bg-blue-600 text-white' : workflow.iconTone)}><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-900">{workflow.id === 'account' && isOwner ? 'Account, payout or listing' : workflow.title}</span><span className="mt-0.5 block text-[10px] text-slate-500">{workflow.options.length} guided options</span></span></button>;
          })}
        </aside>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase text-blue-600">{selectedWorkflow.title}</p><h3 className="mt-1 text-lg font-bold text-slate-950">{workflowStep === 1 ? 'What happened?' : workflowStep === 2 ? 'Review the system checks' : 'Your support route is ready'}</h3></div><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">Step {workflowStep} of 3</span></div>
            <div className="mt-4 grid grid-cols-3 gap-1.5">{[1, 2, 3].map((step) => <span key={step} className={cn('h-1.5 rounded-full', step <= workflowStep ? 'bg-blue-600' : 'bg-slate-200')} />)}</div>
          </div>

          {workflowStep === 1 && <div className="p-4 sm:p-5"><p className="text-xs font-semibold text-slate-700">Select the option that best matches your issue.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{selectedWorkflow.options.map((option) => <ChoiceButton key={option.id} active={selectedIssue === option.id} onClick={() => setSelectedIssue(option.id)}>{option.label}</ChoiceButton>)}</div><div className="mt-5 flex justify-end"><button type="button" onClick={() => { setWorkflowError(null); setWorkflowStep(2); }} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700">Continue <ArrowRight className="h-4 w-4" /></button></div></div>}

          {workflowStep === 2 && <div className="p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Context collected automatically</h4>
                <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {([
                    { label: 'Current booking', value: selectedWorkflowId === 'account' ? 'No active booking required' : 'BKG-2026-1182 / Active', icon: CheckCircle2 },
                    { label: 'Parking location', value: 'SS15 Courtyard / Bay 12', icon: CheckCircle2 },
                    { label: 'Vehicle', value: 'VBY 2188 / Verified', icon: Car },
                    { label: 'Payment', value: selectedWorkflowId === 'payment' ? 'Gateway record found' : 'Paid / RM 9.00', icon: WalletCards },
                    { label: 'IoT connection', value: selectedWorkflowId === 'access' && selectedIssue === 'exit' ? 'Intermittent signal' : 'Online / 18 seconds ago', icon: Radio },
                  ] as { label: string; value: string; icon: LucideIcon }[]).map(({ label, value, icon: Icon }) => <div key={label} className="flex items-center gap-3 px-3 py-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-[10px] font-medium text-slate-400">{label}</span><span className="block truncate text-xs font-semibold text-slate-800">{value}</span></span><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /></div>)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-bold text-slate-900">Only what we still need</h4>
                {selectedWorkflowId === 'access' ? <div className="mt-4 space-y-4"><div><p className="text-xs font-semibold text-slate-700">Are you currently trapped?</p><div className="mt-2 grid grid-cols-2 gap-2">{(['yes', 'no'] as const).map((answer) => <ChoiceButton key={answer} active={trapped === answer} onClick={() => setTrapped(answer)}>{answer === 'yes' ? 'Yes' : 'No'}</ChoiceButton>)}</div></div><div><p className="text-xs font-semibold text-slate-700">Is there an immediate safety risk?</p><div className="mt-2 grid grid-cols-2 gap-2">{(['yes', 'no'] as const).map((answer) => <ChoiceButton key={answer} active={safetyRisk === answer} onClick={() => setSafetyRisk(answer)}>{answer === 'yes' ? 'Yes' : 'No'}</ChoiceButton>)}</div></div></div> : <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-emerald-800"><Sparkles className="h-4 w-4" />No extra details needed</div><p className="mt-1 text-[10px] leading-4 text-emerald-700">The workflow already has the account and transaction context required for routing.</p></div>}
              </div>
            </div>
            {workflowError && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{workflowError}</div>}
            <div className="mt-5 flex items-center justify-between gap-3"><button type="button" onClick={() => setWorkflowStep(1)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600"><ArrowLeft className="h-4 w-4" />Back</button><button type="button" onClick={() => void runWorkflow()} disabled={workflowSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{workflowSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}{workflowSubmitting ? 'Running checks...' : 'Run checks'}</button></div>
          </div>}

          {workflowStep === 3 && workflowResult && <div className="p-4 sm:p-5">
            <div className={cn('rounded-xl border p-4', outcomeTone[workflowResult.tone])}><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/70"><CheckCircle2 className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold uppercase">{workflowResult.object}</p><h4 className="mt-1 text-base font-bold">{workflowResult.title}</h4><p className="mt-1 text-xs leading-5 opacity-90">{workflowResult.description}</p></div></div></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-medium text-slate-400">Issue</p><p className="mt-1 text-xs font-semibold text-slate-800">{selectedIssueLabel}</p></div><div className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-medium text-slate-400">Priority / response</p><p className="mt-1 text-xs font-semibold text-slate-800">{workflowResult.priority}</p></div><div className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-medium text-slate-400">Assigned team</p><p className="mt-1 text-xs font-semibold text-slate-800">{workflowResult.team}</p></div></div>
            {workflowReference && <div className="mt-4 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3"><TicketCheck className="h-5 w-5 shrink-0 text-blue-600" /><div className="min-w-0 flex-1"><p className="text-[10px] font-medium text-blue-600">Case created</p><p className="font-mono text-sm font-bold text-blue-900">{workflowReference}</p></div><span className="text-[10px] font-medium text-blue-700">Notifications on</span></div>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => startWorkflow(selectedWorkflowId)} className="rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600">Start again</button>{workflowReference ? <button type="button" onClick={() => setActiveView('cases')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white"><TicketCheck className="h-4 w-4" />View my case</button> : <button type="button" onClick={() => setActiveView('home')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white"><Check className="h-4 w-4" />Done</button>}</div>
          </div>}
        </section>
      </div>
    </div>
  );

  const renderLiveChat = () => (
    <div className="space-y-5">
      <PageTitle eyebrow="Conversation support" title="Live Chat" description="Use chat when you are unsure which workflow applies, need an explanation, or want an update on an existing case." action={<span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><CircleDot className="h-3.5 w-3.5" />4 agents online</span>} />
      {!chatStarted ? <section className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="p-5 sm:p-7"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white"><MessagesSquare className="h-6 w-6" /></span><h3 className="mt-5 text-xl font-bold text-slate-950">Start a conversation</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">We will attach your identity, current booking, and recent cases automatically. You can continue the same conversation if a ticket is created.</p><div className="mt-5 flex flex-wrap gap-2">{['General question', 'Help choosing a workflow', 'Case status', 'Complex situation'].map((label) => <span key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600">{label}</span>)}</div><button type="button" onClick={startChat} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"><MessageCircle className="h-4 w-4" />Start Live Chat</button></div>
        <div className="border-t border-slate-100 bg-slate-50 p-5 lg:border-l lg:border-t-0"><h4 className="text-sm font-bold text-slate-900">Before the chat starts</h4><div className="mt-4 space-y-4">{([
          { icon: ShieldCheck, title: 'Identity verified', value: viewer.email },
          { icon: CalendarClock, title: 'Current booking', value: 'Attached when available' },
          { icon: Clock3, title: 'Estimated wait', value: 'About 2 minutes' },
        ] as { icon: LucideIcon; title: string; value: string }[]).map(({ icon: Icon, title, value }) => <div key={title} className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm"><Icon className="h-4 w-4" /></span><div><p className="text-xs font-semibold text-slate-800">{title}</p><p className="mt-0.5 text-[10px] text-slate-500">{value}</p></div></div>)}</div></div>
      </section> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid lg:min-h-[620px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Bot className="h-5 w-5" /></span><div><p className="text-sm font-bold text-slate-900">ParkJom Support</p><p className="text-[10px] font-medium text-emerald-700">Conversation active</p></div></div><div className="mt-5 space-y-3"><div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-medium text-slate-400">Conversation ID</p><p className="mt-1 font-mono text-xs font-semibold text-slate-800">CON-2026-00125</p></div><div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-medium text-slate-400">Context attached</p><div className="mt-2 space-y-1.5 text-[10px] text-slate-600"><p className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-600" />Customer profile</p><p className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-600" />Recent booking</p><p className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-600" />Recent cases</p></div></div></div></aside>
        <div className="flex min-h-[540px] flex-col"><header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><p className="text-sm font-bold text-slate-900">Live support conversation</p><p className="text-[10px] text-slate-500">Messages are saved to your support history.</p></div><button type="button" onClick={() => { setChatStarted(false); setChatMessages([]); setChatReference(null); }} className="rounded-lg border border-slate-200 px-3 text-[10px] font-semibold text-slate-600">End chat</button></header>
          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4 sm:p-5">{chatMessages.map((message) => <div key={message.id} className={cn('flex', message.sender === 'user' ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[88%] sm:max-w-[72%]', message.sender === 'user' && 'text-right')}><p className="mb-1 px-1 text-[9px] font-semibold text-slate-400">{message.sender === 'user' ? viewer.name : 'ParkJom Support'} / {message.time}</p><div className={cn('rounded-2xl px-3.5 py-2.5 text-left text-xs leading-5 shadow-sm', message.sender === 'user' ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700')}>{message.message}</div></div></div>)}</div>
          {chatReference && <div className="border-t border-blue-200 bg-blue-50 px-4 py-3"><div className="flex items-center gap-3"><TicketCheck className="h-5 w-5 shrink-0 text-blue-600" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-blue-900">This conversation continues under {chatReference}.</p><p className="mt-0.5 text-[10px] text-blue-700">You can check its progress in My Cases.</p></div><button type="button" onClick={() => setActiveView('cases')} className="shrink-0 text-[10px] font-semibold text-blue-700">View case</button></div></div>}
          {chatError && <div role="alert" className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">{chatError}</div>}
          <form onSubmit={sendChatMessage} className="border-t border-slate-200 p-3"><div className="flex items-end gap-2"><textarea value={chatComposer} onChange={(event) => setChatComposer(event.target.value)} rows={1} placeholder="Type your message..." className="min-h-11 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-3 text-xs outline-none focus:border-blue-500" /><button type="submit" disabled={!chatComposer.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-40" aria-label="Send message"><Send className="h-4 w-4" /></button></div><div className="mt-2 flex items-center justify-between gap-3"><p className="text-[9px] text-slate-400">Do not share full payment card or password details.</p>{chatMessages.length > 1 && !chatReference && <button type="button" onClick={() => void convertChatToTicket()} disabled={chatConverting} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg text-[10px] font-semibold text-blue-600 disabled:opacity-60">{chatConverting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TicketCheck className="h-3.5 w-3.5" />}Create tracked case</button>}</div></form>
        </div>
      </section>}
    </div>
  );

  return (
    <div className="space-y-5" data-support-mode="user">
      <section className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3 px-1"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><LifeBuoy className="h-5 w-5" /></span><div><p className="text-sm font-bold text-slate-950">ParkJom Support</p><p className="text-[10px] text-slate-500">Guided help, conversations, and case tracking</p></div></div>
          <nav className="flex min-w-0 gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" aria-label="Support sections">
            {navigation.map((item) => { const Icon = item.icon; const active = activeView === item.id; return <button key={item.id} type="button" onClick={() => setActiveView(item.id)} aria-current={active ? 'page' : undefined} className={cn('inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition', active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800')}><Icon className="h-3.5 w-3.5" />{item.label}</button>; })}
          </nav>
        </div>
      </section>

      {activeView === 'home' && renderHome()}
      {activeView === 'quick-help' && renderQuickHelp()}
      {activeView === 'live-chat' && renderLiveChat()}
      {activeView === 'cases' && ticketWorkspace}
    </div>
  );
}
