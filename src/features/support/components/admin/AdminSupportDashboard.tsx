import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  CreditCard,
  FileCheck2,
  FileSearch,
  Headphones,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  Loader2,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  PhoneCall,
  Radio,
  ReceiptText,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TicketCheck,
  UserCheck,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createAdminSupportTicket } from '../../api/supportTicketService';
import type { SupportViewer } from '../../types';

interface AdminSupportDashboardProps {
  viewer: SupportViewer;
  ticketWorkspace: ReactNode;
}

type AdminView = 'command' | 'conversations' | 'tickets' | 'incidents' | 'disputes' | 'on-call';

interface ConversationRecord {
  id: string;
  customer: string;
  email: string;
  role: 'Commuter' | 'Owner';
  subject: string;
  preview: string;
  channel: string;
  wait: string;
  priority: 'Urgent' | 'Standard';
  booking: string;
  parking: string;
  messages: { sender: 'customer' | 'admin' | 'system'; text: string; time: string }[];
}

interface IncidentRecord {
  id: string;
  priority: 'P0' | 'P1' | 'P2';
  title: string;
  location: string;
  status: 'Unacknowledged' | 'Acknowledged' | 'Monitoring';
  affected: number;
  opened: string;
  owner: string;
  source: string;
}

interface DisputeRecord {
  id: string;
  title: string;
  customer: string;
  amount: string;
  type: string;
  status: 'Evidence review' | 'Finance review' | 'Decision ready';
  opened: string;
  evidence: string[];
}

const adminNavigation: { id: AdminView; label: string; icon: LucideIcon; count?: number }[] = [
  { id: 'command', label: 'Command Center', icon: LayoutDashboard },
  { id: 'conversations', label: 'Conversations', icon: MessagesSquare, count: 12 },
  { id: 'tickets', label: 'Tickets', icon: TicketCheck, count: 38 },
  { id: 'incidents', label: 'Incidents', icon: Siren, count: 3 },
  { id: 'disputes', label: 'Disputes', icon: ShieldAlert, count: 9 },
  { id: 'on-call', label: 'On-call', icon: BellRing },
];

const initialConversations: ConversationRecord[] = [
  {
    id: 'CON-2026-00125',
    customer: 'Aina Rahman',
    email: 'aina.rahman@example.com',
    role: 'Commuter',
    subject: 'Cannot leave SS15 parking',
    preview: 'The exit barrier is not responding and there are cars waiting behind me.',
    channel: 'In-app Live Chat',
    wait: '1m 42s',
    priority: 'Urgent',
    booking: 'BKG-2026-1182',
    parking: 'SS15 Courtyard / Bay 12',
    messages: [
      { sender: 'system', text: 'Customer identity, active booking, vehicle, payment, and gate status attached.', time: '14:22' },
      { sender: 'customer', text: 'The exit barrier is not responding and there are cars waiting behind me.', time: '14:23' },
      { sender: 'admin', text: 'I can see your booking is valid. I am checking the exit gate connection now.', time: '14:24' },
      { sender: 'customer', text: 'I am still at the barrier. There is no safety issue yet.', time: '14:25' },
    ],
  },
  {
    id: 'CON-2026-00124',
    customer: 'Marcus Lim',
    email: 'marcus.lim@example.com',
    role: 'Owner',
    subject: 'Payout amount explanation',
    preview: 'Can you explain why this week payout is lower than the booking total?',
    channel: 'Web Live Chat',
    wait: '3m 08s',
    priority: 'Standard',
    booking: 'Not linked',
    parking: 'Taman Paramount Residence',
    messages: [
      { sender: 'system', text: 'Owner profile, payout summary, and recent cases attached.', time: '14:17' },
      { sender: 'customer', text: 'Can you explain why this week payout is lower than the booking total?', time: '14:18' },
    ],
  },
  {
    id: 'CON-2026-00123',
    customer: 'Nur Syafiqah',
    email: 'nur.syafiqah@example.com',
    role: 'Commuter',
    subject: 'Booking at wrong location',
    preview: 'I selected the wrong station and need help changing the booking.',
    channel: 'In-app Live Chat',
    wait: '5m 21s',
    priority: 'Standard',
    booking: 'BKG-2026-1179',
    parking: 'Kelana Jaya Station',
    messages: [
      { sender: 'system', text: 'Customer profile and booking BKG-2026-1179 attached.', time: '14:12' },
      { sender: 'customer', text: 'I selected the wrong station and need help changing the booking.', time: '14:13' },
    ],
  },
];

const initialIncidents: IncidentRecord[] = [
  { id: 'INC-2026-00047', priority: 'P0', title: 'Customers unable to exit', location: 'SS15 Courtyard', status: 'Unacknowledged', affected: 4, opened: '2 minutes ago', owner: 'Unassigned', source: 'Quick Help correlation' },
  { id: 'INC-2026-00046', priority: 'P1', title: 'Entry bollard offline', location: 'Main Place Residence', status: 'Acknowledged', affected: 2, opened: '18 minutes ago', owner: 'Hakim / Operations', source: 'IoT monitoring' },
  { id: 'INC-2026-00044', priority: 'P2', title: 'Payment verification delays', location: 'Multiple locations', status: 'Monitoring', affected: 7, opened: '1 hour ago', owner: 'Mei Ling / Payments', source: 'Ticket correlation' },
];

