import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  DoorOpen,
  MapPin,
  RefreshCw,
  ScanLine,
} from 'lucide-react';
import { getManagementAccessEvents, getManagementBookings, getPlateCheckHistory } from '../api/managementApi';
import { formatAgo, formatWindow, mytDateKey, parseLocalMyt, parseUtc } from '../lib/time';
import type { ManagementAccessEvent, ManagementBooking } from '../types';

interface ManagementOverviewProps {
  token: string;
  propertyName: string;
  propertyAddress: string;
  onNavigateView: (view: 'scanner' | 'bookings' | 'access') => void;
  onInspectBooking: (bookingId: number) => void;
  onKnownSpotsDiscovered?: (spots: Array<{ id: number; label: string }>) => void;
}

export default function ManagementOverview({
  token,
  propertyName,
  propertyAddress,
  onNavigateView,
  onInspectBooking,
  onKnownSpotsDiscovered,
}: ManagementOverviewProps) {
  const [todayBookings, setTodayBookings] = useState<ManagementBooking[]>([]);
  const [recentEvents, setRecentEvents] = useState<ManagementAccessEvent[]>([]);
  const [totalBookingsCount, setTotalBookingsCount] = useState(0);
  const [todayEventsCount, setTodayEventsCount] = useState(0);
  const [plateChecksTotal, setPlateChecksTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    const today = mytDateKey();
    try {
      const [bookingsRes, eventsRes, scansRes] = await Promise.all([
        getManagementBookings(token, { fromDate: today, toDate: today, page: 1, pageSize: 20 }),
        getManagementAccessEvents(token, { fromDate: today, toDate: today, page: 1, pageSize: 8 }),
        getPlateCheckHistory(token, 1, 5),
      ]);

      setTodayBookings(bookingsRes.data);
      setTotalBookingsCount(bookingsRes.totalCount);
      setRecentEvents(eventsRes.data);
      setTodayEventsCount(eventsRes.totalCount);
      setPlateChecksTotal(scansRes.totalCount);

      if (onKnownSpotsDiscovered) {
        const spots = [
          ...bookingsRes.data.map((b) => ({ id: b.parkingSpotId, label: b.parkingLabel || `Spot #${b.parkingSpotId}` })),
          ...eventsRes.data.map((e) => ({ id: e.parkingSpotId, label: e.parkingLabel || `Spot #${e.parkingSpotId}` })),
        ].filter((s) => s.id > 0);
        if (spots.length > 0) onKnownSpotsDiscovered(spots);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load today’s property snapshot.');
    } finally {
      setLoading(false);
    }
  }, [onKnownSpotsDiscovered, token]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const activeNowCount = todayBookings.filter(
    (b) => b.bookingStatus.toLowerCase() === 'active' || b.bookingStatus.toLowerCase() === 'confirmed',
  ).length;

  return (
    <div className="space-y-6">
      {/* Assigned Property Banner + Quick Plate Scanner Launch */}
      <section
        aria-label="Assigned building summary"
        className="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#141417] p-5 shadow-sm flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="h-11 w-11 rounded-2xl bg-[#e8f0fe] dark:bg-[#0a84ff]/15 text-[#0071e3] dark:text-[#0a84ff] flex items-center justify-center shrink-0">
            <Building2 size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0071e3] dark:text-[#0a84ff]">
              Assigned Property
            </span>
            <h2 className="text-[18px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
              {propertyName || 'Assigned Property'}
            </h2>
            {propertyAddress && (
              <p className="text-[12px] text-[#6e6e73] dark:text-[#a1a1aa] flex items-center gap-1 mt-0.5 truncate">
                <MapPin size={12} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{propertyAddress}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadSnapshot()}
            disabled={loading}
            className="min-h-11 px-3.5 rounded-xl border border-black/[0.1] dark:border-white/[0.14] text-[13px] font-semibold inline-flex items-center gap-1.5 text-[#1d1d1f] dark:text-[#f5f5f7]"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateView('scanner')}
            className="min-h-11 px-4 rounded-xl bg-[#0071e3] dark:bg-[#0a84ff] hover:bg-[#0066d6] text-white text-[13px] font-semibold inline-flex items-center gap-2 shadow-sm"
          >
            <ScanLine size={17} aria-hidden="true" />
            <span>Scan Vehicle Plate</span>
          </button>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#c9342f]/30 bg-[#fff1f0] dark:bg-red-950/40 px-4 py-3 text-[12px] font-medium text-[#c9342f] dark:text-[#ff6961]"
        >
          {error}
        </div>
      )}

      {/* Key Operational Counters */}
      <section aria-label="Today’s gatehouse metrics" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigateView('bookings')}
          className="text-left rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#141417] p-5 shadow-sm hover:border-[#0071e3]/40 transition-colors"
        >
          <div className="flex items-center justify-between text-[#6e6e73] dark:text-[#a1a1aa]">
            <span className="text-[12px] font-semibold">Today’s Eligible Bookings</span>
            <CalendarDays size={18} className="text-[#0071e3] dark:text-[#0a84ff]" aria-hidden="true" />
          </div>
          <p className="mt-2 text-[28px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
            {loading ? '—' : activeNowCount}
          </p>
          <p className="mt-1 text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
            {totalBookingsCount} total scheduled across today (MYT)
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateView('access')}
          className="text-left rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#141417] p-5 shadow-sm hover:border-[#0071e3]/40 transition-colors"
        >
          <div className="flex items-center justify-between text-[#6e6e73] dark:text-[#a1a1aa]">
            <span className="text-[12px] font-semibold">Today’s Physical Entries</span>
            <DoorOpen size={18} className="text-[#248a3d] dark:text-[#30d158]" aria-hidden="true" />
          </div>
          <p className="mt-2 text-[28px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
            {loading ? '—' : todayEventsCount}
          </p>
          <p className="mt-1 text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
            Confirmed by smart-bollard sensors
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateView('scanner')}
          className="text-left rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#141417] p-5 shadow-sm hover:border-[#0071e3]/40 transition-colors"
        >
          <div className="flex items-center justify-between text-[#6e6e73] dark:text-[#a1a1aa]">
            <span className="text-[12px] font-semibold">Plate Checks Logged</span>
            <ScanLine size={18} className="text-[#0071e3] dark:text-[#0a84ff]" aria-hidden="true" />
          </div>
          <p className="mt-2 text-[28px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
            {loading ? '—' : plateChecksTotal}
          </p>
          <p className="mt-1 text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
            Total AI vision plate verifications by this desk
          </p>
        </button>
      </section>

      {/* Two-column live operational feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Today's Expected & Active Vehicles */}
        <section
          aria-labelledby="overview-bookings-heading"
          className="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#141417] p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 id="overview-bookings-heading" className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Today’s Expected Vehicles
            </h3>
            <button
              type="button"
              onClick={() => onNavigateView('bookings')}
              className="text-[12px] font-semibold text-[#0071e3] dark:text-[#0a84ff] hover:underline"
            >
              View all bookings
            </button>
          </div>

          {todayBookings.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
              No bookings are scheduled for today at this property.
            </p>
          ) : (
            <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              {todayBookings.slice(0, 6).map((b) => (
                <li key={b.bookingId} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-block rounded-md bg-[#111318] text-white font-mono text-[12px] font-bold tracking-wider px-2 py-0.5">
                        {b.vehicleNumberPlate}
                      </span>
                      <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                        {b.parkingLabel || `Spot #${b.parkingSpotId}`}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#6e6e73] dark:text-[#a1a1aa]">
                      {formatWindow(parseLocalMyt(b.startDate), parseLocalMyt(b.endDate))}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onInspectBooking(b.bookingId)}
                    className="min-h-9 px-3 rounded-lg border border-black/[0.1] dark:border-white/[0.14] text-[12px] font-semibold shrink-0"
                  >
                    {b.bookingStatus}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Latest Physical Bollard Entries */}
        <section
          aria-labelledby="overview-entries-heading"
          className="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#141417] p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 id="overview-entries-heading" className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Today’s Physical Gate Entries
            </h3>
            <button
              type="button"
              onClick={() => onNavigateView('access')}
              className="text-[12px] font-semibold text-[#0071e3] dark:text-[#0a84ff] hover:underline"
            >
              Full entry log
            </button>
          </div>

          {recentEvents.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
              No physical entry events recorded today yet.
            </p>
          ) : (
            <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              {recentEvents.map((ev) => (
                <li key={ev.ioTStatusLogId} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-[#248a3d] dark:text-[#30d158] shrink-0" aria-hidden="true" />
                      <span className="font-mono text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {ev.vehicleNumberPlate}
                      </span>
                      <span className="text-[12px] text-[#6e6e73] dark:text-[#a1a1aa] truncate">
                        · {ev.parkingLabel || `Spot #${ev.parkingSpotId}`}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#6e6e73] dark:text-[#a1a1aa]">
                      {ev.firstEntryForBooking ? 'First check-in' : 'Repeat entry'} · Booking #{ev.bookingId}
                    </p>
                  </div>
                  <span className="text-[11px] text-[#6e6e73] dark:text-[#a1a1aa] inline-flex items-center gap-1 shrink-0">
                    <Clock size={12} aria-hidden="true" />
                    <span>{formatAgo(parseUtc(ev.enteredAtUtc))}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
