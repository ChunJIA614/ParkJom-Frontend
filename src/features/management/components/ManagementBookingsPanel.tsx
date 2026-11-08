import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  RefreshCw,
  X,
  XCircle,
} from 'lucide-react';
import { getManagementBookingById, getManagementBookings } from '../api/managementApi';
import { formatFull, formatWindow, parseLocalMyt } from '../lib/time';
import {
  MANAGEMENT_BOOKING_STATUSES,
  type ManagementBooking,
  type ManagementBookingStatus,
} from '../types';

interface ManagementBookingsPanelProps {
  token: string;
  knownSpots: Array<{ id: number; label: string }>;
  focusedBookingId?: number | null;
  onClearFocusedBooking?: () => void;
  onKnownSpotsDiscovered?: (spots: Array<{ id: number; label: string }>) => void;
}

function statusAppearance(status: string): {
  tone: string;
  icon: typeof CheckCircle2;
  label: string;
} {
  const normalized = status.toLowerCase();
  if (normalized === 'active' || normalized === 'confirmed') {
    return {
      tone: 'bg-[#f0fdf4] dark:bg-emerald-950/40 text-[#248a3d] dark:text-[#30d158]',
      icon: CheckCircle2,
      label: status,
    };
  }
  if (normalized === 'cancelled' || normalized === 'expired') {
    return {
      tone: 'bg-[#fff1f0] dark:bg-red-950/40 text-[#c9342f] dark:text-[#ff6961]',
      icon: XCircle,
      label: status,
    };
  }
  return {
    tone: 'bg-[#fff8e8] dark:bg-amber-950/40 text-[#a15c00] dark:text-[#ff9f0a]',
    icon: Clock,
    label: status,
  };
}

