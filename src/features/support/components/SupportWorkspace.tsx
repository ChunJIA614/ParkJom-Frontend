import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  Image as ImageIcon,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Radio,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Tag,
  User,
  UserCheck,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  acceptSupportTicket,
  closeSupportTicket,
  createAdminSupportTicket,
  createSupportTicket,
  listSupportTickets,
  sendSupportMessage,
} from '../api/supportTicketService';
import { connectSupportRealtime } from '../realtime/supportRealtime';
import type {
  SupportAttachment,
  SupportConnectionState,
  SupportTicket,
  SupportTicketStatus,
  SupportViewer,
} from '../types';
import SupportExperience from './SupportExperience';

interface SupportWorkspaceProps {
  mode: 'user' | 'admin';
  viewer: SupportViewer;
}

const statusMeta: Record<SupportTicketStatus, { label: string; badge: string; dot: string }> = {
  Open: {
    label: 'Open',
    badge: 'border-black/[0.06] bg-[#F5F5F7] text-[#1D1D1F]',
    dot: 'bg-amber-500',
  },
  InProgress: {
    label: 'In Progress',
    badge: 'border-blue-200/60 bg-blue-50/70 text-[#007AFF]',
    dot: 'bg-[#007AFF]',
  },
  Closed: {
    label: 'Closed',
    badge: 'border-black/[0.06] bg-[#F5F5F7] text-[#6E6E73]',
    dot: 'bg-slate-400',
  },
};

const connectionMeta: Record<SupportConnectionState, { label: string; badge: string; icon: typeof Wifi; dot: string }> = {
  connecting: {
    label: 'Connecting...',
    badge: 'border-black/[0.06] bg-[#F5F5F7] text-[#6E6E73]',
    icon: Radio,
    dot: 'bg-slate-400 animate-pulse',
  },
  live: {
    label: 'Live',
    badge: 'border-black/[0.06] bg-white text-[#1D1D1F]',
    icon: Wifi,
    dot: 'bg-[#34C759] animate-pulse',
  },
  fallback: {
    label: 'Auto Sync',
    badge: 'border-black/[0.06] bg-white text-[#6E6E73]',
    icon: Wifi,
    dot: 'bg-[#007AFF]',
  },
  offline: {
    label: 'Reconnecting',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: WifiOff,
    dot: 'bg-rose-500 animate-ping',
  },
};

const MAX_ATTACHMENT_COUNT = 3;
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

const allowedAttachment = (file: File) => (
  file.type.startsWith('image/')
  || ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)
  || /\.(pdf|doc|docx|png|jpe?g|gif|webp)$/i.test(file.name)
);

