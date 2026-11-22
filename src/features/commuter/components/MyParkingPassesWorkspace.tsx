import BollardStatusDetails from '@/components/ui/BollardStatusDetails';
import type { IoTStatusData } from '@/services/iotManagementApi';
import { displayDateOptions, parseTimestamp } from '@/lib/dateTime';
import ParkingPhoto from './ParkingPhoto';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Headphones,
  Info,
  Loader2,
  Lock,
  MapPin,
  MoreVertical,
  Navigation,
  Phone,
  Plus,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react';
import type { Booking } from '../types';
import {
  cancelBooking,
  evaluateBookingCancellationEligibility,
  getBookingIsLastDay,
} from '../api/bookingApi';
import {
  completeBollardUnlock,
  getBookingBollardStatus,
  findRememberedBollard,
  isUnlockChallengeCurrent,
  performLockBollardCommand,
  prepareBollardUnlock,
  type UnlockChallenge,
} from '../api/iotApi';
import ParkingReview from '../pages/ParkingReview';


const CANCELLATION_OPTIONS = [
  {
    id: 'option_a',
    label: 'Change of travel or commute plans',
  },
  {
    id: 'option_b',
    label: 'Booked the wrong dates or parking bay',
  },
  {
    id: 'option_c',
    label: 'Found alternative transportation or parking',
  },
  {
    id: 'other',
    label: 'Other',
  },
] as const;

export interface MyParkingPassesWorkspaceProps {
  token?: string;
  bookings: Booking[];
  onRefreshBookings: () => Promise<void> | void;
  onRefreshWallet?: () => Promise<void> | void;
  onNavigateToMap: (booking: Booking) => void;
  onOpenSupport: (booking: Booking) => void;
  onFindMoreParking: () => void;
  onBookingUnlocked?: (bookingId: number) => void;
  onBookingCompleted?: (booking: Booking) => void;
  onDetailViewChange?: (isDetail: boolean) => void;
  onReviewSubmitted?: (booking: Booking) => void;
}

type SubViewMode = 'grid' | 'bollard' | 'confirmation' | 'completed_review';

function formatBookingDate(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-MY', displayDateOptions({
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }));
}

function formatInclusiveEndDate(startDate: Date, endDate: Date): Date {
  if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) return endDate;
  // Backend stores EndDate as exclusive midnight when time is 00:00:00 and > startDate
  if (
    endDate.getHours() === 0 &&
    endDate.getMinutes() === 0 &&
    endDate.getTime() - startDate.getTime() >= 24 * 60 * 60 * 1000
  ) {
    const inclusive = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
    if (inclusive >= startDate) return inclusive;
  }
  return endDate;
}

