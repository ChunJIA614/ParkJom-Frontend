import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { getOwnerBookingsByDate } from '../api/parkingApi';
import type { ParkingAvailabilityCalendarHours } from '../types';

interface RenterBooking {
  bookingId: number;
  renterName?: string | null;
  vehicleNumberPlate?: string | null;
}

interface BookedDateDetailsProps {
  token?: string;
  parkingSpotId: number;
  date: string;
  hours: ParkingAvailabilityCalendarHours[];
  timeZone: string;
}

const detailRowClass = 'grid grid-cols-[minmax(6rem,0.42fr)_minmax(0,1fr)] items-baseline gap-3 py-2.5';
const detailLabelClass = 'text-sm text-slate-600 dark:text-slate-300';

export default function BookedDateDetails({ token, parkingSpotId, date, hours, timeZone }: BookedDateDetailsProps) {
  const [bookings, setBookings] = useState<RenterBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setBookings(null);
    setError(null);

    async function loadBookings() {
      if (!token) {
        setError('Sign in again to view renter details.');
        return;
      }

      try {
        const response = await getOwnerBookingsByDate(token, parkingSpotId, date, controller.signal);
        const body = await response.json().catch(() => null) as { data?: RenterBooking[]; message?: string } | null;
        if (!response.ok || !Array.isArray(body?.data)) {
          throw new Error(body?.message || 'Unable to load renter details.');
        }
        if (!controller.signal.aborted) setBookings(body.data);
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError(failure instanceof Error ? failure.message : 'Unable to load renter details.');
        }
      }
    }

    void loadBookings();
    return () => controller.abort();
  }, [token, parkingSpotId, date, attempt]);

  return (
    <div className="border-t border-border pt-5">
      <section aria-labelledby="renter-details-heading" aria-busy={!bookings && !error} className="rounded-xl border border-border bg-slate-50 px-4 pb-3 pt-4 dark:bg-white/[0.04]">
        <h4 id="renter-details-heading" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Renter details</h4>

        {error ? (
          <div className="mt-3 space-y-2">
            <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
            {token && <button type="button" onClick={() => setAttempt((current) => current + 1)} className="workspace-button workspace-button--secondary min-h-11!">Retry</button>}
          </div>
        ) : !bookings ? (
          <p role="status" className="mt-3 text-sm text-slate-600 dark:text-slate-300">Loading renter details…</p>
        ) : bookings.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No renter booking was found for this date.</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {bookings.map((booking) => (
              <li key={booking.bookingId}>
                <dl className="divide-y divide-border">
                  <div className={detailRowClass}>
                    <dt className={detailLabelClass}>Renter name</dt>
                    <dd className="min-w-0 break-words text-base font-semibold leading-snug text-slate-900 dark:text-white">
                      {booking.renterName?.trim() || 'Unavailable'}
                    </dd>
                  </div>
                  <div className={detailRowClass}>
                    <dt className={detailLabelClass}>Number plate</dt>
                    <dd className="min-w-0 break-words text-base font-semibold leading-snug text-slate-900 dark:text-white">
                      {booking.vehicleNumberPlate?.trim() || 'Unavailable'}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Opening hours" className="mt-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
          <h4 className="font-medium text-slate-900 dark:text-white">Opening hours</h4>
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Lock className="size-3.5 shrink-0" aria-hidden="true" /> Locked
          </span>
        </div>
        {hours.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
            <ul className="flex flex-wrap gap-x-3 gap-y-1 font-medium tabular-nums text-slate-700 dark:text-slate-200">
              {hours.map(({ from, to }) => <li key={from + '-' + to}>{from}–{to}</li>)}
            </ul>
            <span className="text-slate-600 dark:text-slate-300">{timeZone.replaceAll('_', ' ').split('/').at(-1)}</span>
          </div>
        )}
      </section>
    </div>
  );
}
