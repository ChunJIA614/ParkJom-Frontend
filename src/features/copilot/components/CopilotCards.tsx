import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Footprints,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  TrainFront,
} from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  getBookingAvailability,
  type BookingAvailabilityResponse,
} from '@/features/commuter/api/bookingApi';
import {
  dateFromIsoKey,
  getMonthsBetween,
  isValidIsoDateKey,
} from '@/features/commuter/lib/bookingDateValidation';
import {
  evaluateProposalAvailability,
  type ProposalAvailabilityVerdict,
} from '../lib/copilotGuards';
import type {
  CopilotBookingProposalCardData,
  CopilotCard,
  CopilotDeparturesCardData,
  CopilotParkingCardData,
} from '../types';

const AVAILABILITY_CACHE_TTL_MS = 30_000;
const availabilityCache = new Map<string, { fetchedAt: number; data: BookingAvailabilityResponse }>();

async function getCachedMonthAvailability(
  token: string,
  spotId: number,
  month: string,
  signal: AbortSignal,
): Promise<BookingAvailabilityResponse> {
  const key = `${spotId}:${month}`;
  const cached = availabilityCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < AVAILABILITY_CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await getBookingAvailability(token, spotId, month, signal);
  availabilityCache.set(key, { fetchedAt: Date.now(), data });
  return data;
}

const formatRm = (value: number | null | undefined) =>
  value == null ? '—' : `RM ${value.toFixed(2)}`;

const formatDate = (key: string) => (
  isValidIsoDateKey(key)
    ? dateFromIsoKey(key).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' })
    : key
);

const cardShell =
  'copilot-panel__card rounded-2xl p-3 shadow-sm';

