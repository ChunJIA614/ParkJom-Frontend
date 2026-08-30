import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle2, Loader2, MapPin, ShieldCheck, Star } from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { useAuth } from '@/features/auth/context/AuthContext';
import type { Booking } from '../types';
import { createReview } from '../api/reviewApi';
import { saveParkingReview } from '../lib/parkingReviews';

const ratingCopy = ['Select a rating', 'Very disappointing', 'Could be better', 'Good overall', 'Great parking', 'Excellent experience'];
const highlights = ['Easy to find', 'Close to transit', 'Felt secure', 'Clean space', 'Easy access'];

export default function ParkingReview() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { booking?: Booking } };
  const { user, logout } = useAuth();
  const booking = location.state?.booking;
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedHighlights, setSelectedHighlights] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleHighlight = (highlight: string) => {
    setSelectedHighlights((current) => current.includes(highlight)
      ? current.filter((item) => item !== highlight)
      : [...current, highlight]);
  };

  const submitReview = async () => {
    if (!booking || !user?.userId || !user.token || isSubmitting) return;
    if (!rating) return setError('Choose a star rating before submitting.');

    const parsedBookingId = Number(booking.id);
    const bookingId = booking.bookingId
      ?? (Number.isInteger(parsedBookingId) && parsedBookingId > 0 ? parsedBookingId : null);
    if (!bookingId) {
      return setError('This booking is missing its server booking ID and cannot be reviewed yet.');
    }

    const detail = [comment.trim(), selectedHighlights.length ? `Highlights: ${selectedHighlights.join(', ')}.` : '']
      .filter(Boolean).join('\n\n');

    setIsSubmitting(true);
    setError('');
    try {
      const result = await createReview(user.token, {
        bookingId,
        rating,
        ...(detail ? { comment: detail } : {}),
      });
      saveParkingReview({
        reviewId: result.data.reviewId,
        bookingId: String(bookingId),
        parkingSpotId: result.data.parkingSpotId,
        reviewerId: user.userId,
        reviewerName: result.data.reviewerDisplayName
          || `${user.firstName || ''} ${user.lastName || ''}`.trim()
          || 'ParkJom commuter',
        rating: result.data.rating,
        comment: result.data.comment,
        ownerReply: result.data.ownerReply,
        ownerReplyAt: result.data.ownerReplyAt,
        createdAt: result.data.createdAt,
        updatedAt: result.data.updatedAt,
        parkingName: booking.spot.name,
        stationName: booking.spot.station,
      });
      setSubmitted(true);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to publish this review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!booking) {
    return (
      <div className="page-shell min-h-screen text-[#1d1d1f]">
        <DashboardHeader role="commuter" user={user} onSignOut={() => { logout(); navigate('/'); }} onBrandClick={() => navigate('/commuter')} />
        <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
          <ShieldCheck size={38} className="text-[#8e8e93]" />
          <h1 className="mt-5 text-xl font-semibold">Complete a booking first</h1>
          <p className="mt-2 text-[13px] leading-5 text-[#6e6e73]">Reviews are linked to completed stays so other commuters can trust what they read.</p>
          <button onClick={() => navigate('/commuter')} className="mt-6 rounded-xl bg-[#007AFF] px-5 py-3 text-[13px] font-semibold text-white">Back to parking</button>
        </main>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="page-shell min-h-screen text-[#1d1d1f]">
        <DashboardHeader role="commuter" user={user} onSignOut={() => { logout(); navigate('/'); }} onBrandClick={() => navigate('/commuter')} />
        <main className="mx-auto max-w-lg px-4 py-12 md:py-20">
          <section className="rounded-3xl border border-black/[0.07] bg-white p-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.06)] md:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ecfdf3] text-[#16a34a]"><CheckCircle2 size={28} /></div>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#16a34a]">Review published</p>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em]">Thanks for helping commuters</h1>
            <p className="mx-auto mt-3 max-w-sm text-[13px] leading-5 text-[#6e6e73]">Your verified review is now part of this parking spot’s reputation.</p>
            <div className="mt-5 flex justify-center gap-1 text-[#ff9500]">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={22} fill={i < rating ? 'currentColor' : 'none'} />)}</div>
            <button onClick={() => navigate('/commuter', { state: { activeTab: 'home' } })} className="mt-8 w-full rounded-xl bg-[#007AFF] px-5 py-3 text-[13px] font-semibold text-white">Find my next parking spot</button>
          </section>
        </main>
      </div>
    );
  }

  const activeRating = hoveredRating || rating;
  return (
    <div className="page-shell min-h-screen pb-10 text-[#1d1d1f]">
      <DashboardHeader role="commuter" user={user} onSignOut={() => { logout(); navigate('/'); }} onBrandClick={() => navigate('/commuter')} />
      <main className="mx-auto max-w-2xl px-4 py-6 md:px-6 md:py-10">
        <button onClick={() => navigate('/commuter')} className="inline-flex min-h-11 items-center gap-2 text-[13px] font-medium text-[#6e6e73] hover:text-[#111]"><ArrowLeft size={17} /> Skip for now</button>

        <section className="mt-3 overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="border-b border-black/[0.06] bg-[#f8f9fa] p-6 md:p-8">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#007AFF]"><Check size={14} /> Parking completed</div>
            <h1 className="mt-3 text-2xl font-bold tracking-[-0.035em] md:text-3xl">How was your parking?</h1>
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/[0.06]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f0fe] text-[#007AFF]"><MapPin size={19} /></div>
              <div><p className="text-[13px] font-semibold text-[#111]">{booking.spot.name}</p><p className="mt-0.5 text-[12px] text-[#6e6e73]">{booking.spot.address} · {booking.spot.station}</p></div>
            </div>
          </div>

          <div className="space-y-8 p-6 md:p-8">
            <fieldset className="text-center">
              <legend className="w-full text-[13px] font-semibold">Your overall rating</legend>
              <div className="mt-4 flex justify-center gap-2" onMouseLeave={() => setHoveredRating(0)}>
                {Array.from({ length: 5 }, (_, index) => {
                  const value = index + 1;
                  return <button key={value} type="button" aria-label={`${value} star${value > 1 ? 's' : ''}`} onMouseEnter={() => setHoveredRating(value)} onFocus={() => setHoveredRating(value)} onBlur={() => setHoveredRating(0)} onClick={() => { setRating(value); setError(''); }} className={`rounded-xl p-1.5 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-[#007AFF] ${value <= activeRating ? 'text-[#ff9500]' : 'text-[#d2d2d7]'}`}><Star size={35} fill={value <= activeRating ? 'currentColor' : 'none'} /></button>;
                })}
              </div>
              <p className={`mt-2 min-h-5 text-[12px] font-medium ${activeRating ? 'text-[#a15c00]' : 'text-[#8e8e93]'}`}>{ratingCopy[activeRating]}</p>
            </fieldset>

            <div>
              <p className="text-[13px] font-semibold">What stood out?</p>
              <div className="mt-3 flex flex-wrap gap-2">{highlights.map((highlight) => <button key={highlight} type="button" aria-pressed={selectedHighlights.includes(highlight)} onClick={() => toggleHighlight(highlight)} className={`min-h-10 rounded-full border px-4 text-[12px] font-medium transition ${selectedHighlights.includes(highlight) ? 'border-[#007AFF] bg-[#e8f0fe] text-[#0066d6]' : 'border-[#d2d2d7] bg-white text-[#5f6368] hover:border-[#8e8e93]'}`}>{selectedHighlights.includes(highlight) && <Check size={13} className="mr-1.5 inline" />}{highlight}</button>)}</div>
            </div>

            <div>
              <div className="flex items-center justify-between"><label htmlFor="review-comment" className="text-[13px] font-semibold">Share helpful details</label><span className="text-[11px] text-[#8e8e93]">{comment.length}/500</span></div>
              <p className="mt-1 text-[11px] text-[#8e8e93]">Mention access, safety, cleanliness or the walk to transit.</p>
              <textarea id="review-comment" value={comment} maxLength={500} rows={5} onChange={(event) => { setComment(event.target.value); setError(''); }} placeholder="The bay was easy to locate and the walk to the station…" className="mt-3 w-full resize-none rounded-2xl border border-[#d2d2d7] bg-white p-4 text-[13px] leading-5 outline-none transition placeholder:text-[#aeaeb2] focus:border-[#007AFF] focus:ring-4 focus:ring-[#007AFF]/10" />
            </div>

            {error && <p role="alert" className="rounded-xl bg-[#fff2f1] px-4 py-3 text-[12px] font-medium text-[#d92d20]">{error}</p>}
            <div>
              <button onClick={() => void submitReview()} disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-5 py-3.5 text-[13px] font-semibold text-white transition hover:bg-[#0066d6] active:scale-[0.99] disabled:cursor-wait disabled:opacity-70">
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isSubmitting ? 'Publishing…' : 'Publish review'}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-[#8e8e93]"><ShieldCheck size={12} /> Verified booking · Your vehicle and payment details stay private</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
