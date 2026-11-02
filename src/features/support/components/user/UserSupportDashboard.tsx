import SystemSelect from '@/components/ui/SystemSelect';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Car,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  HelpCircle,
  LifeBuoy,
  Loader2,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Ticket,
  Wrench,
  X,
} from 'lucide-react';
import {
  getSupportContext,
  getSupportTemplates,
} from '../../api/supportWorkflowService';
import { createSupportTicket, listSupportTickets } from '../../api/supportTicketService';
import type {
  QuickIssueCode,
  QuickIssueTemplate,
  SupportContextData,
  SupportTicket,
  SupportViewer,
} from '../../types';
import { cleanSupportText } from '../../utils/supportText';

interface UserSupportDashboardProps {
  viewer?: SupportViewer;
  token?: string;
  userId?: number;
  userName?: string;
  userRole?: string;
  ticketWorkspace?: React.ReactNode;
}

const COMMUTER_FALLBACK_TEMPLATES: QuickIssueTemplate[] = [
  {
    issueCode: 'GATE_STUCK',
    title: 'Gate Stuck / Cannot Enter or Exit',
    description: 'Barrier failed to open or license plate was not recognized upon arrival.',
    defaultMessage: 'The parking barrier gate did not open for my booking. Please assist.',
    category: 'GateAccess',
    priority: 'Critical',
    requiresBooking: true,
    requiresClaimAmount: false,
  },
  {
    issueCode: 'SPOT_OCCUPIED',
    title: 'Reserved Spot Occupied',
    description: 'My reserved parking bay is occupied by another vehicle.',
    defaultMessage: 'My reserved parking spot is currently occupied by another vehicle.',
    category: 'SpotOccupied',
    priority: 'High',
    requiresBooking: true,
    requiresClaimAmount: false,
  },
  {
    issueCode: 'REFUND_REQUEST',
    title: 'Refund or Cancellation Request',
    description: 'Request a refund for a cancelled, interrupted, or unusable booking.',
    defaultMessage: 'I would like to request a refund for my booking.',
    category: 'Refund',
    priority: 'Normal',
    requiresBooking: true,
    requiresClaimAmount: true,
  },
  {
    issueCode: 'DUPLICATE_CHARGE',
    title: 'Duplicate Charge / Billing Dispute',
    description: 'Charged twice or billed an incorrect amount for a parking session.',
    defaultMessage: 'I was charged twice / billed an incorrect amount for my parking booking.',
    category: 'Billing',
    priority: 'High',
    requiresBooking: true,
    requiresClaimAmount: true,
  },
  {
    issueCode: 'OTHER',
    title: 'General Inquiry & Feedback',
    description: 'General inquiry, app feedback, or any other parking issue.',
    defaultMessage: '',
    category: 'General',
    priority: 'Normal',
    requiresBooking: false,
    requiresClaimAmount: false,
  },
];

const OWNER_FALLBACK_TEMPLATES: QuickIssueTemplate[] = [
  {
    issueCode: 'RENTER_OVERSTAY',
    title: 'Renter Overstay / Blocking Spot',
    description: 'Current booking has ended, but renter vehicle is still parked in the spot blocking subsequent reservations.',
    defaultMessage: 'A renter vehicle has overstayed past the booking end time in my parking spot.',
    category: 'Overstay',
    priority: 'High',
    requiresBooking: true,
    requiresClaimAmount: false,
  },
  {
    issueCode: 'IOT_OFFLINE',
    title: 'Smart Barrier / Hardware Issue',
    description: 'Barrier gate is unresponsive, sensor offline, or hardware failure requires on-site inspection.',
    defaultMessage: 'The IoT parking lock / gate controller at my parking spot appears offline.',
    category: 'Hardware',
    priority: 'High',
    requiresBooking: false,
    requiresClaimAmount: false,
  },
  {
    issueCode: 'OWNER_PAYOUT',
    title: 'Host Payout & Revenue Inquiry',
    description: 'Booking earnings breakdown, commission verification, or wallet payout timeline inquiries.',
    defaultMessage: 'I have an inquiry regarding my property owner payout settlement.',
    category: 'Payout',
    priority: 'Normal',
    requiresBooking: false,
    requiresClaimAmount: true,
  },
  {
    issueCode: 'OTHER',
    title: 'Other Host Inquiries',
    description: 'Spot verification, calendar scheduling, listing details, or account assistance.',
    defaultMessage: '',
    category: 'General',
    priority: 'Normal',
    requiresBooking: false,
    requiresClaimAmount: false,
  },
];

