import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
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
import { deleteReview, getAdminReviews, type ReviewApiData } from '@/features/commuter/api/reviewApi';

interface ParkingSpotOption {
  parkingSpotId: number;
  label: string;
}

interface ReviewModerationProps {
  token: string;
  parkingSpots: ParkingSpotOption[];
  onModerated: (message: string) => void;
}

interface ReviewGroup {
  parkingSpotId: number;
  label: string;
  reviews: ReviewApiData[];
}

const PAGE_SIZE = 20;
const moderationReasons = [
  'Inappropriate or offensive language',
  'Spam or irrelevant content',
  'Personal information',
  'Harassment or threats',
  'Fraudulent or misleading review',
];

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Recently'
    : date.toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Recently'
    : date.toLocaleString('en-MY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
}

function getReviewSearchText(review: ReviewApiData, parkingLabel: string) {
  return [
    review.reviewId,
    review.parkingSpotId,
    review.rating,
    review.reviewerDisplayName,
    review.comment,
    review.ownerReply,
    review.createdAt,
    review.updatedAt,
    parkingLabel,
    review.isVerifiedBooking ? 'verified booking' : 'unverified booking',
    review.ownerReply ? 'owner replied' : 'no owner reply',
  ]
    .map((value) => String(value ?? '').toLowerCase())
    .join(' ');
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-amber-500" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`h-3.5 w-3.5 ${index < rating ? 'fill-current' : 'text-slate-200'}`}
        />
      ))}
    </div>
  );
}

