import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw, Star } from 'lucide-react';
import { getOwnerBookingHistory, type BookingHistoryItem } from '@/features/bookings/api/bookingHistoryApi';
import type { ParkingBay } from '../types';

interface Props { token: string; bays: ParkingBay[]; onOpenReviews: () => void; }

export default function OwnerBookingHistory({ token, bays, onOpenReviews }: Props) {
  const [items, setItems] = useState<BookingHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    void getOwnerBookingHistory(token, page, 10, controller.signal).then((result) => {
      if (!controller.signal.aborted) { setItems(result.data); setPages(result.totalPages); }
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load booking history.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, page, refresh]);

  return <section className="mt-6 space-y-3">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-extrabold text-slate-900">Booking history</h2>
      <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700">
        <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} /> Refresh
      </button>
    </div>
    {error && <div role="alert" className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700"><AlertCircle className="h-4 w-4" />{error}</div>}
    {loading && items.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" /><p className="mt-2 text-xs text-slate-500">Loading booking history...</p></div> : null}
    {!loading && !error && items.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">No booking history yet.</p>}
    <div className="space-y-3">
      {items.map(({ booking, review }) => (
        <article key={booking.bookingId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{bays.find((bay) => bay.parkingSpotId === booking.parkingSpotId)?.propertyName ?? 'Parking spot #' + booking.parkingSpotId}</h3>
              <p className="mt-1 text-[11px] text-slate-500">Bay {booking.parkingLabel || booking.parkingSpotId} · {booking.bookingStatus}</p>
              <p className="mt-1 text-[11px] text-slate-500">{new Date(booking.startDate).toLocaleDateString('en-MY')} – {new Date(booking.endDate).toLocaleDateString('en-MY')}</p>
              <p className="mt-1 text-[10px] text-slate-400">Commuter #{booking.renterId} · Vehicle #{booking.vehicleId}</p>
            </div>
            <strong className="text-sm">RM {booking.totalAmount.toFixed(2)}</strong>
          </div>
          {booking.cancellationReason && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">Cancellation: {booking.cancellationReason}</p>}
          {review && <div className="mt-3 rounded-xl bg-slate-50 p-3"><div className="flex gap-1">{Array.from({ length: 5 }, (_, index) => <Star key={index} className={'h-3.5 w-3.5 ' + (index < review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200')} />)}</div><p className="mt-2 text-xs text-slate-700">{review.comment || 'No written review.'}</p><button type="button" onClick={onOpenReviews} className="mt-2 text-[11px] font-bold text-blue-700 hover:underline">{review.ownerReply ? 'Manage reply' : 'Reply to review'}</button></div>}
        </article>
      ))}
    </div>
    {pages > 1 && <div className="flex justify-between text-xs font-bold text-slate-600"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>Previous</button><span>Page {page} of {pages}</span><button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page === pages}>Next</button></div>}
  </section>;
}
