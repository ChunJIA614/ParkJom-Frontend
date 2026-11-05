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
  Flag,
} from 'lucide-react';
import {
  deleteReview,
  getOwnerParkingReviews,
  type ReviewApiData,
  updateOwnerReply,
  reportReview,
} from '@/features/commuter/api/reviewApi';
import { showConfirm } from '@/contexts/ModalContext';
import SystemSelect from '@/components/ui/SystemSelect';
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
  const [reportingReview, setReportingReview] = useState<ReviewApiData | null>(null);
  const [reportReason, setReportReason] = useState('Inappropriate or offensive language');
  const [reportDetails, setReportDetails] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [reportStatus, setReportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
          <h1 id="owner-reviews-heading" className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Parking reviews
          </h1>
          <p className="mt-1 text-xs leading-normal text-slate-500 dark:text-slate-400">
            Read verified customer feedback and publish a response from the parking owner.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadReviews()}
          disabled={loading || waitingForParking}
          className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e] px-4 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-[#252830] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh reviews
        </button>
      </div>

      {notice && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {notice}
        </div>
      )}

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-700 dark:text-rose-400">
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
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141417] p-10 text-center shadow-sm">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Loading parking reviews...</p>
        </div>
      ) : bays.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141417] p-10 text-center shadow-sm">
          <Building2 className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">No registered parking spots</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Register a parking spot before managing customer reviews.</p>
        </div>
      ) : items.length === 0 && !loadError ? (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141417] p-10 text-center shadow-sm">
          <MessageSquare className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">No reviews yet</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">New customer reviews for your parking spots will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(({ review, bay }) => {
            const isEditing = draft?.reviewId === review.reviewId;
            const isSaving = savingId === review.reviewId;
            const isDeleting = deletingId === review.reviewId;

            return (
              <article key={review.reviewId} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141417] p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {review.reviewerDisplayName || 'ParkJom commuter'}
                      </h2>
                      {review.isVerifiedBooking && (
                        <span className="rounded-full border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                          Verified booking
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
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
                        className={`h-4 w-4 ${index < review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'}`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                </div>

                <p className="review-comment-text mt-4 text-sm leading-6">
                  {review.comment || 'The reviewer did not leave a written comment.'}
                </p>

                {review.photos && review.photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {review.photos.map((photo, pIdx) => (
                      <img
                        key={pIdx}
                        src={photo}
                        alt={`Review photo ${pIdx + 1}`}
                        className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl object-cover border border-slate-200 dark:border-white/10"
                      />
                    ))}
                  </div>
                )}

                {review.ownerReply && !isEditing && (
                  <div className="review-owner-reply-box mt-4 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="review-owner-reply-title text-[10px] font-extrabold uppercase tracking-wide">Your reply</p>
                      {review.ownerReplyAt && (
                        <time dateTime={review.ownerReplyAt} className="review-owner-reply-time text-[10px]">
                          {formatReviewDate(review.ownerReplyAt)}
                        </time>
                      )}
                    </div>
                    <p className="review-owner-reply-text mt-1 text-xs leading-5">{review.ownerReply}</p>
                  </div>
                )}

                {isEditing ? (
                  <form onSubmit={submitReply} className="mt-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] p-4">
                    <label htmlFor={`owner-reply-${review.reviewId}`} className="block text-xs font-bold text-slate-700 dark:text-slate-200">
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
                      className="mt-2 w-full resize-y rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141417] px-3 py-2.5 text-xs leading-5 text-slate-800 dark:text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 disabled:opacity-60"
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
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e] px-4 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252830] disabled:opacity-60"
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
                      onClick={() => {
                        setReportingReview(review);
                        setReportReason('Inappropriate or offensive language');
                        setReportDetails('');
                        setReportStatus(null);
                      }}
                      disabled={isDeleting}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e] px-4 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252830] disabled:opacity-60 cursor-pointer"
                    >
                      <Flag className="h-4 w-4 text-amber-500" aria-hidden="true" />
                      Report
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeReview(review)}
                      disabled={isDeleting}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-500/20 bg-white dark:bg-[#1c1c1e] px-4 text-xs font-bold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                      Delete review
                    </button>
                    <button
                      type="button"
                      onClick={() => beginReply(review)}
                      disabled={isDeleting}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-blue-200 dark:border-blue-500/20 bg-white dark:bg-[#1c1c1e] px-4 text-xs font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
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

      {reportingReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#18181C] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/10">
              <h3 className="text-base font-semibold text-[#111] dark:text-white flex items-center gap-2">
                <Flag size={16} className="text-rose-600" /> Report Review
              </h3>
              <button
                type="button"
                onClick={() => { setReportingReview(null); setReportStatus(null); }}
                className="text-[#8e8e93] hover:text-[#111] dark:hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#5f6368] dark:text-[#A1A1AA] mb-1.5">
                  Reason for report
                </label>
                <SystemSelect
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121214] text-[#111] dark:text-white outline-none focus:border-blue-500"
                >
                  <option value="Inappropriate or offensive language">Inappropriate or offensive language</option>
                  <option value="Spam or irrelevant content">Spam or irrelevant content</option>
                  <option value="Harassment or threats">Harassment or threats</option>
                  <option value="Fraudulent or misleading review">Fraudulent or misleading review</option>
                  <option value="Other">Other</option>
                </SystemSelect>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5f6368] dark:text-[#A1A1AA] mb-1.5">
                  Additional details (optional)
                </label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  rows={3}
                  placeholder="Explain why this review violates community standards..."
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121214] p-2.5 text-xs text-[#111] dark:text-white outline-none resize-none focus:border-blue-500"
                />
              </div>

              {reportStatus && (
                <p
                  className={`rounded-xl px-3 py-2 text-xs font-medium ${
                    reportStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                  }`}
                >
                  {reportStatus.message}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isReporting}
                  onClick={() => { setReportingReview(null); setReportStatus(null); }}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-[#5f6368] dark:text-[#A1A1AA] hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isReporting}
                  onClick={async () => {
                    if (!reportingReview || !token || isReporting) return;
                    setIsReporting(true);
                    setReportStatus(null);
                    try {
                      const res = await reportReview(token, reportingReview.reviewId, {
                        reason: reportReason,
                        details: reportDetails.trim() || undefined,
                      });
                      setReportStatus({ type: 'success', message: res.message || 'Report submitted for moderation.' });
                      setTimeout(() => {
                        setReportingReview(null);
                        setReportStatus(null);
                        setReportDetails('');
                      }, 1500);
                    } catch (err) {
                      setReportStatus({
                        type: 'error',
                        message: err instanceof Error ? err.message : 'Unable to submit report.',
                      });
                    } finally {
                      setIsReporting(false);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                >
                  {isReporting && <Loader2 size={13} className="animate-spin" />}
                  {isReporting ? 'Submitting…' : 'Submit Report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
