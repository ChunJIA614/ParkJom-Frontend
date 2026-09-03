import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  History,
  Image as ImageIcon,
  Info,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Tag,
  TicketCheck,
  UploadCloud,
  User,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  Wrench,
  X,
  Siren,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  acceptSupportTicket,
  closeSupportTicket,
  createAdminSupportTicket,
  createSupportTicket,
  downloadAndOpenAttachment,
  getSupportTicketDetails,
  linkTicketToDispute,
  linkTicketToIncident,
  listSupportTickets,
  reassignSupportTicket,
  reopenSupportTicket,
  sendSupportMessage,
  transitionSupportTicketStatus,
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

const statusMeta: Record<string, { label: string; badge: string; dot: string }> = {
  New: {
    label: 'New',
    badge: 'border-slate-200 bg-slate-100 text-[#007AFF]',
    dot: 'bg-[#007AFF]',
  },
  Assigned: {
    label: 'Assigned',
    badge: 'border-slate-200 bg-slate-100 text-[#334155]',
    dot: 'bg-slate-400',
  },
  InProgress: {
    label: 'In Progress',
    badge: 'border-slate-200 bg-slate-100 text-[#334155]',
    dot: 'bg-slate-500',
  },
  WaitingForCustomer: {
    label: 'Waiting on Customer',
    badge: 'border-slate-200 bg-slate-100 text-[#64748B]',
    dot: 'bg-slate-400',
  },
  Closed: {
    label: 'Closed',
    badge: 'border-slate-200/60 bg-slate-50 text-[#94A3B8]',
    dot: 'bg-slate-300',
  },
  Reopened: {
    label: 'Reopened',
    badge: 'border-slate-300 bg-slate-100 text-[#0F172A]',
    dot: 'bg-slate-700',
  },
  Open: {
    label: 'Open',
    badge: 'border-slate-200 bg-slate-100 text-[#007AFF]',
    dot: 'bg-[#007AFF]',
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

const MAX_ATTACHMENT_COUNT = 5;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB

const isImageAttachment = (att: SupportAttachment) => {
  if (att.contentType?.startsWith('image/')) return true;
  if (att.fileName && /\.(png|jpe?g|gif|webp|svg|bmp|jfif)$/i.test(att.fileName)) return true;
  const url = att.fileUrl || att.url;
  if (url && /\.(png|jpe?g|gif|webp|svg|bmp|jfif)/i.test(url)) return true;
  return false;
};

const isImageFile = (file: File) => {
  if (file.type?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|svg|bmp|jfif)$/i.test(file.name);
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
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

const formatFileSize = (size?: number) => {
  if (!size || size <= 0) return '';
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

function FileImageThumbnail({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white border border-black/[0.06] text-[#007AFF]">
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black/5 border border-black/[0.06]">
      <img src={url} alt={file.name} className="h-full w-full object-cover" />
    </div>
  );
}

function AttachmentCard({
  attachment,
  token,
  isOwn,
}: {
  attachment: SupportAttachment;
  token: string;
  isOwn?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const isImg = isImageAttachment(attachment);
  const fileUrl = attachment.fileUrl || attachment.url;

  const handleClick = async () => {
    setDownloading(true);
    try {
      await downloadAndOpenAttachment(token, attachment);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={cn(
        'group flex flex-col gap-1.5 rounded-md border p-2.5 transition-all text-xs',
        isOwn
          ? 'border-white/20 bg-white/10 hover:bg-white/20 text-white'
          : 'border-black/[0.08] bg-[#F5F5F7] hover:bg-[#EBEBEF] text-[#1D1D1F]'
      )}
    >
      {isImg && fileUrl && (
        <div
          onClick={handleClick}
          className="relative max-h-40 w-full overflow-hidden rounded-lg bg-black/5 cursor-pointer"
        >
          <img
            src={fileUrl}
            alt={attachment.fileName}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isImg ? (
            <ImageIcon className={cn('h-4 w-4 shrink-0', isOwn ? 'text-white' : 'text-[#007AFF]')} />
          ) : (
            <FileText className={cn('h-4 w-4 shrink-0', isOwn ? 'text-white' : 'text-[#6E6E73]')} />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-[11px] leading-tight">{attachment.fileName}</p>
            {attachment.fileSize || attachment.size ? (
              <p className={cn('text-[10px]', isOwn ? 'text-white/70' : 'text-[#8E8E93]')}>
                {formatFileSize(attachment.fileSize || attachment.size)}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={handleClick}
          disabled={downloading}
          className={cn(
            'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition disabled:opacity-50',
            isOwn ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-white hover:bg-black/5 text-[#007AFF] shadow-2xs'
          )}
          title="Download attachment"
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function TicketWorkspace({ mode, viewer }: SupportWorkspaceProps) {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | number | null>(null);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<SupportTicket | null>(null);
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<SupportConnectionState>('connecting');
  const [composer, setComposer] = useState('');
  const [composerFiles, setComposerFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);

  // Modal Fields
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Payment');
  const [priority, setPriority] = useState('P2');
  const [bookingIdInput, setBookingIdInput] = useState<string>('');
  const [assignedTeamInput, setAssignedTeamInput] = useState('Payments');
  const [openingMessage, setOpeningMessage] = useState('');
  const [openingFiles, setOpeningFiles] = useState<File[]>([]);
  const [customerUserId, setCustomerUserId] = useState<string>('4');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDraggingModal, setIsDraggingModal] = useState(false);

  // Action input reasons and modal errors
  const [reassignTeam, setReassignTeam] = useState('Payments');
  const [reassignReason, setReassignReason] = useState('Escalated to finance desk');
  const [reassignModalError, setReassignModalError] = useState<string | null>(null);

  const [transitionStatus, setTransitionStatus] = useState('InProgress');
  const [transitionReason, setTransitionReason] = useState('Beginning operational investigation');
  const [transitionModalError, setTransitionModalError] = useState<string | null>(null);

  const [closeReason, setCloseReason] = useState('Refund initiated and issue resolved');
  const [closeModalError, setCloseModalError] = useState<string | null>(null);

  const [reopenReason, setReopenReason] = useState('Credit not received yet in wallet');
  const [reopenModalError, setReopenModalError] = useState<string | null>(null);

  const [linkIncidentOpen, setLinkIncidentOpen] = useState(false);
  const [linkIncidentId, setLinkIncidentId] = useState('');
  const [linkIncidentError, setLinkIncidentError] = useState<string | null>(null);

  const [linkDisputeOpen, setLinkDisputeOpen] = useState(false);
  const [linkDisputeId, setLinkDisputeId] = useState('');
  const [linkDisputeError, setLinkDisputeError] = useState<string | null>(null);

  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const filterArg = statusFilter === 'All' ? undefined : statusFilter;
      const result = await listSupportTickets(viewer, filterArg, search);
      setTickets(result);
      setSelectedTicketId((current) =>
        current && result.some((ticket) => String(ticket.ticketId) === String(current))
          ? current
          : result[0]?.ticketId ?? null
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load support tickets.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, statusFilter, viewer]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTickets(), search.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadTickets, search]);

  useEffect(() => {
    if (!viewer.token || !selectedTicketId) {
      setSelectedTicketDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);

    getSupportTicketDetails(viewer, selectedTicketId)
      .then((detail) => {
        if (active) setSelectedTicketDetail(detail);
      })
      .catch(() => {
        const fallback = tickets.find((t) => String(t.ticketId) === String(selectedTicketId));
        if (active && fallback) setSelectedTicketDetail(fallback);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedTicketId, viewer, tickets]);

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

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedTicketDetail?.messages?.length]);

  const validateFiles = (current: File[], incoming: File[]) => {
    const validSize = incoming.filter((file) => file.size <= MAX_ATTACHMENT_SIZE);
    let errorMsg: string | null = null;
    if (validSize.length !== incoming.length) {
      errorMsg = 'Each attachment must be 10 MB or smaller.';
    } else if (current.length + validSize.length > MAX_ATTACHMENT_COUNT) {
      errorMsg = `A maximum of ${MAX_ATTACHMENT_COUNT} attachments is allowed.`;
    }
    const merged = [...current, ...validSize].slice(0, MAX_ATTACHMENT_COUNT);
    return { files: merged, error: errorMsg };
  };

  const handleOpeningFilesChange = (incoming: File[]) => {
    if (!incoming || incoming.length === 0) return;
    const result = validateFiles(openingFiles, incoming);
    setOpeningFiles(result.files);
    if (result.error) {
      setFormError(result.error);
    } else {
      setFormError(null);
    }
  };

  const handleComposerFilesChange = (incoming: File[]) => {
    if (!incoming || incoming.length === 0) return;
    const result = validateFiles(composerFiles, incoming);
    setComposerFiles(result.files);
    if (result.error) {
      setError(result.error);
    }
  };

  const handleSend = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selectedTicketDetail || (!composer.trim() && composerFiles.length === 0) || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendSupportMessage(viewer, selectedTicketDetail.ticketId, composer || 'Attachment uploaded.', composerFiles);
      setComposer('');
      setComposerFiles([]);
      const updated = await getSupportTicketDetails(viewer, selectedTicketDetail.ticketId);
      setSelectedTicketDetail(updated);
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
    if (!selectedTicketDetail || actionLoading) return;
    setActionLoading(true);
    try {
      const updated = await acceptSupportTicket(viewer, selectedTicketDetail.ticketId);
      setSelectedTicketDetail(updated);
      await loadTickets(true);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to accept this ticket.');
    } finally {
      setActionLoading(false);
    }
  };

  const openTransitionModal = () => {
    const current = selectedTicketDetail?.status;
    if (current === 'InProgress') {
      setTransitionStatus('WaitingForCustomer');
      setTransitionReason('Waiting for customer response / proof document');
    } else if (current === 'WaitingForCustomer') {
      setTransitionStatus('InProgress');
      setTransitionReason('Customer provided details; continuing investigation');
    } else {
      setTransitionStatus('InProgress');
      setTransitionReason('Beginning operational triage and investigation');
    }
    setTransitionModalError(null);
    setTransitionOpen(true);
  };

  const handleReassign = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTicketDetail || actionLoading) return;
    setActionLoading(true);
    setReassignModalError(null);
    try {
      const updated = await reassignSupportTicket(viewer, selectedTicketDetail.ticketId, {
        assignedTeam: reassignTeam,
        reason: reassignReason,
      });
      setSelectedTicketDetail(updated);
      setReassignOpen(false);
      await loadTickets(true);
    } catch (actionError) {
      setReassignModalError(actionError instanceof Error ? actionError.message : 'Unable to reassign ticket.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransition = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTicketDetail || actionLoading) return;
    setActionLoading(true);
    setTransitionModalError(null);
    try {
      const updated = await transitionSupportTicketStatus(viewer, selectedTicketDetail.ticketId, {
        toStatus: transitionStatus,
        reason: transitionReason,
      });
      setSelectedTicketDetail(updated);
      setTransitionOpen(false);
      await loadTickets(true);
    } catch (actionError) {
      setTransitionModalError(actionError instanceof Error ? actionError.message : 'Unable to update status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTicketDetail || actionLoading) return;
    setActionLoading(true);
    setCloseModalError(null);
    try {
      const updated = await closeSupportTicket(viewer, selectedTicketDetail.ticketId, { reason: closeReason });
      setSelectedTicketDetail(updated);
      setCloseModalOpen(false);
      await loadTickets(true);
    } catch (actionError) {
      setCloseModalError(actionError instanceof Error ? actionError.message : 'Unable to close this ticket.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTicketDetail || actionLoading) return;
    setActionLoading(true);
    setReopenModalError(null);
    try {
      const updated = await reopenSupportTicket(viewer, selectedTicketDetail.ticketId, { reason: reopenReason });
      setSelectedTicketDetail(updated);
      setReopenModalOpen(false);
      await loadTickets(true);
    } catch (actionError) {
      setReopenModalError(actionError instanceof Error ? actionError.message : 'Unable to reopen ticket.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLinkIncident = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTicketDetail || !linkIncidentId.trim() || actionLoading) return;
    setActionLoading(true);
    setLinkIncidentError(null);
    try {
      const ticketRef = selectedTicketDetail.ticketReference || selectedTicketDetail.ticketId;
      const incRef = linkIncidentId.trim();
      const updated = await linkTicketToIncident(viewer, ticketRef, incRef);
      setSelectedTicketDetail(updated);
      setLinkIncidentOpen(false);
      setLinkIncidentId('');
      await loadTickets(true);
    } catch (err) {
      setLinkIncidentError(err instanceof Error ? err.message : 'Unable to link ticket to incident.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLinkDispute = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTicketDetail || !linkDisputeId.trim() || actionLoading) return;
    setActionLoading(true);
    setLinkDisputeError(null);
    try {
      const ticketRef = selectedTicketDetail.ticketReference || selectedTicketDetail.ticketId;
      const dspRef = linkDisputeId.trim();
      const updated = await linkTicketToDispute(viewer, ticketRef, dspRef);
      setSelectedTicketDetail(updated);
      setLinkDisputeOpen(false);
      setLinkDisputeId('');
      await loadTickets(true);
    } catch (err) {
      setLinkDisputeError(err instanceof Error ? err.message : 'Unable to link ticket to dispute.');
    } finally {
      setActionLoading(false);
    }
  };

  const resetCreateForm = () => {
    setSubject('');
    setCategory('Payment');
    setPriority('P2');
    setBookingIdInput('');
    setAssignedTeamInput('Payments');
    setOpeningMessage('');
    setOpeningFiles([]);
    setCustomerUserId('4');
    setFormError(null);
    setIsDraggingModal(false);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !openingMessage.trim()) {
      setFormError('Please enter a subject and detailed description.');
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const ticket = mode === 'admin'
        ? await createAdminSupportTicket(viewer, {
            customerUserId: Number(customerUserId) || 1,
            subject: subject.trim(),
            message: openingMessage.trim(),
            category,
            priority,
            assignedTeam: assignedTeamInput,
            files: openingFiles,
          })
        : await createSupportTicket(viewer, {
            subject: subject.trim(),
            message: openingMessage.trim(),
            category,
            priority,
            bookingId: bookingIdInput ? Number(bookingIdInput) : undefined,
            files: openingFiles,
          });

      resetCreateForm();
      setCreateOpen(false);
      setSelectedTicketId(ticket.ticketId);
      setSelectedTicketDetail(ticket);
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

  // Extract all ticket attachments (merging ticket level and messages attachments)
  const ticketAttachments = useMemo(() => {
    if (!selectedTicketDetail) return [];
    const map = new Map<string, SupportAttachment>();
    (selectedTicketDetail.attachments || []).forEach((att) => {
      map.set(String(att.attachmentId || att.fileName), att);
    });
    (selectedTicketDetail.messages || []).forEach((msg) => {
      (msg.attachments || []).forEach((att) => {
        map.set(String(att.attachmentId || att.fileName), att);
      });
    });
    return Array.from(map.values());
  }, [selectedTicketDetail]);

  return (
    <div className="space-y-4" data-component="ticket-workspace">
      {/* ── Top Bar / Header ── */}
      <section className="border-b border-black/[0.06] bg-white px-4 py-2.5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#F5F5F7] text-[#007AFF]">
              <LifeBuoy className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#0F172A] sm:text-base">
                  {mode === 'admin' ? 'Support Ticket Workspace' : 'My Support Tickets'}
                </h2>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-semibold text-[#64748B]">
                  {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
                </span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                {mode === 'admin'
                  ? 'Manage incoming customer inquiries, assign teams, and transition resolution stages.'
                  : 'Track ongoing support requests, upload proof documents, and chat with specialists.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={cn('inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition-colors', connection.badge)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', connection.dot)} />
              <ConnectionIcon className="h-3 w-3" />
              <span>{connection.label}</span>
            </div>

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md bg-[#007AFF] px-3.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#0066D6] active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{mode === 'admin' ? 'Create Custom Ticket' : 'New Ticket'}</span>
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-center gap-2.5 rounded-md border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-xs text-rose-700 shadow-sm">
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

      {/* ── Main Split View (Locked to Screen Height) ── */}
      <section className="overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.03)] lg:grid lg:h-[calc(100vh-175px)] lg:min-h-[580px] lg:grid-cols-[330px_minmax(0,1fr)]">
        {/* Left Pane: Ticket Queue & Filters */}
        <div className={cn('h-full flex-col min-h-0 border-r border-black/[0.06] bg-white', mobileConversationOpen ? 'hidden lg:flex' : 'flex')}>
          {/* Status filter dropdown & Search */}
          <div className="shrink-0 border-b border-black/[0.06] p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[#8E8E93]" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ticket #, subject, sender..."
                className="min-h-9 w-full rounded-md border border-black/[0.08] bg-[#F5F5F7]/80 pl-9 pr-8 text-xs text-[#1D1D1F] placeholder:text-[#8E8E93] outline-none transition focus:border-[#007AFF] focus:bg-white focus:ring-2 focus:ring-[#007AFF]/10"
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

            <div className="flex items-center gap-2">
              <label htmlFor="ticket-status-filter" className="text-[11px] font-bold text-[#6E6E73] shrink-0">Status:</label>
              <div className="relative flex-1">
                <select
                  id="ticket-status-filter"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setMobileConversationOpen(false);
                  }}
                  className="min-h-8 w-full cursor-pointer appearance-none rounded-md border border-black/[0.08] bg-[#F5F5F7] pl-3 pr-8 text-xs font-semibold text-[#1D1D1F] outline-none hover:bg-white focus:border-[#007AFF] focus:bg-white transition"
                >
                  <option value="All">All Statuses ({tickets.length})</option>
                  <option value="New">New</option>
                  <option value="Assigned">Assigned</option>
                  <option value="InProgress">In Progress</option>
                  <option value="WaitingForCustomer">Waiting for Customer</option>
                  <option value="Closed">Closed</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[#8E8E93]" />
              </div>
            </div>
          </div>

          {/* Ticket List Stream */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5">
            {loading ? (
              <div className="flex h-52 flex-col items-center justify-center gap-2 text-xs text-[#6E6E73]">
                <Loader2 className="h-5 w-5 animate-spin text-[#007AFF]" />
                <span>Loading support tickets...</span>
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#F5F5F7] text-[#8E8E93]">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <p className="mt-3 text-xs font-bold text-[#1D1D1F]">
                  No tickets found
                </p>
                <p className="mt-1 text-[11px] text-[#6E6E73] max-w-[220px]">
                  {search
                    ? 'No tickets match your search keyword.'
                    : mode === 'admin'
                    ? 'New customer inquiries will show up here.'
                    : 'Whenever you need assistance, click New Ticket.'}
                </p>
              </div>
            ) : (
              tickets.map((ticket) => {
                const isSelected = String(selectedTicketId) === String(ticket.ticketId);
                const lastMessage = ticket.messages?.at(-1);
                const meta = statusMeta[ticket.status] || statusMeta.New;

                return (
                  <button
                    key={ticket.ticketId}
                    type="button"
                    onClick={() => {
                      setSelectedTicketId(ticket.ticketId);
                      setMobileConversationOpen(true);
                    }}
                    className={cn(
                      'group relative w-full cursor-pointer rounded-md border p-3 text-left transition-all',
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

                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#6E6E73]">
                      <span className="font-medium text-[#1D1D1F] truncate">{ticket.customerName}</span>
                      <span>·</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-[#6E6E73]">{ticket.category}</span>
                      {ticket.priority && (
                        <span className="rounded bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-700 border border-rose-200">
                          {ticket.priority}
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-[#8E8E93]">
                      <p className="line-clamp-1 flex-1">
                        {lastMessage?.message || lastMessage?.body || ticket.description || 'Support ticket logged'}
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
        <div className={cn('h-full flex-col min-h-0 bg-[#FAFBFD] overflow-hidden', mobileConversationOpen ? 'flex' : 'hidden lg:flex')}>
          {!selectedTicketDetail ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white shadow-xs border border-black/[0.04] text-[#8E8E93]">
                <MessageSquare className="h-7 w-7 text-[#007AFF]/60" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-[#1D1D1F]">No Ticket Selected</h3>
              <p className="mt-1 text-xs text-[#6E6E73] max-w-xs">
                Select a ticket from the left panel to review discussion history, attachments, and respond in real-time.
              </p>
            </div>
          ) : (
            <>
              {/* Ticket Detail Top Header (Compact & Separated Functions) */}
              <header className="shrink-0 border-b border-black/[0.06] bg-white px-4 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Left: Ticket Identity & Primary Status */}
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMobileConversationOpen(false)}
                      className="cursor-pointer rounded-md p-1.5 text-[#0F172A] hover:bg-[#F1F5F9] lg:hidden min-h-[32px] min-w-[32px] flex items-center justify-center shrink-0 border border-black/[0.06]"
                      aria-label="Back to ticket list"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>

                    <span className="font-mono text-xs font-bold text-[#007AFF] shrink-0">
                      {selectedTicketDetail.ticketReference}
                    </span>

                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0', statusMeta[selectedTicketDetail.status]?.badge || statusMeta.New.badge)}>
                      {statusMeta[selectedTicketDetail.status]?.label || selectedTicketDetail.status}
                    </span>

                    {selectedTicketDetail.priority && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-mono font-medium text-slate-600 border border-slate-200 shrink-0">
                        {selectedTicketDetail.priority}
                      </span>
                    )}

                    <span className="text-slate-200 hidden sm:inline">|</span>

                    <h3 className="truncate text-xs font-bold text-[#0F172A] hidden sm:block max-w-xs md:max-w-sm lg:max-w-md">
                      {selectedTicketDetail.subject}
                    </h3>
                  </div>

                  {/* Right: Clean Function Toolbar (Separated from Status) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Details / Info Toggle (Hides details unless requested) */}
                    <button
                      type="button"
                      onClick={() => setShowDetails(!showDetails)}
                      className={cn(
                        'inline-flex min-h-[30px] cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition select-none',
                        showDetails
                          ? 'border-[#007AFF] bg-blue-50/80 text-[#007AFF]'
                          : 'border-black/[0.08] bg-white text-[#475569] hover:bg-slate-50 hover:text-[#0F172A]'
                      )}
                      title={showDetails ? 'Hide ticket details' : 'View full ticket metadata'}
                    >
                      <Info className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{showDetails ? 'Hide Info' : 'Ticket Info'}</span>
                      {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {/* Prominent Accept action if New (Admin) */}
                    {mode === 'admin' && selectedTicketDetail.status === 'New' && (
                      <button
                        type="button"
                        onClick={handleAccept}
                        disabled={actionLoading}
                        className="inline-flex min-h-[30px] cursor-pointer items-center gap-1 rounded-lg bg-[#007AFF] px-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0066D6] disabled:opacity-50"
                      >
                        {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                        <span>Accept</span>
                      </button>
                    )}

                    {/* Prominent Reopen action if Closed (User) */}
                    {mode === 'user' && selectedTicketDetail.status === 'Closed' && (
                      <button
                        type="button"
                        onClick={() => setReopenModalOpen(true)}
                        className="inline-flex min-h-[30px] cursor-pointer items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-2.5 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 shadow-2xs"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reopen</span>
                      </button>
                    )}

                    {/* Audit Trail toggle */}
                    <button
                      type="button"
                      onClick={() => setShowTimeline(!showTimeline)}
                      className={cn(
                        'inline-flex min-h-[30px] cursor-pointer items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition',
                        showTimeline ? 'border-[#007AFF] bg-blue-50 text-[#007AFF]' : 'border-black/[0.08] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                      )}
                      title="Toggle audit trail history"
                    >
                      <History className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Audit</span>
                    </button>

                    {/* Admin Actions Dropdown Menu */}
                    {mode === 'admin' && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActionMenuOpen(!actionMenuOpen)}
                          className={cn(
                            'inline-flex min-h-[30px] cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition shadow-2xs',
                            actionMenuOpen ? 'border-[#007AFF] bg-blue-50 text-[#007AFF]' : 'border-black/[0.08] bg-white text-[#0F172A] hover:bg-slate-50'
                          )}
                          aria-expanded={actionMenuOpen}
                        >
                          <Wrench className="h-3.5 w-3.5 text-[#007AFF]" />
                          <span>Actions</span>
                          <ChevronDown className="h-3 w-3 text-slate-400" />
                        </button>

                        {actionMenuOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setActionMenuOpen(false)}
                            />
                            <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-md border border-black/[0.08] bg-white p-1 shadow-lg divide-y divide-black/[0.04] text-xs">
                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionMenuOpen(false);
                                    openTransitionModal();
                                  }}
                                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium text-[#334155] hover:bg-slate-50 hover:text-[#007AFF] cursor-pointer"
                                >
                                  <RefreshCw className="h-3.5 w-3.5 text-[#007AFF]" />
                                  <span>Transition Status...</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionMenuOpen(false);
                                    setReassignOpen(true);
                                  }}
                                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium text-[#334155] hover:bg-slate-50 hover:text-[#007AFF] cursor-pointer"
                                >
                                  <Users className="h-3.5 w-3.5 text-[#007AFF]" />
                                  <span>Reassign Team & Admin...</span>
                                </button>
                              </div>

                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionMenuOpen(false);
                                    setLinkIncidentOpen(true);
                                  }}
                                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium text-[#334155] hover:bg-slate-50 hover:text-[#007AFF] cursor-pointer"
                                >
                                  <Siren className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Link Incident...</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionMenuOpen(false);
                                    setLinkDisputeOpen(true);
                                  }}
                                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium text-[#334155] hover:bg-slate-50 hover:text-[#007AFF] cursor-pointer"
                                >
                                  <ShieldAlert className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Link Dispute...</span>
                                </button>
                              </div>

                              {selectedTicketDetail.status !== 'Closed' && (
                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionMenuOpen(false);
                                      setCloseModalOpen(true);
                                    }}
                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 text-rose-600" />
                                    <span>Close Ticket...</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </header>

              {/* Collapsible Ticket Details Drawer (Hidden unless user requests it) */}
              {showDetails && (
                <div className="shrink-0 border-b border-black/[0.06] bg-[#F8FAFC] p-3.5 text-xs transition-all animate-in fade-in duration-150">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Ticket Metadata & Linked Records</span>
                    <button
                      type="button"
                      onClick={() => setShowDetails(false)}
                      className="text-[11px] text-[#64748B] hover:text-[#0F172A] font-medium cursor-pointer"
                    >
                      Hide Info ▴
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Card 1: Customer & Assignment */}
                    <div className="rounded-md border border-black/[0.05] bg-white p-3 space-y-1.5 shadow-2xs">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#8E8E93]">Assignment & Contact</p>
                      <div>
                        <span className="text-[10px] text-[#64748B]">Customer: </span>
                        <span className="font-semibold text-[#0F172A]">
                          {selectedTicketDetail.customerName} ({selectedTicketDetail.customerRole || 'Renter'})
                        </span>
                      </div>
                      {selectedTicketDetail.customerEmail && (
                        <p className="text-[11px] text-[#64748B] truncate">{selectedTicketDetail.customerEmail}</p>
                      )}
                      <div className="pt-1 border-t border-black/[0.03]">
                        <span className="text-[10px] text-[#64748B]">Assigned Team: </span>
                        <span className="font-semibold text-[#0F172A]">{selectedTicketDetail.assignedTeam || 'CustomerSupport'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B]">Assigned Admin: </span>
                        <span className="font-semibold text-[#0F172A]">{selectedTicketDetail.assignedAdminName || 'Unassigned'}</span>
                      </div>
                    </div>

                    {/* Card 2: Linked Records & Category */}
                    <div className="rounded-md border border-black/[0.05] bg-white p-3 space-y-1.5 shadow-2xs">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#8E8E93]">Linked Records</p>
                      <div>
                        <span className="text-[10px] text-[#64748B]">Category: </span>
                        <span className="font-semibold text-[#0F172A]">{selectedTicketDetail.category || 'General'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[#64748B]">Incident: </span>
                        {selectedTicketDetail.incidentReference ? (
                          <span className="font-mono font-semibold text-[#007AFF] bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200/60 text-[10px]">
                            {selectedTicketDetail.incidentReference}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#94A3B8]">None linked</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[#64748B]">Dispute: </span>
                        {selectedTicketDetail.disputeReference ? (
                          <span className="font-mono font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/60 text-[10px]">
                            {selectedTicketDetail.disputeReference}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#94A3B8]">None linked</span>
                        )}
                      </div>
                      {selectedTicketDetail.bookingId && (
                        <div className="pt-1 border-t border-black/[0.03]">
                          <span className="text-[10px] text-[#64748B]">Booking: </span>
                          <span className="font-mono font-semibold text-[#0F172A]">#{selectedTicketDetail.bookingId}</span>
                        </div>
                      )}
                    </div>

                    {/* Card 3: SLA & Attachments */}
                    <div className="rounded-md border border-black/[0.05] bg-white p-3 space-y-1.5 shadow-2xs">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#8E8E93]">SLA & Attachments</p>
                      <div>
                        <span className="text-[10px] text-[#64748B]">Resolution SLA: </span>
                        <span className="font-medium text-[#0F172A]">
                          {selectedTicketDetail.resolutionDueAt ? formatDate(selectedTicketDetail.resolutionDueAt) : 'Standard'}
                        </span>
                      </div>
                      <div className="pt-1 border-t border-black/[0.03]">
                        <span className="text-[10px] text-[#64748B] block mb-1">
                          Attachments ({ticketAttachments.length}):
                        </span>
                        {ticketAttachments.length === 0 ? (
                          <span className="text-[11px] text-[#94A3B8]">No files attached</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {ticketAttachments.map((att) => (
                              <button
                                key={att.attachmentId}
                                type="button"
                                onClick={() => void downloadAndOpenAttachment(viewer.token, att)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-black/[0.06] bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-[#334155] hover:bg-slate-100 hover:text-[#007AFF] transition"
                                title={`${att.fileName} (${formatFileSize(att.size || att.fileSize)})`}
                              >
                                <FileText className="h-2.5 w-2.5 text-[#007AFF]" />
                                <span className="truncate max-w-[120px]">{att.fileName}</span>
                                <Download className="h-2.5 w-2.5 text-slate-400" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Message Chat Feed / Audit Timeline */}
              <div className="flex-1 min-h-0 space-y-3 overflow-y-auto p-3 sm:p-4">
                {showTimeline ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-black/[0.06] pb-2">
                      <h4 className="text-xs font-bold text-[#1D1D1F]">Full Ticket Audit History</h4>
                      <span className="text-[10px] text-[#8E8E93]">
                        {selectedTicketDetail.auditTimeline?.length || 0} lifecycle events
                      </span>
                    </div>
                    {(!selectedTicketDetail.auditTimeline || selectedTicketDetail.auditTimeline.length === 0) ? (
                      <p className="text-xs text-[#8E8E93] text-center py-6">No audit timeline recorded.</p>
                    ) : (
                      <div className="relative border-l-2 border-slate-200 ml-3 space-y-4 pl-4 text-xs">
                        {selectedTicketDetail.auditTimeline.map((ev, idx) => (
                          <div key={idx} className="relative">
                            <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#007AFF] ring-4 ring-white" />
                            <div className="rounded-md border border-black/[0.06] bg-white p-3 shadow-2xs">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-bold text-[#007AFF]">{ev.action}</span>
                                <span className="text-[#8E8E93]">{formatDate(ev.timestamp)}</span>
                              </div>
                              <p className="font-semibold text-[#1D1D1F] mt-1 text-[11px]">{ev.detail}</p>
                              <div className="mt-1 flex items-center gap-1 text-[9px] text-[#8E8E93]">
                                <span>Actor: {ev.actorName} ({ev.actorRole})</span>
                                {ev.newState && <span>· State: {ev.newState}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {selectedTicketDetail.messages?.map((message) => {
                      const isOwn = message.senderUserId === viewer.userId && message.messageType !== 'System';
                      const isSystem = message.messageType === 'System';

                      if (isSystem) {
                        return (
                          <div key={message.messageId} className="my-2 flex justify-center">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.04] bg-white px-3 py-1 text-[10px] font-medium text-[#6E6E73] shadow-xs">
                              <CheckCircle2 className="h-3 w-3 text-[#34C759]" />
                              {message.message || message.body}
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
                                'rounded-lg px-4 py-3 text-left text-xs leading-relaxed shadow-sm space-y-2',
                                isOwn
                                  ? 'rounded-br-sm bg-[#007AFF] text-white'
                                  : 'rounded-bl-sm border border-black/[0.06] bg-white text-[#1D1D1F]'
                              )}
                            >
                              {(message.message || message.body) && (
                                <p className="whitespace-pre-wrap">{message.message || message.body}</p>
                              )}

                              {message.attachments && message.attachments.length > 0 && (
                                <div className={cn('mt-2.5 space-y-1.5', (message.message || message.body) && 'border-t pt-2.5', isOwn ? 'border-white/20' : 'border-black/[0.06]')}>
                                  {message.attachments.map((attachment) => (
                                    <AttachmentCard
                                      key={attachment.attachmentId}
                                      attachment={attachment}
                                      token={viewer.token}
                                      isOwn={isOwn}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
                <div ref={messageEndRef} />
              </div>

              {/* Bottom Composer / Action Area */}
              {selectedTicketDetail.status === 'Closed' ? (
                <div className="shrink-0 border-t border-black/[0.06] bg-white p-3 text-center space-y-1.5">
                  <p className="text-xs font-bold text-[#1D1D1F]">This ticket has been resolved and closed</p>
                  <p className="text-[11px] text-[#6E6E73]">
                    If your issue persists, you can click Reopen Ticket to resume conversation with our team.
                  </p>
                  {mode === 'user' && (
                    <button
                      type="button"
                      onClick={() => setReopenModalOpen(true)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#007AFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reopen Ticket</span>
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSend} className="shrink-0 border-t border-black/[0.06] bg-white p-2.5 sm:p-3">
                  {composerFiles.length > 0 && (
                    <div className="mb-2.5 flex flex-wrap gap-2">
                      {composerFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${index}-${file.lastModified}`}
                          className="inline-flex items-center gap-2 rounded-md border border-black/[0.08] bg-[#F5F5F7] px-2.5 py-1.5 text-[11px] font-medium text-[#1D1D1F] shadow-2xs"
                        >
                          {isImageFile(file) ? (
                            <FileImageThumbnail file={file} />
                          ) : (
                            <FileText className="h-4 w-4 text-[#007AFF] shrink-0" />
                          )}
                          <div className="min-w-0 max-w-[150px]">
                            <p className="truncate leading-tight font-semibold text-[11px]">{file.name}</p>
                            <p className="text-[9px] text-[#8E8E93]">{formatFileSize(file.size)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setComposerFiles((curr) => curr.filter((_, i) => i !== index))}
                            aria-label={`Remove file ${file.name}`}
                            className="cursor-pointer rounded-md p-1 text-[#8E8E93] hover:bg-rose-100 hover:text-rose-600 transition"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-black/[0.08] text-[#6E6E73] transition-colors hover:border-[#007AFF] hover:bg-blue-50/50 hover:text-[#007AFF]"
                      title="Attach documents or screenshots"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      id="composer-file-input"
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={(event) => {
                        const selected = Array.from(event.target.files || []);
                        handleComposerFilesChange(selected);
                        event.target.value = '';
                      }}
                    />

                    <textarea
                      rows={1}
                      value={composer}
                      onChange={(event) => setComposer(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message... (Press Enter to send, Shift+Enter for new line)"
                      className="min-h-10 flex-1 resize-none rounded-md border border-black/[0.08] bg-[#F5F5F7]/80 px-3.5 py-2.5 text-xs text-[#1D1D1F] placeholder:text-[#8E8E93] outline-none transition focus:border-[#007AFF] focus:bg-white focus:ring-2 focus:ring-[#007AFF]/10"
                    />

                    <button
                      type="submit"
                      disabled={sending || (!composer.trim() && composerFiles.length === 0)}
                      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md bg-[#007AFF] text-white shadow-sm transition hover:bg-[#0066D6] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Send message"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>

                  <p className="mt-2 text-[10px] text-[#8E8E93]">
                    Up to 5 files (Images, PDF, Documents) · Max 10 MB each
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
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-lg border border-black/[0.08]">
            <div className="flex items-center justify-between border-b border-black/[0.06] p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-[#007AFF]">
                  <Plus className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-[#1D1D1F]">
                    {mode === 'admin' ? 'Create Custom Ticket' : 'Create Support Ticket'}
                  </h3>
                  <p className="text-[11px] text-[#6E6E73]">
                    {mode === 'admin'
                      ? 'Manually log and assign a support ticket to an operational team.'
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
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 p-4 sm:p-6 text-xs">
              {mode === 'admin' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Customer User ID *</span>
                    <input
                      type="number"
                      value={customerUserId}
                      onChange={(e) => setCustomerUserId(e.target.value)}
                      required
                      placeholder="e.g. 4"
                      className="min-h-10 w-full rounded-md border border-black/[0.08] px-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Assigned Team</span>
                    <select
                      value={assignedTeamInput}
                      onChange={(e) => setAssignedTeamInput(e.target.value)}
                      className="min-h-10 w-full rounded-md border border-black/[0.08] bg-white px-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                    >
                      <option value="Payments">Payments</option>
                      <option value="ParkingOperations">Parking Operations</option>
                      <option value="CustomerSupport">Customer Support</option>
                      <option value="OwnerSupport">Owner Support</option>
                      <option value="TrustSafety">Trust & Safety</option>
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
                  placeholder="e.g. Double charged for Booking #101"
                  className="min-h-10 w-full rounded-md border border-black/[0.08] px-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Category</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="min-h-10 w-full rounded-md border border-black/[0.08] bg-white px-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                  >
                    <option value="Payment">Payment</option>
                    <option value="ParkingAccess">Parking Access</option>
                    <option value="Booking">Booking</option>
                    <option value="General">General</option>
                    <option value="Account">Account</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Priority</span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="min-h-10 w-full rounded-md border border-black/[0.08] bg-white px-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                  >
                    <option value="P0">P0 - Emergency</option>
                    <option value="P1">P1 - High</option>
                    <option value="P2">P2 - Standard</option>
                    <option value="P3">P3 - Low</option>
                  </select>
                </label>
              </div>

              {mode === 'user' && (
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Booking ID (Optional)</span>
                  <input
                    type="number"
                    value={bookingIdInput}
                    onChange={(e) => setBookingIdInput(e.target.value)}
                    placeholder="e.g. 4"
                    className="min-h-10 w-full rounded-md border border-black/[0.08] px-3 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                  />
                </label>
              )}

              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">Detailed Explanation *</span>
                <textarea
                  value={openingMessage}
                  onChange={(event) => setOpeningMessage(event.target.value)}
                  rows={4}
                  maxLength={2000}
                  required
                  placeholder="Explain the issue in detail..."
                  className="w-full resize-none rounded-md border border-black/[0.08] p-3 text-xs leading-relaxed text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                />
              </label>

              {/* Attachment Box with Drag & Drop & Direct File Click */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">
                    Attachments (Optional)
                  </span>
                  {openingFiles.length > 0 && (
                    <span className="text-[10px] font-medium text-[#007AFF]">
                      {openingFiles.length} of {MAX_ATTACHMENT_COUNT} selected
                    </span>
                  )}
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingModal(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingModal(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingModal(false);
                    const dropped = Array.from(e.dataTransfer.files || []);
                    handleOpeningFilesChange(dropped);
                  }}
                  onClick={() => modalFileInputRef.current?.click()}
                  className={cn(
                    'mt-1 flex min-h-22 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-4 text-center transition-all',
                    isDraggingModal
                      ? 'border-[#007AFF] bg-blue-50/80 scale-[1.01]'
                      : 'border-black/[0.12] bg-[#F5F5F7]/70 hover:border-[#007AFF] hover:bg-blue-50/40'
                  )}
                >
                  <UploadCloud className={cn('h-6 w-6 transition-colors', isDraggingModal ? 'text-[#007AFF]' : 'text-[#8E8E93]')} />
                  <span className="mt-1.5 text-xs font-semibold text-[#1D1D1F]">
                    {isDraggingModal ? 'Drop files here' : 'Add screenshots or PDF receipts'}
                  </span>
                  <span className="mt-0.5 text-[10px] text-[#8E8E93]">
                    Click to browse or drag & drop · Up to 5 files · Max 10 MB each
                  </span>
                  <input
                    ref={modalFileInputRef}
                    id="modal-attachment-input"
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      const selected = Array.from(event.target.files || []);
                      handleOpeningFilesChange(selected);
                      event.target.value = '';
                    }}
                  />
                </div>

                {/* Attached Files List in Modal */}
                {openingFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#1D1D1F]">
                        Ready to Upload ({openingFiles.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpeningFiles([])}
                        className="cursor-pointer text-[#8E8E93] hover:text-rose-600 transition-colors font-medium text-[10px]"
                      >
                        Remove all
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {openingFiles.map((file, index) => {
                        const isImage = isImageFile(file);
                        return (
                          <div
                            key={`${file.name}-${index}-${file.lastModified}`}
                            className="flex items-center gap-2.5 rounded-md border border-black/[0.08] bg-[#F5F5F7] p-2 text-xs text-[#1D1D1F] transition-all hover:bg-[#EBEBEF]"
                          >
                            {isImage ? (
                              <FileImageThumbnail file={file} />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white border border-black/[0.06] text-[#007AFF]">
                                <FileText className="h-5 w-5" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-[11px] leading-tight text-[#1D1D1F]">{file.name}</p>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#8E8E93]">
                                <span>{formatFileSize(file.size)}</span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Attached
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setOpeningFiles((curr) => curr.filter((_, i) => i !== index))}
                              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#8E8E93] hover:bg-rose-100 hover:text-rose-600 transition"
                              title={`Remove ${file.name}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {formError && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-700">
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
                  className="cursor-pointer min-h-10 rounded-md border border-black/[0.08] px-4 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md bg-[#007AFF] px-5 text-xs font-semibold text-white shadow-sm hover:bg-[#0066D6] disabled:opacity-50"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span>{creating ? 'Creating...' : 'Submit Ticket'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reassign Modal (Admin) ── */}
      {reassignOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#007AFF]" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Reassign Support Ticket</h3>
              </div>
              <button type="button" onClick={() => setReassignOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleReassign} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Target Department / Team *</label>
                <select
                  value={reassignTeam}
                  onChange={(e) => setReassignTeam(e.target.value)}
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF]"
                >
                  <option value="Payments">Payments & Finance</option>
                  <option value="ParkingOperations">Parking Operations</option>
                  <option value="CustomerSupport">Customer Support</option>
                  <option value="OwnerSupport">Owner Support</option>
                  <option value="TrustSafety">Trust & Safety</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Reassignment Reason *</label>
                <textarea
                  rows={3}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  required
                  placeholder="Explain why this ticket is being reassigned..."
                  className="w-full rounded-md border border-black/[0.08] p-2.5 outline-none focus:border-[#007AFF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setReassignOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#007AFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                  <span>Reassign Ticket</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Status Transition Modal (Admin) ── */}
      {transitionOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-[#007AFF]" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Transition Ticket Status</h3>
              </div>
              <button type="button" onClick={() => setTransitionOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleTransition} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">New Status *</label>
                <select
                  value={transitionStatus}
                  onChange={(e) => setTransitionStatus(e.target.value)}
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] bg-white text-xs font-medium"
                >
                  <option value="InProgress">In Progress</option>
                  <option value="WaitingForCustomer">Waiting for Customer</option>
                  <option value="Assigned">Assigned</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Status Note / Reason *</label>
                <textarea
                  rows={3}
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  required
                  placeholder="Enter status update notes..."
                  className="w-full rounded-md border border-black/[0.08] p-2.5 outline-none focus:border-[#007AFF]"
                />
              </div>

              {transitionModalError && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-700">
                  {transitionModalError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setTransitionOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#007AFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  <span>Update Status</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Close Ticket Modal (Admin) ── */}
      {closeModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Resolve & Close Ticket</h3>
              </div>
              <button type="button" onClick={() => setCloseModalOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleClose} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Resolution Summary *</label>
                <textarea
                  rows={3}
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  required
                  placeholder="e.g. Refund initiated and issue resolved"
                  className="w-full rounded-md border border-black/[0.08] p-2.5 outline-none focus:border-[#007AFF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setCloseModalOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>Close Ticket</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reopen Ticket Modal (Customer) ── */}
      {reopenModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-rose-600" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Reopen Support Ticket</h3>
              </div>
              <button type="button" onClick={() => setReopenModalOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleReopen} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">Reason for Reopening *</label>
                <textarea
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  required
                  placeholder="Explain why the resolution did not resolve your issue..."
                  className="w-full rounded-md border border-black/[0.08] p-2.5 outline-none focus:border-[#007AFF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setReopenModalOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#007AFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  <span>Submit Reopen Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Link Incident Modal (Admin) ── */}
      {linkIncidentOpen && selectedTicketDetail && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Siren className="h-4 w-4 text-rose-600" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Link Ticket to Operational Incident</h3>
              </div>
              <button type="button" onClick={() => setLinkIncidentOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleLinkIncident} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">
                  Operational Incident Reference or ID *
                </label>
                <input
                  type="text"
                  value={linkIncidentId}
                  onChange={(e) => setLinkIncidentId(e.target.value)}
                  required
                  placeholder="e.g. INC-2026-52563 or 2"
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] font-mono text-xs"
                />
                <p className="text-[10px] text-[#8E8E93] mt-1">
                  Connect ticket #{selectedTicketDetail.ticketReference} to an operational incident (e.g. INC-2026-52563) for unified telemetry and override tracking.
                </p>
              </div>

              {linkIncidentError && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {linkIncidentError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setLinkIncidentOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-4 py-1.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Siren className="h-3.5 w-3.5" />}
                  <span>Link to Incident</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Link Support Ticket to Dispute Modal ── */}
      {linkDisputeOpen && selectedTicketDetail && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-bold text-[#1D1D1F]">Link Ticket to Dispute</h3>
              </div>
              <button type="button" onClick={() => setLinkDisputeOpen(false)} className="text-[#8E8E93] hover:text-[#1D1D1F]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleLinkDispute} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#1D1D1F] mb-1">
                  Dispute Case Reference or ID *
                </label>
                <input
                  type="text"
                  value={linkDisputeId}
                  onChange={(e) => setLinkDisputeId(e.target.value)}
                  required
                  placeholder="e.g. DSP-2026-96494 or 1"
                  className="w-full rounded-md border border-black/[0.08] px-3 py-2 outline-none focus:border-[#007AFF] font-mono text-xs"
                />
                <p className="text-[10px] text-[#8E8E93] mt-1">
                  Connect ticket #{selectedTicketDetail.ticketReference} to a financial dispute investigation (e.g. DSP-2026-96494) for unified reversal tracking.
                </p>
              </div>

              {linkDisputeError && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {linkDisputeError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setLinkDisputeOpen(false)}
                  className="rounded-md border border-black/[0.08] px-3.5 py-1.5 font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-1.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                  <span>Link Dispute</span>
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
