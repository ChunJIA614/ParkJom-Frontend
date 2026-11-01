import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  RefreshCw,
  Settings2,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  Booking,
  ParkingActionResult,
  ParkingAvailabilityStatus,
  ParkingBay,
} from '../types';
import {
  applyAiSpotPricing,
  computeClientSpotRecommendation,
  getOwnerPortfolioPricing,
  OwnerPortfolioPricingResponse,
  SpotPricingRecommendation,
} from '../api/dynamicPricingApi';
import AiPricingAdvisorCard from './AiPricingAdvisorCard';
import { getOwnerParkingWorkspace, localDateKey } from './AvailabilityScheduler';

/**
 * Overview panel. `bays` comes from Get My Parking and `bookings` from the
 * owner booking-history API — together they decide whether a bay is locked
 * today. The two navigation callbacks are the entry points for the infrequent
 * setup flow and the daily timetable flow.
 */
export interface DashboardHomeProps {
  bays: ParkingBay[];
  bookings?: Booking[];
  bookingsError?: string | null;
  baysLoading?: boolean;
  baysError?: string | null;
  onRefreshBays?: () => void | Promise<void>;
  onConfigureParking?: (parkingSpotId: number) => void;
  onOpenTimetable?: (parkingSpotId: number) => void;

  onUpdateAvailability?: (
    parkingSpotId: number,
    availabilityStatus: ParkingAvailabilityStatus,
  ) => Promise<ParkingActionResult>;
  onUpdatePublication?: (
    parkingSpotId: number,
    isPublished: boolean,
  ) => Promise<ParkingActionResult>;
  onDeleteParking?: (
    parkingSpotId: number,
  ) => Promise<ParkingActionResult>;
}

type StatusTone = 'green' | 'amber' | 'red' | 'blue' | 'slate';

const toneClasses: Record<StatusTone, { dot: string; text: string; chip: string }> = {
  green: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    chip: 'border-emerald-200 bg-emerald-50',
  },
  amber: {
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    chip: 'border-amber-200 bg-amber-50',
  },
  red: {
    dot: 'bg-rose-500',
    text: 'text-rose-700',
    chip: 'border-rose-200 bg-rose-50',
  },
  blue: {
    dot: 'bg-blue-500',
    text: 'text-blue-700',
    chip: 'border-blue-200 bg-blue-50',
  },
  slate: {
    dot: 'bg-slate-400',
    text: 'text-slate-600',
    chip: 'border-slate-200 bg-slate-50',
  },
};

