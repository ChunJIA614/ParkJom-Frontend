import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  CarFront,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import {
  getOwnerBookingHistory,
  type OwnerBookingHistoryItem,
} from '@/features/bookings/api/bookingHistoryApi';
import type { ParkingBay } from '../types';

interface Props {
  token: string;
  bays: ParkingBay[];
}

const PAGE_SIZE = 10;

const statusClasses: Record<string, string> = {
  confirmed: 'border-blue-200 bg-blue-50 text-blue-700',
  active: 'border-blue-200 bg-blue-50 text-blue-700',
  upcoming: 'border-blue-200 bg-blue-50 text-blue-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-700',
  canceled: 'border-rose-200 bg-rose-50 text-rose-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
};

function formatDate(value: string): string {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function statusClass(status: string): string {
  return statusClasses[status.trim().toLowerCase()]
    ?? 'border-slate-200 bg-slate-50 text-slate-600';
}

export default function OwnerBookingHistory({ token, bays }: Props) {
  const [items, setItems] = useState<OwnerBookingHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void getOwnerBookingHistory(token, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setItems(result.data);
        setTotalCount(result.totalCount);
        setPage((current) => Math.min(current, Math.max(1, Math.ceil(result.data.length / PAGE_SIZE))));
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Unable to load booking history.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, refresh]);

  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const visibleItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const payoutTotal = useMemo(
    () => items.reduce((sum, booking) => sum + booking.ownerPayoutAmount, 0),
    [items],
  );

  return <section className="mt-6 space-y-3">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-extrabold text-slate-900">Booking history</h2>
        <p className="mt-1 text-[11px] text-slate-500">
          {totalCount} booking{totalCount === 1 ? '' : 's'} · RM {payoutTotal.toFixed(2)} owner payout
        </p>
      </div>
      <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 sm:self-auto">
        <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} /> Refresh
      </button>
    </div>
    {error && <div role="alert" className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700"><AlertCircle className="h-4 w-4" />{error}</div>}
    {loading && items.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" /><p className="mt-2 text-xs text-slate-500">Loading booking history...</p></div> : null}
    {!loading && !error && items.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">No booking history yet.</p>}
    <div className="space-y-3">
      {visibleItems.map((booking) => {
        const propertyName = bays.find((bay) => bay.parkingSpotId === booking.parkingSpotId)?.propertyName;
        return (
          <article key={booking.bookingId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">{booking.parkingLabel || `Parking spot #${booking.parkingSpotId}`}</h3>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(booking.bookingStatus)}`}>
                  {booking.bookingStatus || 'Unknown'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{propertyName ?? `Parking spot #${booking.parkingSpotId}`} · Spot #{booking.parkingSpotId}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="flex min-w-0 items-start gap-2">
                  <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Renter</p><p className="truncate text-xs font-semibold text-slate-700">{booking.renterName || `Renter #${booking.renterId}`}</p></div>
                </div>
                <div className="flex min-w-0 items-start gap-2">
                  <CarFront className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Vehicle</p><p className="truncate text-xs font-semibold text-slate-700">{booking.vehicleNumberPlate || `Vehicle #${booking.vehicleId}`}</p></div>
                </div>
                <div className="flex min-w-0 items-start gap-2 sm:col-span-2">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Booking dates</p><p className="text-xs font-semibold text-slate-700">{formatDate(booking.startDate)} - {formatDate(booking.endDate)} · {booking.bookedDays} day{booking.bookedDays === 1 ? '' : 's'}</p></div>
                </div>
              </div>

              {(booking.renterEmail || booking.renterPhoneNumber) && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                  {booking.renterEmail && <a href={`mailto:${booking.renterEmail}`} className="inline-flex min-w-0 items-center gap-1.5 hover:text-blue-700"><Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="break-all">{booking.renterEmail}</span></a>}
                  {booking.renterPhoneNumber && <a href={`tel:${booking.renterPhoneNumber}`} className="inline-flex items-center gap-1.5 hover:text-blue-700"><Phone className="h-3.5 w-3.5" aria-hidden="true" />{booking.renterPhoneNumber}</a>}
                </div>
              )}

              <p className="mt-3 break-all font-mono text-[10px] text-slate-400">{booking.bookingReference || `Booking #${booking.bookingId}`}</p>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 lg:w-56 lg:grid-cols-1">
              <div>
                <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><Banknote className="h-3.5 w-3.5" aria-hidden="true" />Owner payout</p>
                <p className="mt-1 text-base font-extrabold text-emerald-700">RM {booking.ownerPayoutAmount.toFixed(2)}</p>
              </div>
              <div className="border-l border-slate-200 pl-3 lg:border-l-0 lg:border-t lg:pl-0 lg:pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Renter total</p>
                <p className="mt-1 text-sm font-bold text-slate-700">RM {booking.renterTotal.toFixed(2)}</p>
              </div>
            </div>
          </div>
          </article>
        );
      })}
    </div>
    {pages > 1 && <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="disabled:cursor-not-allowed disabled:opacity-40">Previous</button><span>Page {page} of {pages}</span><button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page === pages} className="disabled:cursor-not-allowed disabled:opacity-40">Next</button></div>}
  </section>;
}