export default function ManagementBookingsPanel({
  token,
  knownSpots,
  focusedBookingId,
  onClearFocusedBooking,
  onKnownSpotsDiscovered,
}: ManagementBookingsPanelProps) {
  const [spotFilter, setSpotFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ManagementBookingStatus | ''>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [bookings, setBookings] = useState<ManagementBooking[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drawer / modal for single-booking inspection (`GET /api/management/booking/{id}`)
  const [inspectedBooking, setInspectedBooking] = useState<ManagementBooking | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (fromDate && toDate && fromDate > toDate) {
      setError('The "From" date must be on or before the "To" date.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await getManagementBookings(token, {
        parkingSpotId: spotFilter ? Number(spotFilter) : undefined,
        status: statusFilter,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        pageSize,
      });
      setBookings(response.data);
      setTotalCount(response.totalCount);

      if (onKnownSpotsDiscovered && response.data.length > 0) {
        const discovered = response.data.map((item) => ({
          id: item.parkingSpotId,
          label: item.parkingLabel || `Spot #${item.parkingSpotId}`,
        }));
        onKnownSpotsDiscovered(discovered);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load property bookings.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, onKnownSpotsDiscovered, page, spotFilter, statusFilter, toDate, token]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const inspectById = useCallback(async (bookingId: number) => {
    setInspectLoading(true);
    setInspectError(null);
    try {
      const detail = await getManagementBookingById(token, bookingId);
      setInspectedBooking(detail);
    } catch (err) {
      setInspectError(err instanceof Error ? err.message : `Unable to inspect booking #${bookingId}.`);
    } finally {
      setInspectLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (focusedBookingId && focusedBookingId > 0) {
      void inspectById(focusedBookingId);
    }
  }, [focusedBookingId, inspectById]);

  const closeInspector = () => {
    setInspectedBooking(null);
    setInspectError(null);
    onClearFocusedBooking?.();
  };

  const resetFilters = () => {
    setSpotFilter('');
    setStatusFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasFilters = Boolean(spotFilter || statusFilter || fromDate || toDate);

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <section
        aria-label="Booking filters"
        className="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#141417] p-4 shadow-sm space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            <Filter size={15} className="text-[#0071e3] dark:text-[#0a84ff]" aria-hidden="true" />
            <span>Filter Property Bookings</span>
          </div>

          <div className="flex items-center gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-9 px-3 rounded-lg text-[12px] font-semibold text-[#0071e3] dark:text-[#0a84ff] hover:underline"
              >
                Clear filters
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadBookings()}
              disabled={loading}
              className="min-h-10 px-3.5 rounded-xl border border-black/[0.1] dark:border-white/[0.14] text-[12px] font-semibold inline-flex items-center gap-1.5 text-[#1d1d1f] dark:text-[#f5f5f7]"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="booking-spot-filter" className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#a1a1aa] mb-1">
              Parking bay
            </label>
            <select
              id="booking-spot-filter"
              value={spotFilter}
              onChange={(e) => { setSpotFilter(e.target.value); setPage(1); }}
              className="w-full min-h-10 rounded-xl border border-black/[0.1] dark:border-white/[0.14] bg-[#f5f5f7] dark:bg-[#1c1c1e] px-3 text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]"
            >
              <option value="">All bays</option>
              {knownSpots.map((spot) => (
                <option key={spot.id} value={String(spot.id)}>
                  {spot.label} (#{spot.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="booking-status-filter" className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#a1a1aa] mb-1">
              Booking status
            </label>
            <select
              id="booking-status-filter"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as ManagementBookingStatus | ''); setPage(1); }}
              className="w-full min-h-10 rounded-xl border border-black/[0.1] dark:border-white/[0.14] bg-[#f5f5f7] dark:bg-[#1c1c1e] px-3 text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]"
            >
              <option value="">All statuses</option>
              {MANAGEMENT_BOOKING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="booking-from-date" className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#a1a1aa] mb-1">
              From date (MYT)
            </label>
            <input
              id="booking-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="w-full min-h-10 rounded-xl border border-black/[0.1] dark:border-white/[0.14] bg-[#f5f5f7] dark:bg-[#1c1c1e] px-3 text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]"
            />
          </div>

          <div>
            <label htmlFor="booking-to-date" className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#a1a1aa] mb-1">
              To date (MYT)
            </label>
            <input
              id="booking-to-date"
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="w-full min-h-10 rounded-xl border border-black/[0.1] dark:border-white/[0.14] bg-[#f5f5f7] dark:bg-[#1c1c1e] px-3 text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]"
            />
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#c9342f]/30 bg-[#fff1f0] dark:bg-red-950/40 px-4 py-3 text-[12px] font-medium text-[#c9342f] dark:text-[#ff6961] flex items-center gap-2"
        >
          <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Bookings Roster Table */}
      <section
        aria-label="Property bookings roster"
        className="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#141417] p-5 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            {totalCount} booking{totalCount === 1 ? '' : 's'} found
          </p>
        </div>

        {loading && bookings.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-[#6e6e73] dark:text-[#a1a1aa]">
            Loading property bookings…
          </div>
        ) : bookings.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <CalendarDays size={28} className="mx-auto text-[#6e6e73] dark:text-[#a1a1aa]" aria-hidden="true" />
            <p className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              No bookings match these filters
            </p>
            <p className="text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
              Clear your date or status filters to see all bookings assigned to this property.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] dark:border-white/[0.1] text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] dark:text-[#a1a1aa]">
                  <th className="py-2.5 pr-4">Reference</th>
                  <th className="py-2.5 pr-4">Vehicle Plate</th>
                  <th className="py-2.5 pr-4">Bay</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4">Parking Window (MYT)</th>
                  <th className="py-2.5 pr-4">Check-In / Exit</th>
                  <th className="py-2.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.08] text-[13px]">
                {bookings.map((booking) => {
                  const badge = statusAppearance(booking.bookingStatus);
                  const StatusIcon = badge.icon;
                  const start = parseLocalMyt(booking.startDate);
                  const end = parseLocalMyt(booking.endDate);
                  const checkIn = parseLocalMyt(booking.checkedInAt);
                  const exit = parseLocalMyt(booking.actualExitAt);

                  return (
                    <tr key={booking.bookingId}>
                      <td className="py-3 pr-4">
                        <span className="font-mono font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {booking.bookingReference || `#${booking.bookingId}`}
                        </span>
                        <span className="block text-[11px] text-[#6e6e73] dark:text-[#a1a1aa]">
                          ID #{booking.bookingId}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-block rounded-lg bg-[#111318] text-white font-mono text-[12px] font-bold tracking-wider px-2.5 py-1">
                          {booking.vehicleNumberPlate || '—'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {booking.parkingLabel || `Spot #${booking.parkingSpotId}`}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.tone}`}>
                          <StatusIcon size={12} aria-hidden="true" />
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-[12px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {formatWindow(start, end)}
                      </td>
                      <td className="py-3 pr-4 text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
                        <div>In: {checkIn ? formatFull(checkIn) : 'Not checked in'}</div>
                        {exit && <div>Out: {formatFull(exit)}</div>}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void inspectById(booking.bookingId)}
                          className="min-h-9 px-3 rounded-lg border border-black/[0.1] dark:border-white/[0.14] text-[12px] font-semibold inline-flex items-center gap-1.5 text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.04]"
                        >
                          <Eye size={13} aria-hidden="true" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="min-h-9 px-3 rounded-lg border border-black/[0.1] dark:border-white/[0.14] font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="min-h-9 px-3 rounded-lg border border-black/[0.1] dark:border-white/[0.14] font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Single Booking Detail Sheet (`GET /api/management/booking/{id}`) */}
      {(inspectedBooking || inspectLoading || inspectError) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-detail-title"
          className="fixed inset-0 z-[1200] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-black/[0.1] dark:border-white/[0.14] bg-white dark:bg-[#1c1c1e] p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="booking-detail-title" className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Booking Detail
              </h3>
              <button
                type="button"
                onClick={closeInspector}
                aria-label="Close booking detail"
                className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-[#6e6e73] hover:bg-black/[0.05]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {inspectLoading ? (
              <p className="py-6 text-center text-[13px] text-[#6e6e73]">Loading booking record…</p>
            ) : inspectError ? (
              <p role="alert" className="rounded-xl bg-[#fff1f0] p-3 text-[12px] text-[#c9342f]">
                {inspectError}
              </p>
            ) : inspectedBooking && (
              <dl className="space-y-2.5 text-[13px]">
                <div className="flex justify-between py-1.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <dt className="text-[#6e6e73] dark:text-[#a1a1aa]">Reference</dt>
                  <dd className="font-mono font-semibold">{inspectedBooking.bookingReference || `#${inspectedBooking.bookingId}`}</dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <dt className="text-[#6e6e73] dark:text-[#a1a1aa]">Vehicle Plate</dt>
                  <dd className="font-mono font-bold">{inspectedBooking.vehicleNumberPlate}</dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <dt className="text-[#6e6e73] dark:text-[#a1a1aa]">Parking Bay</dt>
                  <dd className="font-semibold">{inspectedBooking.parkingLabel || `Spot #${inspectedBooking.parkingSpotId}`}</dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <dt className="text-[#6e6e73] dark:text-[#a1a1aa]">Status</dt>
                  <dd className="font-semibold">{inspectedBooking.bookingStatus}</dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <dt className="text-[#6e6e73] dark:text-[#a1a1aa]">Start (MYT)</dt>
                  <dd>{formatFull(parseLocalMyt(inspectedBooking.startDate))}</dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <dt className="text-[#6e6e73] dark:text-[#a1a1aa]">End (MYT)</dt>
                  <dd>{formatFull(parseLocalMyt(inspectedBooking.endDate))}</dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <dt className="text-[#6e6e73] dark:text-[#a1a1aa]">Checked In</dt>
                  <dd>{inspectedBooking.checkedInAt ? formatFull(parseLocalMyt(inspectedBooking.checkedInAt)) : '—'}</dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-[#6e6e73] dark:text-[#a1a1aa]">Actual Exit</dt>
                  <dd>{inspectedBooking.actualExitAt ? formatFull(parseLocalMyt(inspectedBooking.actualExitAt)) : '—'}</dd>
                </div>
              </dl>
            )}

            <button
              type="button"
              onClick={closeInspector}
              className="w-full min-h-10 rounded-xl bg-[#0071e3] dark:bg-[#0a84ff] text-white text-[13px] font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