function normalize(value: string | number | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function isApproved(verificationStatus: string | number): boolean {
  const value = normalize(verificationStatus);
  return value === 'approved' || value === 'verified' || value === '2';
}

function verificationStatus(bay: ParkingBay): { label: string; tone: StatusTone } {
  const value = normalize(bay.verificationStatus);
  if (value === 'rejected' || value === '3') return { label: 'Rejected', tone: 'red' };
  if (isApproved(bay.verificationStatus)) return { label: 'Approved', tone: 'green' };
  return { label: 'Pending review', tone: 'amber' };
}

function hasRate(bay: ParkingBay): boolean {
  return [bay.monthlyRate, bay.dailyRate, bay.hourlyRate].some(
    (rate) => typeof rate === 'number' && Number.isFinite(rate) && rate > 0,
  );
}

function setupStatus(bay: ParkingBay): { label: string; tone: StatusTone } {
  return hasRate(bay)
    ? { label: 'Configured', tone: 'green' }
    : { label: 'Needs setup', tone: 'amber' };
}

function publicationStatus(bay: ParkingBay): { label: string; tone: StatusTone } {
  return bay.isPublished
    ? { label: 'Published', tone: 'green' }
    : { label: 'Hidden', tone: 'slate' };
}

function dateKey(value: string): string | null {
  const isoDate = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isBookingForBay(booking: Booking, bay: ParkingBay): boolean {
  const bookingBay = normalize(booking.bayId);
  return bookingBay === normalize(bay.id)
    || bookingBay === String(bay.parkingSpotId)
    || normalize(booking.bayInfo).includes(normalize(bay.parkingLabel))
    || normalize(booking.bayInfo).includes(normalize(bay.bayNumber));
}

function scheduleStatus(
  bay: ParkingBay,
  bookings: Booking[],
): { label: string; detail: string; tone: StatusTone; locked: boolean } {
  const today = todayKey();
  const booking = bookings.find((item) => {
    if (!isBookingForBay(item, bay) || !item.date) return false;
    const bookingDate = dateKey(item.date);
    return bookingDate === today && item.status !== 'Completed';
  });

  if (booking) {
    const renter = booking.renterName || booking.renterPlate || 'commuter';
    return {
      label: booking.status === 'Active' ? 'Booked now' : 'Booked today',
      detail: `Reserved by ${renter}`,
      tone: 'blue',
      locked: true,
    };
  }

  const availability = normalize(bay.availabilityStatus);
  if (availability === 'occupied' || availability === 'reserved') {
    return {
      label: availability === 'occupied' ? 'Occupied' : 'Reserved',
      detail: 'Date is locked while this booking is active',
      tone: 'blue',
      locked: true,
    };
  }

  if (!bay.isPublished || !isApproved(bay.verificationStatus) || !hasRate(bay)) {
    return {
      label: 'Not bookable',
      detail: 'Finish setup and publish this parking spot',
      tone: 'slate',
      locked: false,
    };
  }

  if (availability === 'inactive' || availability === 'unavailable') {
    return {
      label: 'Not available',
      detail: 'Spot is temporarily marked unavailable',
      tone: 'amber',
      locked: false,
    };
  }

  if (availability === 'available') {
    return {
      label: 'Available for booking',
      detail: 'Spot is active and open for commuters',
      tone: 'green',
      locked: false,
    };
  }

  // Retain the local timetable only as a fallback when the API returns an unknown status.
  const localDay = getOwnerParkingWorkspace().spots[String(bay.parkingSpotId)]?.days[localDateKey()];
  if (localDay?.status === 'booked') {
    const renter = localDay.booking?.commuterName || localDay.booking?.vehicle || 'commuter';
    return { label: 'Booked today', detail: `Reserved by ${renter}`, tone: 'blue', locked: true };
  }
  if (localDay?.status === 'available') {
    return { label: 'Available for booking', detail: 'Today is open in the timetable', tone: 'green', locked: false };
  }

  return {
    label: 'Not available',
    detail: 'Availability status is not recognized',
    tone: 'slate',
    locked: false,
  };
}

function StatusLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: StatusTone;
}) {
  const classes = toneClasses[tone];
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${classes.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${classes.dot}`} aria-hidden="true" />
        {value}
      </span>
    </div>
  );
}

export default function DashboardHome({
  bays,
  bookings = [],
  bookingsError = null,
  baysLoading = false,
  baysError = null,
  onRefreshBays,
  onConfigureParking,
  onOpenTimetable,
  onDeleteParking,
}: DashboardHomeProps) {
  const { user } = useAuth();
  const [portfolioPricing, setPortfolioPricing] = useState<OwnerPortfolioPricingResponse | null>(null);
  const [applyingSpotId, setApplyingSpotId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (bays.length === 0) {
      setPortfolioPricing(null);
      return;
    }
    void getOwnerPortfolioPricing(user?.token, bays).then((result) => {
      if (!cancelled) {
        setPortfolioPricing(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bays, user?.token]);

  const recommendationMap = useMemo(() => {
    const map = new Map<number, SpotPricingRecommendation>();
    bays.forEach((bay) => {
      map.set(bay.parkingSpotId, computeClientSpotRecommendation(bay));
    });
    portfolioPricing?.recommendations?.forEach((rec) => {
      map.set(rec.parkingSpotId, rec);
    });
    return map;
  }, [bays, portfolioPricing]);

  const portfolioSummary = useMemo(() => {
    if (portfolioPricing) return portfolioPricing;
    const recommendations = Array.from(recommendationMap.values());
    const totalCurrentMonthlyRevenueRm = Number(
      recommendations.reduce((sum, s) => sum + s.currentMonthlyNetRevenueRm, 0).toFixed(2),
    );
    const totalProjectedMonthlyRevenueRm = Number(
      recommendations.reduce((sum, s) => sum + s.projectedMonthlyNetRevenueRm, 0).toFixed(2),
    );
    const totalExtraMonthlyRevenueRm = Number(
      Math.max(0, totalProjectedMonthlyRevenueRm - totalCurrentMonthlyRevenueRm).toFixed(2),
    );
    return {
      totalBaysCount: recommendations.length,
      optimizableBaysCount: recommendations.length,
      totalCurrentMonthlyRevenueRm,
      totalProjectedMonthlyRevenueRm,
      totalExtraMonthlyRevenueRm,
      averageOccupancyBoostPercent: 25,
      portfolioHeadline: '',
      recommendations,
    };
  }, [portfolioPricing, recommendationMap]);

  const handleApplyAiRate = async (
    parkingSpotId: number,
    dailyRateRm: number,
    monthlyRateRm: number,
  ) => {
    if (!user?.token) {
      onConfigureParking?.(parkingSpotId);
      return;
    }
    setApplyingSpotId(parkingSpotId);
    try {
      const result = await applyAiSpotPricing(
        user.token,
        parkingSpotId,
        dailyRateRm,
        monthlyRateRm,
      );
      if (result.success && onRefreshBays) {
        await onRefreshBays();
      } else if (!result.success) {
        onConfigureParking?.(parkingSpotId);
      }
    } catch {
      onConfigureParking?.(parkingSpotId);
    } finally {
      setApplyingSpotId(null);
    }
  };

  const today = new Intl.DateTimeFormat('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const publishedCount = bays.filter((bay) => bay.isPublished).length;
  const bookableCount = bays.filter((bay) => {
    const status = scheduleStatus(bay, bookings);
    return status.label === 'Available for booking';
  }).length;
  const lockedCount = bays.filter((bay) => scheduleStatus(bay, bookings).locked).length;

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">Property parking status</h2>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Current status across your parking spots · {today}</p>
          </div>
          {onRefreshBays && (
            <button
              type="button"
              onClick={() => void onRefreshBays()}
              disabled={baysLoading}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 self-start rounded-lg border border-slate-200 px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Refresh parking status"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${baysLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-100 py-3">
          <div className="px-3 first:pl-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Parking spots</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{bays.length}</p>
          </div>
          <div className="px-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Published</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{publishedCount}</p>
          </div>
          <div className="px-3 last:pr-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Locked today</p>
            <p className="mt-1 text-xl font-bold text-blue-600">{lockedCount}</p>
          </div>
        </div>

        {bays.length > 0 && portfolioSummary.totalBaysCount > 0 && (
          <div className="rounded-xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-emerald-50/60 p-3.5 dark:border-white/10 dark:bg-none dark:bg-black">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900">
                      AI Smart Dynamic Pricing Portfolio
                    </span>
                    {portfolioSummary.totalExtraMonthlyRevenueRm > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-[#30d158]/15 dark:text-[#30d158]">
                        <TrendingUp className="h-3 w-3" />
                        +RM {portfolioSummary.totalExtraMonthlyRevenueRm.toFixed(0)}/month upside
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    Elasticity model benchmarks station walk distance, off-peak (11 AM – 4 PM) slack, and transit hub demand.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 border-t border-blue-100 pt-2.5 sm:border-t-0 sm:pt-0 dark:border-white/10">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Current Est.</p>
                  <p className="text-sm font-bold text-slate-700">
                    RM {portfolioSummary.totalCurrentMonthlyRevenueRm.toFixed(0)}/mo
                  </p>
                </div>
                <div className="border-l border-blue-200 pl-4 dark:border-white/10">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-[#0a84ff]">AI Optimized</p>
                  <p className="text-sm font-black text-emerald-700 dark:text-[#30d158]">
                    RM {portfolioSummary.totalProjectedMonthlyRevenueRm.toFixed(0)}/mo
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {baysError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          <span className="inline-flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{baysError}</span>
          {onRefreshBays && <button type="button" onClick={() => void onRefreshBays()} className="font-semibold underline">Retry</button>}
        </div>
      )}

      {bookingsError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Today&apos;s bookings could not be loaded, so bays may show as available when they are not. {bookingsError}
          </span>
          {onRefreshBays && <button type="button" onClick={() => void onRefreshBays()} className="font-semibold underline">Retry</button>}
        </div>
      )}

      {baysLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-blue-600" aria-hidden="true" />
          <p className="mt-2 text-xs font-medium text-slate-500">Loading parking status...</p>
        </div>
      ) : bays.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <Building2 className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-700">No parking spots registered</p>
          <p className="mt-1 text-xs text-slate-500">Register a property before configuring its timetable.</p>
        </div>
      ) : (
        <section aria-label="Parking spot status" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {bays.map((bay) => {
            const verification = verificationStatus(bay);
            const setup = setupStatus(bay);
            const publication = publicationStatus(bay);
            const schedule = scheduleStatus(bay, bookings);
            const statusClasses = toneClasses[schedule.tone];
            const canConfigure = Boolean(onConfigureParking);
            const canOpenTimetable = Boolean(onOpenTimetable);
            const activeSpotBookings = bookings.filter(
              (item) =>
                isBookingForBay(item, bay) &&
                (item.status === 'Active' || item.status === 'Upcoming'),
            );
            const hasActiveBooking = schedule.locked || activeSpotBookings.length > 0;

            return (
              <article key={bay.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Building2 className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {bay.propertyName || `Property #${bay.propertyId}`}
                        </h3>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {bay.bayNumber || bay.parkingLabel} · Spot #{bay.parkingSpotId}
                          {bay.stationName && bay.stationName !== '—' ? ` · Near ${bay.stationName}` : ''}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClasses.chip} ${statusClasses.text}`}>
                        {schedule.locked ? <LockKeyhole className="h-3 w-3" aria-hidden="true" /> : <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                        {schedule.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-slate-100 px-3">
                  <StatusLine label="Verification" value={verification.label} tone={verification.tone} />
                  <StatusLine label="Initial setup" value={setup.label} tone={setup.tone} />
                  <StatusLine label="Publication" value={publication.label} tone={publication.tone} />
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-[11px] font-medium text-slate-500">Booking lock</span>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${schedule.locked ? 'text-blue-700' : 'text-slate-600'}`}>
                      {schedule.locked ? <LockKeyhole className="h-3 w-3" aria-hidden="true" /> : <Clock3 className="h-3 w-3" aria-hidden="true" />}
                      {schedule.locked ? 'Owner changes locked' : 'Timetable can be edited'}
                    </span>
                  </div>
                </div>

                {recommendationMap.get(bay.parkingSpotId) && (
                  <div className="mt-3">
                    <AiPricingAdvisorCard
                      variant="compact"
                      recommendation={recommendationMap.get(bay.parkingSpotId)!}
                      isApplying={applyingSpotId === bay.parkingSpotId}
                      onApplyRates={(daily, monthly) =>
                        void handleApplyAiRate(bay.parkingSpotId, daily, monthly)
                      }
                      onOpenSetup={
                        canConfigure ? () => onConfigureParking?.(bay.parkingSpotId) : undefined
                      }
                    />
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => onConfigureParking?.(bay.parkingSpotId)}
                    disabled={!canConfigure}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-[11px] font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
                    title={canConfigure ? 'Open parking setup' : 'Parking setup is not connected yet'}
                  >
                    <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Configure parking
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenTimetable?.(bay.parkingSpotId)}
                    disabled={!canOpenTimetable}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                    title={canOpenTimetable ? 'Open timetable' : 'Timetable is not connected yet'}
                  >
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    Open timetable
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {bays.length > 0 && bookableCount > 0 && (
        <p className="text-center text-[10px] text-slate-400">{bookableCount} parking spot{bookableCount === 1 ? '' : 's'} currently open for commuter booking.</p>
      )}
    </div>
  );
}