const initialDisputes: DisputeRecord[] = [
  { id: 'DSP-2026-00018', title: 'Duplicate card charge', customer: 'Farhan Daniel', amount: 'RM 50.00', type: 'Payment duplication', status: 'Evidence review', opened: '26 minutes ago', evidence: ['Gateway authorization x2', 'Wallet credit x1', 'Customer bank statement', 'Device session log'] },
  { id: 'DSP-2026-00017', title: 'Owner payout amount challenged', customer: 'Marcus Lim', amount: 'RM 284.20', type: 'Owner payout', status: 'Finance review', opened: '3 hours ago', evidence: ['Payout statement', 'Booking ledger', 'Commission configuration'] },
  { id: 'DSP-2026-00016', title: 'Unrecognized parking charge', customer: 'Janice Wong', amount: 'RM 12.00', type: 'Transaction security', status: 'Decision ready', opened: 'Yesterday', evidence: ['Payment fingerprint', 'Account sign-in log', 'Parking access event'] },
];

const priorityStyle = {
  P0: 'border-rose-200 bg-rose-50 text-rose-700',
  P1: 'border-amber-200 bg-amber-50 text-amber-700',
  P2: 'border-blue-200 bg-blue-50 text-blue-700',
};

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-semibold uppercase text-blue-600">{eyebrow}</p><h2 className="mt-1 text-2xl font-bold text-slate-950">{title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p></div>{action}</div>;
}

function MetricCard({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tone)}><Icon className="h-4.5 w-4.5" /></span><ArrowRight className="h-4 w-4 text-slate-300" /></div><p className="mt-4 text-2xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs font-semibold text-slate-700">{label}</p><p className="mt-1 text-[10px] text-slate-400">{detail}</p></div>;
}

