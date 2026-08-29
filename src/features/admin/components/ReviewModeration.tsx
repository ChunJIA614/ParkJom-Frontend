import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, MessageSquare, Search, ShieldCheck, Star, Trash2, UserRound } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  deleteParkingReview,
  loadAllParkingReviews,
  PARKING_REVIEWS_CHANGED_EVENT,
  type ParkingReview,
} from '@/features/commuter/lib/parkingReviews';

interface ReviewModerationProps {
  onModerated: (message: string) => void;
}

const moderationReasons = ['Inappropriate or offensive language', 'Spam or irrelevant content', 'Personal information', 'Harassment or threats', 'Fraudulent or misleading review'];

export default function ReviewModeration({ onModerated }: ReviewModerationProps) {
  const [reviews, setReviews] = useState(loadAllParkingReviews);
  const [search, setSearch] = useState('');
  const [rating, setRating] = useState('all');
  const [selectedReview, setSelectedReview] = useState<ParkingReview | null>(null);
  const [reason, setReason] = useState(moderationReasons[0]);

  useEffect(() => {
    const refresh = () => setReviews(loadAllParkingReviews());
    window.addEventListener(PARKING_REVIEWS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PARKING_REVIEWS_CHANGED_EVENT, refresh);
  }, []);

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reviews.filter((review) => {
      const matchesRating = rating === 'all' || review.rating === Number(rating);
      const matchesSearch = !query || [review.reviewerName, review.comment, review.parkingName, review.stationName, review.parkingSpotId, review.bookingId]
        .some((value) => String(value ?? '').toLowerCase().includes(query));
      return matchesRating && matchesSearch;
    });
  }, [rating, reviews, search]);

  const removeReview = () => {
    if (!selectedReview) return;
    if (deleteParkingReview(selectedReview.reviewId, { isAdmin: true })) {
      onModerated(`Removed review #${selectedReview.reviewId} by ${selectedReview.reviewerName}. Reason: ${reason}.`);
    }
    setSelectedReview(null);
    setReason(moderationReasons[0]);
  };

  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Review moderation</h2>
        <p className="text-sm text-slate-500">Monitor commuter feedback and remove content that violates ParkJom guidelines.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase text-slate-400">Published reviews</span><MessageSquare className="h-4 w-4 text-blue-600" /></div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{reviews.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase text-slate-400">Average rating</span><Star className="h-4 w-4 text-amber-500" fill="currentColor" /></div>
          <p className="mt-2 text-2xl font-bold text-amber-600">{averageRating.toFixed(1)} <span className="text-sm font-medium text-slate-400">/ 5</span></p>
        </div>
        <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase text-slate-400">Verified authors</span><UserRound className="h-4 w-4 text-emerald-600" /></div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{new Set(reviews.map((review) => review.reviewerId || review.reviewerName)).size}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:p-4">
        <label className="relative block flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search review, commuter, or parking" aria-label="Search reviews" className="min-h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-500">Rating
          <select value={rating} onChange={(event) => setRating(event.target.value)} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="all">All ratings</option>
            {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
          </select>
        </label>
      </div>

      {filteredReviews.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-center">
          <ShieldCheck className="h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">No reviews found</p>
          <p className="mt-1 text-xs text-slate-400">Try changing the search or rating filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReviews.map((review) => (
            <article key={review.reviewId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">{review.reviewerName}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700"><ShieldCheck className="h-3 w-3" /> Verified booking</span>
                    <span className="font-mono text-[10px] text-slate-400">#{review.reviewId}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                    <span>{review.parkingName || `Parking spot #${review.parkingSpotId}`}</span>
                    {review.stationName && <span>{review.stationName}</span>}
                    <span>{new Date(review.createdAt).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="mt-3 flex gap-0.5 text-amber-500" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} className={`h-3.5 w-3.5 ${index >= review.rating ? 'text-slate-200' : ''}`} fill={index < review.rating ? 'currentColor' : 'none'} />)}</div>
                  <p className="mt-3 whitespace-pre-line text-xs leading-5 text-slate-600">{review.comment}</p>
                  {review.ownerReply && <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"><p className="text-[9px] font-bold uppercase tracking-wide text-blue-600">Owner reply</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{review.ownerReply}</p></div>}
                </div>
                <button type="button" onClick={() => setSelectedReview(review)} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
              </div>
            </article>
          ))}
        </div>
      )}

      <AlertDialog open={Boolean(selectedReview)} onOpenChange={(open) => { if (!open) setSelectedReview(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-rose-50 text-rose-600"><AlertTriangle /></AlertDialogMedia>
            <AlertDialogTitle>Remove this review?</AlertDialogTitle>
            <AlertDialogDescription>This permanently hides the review from commuters. Select the policy reason for the moderation log.</AlertDialogDescription>
          </AlertDialogHeader>
          <label className="text-xs font-semibold text-slate-700">Removal reason
            <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
              {moderationReasons.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep review</AlertDialogCancel>
            <AlertDialogAction onClick={removeReview} className="bg-rose-600 text-white hover:bg-rose-700">Remove review</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
