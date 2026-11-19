import React, { useEffect, useMemo, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import {
  AlertCircle,
  Building2,
  CalendarCheck,
  CalendarDays,
  CircleCheck,
  CircleX,
  Clock3,
  Check,
  ImageOff,
  RefreshCw,
  Settings2,
  Sparkles,
  TrendingUp,
  X,
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
import { showConfirm } from '@/components/common/ModalProvider';
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
  onOpenSupport?: () => void;

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

type StatusTone = 'green' | 'amber' | 'blue' | 'slate';

const toneClasses: Record<StatusTone, { text: string; chip: string }> = {
  green: {
    text: 'text-emerald-700',
    chip: 'border-emerald-200 bg-emerald-50',
  },
  amber: {
    text: 'text-amber-700',
    chip: 'border-amber-200 bg-amber-50',
  },
  blue: {
    text: 'text-blue-700',
    chip: 'border-blue-200 bg-blue-50',
  },
  slate: {
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

function hasRate(bay: ParkingBay): boolean {
  return [bay.monthlyRate, bay.dailyRate, bay.hourlyRate].some(
    (rate) => typeof rate === 'number' && Number.isFinite(rate) && rate > 0,
  );
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

  if (!isApproved(bay.verificationStatus)) {
    const rejected = ['rejected', '3'].includes(normalize(bay.verificationStatus));
    return rejected
      ? { label: 'Verification rejected', detail: 'Verification needs attention', tone: 'slate', locked: false }
      : { label: 'Awaiting verification', detail: 'Verification is pending approval', tone: 'amber', locked: false };
  }

  if (!bay.isPublished || !hasRate(bay)) {
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

type ParkingStatusEntry = { bay: ParkingBay; schedule: ReturnType<typeof scheduleStatus> };

const parkingFilters = [
  { id: 'all', label: 'All', matches: () => true },
  { id: 'available', label: 'Available', matches: ({ schedule }: ParkingStatusEntry) => schedule.tone === 'green' },
  { id: 'booked', label: 'Booked', matches: ({ schedule }: ParkingStatusEntry) => schedule.locked },
  { id: 'attention', label: 'Needs attention', matches: ({ bay }: ParkingStatusEntry) => (
    !isApproved(bay.verificationStatus) || !(bay.isConfigurationComplete ?? hasRate(bay)) || !bay.hasAvailabilityRules || !bay.isPublished
  ) },
] as const;

type ParkingFilter = (typeof parkingFilters)[number]['id'];

function RateAmount({ rate, period }: { rate: number | null; period: 'day' | 'month' }) {
  const hasRate = rate !== null && Number.isFinite(rate) && rate > 0;
  const unit = period === 'day' ? 'day' : 'mo';

  return (
    <div className="min-w-0">
      <dt className="sr-only">{period === 'day' ? 'Daily rate' : 'Monthly rate'}</dt>
      <dd className="flex min-w-0 flex-wrap items-baseline gap-x-1 leading-tight">
        {hasRate ? (
          <span className="max-w-full break-words text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
            <span className="mr-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">RM</span>{rate.toFixed(2)}
          </span>
        ) : (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Not set</span>
        )}
        <span className="text-[10px] text-slate-500 dark:text-slate-400" aria-hidden="true">/{unit}</span>
      </dd>
    </div>
  );
}

function ParkingCover({ url, label }: { url?: string; label: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative flex h-36 items-center justify-center overflow-hidden bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
      {url && !failed ? (
        <img src={url} alt={label} loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <ImageOff className="h-8 w-8" aria-label="Parking photo unavailable" />
      )}
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
  onOpenSupport,
}: DashboardHomeProps) {
  const { user } = useAuth();
  const [parkingFilter, setParkingFilter] = useState<ParkingFilter>('all');
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
    const bay = bays.find((item) => item.parkingSpotId === parkingSpotId);
    const confirmed = await showConfirm({
      title: 'Apply suggested rates?',
      message: `Set ${bay?.parkingLabel || 'this parking spot'} to RM ${dailyRateRm.toFixed(2)} per day and RM ${monthlyRateRm.toFixed(2)} per month?`,
      confirmText: 'Apply rates',
      variant: 'info',
      icon: 'info',
    });
    if (!confirmed) return;

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

  const parkingStatuses = bays.map((bay) => ({ bay, schedule: scheduleStatus(bay, bookings) }));
  const filters = parkingFilters.map((filter) => ({ ...filter, spots: parkingStatuses.filter(filter.matches) }));
  const visibleParking = (filters.find((filter) => filter.id === parkingFilter) ?? filters[0]).spots;
  const publishedCount = bays.filter((bay) => bay.isPublished).length;
  const bookableCount = filters.find(({ id }) => id === 'available')?.spots.length ?? 0;
  const lockedCount = filters.find(({ id }) => id === 'booked')?.spots.length ?? 0;

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

      {bays.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">My parking</h2>
            <p role="status" className="text-xs text-slate-500 dark:text-slate-400">{visibleParking.length} of {bays.length} spots</p>
          </div>
          <div role="group" aria-label="Filter parking spots" className="flex flex-wrap gap-2">
            {filters.map(({ id, label, spots }) => (
              <button
                key={id}
                type="button"
                aria-pressed={parkingFilter === id}
                onClick={() => setParkingFilter(id)}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${parkingFilter === id
                  ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/10'}`}
              >
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${parkingFilter === id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`} aria-hidden="true">{spots.length}</span>
              </button>
            ))}
          </div>
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
      ) : visibleParking.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-7 text-center dark:border-white/15">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No parking spots match this filter.</p>
          <button type="button" onClick={() => setParkingFilter('all')} className="mt-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">Show all spots</button>
        </div>
      ) : (
        <section aria-label="Parking spot status" className="grid grid-cols-1 gap-2 sm:gap-4 landscape:grid-cols-3">
          {visibleParking.map(({ bay, schedule }) => {
            const statusClasses = toneClasses[schedule.tone];
            const StatusIcon = { blue: CalendarCheck, green: CircleCheck, amber: Clock3, slate: CircleX }[schedule.tone];
            const canConfigure = Boolean(onConfigureParking);
            const canOpenTimetable = Boolean(onOpenTimetable);
            const recommendation = recommendationMap.get(bay.parkingSpotId);
            const verificationRejected = ['rejected', '3'].includes(normalize(bay.verificationStatus));
            const configure = onConfigureParking && (() => onConfigureParking(bay.parkingSpotId));
            const openTimetable = onOpenTimetable && (() => onOpenTimetable(bay.parkingSpotId));
            const steps = [
              {
                label: 'Verify',
                complete: isApproved(bay.verificationStatus),
                hint: verificationRejected ? 'Contact Support about your verification.' : 'Verification is awaiting review.',
                action: verificationRejected ? onOpenSupport : undefined,
              },
              {
                label: 'Set up',
                complete: bay.isConfigurationComplete ?? hasRate(bay),
                hint: 'Finish your listing details.',
                action: configure,
              },
              {
                label: 'Schedule',
                complete: bay.hasAvailabilityRules ?? false,
                hint: 'Add bookable dates in the timetable.',
                action: openTimetable,
              },
              {
                label: 'Publish',
                complete: bay.isPublished,
                hint: 'Open Configure parking to publish your listing.',
                action: configure,
              },
            ];
            const nextStepIndex = steps.findIndex((step) => !step.complete);
            const nextStep = steps[nextStepIndex];
            const completedSteps = steps.filter((step) => step.complete).length;

            return (
              <article key={bay.id} className="@container flex w-full min-w-0 max-w-sm flex-col overflow-hidden rounded-2xl landscape:max-w-none border border-slate-200 bg-white shadow-sm dark:border-white/10">
                <ParkingCover key={bay.imageUrl} url={bay.imageUrl} label={`Parking at ${bay.propertyName}, bay ${bay.parkingLabel}`} />
                <div className="flex flex-1 flex-col p-2 @min-[15rem]:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-bold text-slate-900 dark:text-white">
                        {bay.propertyName || `Property #${bay.propertyId}`}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {bay.parkingLabel || bay.bayNumber}
                        {bay.stationName && bay.stationName !== '—' ? ` · Near ${bay.stationName}` : ''}
                      </p>
                    </div>
                    <span title={schedule.detail} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClasses.chip} ${statusClasses.text}`}>
                      <StatusIcon className="size-3 shrink-0" aria-hidden="true" />
                      {schedule.label}
                    </span>
                  </div>

                  <div className="mt-4 border-y border-slate-100 py-3 dark:border-white/10">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-white">Listing checklist</h4>
                      <span className="text-[10px] font-medium tabular-nums text-slate-500 dark:text-slate-400">{completedSteps} of {steps.length} complete</span>
                    </div>
                    <ol aria-label="Publishing checklist" className="mt-3 grid grid-cols-4">
                      {steps.map(({ label, complete, action }, index) => {
                        const current = index === nextStepIndex;
                        const marker = (
                          <>
                            <span className={`relative grid size-6 shrink-0 place-items-center rounded-full border text-[10px] font-semibold @min-[15rem]:size-7 ${complete
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-400'
                              : current
                                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                                : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-400'}`} aria-hidden="true">
                              {complete ? <Check className="size-3.5" strokeWidth={2} /> : index + 1}
                            </span>
                            <span className="w-full break-words text-[10px] leading-tight">{label}</span>
                            <span className="sr-only">{complete ? ' complete' : ' incomplete'}</span>
                          </>
                        );
                        const stepClass = `relative flex w-full min-w-0 flex-col items-center gap-1.5 text-center ${current ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-400'}`;

                        return (
                          <li key={label} aria-current={current ? 'step' : undefined} className="relative min-w-0">
                            {index < steps.length - 1 && (
                              <span aria-hidden="true" className={`absolute left-[calc(50%+0.85rem)] right-[calc(-50%+0.85rem)] top-3 h-px @min-[15rem]:left-[calc(50%+1.05rem)] @min-[15rem]:right-[calc(-50%+1.05rem)] @min-[15rem]:top-3.5 ${complete && steps[index + 1].complete ? 'bg-emerald-200 dark:bg-emerald-400/30' : 'bg-slate-200 dark:bg-white/15'}`} />
                            )}
                            {current && action ? (
                              <button type="button" onClick={action} className={`${stepClass} cursor-pointer rounded-lg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500`}>
                                {marker}
                              </button>
                            ) : <div className={stepClass}>{marker}</div>}
                          </li>
                        );
                      })}
                    </ol>
                    <p className={`mt-3 text-[11px] leading-relaxed ${nextStep ? 'text-slate-600 dark:text-slate-300' : 'font-semibold text-emerald-700 dark:text-emerald-400'}`}>
                      {nextStep?.hint ?? "You're all set!"}
                    </p>
                  </div>

                  <div className="mt-auto pt-3">
                    <div className="flex items-center justify-between gap-1 rounded-xl border border-slate-100 px-1.5 py-2 @min-[15rem]:px-3 dark:border-white/10">
                      <dl aria-label="Current rates" className="grid min-w-0 gap-x-4 gap-y-1.5 @min-[15rem]:grid-cols-2">
                        <RateAmount rate={bay.dailyRate} period="day" />
                        <RateAmount rate={bay.monthlyRate} period="month" />
                      </dl>
                      {recommendation && (
                        <Popover.Root>
                          <Popover.Trigger
                            aria-label="AI pricing suggestion"
                            title="AI pricing suggestion"
                            disabled={applyingSpotId !== null}
                            className="grid size-8 shrink-0 @min-[15rem]:size-10 place-items-center rounded-xl bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:bg-blue-400/10 dark:text-blue-300 dark:hover:bg-blue-400/20"
                          >
                            {applyingSpotId === bay.parkingSpotId
                              ? <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
                              : <Sparkles className="size-4" aria-hidden="true" />}
                          </Popover.Trigger>
                          <Popover.Portal>
                            <Popover.Positioner side="top" align="end" sideOffset={8} collisionPadding={12} className="z-[60]">
                              <Popover.Popup className="relative w-72 max-w-[min(var(--available-width),calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30">
                                <Popover.Arrow className="group text-slate-200 data-[side=bottom]:-top-1 data-[side=top]:-bottom-1 data-[side=left]:-right-1 data-[side=right]:-left-1 dark:text-slate-700">
                                  <div className="size-2 rotate-45 bg-white dark:bg-slate-900 group-data-[side=top]:border-b group-data-[side=top]:border-r group-data-[side=bottom]:border-l group-data-[side=bottom]:border-t group-data-[side=left]:border-r group-data-[side=left]:border-t group-data-[side=right]:border-b group-data-[side=right]:border-l" />
                                </Popover.Arrow>
                                <div className="relative flex max-h-[min(20rem,var(--available-height))] flex-col overflow-y-auto overscroll-contain rounded-2xl p-3.5 [scrollbar-width:thin]">
                                  <div className="flex items-center justify-between gap-2">
                                    <Popover.Title className="text-xs font-semibold text-slate-900 dark:text-white">
                                      Suggested pricing
                                    </Popover.Title>
                                    <Popover.Close aria-label="Close pricing suggestion" className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-300 dark:hover:bg-white/10">
                                      <X className="size-4" aria-hidden="true" />
                                    </Popover.Close>
                                  </div>
                                  <Popover.Description className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                    {recommendation.headlineSuggestion?.trim() || 'Compare the suggested rates with your current pricing.'}
                                  </Popover.Description>
                                  <dl aria-label="Suggested rates" className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-white/[0.06]">
                                    <RateAmount rate={recommendation.recommendedDailyRateRm} period="day" />
                                    <RateAmount rate={recommendation.recommendedMonthlyRateRm} period="month" />
                                  </dl>
                                  <Popover.Close
                                    onClick={() => void handleApplyAiRate(bay.parkingSpotId, recommendation.recommendedDailyRateRm, recommendation.recommendedMonthlyRateRm)}
                                    className="mt-2 min-h-9 shrink-0 self-end rounded-lg px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-blue-300 dark:hover:bg-blue-400/10"
                                  >
                                    Review rates
                                  </Popover.Close>
                                </div>
                              </Popover.Popup>
                            </Popover.Positioner>
                          </Popover.Portal>
                        </Popover.Root>
                      )}
                    </div>

                    <div className="mt-2 grid gap-1.5 @min-[17rem]:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => onConfigureParking?.(bay.parkingSpotId)}
                        disabled={!canConfigure}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-center bg-slate-900 px-3 text-[11px] font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
                        title={canConfigure ? 'Open parking setup' : 'Parking setup is not connected yet'}
                      >
                        <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Configure parking
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenTimetable?.(bay.parkingSpotId)}
                        disabled={!canOpenTimetable}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-center border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                        title={canOpenTimetable ? 'Open timetable' : 'Timetable is not connected yet'}
                      >
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Open timetable
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {parkingFilter === 'all' && bookableCount > 0 && (
        <p className="text-center text-[10px] text-slate-400">{bookableCount} parking spot{bookableCount === 1 ? '' : 's'} currently open for commuter booking.</p>
      )}
    </div>
  );
}