function ParkingCard({ data }: { data: CopilotParkingCardData }) {
  const navigate = useNavigate();
  return (
    <div className={cardShell}>
      <div className="flex gap-3">
        {data.primaryImageUrl ? (
          <img
            src={data.primaryImageUrl}
            alt=""
            className="h-16 w-16 flex-none rounded-xl object-cover bg-black/5"
            loading="lazy"
          />
        ) : (
          <div className="h-16 w-16 flex-none rounded-xl bg-[#007AFF]/10 grid place-items-center text-[#007AFF] dark:text-[#0A84FF]">
            <MapPin size={22} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-[#1d1d1f] dark:text-white">
            {data.parkingLabel} · {data.propertyName}
          </p>
          <p className="truncate text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">{data.address}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">
            <span className="inline-flex items-center gap-1">
              <Footprints size={12} /> {data.walkingTimeMinutes} min to {data.stationName}
            </span>
            {data.hasSmartBollard && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={12} /> Smart bollard
              </span>
            )}
            {data.predictedOccupancyPercent != null && (
              <span className="inline-flex items-center gap-1 text-[#007AFF] dark:text-[#0A84FF] font-medium">
                <Sparkles size={11} /> AI: {data.predictedOccupancyPercent}% est. occ ({data.riskLevel || 'Moderate'})
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">
          {formatRm(data.dailyRate)}
          <span className="text-[11px] font-normal text-[#6e6e73] dark:text-[#A1A1AA]"> / day</span>
        </p>
        <button
          type="button"
          onClick={() => navigate(`/commuter/parking/${data.parkingSpotId}`)}
          className="rounded-full bg-[#007AFF]/10 px-3 py-1.5 text-[12px] font-semibold text-[#007AFF] dark:text-[#0A84FF] hover:bg-[#007AFF]/15 cursor-pointer"
        >
          View bay
        </button>
      </div>
    </div>
  );
}

function DeparturesCard({ data }: { data: CopilotDeparturesCardData }) {
  return (
    <div className={cardShell}>
      <div className="flex items-center gap-2">
        <TrainFront size={16} className="text-[#007AFF] dark:text-[#0A84FF]" />
        <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">{data.stationName}</p>
        <span className="truncate text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">{data.lineName}</span>
      </div>
      {data.isOperating ? (
        <ul className="mt-2 space-y-1.5">
          {data.departures.map((d) => (
            <li key={d.direction} className="flex items-center justify-between text-[12px]">
              <span className="truncate text-[#1d1d1f] dark:text-white">{d.direction}</span>
              <span className="flex-none font-semibold text-[#1d1d1f] dark:text-white">
                ~{d.next}
                <span className="ml-1 font-normal text-[#6e6e73] dark:text-[#A1A1AA]">({d.minutesUntil} min)</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[12px] text-[#6e6e73] dark:text-[#A1A1AA]">{data.serviceStatus}</p>
      )}
      <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">
        <Clock size={11} />
        Every ~{data.frequencyMinutes} min{data.isPeakHour ? ' (peak)' : ''} · Estimated, not live
      </p>
    </div>
  );
}

function BookingProposalCard({ data }: { data: CopilotBookingProposalCardData }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = user?.token ?? '';
  const dateLabel = data.startDate === data.endDate
    ? formatDate(data.startDate)
    : `${formatDate(data.startDate)} – ${formatDate(data.endDate)}`;

  const [checkState, setCheckState] = useState<'idle' | 'loading' | 'available' | 'unavailable' | 'error'>(
    token ? 'loading' : 'idle',
  );
  const [verdict, setVerdict] = useState<ProposalAvailabilityVerdict | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setCheckState('idle');
      setVerdict(null);
      setErrorMessage(null);
      return;
    }

    const months = getMonthsBetween(data.startDate, data.endDate).slice(0, 3);
    if (months.length === 0) {
      setCheckState('unavailable');
      setVerdict({
        status: 'unavailable',
        reason: 'Suggested booking dates are invalid.',
        nextAvailableDate: null,
      });
      setErrorMessage(null);
      return;
    }

    const controller = new AbortController();
    setCheckState('loading');
    setErrorMessage(null);

    void Promise.all(
      months.map(async (month) => {
        const result = await getCachedMonthAvailability(token, data.parkingSpotId, month, controller.signal);
        return { requestedMonth: month, result };
      }),
    )
      .then((entries) => {
        if (controller.signal.aborted) return;
        const availabilityByMonth: Record<string, BookingAvailabilityResponse> = {};
        for (const { requestedMonth, result } of entries) {
          availabilityByMonth[result.month || requestedMonth] = result;
        }
        const evaluated = evaluateProposalAvailability(data, availabilityByMonth);
        setVerdict(evaluated);
        setCheckState(evaluated.status);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setCheckState('error');
        setErrorMessage(error instanceof Error ? error.message : 'Could not verify live availability.');
      });

    return () => controller.abort();
  }, [data.endDate, data.parkingSpotId, data.startDate, token]);

  const isAvailable = checkState === 'available';
  const isLoading = checkState === 'loading';
  const isUnavailable = checkState === 'unavailable';

  return (
    <div
      className={`${cardShell} ${
        isUnavailable
          ? 'border-rose-300/70 dark:border-rose-500/40'
          : 'border-[#007AFF]/30 dark:border-[#0A84FF]/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarCheck
            size={16}
            className={isUnavailable ? 'text-rose-600 dark:text-rose-400' : 'text-[#007AFF] dark:text-[#0A84FF]'}
          />
          <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">Suggested booking</p>
        </div>
        {isLoading ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-[#6e6e73] dark:text-[#A1A1AA]">
            <Loader2 size={10} className="animate-spin" /> Checking…
          </span>
        ) : isAvailable ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 size={10} /> Available
          </span>
        ) : isUnavailable ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/12 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-400">
            <AlertTriangle size={10} /> Unavailable
          </span>
        ) : null}
      </div>

      <p className="mt-1.5 text-[13px] text-[#1d1d1f] dark:text-white">
        {data.parkingLabel} · {data.propertyName}
      </p>
      <p className="text-[12px] text-[#6e6e73] dark:text-[#A1A1AA]">
        {dateLabel} · {data.days} day{data.days > 1 ? 's' : ''}
      </p>

      {isUnavailable && verdict?.reason && (
        <div className="mt-2 rounded-xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200/80 dark:border-rose-800/50 px-2.5 py-2 text-[11px] text-rose-700 dark:text-rose-300 space-y-0.5">
          <p className="font-medium">{verdict.reason}</p>
          {verdict.nextAvailableDate && (
            <p className="text-[10px] text-rose-600/90 dark:text-rose-300/90">
              Next open date: <strong>{formatDate(verdict.nextAvailableDate)}</strong>
            </p>
          )}
        </div>
      )}

      {checkState === 'error' && errorMessage && (
        <p className="mt-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
          {errorMessage}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">{formatRm(data.estimatedSubtotal)}</p>
          <p className="text-[10px] text-[#6e6e73] dark:text-[#A1A1AA]">
            {isUnavailable ? 'Pick available dates on bay page' : 'Estimate · fees shown at checkout'}
          </p>
        </div>
        {isLoading ? (
          <button
            type="button"
            disabled
            className="rounded-full bg-slate-200 dark:bg-white/10 px-4 py-2 text-[12px] font-semibold text-slate-500 dark:text-[#A1A1AA] cursor-not-allowed"
          >
            Checking…
          </button>
        ) : isAvailable ? (
          <button
            type="button"
            onClick={() => navigate(`/commuter/parking/${data.parkingSpotId}`, {
              state: { copilotPrefill: { startDate: data.startDate, endDate: data.endDate } },
            })}
            className="rounded-full bg-[#007AFF] dark:bg-[#0071E3] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#0066d6] active:scale-[0.98] cursor-pointer"
          >
            Review &amp; reserve
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate(`/commuter/parking/${data.parkingSpotId}`)}
            className="rounded-full bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 px-3.5 py-2 text-[12px] font-semibold text-[#007AFF] dark:text-[#0A84FF] hover:bg-[#007AFF]/15 cursor-pointer"
          >
            {isUnavailable ? 'Check open dates' : 'View bay'}
          </button>
        )}
      </div>
    </div>
  );
}

export function CopilotCardView({ card }: { card: CopilotCard }) {
  switch (card.type) {
    case 'parking': return <ParkingCard data={card.data} />;
    case 'departures': return <DeparturesCard data={card.data} />;
    case 'bookingProposal': return <BookingProposalCard data={card.data} />;
    default: return null;
  }
}
