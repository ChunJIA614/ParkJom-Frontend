import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Image,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  UserCheck,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
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

const statusMeta: Record<SupportTicketStatus, { label: string; classes: string }> = {
  Open: { label: 'Open', classes: 'border-amber-200 bg-amber-50 text-amber-700' },
  InProgress: { label: 'In progress', classes: 'border-blue-200 bg-blue-50 text-blue-700' },
  Closed: { label: 'Closed', classes: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
};

const connectionMeta: Record<SupportConnectionState, { label: string; classes: string }> = {
  connecting: { label: 'Connecting', classes: 'text-amber-600' },
  live: { label: 'Live', classes: 'text-emerald-600' },
  fallback: { label: 'Auto refresh', classes: 'text-blue-600' },
  offline: { label: 'Reconnecting', classes: 'text-rose-600' },
};

const MAX_ATTACHMENT_COUNT = 3;
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const allowedAttachment = (file: File) => (
  file.type.startsWith('image/')
  || ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)
  || /\.(pdf|doc|docx|png|jpe?g|gif|webp)$/i.test(file.name)
);

const formatDate = (value: string) => new Intl.DateTimeFormat('en-MY', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const formatFileSize = (size: number) => size < 1024 * 1024
  ? `${Math.max(1, Math.round(size / 1024))} KB`
  : `${(size / (1024 * 1024)).toFixed(1)} MB`;

const FileIcon = ({ attachment }: { attachment: SupportAttachment }) =>
  attachment.contentType.startsWith('image/') ? <Image className="h-4 w-4" /> : <FileText className="h-4 w-4" />;

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
    if (validType.length !== incoming.length) setFormError('Only images, PDF, DOC, and DOCX files are supported.');
    else if (validSize.length !== validType.length) setFormError('Each attachment must be 5 MB or smaller.');
    else if (current.length + validSize.length > MAX_ATTACHMENT_COUNT) setFormError('A maximum of 3 attachments is allowed.');
    else setFormError(null);
    return [...current, ...validSize].slice(0, MAX_ATTACHMENT_COUNT);
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTicket || (!composer.trim() && composerFiles.length === 0) || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendSupportMessage(viewer, selectedTicket.ticketId, composer || 'Attachment added.', composerFiles);
      setComposer('');
      setComposerFiles([]);
      await loadTickets(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send this message.');
    } finally {
      setSending(false);
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
    if (!selectedTicket || actionLoading || !window.confirm(`Close ${selectedTicket.ticketReference}? The conversation will become read-only.`)) return;
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
      setFormError('Subject and opening message are required.');
      return;
    }
    if (mode === 'admin' && (!customerName.trim() || !customerEmail.trim())) {
      setFormError('Customer name and email are required.');
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
      setFormError(createError instanceof Error ? createError.message : 'Unable to create this support ticket.');
    } finally {
      setCreating(false);
    }
  };

  const connection = connectionMeta[connectionState];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><LifeBuoy className="h-5 w-5" /></span>
            <div><h2 className="text-lg font-bold text-slate-950">{mode === 'admin' ? 'Support inbox' : 'Support tickets'}</h2><p className="mt-0.5 text-xs text-slate-500">{mode === 'admin' ? 'Accept, reply to, open, and close customer conversations.' : 'Start a conversation and follow every update from the support team.'}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-semibold ${connection.classes}`}>
              {connectionState === 'live' ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{connection.label}
            </span>
            <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />{mode === 'admin' ? 'Open ticket' : 'New ticket'}</button>
          </div>
        </div>
      </section>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid lg:min-h-[650px] lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className={`${mobileConversationOpen ? 'hidden lg:flex' : 'flex'} min-h-[560px] flex-col border-r border-slate-200`}>
          <div className="border-b border-slate-200 p-3">
            <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1">
              {(['Open', 'InProgress', 'Closed'] as SupportTicketStatus[]).map((item) => (
                <button key={item} type="button" onClick={() => { setStatus(item); setMobileConversationOpen(false); }} className={`min-h-9 rounded-lg px-2 text-[10px] font-semibold ${status === item ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>{item === 'InProgress' ? 'In progress' : item === 'Closed' ? 'History' : 'Open'}</button>
              ))}
            </div>
            <label className="relative mt-3 block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets" className="min-h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-blue-500" /></label>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loading ? <div className="flex h-40 items-center justify-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading tickets</div> : tickets.length === 0 ? <div className="flex h-48 flex-col items-center justify-center px-6 text-center"><MessageSquare className="h-7 w-7 text-slate-300" /><p className="mt-2 text-xs font-semibold text-slate-600">No {status === 'Closed' ? 'ticket history' : status.toLowerCase() + ' tickets'}</p><p className="mt-1 text-[11px] text-slate-400">{mode === 'admin' ? 'New customer conversations will appear here.' : 'Create a ticket whenever you need help.'}</p></div> : tickets.map((ticket) => {
              const lastMessage = ticket.messages.at(-1);
              const meta = statusMeta[ticket.status];
              return <button key={ticket.ticketId} type="button" onClick={() => { setSelectedTicketId(ticket.ticketId); setMobileConversationOpen(true); }} className={`mb-1 w-full rounded-xl border p-3 text-left transition ${selectedTicketId === ticket.ticketId ? 'border-blue-200 bg-blue-50/60' : 'border-transparent hover:bg-slate-50'}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] font-semibold text-slate-400">{ticket.ticketReference}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${meta.classes}`}>{meta.label}</span></div>
                <p className="mt-2 truncate text-xs font-semibold text-slate-800">{ticket.subject}</p>
                {mode === 'admin' && <p className="mt-1 truncate text-[10px] text-slate-500">{ticket.customerName} · {ticket.customerRole}</p>}
                <p className="mt-1 truncate text-[10px] text-slate-400">{lastMessage?.message || 'No messages'} · {formatDate(ticket.updatedAt)}</p>
              </button>;
            })}
          </div>
        </div>

        <div className={`${mobileConversationOpen ? 'flex' : 'hidden lg:flex'} min-h-[560px] flex-col`}>
          {!selectedTicket ? <div className="flex flex-1 flex-col items-center justify-center text-center"><MessageSquare className="h-9 w-9 text-slate-200" /><p className="mt-3 text-sm font-semibold text-slate-600">Select a ticket conversation</p></div> : <>
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-3 sm:p-4">
              <div className="flex min-w-0 items-start gap-2"><button type="button" onClick={() => setMobileConversationOpen(false)} className="mt-0.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Back to tickets"><ArrowLeft className="h-4 w-4" /></button><div className="min-w-0"><p className="font-mono text-[10px] font-semibold text-blue-600">{selectedTicket.ticketReference}</p><h3 className="truncate text-sm font-bold text-slate-900">{selectedTicket.subject}</h3><p className="mt-1 text-[10px] text-slate-500">{mode === 'admin' ? `${selectedTicket.customerName} · ${selectedTicket.customerEmail}` : selectedTicket.assignedAdminName ? `Handled by ${selectedTicket.assignedAdminName}` : 'Waiting for an administrator'}</p></div></div>
              <div className="flex shrink-0 items-center gap-2">
                {mode === 'admin' && selectedTicket.status === 'Open' && <button type="button" onClick={handleAccept} disabled={actionLoading} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-blue-600 px-3 text-[11px] font-semibold text-white disabled:opacity-50"><UserCheck className="h-4 w-4" />Accept</button>}
                {mode === 'admin' && selectedTicket.status === 'InProgress' && <button type="button" onClick={handleClose} disabled={actionLoading} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-[11px] font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Close</button>}
              </div>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-3 sm:p-5">
              {selectedTicket.messages.map((message) => {
                const own = message.senderUserId === viewer.userId && message.messageType !== 'System';
                if (message.messageType === 'System') return <div key={message.messageId} className="flex justify-center"><span className="rounded-full bg-slate-200/70 px-3 py-1 text-[9px] font-medium text-slate-500">{message.message}</span></div>;
                return <div key={message.messageId} className={`flex ${own ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] sm:max-w-[72%] ${own ? 'text-right' : ''}`}><p className="mb-1 px-1 text-[9px] font-semibold text-slate-400">{message.senderName} · {message.senderRole}</p><div className={`rounded-2xl px-3.5 py-2.5 text-left text-xs leading-relaxed shadow-sm ${own ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700'}`}>
                  {message.message && <p className="whitespace-pre-wrap">{message.message}</p>}
                  {message.attachments.length > 0 && <div className={`mt-2 space-y-1.5 ${message.message ? 'border-t pt-2' : ''} ${own ? 'border-white/20' : 'border-slate-100'}`}>{message.attachments.map((attachment) => <a key={attachment.attachmentId} href={attachment.url ?? undefined} target="_blank" rel="noreferrer" aria-disabled={!attachment.url} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${own ? 'bg-white/10' : 'bg-slate-50'} ${attachment.url ? '' : 'pointer-events-none opacity-70'}`}><FileIcon attachment={attachment} /><span className="min-w-0 flex-1 truncate text-[10px] font-medium">{attachment.fileName}</span><span className="text-[9px] opacity-70">{formatFileSize(attachment.size)}</span>{attachment.url && <Download className="h-3 w-3" />}</a>)}</div>}
                </div><p className="mt-1 px-1 text-[9px] text-slate-400">{formatDate(message.createdAt)}</p></div></div>;
              })}
              <div ref={messageEndRef} />
            </div>

            {selectedTicket.status === 'Closed' ? <div className="border-t border-slate-200 bg-white p-4 text-center"><p className="text-xs font-semibold text-slate-600">This ticket is closed</p><p className="mt-1 text-[10px] text-slate-400">The conversation remains available as read-only history.</p></div> : mode === 'admin' && selectedTicket.status === 'Open' ? <div className="border-t border-amber-200 bg-amber-50 p-4 text-center text-xs text-amber-700">Accept this ticket before replying.</div> : <form onSubmit={handleSend} className="border-t border-slate-200 bg-white p-3">
              {composerFiles.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{composerFiles.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[9px] text-slate-600"><Paperclip className="h-3 w-3" />{file.name}<button type="button" onClick={() => setComposerFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}><X className="h-3 w-3" /></button></span>)}</div>}
              <div className="flex items-end gap-2"><label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Attach files"><Paperclip className="h-4 w-4" /><input type="file" multiple accept="image/*,.pdf,.doc,.docx" className="sr-only" onChange={(event) => { setComposerFiles((current) => validateFiles(current, Array.from(event.target.files ?? []))); event.target.value = ''; }} /></label><textarea rows={1} value={composer} onChange={(event) => setComposer(event.target.value)} placeholder="Type a message…" className="min-h-10 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-blue-500" /><button type="submit" disabled={sending || (!composer.trim() && composerFiles.length === 0)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></div>
              <p className="mt-2 text-[9px] text-slate-400">Up to 3 images, PDF, or Word files · 5 MB each</p>
            </form>}
          </>}
        </div>
      </section>

      {createOpen && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="create-ticket-title"><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><h3 id="create-ticket-title" className="text-base font-bold text-slate-900">{mode === 'admin' ? 'Open a customer ticket' : 'Create support ticket'}</h3><p className="mt-0.5 text-[10px] text-slate-500">Start the conversation with a clear subject and message.</p></div><button type="button" onClick={() => { setCreateOpen(false); resetCreateForm(); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-4 w-4" /></button></div>
        <form onSubmit={handleCreate} className="space-y-4 p-4 sm:p-5">
          {mode === 'admin' && <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="text-[10px] font-semibold uppercase text-slate-500">Customer name</span><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500" /></label><label className="space-y-1"><span className="text-[10px] font-semibold uppercase text-slate-500">Customer email</span><input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} required className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500" /></label><label className="space-y-1 sm:col-span-2"><span className="text-[10px] font-semibold uppercase text-slate-500">Customer role</span><select value={customerRole} onChange={(event) => setCustomerRole(event.target.value as 'Owner' | 'Commuter')} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"><option value="Commuter">Commuter</option><option value="Owner">Owner</option></select></label></div>}
          <label className="block space-y-1"><span className="text-[10px] font-semibold uppercase text-slate-500">Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} required placeholder="Briefly describe the issue" className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500" /></label>
          <label className="block space-y-1"><span className="text-[10px] font-semibold uppercase text-slate-500">Opening message</span><textarea value={openingMessage} onChange={(event) => setOpeningMessage(event.target.value)} rows={5} maxLength={2000} required placeholder="Explain what happened and what help is needed…" className="w-full resize-none rounded-xl border border-slate-200 p-3 text-xs leading-relaxed outline-none focus:border-blue-500" /></label>
          <div><span className="text-[10px] font-semibold uppercase text-slate-500">Attachments</span><label className="mt-1 flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center hover:border-blue-400 hover:bg-blue-50/40"><Paperclip className="h-5 w-5 text-slate-400" /><span className="mt-1 text-[10px] font-semibold text-slate-600">Add screenshots or documents</span><span className="text-[9px] text-slate-400">3 files maximum · 5 MB each</span><input type="file" multiple accept="image/*,.pdf,.doc,.docx" className="sr-only" onChange={(event) => { setOpeningFiles((current) => validateFiles(current, Array.from(event.target.files ?? []))); event.target.value = ''; }} /></label>{openingFiles.length > 0 && <div className="mt-2 space-y-1">{openingFiles.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] text-slate-600"><Paperclip className="h-3.5 w-3.5" /><span className="min-w-0 flex-1 truncate">{file.name}</span><span>{formatFileSize(file.size)}</span><button type="button" onClick={() => setOpeningFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X className="h-3.5 w-3.5" /></button></div>)}</div>}</div>
          {formError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-700">{formError}</div>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => { setCreateOpen(false); resetCreateForm(); }} className="min-h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" disabled={creating} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white disabled:opacity-50">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{creating ? 'Creating…' : mode === 'admin' ? 'Open ticket' : 'Submit ticket'}</button></div>
        </form>
      </div></div>}
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
