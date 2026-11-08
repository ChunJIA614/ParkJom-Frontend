import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  DoorOpen,
  Filter,
  RefreshCw,
  Repeat,
  Search,
} from 'lucide-react';
import { getManagementAccessEvents } from '../api/managementApi';
import { formatAgo, formatFull, parseUtc } from '../lib/time';
import type { ManagementAccessEvent } from '../types';

interface ManagementAccessEventsPanelProps {
  token: string;
  knownSpots: Array<{ id: number; label: string }>;
  onOpenBooking?: (bookingId: number) => void;
  onKnownSpotsDiscovered?: (spots: Array<{ id: number; label: string }>) => void;
}

export default function ManagementAccessEventsPanel({
  token,
  knownSpots,
  onOpenBooking,
  onKnownSpotsDiscovered,
}: ManagementAccessEventsPanelProps) {
  const [plateFilter, setPlateFilter] = useState('');
  const [spotFilter, setSpotFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [events, setEvents] = useState<ManagementAccessEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (fromDate && toDate && fromDate > toDate) {
      setError('The "From" date must be on or before the "To" date.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await getManagementAccessEvents(token, {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        parkingSpotId: spotFilter ? Number(spotFilter) : undefined,
        plate: plateFilter.trim() || undefined,
        page,
        pageSize,
      });
      setEvents(response.data);
      setTotalCount(response.totalCount);

      if (onKnownSpotsDiscovered && response.data.length > 0) {
        const discovered = response.data
          .filter((item) => item.parkingSpotId > 0)
          .map((item) => ({
            id: item.parkingSpotId,
            label: item.parkingLabel || `Spot #${item.parkingSpotId}`,
          }));
        onKnownSpotsDiscovered(discovered);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load gate entry events.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, onKnownSpotsDiscovered, page, plateFilter, spotFilter, toDate, token]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const resetFilters = () => {
    setPlateFilter('');
    setSpotFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const hasFilters = Boolean(plateFilter || spotFilter || fromDate || toDate);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <section
        aria-label="Gate entry log filters"
        className="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#141417] p-4 shadow-sm space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            <Filter size={15} className="text-[#0071e3] dark:text-[#0a84ff]" aria-hidden="true" />
            <span>Filter Physical Entry Events</span>
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
              onClick={() => void loadEvents()}
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
            <label htmlFor="access-plate-filter" className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#a1a1aa] mb-1">
              Vehicle number plate
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6e6e73]" aria-hidden="true" />
              <input
                id="access-plate-filter"
                type="search"
                placeholder="e.g. WXY 1234"
                value={plateFilter}
                onChange={(e) => { setPlateFilter(e.target.value); setPage(1); }}
                className="w-full min-h-10 rounded-xl border border-black/[0.1] dark:border-white/[0.14] bg-[#f5f5f7] dark:bg-[#1c1c1e] pl-8 pr-3 text-[13px] font-mono text-[#1d1d1f] dark:text-[#f5f5f7]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="access-spot-filter" className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#a1a1aa] mb-1">
              Parking bay
            </label>
            <select
              id="access-spot-filter"
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
            <label htmlFor="access-from-date" className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#a1a1aa] mb-1">
              From date (MYT)
            </label>
            <input
              id="access-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="w-full min-h-10 rounded-xl border border-black/[0.1] dark:border-white/[0.14] bg-[#f5f5f7] dark:bg-[#1c1c1e] px-3 text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]"
            />
          </div>

          <div>
            <label htmlFor="access-to-date" className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#a1a1aa] mb-1">
              To date (MYT)
            </label>
            <input
              id="access-to-date"
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

      {/* Events List */}
      <section
        aria-label="Physical gate entry events"
        className="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#141417] p-5 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            {totalCount} physical entry event{totalCount === 1 ? '' : 's'}
          </p>
        </div>

        {loading && events.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-[#6e6e73] dark:text-[#a1a1aa]">
            Loading IoT gate entry events…
          </div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <DoorOpen size={28} className="mx-auto text-[#6e6e73] dark:text-[#a1a1aa]" aria-hidden="true" />
            <p className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              No physical entry events recorded
            </p>
            <p className="text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
              Confirmed smart-bollard entries for this property will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] dark:border-white/[0.1] text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] dark:text-[#a1a1aa]">
                  <th className="py-2.5 pr-4">Entry Type</th>
                  <th className="py-2.5 pr-4">Vehicle Plate</th>
                  <th className="py-2.5 pr-4">Parking Bay</th>
                  <th className="py-2.5 pr-4">Booking</th>
                  <th className="py-2.5">Entered (MYT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.08] text-[13px]">
                {events.map((item) => {
                  const enteredAt = parseUtc(item.enteredAtUtc);
                  return (
                    <tr key={item.ioTStatusLogId}>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            item.firstEntryForBooking
                              ? 'bg-[#f0fdf4] dark:bg-emerald-950/40 text-[#248a3d] dark:text-[#30d158]'
                              : 'bg-[#e8f0fe] dark:bg-[#0a84ff]/20 text-[#0071e3] dark:text-[#0a84ff]'
                          }`}
                        >
                          {item.firstEntryForBooking ? (
                            <CheckCircle2 size={12} aria-hidden="true" />
                          ) : (
                            <Repeat size={12} aria-hidden="true" />
                          )}
                          <span>{item.firstEntryForBooking ? 'First Check-In' : 'Re-Entry'}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-block rounded-lg bg-[#111318] text-white font-mono text-[12px] font-bold tracking-wider px-2.5 py-1">
                          {item.vehicleNumberPlate || '—'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {item.parkingLabel || `Spot #${item.parkingSpotId}`}
                      </td>
                      <td className="py-3 pr-4">
                        {item.bookingId > 0 && onOpenBooking ? (
                          <button
                            type="button"
                            onClick={() => onOpenBooking(item.bookingId)}
                            className="text-[12px] font-semibold text-[#0071e3] dark:text-[#0a84ff] underline"
                          >
                            Booking #{item.bookingId}
                          </button>
                        ) : (
                          <span className="text-[#6e6e73] dark:text-[#a1a1aa]">—</span>
                        )}
                      </td>
                      <td className="py-3 text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
                        <div className="inline-flex items-center gap-1 font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                          <Clock size={12} aria-hidden="true" />
                          <span>{formatAgo(enteredAt)}</span>
                        </div>
                        <div className="text-[11px]">{formatFull(enteredAt)}</div>
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
    </div>
  );
}
