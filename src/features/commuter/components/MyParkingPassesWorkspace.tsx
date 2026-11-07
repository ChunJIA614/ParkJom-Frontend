import React, { useState } from 'react';
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
  Loader2,
  Lock,
  MapPin,
  MoreVertical,
  Navigation,
  Phone,
  Plus,
  Receipt,
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
  performHiddenUnlockFlow,
  performLockBollardCommand,
} from '../api/iotApi';
import ParkingReview from '../pages/ParkingReview';

const FALLBACK_SPOT_PHOTOS = [
  'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1545179605-1296651e9d43?w=800&auto=format&fit=crop&q=80',
];

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
  onReviewSubmitted?: (booking: Booking) => void;
}

type SubViewMode = 'grid' | 'bollard' | 'confirmation' | 'completed_review';

function formatBookingDate(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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
}) => {
  const [subView, setSubView] = useState<SubViewMode>('grid');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  // Per-booking bollard state (tracks whether each booking's bollard is currently unlocked/lowered)
  const [unlockedByBookingId, setUnlockedByBookingId] = useState<Record<string, boolean>>({});
  const [openedOnceByBookingId, setOpenedOnceByBookingId] = useState<Record<string, boolean>>({});
  const [bollardMotion, setBollardMotion] = useState<'idle' | 'lowering' | 'raising'>('idle');
  const [iotError, setIotError] = useState<string | null>(null);
  const [iotStatusNote, setIotStatusNote] = useState<string | null>(null);

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

  const handleOpenBollardView = (booking: Booking) => {
    setSelectedBookingId(booking.id);
    setIotError(null);
    setIotStatusNote(null);
    setBollardMotion('idle');
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
    if (!effectiveBooking || bollardMotion !== 'idle') return;
    setIotError(null);
    setIotStatusNote(null);

    const numericId = effectiveBooking.bookingId;

    if (targetUnlock) {
      // Hidden verification + Unlock
      setBollardMotion('lowering');
      try {
        if (!token || !numericId) {
          throw new Error('Authentication or valid Booking ID is required to unlock the bollard.');
        }

        const result = await performHiddenUnlockFlow(token, numericId);
        setUnlockedByBookingId((prev) => ({ ...prev, [effectiveBooking.id]: true }));
        setOpenedOnceByBookingId((prev) => ({ ...prev, [effectiveBooking.id]: true }));
        setIotStatusNote(result.message || 'Bollard lowered. You may pull into your reserved bay.');
        if (numericId && onBookingUnlocked) {
          onBookingUnlocked(numericId);
        }
        await onRefreshBookings();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Verification failed. Unable to unlock the bollard.';
        setIotError(message);
      } finally {
        setBollardMotion('idle');
      }
    } else {
      // Lock bollard + check if last day (/api/booking/{id}/isComplete)
      setBollardMotion('raising');
      try {
        if (!token || !numericId) {
          throw new Error('Authentication or valid Booking ID is required to lock the bollard.');
        }

        const lockResult = await performLockBollardCommand(token, numericId);
        setUnlockedByBookingId((prev) => ({ ...prev, [effectiveBooking.id]: false }));

        // Check /api/booking/{id}/isComplete
        const completionCheck = await getBookingIsLastDay(token, numericId).catch(() => null);
        const inclusiveEnd = formatInclusiveEndDate(
          effectiveBooking.startTime,
          effectiveBooking.endTime,
        );
        const todayStr = new Date().toLocaleDateString('en-CA');
        const endStr = inclusiveEnd.toLocaleDateString('en-CA');
        const isLastDayFallback = todayStr >= endStr;

        const isBookingCompleteNow = completionCheck
          ? completionCheck.isLastDay || completionCheck.isComplete
          : isLastDayFallback;

        if (isBookingCompleteNow) {
          if (onBookingCompleted) {
            onBookingCompleted(effectiveBooking);
          }
          await onRefreshBookings();
          setSubView('completed_review');
        } else {
          setIotStatusNote(
            lockResult.message ||
              `Bollard locked and secured for today. Your booking continues until ${formatBookingDate(inclusiveEnd)}.`,
          );
          await onRefreshBookings();
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to lock the bollard. Please check that your vehicle has cleared the bay.';
        setIotError(message);
      } finally {
        setBollardMotion('idle');
      }
    }
  };

  // Demo simulation helper when testing on a laptop without physical ESP32 hardware
  const handleSimulateBollardToggle = async (targetUnlock: boolean) => {
    if (!effectiveBooking || bollardMotion !== 'idle') return;
    setIotError(null);
    setIotStatusNote(null);

    if (targetUnlock) {
      setBollardMotion('lowering');
      await new Promise((r) => setTimeout(r, 900));
      setUnlockedByBookingId((prev) => ({ ...prev, [effectiveBooking.id]: true }));
      setOpenedOnceByBookingId((prev) => ({ ...prev, [effectiveBooking.id]: true }));
      setBollardMotion('idle');
      setIotStatusNote('Bollard unlocked and lowered into recess.');
      if (effectiveBooking.bookingId && onBookingUnlocked) {
        onBookingUnlocked(effectiveBooking.bookingId);
      }
    } else {
      setBollardMotion('raising');
      await new Promise((r) => setTimeout(r, 900));
      setUnlockedByBookingId((prev) => ({ ...prev, [effectiveBooking.id]: false }));
      setBollardMotion('idle');

      // Check backend /api/booking/{id}/isComplete even in simulation mode
      let isLastDay = false;
      if (token && effectiveBooking.bookingId) {
        const check = await getBookingIsLastDay(token, effectiveBooking.bookingId).catch(() => null);
        if (check) {
          isLastDay = check.isLastDay || check.isComplete;
        }
      }
      if (!isLastDay) {
        const inclusiveEnd = formatInclusiveEndDate(
          effectiveBooking.startTime,
          effectiveBooking.endTime,
        );
        const todayStr = new Date().toLocaleDateString('en-CA');
        const endStr = inclusiveEnd.toLocaleDateString('en-CA');
        isLastDay = todayStr >= endStr;
      }

      if (isLastDay) {
        if (onBookingCompleted) {
          onBookingCompleted(effectiveBooking);
        }
        setSubView('completed_review');
      } else {
        const inclusiveEnd = formatInclusiveEndDate(
          effectiveBooking.startTime,
          effectiveBooking.endTime,
        );
        setIotStatusNote(
          `Bollard locked for today (middle day of pass). Your reservation continues until ${formatBookingDate(inclusiveEnd)}.`,
        );
      }
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
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSubView('grid')}
            className="inline-flex items-center gap-2 rounded-xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#141417] px-3.5 py-2 text-xs font-bold text-[#111] dark:text-white hover:bg-slate-50 dark:hover:bg-[#1C1C1E] transition-colors cursor-pointer shadow-xs"
          >
            <ArrowLeft size={15} /> Back to My Passes
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateToMap(effectiveBooking)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#141417] px-3 py-2 text-xs font-bold text-[#007AFF] hover:bg-slate-50 dark:hover:bg-[#1C1C1E] transition-colors cursor-pointer"
            >
              <Navigation size={14} /> Transit Map
            </button>
            <button
              type="button"
              onClick={() => handleOpenBollardView(effectiveBooking)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-bold text-white hover:bg-[#0066d6] transition-colors cursor-pointer shadow-xs"
            >
              <Unlock size={14} /> Open Bollard Control
            </button>
          </div>
        </div>

        {/* 2-COLUMN FULL-PAGE LAYOUT (Utilizing Left and Right Space) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN: Hero Photo + Booking Dates + Barrier Access */}
          <div className="lg:col-span-7 space-y-4">
            {/* Spot Hero Card */}
            <div className="overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#141417] shadow-sm">
              <div className="relative h-56 sm:h-64 w-full overflow-hidden bg-slate-900">
                <img
                  src={
                    effectiveBooking.spot.primaryImageUrl || FALLBACK_SPOT_PHOTOS[0]
                  }
                  alt={effectiveBooking.spot.propertyName || effectiveBooking.spot.name}
                  className="h-full w-full object-cover"
                />
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
                    <span className="font-mono font-bold text-[#111] dark:text-white">
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
                    className="flex-1 rounded-xl bg-[#007AFF]/10 dark:bg-[#007AFF]/20 px-3 py-2 text-[11px] font-bold text-[#007AFF] hover:bg-[#007AFF]/20 transition-colors cursor-pointer text-center"
                  >
                    Transit Map
                  </button>
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl border border-black/10 dark:border-white/10 px-3 py-2 text-[11px] font-semibold text-[#111] dark:text-white hover:bg-slate-50 dark:hover:bg-white/5"
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/15 px-3 py-1.5 text-xs font-semibold text-[#111] dark:text-white hover:bg-slate-50 dark:hover:bg-white/15 transition-colors cursor-pointer shadow-xs"
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
                className={`w-full rounded-2xl py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  eligibility.canCancel
                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 cursor-pointer shadow-xs'
                    : 'bg-black/[0.04] dark:bg-white/[0.04] text-[#9ca3af] dark:text-[#71717A] border border-black/[0.06] dark:border-white/[0.06] cursor-not-allowed'
                }`}
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

    return (
      <div className="w-full max-w-7xl mx-auto space-y-4 animate-in fade-in duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSubView('grid')}
            className="inline-flex items-center gap-2 rounded-xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#141417] px-3.5 py-2 text-xs font-bold text-[#111] dark:text-white hover:bg-slate-50 dark:hover:bg-[#1C1C1E] transition-colors cursor-pointer shadow-xs"
          >
            <ArrowLeft size={15} /> Back to My Passes
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateToMap(effectiveBooking)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#141417] px-3 py-2 text-xs font-bold text-[#007AFF] hover:bg-slate-50 dark:hover:bg-[#1C1C1E] transition-colors cursor-pointer"
              title="Bring to map"
            >
              <Navigation size={14} /> Navigate
            </button>
            <button
              type="button"
              onClick={() => handleOpenConfirmationView(effectiveBooking)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#141417] px-3.5 py-2 text-xs font-bold text-[#111] dark:text-white hover:bg-slate-50 dark:hover:bg-[#1C1C1E] transition-colors cursor-pointer"
              aria-label="Configure booking"
              title="Booking details & cancellation"
            >
              <MoreVertical size={15} />
              <span>Details &amp; Cancel</span>
            </button>
          </div>
        </div>

        {/* 2-COLUMN FULL-PAGE LAYOUT (Utilizing Left & Right Space) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* LEFT COLUMN: Spot Summary + Visual Bollard Up/Down Animation Stage */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="h-full rounded-3xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#141417] p-6 shadow-sm flex flex-col justify-between space-y-4">
              {/* Spot Summary Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 dark:bg-[#007AFF]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#007AFF]">
                    Bay {effectiveBooking.spot.parkingLabel} &middot; {effectiveBooking.vehiclePlate}
                  </span>
                  <h2 className="mt-1.5 text-xl sm:text-2xl font-extrabold tracking-tight text-[#111] dark:text-white">
                    {effectiveBooking.spot.propertyName || effectiveBooking.spot.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#5f6368] dark:text-[#A1A1AA]">
                    Period: {formatBookingDate(effectiveBooking.startTime)} &ndash;{' '}
                    {formatBookingDate(inclusiveEnd)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider shrink-0 ${
                    isSelectedUnlocked
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {bollardMotion === 'lowering'
                    ? 'Lowering...'
                    : bollardMotion === 'raising'
                      ? 'Raising...'
                      : isSelectedUnlocked
                        ? 'Unlocked (Down)'
                        : 'Locked (Up)'}
                </span>
              </div>

              {/* 1. UPPER PART: BOLLARD UP & DOWN VISUAL ANIMATION */}
              <div className="relative flex-1 min-h-[260px] overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/10 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 text-white shadow-inner flex flex-col justify-between">
                {/* Status Indicator Top Row */}
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isMoving
                          ? 'bg-sky-400 animate-ping'
                          : isSelectedUnlocked
                            ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                            : 'bg-amber-400 shadow-[0_0_10px_#fbbf24]'
                      }`}
                    />
                    {isMoving
                      ? bollardMotion === 'lowering'
                        ? 'Verifying & Lowering Smart Bollard...'
                        : 'Checking Bay Clearance & Raising Bollard...'
                      : isSelectedUnlocked
                        ? 'Bollard Lowered (0°) — Bay Open for Vehicle'
                        : 'Bollard Raised (90°) — Bay Protected & Locked'}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    IoT Smart Barrier
                  </span>
                </div>

                {/* Animated Bollard Stage */}
                <div className="relative h-48 w-full flex flex-col items-center justify-end overflow-hidden pt-4">
                  {/* Motion Direction Arrows */}
                  <div className="absolute top-2 flex flex-col items-center">
                    <div
                      className={`text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full border backdrop-blur-xs transition-all duration-500 ${
                        isSelectedUnlocked
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                          : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {isSelectedUnlocked ? '▼ Lowered Into Ground' : '▲ Raised & Locked'}
                    </div>
                  </div>

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
                    <div className="mx-auto h-3 w-36 rounded-t-lg bg-slate-700 border-t border-x border-slate-500 flex items-center justify-center">
                      <div className="h-1 w-20 rounded-full bg-slate-900" />
                    </div>
                    <div className="h-5 w-full rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-between px-4">
                      <div className="h-1 w-10 bg-amber-400/70 rounded-full" />
                      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
                        Bay {effectiveBooking.spot.parkingLabel} Surface
                      </span>
                      <div className="h-1 w-10 bg-amber-400/70 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Error Display + Tactile Toggle + Support Button */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="h-full rounded-3xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#141417] p-6 shadow-sm flex flex-col justify-between space-y-6">
              {/* 2. ERROR / STATUS DISPLAY BOX */}
              <div className="min-h-[52px]">
                {iotError ? (
                  <div
                    role="alert"
                    className="rounded-2xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/50 p-4 text-xs text-rose-700 dark:text-rose-200 space-y-2.5 animate-in fade-in duration-150"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertCircle size={17} className="shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-bold text-rose-800 dark:text-rose-200">
                          Verification / Device Error
                        </p>
                        <p className="mt-0.5 leading-relaxed">{iotError}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-200/60 dark:border-rose-800/50">
                      <button
                        type="button"
                        onClick={() => void handleSimulateBollardToggle(!isSelectedUnlocked)}
                        className="rounded-lg bg-white/80 dark:bg-white/10 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-200 hover:bg-white dark:hover:bg-white/20 transition-colors cursor-pointer"
                      >
                        Simulate {isSelectedUnlocked ? 'Lock' : 'Unlock'} (Demo Override)
                      </button>
                    </div>
                  </div>
                ) : iotStatusNote ? (
                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/40 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
                    <ShieldCheck size={17} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{iotStatusNote}</span>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-[#f8f9fa] dark:bg-[#1C1C1E]/60 px-4 py-3 text-center text-xs text-[#6e6e73] dark:text-[#A1A1AA]">
                    Use the toggle switch below to unlock or lock the bollard. IoT Bluetooth &amp; GPS verification runs automatically in the background.
                  </div>
                )}
              </div>

              {/* 3. LOCK / UNLOCK TOGGLE SWITCH */}
              <div className="flex flex-col items-center justify-center py-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isSelectedUnlocked}
                  disabled={isMoving}
                  onClick={() => void handleToggleBollard(!isSelectedUnlocked)}
                  className={`relative flex h-16 w-64 items-center rounded-full p-2 transition-all duration-300 shadow-inner cursor-pointer disabled:opacity-60 disabled:cursor-wait ${
                    isSelectedUnlocked
                      ? 'bg-emerald-500 text-white shadow-emerald-500/25'
                      : 'bg-slate-200 dark:bg-[#242429] text-[#111] dark:text-white'
                  }`}
                >
                  {/* Background Labels */}
                  <div className="flex w-full items-center justify-between px-5 text-xs font-extrabold uppercase tracking-wider select-none">
                    <span className={isSelectedUnlocked ? 'opacity-90' : 'opacity-0'}>
                      Unlocked
                    </span>
                    <span className={!isSelectedUnlocked ? 'opacity-80' : 'opacity-0'}>
                      Locked
                    </span>
                  </div>

                  {/* Sliding Thumb */}
                  <div
                    className={`absolute top-2 bottom-2 w-28 rounded-full bg-white dark:bg-[#141417] shadow-lg flex items-center justify-center gap-1.5 text-xs font-extrabold transition-transform duration-300 ${
                      isSelectedUnlocked
                        ? 'translate-x-32 text-emerald-600 dark:text-emerald-400'
                        : 'translate-x-0 text-[#111] dark:text-white'
                    }`}
                  >
                    {isMoving ? (
                      <Loader2 size={16} className="animate-spin text-[#007AFF]" />
                    ) : isSelectedUnlocked ? (
                      <>
                        <Unlock size={16} />
                        <span>UNLOCK</span>
                      </>
                    ) : (
                      <>
                        <Lock size={16} />
                        <span>LOCK</span>
                      </>
                    )}
                  </div>
                </button>
                <p className="mt-2.5 text-[11px] font-medium text-[#6e6e73] dark:text-[#A1A1AA]">
                  {isSelectedUnlocked
                    ? 'Tap toggle to lock bollard when leaving the bay'
                    : 'Tap toggle to verify & unlock bollard'}
                </p>
              </div>

              {/* 4. BOTTOM SUPPORT BUTTON & QUICK ACTIONS */}
              <div className="flex items-center justify-between pt-3 border-t border-black/[0.06] dark:border-white/10">
                <span className="text-[11px] text-[#8e8e93] dark:text-[#71717A]">
                  Having trouble with the barrier?
                </span>
                <button
                  type="button"
                  onClick={() => onOpenSupport(effectiveBooking)}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/15 bg-[#f8f9fa] dark:bg-[#1C1C1E] px-4 py-2 text-xs font-bold text-[#111] dark:text-white hover:border-[#007AFF] hover:text-[#007AFF] transition-all shadow-xs cursor-pointer"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#007AFF] text-white">
                    <Phone size={12} />
                  </span>
                  <span>Get Support</span>
                </button>
              </div>
            </div>
          </div>
        </div>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#111] dark:text-white">
            My Parking Passes ({bookings.length})
          </h2>
          <p className="text-xs text-[#5f6368] dark:text-[#A1A1AA]">
            Select any pass to control its smart bollard, or use the top-right menu (&#8942;) to view confirmation details or cancel.
          </p>
        </div>
        <button
          type="button"
          onClick={onFindMoreParking}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-bold text-white hover:bg-[#0066d6] transition-colors cursor-pointer shrink-0"
        >
          <Plus size={14} /> Book Another Spot
        </button>
      </div>

      {/* Square Cards Grid (Matching Browse Card Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {bookings.map((booking, index) => {
          const inclusiveEnd = formatInclusiveEndDate(
            booking.startTime,
            booking.endTime,
          );
          const isUnlocked = Boolean(unlockedByBookingId[booking.id]);
          const photoUrl =
            booking.spot.primaryImageUrl ||
            FALLBACK_SPOT_PHOTOS[index % FALLBACK_SPOT_PHOTOS.length];

          return (
            <div
              key={booking.id}
              onClick={() => handleOpenBollardView(booking)}
              className="group cursor-pointer flex flex-col text-left select-none rounded-2xl p-2.5 -m-2.5 transition-all hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
            >
              {/* Square Image Container */}
              <div className="aspect-square w-full rounded-2xl overflow-hidden relative bg-slate-100 dark:bg-white/5 border border-black/[0.06] dark:border-white/10 shadow-xs">
                <img
                  src={photoUrl}
                  alt={booking.spot.propertyName || booking.spot.name}
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      FALLBACK_SPOT_PHOTOS[index % FALLBACK_SPOT_PHOTOS.length];
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/15 pointer-events-none" />

                {/* Top-Left Status Badge */}
                <div className="absolute top-3 left-3 pointer-events-none">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-md backdrop-blur-md border ${
                      isUnlocked || booking.status === 'Active'
                        ? 'bg-emerald-500/95 text-white border-emerald-400/40'
                        : 'bg-white/95 dark:bg-[#1C1C1E]/95 text-[#111] dark:text-white border-black/5 dark:border-white/10'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isUnlocked || booking.status === 'Active'
                          ? 'bg-white animate-pulse'
                          : 'bg-[#007AFF]'
                      }`}
                    />
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
                  className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 hover:bg-black/70 text-white backdrop-blur-md border border-white/25 transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-sm"
                  aria-label="Configure booking or cancel"
                  title="Booking confirmation & cancellation"
                >
                  <MoreVertical size={16} />
                </button>

                {/* Bottom-Left Bay & Plate Overlay */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white pointer-events-none">
                  <span className="rounded-lg bg-black/55 backdrop-blur-md px-2.5 py-1 text-[11px] font-extrabold border border-white/15">
                    Bay {booking.spot.parkingLabel}
                  </span>
                  <span className="font-mono text-[11px] font-bold bg-black/55 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/15">
                    {booking.vehiclePlate}
                  </span>
                </div>
              </div>

              {/* Card Details Below Square Image (Matches Sketch: Parking A, Period:, [lock/unlock] [navigate]) */}
              <div className="pt-3 px-1 flex-1 flex flex-col justify-between space-y-2.5">
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

                {/* Action Row: [Lock / Unlock] + [Navigate Icon Button] */}
                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenBollardView(booking);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] text-white py-2 px-3 text-xs font-bold transition-colors shadow-xs cursor-pointer"
                  >
                    {isUnlocked ? <Unlock size={13} /> : <Lock size={13} />}
                    <span>Lock / Unlock</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToMap(booking);
                    }}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1C1C1E] text-[#111] dark:text-white hover:border-[#007AFF] hover:text-[#007AFF] transition-colors shadow-xs cursor-pointer"
                    aria-label="Navigate on map"
                    title="Bring to map"
                  >
                    <Navigation size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyParkingPassesWorkspace;