const formatDate = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return new Intl.DateTimeFormat('en-MY', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-MY', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatFileSize = (size: number) => {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

function AttachmentFileIcon({ attachment }: { attachment: SupportAttachment }) {
  if (attachment.contentType.startsWith('image/')) {
    return <ImageIcon className="h-4 w-4 shrink-0 text-[#007AFF]" />;
  }
  return <FileText className="h-4 w-4 shrink-0 text-[#6E6E73]" />;
}

function TicketWorkspace({ mode, viewer }: SupportWorkspaceProps) {
  const [status, setStatus] = useState<SupportTicketStatus>('Open');
  const [search, setSearch] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<SupportConnectionState>('connecting');
  const [composer, setComposer] = useState('');
  const [composerFiles, setComposerFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [openingMessage, setOpeningMessage] = useState('');
  const [openingFiles, setOpeningFiles] = useState<File[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerRole, setCustomerRole] = useState<'Owner' | 'Commuter'>('Commuter');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await listSupportTickets(viewer, status, search);
      setTickets(result);
      setSelectedTicketId((current) => current && result.some((ticket) => ticket.ticketId === current)
        ? current
        : result[0]?.ticketId ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load support tickets.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, status, viewer]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTickets(), search.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadTickets, search]);

  useEffect(() => connectSupportRealtime({
    token: viewer.token,
    onStateChange: setConnectionState,
    onEvent: () => void loadTickets(true),
  }), [loadTickets, viewer.token]);

  useEffect(() => {
    if (connectionState !== 'fallback') return;
    const timer = window.setInterval(() => void loadTickets(true), 10_000);
    return () => window.clearInterval(timer);
  }, [connectionState, loadTickets]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.ticketId === selectedTicketId) ?? null,
    [selectedTicketId, tickets],
  );

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedTicket?.messages.length]);

  const validateFiles = (current: File[], incoming: File[]) => {
    const validType = incoming.filter(allowedAttachment);
    const validSize = validType.filter((file) => file.size <= MAX_ATTACHMENT_SIZE);
    if (validType.length !== incoming.length) setFormError('Only images (PNG, JPG, WebP) and PDF/Word documents are supported.');
    else if (validSize.length !== validType.length) setFormError('Each attachment must be 5 MB or smaller.');
    else if (current.length + validSize.length > MAX_ATTACHMENT_COUNT) setFormError('A maximum of 3 attachments is allowed.');
    else setFormError(null);
    return [...current, ...validSize].slice(0, MAX_ATTACHMENT_COUNT);
  };

  const handleSend = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selectedTicket || (!composer.trim() && composerFiles.length === 0) || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendSupportMessage(viewer, selectedTicket.ticketId, composer || 'Attachment uploaded.', composerFiles);
      setComposer('');
      setComposerFiles([]);
      await loadTickets(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleAccept = async () => {
    if (!selectedTicket || actionLoading) return;
    setActionLoading(true);
    try {
      await acceptSupportTicket(viewer, selectedTicket.ticketId);
      setStatus('InProgress');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to accept this ticket.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!selectedTicket || actionLoading) return;
    if (!window.confirm(`Close ticket ${selectedTicket.ticketReference}? The conversation history will remain archived as read-only.`)) return;
    setActionLoading(true);
    try {
      await closeSupportTicket(viewer, selectedTicket.ticketId, 'The support request has been completed.');
      setStatus('Closed');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to close this ticket.');
    } finally {
      setActionLoading(false);
    }
  };

  const resetCreateForm = () => {
    setSubject('');
    setOpeningMessage('');
    setOpeningFiles([]);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerRole('Commuter');
    setFormError(null);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !openingMessage.trim()) {
      setFormError('Please enter a subject and detailed description.');
      return;
    }
    if (mode === 'admin' && (!customerName.trim() || !customerEmail.trim())) {
      setFormError('Customer name and email are required for administrative tickets.');
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const ticket = mode === 'admin'
        ? await createAdminSupportTicket(viewer, {
            customerName, customerEmail, customerRole, subject, message: openingMessage, files: openingFiles,
          })
        : await createSupportTicket(viewer, { subject, message: openingMessage, files: openingFiles });
      resetCreateForm();
      setCreateOpen(false);
      setStatus(ticket.status);
      setSelectedTicketId(ticket.ticketId);
      setMobileConversationOpen(true);
      await loadTickets(true);
    } catch (createError) {
      setFormError(createError instanceof Error ? createError.message : 'Unable to create support ticket.');
    } finally {
      setCreating(false);
    }
  };

  const connection = connectionMeta[connectionState];
  const ConnectionIcon = connection.icon;

  return (
    <div className="space-y-4" data-component="ticket-workspace">
      {/* ── Top Bar / Header ── */}
      <section className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#007AFF]">
              <LifeBuoy className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#1D1D1F] sm:text-lg">
                  {mode === 'admin' ? 'Support Ticket Workspace' : 'My Support Tickets'}
                </h2>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-[#6E6E73]">
                  {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#6E6E73]">
                {mode === 'admin'
                  ? 'Manage incoming customer inquiries, assign cases, and maintain response SLAs.'
                  : 'Track ongoing support requests and chat in real-time with ParkJom specialists.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className={cn('inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold transition-colors', connection.badge)}>
              <span className={cn('h-2 w-2 rounded-full', connection.dot)} />
              <ConnectionIcon className="h-3.5 w-3.5" />
              <span>{connection.label}</span>
            </div>

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#0066D6] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>{mode === 'admin' ? 'Open Customer Ticket' : 'New Ticket'}</span>
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-700 shadow-sm">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => void loadTickets()}
            className="cursor-pointer font-semibold underline hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Main Split View ── */}
      <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] lg:grid lg:min-h-[680px] lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Left Pane: Ticket Queue & Filters */}
        <div className={cn('min-h-[580px] flex-col border-r border-black/[0.06] bg-white', mobileConversationOpen ? 'hidden lg:flex' : 'flex')}>
          {/* Status filter tab pills */}
          <div className="border-b border-black/[0.06] p-3.5 space-y-3">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#F5F5F7] p-1 text-center">
              {(['Open', 'InProgress', 'Closed'] as SupportTicketStatus[]).map((tabKey) => {
                const isActive = status === tabKey;
                const tabLabel = tabKey === 'InProgress' ? 'In Progress' : tabKey === 'Closed' ? 'Resolved' : 'Active Open';
                return (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => {
                      setStatus(tabKey);
                      setMobileConversationOpen(false);
                    }}
                    className={cn(
                      'cursor-pointer min-h-8 rounded-lg px-2 text-[11px] font-semibold transition-all',
                      isActive
                        ? 'bg-white text-[#007AFF] shadow-sm font-bold'
                        : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                    )}
                  >
                    {tabLabel}
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[#8E8E93]" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ticket #, subject, sender..."
                className="min-h-9 w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/80 pl-9 pr-8 text-xs text-[#1D1D1F] placeholder:text-[#8E8E93] outline-none transition focus:border-[#007AFF] focus:bg-white focus:ring-2 focus:ring-[#007AFF]/10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-2.5 cursor-pointer text-[#8E8E93] hover:text-[#1D1D1F]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Ticket List Stream */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {loading ? (
              <div className="flex h-52 flex-col items-center justify-center gap-2 text-xs text-[#6E6E73]">
                <Loader2 className="h-5 w-5 animate-spin text-[#007AFF]" />
                <span>Loading support tickets...</span>
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F5F7] text-[#8E8E93]">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <p className="mt-3 text-xs font-bold text-[#1D1D1F]">
                  No {status === 'Closed' ? 'resolved tickets' : `${status.toLowerCase()} tickets found`}
                </p>
                <p className="mt-1 text-[11px] text-[#6E6E73] max-w-[220px]">
                  {search
                    ? 'No tickets match your query. Try a different keyword.'
                    : mode === 'admin'
                    ? 'New customer support inquiries will show up here.'
                    : 'Whenever you need assistance, create a ticket to get help.'}
                </p>
                {mode === 'user' && !search && (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#007AFF] hover:bg-blue-100/80 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create Ticket
                  </button>
                )}
              </div>
            ) : (
              tickets.map((ticket) => {
                const isSelected = selectedTicketId === ticket.ticketId;
                const lastMessage = ticket.messages.at(-1);
                const meta = statusMeta[ticket.status] || statusMeta.Open;

                return (
                  <button
                    key={ticket.ticketId}
                    type="button"
                    onClick={() => {
                      setSelectedTicketId(ticket.ticketId);
                      setMobileConversationOpen(true);
                    }}
                    className={cn(
                      'group relative w-full cursor-pointer rounded-xl border p-3 text-left transition-all',
                      isSelected
                        ? 'border-[#007AFF]/30 bg-blue-50/50 shadow-sm ring-1 ring-[#007AFF]/20'
                        : 'border-transparent hover:border-black/[0.04] hover:bg-[#F5F5F7]/70'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold tracking-tight text-[#007AFF]">
                        {ticket.ticketReference}
                      </span>
                      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold', meta.badge)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                        {meta.label}
                      </span>
                    </div>

                    <p className="mt-1.5 line-clamp-1 text-xs font-bold text-[#1D1D1F] group-hover:text-[#007AFF] transition-colors">
                      {ticket.subject}
                    </p>

                    {mode === 'admin' && (
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#6E6E73]">
                        <span className="font-medium text-[#1D1D1F] truncate">{ticket.customerName}</span>
                        <span>·</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-[#6E6E73]">{ticket.customerRole}</span>
                      </div>
                    )}

                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-[#8E8E93]">
                      <p className="line-clamp-1 flex-1">
                        {lastMessage?.message || 'No messages yet'}
                      </p>
                      <span className="shrink-0 text-[9px] font-medium">{formatDate(ticket.updatedAt)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Conversation & Message Stream */}
        <div className={cn('min-h-[580px] flex-col bg-[#FAFBFD]', mobileConversationOpen ? 'flex' : 'hidden lg:flex')}>
          {!selectedTicket ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-sm border border-black/[0.04] text-[#8E8E93]">
                <MessageSquare className="h-8 w-8 text-[#007AFF]/60" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-[#1D1D1F]">No Ticket Selected</h3>
              <p className="mt-1 text-xs text-[#6E6E73] max-w-xs">
                Select a ticket from the left panel to review discussion history, attachments, and respond in real-time.
              </p>
            </div>
          ) : (
            <>
              {/* Ticket Detail Top Header */}
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] bg-white px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileConversationOpen(false)}
                    className="cursor-pointer rounded-lg p-1.5 text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] lg:hidden"
                    aria-label="Back to ticket list"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-[#007AFF]">
                        {selectedTicket.ticketReference}
                      </span>
                      <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-semibold', statusMeta[selectedTicket.status]?.badge)}>
                        {statusMeta[selectedTicket.status]?.label}
                      </span>
                    </div>
                    <h3 className="mt-0.5 truncate text-sm font-bold text-[#1D1D1F] sm:text-base">
                      {selectedTicket.subject}
                    </h3>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#6E6E73]">
                      {mode === 'admin' ? (
                        <>
                          <User className="h-3 w-3 text-[#8E8E93]" />
                          <span className="font-medium text-[#1D1D1F]">{selectedTicket.customerName}</span>
                          <span>({selectedTicket.customerEmail})</span>
                          <span>·</span>
                          <span className="font-semibold text-[#007AFF]">{selectedTicket.customerRole}</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5 text-[#007AFF]" />
                          <span>
                            {selectedTicket.assignedAdminName
                              ? `Handled by ${selectedTicket.assignedAdminName}`
                              : 'Queued for next available support agent'}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Header Action Controls */}
                <div className="flex items-center gap-2">
                  {mode === 'admin' && selectedTicket.status === 'Open' && (
                    <button
                      type="button"
                      onClick={handleAccept}
                      disabled={actionLoading}
                      className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#007AFF] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0066D6] disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                      <span>Accept Ticket</span>
                    </button>
                  )}

                  {mode === 'admin' && selectedTicket.status === 'InProgress' && (
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={actionLoading}
                      className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                      <span>Resolve & Close</span>
                    </button>
                  )}
                </div>
              </header>

              {/* Message Chat Feed */}
              <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                {selectedTicket.messages.map((message) => {
                  const isOwn = message.senderUserId === viewer.userId && message.messageType !== 'System';
                  const isSystem = message.messageType === 'System';

                  if (isSystem) {
                    return (
                      <div key={message.messageId} className="my-2 flex justify-center">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.04] bg-white px-3 py-1 text-[10px] font-medium text-[#6E6E73] shadow-xs">
                          <CheckCircle2 className="h-3 w-3 text-[#34C759]" />
                          {message.message}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={message.messageId}
                      className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}
                    >
                      <div className={cn('max-w-[88%] sm:max-w-[75%]', isOwn && 'text-right')}>
                        <div className={cn('mb-1 flex items-center gap-1.5 px-1 text-[10px] font-medium text-[#8E8E93]', isOwn && 'justify-end')}>
                          <span className="font-semibold text-[#1D1D1F]">{message.senderName}</span>
                          <span className="rounded bg-slate-100 px-1 py-0.2 text-[8px] font-semibold text-[#6E6E73]">{message.senderRole}</span>
                          <span>·</span>
                          <span>{formatDate(message.createdAt)}</span>
                        </div>

                        <div
                          className={cn(
                            'rounded-2xl px-4 py-3 text-left text-xs leading-relaxed shadow-sm',
                            isOwn
                              ? 'rounded-br-sm bg-[#007AFF] text-white'
                              : 'rounded-bl-sm border border-black/[0.06] bg-white text-[#1D1D1F]'
                          )}
                        >
                          {message.message && (
                            <p className="whitespace-pre-wrap">{message.message}</p>
                          )}

                          {message.attachments.length > 0 && (
                            <div className={cn('mt-2.5 space-y-1.5', message.message && 'border-t pt-2.5', isOwn ? 'border-white/20' : 'border-black/[0.06]')}>
                              {message.attachments.map((attachment) => (
                                <a
                                  key={attachment.attachmentId}
                                  href={attachment.url ?? undefined}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-disabled={!attachment.url}
                                  className={cn(
                                    'flex items-center gap-2 rounded-xl px-2.5 py-2 transition-colors',
                                    isOwn
                                      ? 'bg-white/15 hover:bg-white/25 text-white'
                                      : 'bg-[#F5F5F7] hover:bg-[#EBEBEF] text-[#1D1D1F]',
                                    !attachment.url && 'pointer-events-none opacity-60'
                                  )}
                                >
                                  <AttachmentFileIcon attachment={attachment} />
                                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                                    {attachment.fileName}
                                  </span>
                                  <span className="text-[10px] opacity-75">
                                    {formatFileSize(attachment.size)}
                                  </span>
                                  {attachment.url && <Download className="h-3.5 w-3.5 shrink-0 opacity-80" />}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messageEndRef} />
              </div>

              {/* Bottom Composer / Action Area */}
              {selectedTicket.status === 'Closed' ? (
                <div className="border-t border-black/[0.06] bg-white p-4 text-center">
                  <p className="text-xs font-bold text-[#1D1D1F]">This ticket has been resolved and closed</p>
                  <p className="mt-0.5 text-[11px] text-[#6E6E73]">
                    If you have a new or related question, please create a new support ticket.
                  </p>
                </div>
              ) : mode === 'admin' && selectedTicket.status === 'Open' ? (
                <div className="border-t border-amber-200 bg-amber-50/90 p-4 text-center">
                  <p className="text-xs font-bold text-amber-800">
                    Accept this ticket to assign it to your queue before sending replies.
                  </p>
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={actionLoading}
                    className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0066D6] disabled:opacity-50"
                  >
                    <UserCheck className="h-3.5 w-3.5" /> Accept Ticket
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSend} className="border-t border-black/[0.06] bg-white p-3 sm:p-4">
                  {/* Selected files chips */}
                  {composerFiles.length > 0 && (
                    <div className="mb-2.5 flex flex-wrap gap-1.5">
                      {composerFiles.map((file, index) => (
                        <span
                          key={`${file.name}-${index}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.06] bg-[#F5F5F7] px-2.5 py-1 text-[11px] font-medium text-[#1D1D1F]"
                        >
                          <Paperclip className="h-3 w-3 text-[#007AFF]" />
                          <span className="max-w-[140px] truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => setComposerFiles((curr) => curr.filter((_, i) => i !== index))}
                            aria-label={`Remove file ${file.name}`}
                            className="cursor-pointer text-[#8E8E93] hover:text-rose-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <label
                      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-black/[0.08] text-[#6E6E73] transition-colors hover:border-[#007AFF] hover:bg-blue-50/50 hover:text-[#007AFF]"
                      title="Attach documents or screenshots"
                    >
                      <Paperclip className="h-4 w-4" />
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx"
                        className="sr-only"
                        onChange={(event) => {
                          setComposerFiles((current) => validateFiles(current, Array.from(event.target.files ?? [])));
                          event.target.value = '';
                        }}
                      />
                    </label>

                    <textarea
                      rows={1}
                      value={composer}
                      onChange={(event) => setComposer(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message... (Press Enter to send, Shift+Enter for new line)"
                      className="min-h-10 flex-1 resize-none rounded-xl border border-black/[0.08] bg-[#F5F5F7]/80 px-3.5 py-2.5 text-xs text-[#1D1D1F] placeholder:text-[#8E8E93] outline-none transition focus:border-[#007AFF] focus:bg-white focus:ring-2 focus:ring-[#007AFF]/10"
                    />

                    <button
                      type="submit"
                      disabled={sending || (!composer.trim() && composerFiles.length === 0)}
                      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#007AFF] text-white shadow-sm transition hover:bg-[#0066D6] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Send message"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>

                  <p className="mt-2 text-[10px] text-[#8E8E93]">
                    Up to 3 images (PNG, JPG, WebP), PDF, or Word files · 5 MB max per file
                  </p>
                </form>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── Create Ticket Modal ── */}
      {createOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-ticket-title"
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl border border-black/[0.08]">
            <div className="flex items-center justify-between border-b border-black/[0.06] p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#007AFF]">
                  <Plus className="h-5 w-5" />
                </span>
                <div>
                  <h3 id="create-ticket-title" className="text-base font-bold text-[#1D1D1F]">
                    {mode === 'admin' ? 'Open Customer Ticket' : 'Create Support Ticket'}
                  </h3>
                  <p className="text-[11px] text-[#6E6E73]">
                    {mode === 'admin'
                      ? 'Initiate a tracked ticket on behalf of a commuter or property owner.'
                      : 'Our support team typically responds within 15–30 minutes.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  resetCreateForm();
                }}
                className="cursor-pointer rounded-lg p-2 text-[#8E8E93] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 p-4 sm:p-6">
              {mode === 'admin' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Customer Name *</span>
                    <input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      required
                      placeholder="e.g. Marcus Lim"
                      className="min-h-10 w-full rounded-xl border border-black/[0.08] px-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/10"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Customer Email *</span>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(event) => setCustomerEmail(event.target.value)}
                      required
                      placeholder="user@example.com"
                      className="min-h-10 w-full rounded-xl border border-black/[0.08] px-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/10"
                    />
                  </label>

                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Customer Role</span>
                    <select
                      value={customerRole}
                      onChange={(event) => setCustomerRole(event.target.value as 'Owner' | 'Commuter')}
                      className="min-h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                    >
                      <option value="Commuter">Commuter</option>
                      <option value="Owner">Parking Bay Owner</option>
                    </select>
                  </label>
                </div>
              )}

              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Subject / Summary *</span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={160}
                  required
                  placeholder="e.g. Barrier not opening at SS15 Courtyard Bay 12"
                  className="min-h-10 w-full rounded-xl border border-black/[0.08] px-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/10"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Detailed Explanation *</span>
                <textarea
                  value={openingMessage}
                  onChange={(event) => setOpeningMessage(event.target.value)}
                  rows={4}
                  maxLength={2000}
                  required
                  placeholder="Explain what happened, including any relevant booking reference or parking spot details..."
                  className="w-full resize-none rounded-xl border border-black/[0.08] p-3 text-xs leading-relaxed text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/10"
                />
              </label>

              {/* Attachment Drag-Drop Box */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Attachments (Optional)</span>
                <label className="mt-1 flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-black/[0.12] bg-[#F5F5F7]/60 p-3 text-center transition hover:border-[#007AFF] hover:bg-blue-50/40">
                  <Paperclip className="h-5 w-5 text-[#8E8E93]" />
                  <span className="mt-1 text-[11px] font-semibold text-[#1D1D1F]">Add screenshots or PDF receipts</span>
                  <span className="text-[9px] text-[#8E8E93]">Up to 3 files · Max 5 MB each</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    className="sr-only"
                    onChange={(event) => {
                      setOpeningFiles((curr) => validateFiles(curr, Array.from(event.target.files ?? [])));
                      event.target.value = '';
                    }}
                  />
                </label>

                {openingFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {openingFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center gap-2 rounded-xl border border-black/[0.06] bg-[#F5F5F7] px-3 py-2 text-[11px] text-[#1D1D1F]"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-[#007AFF]" />
                        <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                        <span className="text-[10px] text-[#8E8E93]">{formatFileSize(file.size)}</span>
                        <button
                          type="button"
                          onClick={() => setOpeningFiles((curr) => curr.filter((_, i) => i !== index))}
                          className="cursor-pointer text-[#8E8E93] hover:text-rose-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {formError && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-700">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 border-t border-black/[0.06] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    resetCreateForm();
                  }}
                  className="cursor-pointer min-h-10 rounded-xl border border-black/[0.08] px-4 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-[#007AFF] px-5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0066D6] disabled:opacity-50"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span>{creating ? 'Creating...' : mode === 'admin' ? 'Open Customer Ticket' : 'Submit Ticket'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SupportWorkspace(props: SupportWorkspaceProps) {
  return (
    <SupportExperience
      mode={props.mode}
      viewer={props.viewer}
      ticketWorkspace={<TicketWorkspace {...props} />}
    />
  );
}