export const MyParkingPassesWorkspace: React.FC<MyParkingPassesWorkspaceProps> = ({
  token,
  bookings,
  onRefreshBookings,
  onRefreshWallet,
  onNavigateToMap,
  onOpenSupport,
  onFindMoreParking,
  onBookingUnlocked,
  onBookingCompleted,
  onReviewSubmitted,
  onDetailViewChange,
}) => {
  const [subView, setSubView] = useState<SubViewMode>('grid');
  const bollardScreenRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => onDetailViewChange?.(false), [onDetailViewChange]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  // Per-booking bollard state (tracks whether each booking's bollard is currently unlocked/lowered)
  const [unlockedByBookingId, setUnlockedByBookingId] = useState<Record<string, boolean | undefined>>({});
  const [openedOnceByBookingId, setOpenedOnceByBookingId] = useState<Record<string, boolean>>({});
  const [lastCommandByBookingId, setLastCommandByBookingId] = useState<Record<string, boolean>>({});
  const [bollardMotion, setBollardMotion] = useState<'idle' | 'lowering' | 'raising'>('idle');
  const [isCheckingPosition, setIsCheckingPosition] = useState(false);
  const [bollardStatus, setBollardStatus] = useState<IoTStatusData | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);
  const [iotError, setIotError] = useState<string | null>(null);
  const [iotStatusNote, setIotStatusNote] = useState<string | null>(null);
  const [pendingUnlock, setPendingUnlock] = useState<UnlockChallenge | null>(null);
  const activeCommand = useRef<AbortController | null>(null);

  useEffect(() => () => activeCommand.current?.abort(), []);

  useEffect(() => {
    if (!pendingUnlock) return;
    const expiresIn = Math.max(0, parseTimestamp(pendingUnlock.expiresAt).getTime() - Date.now());
    const timeout = window.setTimeout(() => {
      setPendingUnlock((current) => current === pendingUnlock ? null : current);
    }, expiresIn);
    return () => window.clearTimeout(timeout);
  }, [pendingUnlock]);

  // Cancel modal state ("Tell us why?")
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedCancelOption, setSelectedCancelOption] = useState<string>('option_a');
  const [otherCancelReason, setOtherCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [copiedReference, setCopiedReference] = useState(false);

  const selectedBooking =
    bookings.find((b) => b.id === selectedBookingId || String(b.bookingId) === selectedBookingId) ??
    null;

  // Keep selectedBooking enriched with local openedOnce state
  const effectiveBooking: Booking | null = selectedBooking
    ? {
        ...selectedBooking,
        hasOpenedBollard:
          Boolean(selectedBooking.hasOpenedBollard) ||
          Boolean(selectedBooking.checkedInAt) ||
          Boolean(openedOnceByBookingId[selectedBooking.id]),
      }
    : null;

  const isSelectedUnlocked = effectiveBooking
    ? Boolean(unlockedByBookingId[effectiveBooking.id])
    : false;

  useEffect(() => {
    const bookingId = selectedBooking?.bookingId;
    const bookingKey = selectedBooking?.id;
    if (subView !== 'bollard' || !bookingId || !bookingKey || !token) return;
    const controller = new AbortController();
    setIsCheckingPosition(true);
    setIotError(null);
    setIotStatusNote(null);
    setPositionError(null);
    setBollardStatus(null);
    setUnlockedByBookingId(previous => ({ ...previous, [bookingKey]: undefined }));
    setLastCommandByBookingId(previous => { const next = { ...previous }; delete next[bookingKey]; return next; });
    void getBookingBollardStatus(token, bookingId, controller.signal)
      .then(status => {
        if (controller.signal.aborted) return;
        setBollardStatus(status);
        setUnlockedByBookingId(previous => ({ ...previous, [bookingKey]: status.bollardPosition === null ? undefined : status.bollardPosition === 'UNLOCKED' }));
      })
      .catch(error => {
        if (!controller.signal.aborted) setPositionError(error instanceof Error ? error.message : 'Unable to check the bollard position.');
      })
      .finally(() => { if (!controller.signal.aborted) setIsCheckingPosition(false); });
    return () => controller.abort();
  }, [subView, selectedBooking?.bookingId, selectedBooking?.id, token, statusRefreshKey]);

  const isDetailView = subView !== 'grid' && effectiveBooking !== null;
  useEffect(() => { onDetailViewChange?.(isDetailView); }, [isDetailView, onDetailViewChange]);

  useLayoutEffect(() => {
    if (subView !== 'bollard') return;
    const screen = bollardScreenRef.current;
    if (!screen) return;
    window.scrollTo(0, 0);
    const content = screen.closest('.commuter-content-grid');
    const visualSpace = screen.querySelector<HTMLElement>('[data-bollard-visual-space]');
    let frame = 0;
    const update = () => {
      const bottomPadding = content ? parseFloat(getComputedStyle(content).paddingBottom) || 0 : 16;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const available = Math.max(0, Math.floor(viewportHeight - screen.getBoundingClientRect().top - bottomPadding - 1));
      const height = available + 'px';
      if (screen.style.getPropertyValue('--bollard-screen-height') !== height) screen.style.setProperty('--bollard-screen-height', height);
      screen.dataset.compact = String(available < 590);
      if (visualSpace) screen.style.setProperty('--bollard-visual-scale', String(Math.min(1, Math.max(0.2, visualSpace.clientHeight / 160))));
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    observer.observe(content ?? screen.parentElement ?? screen);
    if (visualSpace) observer.observe(visualSpace);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    update(); schedule();
    const settled = window.setTimeout(schedule, 400);
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame); window.clearTimeout(settled);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [subView, selectedBookingId]);

  const handleOpenBollardView = (booking: Booking) => {
    setSelectedBookingId(booking.id);
    setIsCheckingPosition(Boolean(token && booking.bookingId));
    setPositionError(null);
    setIotError(null);
    setIotStatusNote(null);
    setPendingUnlock(null);
    setSubView('bollard');
  };

  const handleOpenConfirmationView = (booking: Booking) => {
    setSelectedBookingId(booking.id);
    setCancelError(null);
    setShowCancelModal(false);
    setSubView('confirmation');
  };

  const handleCopyBookingRef = async (refText: string) => {
    try {
      await navigator.clipboard.writeText(refText);
      setCopiedReference(true);
      window.setTimeout(() => setCopiedReference(false), 1800);
    } catch {
      // ignore clipboard failure
    }
  };

  const handleToggleBollard = async (targetUnlock: boolean) => {
    if (!effectiveBooking || activeCommand.current || isCheckingPosition) return;
    const numericId = effectiveBooking.bookingId;
    if (!token || !numericId) {
      setIotError('Sign in and select a confirmed booking to control its bollard.');
      return;
    }

    const controller = new AbortController();
    activeCommand.current = controller;
    const { signal } = controller;
    const bookingKey = effectiveBooking.id;
    setLastCommandByBookingId((previous) => ({ ...previous, [bookingKey]: targetUnlock }));
    setIotError(null);
    setIotStatusNote(null);
    setBollardMotion(targetUnlock ? 'lowering' : 'raising');

    const forgetPosition = () => {
      setUnlockedByBookingId((previous) => ({ ...previous, [bookingKey]: undefined }));
    };

    try {
      if (targetUnlock) {
        let challenge = pendingUnlock?.bookingId === numericId && isUnlockChallengeCurrent(pendingUnlock)
          ? pendingUnlock
          : null;
        let device: Awaited<ReturnType<typeof findRememberedBollard>>;
        if (!challenge) {
          challenge = await prepareBollardUnlock(token, numericId, signal);
          signal.throwIfAborted();
          setPendingUnlock(challenge);
          device = await findRememberedBollard(challenge);
          if (!device) return;
        }

        const result = await completeBollardUnlock(token, challenge, {
          device,
          signal,
          onSubmitted: () => {
            setPendingUnlock(null);
            forgetPosition();
          },
        });
        signal.throwIfAborted();
        setUnlockedByBookingId((previous) => ({ ...previous, [bookingKey]: true }));
        setOpenedOnceByBookingId((previous) => ({ ...previous, [bookingKey]: true }));
        setIotStatusNote(result.message || 'Bollard lowered. You may pull into your reserved bay.');
        onBookingUnlocked?.(numericId);
      } else {
        setPendingUnlock(null);
        forgetPosition();
        const result = await performLockBollardCommand(token, numericId);
        signal.throwIfAborted();
        setUnlockedByBookingId((previous) => ({ ...previous, [bookingKey]: false }));
        setIotStatusNote(result.message || 'Bollard locked and secured.');

        const completionCheck = await getBookingIsLastDay(token, numericId).catch(() => null);
        signal.throwIfAborted();
        const inclusiveEnd = formatInclusiveEndDate(effectiveBooking.startTime, effectiveBooking.endTime);
        const isBookingComplete = completionCheck
          ? completionCheck.isLastDay || completionCheck.isComplete
          : new Date().toLocaleDateString('en-CA', displayDateOptions()) >= inclusiveEnd.toLocaleDateString('en-CA', displayDateOptions());

        if (isBookingComplete) {
          onBookingCompleted?.(effectiveBooking);
          setSubView('completed_review');
        }
      }

      try {
        await onRefreshBookings();
      } catch {
        if (!signal.aborted) {
          setIotStatusNote((message) => `${message ?? ''} Refresh My Passes to update your booking.`.trim());
        }
      }
    } catch (error) {
      if (!signal.aborted) {
        setIotError(error instanceof Error ? error.message : 'Unable to control the bollard. Try again.');
      }
    } finally {
      activeCommand.current = null;
      if (!signal.aborted) setBollardMotion('idle');
    }
  };

  const handleSubmitCancellation = async () => {
    if (!effectiveBooking || !effectiveBooking.bookingId || !token) return;

    const chosenOption = CANCELLATION_OPTIONS.find((opt) => opt.id === selectedCancelOption);
    const reasonText =
      selectedCancelOption === 'other'
        ? otherCancelReason.trim()
        : chosenOption?.label || 'Cancelled by commuter';

    if (selectedCancelOption === 'other' && !reasonText) {
      setCancelError('Please enter your reason for cancelling.');
      return;
    }

    setIsCancelling(true);
    setCancelError(null);

    try {
      await cancelBooking(token, {
        bookingId: effectiveBooking.bookingId,
        cancellationReason: reasonText,
      });
      setShowCancelModal(false);
      await onRefreshBookings();
      if (onRefreshWallet) {
        await onRefreshWallet();
      }
      setSubView('grid');
      setSelectedBookingId(null);
    } catch (err) {
      setCancelError(
        err instanceof Error ? err.message : 'Unable to cancel this booking.',
      );
    } finally {
      setIsCancelling(false);
    }
  };

  // ─── VIEW 4: BOOKING COMPLETED + REVIEW (LAST DAY ONLY) ───
  if (subView === 'completed_review' && effectiveBooking) {
    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="rounded-3xl border border-emerald-200/80 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-50/90 via-white to-blue-50/50 dark:from-emerald-950/30 dark:via-[#141417] dark:to-[#141417] p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                <CheckCircle2 size={30} />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  <Sparkles size={12} /> Final Day Completed
                </span>
                <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#111] dark:text-white">
                  Booking Complete!
                </h2>
                <p className="mt-1 text-sm text-[#5f6368] dark:text-[#A1A1AA]">
                  Bollard has been locked and your reservation at{' '}
                  <strong className="text-[#111] dark:text-white">
                    {effectiveBooking.spot.propertyName || effectiveBooking.spot.name} (Bay{' '}
                    {effectiveBooking.spot.parkingLabel})
                  </strong>{' '}
                  is now complete. You can leave a review below or anytime later from Booking History.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSubView('grid');
                setSelectedBookingId(null);
              }}
              className="self-start sm:self-center shrink-0 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1C1C1E] px-4 py-2.5 text-xs font-bold text-[#111] dark:text-white hover:bg-slate-50 dark:hover:bg-[#2C2C2E] transition-colors cursor-pointer"
            >
              Return to My Passes
            </button>
          </div>
        </div>

        <ParkingReview
          spot={effectiveBooking.spot}
          bookingId={effectiveBooking.bookingId ?? null}
          bookingReference={
            effectiveBooking.bookingReference ||
            (effectiveBooking.bookingId ? `PJ-${effectiveBooking.bookingId}` : null)
          }
          vehiclePlate={effectiveBooking.vehiclePlate}
          bookedAt={effectiveBooking.startTime}
          totalPaid={effectiveBooking.totalPaid}
          token={token}
          onBack={() => {
            setSubView('grid');
            setSelectedBookingId(null);
          }}
          onSubmitReview={() => {
            if (onReviewSubmitted) {
              onReviewSubmitted(effectiveBooking);
            }
            setSubView('grid');
            setSelectedBookingId(null);
          }}
        />
      </div>
    );
  }

  // ─── VIEW 3: BOOKING CONFIRMATION + CANCEL SCREEN (AFTER PRESSING CONFIGURE ⋮) ───
  if (subView === 'confirmation' && effectiveBooking) {
    const inclusiveEnd = formatInclusiveEndDate(
      effectiveBooking.startTime,
      effectiveBooking.endTime,
    );
    const diffDays = Math.max(
      1,
      Math.round(
        (inclusiveEnd.getTime() - effectiveBooking.startTime.getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1,
    );
    const bookedDays = effectiveBooking.bookedDays || diffDays;
    const totalPaid = effectiveBooking.totalPaid ?? 0;
    const platformFee =
      effectiveBooking.platformFee ?? Number((totalPaid * 0.1).toFixed(2));
    const rentalSubtotal =
      effectiveBooking.rentalSubtotal ?? Number((totalPaid - platformFee).toFixed(2));
    const ratePerDay =
      effectiveBooking.ratePerDay ??
      effectiveBooking.spot.dailyRate ??
      Number((totalPaid / Math.max(1, bookedDays)).toFixed(2));
    const bookingRef =
      effectiveBooking.bookingReference ||
      `PJ-${String(effectiveBooking.bookingId ?? effectiveBooking.id).padStart(6, '0')}`;

    const eligibility = evaluateBookingCancellationEligibility({
      ...effectiveBooking,
      status: isSelectedUnlocked ? 'Active' : effectiveBooking.status,
    });

    const googleMapsUrl =
      effectiveBooking.spot.latitude && effectiveBooking.spot.longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${effectiveBooking.spot.latitude},${effectiveBooking.spot.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            effectiveBooking.spot.address || effectiveBooking.spot.name,
          )}`;

    return (
      <div className="w-full max-w-7xl mx-auto space-y-4 animate-in fade-in duration-200">
        {/* Top Navigation Bar */}
        <nav aria-label="Receipt navigation" className="mx-auto w-full max-w-7xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setSubView('grid')}
            className="inline-flex min-h-10 self-start items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            <ArrowLeft size={15} /> Back to My Passes
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateToMap(effectiveBooking)}
              className="workspace-button workspace-button--secondary"
            >
              <Navigation size={14} /> Transit Map
            </button>
            <button
              type="button"
              onClick={() => handleOpenBollardView(effectiveBooking)}
              className="workspace-button workspace-button--primary"
            >
              <Unlock size={14} /> Open Bollard Control
            </button>
          </div>
        </nav>

        {/* 2-COLUMN FULL-PAGE LAYOUT (Utilizing Left and Right Space) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN: Hero Photo + Booking Dates + Barrier Access */}
          <div className="lg:col-span-7 space-y-4">
            {/* Spot Hero Card */}
            <div className="overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#141417] shadow-sm">
              <div className="relative h-56 sm:h-64 w-full overflow-hidden bg-slate-900">
                <ParkingPhoto key={effectiveBooking.spot.primaryImageUrl} src={effectiveBooking.spot.primaryImageUrl} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/15" />

                <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/95 px-3 py-1 text-[11px] font-bold text-white shadow-md backdrop-blur-md">
                    <CheckCircle2 size={13} /> Booking Confirmed
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white/95 dark:bg-black/80 px-3 py-1 text-[11px] font-extrabold text-[#111] dark:text-white backdrop-blur-md shadow-xs">
                    Bay {effectiveBooking.spot.parkingLabel}
                  </span>
                </div>

                <div className="absolute bottom-4 left-5 right-5 text-white">
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    {effectiveBooking.spot.propertyName || effectiveBooking.spot.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-white/85 flex items-center gap-1.5">
                    <MapPin size={13} className="shrink-0 text-sky-400" />
                    <span className="truncate">
                      {effectiveBooking.spot.address || effectiveBooking.spot.stationName || 'Kuala Lumpur'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Check-In & Check-Out Twin Box Inside Hero Card */}
              <div className="p-4 sm:p-5 border-t border-black/[0.06] dark:border-white/10 bg-[#f8f9fa] dark:bg-[#18181C]">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e6e73] dark:text-[#A1A1AA]">
                      Check-In Date
                    </p>
                    <p className="mt-1 text-sm sm:text-base font-extrabold text-[#111] dark:text-white">
                      {formatBookingDate(effectiveBooking.startTime)}
                    </p>
                    <p className="text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">
                      From 12:00 AM
                    </p>
                  </div>
                  <div className="border-l border-black/[0.08] dark:border-white/10 pl-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e6e73] dark:text-[#A1A1AA]">
                      Check-Out Date
                    </p>
                    <p className="mt-1 text-sm sm:text-base font-extrabold text-[#111] dark:text-white">
                      {formatBookingDate(inclusiveEnd)}
                    </p>
                    <p className="text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">
                      Until 11:59 PM ({bookedDays} day{bookedDays > 1 ? 's' : ''})
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Smart Barrier & Vehicle Info + Directions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#141417] p-4 flex items-start gap-3 shadow-xs">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-[#007AFF]">
                  <Car size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#111] dark:text-white">
                    Smart Bollard Access
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#5f6368] dark:text-[#A1A1AA]">
                    Assigned Plate:{' '}
                    <span className="font-mono font-bold text-[#111] dark:text-white break-all">
                      {effectiveBooking.vehiclePlate || 'Registered Vehicle'}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">
                    {effectiveBooking.hasOpenedBollard
                      ? 'Bollard has been unlocked during this booking'
                      : 'Bollard has not been opened yet'}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#141417] p-4 flex flex-col justify-between gap-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#111] dark:text-white">
                    Directions &amp; Navigation
                  </span>
                  <Navigation size={15} className="text-[#007AFF]" />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onNavigateToMap(effectiveBooking)}
                    className="workspace-button workspace-button--secondary flex-1"
                  >
                    Transit Map
                  </button>
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="workspace-button workspace-button--secondary"
                  >
                    Google Maps <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Payment Receipt + Reference + Cancellation Card */}
          <div className="lg:col-span-5 space-y-4">
            {/* Price Breakdown Receipt */}
            <div className="rounded-3xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#141417] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#111] dark:text-white">
                  <Receipt size={15} className="text-[#007AFF]" />
                  <span>Payment Receipt</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/50">
                  Paid
                </span>
              </div>

              <div className="space-y-2 text-xs text-[#5f6368] dark:text-[#A1A1AA] pt-1">
                <div className="flex justify-between">
                  <span>
                    RM {ratePerDay.toFixed(2)} &times; {bookedDays} day
                    {bookedDays > 1 ? 's' : ''}
                  </span>
                  <span className="font-semibold text-[#111] dark:text-white">
                    RM {rentalSubtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Included platform service fee</span>
                  <span>RM {platformFee.toFixed(2)}</span>
                </div>
                <div className="border-t border-black/[0.06] dark:border-white/10 pt-2.5 flex justify-between items-baseline">
                  <span className="text-sm font-extrabold text-[#111] dark:text-white">
                    Total Paid
                  </span>
                  <span className="text-lg font-black text-[#007AFF]">
                    RM {totalPaid.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Booking Reference Copy Pill */}
              <div className="border-t border-black/[0.06] dark:border-white/10 pt-3 flex items-center justify-between rounded-2xl bg-[#f8f9fa] dark:bg-[#1C1C1E] px-3.5 py-2.5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e6e73] dark:text-[#A1A1AA]">
                    Booking Reference
                  </p>
                  <p className="font-mono text-xs font-bold text-[#111] dark:text-white mt-0.5">
                    {bookingRef}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyBookingRef(bookingRef)}
                  className="workspace-button workspace-button--secondary"
                >
                  {copiedReference ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  {copiedReference ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Cancel Booking Card */}
            <div className="rounded-3xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#141417] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#5f6368] dark:text-[#A1A1AA]">
                  Booking Management
                </h3>
                <span className="text-[10px] text-[#8e8e93] dark:text-[#71717A]">
                  24h Policy
                </span>
              </div>

              {!eligibility.canCancel && eligibility.reason && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/50 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{eligibility.reason}</span>
                </div>
              )}

              <button
                type="button"
                disabled={!eligibility.canCancel}
                onClick={() => {
                  setCancelError(null);
                  setShowCancelModal(true);
                }}
                className="workspace-button workspace-button--danger w-full"
              >
                Cancel Booking
              </button>

              <p className="text-center text-[11px] text-[#8e8e93] dark:text-[#71717A] leading-relaxed">
                Cancellation is available only within 24 hours of booking if the smart bollard has never been opened.
              </p>
            </div>
          </div>
        </div>

        {/* POP UP: "Tell us why?" Cancellation Modal */}
        {showCancelModal && (
          <div
            className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-reason-title"
          >
            <div className="w-full max-w-md rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#18181C] p-6 shadow-2xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3
                    id="cancel-reason-title"
                    className="text-lg font-extrabold text-[#111] dark:text-white"
                  >
                    Tell us why?
                  </h3>
                  <p className="mt-0.5 text-xs text-[#5f6368] dark:text-[#A1A1AA]">
                    Select a reason to cancel your booking for{' '}
                    <span className="font-semibold text-[#111] dark:text-white">
                      {effectiveBooking.spot.propertyName || effectiveBooking.spot.name}
                    </span>
                    .
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="rounded-full p-1.5 text-[#6e6e73] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2.5">
                {CANCELLATION_OPTIONS.map((option) => {
                  const checked = selectedCancelOption === option.id;
                  return (
                    <label
                      key={option.id}
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 text-xs font-semibold transition-all cursor-pointer ${
                        checked
                          ? 'border-[#007AFF] bg-[#007AFF]/[0.06] dark:bg-[#007AFF]/15 text-[#111] dark:text-white'
                          : 'border-black/[0.08] dark:border-white/10 text-[#5f6368] dark:text-[#A1A1AA] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancel-reason"
                        value={option.id}
                        checked={checked}
                        onChange={() => {
                          setSelectedCancelOption(option.id);
                          setCancelError(null);
                        }}
                        className="h-4 w-4 accent-[#007AFF]"
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}

                {selectedCancelOption === 'other' && (
                  <div className="pt-1">
                    <textarea
                      rows={3}
                      value={otherCancelReason}
                      onChange={(e) => setOtherCancelReason(e.target.value)}
                      placeholder="Please tell us your reason..."
                      className="w-full rounded-2xl border border-black/15 dark:border-white/15 bg-[#f8f9fa] dark:bg-[#141417] p-3 text-xs text-[#111] dark:text-white placeholder:text-[#9ca3af] focus:border-[#007AFF] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {cancelError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 p-3 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => setShowCancelModal(false)}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#5f6368] dark:text-[#A1A1AA] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                >
                  Keep Booking
                </button>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => void handleSubmitCancellation()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
                >
                  {isCancelling && <Loader2 size={14} className="animate-spin" />}
                  {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── VIEW 2: BOLLARD UP/DOWN ANIMATION + HIDDEN VERIFICATION TOGGLE + SUPPORT BUTTON ───
  if (subView === 'bollard' && effectiveBooking) {
    const inclusiveEnd = formatInclusiveEndDate(
      effectiveBooking.startTime,
      effectiveBooking.endTime,
    );
    const isMoving = bollardMotion !== 'idle';
    const hasConfirmedPosition = unlockedByBookingId[effectiveBooking.id] !== undefined;
    const canConnect = pendingUnlock !== null && pendingUnlock.bookingId === effectiveBooking.bookingId;
    const positionLabel = isCheckingPosition ? 'Checking position…' : !hasConfirmedPosition ? 'Position unconfirmed' : isSelectedUnlocked ? 'Unlocked (Down)' : 'Locked (Up)';
    const controlError = iotError || positionError;
    const toggleTargetUnlock = hasConfirmedPosition
      ? !isSelectedUnlocked
      : lastCommandByBookingId[effectiveBooking.id] ?? true;

    return (
      <div ref={bollardScreenRef} className="commuter-bollard-screen mx-auto w-full max-w-7xl">
        <nav aria-label="Bollard navigation" className="bollard-screen-nav">
          <button type="button" disabled={isMoving} onClick={() => { setPendingUnlock(null); setSubView('grid'); }} className="bollard-screen-back">
            <ArrowLeft size={16} aria-hidden="true" /><span><span className="hidden sm:inline">Back to </span>My Passes</span>
          </button>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Navigate" disabled={isMoving} onClick={() => onNavigateToMap(effectiveBooking)} className="workspace-button workspace-button--secondary bollard-nav-action">
              <Navigation size={16} aria-hidden="true" /><span className="hidden sm:inline">Navigate</span>
            </button>
            <button type="button" aria-label="Booking details" disabled={isMoving} onClick={() => handleOpenConfirmationView(effectiveBooking)} className="workspace-button workspace-button--secondary bollard-nav-action">
              <Receipt size={16} aria-hidden="true" /><span className="hidden sm:inline">Booking details</span>
            </button>
          </div>
        </nav>

        <section aria-label="Bollard control" className="workspace-panel commuter-bollard-card mx-auto w-full max-w-2xl">
          <header className="bollard-parking-summary">
            <h2 title={effectiveBooking.spot.propertyName || effectiveBooking.spot.name}>{effectiveBooking.spot.propertyName || effectiveBooking.spot.name}</h2>
            <div className="bollard-parking-meta">
              <span className="font-semibold text-foreground">Bay {effectiveBooking.spot.parkingLabel}</span>
              <span className="font-mono">{effectiveBooking.vehiclePlate}</span>
              <span>{formatBookingDate(effectiveBooking.startTime)} – {formatBookingDate(inclusiveEnd)}</span>
            </div>
          </header>

          <div className="bollard-compact-stage">
            <div className="bollard-stage-status">
              <p role="status" aria-live="polite" className="font-semibold">
                {isMoving ? (bollardMotion === 'lowering' ? 'Unlocking…' : 'Locking…') : positionLabel}
              </p>
              <div className="flex items-center gap-1">
                <details className="bollard-device-details">
                  <summary aria-label="Device status details" title="Device status details"><Info size={16} aria-hidden="true" /></summary>
                  <div className="bollard-device-popover"><BollardStatusDetails status={bollardStatus} />{!bollardStatus && <p className="text-sm text-muted-foreground">No device reading available yet.</p>}</div>
                </details>
                <button type="button" disabled={isMoving || isCheckingPosition} onClick={() => { setIsCheckingPosition(true); setStatusRefreshKey(value => value + 1); }} aria-label="Check position" title="Check position" className="bollard-status-refresh">
                  {isCheckingPosition ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}<span className="sr-only">Check position</span>
                </button>
              </div>
            </div>
            <div data-bollard-visual-space className="bollard-visual-space">
              <div role="img" aria-label={'Bollard animation: ' + positionLabel} className="bollard-compact-visual">
              {/* Bollard Post (Animates Up and Down into the Ground Slot) */}
              <div className="relative z-10 flex flex-col items-center justify-end h-32 w-28">
                <div
                  className={`w-14 rounded-t-2xl border-2 transition-all duration-700 ease-in-out flex flex-col items-center justify-between py-2 shadow-2xl ${
                    isSelectedUnlocked
                      ? 'h-4 translate-y-2 bg-emerald-500/80 border-emerald-300 shadow-emerald-500/30'
                      : 'h-28 translate-y-0 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 border-amber-200 shadow-amber-500/30'
                  }`}
                >
                  {/* LED Strip on Bollard Top */}
                  <div
                    className={`w-8 h-1.5 rounded-full transition-colors duration-500 ${
                      isSelectedUnlocked ? 'bg-emerald-200' : 'bg-white animate-pulse'
                    }`}
                  />
                  {/* Reflective Warning Stripes when Raised */}
                  {!isSelectedUnlocked && (
                    <div className="w-full px-1.5 space-y-1.5">
                      <div className="h-2 w-full rounded-xs bg-slate-950/75" />
                      <div className="h-2 w-full rounded-xs bg-slate-950/75" />
                    </div>
                  )}
                  <div className="text-[9px] font-black tracking-tighter text-slate-950">
                    PJ
                  </div>
                </div>
              </div>

              {/* Ground / Asphalt Base & Recess Slot */}
              <div className="relative z-20 w-full">
                <div className="mx-auto h-3 w-36 rounded-t-lg bg-slate-300 dark:bg-slate-700 border-t border-x border-slate-400 dark:border-slate-500 flex items-center justify-center">
                  <div className="h-1 w-20 rounded-full bg-slate-500 dark:bg-slate-900" />
                </div>
                <div className="h-5 w-full rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-between px-4">
                  <div className="h-1 w-10 bg-amber-400/70 rounded-full" />
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Bay {effectiveBooking.spot.parkingLabel} Surface
                  </span>
                  <div className="h-1 w-10 bg-amber-400/70 rounded-full" />
                </div>
              </div>
              </div>
            </div>

          </div>

          <div className="bollard-compact-controls">
            <button type="button" role="switch" aria-label="Bollard unlocked" aria-checked={hasConfirmedPosition && isSelectedUnlocked} aria-busy={isMoving || isCheckingPosition} aria-describedby="commuter-bollard-toggle-help"
              disabled={isMoving || isCheckingPosition || (!hasConfirmedPosition && lastCommandByBookingId[effectiveBooking.id] === undefined) || !token || !effectiveBooking.bookingId}
              onClick={() => void handleToggleBollard(toggleTargetUnlock)}
              className={'bollard-compact-switch ' + (hasConfirmedPosition && isSelectedUnlocked ? 'is-unlocked' : '')}>
              <span className={'bollard-switch-thumb ' + (hasConfirmedPosition ? (isSelectedUnlocked ? 'is-unlocked' : 'is-locked') : 'is-unknown')}>
                {isMoving || isCheckingPosition ? <Loader2 size={20} className="motion-safe:animate-spin" aria-hidden="true" /> : isSelectedUnlocked ? <Unlock size={20} aria-hidden="true" /> : <Lock size={20} aria-hidden="true" />}
              </span>
            </button>
            <div aria-hidden="true" className="bollard-switch-labels"><span>Lock</span><span>Unlock</span></div>
          </div>

          <footer className="bollard-compact-footer">
            <div id="commuter-bollard-toggle-help" className="bollard-compact-feedback">
              {controlError ? <p role="alert" className="text-rose-600 dark:text-rose-300">{controlError}</p>
                : iotStatusNote ? <p role="status" className="text-emerald-700 dark:text-emerald-300">{iotStatusNote}</p>
                : <p className="text-muted-foreground">{isCheckingPosition ? 'Loading the latest reported position…'
                : isMoving ? 'Waiting for device confirmation…'
                : canConnect ? 'Tap toggle again to connect Bluetooth.'
                : positionError ? 'Unable to load status. Tap refresh to retry.'
                : !hasConfirmedPosition ? 'Position unavailable. Tap refresh to check again.'
                : bollardStatus?.heartbeatStatus === 'offline' ? 'Device offline · last reported position'
                : isSelectedUnlocked ? 'Clear the bay before locking.' : 'Toggle to verify access and unlock.'}</p>}
            </div>
            <button type="button" onClick={() => onOpenSupport(effectiveBooking)} className="workspace-button workspace-button--secondary bollard-support-button"><Phone size={16} aria-hidden="true" />Get Support</button>
          </footer>
        </section>
      </div>
    );
  }

  // ─── VIEW 1: SQUARE PASS CARDS GRID (LIKE IN BROWSE) ───
  if (bookings.length === 0) {
    return (
      <div className="bg-white dark:bg-[#141417] rounded-3xl border border-[#e8eaed] dark:border-white/10 p-10 text-center">
        <Calendar size={36} className="mx-auto text-[#dadce0] dark:text-[#71717A] mb-3" />
        <p className="text-base font-bold text-[#111] dark:text-white">
          No active parking passes
        </p>
        <p className="text-xs text-[#5f6368] dark:text-[#A1A1AA] mt-1 max-w-sm mx-auto">
          Reserve one or more parking bays near LRT &amp; MRT stations to unlock and control your smart bollard here.
        </p>
        <button
          type="button"
          onClick={onFindMoreParking}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007AFF] text-white text-xs font-bold hover:bg-[#0066d6] transition-colors cursor-pointer"
        >
          <Plus size={15} /> Find a Parking Bay
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onFindMoreParking}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-bold text-white hover:bg-[#0066d6] transition-colors cursor-pointer shrink-0"
        >
          <Plus size={14} /> Book another spot
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {bookings.map((booking) => {
          const inclusiveEnd = formatInclusiveEndDate(
            booking.startTime,
            booking.endTime,
          );
          const isUnlocked = Boolean(unlockedByBookingId[booking.id]);
          const isActive = booking.status === 'Active' || isUnlocked;

          return (
            <article key={booking.id} className="parking-result workspace-panel">
              <div className="parking-result__photo">
                <ParkingPhoto key={booking.spot.primaryImageUrl} src={booking.spot.primaryImageUrl} />

                {/* Top-Left Status Badge */}
                <div className="absolute top-3 left-3 pointer-events-none">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-md backdrop-blur-md border ${
                      isUnlocked || booking.status === 'Active'
                        ? 'bg-emerald-500/95 text-white border-emerald-400/40'
                        : 'bg-white/95 dark:bg-[#1C1C1E]/95 text-[#111] dark:text-white border-black/5 dark:border-white/10'
                    }`}
                  >
                    {isUnlocked ? 'Unlocked' : booking.status}
                  </span>
                </div>

                {/* Top-Right Three Dots (⋮) Configuration Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenConfirmationView(booking);
                  }}
                  className="absolute top-3 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 hover:bg-black/70 text-white backdrop-blur-md border border-white/25 transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-sm"
                  aria-label="Configure booking or cancel"
                  title="Booking confirmation & cancellation"
                >
                  <MoreVertical size={16} />
                </button>

                {/* Bottom-Left Bay & Plate Overlay */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 text-white pointer-events-none">
                  <span className="shrink-0 rounded-lg bg-black/55 backdrop-blur-md px-2.5 py-1 text-[11px] font-extrabold border border-white/15">
                    Bay {booking.spot.parkingLabel}
                  </span>
                  <span
                    className="min-w-0 max-w-[60%] truncate font-mono text-[11px] font-bold bg-black/55 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/15"
                    title={booking.vehiclePlate}
                  >
                    {booking.vehiclePlate}
                  </span>
                </div>
              </div>

              {/* Card Details Below Square Image (Matches Sketch: Parking A, Period:, [lock/unlock] [navigate]) */}
              <div className="flex flex-1 flex-col justify-between space-y-2.5 p-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-[14px] font-bold text-[#111] dark:text-white truncate">
                      {booking.spot.propertyName || booking.spot.name}
                    </h3>
                    <span className="text-[12px] font-extrabold text-[#007AFF] shrink-0">
                      RM {(booking.totalPaid ?? 0).toFixed(2)}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#6e6e73] dark:text-[#A1A1AA] truncate">
                    <span className="font-semibold text-[#111] dark:text-white">Period:</span>{' '}
                    {formatBookingDate(booking.startTime)} &ndash;{' '}
                    {formatBookingDate(inclusiveEnd)}
                  </p>

                  {booking.spot.stationName && (
                    <p className="text-[11px] text-[#8e8e93] dark:text-[#71717A] flex items-center gap-1 truncate">
                      <MapPin size={11} className="text-[#007AFF] shrink-0" />
                      <span className="truncate">{booking.spot.stationName}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" onClick={() => onNavigateToMap(booking)} className={isActive ? 'workspace-button workspace-button--secondary' : 'workspace-button workspace-button--primary'}>
                    <Navigation size={15} aria-hidden="true" /> Navigate
                  </button>
                  <button type="button" onClick={() => handleOpenBollardView(booking)} className={isActive ? 'workspace-button workspace-button--primary' : 'workspace-button workspace-button--secondary'}>
                    {isUnlocked ? <Unlock size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
                    Gate controls
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default MyParkingPassesWorkspace;
