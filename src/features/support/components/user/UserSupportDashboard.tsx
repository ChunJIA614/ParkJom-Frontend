import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  CreditCard,
  FileText,
  HelpCircle,
  Loader2,
  MapPin,
  Paperclip,
  RefreshCw,
  Send,
  ShieldAlert,
  Ticket,
  Unlock,
  Wrench,
  X,
} from 'lucide-react';
import {
  getSupportContext,
  getSupportTemplates,
  selfUnlockGate,
} from '../../api/supportWorkflowService';
import { createSupportTicket } from '../../api/supportTicketService';
import type {
  QuickIssueCode,
  QuickIssueTemplate,
  SelfUnlockGateResult,
  SupportContextData,
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
    title: 'Gate Stuck / Barrier Not Opening',
    description: 'Barrier fails to open on entry or exit despite an active booking.',
    defaultMessage: 'The parking barrier gate is stuck and will not open for my booking.',
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
    title: 'Request a Refund',
    description: 'Request a refund for a cancelled, interrupted, or unusable booking.',
    defaultMessage: 'I would like to request a refund for my booking.',
    category: 'Refund',
    priority: 'Normal',
    requiresBooking: true,
    requiresClaimAmount: true,
  },
  {
    issueCode: 'DUPLICATE_CHARGE',
    title: 'Duplicate / Overcharge Issue',
    description: 'Charged twice or billed an incorrect amount for a parking session.',
    defaultMessage: 'I was charged twice / billed an incorrect amount for my parking booking.',
    category: 'Billing',
    priority: 'High',
    requiresBooking: true,
    requiresClaimAmount: true,
  },
  {
    issueCode: 'OTHER',
    title: 'Other Support Issue',
    description: 'General inquiry or any other parking issue.',
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
    title: 'Renter Overstay',
    description: 'Vehicle remained parked in your spot past the booked end time.',
    defaultMessage: 'A renter vehicle has overstayed past the booking end time in my parking spot.',
    category: 'Overstay',
    priority: 'High',
    requiresBooking: true,
    requiresClaimAmount: false,
  },
  {
    issueCode: 'IOT_OFFLINE',
    title: 'Smart Lock / IoT Device Offline',
    description: 'Parking lock, sensor, or gate controller is unresponsive or offline.',
    defaultMessage: 'The IoT parking lock / gate controller at my parking spot appears offline.',
    category: 'Hardware',
    priority: 'High',
    requiresBooking: false,
    requiresClaimAmount: false,
  },
  {
    issueCode: 'OWNER_PAYOUT',
    title: 'Owner Payout / Settlement Inquiry',
    description: 'Missing payout, settlement discrepancy, or earnings question.',
    defaultMessage: 'I have an inquiry regarding my property owner payout settlement.',
    category: 'Payout',
    priority: 'Normal',
    requiresBooking: false,
    requiresClaimAmount: true,
  },
  {
    issueCode: 'OTHER',
    title: 'Other Property Owner Issue',
    description: 'Listing management, bay verification, or general support.',
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
      return <Unlock className="w-4 h-4" />;
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

  // ── 1. Support Context & Role Templates (APIs #1 & #2) ──
  const [contextData, setContextData] = useState<SupportContextData | null>(null);
  const [templates, setTemplates] = useState<QuickIssueTemplate[]>([]);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  // Optional context query filters (?bookingId=&vehicleId=)
  const [contextBookingFilter, setContextBookingFilter] = useState<number | null>(null);
  const [contextVehicleFilter, setContextVehicleFilter] = useState<number | null>(null);

  // ── 2. Self-Service Emergency Gate Unlock (API #3) ──
  const [gateAction, setGateAction] = useState<'Enter' | 'Exit'>('Enter');
  const [unlockingGate, setUnlockingGate] = useState(false);
  const [gateResult, setGateResult] = useState<SelfUnlockGateResult | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [submittingUrgentGateTicket, setSubmittingUrgentGateTicket] = useState(false);

  // ── 3. One-Click Quick Ticket Creation (API #6) ──
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
  const ticketSectionRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    void loadContextAndTemplates(contextBookingFilter, contextVehicleFilter);
  }, [token, contextBookingFilter, contextVehicleFilter]);

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
    if (tpl.defaultMessage) {
      setTicketMessage(cleanSupportText(tpl.defaultMessage));
    } else if (tpl.description && !ticketMessage.trim()) {
      setTicketMessage(cleanSupportText(tpl.description));
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

  // ── Emergency Self-Service Gate Unlock Handler (API #3) ──
  const handleSelfUnlockGate = async (actionOverride?: 'Enter' | 'Exit') => {
    if (!token) return;
    const chosenAction = actionOverride || gateAction;
    setGateAction(chosenAction);
    setUnlockingGate(true);
    setGateError(null);
    setGateResult(null);

    const targetBookingId =
      contextData?.activeBooking?.bookingId ??
      (selectedBookingId ? Number(selectedBookingId) : undefined);

    try {
      const result = await selfUnlockGate(token, {
        ...(targetBookingId ? { bookingId: targetBookingId } : {}),
        action: chosenAction,
      });
      setGateResult(result);
      if (!result.success) {
        setGateError(result.message || 'Automatic gate unlock did not succeed.');
      }
    } catch (err: any) {
      setGateError(err?.message || 'Unable to unlock gate automatically.');
      setGateResult({
        success: false,
        message: err?.message || 'Unable to unlock gate automatically.',
        action: chosenAction,
        bookingId: targetBookingId ?? null,
        suggestUrgentTicket: true,
      });
    } finally {
      setUnlockingGate(false);
    }
  };

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

  // ── 1-Click Urgent GATE_STUCK Ticket when self-unlock fails ──
  const handleOneClickUrgentGateTicket = async () => {
    if (!token) return;
    setSubmittingUrgentGateTicket(true);
    setCreateErrorMsg(null);
    setCreateSuccessMsg(null);

    const targetBookingId =
      gateResult?.bookingId ??
      contextData?.activeBooking?.bookingId ??
      (selectedBookingId ? Number(selectedBookingId) : undefined);

    try {
      const created = await createSupportTicket(resolvedViewer, {
        issueCode: 'GATE_STUCK',
        message: `Urgent: Self-service gate unlock (${gateAction}) failed at barrier. Requesting immediate remote gate release.`,
        ...(targetBookingId ? { bookingId: Number(targetBookingId) } : {}),
        ...(contextData?.activeBooking?.parkingSpotId
          ? { parkingSpotId: Number(contextData.activeBooking.parkingSpotId) }
          : {}),
        ...(contextData?.activeBooking?.vehicleId
          ? { vehicleId: Number(contextData.activeBooking.vehicleId) }
          : {}),
      });

      window.dispatchEvent(new CustomEvent('support:ticket-created', { detail: created }));
      setCreateSuccessMsg(
        `Urgent Gate Ticket ${created.ticketReference || `#${created.ticketId}`} created. Support has been alerted.`,
      );
      ticketSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err: any) {
      setCreateErrorMsg(err?.message || 'Failed to submit urgent gate ticket.');
    } finally {
      setSubmittingUrgentGateTicket(false);
    }
  };

  // ── Submit Quick Ticket Handler (API #6) ──
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
        `Ticket ${created.ticketReference || `#${created.ticketId}`} submitted. Track updates and chat below.`,
      );
      setAttachments([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      ticketSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  return (
    <div className="space-y-4">
      {/* ── Top Header & Context Status Bar ── */}
      <div className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F5F5F7] text-[#1D1D1F] border border-black/[0.06]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#007AFF]" />
              {isOwner ? 'Property Owner Support' : 'Commuter Support'}
            </span>
            {contextData?.userRole && (
              <span className="text-[11px] text-[#86868B] font-medium">
                {contextData.userRole}
              </span>
            )}
          </div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#1D1D1F]">
            Support & Assistance
          </h1>
          <p className="text-xs text-[#6E6E73]">
            {isOwner
              ? 'Manage renter overstays, IoT lock status, payout inquiries, and support tickets.'
              : 'Instant barrier gate self-unlock, 1-click issue reporting, and live ticket updates.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {recentBookings.length > 0 && (
            <select
              aria-label="Filter context by booking"
              value={contextBookingFilter ?? ''}
              onChange={(e) =>
                setContextBookingFilter(e.target.value ? Number(e.target.value) : null)
              }
              className="text-xs rounded-xl border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-[#1D1D1F] font-medium focus:outline-none focus:border-[#007AFF] focus:bg-white transition"
            >
              <option value="">All Active Context</option>
              {recentBookings.map((b) => (
                <option key={b.bookingId} value={b.bookingId}>
                  Booking #{b.bookingId}{' '}
                  {b.spotNumber ? `• Spot ${b.spotNumber}` : ''}{' '}
                  {b.status ? `(${b.status})` : ''}
                </option>
              ))}
            </select>
          )}

          {recentVehicles.length > 0 && (
            <select
              aria-label="Filter context by vehicle"
              value={contextVehicleFilter ?? ''}
              onChange={(e) =>
                setContextVehicleFilter(e.target.value ? Number(e.target.value) : null)
              }
              className="text-xs rounded-xl border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-[#1D1D1F] font-medium focus:outline-none focus:border-[#007AFF] focus:bg-white transition"
            >
              <option value="">All Vehicles</option>
              {recentVehicles.map((v) => (
                <option key={v.vehicleId} value={v.vehicleId}>
                  {v.licensePlate || v.plateNumber || `Vehicle #${v.vehicleId}`}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => void loadContextAndTemplates(contextBookingFilter, contextVehicleFilter)}
            disabled={contextLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-black/[0.08] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] disabled:opacity-50 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6E6E73] ${contextLoading ? 'animate-spin text-[#007AFF]' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {contextError && (
        <div className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] px-4 py-3 text-xs text-[#1D1D1F] flex items-center justify-between">
          <span className="text-[#6E6E73]">{contextError}</span>
          <button
            type="button"
            onClick={() => void loadContextAndTemplates(contextBookingFilter, contextVehicleFilter)}
            className="font-semibold text-[#007AFF] hover:underline ml-3 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Section 1: Active Booking & Emergency Self-Unlock Gate (APIs #1 & #3) ── */}
      {(activeBooking || contextData?.canSelfUnlockGate) && (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F5F5F7] text-[#1D1D1F] border border-black/[0.06]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
                  Active Session
                </span>
                {activeBooking?.bookingId && (
                  <span className="text-xs font-semibold text-[#1D1D1F]">
                    Booking #{activeBooking.bookingId}
                    {activeBooking.bookingReference ? ` (${activeBooking.bookingReference})` : ''}
                  </span>
                )}
                {activeBooking?.status && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F5F7] text-[#6E6E73] border border-black/[0.04]">
                    {activeBooking.status}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[#1D1D1F]">
                {(activeBooking?.spotNumber || activeBooking?.spotCode) && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#1D1D1F]">
                    <MapPin className="w-4 h-4 text-[#6E6E73]" />
                    Spot {activeBooking.spotNumber || activeBooking.spotCode}
                    {activeBooking.locationName || activeBooking.address
                      ? ` • ${activeBooking.locationName || activeBooking.address}`
                      : ''}
                  </span>
                )}
                {(activeBooking?.vehiclePlate || activeBooking?.licensePlate) && (
                  <span className="inline-flex items-center gap-1.5 text-[#6E6E73]">
                    <Car className="w-4 h-4 text-[#86868B]" />
                    {activeBooking.vehiclePlate || activeBooking.licensePlate}
                  </span>
                )}
                {(activeBooking?.totalPrice ?? activeBooking?.totalAmount) !== undefined && (
                  <span className="inline-flex items-center gap-1 text-[#6E6E73] font-medium">
                    RM{' '}
                    {Number(activeBooking?.totalPrice ?? activeBooking?.totalAmount ?? 0).toFixed(
                      2,
                    )}
                  </span>
                )}
              </div>

              <p className="text-xs text-[#6E6E73]">
                Stuck at the barrier? Use Emergency Self-Unlock to open the gate immediately without waiting for an agent.
              </p>
            </div>

            {/* Emergency Self-Unlock Controls */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                disabled={unlockingGate}
                onClick={() => void handleSelfUnlockGate('Enter')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#007AFF] text-white hover:bg-[#0066D6] disabled:opacity-50 shadow-2xs transition cursor-pointer"
              >
                {unlockingGate && gateAction === 'Enter' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                Unlock Entry Gate
              </button>

              <button
                type="button"
                disabled={unlockingGate}
                onClick={() => void handleSelfUnlockGate('Exit')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border border-black/[0.08] bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED] disabled:opacity-50 transition cursor-pointer"
              >
                {unlockingGate && gateAction === 'Exit' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                Unlock Exit Gate
              </button>
            </div>
          </div>

          {/* Gate Unlock Result / Urgent Ticket Escalation */}
          {(gateResult || gateError) && (
            <div className="mt-4 rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[#1D1D1F]">
              <div className="flex items-start gap-2.5 text-xs">
                {gateResult?.success ? (
                  <CheckCircle2 className="w-4 h-4 text-[#34C759] shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[#FF3B30] shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold text-[#1D1D1F]">
                    {gateResult?.message || gateError}
                  </p>
                  {gateResult?.commandId && (
                    <p className="text-[11px] text-[#6E6E73] mt-0.5">
                      Command Reference: {gateResult.commandId} • Action: {gateResult.action || gateAction}
                    </p>
                  )}
                </div>
              </div>

              {(!gateResult?.success || gateResult?.suggestUrgentTicket) && (
                <button
                  type="button"
                  disabled={submittingUrgentGateTicket}
                  onClick={() => void handleOneClickUrgentGateTicket()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1D1D1F] text-white hover:bg-black disabled:opacity-50 shrink-0 transition cursor-pointer"
                >
                  {submittingUrgentGateTicket ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5" />
                  )}
                  1-Click Urgent Gate Ticket
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Section 2: Role-Specific Quick Issue Cards & 1-Click Ticket Form (APIs #2 & #6) ── */}
      <div className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#1D1D1F] flex items-center gap-2">
              <Ticket className="w-4 h-4 text-[#1D1D1F]" />
              Quick Issue Reporting
            </h2>
            <p className="text-xs text-[#6E6E73] mt-0.5">
              Select an issue template below to pre-fill your request and submit in one click.
            </p>
          </div>
          {!activeBooking && !contextData?.canSelfUnlockGate && !isOwner && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={unlockingGate}
                onClick={() => void handleSelfUnlockGate('Enter')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-black/[0.08] bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED] disabled:opacity-50 transition cursor-pointer"
              >
                {unlockingGate ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
                Emergency Gate Unlock
              </button>
            </div>
          )}
        </div>

        {/* Emergency Gate Unlock feedback when no activeBooking banner is visible */}
        {!activeBooking && !contextData?.canSelfUnlockGate && (gateResult || gateError) && (
          <div className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[#1D1D1F]">
            <div className="flex items-center gap-2 text-xs font-medium">
              {gateResult?.success ? (
                <CheckCircle2 className="w-4 h-4 text-[#34C759] shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#FF3B30] shrink-0" />
              )}
              <span>{gateResult?.message || gateError}</span>
            </div>
            {(!gateResult?.success || gateResult?.suggestUrgentTicket) && (
              <button
                type="button"
                disabled={submittingUrgentGateTicket}
                onClick={() => void handleOneClickUrgentGateTicket()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1D1D1F] text-white hover:bg-black disabled:opacity-50 shrink-0 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Submit Urgent Gate Ticket
              </button>
            )}
          </div>
        )}

        {/* Role-Specific Issue Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {templates.map((tpl) => {
            const isSelected = selectedIssueCode === tpl.issueCode;
            return (
              <button
                key={tpl.issueCode}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className={`text-left rounded-xl border p-3.5 transition flex flex-col justify-between gap-2.5 cursor-pointer ${
                  isSelected
                    ? 'border-[#007AFF] bg-white ring-1 ring-[#007AFF]/20 shadow-[0_2px_8px_rgba(0,122,255,0.06)]'
                    : 'border-black/[0.06] bg-[#F5F5F7]/60 hover:bg-[#F5F5F7] hover:border-black/[0.12]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`p-2 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-[#007AFF] text-white border-[#007AFF]'
                        : 'bg-white text-[#1D1D1F] border-black/[0.06]'
                    }`}
                  >
                    {getIssueIcon(tpl.issueCode)}
                  </div>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-white border border-black/[0.06] text-[#6E6E73]">
                    {tpl.issueCode}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#1D1D1F] line-clamp-1">
                    {tpl.title}
                  </div>
                  {tpl.description && (
                    <p className="text-[11px] text-[#6E6E73] mt-0.5 line-clamp-2 leading-relaxed">
                      {tpl.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Minimal 1-Click Ticket Form */}
        <form onSubmit={handleCreateQuickTicket} className="pt-3 border-t border-black/[0.06] space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Message Input */}
            <div className="md:col-span-6">
              <label className="block text-[11px] font-semibold text-[#1D1D1F] mb-1">
                Issue Description <span className="text-[#86868B]">*</span>
              </label>
              <input
                type="text"
                required
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Describe what happened in one sentence..."
                className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3.5 py-2 text-xs text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-[#007AFF] focus:bg-white transition"
              />
            </div>

            {/* Optional Booking / Spot / Vehicle selector */}
            <div className="md:col-span-3">
              <label className="block text-[11px] font-semibold text-[#1D1D1F] mb-1">
                {isOwner && ownedSpots.length > 0 ? 'Related Spot / Booking' : 'Related Booking (Optional)'}
              </label>
              {isOwner && ownedSpots.length > 0 ? (
                <select
                  value={selectedSpotId}
                  onChange={(e) => setSelectedSpotId(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:border-[#007AFF] focus:bg-white transition"
                >
                  <option value="">Auto-detect Spot / Booking</option>
                  {ownedSpots.map((s) => (
                    <option key={s.parkingSpotId} value={s.parkingSpotId}>
                      Spot {s.spotNumber || s.spotCode || `#${s.parkingSpotId}`}{' '}
                      {s.locationName ? `• ${s.locationName}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedBookingId}
                  onChange={(e) => setSelectedBookingId(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:border-[#007AFF] focus:bg-white transition"
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
                </select>
              )}
            </div>

            {/* Claim Amount (if refund/billing) or Vehicle selector */}
            <div className="md:col-span-3">
              {isRefundOrClaimIssue ? (
                <>
                  <label className="block text-[11px] font-semibold text-[#1D1D1F] mb-1">
                    Claim Amount (RM, Optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={claimAmount}
                    onChange={(e) => setClaimAmount(e.target.value)}
                    placeholder="Auto from booking amount"
                    className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 text-xs text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-[#007AFF] focus:bg-white transition"
                  />
                </>
              ) : (
                <>
                  <label className="block text-[11px] font-semibold text-[#1D1D1F] mb-1">
                    Vehicle (Optional)
                  </label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/60 px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:border-[#007AFF] focus:bg-white transition"
                  >
                    <option value="">Auto-detect vehicle</option>
                    {recentVehicles.map((v) => (
                      <option key={v.vehicleId} value={v.vehicleId}>
                        {v.licensePlate || v.plateNumber || `Vehicle #${v.vehicleId}`}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Attachments & Submit Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-black/[0.08] bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED] transition cursor-pointer"
              >
                <Paperclip className="w-3.5 h-3.5 text-[#6E6E73]" />
                Attach Photos / Receipts
              </button>

              {attachments.map((file, idx) => (
                <span
                  key={`${file.name}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-[#F5F5F7] text-[#1D1D1F] border border-black/[0.08]"
                >
                  <FileText className="w-3 h-3 text-[#6E6E73]" />
                  <span className="max-w-[140px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

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

          {createSuccessMsg && (
            <div className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] px-4 py-2.5 text-xs font-medium text-[#1D1D1F] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#34C759] shrink-0" />
                {createSuccessMsg}
              </span>
              <button
                type="button"
                onClick={() => setCreateSuccessMsg(null)}
                className="text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {createErrorMsg && (
            <div className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] px-4 py-2.5 text-xs font-medium text-[#1D1D1F] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#FF3B30] shrink-0" />
                {createErrorMsg}
              </span>
              <button
                type="button"
                onClick={() => setCreateErrorMsg(null)}
                className="text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </form>
      </div>

      {/* ── Section 3: My Support Tickets, Conversation Stream & Embedded Refund Progress (APIs #4, #5, #7, #8, #9, #10) ── */}
      <div ref={ticketSectionRef}>
        {ticketWorkspace}
      </div>
    </div>
  );
};
export default UserSupportDashboard;