export default function AdminSupportDashboard({ viewer, ticketWorkspace }: AdminSupportDashboardProps) {
  const [activeView, setActiveView] = useState<AdminView>('command');
  const [selectedConversationId, setSelectedConversationId] = useState(initialConversations[0].id);
  const [conversationSearch, setConversationSearch] = useState('');
  const [reply, setReply] = useState('');
  const [conversationNotes, setConversationNotes] = useState<Record<string, ConversationRecord['messages']>>({});
  const [incidents, setIncidents] = useState(initialIncidents);
  const [selectedIncidentId, setSelectedIncidentId] = useState(initialIncidents[0].id);
  const [disputes, setDisputes] = useState(initialDisputes);
  const [selectedDisputeId, setSelectedDisputeId] = useState(initialDisputes[0].id);
  const [notice, setNotice] = useState<string | null>(null);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('Parking access');
  const [ticketPriority, setTicketPriority] = useState('High');
  const [ticketTeam, setTicketTeam] = useState('Parking Operations');
  const [ticketSummary, setTicketSummary] = useState('');
  const [ticketCreating, setTicketCreating] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const visibleConversations = useMemo(() => {
    const normalized = conversationSearch.trim().toLowerCase();
    if (!normalized) return initialConversations;
    return initialConversations.filter((conversation) => [conversation.id, conversation.customer, conversation.subject].some((value) => value.toLowerCase().includes(normalized)));
  }, [conversationSearch]);

  const selectedConversation = initialConversations.find((item) => item.id === selectedConversationId) ?? initialConversations[0];
  const selectedIncident = incidents.find((item) => item.id === selectedIncidentId) ?? incidents[0];
  const selectedDispute = disputes.find((item) => item.id === selectedDisputeId) ?? disputes[0];
  const selectedMessages = [...selectedConversation.messages, ...(conversationNotes[selectedConversation.id] ?? [])];

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3200);
  };

  const openTicketFromConversation = () => {
    setTicketSubject(selectedConversation.subject);
    setTicketCategory(selectedConversation.priority === 'Urgent' ? 'Parking access' : 'General support');
    setTicketPriority(selectedConversation.priority === 'Urgent' ? 'High' : 'Normal');
    setTicketTeam(selectedConversation.priority === 'Urgent' ? 'Parking Operations' : 'Customer Support');
    setTicketSummary(`Customer contacted support through ${selectedConversation.channel}. Current issue: ${selectedConversation.preview}`);
    setTicketError(null);
    setCreateTicketOpen(true);
  };

  const createConversationTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (!ticketSubject.trim() || !ticketSummary.trim()) return;
    setTicketCreating(true);
    setTicketError(null);
    try {
      const ticket = await createAdminSupportTicket(viewer, {
        customerName: selectedConversation.customer,
        customerEmail: selectedConversation.email,
        customerRole: selectedConversation.role,
        subject: ticketSubject,
        message: [
          `Created from conversation ${selectedConversation.id}.`,
          `Category: ${ticketCategory}. Priority: ${ticketPriority}. Assigned team: ${ticketTeam}.`,
          `Booking: ${selectedConversation.booking}. Parking: ${selectedConversation.parking}.`,
          '',
          ticketSummary,
        ].join('\n'),
        files: [],
      });
      setCreateTicketOpen(false);
      showNotice(`${ticket.ticketReference} created from ${selectedConversation.id}.`);
      setActiveView('tickets');
    } catch (error) {
      setTicketError(error instanceof Error ? error.message : 'Unable to create this ticket.');
    } finally {
      setTicketCreating(false);
    }
  };

  const sendReply = (event: FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) return;
    const nextMessage = { sender: 'admin' as const, text: reply.trim(), time: 'Now' };
    setConversationNotes((current) => ({ ...current, [selectedConversation.id]: [...(current[selectedConversation.id] ?? []), nextMessage] }));
    setReply('');
  };

  const acknowledgeIncident = () => {
    setIncidents((current) => current.map((incident) => incident.id === selectedIncident.id ? { ...incident, status: 'Acknowledged', owner: `${viewer.name} / Support` } : incident));
    showNotice(`${selectedIncident.id} acknowledged. The on-call escalation timer is paused.`);
  };

  const decideDispute = (decision: string) => {
    setDisputes((current) => current.map((dispute) => dispute.id === selectedDispute.id ? { ...dispute, status: 'Decision ready' } : dispute));
    showNotice(`${decision} recorded for ${selectedDispute.id}. Customer communication remains in the linked ticket.`);
  };

  const renderCommandCenter = () => (
    <div className="space-y-6">
      <PageTitle eyebrow="Support operations" title="Command Center" description="Coordinate conversations, customer tickets, operational recovery, financial investigations, and the current on-call response." action={<div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><CircleDot className="h-3.5 w-3.5" />All support channels online</div>} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={MessagesSquare} label="Live conversations" value="12" detail="4 waiting more than 2 minutes" tone="bg-cyan-50 text-cyan-700" />
        <MetricCard icon={TicketCheck} label="Open tickets" value="38" detail="87% within first-response SLA" tone="bg-blue-50 text-blue-700" />
        <MetricCard icon={Siren} label="Active incidents" value="3" detail="1 P0 needs acknowledgement" tone="bg-rose-50 text-rose-700" />
        <MetricCard icon={ShieldAlert} label="Open disputes" value="9" detail="2 decisions due today" tone="bg-amber-50 text-amber-700" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="flex flex-col gap-4 bg-rose-50/80 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white"><Siren className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-rose-600 px-2 py-1 text-[9px] font-bold text-white">P0</span><span className="font-mono text-[10px] font-semibold text-rose-700">INC-2026-00047</span></div><h3 className="mt-2 text-base font-bold text-slate-950">Four customers unable to exit SS15 Courtyard</h3><p className="mt-1 text-xs leading-5 text-slate-600">Correlated from Quick Help submissions and gate telemetry. Primary on-call has 34 seconds left to acknowledge.</p></div></div><button type="button" onClick={() => { setSelectedIncidentId('INC-2026-00047'); setActiveView('incidents'); }} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700">Open incident <ArrowRight className="h-4 w-4" /></button></div>
          <div className="border-t border-rose-100 p-5 lg:border-l lg:border-t-0"><p className="text-[10px] font-semibold uppercase text-slate-400">On-call escalation</p><div className="mt-3 space-y-2.5 text-xs"><div className="flex items-center justify-between"><span className="text-slate-600">Primary notified</span><span className="font-semibold text-emerald-700">Sent</span></div><div className="flex items-center justify-between"><span className="text-slate-600">Backup notification</span><span className="font-semibold text-amber-700">In 34 sec</span></div><div className="flex items-center justify-between"><span className="text-slate-600">Supervisor</span><span className="font-semibold text-slate-500">In 3m 34s</span></div></div></div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div><h3 className="text-sm font-bold text-slate-900">Queues needing attention</h3><p className="mt-0.5 text-[10px] text-slate-500">Ordered by customer impact and SLA risk.</p></div><button type="button" onClick={() => setActiveView('tickets')} className="text-[10px] font-semibold text-blue-600">Open all tickets</button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-slate-100 text-[9px] font-semibold uppercase text-slate-400"><th className="px-4 py-3">Queue</th><th className="px-3 py-3">Waiting</th><th className="px-3 py-3">At risk</th><th className="px-3 py-3">Owner</th><th className="px-4 py-3 text-right">Next action</th></tr></thead><tbody className="divide-y divide-slate-100 text-xs">{[
            { queue: 'Parking access', icon: Radio, waiting: '8', risk: '3', owner: 'Parking Operations', action: 'Assign P1 cases', tone: 'text-rose-700' },
            { queue: 'Payments and refunds', icon: CreditCard, waiting: '11', risk: '2', owner: 'Payments', action: 'Review exceptions', tone: 'text-amber-700' },
            { queue: 'Owner support', icon: Users, waiting: '7', risk: '1', owner: 'Owner Support', action: 'Balance workload', tone: 'text-blue-700' },
            { queue: 'General support', icon: Headphones, waiting: '12', risk: '0', owner: 'Customer Support', action: 'Continue queue', tone: 'text-emerald-700' },
          ].map((item) => <tr key={item.queue}><td className="px-4 py-3"><span className="flex items-center gap-2 font-semibold text-slate-800"><item.icon className={cn('h-4 w-4', item.tone)} />{item.queue}</span></td><td className="px-3 py-3 font-semibold text-slate-700">{item.waiting}</td><td className="px-3 py-3"><span className={cn('font-semibold', Number(item.risk) > 0 ? 'text-rose-700' : 'text-emerald-700')}>{item.risk}</span></td><td className="px-3 py-3 text-slate-500">{item.owner}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => setActiveView(item.queue === 'Parking access' ? 'incidents' : 'tickets')} className="text-[10px] font-semibold text-blue-600">{item.action}</button></td></tr>)}</tbody></table></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Team coverage</h3><p className="mt-0.5 text-[10px] text-slate-500">Current service-hour staffing.</p></div><Users className="h-4 w-4 text-slate-400" /></div><div className="mt-4 space-y-4">{[
          { team: 'Customer Support', agents: '6 / 7 online', load: 72, color: 'bg-blue-600' },
          { team: 'Parking Operations', agents: '3 / 4 online', load: 86, color: 'bg-rose-600' },
          { team: 'Payments', agents: '2 / 3 online', load: 64, color: 'bg-amber-500' },
          { team: 'Trust & Safety', agents: '2 / 2 online', load: 48, color: 'bg-emerald-600' },
        ].map((team) => <div key={team.team}><div className="flex items-center justify-between gap-2 text-[10px]"><span className="font-semibold text-slate-700">{team.team}</span><span className="text-slate-400">{team.agents}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><span className={cn('block h-full rounded-full', team.color)} style={{ width: `${team.load}%` }} /></div></div>)}</div><button type="button" onClick={() => setActiveView('on-call')} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"><BellRing className="h-4 w-4" />View on-call roster</button></section>
      </div>
    </div>
  );

  const renderConversations = () => (
    <div className="space-y-5">
      <PageTitle eyebrow="Live support" title="Conversations" description="Answer non-standard questions, guide customers into a known workflow, or create a custom ticket without losing the chat history." />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid lg:min-h-[680px] lg:grid-cols-[330px_minmax(0,1fr)_280px]">
        <div className="border-b border-slate-200 lg:border-b-0 lg:border-r"><div className="border-b border-slate-100 p-3"><label className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input type="search" value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Search conversations" className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs" /></label><div className="mt-2 flex items-center justify-between text-[10px]"><span className="font-semibold text-slate-500">12 active</span><span className="text-rose-600">4 waiting over 2m</span></div></div><div className="max-h-[310px] overflow-y-auto p-2 lg:max-h-[610px]">{visibleConversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => setSelectedConversationId(conversation.id)} className={cn('mb-1 w-full rounded-xl border p-3 text-left transition', selectedConversation.id === conversation.id ? 'border-blue-200 bg-blue-50' : 'border-transparent hover:bg-slate-50')}><div className="flex items-center justify-between gap-2"><span className="font-mono text-[9px] font-semibold text-slate-400">{conversation.id}</span><span className={cn('rounded-full px-2 py-0.5 text-[9px] font-semibold', conversation.priority === 'Urgent' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500')}>{conversation.wait}</span></div><p className="mt-2 truncate text-xs font-bold text-slate-800">{conversation.customer}</p><p className="mt-1 truncate text-[10px] font-medium text-slate-600">{conversation.subject}</p><p className="mt-1 truncate text-[10px] text-slate-400">{conversation.preview}</p></button>)}</div></div>

        <div className="flex min-h-[570px] flex-col"><header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-slate-900">{selectedConversation.customer}</p><span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">{selectedConversation.role}</span></div><p className="mt-1 text-[10px] text-slate-500">{selectedConversation.subject} / {selectedConversation.channel}</p></div><button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500" aria-label="More conversation actions"><MoreHorizontal className="h-4 w-4" /></button></header>
          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4">{selectedMessages.map((message, index) => message.sender === 'system' ? <div key={`${message.time}-${index}`} className="flex justify-center"><span className="max-w-[90%] rounded-full bg-slate-200/70 px-3 py-1 text-center text-[9px] text-slate-500">{message.text}</span></div> : <div key={`${message.time}-${index}`} className={cn('flex', message.sender === 'admin' ? 'justify-end' : 'justify-start')}><div className="max-w-[80%]"><p className={cn('mb-1 px-1 text-[9px] font-semibold text-slate-400', message.sender === 'admin' && 'text-right')}>{message.sender === 'admin' ? viewer.name : selectedConversation.customer} / {message.time}</p><div className={cn('rounded-2xl px-3.5 py-2.5 text-xs leading-5 shadow-sm', message.sender === 'admin' ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700')}>{message.text}</div></div></div>)}</div>
          <form onSubmit={sendReply} className="border-t border-slate-200 p-3"><div className="flex items-end gap-2"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={1} placeholder="Reply to customer..." className="min-h-11 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-3 text-xs" /><button type="submit" disabled={!reply.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-40" aria-label="Send reply"><Send className="h-4 w-4" /></button></div></form>
        </div>

        <aside className="border-t border-slate-200 bg-slate-50 p-4 lg:border-l lg:border-t-0"><h3 className="text-xs font-bold text-slate-800">Customer context</h3><div className="mt-3 space-y-2">{[
          { label: 'Email', value: selectedConversation.email },
          { label: 'Booking', value: selectedConversation.booking },
          { label: 'Parking', value: selectedConversation.parking },
          { label: 'Recent tickets', value: selectedConversation.role === 'Owner' ? '2 closed / 1 open' : '1 closed' },
        ].map((item) => <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-2.5"><p className="text-[9px] font-medium text-slate-400">{item.label}</p><p className="mt-1 break-words text-[10px] font-semibold text-slate-700">{item.value}</p></div>)}</div><h3 className="mt-5 text-xs font-bold text-slate-800">Conversation actions</h3><div className="mt-3 space-y-2"><button type="button" onClick={() => showNotice('Booking Problem workflow sent to the customer.')} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-[10px] font-semibold text-slate-700"><Workflow className="h-3.5 w-3.5 text-blue-600" />Send preset workflow</button><button type="button" onClick={openTicketFromConversation} className="flex w-full items-center gap-2 rounded-lg bg-blue-600 px-3 text-left text-[10px] font-semibold text-white"><TicketCheck className="h-3.5 w-3.5" />Create custom ticket</button><button type="button" onClick={() => showNotice('Existing ticket TKT-2026-00382 linked to this conversation.')} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-[10px] font-semibold text-slate-700"><Link2 className="h-3.5 w-3.5 text-slate-500" />Link existing ticket</button><button type="button" onClick={() => { showNotice(`${selectedConversation.id} escalated to a P1 incident.`); setActiveView('incidents'); }} className="flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-left text-[10px] font-semibold text-amber-800"><Siren className="h-3.5 w-3.5" />Escalate to incident</button><button type="button" onClick={() => { showNotice(`${selectedConversation.id} opened as a dispute investigation.`); setActiveView('disputes'); }} className="flex w-full items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-left text-[10px] font-semibold text-rose-800"><ShieldAlert className="h-3.5 w-3.5" />Open dispute</button></div></aside>
      </section>
    </div>
  );

  const renderIncidents = () => (
    <div className="space-y-5"><PageTitle eyebrow="Operational recovery" title="Incidents" description="Restore parking operations separately from customer communication. Each affected customer remains connected through a support ticket." />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid lg:min-h-[650px] lg:grid-cols-[340px_minmax(0,1fr)]"><div className="border-b border-slate-200 p-2 lg:border-b-0 lg:border-r">{incidents.map((incident) => <button key={incident.id} type="button" onClick={() => setSelectedIncidentId(incident.id)} className={cn('mb-1 w-full rounded-xl border p-3 text-left', selectedIncident.id === incident.id ? 'border-blue-200 bg-blue-50' : 'border-transparent hover:bg-slate-50')}><div className="flex items-center justify-between gap-2"><span className={cn('rounded-md border px-2 py-0.5 text-[9px] font-bold', priorityStyle[incident.priority])}>{incident.priority}</span><span className="text-[9px] text-slate-400">{incident.opened}</span></div><p className="mt-2 text-xs font-bold text-slate-800">{incident.title}</p><p className="mt-1 text-[10px] text-slate-500">{incident.location} / {incident.affected} affected</p><div className="mt-2 flex items-center justify-between gap-2"><span className="text-[9px] font-semibold text-slate-400">{incident.id}</span><span className={cn('text-[9px] font-semibold', incident.status === 'Unacknowledged' ? 'text-rose-700' : incident.status === 'Acknowledged' ? 'text-blue-700' : 'text-emerald-700')}>{incident.status}</span></div></button>)}</div>
        <div className="p-4 sm:p-5"><div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><span className={cn('rounded-md border px-2 py-1 text-[9px] font-bold', priorityStyle[selectedIncident.priority])}>{selectedIncident.priority}</span><span className="font-mono text-[10px] font-semibold text-slate-400">{selectedIncident.id}</span></div><h3 className="mt-2 text-lg font-bold text-slate-950">{selectedIncident.title}</h3><p className="mt-1 text-xs text-slate-500">{selectedIncident.location} / Opened {selectedIncident.opened} / Source: {selectedIncident.source}</p></div>{selectedIncident.status === 'Unacknowledged' ? <button type="button" onClick={acknowledgeIncident} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white"><UserCheck className="h-4 w-4" />Acknowledge incident</button> : <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{selectedIncident.status}</span>}</div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2"><div><h4 className="text-xs font-bold text-slate-800">Operational context</h4><div className="mt-3 grid grid-cols-2 gap-2">{[
            { label: 'Affected customers', value: String(selectedIncident.affected) }, { label: 'Linked tickets', value: String(selectedIncident.affected + 1) }, { label: 'Incident owner', value: selectedIncident.owner }, { label: 'Current gate state', value: selectedIncident.priority === 'P0' ? 'Offline' : 'Degraded' },
          ].map((item) => <div key={item.label} className="rounded-xl border border-slate-200 p-3"><p className="text-[9px] text-slate-400">{item.label}</p><p className="mt-1 text-xs font-semibold text-slate-800">{item.value}</p></div>)}</div><h4 className="mt-5 text-xs font-bold text-slate-800">Response actions</h4><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => showNotice('Remote gate diagnostic requested.')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-[10px] font-semibold text-slate-700"><Radio className="h-3.5 w-3.5" />Run diagnostic</button><button type="button" onClick={() => showNotice('Backup on-call notified by push, SMS, and phone.')} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-[10px] font-semibold text-amber-800"><BellRing className="h-3.5 w-3.5" />Notify backup</button><button type="button" onClick={() => showNotice('Customer update sent to all linked tickets.')} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-[10px] font-semibold text-blue-800"><Send className="h-3.5 w-3.5" />Update customers</button></div></div>
            <div><h4 className="text-xs font-bold text-slate-800">On-call escalation timeline</h4><div className="mt-3 space-y-0">{[
              { time: '14:22:10', title: 'Incident created', detail: 'Four correlated access workflows crossed the P0 threshold.', state: 'done' },
              { time: '14:22:12', title: 'Primary on-call notified', detail: 'Push, SMS, phone, email, and internal message sent.', state: 'done' },
              { time: '+2 minutes', title: 'Notify backup on-call', detail: 'Runs automatically if no acknowledgement is recorded.', state: selectedIncident.status === 'Unacknowledged' ? 'active' : 'paused' },
              { time: '+5 minutes', title: 'Notify supervisor', detail: 'Continues to Operations Manager until acknowledged.', state: 'pending' },
            ].map((event, index) => <div key={event.title} className="relative flex gap-3 pb-5 last:pb-0"><div className="flex w-5 shrink-0 justify-center"><span className={cn('z-10 mt-1 h-2.5 w-2.5 rounded-full', event.state === 'done' ? 'bg-emerald-600' : event.state === 'active' ? 'bg-rose-600 ring-4 ring-rose-100' : 'bg-slate-300')} />{index < 3 && <span className="absolute bottom-0 left-[9px] top-3 w-px bg-slate-200" />}</div><div><p className="text-[9px] font-semibold text-slate-400">{event.time}</p><p className="mt-0.5 text-xs font-semibold text-slate-800">{event.title}</p><p className="mt-0.5 text-[10px] leading-4 text-slate-500">{event.detail}</p></div></div>)}</div></div>
          </div>
        </div></section>
    </div>
  );

  const renderDisputes = () => (
    <div className="space-y-5"><PageTitle eyebrow="Evidence and decisions" title="Disputes and investigations" description="Keep payment and trust decisions separate from the customer ticket while preserving evidence, approvals, and a complete audit trail." />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid lg:min-h-[640px] lg:grid-cols-[340px_minmax(0,1fr)]"><div className="border-b border-slate-200 p-2 lg:border-b-0 lg:border-r">{disputes.map((dispute) => <button key={dispute.id} type="button" onClick={() => setSelectedDisputeId(dispute.id)} className={cn('mb-1 w-full rounded-xl border p-3 text-left', selectedDispute.id === dispute.id ? 'border-blue-200 bg-blue-50' : 'border-transparent hover:bg-slate-50')}><div className="flex items-center justify-between gap-2"><span className="font-mono text-[9px] font-semibold text-slate-400">{dispute.id}</span><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">{dispute.status}</span></div><p className="mt-2 text-xs font-bold text-slate-800">{dispute.title}</p><p className="mt-1 text-[10px] text-slate-500">{dispute.customer} / {dispute.amount}</p><p className="mt-2 text-[9px] text-slate-400">Opened {dispute.opened}</p></button>)}</div>
        <div className="p-4 sm:p-5"><div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-mono text-[10px] font-semibold text-blue-600">{selectedDispute.id}</p><h3 className="mt-1 text-lg font-bold text-slate-950">{selectedDispute.title}</h3><p className="mt-1 text-xs text-slate-500">{selectedDispute.customer} / {selectedDispute.type} / {selectedDispute.amount}</p></div><span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{selectedDispute.status}</span></div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]"><div><h4 className="text-xs font-bold text-slate-800">Evidence package</h4><div className="mt-3 grid gap-2 sm:grid-cols-2">{selectedDispute.evidence.map((evidence) => <button key={evidence} type="button" onClick={() => showNotice(`${evidence} opened in the evidence viewer.`)} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><FileCheck2 className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-800">{evidence}</span><span className="mt-0.5 block text-[9px] text-emerald-700">Verified and timestamped</span></span><ChevronRight className="h-4 w-4 text-slate-300" /></button>)}</div><div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-blue-700" /><div><p className="text-xs font-bold text-blue-900">Investigation note</p><p className="mt-1 text-[10px] leading-5 text-blue-800">The payment gateway recorded two successful authorizations, while the ParkJom wallet ledger recorded one credit. The second authorization qualifies for reversal after finance approval.</p></div></div></div></div>
            <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h4 className="text-xs font-bold text-slate-800">Decision controls</h4><p className="mt-1 text-[10px] leading-4 text-slate-500">The decision is logged here. Customer-facing language is sent through the linked ticket.</p><div className="mt-4 space-y-2"><button type="button" onClick={() => decideDispute('Refund approved')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white"><CheckCircle2 className="h-4 w-4" />Approve reversal</button><button type="button" onClick={() => decideDispute('More evidence requested')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"><FileSearch className="h-4 w-4" />Request evidence</button><button type="button" onClick={() => decideDispute('Claim declined')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700"><X className="h-4 w-4" />Decline claim</button></div><div className="mt-4 border-t border-slate-200 pt-4"><p className="text-[9px] font-medium text-slate-400">Linked customer ticket</p><button type="button" onClick={() => setActiveView('tickets')} className="mt-1 flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left"><span><span className="block font-mono text-[10px] font-semibold text-blue-600">TKT-2026-00351</span><span className="block text-[9px] text-slate-500">Waiting for internal team</span></span><ChevronRight className="h-4 w-4 text-slate-300" /></button></div></aside>
          </div>
        </div></section>
    </div>
  );

  const renderOnCall = () => (
    <div className="space-y-5"><PageTitle eyebrow="24/7 response" title="On-call coverage" description="Emergency access support uses a real acknowledgement ladder across push, SMS, phone, email, and internal messaging." action={<button type="button" onClick={() => showNotice('On-call contact test sent to the primary and backup responders.')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600"><PhoneCall className="h-4 w-4" />Test contacts</button>} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"><section><h3 className="mb-3 text-sm font-bold text-slate-900">Current responders</h3><div className="grid gap-3 sm:grid-cols-2">{[
        { role: 'Primary parking operations', name: 'Hakim Zulkifli', status: 'On call now', contact: 'Push / SMS / Phone', tone: 'bg-emerald-50 text-emerald-700' },
        { role: 'Backup parking operations', name: 'Siti Noor', status: 'Available', contact: 'Push / SMS / Phone', tone: 'bg-blue-50 text-blue-700' },
        { role: 'Operations supervisor', name: 'Daniel Teoh', status: 'Escalation level 3', contact: 'Phone / Email / Teams', tone: 'bg-amber-50 text-amber-700' },
        { role: 'Payments on call', name: 'Mei Ling Tan', status: 'Available until 08:00', contact: 'Push / Phone / Teams', tone: 'bg-cyan-50 text-cyan-700' },
      ].map((person) => <div key={person.role} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600"><UserCheck className="h-5 w-5" /></span><span className={cn('rounded-full px-2 py-1 text-[9px] font-semibold', person.tone)}>{person.status}</span></div><p className="mt-4 text-xs font-medium text-slate-400">{person.role}</p><h4 className="mt-1 text-sm font-bold text-slate-900">{person.name}</h4><p className="mt-2 text-[10px] text-slate-500">{person.contact}</p><button type="button" onClick={() => showNotice(`${person.name} notified.`)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-[10px] font-semibold text-slate-600"><BellRing className="h-3.5 w-3.5" />Notify responder</button></div>)}</div></section>
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Escalation policy</h3><p className="mt-1 text-[10px] text-slate-500">P0 and P1 parking access incidents.</p></div><Activity className="h-4 w-4 text-blue-600" /></div><div className="mt-5 space-y-0">{[
          { time: 'Immediately', title: 'Notify primary on-call', detail: 'All configured channels fire together.', color: 'bg-blue-600' },
          { time: 'After 2 minutes', title: 'Notify backup responder', detail: 'Only if no acknowledgement exists.', color: 'bg-amber-500' },
          { time: 'After 5 minutes', title: 'Notify supervisor', detail: 'Supervisor can reassign incident ownership.', color: 'bg-rose-500' },
          { time: 'Continue', title: 'Operations Manager', detail: 'Escalation repeats until acknowledged.', color: 'bg-slate-700' },
        ].map((step, index) => <div key={step.title} className="relative flex gap-3 pb-5 last:pb-0"><div className="flex w-6 shrink-0 justify-center"><span className={cn('z-10 mt-1 h-3 w-3 rounded-full ring-4 ring-white', step.color)} />{index < 3 && <span className="absolute bottom-0 left-[11px] top-3 w-px bg-slate-200" />}</div><div><p className="text-[9px] font-semibold text-blue-600">{step.time}</p><p className="mt-0.5 text-xs font-bold text-slate-800">{step.title}</p><p className="mt-0.5 text-[10px] leading-4 text-slate-500">{step.detail}</p></div></div>)}</div><div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />Coverage healthy</div><p className="mt-1 text-[10px] leading-4 text-emerald-700">All P0/P1 roles have a primary, backup, and supervisor assigned for the next 24 hours.</p></div></aside>
      </div>
    </div>
  );

  return (
    <div className="space-y-5" data-support-mode="admin">
      <section className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="flex items-center gap-3 px-1"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><Headphones className="h-5 w-5" /></span><div><p className="text-sm font-bold text-slate-950">Support Operations</p><p className="text-[10px] text-slate-500">Conversations, cases, recovery, and investigations</p></div></div><nav className="flex min-w-0 gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" aria-label="Support operation sections">{adminNavigation.map((item) => { const Icon = item.icon; const active = activeView === item.id; return <button key={item.id} type="button" onClick={() => setActiveView(item.id)} aria-current={active ? 'page' : undefined} className={cn('inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition', active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800')}><Icon className="h-3.5 w-3.5" />{item.label}{item.count !== undefined && <span className={cn('rounded-full px-1.5 py-0.5 text-[8px]', active ? 'bg-blue-50 text-blue-700' : 'bg-white text-slate-500')}>{item.count}</span>}</button>; })}</nav></div></section>

      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</div>}

      {activeView === 'command' && renderCommandCenter()}
      {activeView === 'conversations' && renderConversations()}
      {activeView === 'tickets' && ticketWorkspace}
      {activeView === 'incidents' && renderIncidents()}
      {activeView === 'disputes' && renderDisputes()}
      {activeView === 'on-call' && renderOnCall()}

      {createTicketOpen && <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="conversation-ticket-title"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl"><div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4"><div><p className="text-[10px] font-semibold uppercase text-blue-600">{selectedConversation.id}</p><h3 id="conversation-ticket-title" className="mt-1 text-base font-bold text-slate-900">Create ticket from conversation</h3><p className="mt-0.5 text-[10px] text-slate-500">Customer, transcript, booking, parking, and channel are already attached.</p></div><button type="button" onClick={() => setCreateTicketOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-4 w-4" /></button></div><form onSubmit={createConversationTicket} className="space-y-4 p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 sm:col-span-2"><span className="text-[10px] font-semibold uppercase text-slate-500">Subject</span><input value={ticketSubject} onChange={(event) => setTicketSubject(event.target.value)} required className="w-full rounded-xl border border-slate-200 px-3 text-xs" /></label><label className="space-y-1"><span className="text-[10px] font-semibold uppercase text-slate-500">Category</span><select value={ticketCategory} onChange={(event) => setTicketCategory(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"><option>Parking access</option><option>Booking</option><option>Payment</option><option>Account</option><option>Owner support</option><option>General support</option></select></label><label className="space-y-1"><span className="text-[10px] font-semibold uppercase text-slate-500">Priority</span><select value={ticketPriority} onChange={(event) => setTicketPriority(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"><option>Urgent</option><option>High</option><option>Normal</option><option>Low</option></select></label><label className="space-y-1 sm:col-span-2"><span className="text-[10px] font-semibold uppercase text-slate-500">Assigned team</span><select value={ticketTeam} onChange={(event) => setTicketTeam(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"><option>Parking Operations</option><option>Customer Support</option><option>Payments</option><option>Owner Support</option><option>Trust & Safety</option></select></label><label className="space-y-1 sm:col-span-2"><span className="text-[10px] font-semibold uppercase text-slate-500">Internal summary</span><textarea value={ticketSummary} onChange={(event) => setTicketSummary(event.target.value)} rows={5} required className="w-full resize-none rounded-xl border border-slate-200 p-3 text-xs leading-5" /></label></div><div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2"><p className="text-[10px] text-slate-500"><span className="font-semibold text-slate-700">Customer:</span> {selectedConversation.customer}</p><p className="text-[10px] text-slate-500"><span className="font-semibold text-slate-700">Booking:</span> {selectedConversation.booking}</p><p className="text-[10px] text-slate-500"><span className="font-semibold text-slate-700">Parking:</span> {selectedConversation.parking}</p><p className="text-[10px] text-slate-500"><span className="font-semibold text-slate-700">Source:</span> Live Chat</p></div>{ticketError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{ticketError}</div>}<div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setCreateTicketOpen(false)} className="rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" disabled={ticketCreating} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white disabled:opacity-60">{ticketCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <TicketCheck className="h-4 w-4" />}{ticketCreating ? 'Creating...' : 'Create custom ticket'}</button></div></form></div></div>}
    </div>
  );
}