function getIssueIcon(issueCode: string) {
  switch (issueCode.toUpperCase()) {
    case 'GATE_STUCK':
      return <ShieldAlert className="w-4 h-4" />;
    case 'SPOT_OCCUPIED':
    case 'RENTER_OVERSTAY':
      return <Car className="w-4 h-4" />;
    case 'REFUND_REQUEST':
    case 'DUPLICATE_CHARGE':
    case 'OWNER_PAYOUT':
      return <CreditCard className="w-4 h-4" />;
    case 'IOT_OFFLINE':
      return <Wrench className="w-4 h-4" />;
    default:
      return <HelpCircle className="w-4 h-4" />;
  }
}

function getIssueBadgeLabel(issueCode: string): string {
  switch (issueCode.toUpperCase()) {
    case 'GATE_STUCK':
      return 'Gate Barrier';
    case 'SPOT_OCCUPIED':
      return 'Spot Occupied';
    case 'REFUND_REQUEST':
      return 'Refund';
    case 'DUPLICATE_CHARGE':
      return 'Billing';
    case 'RENTER_OVERSTAY':
      return 'Overstay';
    case 'IOT_OFFLINE':
      return 'Hardware';
    case 'OWNER_PAYOUT':
      return 'Payout';
    case 'OTHER':
    default:
      return 'General';
  }
}

