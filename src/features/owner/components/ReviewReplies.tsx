import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Pencil,
  RefreshCw,
  Send,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteReview,
  getOwnerParkingReviews,
  type ReviewApiData,
  updateOwnerReply,
} from '@/features/commuter/api/reviewApi';
import { showConfirm } from '@/contexts/ModalContext';
import type { ParkingBay } from '../types';

interface ReviewRepliesProps {
  token: string;
  bays: ParkingBay[];
  baysLoading: boolean;
}

interface OwnerReviewItem {
  review: ReviewApiData;
  bay: ParkingBay;
}

interface ReplyDraft {
  reviewId: number;
  ownerReply: string;
}

const reviewDateFormatter = new Intl.DateTimeFormat('en-MY', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatReviewDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently' : reviewDateFormatter.format(date);
}

export default function ReviewReplies({ token, bays, baysLoading }: ReviewRepliesProps) {
  const [items, setItems] = useState<OwnerReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReplyDraft | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadReviews = useCallback(async (signal?: AbortSignal) => {
    if (bays.length === 0) {
      setItems([]);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const results = await Promise.allSettled(
        bays.map(async (bay) => ({
          bay,
          response: await getOwnerParkingReviews(token, bay.parkingSpotId, 1, 50, signal),
        })),
      );
      if (signal?.aborted) return;

      const loaded = results.flatMap((result) => (
        result.status === 'fulfilled'
          ? result.value.response.data.map((review) => ({ review, bay: result.value.bay }))
          : []
      ));
      loaded.sort((left, right) => (
        new Date(right.review.createdAt).getTime() - new Date(left.review.createdAt).getTime()
      ));
      setItems(loaded);

      const failedCount = results.filter((result) => result.status === 'rejected').length;
      if (failedCount > 0) {
        setLoadError(
          failedCount === bays.length
            ? 'Unable to load reviews for your parking spots.'
            : `Reviews for ${failedCount} parking spot${failedCount === 1 ? '' : 's'} could not be loaded.`,
        );
      }
    } catch (error) {
      if (signal?.aborted) return;
      setLoadError(error instanceof Error ? error.message : 'Unable to load parking reviews.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [bays, token]);

  useEffect(() => {
    const controller = new AbortController();
    void loadReviews(controller.signal);
    return () => controller.abort();
  }, [loadReviews]);

  const beginReply = (review: ReviewApiData) => {
    setDraft({ reviewId: review.reviewId, ownerReply: review.ownerReply ?? '' });
    setReplyError(null);
    setNotice(null);
  };

  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;

    const ownerReply = draft.ownerReply.trim();
    if (!ownerReply) {
      setReplyError('Enter a reply before publishing.');
      return;
    }

    setSavingId(draft.reviewId);
    setReplyError(null);
    setNotice(null);
    try {
      const result = await updateOwnerReply(token, draft.reviewId, { ownerReply });
      setItems((current) => current.map((item) => (
        item.review.reviewId === draft.reviewId
          ? { ...item, review: result.data }
          : item
      )));
      setDraft(null);
      setNotice(result.message || 'Owner reply published successfully.');
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : 'Unable to publish this owner reply.');
    } finally {
      setSavingId(null);
    }
  };

  const removeReview = async (review: ReviewApiData) => {
    const confirmed = await showConfirm({
      title: 'Delete Review',
      message: 'Delete this review permanently? This cannot be undone.',
      confirmText: 'Delete Review',
      cancelText: 'Cancel',
      variant: 'danger',
      icon: 'trash',
    });
    if (!confirmed) return;

    setDeletingId(review.reviewId);
    setReplyError(null);
    setNotice(null);
    try {
      const result = await deleteReview(token, review.reviewId);
      setItems((current) => current.filter((item) => item.review.reviewId !== review.reviewId));
      if (draft?.reviewId === review.reviewId) setDraft(null);
      setNotice(result.message || 'Review deleted successfully.');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to delete this review.');
    } finally {
      setDeletingId(null);
    }
  };

  const waitingForParking = baysLoading && bays.length === 0;

  return (
    <section className="space-y-5" aria-labelledby="owner-reviews-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 id="owner-reviews-heading" className="text-2xl font-extrabold tracking-tight text-slate-900">
            Parking reviews
          </h1>
          <p className="mt-1 text-xs leading-normal text-slate-500">
            Read verified customer feedback and publish a response from the parking owner.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadReviews()}
          disabled={loading || waitingForParking}
          className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh reviews
        </button>
      </div>

      {notice && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {notice}
        </div>
      )}

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {loadError}
          </span>
          <button type="button" onClick={() => void loadReviews()} className="font-bold underline">
            Retry
          </button>
        </div>
      )}

      {(waitingForParking || loading) && items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" aria-hidden="true" />
          <p className="mt-2 text-xs font-medium text-slate-500">Loading parking reviews...</p>
        </div>
      ) : bays.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <Building2 className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-bold text-slate-900">No registered parking spots</h2>
          <p className="mt-1 text-xs text-slate-500">Register a parking spot before managing customer reviews.</p>
        </div>
      ) : items.length === 0 && !loadError ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <MessageSquare className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-bold text-slate-900">No reviews yet</h2>
          <p className="mt-1 text-xs text-slate-500">New customer reviews for your parking spots will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(({ review, bay }) => {
            const isEditing = draft?.reviewId === review.reviewId;
            const isSaving = savingId === review.reviewId;
            const isDeleting = deletingId === review.reviewId;

            return (
              <article key={review.reviewId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-extrabold text-slate-900">
                        {review.reviewerDisplayName || 'ParkJom commuter'}
                      </h2>
                      {review.isVerifiedBooking && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Verified booking
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                      <span>{bay.propertyName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{bay.parkingLabel || `Spot #${bay.parkingSpotId}`}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={review.createdAt}>{formatReviewDate(review.createdAt)}</time>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        className={`h-4 w-4 ${index < review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-700">
                  {review.comment || 'The reviewer did not leave a written comment.'}
                </p>

                {review.ownerReply && !isEditing && (
                  <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-wide text-blue-700">Your reply</p>
                      {review.ownerReplyAt && (
                        <time dateTime={review.ownerReplyAt} className="text-[10px] text-blue-500">
                          {formatReviewDate(review.ownerReplyAt)}
                        </time>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-700">{review.ownerReply}</p>
                  </div>
                )}

                {isEditing ? (
                  <form onSubmit={submitReply} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <label htmlFor={`owner-reply-${review.reviewId}`} className="block text-xs font-bold text-slate-700">
                      Your reply
                    </label>
                    <textarea
                      id={`owner-reply-${review.reviewId}`}
                      value={draft.ownerReply}
                      onChange={(event) => {
                        setDraft({ ...draft, ownerReply: event.target.value });
                        setReplyError(null);
                      }}
                      rows={3}
                      required
                      autoFocus
                      disabled={isSaving}
                      placeholder="Thank the reviewer or respond to their feedback."
                      className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs leading-5 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                    />
                    {replyError && (
                      <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {replyError}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDraft(null);
                          setReplyError(null);
                        }}
                        disabled={isSaving}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving || !draft.ownerReply.trim()}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                        {review.ownerReply ? 'Update reply' : 'Publish reply'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void removeReview(review)}
                      disabled={isDeleting}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                      Delete review
                    </button>
                    <button
                      type="button"
                      onClick={() => beginReply(review)}
                      disabled={isDeleting}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-4 text-xs font-bold text-blue-700 hover:bg-blue-50"
                    >
                      {review.ownerReply ? <Pencil className="h-4 w-4" aria-hidden="true" /> : <MessageSquare className="h-4 w-4" aria-hidden="true" />}
                      {review.ownerReply ? 'Edit reply' : 'Reply to review'}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