export default function ReviewModeration({ token, parkingSpots, onModerated }: ReviewModerationProps) {
  const [reviews, setReviews] = useState<ReviewApiData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [collapsedParkingSpots, setCollapsedParkingSpots] = useState<Set<number>>(new Set());
  const [selectedReview, setSelectedReview] = useState<ReviewApiData | null>(null);
  const [reason, setReason] = useState(moderationReasons[0]);
  const [deleting, setDeleting] = useState(false);

  const parkingSpotLabels = useMemo(
    () => new Map(parkingSpots.map((spot) => [spot.parkingSpotId, spot.label.trim()])),
    [parkingSpots],
  );

  const getParkingLabel = useCallback((parkingSpotId: number) => (
    parkingSpotLabels.get(parkingSpotId) || `Parking lot #${parkingSpotId}`
  ), [parkingSpotLabels]);

  const loadReviews = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const result = await getAdminReviews(token, {
        search: searchQuery,
        rating: ratingFilter === 'all' ? undefined : Number(ratingFilter),
        page,
        pageSize: PAGE_SIZE,
        signal,
      });
      if (signal?.aborted) return;

      setReviews(result.data);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch (loadError) {
      if (signal?.aborted) return;
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin reviews.');
      setReviews([]);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, ratingFilter, searchQuery, token]);

  useEffect(() => {
    const controller = new AbortController();
    void loadReviews(controller.signal);
    return () => controller.abort();
  }, [loadReviews]);

  const visibleReviews = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return reviews.filter((review) => {
      const matchesRating = ratingFilter === 'all' || review.rating === Number(ratingFilter);
      const matchesSearch = !query || getReviewSearchText(review, getParkingLabel(review.parkingSpotId)).includes(query);
      return matchesRating && matchesSearch;
    });
  }, [getParkingLabel, ratingFilter, reviews, searchQuery]);

  const reviewGroups = useMemo<ReviewGroup[]>(() => {
    const grouped = new Map<number, ReviewApiData[]>();
    visibleReviews.forEach((review) => {
      const current = grouped.get(review.parkingSpotId) ?? [];
      current.push(review);
      grouped.set(review.parkingSpotId, current);
    });

    return Array.from(grouped.entries())
      .map(([parkingSpotId, groupReviews]) => ({
        parkingSpotId,
        label: getParkingLabel(parkingSpotId),
        reviews: [...groupReviews].sort((left, right) => {
          const leftTime = new Date(left.createdAt).getTime();
          const rightTime = new Date(right.createdAt).getTime();
          return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
        }),
      }))
      .sort((left, right) => left.parkingSpotId - right.parkingSpotId);
  }, [getParkingLabel, visibleReviews]);

  const averageRating = visibleReviews.length
    ? visibleReviews.reduce((sum, review) => sum + review.rating, 0) / visibleReviews.length
    : 0;
  const verifiedCount = visibleReviews.filter((review) => review.isVerifiedBooking).length;
  const ownerReplyCount = visibleReviews.filter((review) => Boolean(review.ownerReply)).length;

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setPage(1);
  };

  const toggleParkingSpot = (parkingSpotId: number) => {
    setCollapsedParkingSpots((current) => {
      const next = new Set(current);
      if (next.has(parkingSpotId)) next.delete(parkingSpotId);
      else next.add(parkingSpotId);
      return next;
    });
  };

  const removeReview = async () => {
    if (!selectedReview) return;
    setDeleting(true);
    setError(null);

    try {
      await deleteReview(token, selectedReview.reviewId);
      const deletedReview = selectedReview;
      setReviews((current) => current.filter((review) => review.reviewId !== deletedReview.reviewId));
      setTotalCount((current) => Math.max(0, current - 1));
      onModerated(
        `Removed review #${deletedReview.reviewId} by ${deletedReview.reviewerDisplayName || 'a commuter'}. Reason: ${reason}.`,
      );
      setSelectedReview(null);
      setReason(moderationReasons[0]);

      if (reviews.length === 1 && page > 1) setPage((current) => current - 1);
      else void loadReviews();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this review.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Review traceability</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Trace every commuter review, its parking lot, and the owner response from one moderation workspace.
        </p>
      </div>

      <form onSubmit={submitSearch} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">Search admin reviews</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search parking ID, review ID, commuter, review text, owner reply, rating..."
              aria-label="Search parking ID, review ID, commuter, review text, owner reply, or rating"
              className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-10 text-sm text-slate-700 outline-hidden placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear review search"
                className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            Rating
            <select
              value={ratingFilter}
              onChange={(event) => {
                setRatingFilter(event.target.value);
                setPage(1);
              }}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All ratings</option>
              {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
            </select>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Search className="h-4 w-4" />
            Search reviews
          </button>
          <button
            type="button"
            onClick={() => void loadReviews()}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Search covers parking lot ID, review ID, commuter name, review text, owner reply, rating, date, and response status.
        </p>
      </form>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </span>
          <button type="button" onClick={() => void loadReviews()} className="font-bold underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Reviews found</span>
            <MessageSquare className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{totalCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Parking lots</span>
            <Users className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-indigo-600">{reviewGroups.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Average rating</span>
            <Star className="h-4 w-4 fill-current text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">{averageRating.toFixed(1)} <span className="text-sm font-medium text-slate-400">/ 5</span></p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Owner responses</span>
            <UserRound className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{ownerReplyCount}</p>
          <p className="mt-1 text-[10px] text-slate-400">{verifiedCount} verified bookings on this page</p>
        </div>
      </div>

      {loading && reviews.length === 0 ? (
        <div className="flex min-h-64 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
        </div>
      ) : reviewGroups.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-center">
          <ShieldCheck className="h-9 w-9 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">No reviews found</p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            {searchQuery || ratingFilter !== 'all'
              ? 'Try a different search or rating filter.'
              : 'Reviews from commuters will appear here, grouped by parking lot.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviewGroups.map((group) => {
            const isCollapsed = collapsedParkingSpots.has(group.parkingSpotId);
            const groupAverage = group.reviews.reduce((sum, review) => sum + review.rating, 0) / group.reviews.length;

            return (
              <section key={group.parkingSpotId} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleParkingSpot(group.parkingSpotId)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold text-slate-800">{group.label}</span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-700">#{group.parkingSpotId}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                      <span>{group.reviews.length} review{group.reviews.length === 1 ? '' : 's'}</span>
                      <span>{groupAverage.toFixed(1)} average rating</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-slate-500">{isCollapsed ? 'Show reviews' : 'Hide reviews'}</span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-3 p-3 sm:p-4">
                    {group.reviews.map((review) => (
                      <article key={review.reviewId} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <UserRound className="h-4 w-4 text-slate-400" />
                              <p className="text-sm font-bold text-slate-800">{review.reviewerDisplayName || 'ParkJom commuter'}</p>
                              {review.isVerifiedBooking && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                                  <ShieldCheck className="h-3 w-3" />
                                  Verified booking
                                </span>
                              )}
                              <span className="font-mono text-[10px] text-slate-400">Review #{review.reviewId}</span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                              <span>Commuter review</span>
                              <span>Submitted {formatDateTime(review.createdAt)}</span>
                              {review.updatedAt && review.updatedAt !== review.createdAt && <span>Updated {formatDate(review.updatedAt)}</span>}
                            </div>
                            <div className="mt-3"><StarRating rating={review.rating} /></div>

                            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Commuter feedback</p>
                              <p className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-700">
                                {review.comment || 'The commuter did not leave a written comment.'}
                              </p>
                            </div>

                            <div className={`mt-3 rounded-lg border px-3 py-3 ${review.ownerReply ? 'border-blue-100 bg-blue-50/60' : 'border-dashed border-slate-200 bg-white'}`}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className={`text-[9px] font-bold uppercase tracking-wide ${review.ownerReply ? 'text-blue-700' : 'text-slate-400'}`}>Owner response</p>
                                {review.ownerReplyAt && <time dateTime={review.ownerReplyAt} className="text-[10px] text-blue-500">{formatDateTime(review.ownerReplyAt)}</time>}
                              </div>
                              <p className={`mt-1 text-[11px] leading-4 ${review.ownerReply ? 'text-slate-700' : 'text-slate-400'}`}>
                                {review.ownerReply || 'No owner response has been recorded for this review.'}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedReview(review)}
                            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <AlertDialog open={Boolean(selectedReview)} onOpenChange={(open) => { if (!open && !deleting) setSelectedReview(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-rose-50 text-rose-600"><AlertTriangle /></AlertDialogMedia>
            <AlertDialogTitle>Remove this review?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the review through the admin review API. Select a reason for the activity log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="text-xs font-semibold text-slate-700">
            Removal reason
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={deleting}
              className="mt-2 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {moderationReasons.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep review</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeReview()} disabled={deleting} className="bg-rose-600 text-white hover:bg-rose-700">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