export const UserSupportDashboard: React.FC<UserSupportDashboardProps> = ({
  viewer,
  token: propToken,
  userRole: propUserRole,
  ticketWorkspace,
}) => {
  const token = viewer?.token || propToken || '';
  const userRole = viewer?.role || propUserRole || '';

  const isOwner = useMemo(
    () => Boolean(userRole && /owner|host|landlord/i.test(userRole)),
    [userRole],
  );

  const resolvedViewer: SupportViewer = useMemo(
    () =>
      viewer || {
        userId: 0,
        name: 'Customer',
        email: '',
        role: isOwner ? 'PropertyOwner' : 'Commuter',
        token,
      },
    [viewer, isOwner, token],
  );

  // ── Two-Level Navigation Flow: Outer Page ('overview') vs Inner Page ('tickets' | 'report') ──
  const [activeView, setActiveView] = useState<'overview' | 'tickets' | 'report'>('overview');

  // ── 1. Support Context & Role Templates (APIs #1 & #2) ──
  const [contextData, setContextData] = useState<SupportContextData | null>(null);
  const [templates, setTemplates] = useState<QuickIssueTemplate[]>([]);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  // Optional context query filters (?bookingId=&vehicleId=)
  const [contextBookingFilter, setContextBookingFilter] = useState<number | null>(null);
  const [contextVehicleFilter, setContextVehicleFilter] = useState<number | null>(null);

  // ── 2. Tickets Summary for Outer Page Summary Button ──
  const [userTickets, setUserTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // ── 3. Quick Ticket Creation Form State ──
  const [selectedIssueCode, setSelectedIssueCode] = useState<QuickIssueCode | string>('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedSpotId, setSelectedSpotId] = useState<string>('');
  const [claimAmount, setClaimAmount] = useState<string>('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [createSuccessMsg, setCreateSuccessMsg] = useState<string | null>(null);
  const [createErrorMsg, setCreateErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadContextAndTemplates = useCallback(
    async (bookingId?: number | null, vehicleId?: number | null) => {
      if (!token) return;
      setContextLoading(true);
      setContextError(null);

      try {
        const [ctxRes, tplRes] = await Promise.allSettled([
          getSupportContext(token, bookingId, vehicleId),
          getSupportTemplates(token),
        ]);

        let loadedCtx: SupportContextData | null = null;
        if (ctxRes.status === 'fulfilled') {
          loadedCtx = ctxRes.value;
          setContextData(loadedCtx);

          if (loadedCtx?.activeBooking?.bookingId && !selectedBookingId) {
            setSelectedBookingId(String(loadedCtx.activeBooking.bookingId));
          }
          if (loadedCtx?.activeBooking?.vehicleId && !selectedVehicleId) {
            setSelectedVehicleId(String(loadedCtx.activeBooking.vehicleId));
          }
          if (loadedCtx?.activeBooking?.parkingSpotId && !selectedSpotId) {
            setSelectedSpotId(String(loadedCtx.activeBooking.parkingSpotId));
          }
        } else {
          setContextError(ctxRes.reason?.message || 'Unable to load support context.');
        }

        const rawTemplates =
          tplRes.status === 'fulfilled' && tplRes.value.length > 0
            ? tplRes.value
            : loadedCtx?.quickIssueTemplates && loadedCtx.quickIssueTemplates.length > 0
            ? loadedCtx.quickIssueTemplates
            : isOwner
            ? OWNER_FALLBACK_TEMPLATES
            : COMMUTER_FALLBACK_TEMPLATES;

        const apiTemplates = rawTemplates.map((t) => ({
          ...t,
          title: cleanSupportText(t.title),
          description: cleanSupportText(t.description),
          defaultMessage: cleanSupportText(t.defaultMessage || t.description || ''),
        }));

        setTemplates(apiTemplates);
        if (!selectedIssueCode && apiTemplates.length > 0) {
          const first = apiTemplates[0];
          setSelectedIssueCode(first.issueCode);
          if (first.defaultMessage) {
            setTicketMessage(cleanSupportText(first.defaultMessage));
          } else if (first.description) {
            setTicketMessage(cleanSupportText(first.description));
          }
        }
      } finally {
        setContextLoading(false);
      }
    },
    [token, isOwner, selectedBookingId, selectedVehicleId, selectedSpotId, selectedIssueCode],
  );

  const loadTicketsSummary = useCallback(async () => {
    if (!token) return;
    try {
      setTicketsLoading(true);
      const data = await listSupportTickets(resolvedViewer);
      setUserTickets(data);
    } catch {
      // Non-blocking fallback
    } finally {
      setTicketsLoading(false);
    }
  }, [token, resolvedViewer]);

  useEffect(() => {
    void loadContextAndTemplates(contextBookingFilter, contextVehicleFilter);
  }, [token, contextBookingFilter, contextVehicleFilter]);

  useEffect(() => {
    void loadTicketsSummary();
  }, [loadTicketsSummary]);

  // Listen to ticket creation and back-to-overview events for smooth cross-component navigation
  useEffect(() => {
    const handleTicketCreated = () => {
      void loadTicketsSummary();
    };
    const handleBackToOverview = () => {
      setActiveView('overview');
    };
    const handleOpenTickets = () => {
      setActiveView('tickets');
    };

    window.addEventListener('support:ticket-created', handleTicketCreated);
    window.addEventListener('support:back-to-overview', handleBackToOverview);
    window.addEventListener('support:open-tickets-view', handleOpenTickets);

    return () => {
      window.removeEventListener('support:ticket-created', handleTicketCreated);
      window.removeEventListener('support:back-to-overview', handleBackToOverview);
      window.removeEventListener('support:open-tickets-view', handleOpenTickets);
    };
  }, [loadTicketsSummary]);

  const activeTemplate = useMemo(
    () => templates.find((t) => t.issueCode === selectedIssueCode) ?? null,
    [templates, selectedIssueCode],
  );

  const isRefundOrClaimIssue = useMemo(() => {
    if (activeTemplate?.requiresClaimAmount) return true;
    const code = String(selectedIssueCode).toUpperCase();
    return code === 'REFUND_REQUEST' || code === 'DUPLICATE_CHARGE' || code === 'OWNER_PAYOUT';
  }, [activeTemplate, selectedIssueCode]);

  const handleSelectTemplate = (tpl: QuickIssueTemplate) => {
    setSelectedIssueCode(tpl.issueCode);
    setCreateErrorMsg(null);
    setCreateSuccessMsg(null);
    const cleanMsg = cleanSupportText(tpl.defaultMessage || tpl.description || '');
    if (cleanMsg) {
      setTicketMessage(cleanMsg);
    }

    if (
      (tpl.requiresClaimAmount ||
        tpl.issueCode === 'REFUND_REQUEST' ||
        tpl.issueCode === 'DUPLICATE_CHARGE') &&
      !claimAmount
    ) {
      const activeTotal =
        contextData?.activeBooking?.totalPrice ?? contextData?.activeBooking?.totalAmount;
      if (activeTotal !== undefined && activeTotal !== null) {
        setClaimAmount(String(activeTotal));
      }
    }
  };

  // ── Submit Quick Ticket Handler: Creates Ticket and Transitions into Inner View ──
  const handleCreateQuickTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const code = (selectedIssueCode || 'OTHER').trim();
    const msg = ticketMessage.trim();
    if (!msg) {
      setCreateErrorMsg('Please enter a brief description of your issue.');
      return;
    }

    setCreatingTicket(true);
    setCreateErrorMsg(null);
    setCreateSuccessMsg(null);

    try {
      const created = await createSupportTicket(resolvedViewer, {
        issueCode: code,
        message: msg,
        bookingId: selectedBookingId ? Number(selectedBookingId) : undefined,
        vehicleId: selectedVehicleId ? Number(selectedVehicleId) : undefined,
        parkingSpotId: selectedSpotId ? Number(selectedSpotId) : undefined,
        claimAmount:
          isRefundOrClaimIssue && claimAmount.trim() !== '' ? Number(claimAmount) : undefined,
        attachments,
      });

      window.dispatchEvent(new CustomEvent('support:ticket-created', { detail: created }));
      setCreateSuccessMsg(
        `Ticket ${created.ticketReference || `#${created.ticketId}`} submitted successfully.`,
      );
      setAttachments([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      void loadTicketsSummary();

      // Smoothly navigate to Inner View with the newly created ticket
      setActiveView('tickets');
    } catch (err: any) {
      setCreateErrorMsg(err?.message || 'Unable to submit support ticket.');
    } finally {
      setCreatingTicket(false);
    }
  };

  const activeBooking = contextData?.activeBooking ?? null;
  const recentBookings = contextData?.recentBookings ?? [];
  const recentVehicles = contextData?.recentVehicles ?? contextData?.vehicles ?? [];
  const ownedSpots = contextData?.ownedSpots ?? [];

  const activeTicketsCount = useMemo(() => {
    return userTickets.filter(
      (t) =>
        t.status !== 'Closed' &&
        t.status !== 'Resolved' &&
        t.userDisplayStatus !== 'Closed' &&
        t.userDisplayStatus !== 'Resolved',
    ).length;
  }, [userTickets]);

  const latestTicket = useMemo(() => {
    return userTickets.length > 0 ? userTickets[0] : null;
  }, [userTickets]);

  return (
    <div className="space-y-4">
      {/* ── Inner Page: Tickets & Conversation View ── */}
      {activeView === 'tickets' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveView('overview')}
              className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#141417] hover:bg-[#F5F5F7] dark:hover:bg-[#1C1C20] text-[#1D1D1F] dark:text-white border border-black/[0.08] dark:border-white/10 transition-all active:scale-[0.98] shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#86868B] dark:text-[#A1A1AA] group-hover:text-[#007AFF] transition-colors" />
              <span>Back to Support Overview</span>
            </button>
          </div>

          {createSuccessMsg && (
            <div className="rounded-xl border border-black/[0.08] dark:border-white/10 bg-[#F5F5F7] dark:bg-[#18181C] px-4 py-2.5 text-xs font-medium text-[#1D1D1F] dark:text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#34C759] shrink-0" />
                {createSuccessMsg}
              </span>
              <button
                type="button"
                onClick={() => setCreateSuccessMsg(null)}
                className="text-[#6E6E73] dark:text-[#A1A1AA] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {ticketWorkspace}
        </div>
      )}

      {/* ── Inner Page: Dedicated Quick Issue Reporting Form (Centered & Aligned) ── */}
      {activeView === 'report' && (
        <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in duration-300">
          {/* Back button aligned on exact vertical axis with card */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveView('overview')}
              className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#141417] hover:bg-[#F5F5F7] dark:hover:bg-[#1C1C20] text-[#1D1D1F] dark:text-white border border-black/[0.08] dark:border-white/10 transition-all active:scale-[0.98] shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#86868B] dark:text-[#A1A1AA] group-hover:text-[#007AFF] transition-colors" />
              <span>Back to Support Overview</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#141417] rounded-2xl border border-black/[0.06] dark:border-white/10 p-5 md:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03)] dark:shadow-none space-y-6">
            <div className="border-b border-black/[0.06] dark:border-white/10 pb-4">
              <h2 className="text-base sm:text-lg font-bold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                <Ticket className="w-5 h-5 text-[#007AFF]" />
                Report an Issue
              </h2>
              <p className="text-xs text-[#6E6E73] dark:text-[#A1A1AA] mt-1">
                Select an issue template below to pre-fill your request, fill out details, and submit directly to our response team.
              </p>
            </div>

            {/* Template Selector Grid (Spacious 3-column layout) */}
            <div>
              <label className="block text-[11px] font-semibold text-[#1D1D1F] dark:text-white mb-2.5 uppercase tracking-wider">
                Select Issue Template
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {templates.map((tpl) => {
                  const isSelected = selectedIssueCode === tpl.issueCode;
                  return (
                    <button
                      key={tpl.issueCode}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`text-left rounded-xl border p-4 transition-all flex flex-col justify-between gap-3 cursor-pointer min-w-0 ${
                        isSelected
                          ? 'border-[#007AFF] bg-white ring-2 ring-[#007AFF]/20 shadow-[0_2px_8px_rgba(0,122,255,0.08)] dark:bg-[#1c1c1e] dark:border-[#0071E3]'
                          : 'border-black/[0.06] bg-[#F5F5F7]/60 hover:bg-[#F5F5F7] dark:bg-[#18181C] dark:border-white/[0.08] dark:hover:bg-[#202025]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div
                          className={`p-2 rounded-lg border transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-[#007AFF] text-white border-[#007AFF] dark:bg-[#0071E3]'
                              : 'bg-white text-[#1D1D1F] border-black/[0.06] dark:bg-white/[0.08] dark:text-white dark:border-white/[0.08]'
                          }`}
                        >
                          {getIssueIcon(tpl.issueCode)}
                        </div>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-black/[0.06] text-[#6E6E73] dark:bg-white/[0.08] dark:border-white/[0.08] dark:text-[#D4D4D8] truncate max-w-[140px] shrink-0">
                          {getIssueBadgeLabel(tpl.issueCode)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#1D1D1F] dark:text-white line-clamp-1">
                          {tpl.title}
                        </div>
                        {tpl.description && (
                          <p className="text-[11px] text-[#6E6E73] dark:text-[#A1A1AA] mt-1 line-clamp-2 leading-relaxed">
                            {cleanSupportText(tpl.description)}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Issue Form */}
            <form onSubmit={handleCreateQuickTicket} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                {/* Message Input */}
                <div className="md:col-span-12">
                  <label className="block text-[11px] font-semibold text-[#1D1D1F] dark:text-white mb-1.5">
                    Issue Description <span className="text-[#86868B] dark:text-[#A1A1AA]">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    placeholder="Describe what happened in detail (e.g. barrier failed to open or parking bay was occupied)..."
                    className="w-full rounded-xl border border-black/[0.08] dark:border-white/10 bg-[#F5F5F7]/60 dark:bg-[#18181C] p-3 text-xs text-[#1D1D1F] dark:text-white placeholder:text-[#86868B] dark:placeholder:text-[#71717A] focus:outline-none focus:border-[#007AFF] focus:bg-white dark:focus:bg-[#18181C] transition resize-none"
                  />
                </div>

                {/* Optional Booking / Spot / Vehicle selector */}
                <div className="md:col-span-6">
                  <label className="block text-[11px] font-semibold text-[#1D1D1F] dark:text-white mb-1">
                    {isOwner && ownedSpots.length > 0 ? 'Related Spot / Booking' : 'Related Booking (Optional)'}
                  </label>
                  {isOwner && ownedSpots.length > 0 ? (
                    <SystemSelect
                      value={selectedSpotId}
                      onChange={(e) => setSelectedSpotId(e.target.value)}
                      className="w-full rounded-xl border border-black/[0.08] dark:border-white/10 bg-[#F5F5F7]/60 dark:bg-[#18181C] px-3 py-2 text-xs text-[#1D1D1F] dark:text-white focus:outline-none focus:border-[#007AFF] focus:bg-white dark:focus:bg-[#18181C] transition"
                    >
                      <option value="">Auto-detect Spot / Booking</option>
                      {ownedSpots.map((s) => (
                        <option key={s.parkingSpotId} value={s.parkingSpotId}>
                          Spot {s.spotNumber || s.spotCode || `#${s.parkingSpotId}`}{' '}
                          {s.locationName ? `• ${s.locationName}` : ''}
                        </option>
                      ))}
                    </SystemSelect>
                  ) : (
                    <SystemSelect
                      value={selectedBookingId}
                      onChange={(e) => setSelectedBookingId(e.target.value)}
                      className="w-full rounded-xl border border-black/[0.08] dark:border-white/10 bg-[#F5F5F7]/60 dark:bg-[#18181C] px-3 py-2 text-xs text-[#1D1D1F] dark:text-white focus:outline-none focus:border-[#007AFF] focus:bg-white dark:focus:bg-[#18181C] transition"
                    >
                      <option value="">
                        {activeBooking?.bookingId
                          ? `Auto (#${activeBooking.bookingId}${
                              activeBooking.spotNumber ? ` • Spot ${activeBooking.spotNumber}` : ''
                            })`
                          : 'Auto-infer from active session'}
                      </option>
                      {recentBookings.map((b) => (
                        <option key={b.bookingId} value={b.bookingId}>
                          Booking #{b.bookingId}{' '}
                          {b.spotNumber ? `• Spot ${b.spotNumber}` : ''}{' '}
                          {b.totalPrice !== undefined ? `(RM ${Number(b.totalPrice).toFixed(2)})` : ''}
                        </option>
                      ))}
                    </SystemSelect>
                  )}
                </div>

                {/* Claim Amount or Vehicle selector */}
                <div className="md:col-span-6">
                  {isRefundOrClaimIssue ? (
                    <>
                      <label className="block text-[11px] font-semibold text-[#1D1D1F] dark:text-white mb-1">
                        Claim Amount (RM, Optional)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={claimAmount}
                        onChange={(e) => setClaimAmount(e.target.value)}
                        placeholder="Auto from booking amount"
                        className="w-full rounded-xl border border-black/[0.08] dark:border-white/10 bg-[#F5F5F7]/60 dark:bg-[#18181C] px-3 py-2 text-xs text-[#1D1D1F] dark:text-white placeholder:text-[#86868B] dark:placeholder:text-[#71717A] focus:outline-none focus:border-[#007AFF] focus:bg-white dark:focus:bg-[#18181C] transition"
                      />
                    </>
                  ) : (
                    <>
                      <label className="block text-[11px] font-semibold text-[#1D1D1F] dark:text-white mb-1">
                        Vehicle (Optional)
                      </label>
                      <SystemSelect
                        value={selectedVehicleId}
                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                        className="w-full rounded-xl border border-black/[0.08] dark:border-white/10 bg-[#F5F5F7]/60 dark:bg-[#18181C] px-3 py-2 text-xs text-[#1D1D1F] dark:text-white focus:outline-none focus:border-[#007AFF] focus:bg-white dark:focus:bg-[#18181C] transition"
                      >
                        <option value="">Auto-detect vehicle</option>
                        {recentVehicles.map((v) => (
                          <option key={v.vehicleId} value={v.vehicleId}>
                            {v.licensePlate || v.plateNumber || `Vehicle #${v.vehicleId}`}
                          </option>
                        ))}
                      </SystemSelect>
                    </>
                  )}
                </div>
              </div>

              {/* Attachments & Submit Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-black/[0.06] dark:border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        setAttachments((prev) => [...prev, ...files]);
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-black/[0.08] dark:border-white/14 bg-[#F5F5F7] dark:bg-[#242429] text-[#1D1D1F] dark:text-white hover:bg-[#E8E8ED] dark:hover:bg-[#2C2C32] transition cursor-pointer"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-[#6E6E73] dark:text-[#A1A1AA]" />
                    Attach Photos / Receipts
                  </button>

                  {attachments.map((file, idx) => (
                    <span
                      key={`${file.name}-${idx}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-[#F5F5F7] dark:bg-[#18181C] text-[#1D1D1F] dark:text-white border border-black/[0.08] dark:border-white/10"
                    >
                      <FileText className="w-3 h-3 text-[#6E6E73] dark:text-[#A1A1AA]" />
                      <span className="max-w-[140px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-[#86868B] dark:text-[#A1A1AA] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveView('overview')}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#6E6E73] dark:text-[#A1A1AA] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingTicket || !ticketMessage.trim()}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#007AFF] text-white hover:bg-[#0066D6] disabled:opacity-50 shadow-2xs transition cursor-pointer"
                  >
                    {creatingTicket ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Submit Ticket
                  </button>
                </div>
              </div>

              {createErrorMsg && (
                <div className="rounded-xl border border-black/[0.08] dark:border-white/10 bg-[#F5F5F7] dark:bg-[#18181C] px-4 py-2.5 text-xs font-medium text-[#1D1D1F] dark:text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#FF3B30] shrink-0" />
                    {createErrorMsg}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCreateErrorMsg(null)}
                    className="text-[#6E6E73] dark:text-[#A1A1AA] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ── Outer Page: Quick Access View ── */}
      {activeView === 'overview' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Top Header & Context Status Bar (Cleaned Subtitle) */}
          <div className="bg-white dark:bg-[#141417] rounded-3xl border border-black/[0.06] dark:border-white/10 p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F5F5F7] dark:bg-[#242429] text-[#1D1D1F] dark:text-white border border-black/[0.06] dark:border-white/14">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#007AFF]" />
                  {isOwner ? 'Property Owner Support' : 'Commuter Support'}
                </span>
                {contextData?.userRole && (
                  <span className="text-[11px] text-[#86868B] dark:text-[#A1A1AA] font-medium">
                    {contextData.userRole}
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#1D1D1F] dark:text-white">
                Support & Assistance
              </h1>
              <p className="text-xs text-[#6E6E73] dark:text-[#A1A1AA]">
                {isOwner
                  ? 'Manage renter overstays, IoT lock status, payout inquiries, and support tickets.'
                  : '1-click issue reporting, status tracking, and live ticket updates.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {recentBookings.length > 0 && (
                <SystemSelect
                  aria-label="Filter context by booking"
                  value={contextBookingFilter ?? ''}
                  onChange={(e) =>
                    setContextBookingFilter(e.target.value ? Number(e.target.value) : null)
                  }
                  className="text-xs rounded-xl border border-black/[0.08] dark:border-white/10 bg-[#F5F5F7] dark:bg-[#18181C] px-3 py-2 text-[#1D1D1F] dark:text-white font-medium focus:outline-none focus:border-[#007AFF] focus:bg-white dark:focus:bg-[#18181C] transition"
                >
                  <option value="">All Active Context</option>
                  {recentBookings.map((b) => (
                    <option key={b.bookingId} value={b.bookingId}>
                      Booking #{b.bookingId}{' '}
                      {b.spotNumber ? `• Spot ${b.spotNumber}` : ''}{' '}
                      {b.status ? `(${b.status})` : ''}
                    </option>
                  ))}
                </SystemSelect>
              )}

              {recentVehicles.length > 0 && (
                <SystemSelect
                  aria-label="Filter context by vehicle"
                  value={contextVehicleFilter ?? ''}
                  onChange={(e) =>
                    setContextVehicleFilter(e.target.value ? Number(e.target.value) : null)
                  }
                  className="text-xs rounded-xl border border-black/[0.08] dark:border-white/10 bg-[#F5F5F7] dark:bg-[#18181C] px-3 py-2 text-[#1D1D1F] dark:text-white font-medium focus:outline-none focus:border-[#007AFF] focus:bg-white dark:focus:bg-[#18181C] transition"
                >
                  <option value="">All Vehicles</option>
                  {recentVehicles.map((v) => (
                    <option key={v.vehicleId} value={v.vehicleId}>
                      {v.licensePlate || v.plateNumber || `Vehicle #${v.vehicleId}`}
                    </option>
                  ))}
                </SystemSelect>
              )}

              <button
                type="button"
                onClick={() => void loadContextAndTemplates(contextBookingFilter, contextVehicleFilter)}
                disabled={contextLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-black/[0.08] dark:border-white/14 bg-white dark:bg-[#18181C] text-[#1D1D1F] dark:text-white hover:bg-[#F5F5F7] dark:hover:bg-[#202025] disabled:opacity-50 transition cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[#6E6E73] dark:text-[#A1A1AA] ${
                    contextLoading ? 'animate-spin text-[#007AFF]' : ''
                  }`}
                />
                Refresh
              </button>
            </div>
          </div>

          {contextError && (
            <div className="rounded-xl border border-black/[0.08] dark:border-white/10 bg-[#F5F5F7] dark:bg-[#18181C] px-4 py-3 text-xs text-[#1D1D1F] dark:text-white flex items-center justify-between">
              <span className="text-[#6E6E73] dark:text-[#A1A1AA]">{contextError}</span>
              <button
                type="button"
                onClick={() => void loadContextAndTemplates(contextBookingFilter, contextVehicleFilter)}
                className="font-semibold text-[#007AFF] hover:underline ml-3 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Quick Issue Reporting Card */}
          <div className="bg-white dark:bg-[#141417] rounded-3xl border border-black/[0.06] dark:border-white/10 p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] dark:shadow-none space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                  <LifeBuoy className="w-4 h-4 text-[#007AFF]" />
                  Quick Issue Reporting
                </h2>
                <p className="text-xs text-[#6E6E73] dark:text-[#A1A1AA] mt-0.5">
                  Select a template below to report an issue, or click Report an Issue for custom inquiries.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (templates.length > 0 && !selectedIssueCode) {
                      handleSelectTemplate(templates[0]);
                    }
                    setActiveView('report');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#007AFF] text-white hover:bg-[#0066D6] shadow-2xs transition active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Report an Issue</span>
                </button>
              </div>
            </div>

            {/* Quick Issue Template Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
              {templates.map((tpl) => (
                <button
                  key={tpl.issueCode}
                  type="button"
                  onClick={() => {
                    handleSelectTemplate(tpl);
                    setActiveView('report');
                  }}
                  className="group text-left rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-[#F5F5F7]/70 dark:bg-[#18181C] p-4 transition-all duration-200 hover:bg-white hover:border-[#007AFF]/40 hover:shadow-sm dark:hover:bg-[#202025] hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between gap-3 min-w-0"
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="p-2 rounded-xl bg-white dark:bg-white/[0.08] text-[#1D1D1F] dark:text-white border border-black/[0.04] dark:border-white/10 group-hover:text-[#007AFF] transition-colors shrink-0">
                      {getIssueIcon(tpl.issueCode)}
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/10 text-[#6E6E73] dark:text-[#A1A1AA] truncate max-w-[100px] shrink-0">
                      {getIssueBadgeLabel(tpl.issueCode)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#1D1D1F] dark:text-white line-clamp-1 group-hover:text-[#007AFF] transition-colors">
                      {tpl.title}
                    </div>
                    {tpl.description && (
                      <p className="text-[11px] text-[#6E6E73] dark:text-[#A1A1AA] mt-1 line-clamp-2 leading-relaxed">
                        {cleanSupportText(tpl.description)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {createSuccessMsg && (
              <div className="rounded-xl border border-black/[0.08] dark:border-white/10 bg-[#F5F5F7] dark:bg-[#18181C] px-4 py-2.5 text-xs font-medium text-[#1D1D1F] dark:text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#34C759] shrink-0" />
                  {createSuccessMsg}
                </span>
                <button
                  type="button"
                  onClick={() => setCreateSuccessMsg(null)}
                  className="text-[#6E6E73] dark:text-[#A1A1AA] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* ── Apple-Inspired Minimalist Summary Card / Button to Open My Support Tickets ── */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveView('tickets')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setActiveView('tickets');
              }
            }}
            className="group bg-white dark:bg-[#141417] rounded-3xl border border-black/[0.06] dark:border-white/10 p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] dark:shadow-none hover:border-black/[0.12] dark:hover:border-white/20 transition-all duration-300 cursor-pointer"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#007AFF]/10 dark:bg-[#007AFF]/15 border border-[#007AFF]/20 text-[#007AFF] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Ticket className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-[#1D1D1F] dark:text-white group-hover:text-[#007AFF] transition-colors">
                      My Support Tickets
                    </h3>
                    <span className="inline-flex items-center rounded-full bg-[#F5F5F7] dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#6E6E73] dark:text-[#A1A1AA]">
                      {ticketsLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        `${userTickets.length} ${userTickets.length === 1 ? 'ticket' : 'tickets'}`
                      )}
                    </span>
                    {activeTicketsCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#007AFF]/10 border border-[#007AFF]/20 px-2 py-0.5 text-[10px] font-semibold text-[#007AFF]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#007AFF] animate-pulse" />
                        {activeTicketsCount} active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6E6E73] dark:text-[#A1A1AA]">
                    Track ongoing support requests, upload proof documents, and chat with specialists.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                {latestTicket && (
                  <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F5F5F7]/70 dark:bg-[#18181C] border border-black/[0.04] dark:border-white/[0.06] text-xs">
                    <span className="font-mono text-[11px] font-semibold text-[#007AFF]">
                      {latestTicket.ticketReference}
                    </span>
                    <span className="text-[#86868B] dark:text-[#71717A]">·</span>
                    <span className="text-[11px] text-[#6E6E73] dark:text-[#A1A1AA] truncate max-w-[160px]">
                      {cleanSupportText(latestTicket.subject)}
                    </span>
                  </div>
                )}

                {/* Crisp Apple Primary Action Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveView('tickets');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#007AFF] text-white hover:bg-[#0066D6] active:scale-[0.98] shadow-xs transition cursor-pointer"
                >
                  <span className="text-white font-medium">View Tickets</span>
                  <ChevronRight className="w-4 h-4 text-white stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSupportDashboard;
