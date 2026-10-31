import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Clock, Footprints, MapPin, ShieldCheck, TrainFront } from 'lucide-react';
import type {
  CopilotBookingProposalCardData,
  CopilotCard,
  CopilotDeparturesCardData,
  CopilotParkingCardData,
} from '../types';

const formatRm = (value: number | null | undefined) =>
  value == null ? '—' : `RM ${value.toFixed(2)}`;

const formatDate = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' });

const cardShell =
  'rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#18181C] p-3 shadow-sm';

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
  const dateLabel = data.startDate === data.endDate
    ? formatDate(data.startDate)
    : `${formatDate(data.startDate)} – ${formatDate(data.endDate)}`;

  return (
    <div className={`${cardShell} border-[#007AFF]/30 dark:border-[#0A84FF]/40`}>
      <div className="flex items-center gap-2">
        <CalendarCheck size={16} className="text-[#007AFF] dark:text-[#0A84FF]" />
        <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">Suggested booking</p>
      </div>
      <p className="mt-1.5 text-[13px] text-[#1d1d1f] dark:text-white">
        {data.parkingLabel} · {data.propertyName}
      </p>
      <p className="text-[12px] text-[#6e6e73] dark:text-[#A1A1AA]">
        {dateLabel} · {data.days} day{data.days > 1 ? 's' : ''}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">{formatRm(data.estimatedSubtotal)}</p>
          <p className="text-[10px] text-[#6e6e73] dark:text-[#A1A1AA]">Estimate · fees shown at checkout</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/commuter/parking/${data.parkingSpotId}`, {
            state: { copilotPrefill: { startDate: data.startDate, endDate: data.endDate } },
          })}
          className="rounded-full bg-[#007AFF] dark:bg-[#0071E3] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#0066d6] active:scale-[0.98] cursor-pointer"
        >
          Review & reserve
        </button>
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
