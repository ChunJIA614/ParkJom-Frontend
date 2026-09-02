import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  Clock3,
  CreditCard,
  Download,
  ExternalLink,
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
  Plus,
  Radio,
  ReceiptText,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TicketCheck,
  User,
  UserCheck,
  Users,
  Wifi,
  Workflow,
  Wrench,
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
  status: 'Evidence Review' | 'Finance Review' | 'Decision Ready';
  opened: string;
  evidence: string[];
}

const adminNavigation: { id: AdminView; label: string; icon: LucideIcon; count?: number }[] = [
  { id: 'command', label: 'Command Center', icon: LayoutDashboard },
  { id: 'conversations', label: 'Live Queue', icon: MessagesSquare, count: 12 },
  { id: 'tickets', label: 'Tickets', icon: TicketCheck, count: 38 },
  { id: 'incidents', label: 'Incidents', icon: Siren, count: 3 },
  { id: 'disputes', label: 'Disputes', icon: ShieldAlert, count: 9 },
  { id: 'on-call', label: 'On-Call', icon: BellRing },
];

const initialConversations: ConversationRecord[] = [
  {
    id: 'CON-2026-00125',
    customer: 'Aina Rahman',
    email: 'aina.rahman@example.com',
    role: 'Commuter',
    subject: 'Cannot leave SS15 parking barrier',
    preview: 'The exit barrier is not responding and there are cars waiting behind me.',
    channel: 'In-app Live Chat',
    wait: '1m 42s',
    priority: 'Urgent',
    booking: 'BKG-2026-1182',
    parking: 'SS15 Courtyard / Bay 12',
    messages: [
      { sender: 'system', text: 'Telemetry verified: Active booking BKG-2026-1182, Vehicle VBY 2188, Gate telemetry: Offline.', time: '14:22' },
      { sender: 'customer', text: 'The exit barrier is not responding and there are cars waiting behind me.', time: '14:23' },
      { sender: 'admin', text: 'I can see your booking is valid. I am pinging the remote bollard controller now.', time: '14:24' },
      { sender: 'customer', text: 'I am still at the barrier. Please override it.', time: '14:25' },
    ],
  },
  {
    id: 'CON-2026-00124',
    customer: 'Marcus Lim',
    email: 'marcus.lim@example.com',
    role: 'Owner',
    subject: 'Weekly payout reconciliation query',
    preview: 'Can you explain why this week\'s payout statement is lower than the gross booking total?',
    channel: 'Web Live Chat',
    wait: '3m 08s',
    priority: 'Standard',
    booking: 'Not linked',
    parking: 'Taman Paramount Residence',
    messages: [
      { sender: 'system', text: 'Owner account profile, last 4 payout statements, and commission ledger attached.', time: '14:17' },
      { sender: 'customer', text: 'Can you explain why this week payout is lower than the booking total?', time: '14:18' },
    ],
  },
  {
    id: 'CON-2026-00123',
    customer: 'Nur Syafiqah',
    email: 'nur.syafiqah@example.com',
    role: 'Commuter',
    subject: 'Booking at wrong transit station',
    preview: 'I selected Kelana Jaya instead of Subang Jaya and need help changing the booking.',
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
  { id: 'INC-2026-00047', priority: 'P0', title: 'Customers unable to exit parking bay', location: 'SS15 Courtyard Bay 12', status: 'Unacknowledged', affected: 4, opened: '2 minutes ago', owner: 'Unassigned', source: 'Quick Triage Telemetry' },
  { id: 'INC-2026-00046', priority: 'P1', title: 'Entry bollard controller offline', location: 'Main Place Residence', status: 'Acknowledged', affected: 2, opened: '18 minutes ago', owner: 'Hakim / Operations', source: 'IoT Heartbeat Failure' },
  { id: 'INC-2026-00044', priority: 'P2', title: 'Payment verification delay queue', location: 'Subang Jaya Stations', status: 'Monitoring', affected: 7, opened: '1 hour ago', owner: 'Mei Ling / Payments', source: 'Gateway Latency Alert' },
];

const initialDisputes: DisputeRecord[] = [
  { id: 'DSP-2026-00018', title: 'Duplicate card authorization', customer: 'Farhan Daniel', amount: 'RM 50.00', type: 'Payment Duplication', status: 'Evidence Review', opened: '26 minutes ago', evidence: ['Gateway auth #1 (Stripe)', 'Gateway auth #2 (Stripe)', 'Wallet credit ledger x1', 'Customer statement upload'] },
  { id: 'DSP-2026-00017', title: 'Owner payout commission disputed', customer: 'Marcus Lim', amount: 'RM 284.20', type: 'Owner Settlement', status: 'Finance Review', opened: '3 hours ago', evidence: ['Weekly disbursement statement', 'Daily booking ledger', 'Platform commission configuration (15%)'] },
  { id: 'DSP-2026-00016', title: 'Unrecognised parking charge', customer: 'Janice Wong', amount: 'RM 12.00', type: 'Security Audit', status: 'Decision Ready', opened: 'Yesterday', evidence: ['Card token auth trace', 'Account login IP history', 'Bollard license plate scan'] },
];

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
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4.5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition hover:border-black/[0.12]">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#1D1D1F]">
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

  // Ticket creation modal state
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('Parking access');
  const [ticketPriority, setTicketPriority] = useState('High');
  const [ticketTeam, setTicketTeam] = useState('Parking Operations');
  const [ticketSummary, setTicketSummary] = useState('');
  const [ticketCreating, setTicketCreating] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const visibleConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return initialConversations;
    return initialConversations.filter((c) =>
      [c.id, c.customer, c.subject, c.email].some((v) => v.toLowerCase().includes(query))
    );
  }, [conversationSearch]);

  const selectedConversation = initialConversations.find((item) => item.id === selectedConversationId) ?? initialConversations[0];
  const selectedIncident = incidents.find((item) => item.id === selectedIncidentId) ?? incidents[0];
  const selectedDispute = disputes.find((item) => item.id === selectedDisputeId) ?? disputes[0];
  const selectedMessages = [...selectedConversation.messages, ...(conversationNotes[selectedConversation.id] ?? [])];

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3500);
  };

  const openTicketFromConversation = () => {
    setTicketSubject(selectedConversation.subject);
    setTicketCategory(selectedConversation.priority === 'Urgent' ? 'Parking access' : 'General support');
    setTicketPriority(selectedConversation.priority === 'Urgent' ? 'High' : 'Normal');
    setTicketTeam(selectedConversation.priority === 'Urgent' ? 'Parking Operations' : 'Customer Support');
    setTicketSummary(`Source: ${selectedConversation.channel} (${selectedConversation.id})\nCustomer: ${selectedConversation.customer} (${selectedConversation.email})\nBooking: ${selectedConversation.booking}\nParking: ${selectedConversation.parking}\n\nSummary of inquiry: ${selectedConversation.preview}`);
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
          `Created from live conversation: ${selectedConversation.id}`,
          `Category: ${ticketCategory} | Priority: ${ticketPriority} | Assigned Team: ${ticketTeam}`,
          `Booking: ${selectedConversation.booking} | Bay: ${selectedConversation.parking}`,
          '',
          ticketSummary,
        ].join('\n'),
        files: [],
      });
      setCreateTicketOpen(false);
      showNotice(`${ticket.ticketReference} created and assigned to ${ticketTeam}.`);
      setActiveView('tickets');
    } catch (err) {
      setTicketError(err instanceof Error ? err.message : 'Unable to create ticket.');
    } finally {
      setTicketCreating(false);
    }
  };

  const sendReply = (event: FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) return;
    const nextMessage = { sender: 'admin' as const, text: reply.trim(), time: 'Just now' };
    setConversationNotes((curr) => ({
      ...curr,
      [selectedConversation.id]: [...(curr[selectedConversation.id] ?? []), nextMessage],
    }));
    setReply('');
    showNotice(`Reply sent to ${selectedConversation.customer}.`);
  };

  const acknowledgeIncident = () => {
    setIncidents((curr) =>
      curr.map((inc) =>
        inc.id === selectedIncident.id ? { ...inc, status: 'Acknowledged', owner: `${viewer.name} / Ops` } : inc
      )
    );
    showNotice(`Incident ${selectedIncident.id} acknowledged.`);
  };

  const decideDispute = (decision: string) => {
    setDisputes((curr) =>
      curr.map((dsp) => (dsp.id === selectedDispute.id ? { ...dsp, status: 'Decision Ready' } : dsp))
    );
    showNotice(`${decision} recorded for ${selectedDispute.id}.`);
  };

  // ── Render Command Center ──
  const renderCommandCenter = () => (
    <div className="space-y-5">
      {/* Overview Top Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[#1D1D1F]">
            Support & Operations Command
          </h2>
          <p className="text-xs text-[#6E6E73]">
            Live inquiries, active tickets, and operational triage
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] shadow-xs">
          <CircleDot className="h-3 w-3 text-[#34C759]" />
          <span>All Channels Operational</span>
        </div>
      </div>

      {/* Metric Cards Grid - Uniform Clean Styling */}
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={MessagesSquare}
          label="Live Queue Conversations"
          value="12"
          detail="4 inquiries waiting > 2 mins"
          badge="Live Chat"
        />
        <MetricCard
          icon={TicketCheck}
          label="Open Tracked Tickets"
          value="38"
          detail="87% within response SLA"
          badge="38 Active"
        />
        <MetricCard
          icon={Siren}
          label="Active Site Incidents"
          value="3"
          detail="1 P0 incident pending"
          badge="1 Critical"
        />
        <MetricCard
          icon={ShieldAlert}
          label="Open Financial Disputes"
          value="9"
          detail="2 payout reviews due today"
          badge="Finance Desk"
        />
      </div>

      {/* Priority Incident Notification Card - Sleek Minimalist */}
      <section className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F5F5F7] text-rose-600">
              <Siren className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#F5F5F7] px-1.5 py-0.5 text-[9px] font-bold text-rose-700">P0 PRIORITY</span>
                <span className="font-mono text-xs font-semibold text-[#1D1D1F]">INC-2026-00047</span>
                <span className="text-[11px] text-[#6E6E73]">· SS15 Courtyard Bay 12</span>
              </div>
              <h3 className="mt-1 text-sm font-bold text-[#1D1D1F]">
                Four commuters unable to exit parking bay (Barrier Jam)
              </h3>
              <p className="mt-0.5 text-xs text-[#6E6E73]">
                Correlated from user Quick Triage telemetry and IoT gate heartbeat failure.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedIncidentId('INC-2026-00047');
                setActiveView('incidents');
              }}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#1D1D1F] px-4 text-xs font-semibold text-white shadow-xs hover:bg-black"
            >
              <span>Manage Incident</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Queue Health & Staffing Grid */}
      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
        {/* Department Workload Table */}
        <section className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3.5">
            <div>
              <h3 className="text-xs font-bold text-[#1D1D1F]">Department Queue Health</h3>
              <p className="text-[10px] text-[#6E6E73]">Prioritized by response urgency</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('tickets')}
              className="cursor-pointer text-xs font-semibold text-[#007AFF] hover:underline"
            >
              Open Queue
            </button>
          </div>

          {/* Mobile Responsive Card List (Fits 100% on mobile without scrolling) */}
          <div className="divide-y divide-black/[0.04] sm:hidden">
            {[
              { queue: 'Parking Access & Gates', icon: Radio, waiting: 8, risk: '3 Attention', owner: 'Parking Ops', link: 'incidents' as AdminView },
              { queue: 'Payments & Wallet', icon: CreditCard, waiting: 11, risk: '2 Attention', owner: 'Finance Team', link: 'disputes' as AdminView },
              { queue: 'Owner Payouts & Bays', icon: Users, waiting: 7, risk: 'Healthy', owner: 'Owner Desk', link: 'tickets' as AdminView },
              { queue: 'General Transit Help', icon: Headphones, waiting: 12, risk: 'Healthy', owner: 'CX Team', link: 'conversations' as AdminView },
            ].map((row) => {
              const RowIcon = row.icon;
              return (
                <div key={row.queue} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-bold text-xs text-[#1D1D1F]">
                      <RowIcon className="h-3.5 w-3.5 text-[#6E6E73]" />
                      <span>{row.queue}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveView(row.link)}
                      className="text-xs font-bold text-[#007AFF] hover:underline cursor-pointer"
                    >
                      View &rarr;
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#6E6E73] pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-[#F5F5F7] px-2 py-0.5 font-semibold text-[#1D1D1F]">
                        {row.waiting} waiting
                      </span>
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', row.risk === 'Healthy' ? 'bg-slate-100 text-[#6E6E73]' : 'bg-slate-100 text-[#1D1D1F] font-bold')}>
                        {row.risk}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#8E8E93]">{row.owner}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-black/[0.04] bg-[#FAFBFD] text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">
                  <th className="px-4 py-2.5">Queue</th>
                  <th className="px-3 py-2.5">Waiting</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Lead</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {[
                  { queue: 'Parking Access & Gates', icon: Radio, waiting: 8, risk: '3 Attention', owner: 'Parking Ops', link: 'incidents' as AdminView },
                  { queue: 'Payments & Wallet', icon: CreditCard, waiting: 11, risk: '2 Attention', owner: 'Finance Team', link: 'disputes' as AdminView },
                  { queue: 'Owner Payouts & Bays', icon: Users, waiting: 7, risk: 'Healthy', owner: 'Owner Desk', link: 'tickets' as AdminView },
                  { queue: 'General Transit Help', icon: Headphones, waiting: 12, risk: 'Healthy', owner: 'CX Team', link: 'conversations' as AdminView },
                ].map((row) => {
                  const RowIcon = row.icon;
                  return (
                    <tr key={row.queue} className="hover:bg-[#FAFBFD] transition">
                      <td className="px-4 py-3 font-semibold text-[#1D1D1F]">
                        <span className="flex items-center gap-2">
                          <RowIcon className="h-3.5 w-3.5 text-[#6E6E73]" />
                          <span>{row.queue}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[#1D1D1F]">{row.waiting}</td>
                      <td className="px-3 py-3">
                        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', row.risk === 'Healthy' ? 'bg-slate-100 text-[#6E6E73]' : 'bg-slate-100 text-[#1D1D1F] font-bold')}>
                          {row.risk}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[#6E6E73]">{row.owner}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setActiveView(row.link)}
                          className="cursor-pointer text-xs font-semibold text-[#007AFF] hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Coverage Roster */}
        <section className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-4.5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#1D1D1F]">Team Availability</h3>
                <p className="text-[10px] text-[#6E6E73]">Current active capacity</p>
              </div>
              <Users className="h-4 w-4 text-[#8E8E93]" />
            </div>

            <div className="mt-3.5 space-y-3">
              {[
                { name: 'Customer Experience', count: '6 / 7 Online', load: 72 },
                { name: 'Parking Operations', count: '3 / 4 Online', load: 86 },
                { name: 'Payments & Settlement', count: '2 / 3 Online', load: 64 },
                { name: 'Trust & Safety', count: '2 / 2 Online', load: 48 },
              ].map((team) => (
                <div key={team.name} className="text-xs">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-[#1D1D1F]">{team.name}</span>
                    <span className="text-[#6E6E73]">{team.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div className="h-full rounded-full bg-[#007AFF]" style={{ width: `${team.load}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveView('on-call')}
            className="mt-4 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] bg-[#F5F5F7] py-2 text-xs font-semibold text-[#1D1D1F] hover:bg-[#EBEBEF]"
          >
            <BellRing className="h-3.5 w-3.5 text-[#007AFF]" />
            <span>On-Call Shift Roster</span>
          </button>
        </section>
      </div>
    </div>
  );

  // ── Render Conversations ──
  const renderConversations = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#1D1D1F]">Live Inbound Queue</h2>
          <p className="text-xs text-[#6E6E73]">Live chat sessions, triage inquiries, and customer communication</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setTicketSubject('');
            setTicketSummary('');
            setCreateTicketOpen(true);
          }}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#007AFF] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0066D6]"
        >
          <Plus className="h-3.5 w-3.5" /> Open Ticket
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)] lg:grid lg:min-h-[640px] lg:grid-cols-[300px_1fr_260px]">
        {/* Left: Queue items */}
        <div className="border-b border-black/[0.06] lg:border-b-0 lg:border-r border-black/[0.06] flex flex-col bg-white">
          <div className="p-3 border-b border-black/[0.06]">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#8E8E93]" />
              <input
                type="search"
                value={conversationSearch}
                onChange={(e) => setConversationSearch(e.target.value)}
                placeholder="Search queue..."
                className="w-full rounded-lg border border-black/[0.08] bg-[#F5F5F7] pl-8 pr-3 py-1 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {visibleConversations.map((conv) => {
              const isSelected = selectedConversation.id === conv.id;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={cn(
                    'w-full cursor-pointer rounded-xl border p-2.5 text-left transition-all',
                    isSelected
                      ? 'border-[#007AFF]/40 bg-blue-50/40 shadow-xs text-[#1D1D1F]'
                      : 'border-transparent hover:bg-[#F5F5F7]'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] font-bold text-[#007AFF]">{conv.id}</span>
                    <span className="rounded bg-[#F5F5F7] px-1.5 py-0.2 text-[9px] font-medium text-[#6E6E73]">
                      {conv.wait}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#1D1D1F] truncate">{conv.customer}</p>
                  <p className="text-[11px] text-[#6E6E73] truncate">{conv.subject}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Live Transcript */}
        <div className="flex flex-col bg-[#FAFBFD] min-h-[460px]">
          <header className="flex items-center justify-between border-b border-black/[0.06] bg-white px-4 py-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-[#1D1D1F]">{selectedConversation.customer}</span>
                <span className="rounded bg-[#F5F5F7] px-1.5 py-0.2 text-[9px] font-semibold text-[#6E6E73]">
                  {selectedConversation.role}
                </span>
              </div>
              <p className="text-[11px] text-[#6E6E73] truncate">{selectedConversation.subject}</p>
            </div>
            <span className="rounded-full border border-black/[0.06] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#1D1D1F]">
              Live
            </span>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {selectedMessages.map((msg, i) => {
              if (msg.sender === 'system') {
                return (
                  <div key={i} className="my-1.5 flex justify-center">
                    <span className="inline-flex max-w-[90%] items-center gap-1.5 rounded-full border border-black/[0.04] bg-white px-3 py-1 text-center text-[10px] text-[#6E6E73] shadow-xs">
                      <CheckCircle2 className="h-3 w-3 text-[#007AFF] shrink-0" />
                      <span>{msg.text}</span>
                    </span>
                  </div>
                );
              }
              const isAdmin = msg.sender === 'admin';
              return (
                <div key={i} className={cn('flex', isAdmin ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[80%]', isAdmin && 'text-right')}>
                    <p className="mb-0.5 text-[9px] text-[#8E8E93]">
                      {isAdmin ? `${viewer.name} (Support Agent)` : selectedConversation.customer} · {msg.time}
                    </p>
                    <div
                      className={cn(
                        'rounded-2xl px-3.5 py-2 text-left text-xs leading-relaxed shadow-xs',
                        isAdmin ? 'rounded-br-sm bg-[#007AFF] text-white' : 'rounded-bl-sm border border-black/[0.06] bg-white text-[#1D1D1F]'
                      )}
                    >
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={sendReply} className="border-t border-black/[0.06] bg-white p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type response..."
                className="min-h-9 flex-1 rounded-xl border border-black/[0.08] bg-[#F5F5F7] px-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white"
              />
              <button
                type="submit"
                disabled={!reply.trim()}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#007AFF] text-white hover:bg-[#0066D6] disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>

        {/* Right: Context Sidebar */}
        <aside className="border-t border-black/[0.06] bg-[#FAFBFD] p-3.5 lg:border-t-0 lg:border-l space-y-3.5 text-xs">
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Context</h4>
            <div className="mt-2 space-y-1.5">
              <div className="rounded-lg border border-black/[0.04] bg-white p-2 text-[11px]">
                <p className="text-[9px] text-[#8E8E93]">Email</p>
                <p className="font-semibold text-[#1D1D1F] truncate">{selectedConversation.email}</p>
              </div>
              <div className="rounded-lg border border-black/[0.04] bg-white p-2 text-[11px]">
                <p className="text-[9px] text-[#8E8E93]">Booking</p>
                <p className="font-mono font-bold text-[#007AFF]">{selectedConversation.booking}</p>
              </div>
              <div className="rounded-lg border border-black/[0.04] bg-white p-2 text-[11px]">
                <p className="text-[9px] text-[#8E8E93]">Bay</p>
                <p className="font-semibold text-[#1D1D1F] truncate">{selectedConversation.parking}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Quick Actions</h4>
            <div className="mt-2 space-y-1.5">
              <button
                type="button"
                onClick={openTicketFromConversation}
                className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg bg-[#007AFF] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0066D6]"
              >
                <TicketCheck className="h-3.5 w-3.5" /> Create Ticket
              </button>
              <button
                type="button"
                onClick={() => showNotice('Remote diagnostic command dispatched.')}
                className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
              >
                <Radio className="h-3.5 w-3.5 text-[#007AFF]" /> Ping Telemetry
              </button>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );

  // ── Render Incidents ──
  const renderIncidents = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-[#1D1D1F]">Operational Incident Recovery</h2>
        <p className="text-xs text-[#6E6E73]">Manage site disruptions and broadcasts</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)] lg:grid lg:min-h-[580px] lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Left List */}
        <div className="border-b border-black/[0.06] lg:border-b-0 lg:border-r p-2.5 space-y-1.5">
          {incidents.map((inc) => {
            const isSelected = inc.id === selectedIncident.id;
            return (
              <button
                key={inc.id}
                type="button"
                onClick={() => setSelectedIncidentId(inc.id)}
                className={cn(
                  'w-full cursor-pointer rounded-xl border p-3 text-left transition-all',
                  isSelected
                    ? 'border-[#007AFF] bg-blue-50/40 shadow-xs'
                    : 'border-black/[0.04] bg-white hover:bg-[#F5F5F7]'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#F5F5F7] px-1.5 py-0.2 text-[9px] font-bold text-[#1D1D1F]">
                    {inc.priority}
                  </span>
                  <span className="text-[10px] text-[#8E8E93]">{inc.opened}</span>
                </div>
                <h4 className="mt-1.5 text-xs font-bold text-[#1D1D1F]">{inc.title}</h4>
                <p className="text-[11px] text-[#6E6E73]">{inc.location} · {inc.affected} affected</p>
              </button>
            );
          })}
        </div>

        {/* Right Details */}
        <div className="p-5 space-y-4">
          <div className="flex flex-col gap-3 border-b border-black/[0.06] pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="font-mono text-xs font-bold text-[#007AFF]">{selectedIncident.id}</span>
              <h3 className="mt-1 text-base font-bold text-[#1D1D1F]">{selectedIncident.title}</h3>
              <p className="text-xs text-[#6E6E73]">{selectedIncident.location} · Opened {selectedIncident.opened}</p>
            </div>

            {selectedIncident.status === 'Unacknowledged' ? (
              <button
                type="button"
                onClick={acknowledgeIncident}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#1D1D1F] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-black"
              >
                <UserCheck className="h-3.5 w-3.5" /> Acknowledge
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#34C759]">
                <CheckCircle2 className="h-4 w-4" /> {selectedIncident.status}
              </span>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2 text-xs">
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Live Telemetry</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-black/[0.04] bg-[#FAFBFD] p-2.5">
                  <p className="text-[9px] text-[#8E8E93]">Affected</p>
                  <p className="mt-0.5 font-bold text-[#1D1D1F]">{selectedIncident.affected} Parkers</p>
                </div>
                <div className="rounded-xl border border-black/[0.04] bg-[#FAFBFD] p-2.5">
                  <p className="text-[9px] text-[#8E8E93]">Assigned Lead</p>
                  <p className="mt-0.5 font-semibold text-[#1D1D1F] truncate">{selectedIncident.owner}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => showNotice('Remote barrier reset command sent.')}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3 py-1.5 font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
                >
                  <Radio className="h-3.5 w-3.5 text-[#007AFF]" /> Remote Reset
                </button>
                <button
                  type="button"
                  onClick={() => showNotice('Notification broadcasted.')}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.08] bg-[#F5F5F7] px-3 py-1.5 font-semibold text-[#1D1D1F] hover:bg-[#EBEBEF]"
                >
                  <Send className="h-3.5 w-3.5" /> Broadcast to Parkers
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-black/[0.04] bg-[#FAFBFD] p-3.5 space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Timeline</h4>
              <div className="space-y-2 text-[11px] text-[#6E6E73]">
                <p>1. Incident correlated from quick triage</p>
                <p>2. Primary responder paged via SMS</p>
                <p>3. Auto escalation in progress</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  // ── Render Disputes ──
  const renderDisputes = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-[#1D1D1F]">Financial Disputes & Investigations</h2>
        <p className="text-xs text-[#6E6E73]">Audit duplicate card authorizations and payout discrepancies</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)] lg:grid lg:min-h-[580px] lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Left Disputes */}
        <div className="border-b border-black/[0.06] lg:border-b-0 lg:border-r p-2.5 space-y-1.5">
          {disputes.map((dsp) => {
            const isSelected = dsp.id === selectedDispute.id;
            return (
              <button
                key={dsp.id}
                type="button"
                onClick={() => setSelectedDisputeId(dsp.id)}
                className={cn(
                  'w-full cursor-pointer rounded-xl border p-3 text-left transition-all',
                  isSelected
                    ? 'border-[#007AFF] bg-blue-50/40 shadow-xs'
                    : 'border-black/[0.04] bg-white hover:bg-[#F5F5F7]'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-[#007AFF]">{dsp.id}</span>
                  <span className="rounded bg-[#F5F5F7] px-1.5 py-0.2 text-[9px] font-semibold text-[#6E6E73]">
                    {dsp.status}
                  </span>
                </div>
                <h4 className="mt-1.5 text-xs font-bold text-[#1D1D1F]">{dsp.title}</h4>
                <p className="text-[11px] text-[#6E6E73]">{dsp.customer} · {dsp.amount}</p>
              </button>
            );
          })}
        </div>

        {/* Right Detail */}
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between border-b border-black/[0.06] pb-3.5">
            <div>
              <span className="font-mono text-xs font-bold text-[#007AFF]">{selectedDispute.id}</span>
              <h3 className="mt-1 text-base font-bold text-[#1D1D1F]">{selectedDispute.title}</h3>
              <p className="text-xs text-[#6E6E73]">{selectedDispute.customer} · Amount: <strong className="text-[#1D1D1F]">{selectedDispute.amount}</strong></p>
            </div>
            <span className="rounded-lg border border-black/[0.06] bg-[#F5F5F7] px-2.5 py-1 text-xs font-semibold text-[#1D1D1F]">
              {selectedDispute.status}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Evidence Package</h4>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {selectedDispute.evidence.map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-xl border border-black/[0.04] bg-[#FAFBFD] p-2.5 text-xs">
                    <FileCheck2 className="h-3.5 w-3.5 text-[#007AFF] shrink-0" />
                    <span className="text-[#1D1D1F] truncate">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-black/[0.06] bg-[#FAFBFD] p-3.5 space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Decision</h4>
              <button
                type="button"
                onClick={() => decideDispute('Refund Approval')}
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#007AFF] py-2 text-xs font-semibold text-white hover:bg-[#0066D6]"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve Reversal
              </button>
              <button
                type="button"
                onClick={() => decideDispute('Claim Declined')}
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] bg-white py-2 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
              >
                <X className="h-3.5 w-3.5" /> Decline Claim
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  // ── Render On-Call ──
  const renderOnCall = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#1D1D1F]">24/7 On-Call Escalation Roster</h2>
          <p className="text-xs text-[#6E6E73]">Manage emergency responder shifts and paging</p>
        </div>

        <button
          type="button"
          onClick={() => showNotice('Test pager ping sent.')}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
        >
          <PhoneCall className="h-3.5 w-3.5 text-[#007AFF]" /> Test Pager
        </button>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { role: 'Primary Operations', name: 'Hakim Zulkifli', status: 'Active On-Call', channels: 'Push · SMS · Pager' },
          { role: 'Backup Operations', name: 'Siti Noor', status: 'Standby', channels: 'Push · SMS · Phone' },
          { role: 'Operations Lead', name: 'Daniel Teoh', status: 'Escalation Tier 3', channels: 'Phone · Teams' },
          { role: 'Payments Lead', name: 'Mei Ling Tan', status: 'Active (until 08:00)', channels: 'Push · Voice' },
        ].map((person) => (
          <div key={person.role} className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#1D1D1F]">
                  <UserCheck className="h-4 w-4 text-[#007AFF]" />
                </span>
                <span className="rounded bg-[#F5F5F7] px-2 py-0.5 text-[9px] font-semibold text-[#6E6E73]">
                  {person.status}
                </span>
              </div>
              <p className="mt-2.5 text-[9px] font-bold uppercase tracking-wider text-[#8E8E93]">{person.role}</p>
              <h4 className="text-xs font-bold text-[#1D1D1F]">{person.name}</h4>
              <p className="mt-0.5 text-[11px] text-[#6E6E73]">{person.channels}</p>
            </div>

            <button
              type="button"
              onClick={() => showNotice(`Pager sent to ${person.name}.`)}
              className="mt-3.5 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] bg-[#F5F5F7] py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-[#EBEBEF]"
            >
              <BellRing className="h-3 w-3 text-[#007AFF]" /> Direct Notify
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4" data-component="admin-support-dashboard">
      {/* Top Operations Navigation Ribbon - Clean Apple Style */}
      <section className="rounded-2xl border border-black/[0.06] bg-white p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] sm:px-4">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1D1D1F] text-white">
              <Headphones className="h-4.5 w-4.5" />
            </span>
            <div>
              <p className="text-xs font-bold text-[#1D1D1F]">Support & Operations Command</p>
              <p className="text-[10px] text-[#6E6E73]">
                Live Inquiries, Dispatch, Incident Recovery & Finance Audits
              </p>
            </div>
          </div>

          {/* Mobile Navigation: 3x2 Grid (No horizontal swiping) */}
          <nav className="grid grid-cols-3 gap-1 rounded-xl bg-[#F5F5F7] p-1 sm:hidden" aria-label="Support management tabs mobile">
            {adminNavigation.map((item) => {
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
                  <div className="flex items-center gap-1">
                    <Icon className="h-3.5 w-3.5" />
                    {item.count !== undefined && (
                      <span
                        className={cn(
                          'rounded px-1 py-0.1 text-[8px]',
                          isActive ? 'bg-blue-50 text-[#007AFF]' : 'bg-slate-200 text-[#6E6E73]'
                        )}
                      >
                        {item.count}
                      </span>
                    )}
                  </div>
                  <span className="truncate max-w-full">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Desktop Navigation: Horizontal Ribbon */}
          <nav className="hidden sm:flex min-w-0 gap-1 rounded-xl bg-[#F5F5F7] p-1" aria-label="Support management tabs">
            {adminNavigation.map((item) => {
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
                  {item.count !== undefined && (
                    <span
                      className={cn(
                        'rounded px-1 py-0.1 text-[9px]',
                        isActive ? 'bg-blue-50 text-[#007AFF]' : 'bg-slate-200 text-[#6E6E73]'
                      )}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      {/* Floating Notice Toast */}
      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3.5 py-2 text-xs font-semibold text-[#1D1D1F] shadow-xs"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-[#34C759]" />
          <span>{notice}</span>
        </div>
      )}

      {/* Dynamic Views */}
      {activeView === 'command' && renderCommandCenter()}
      {activeView === 'conversations' && renderConversations()}
      {activeView === 'tickets' && ticketWorkspace}
      {activeView === 'incidents' && renderIncidents()}
      {activeView === 'disputes' && renderDisputes()}
      {activeView === 'on-call' && renderOnCall()}

      {/* Admin Custom Ticket Creator Modal */}
      {createTicketOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-ticket-title"
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl border border-black/[0.08]">
            <div className="flex items-center justify-between border-b border-black/[0.06] p-4">
              <div className="flex items-center gap-2">
                <TicketCheck className="h-4.5 w-4.5 text-[#007AFF]" />
                <h3 id="admin-ticket-title" className="text-sm font-bold text-[#1D1D1F]">
                  Create Tracked Ticket
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
                  className="min-h-9 w-full rounded-xl border border-black/[0.08] px-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                />
              </label>

              <div className="grid gap-2.5 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Category</span>
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="min-h-9 w-full rounded-xl border border-black/[0.08] bg-white px-2 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                  >
                    <option>Parking access</option>
                    <option>Booking</option>
                    <option>Payment</option>
                    <option>Owner support</option>
                    <option>General inquiry</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Priority</span>
                  <select
                    value={ticketPriority}
                    onChange={(e) => setTicketPriority(e.target.value)}
                    className="min-h-9 w-full rounded-xl border border-black/[0.08] bg-white px-2 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                  >
                    <option>Urgent</option>
                    <option>High</option>
                    <option>Normal</option>
                    <option>Low</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Assigned Team</span>
                  <select
                    value={ticketTeam}
                    onChange={(e) => setTicketTeam(e.target.value)}
                    className="min-h-9 w-full rounded-xl border border-black/[0.08] bg-white px-2 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                  >
                    <option>Parking Operations</option>
                    <option>Customer Support</option>
                    <option>Payments</option>
                    <option>Owner Support</option>
                    <option>Trust & Safety</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Notes *</span>
                <textarea
                  value={ticketSummary}
                  onChange={(e) => setTicketSummary(e.target.value)}
                  rows={3}
                  required
                  className="w-full resize-none rounded-xl border border-black/[0.08] p-2.5 text-xs leading-relaxed text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                />
              </label>

              {ticketError && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                  {ticketError}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-black/[0.06] pt-3">
                <button
                  type="button"
                  onClick={() => setCreateTicketOpen(false)}
                  className="cursor-pointer rounded-xl border border-black/[0.08] px-3.5 py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ticketCreating}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0066D6] disabled:opacity-50"
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
