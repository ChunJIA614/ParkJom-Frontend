import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Check, CheckCircle2, Loader2, MapPin, ShieldCheck, Star, X } from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { useAuth } from '@/features/auth/context/AuthContext';
import type { Booking } from '../types';
import { createReview } from '../api/reviewApi';
import { saveParkingReview } from '../lib/parkingReviews';

const ratingCopy = [
  'Select a rating',
  'Very disappointing',
  'Could be better',
  'Good overall',
  'Great parking',
  'Excellent experience',
];

const highlights = [
  'Easy to find',
  'Close to transit',
  'Felt secure',
  'Clean space',
  'Easy access',
];

export interface ParkingReviewProps {
  spot?: any;
  bookingId?: number | null;
  bookingReference?: string | null;
  vehiclePlate?: string;
  bookedAt?: any;
  totalPaid?: number;
  token?: string;
  onBack?: () => void;
  onSubmitReview?: () => void;
}

export default function ParkingReview({ onBack, onSubmitReview }: ParkingReviewProps = {}) {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { booking?: Booking } };
  const { user, logout } = useAuth();
  const booking = location.state?.booking;

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedHighlights, setSelectedHighlights] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleHighlight = (highlight: string) => {
    setSelectedHighlights((current) =>
      current.includes(highlight)
        ? current.filter((item) => item !== highlight)
        : [...current, highlight]
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 3 - photos.length;
    if (remainingSlots <= 0) {
      setError('You can upload a maximum of 3 photos.');
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    for (const file of selectedFiles) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Each photo must be under 5MB.');
        continue;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setPhotos((prev) => (prev.length < 3 ? [...prev, result] : prev));
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const submitReview = async () => {
    if (!booking || !user?.userId || !user.token || isSubmitting) return;
    if (!rating) return setError('Choose a star rating before submitting.');

    const parsedBookingId = Number(booking.id);
    const bookingId =
      booking.bookingId ??
      (Number.isInteger(parsedBookingId) && parsedBookingId > 0 ? parsedBookingId : null);
    if (!bookingId) {
      return setError('This booking is missing its server booking ID and cannot be reviewed yet.');
    }

    const detail = [
      comment.trim(),
      selectedHighlights.length ? `Highlights: ${selectedHighlights.join(', ')}.` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    setIsSubmitting(true);
    setError('');
    try {
      const result = await createReview(user.token, {
        bookingId,
        rating,
        ...(detail ? { comment: detail } : {}),
        photos: photos.length > 0 ? photos : undefined,
      });
      saveParkingReview({
        reviewId: result.data.reviewId,
        bookingId: String(bookingId),
        parkingSpotId: result.data.parkingSpotId,
        reviewerId: user.userId,
        reviewerName:
          result.data.reviewerDisplayName ||
          `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
          'ParkJom commuter',
        rating: result.data.rating,
        comment: result.data.comment,
        photos: result.data.photos || photos,
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
      <div className="page-shell min-h-screen text-[#1d1d1f] dark:text-white flex flex-col">
        <DashboardHeader
          role="commuter"
          user={user}
          onSignOut={() => {
            logout();
            navigate('/');
          }}
          onBrandClick={() => navigate('/commuter')}
        />
        <main className="flex-1 flex flex-col justify-center items-center px-4 py-12 text-center">
          <div className="w-full max-w-md rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#161618] p-8 shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#007AFF]/10 text-[#007AFF]">
              <ShieldCheck size={26} strokeWidth={2} />
            </div>
            <h1 className="mt-4 text-xl font-bold text-[#111] dark:text-white">Complete a booking first</h1>
            <p className="mt-2 text-xs text-[#86868b] leading-relaxed">
              Reviews are verified and linked to completed stays so commuters can trust what they read.
            </p>
            <button
              onClick={() => navigate('/commuter')}
              className="mt-6 w-full h-11 rounded-xl bg-[#007AFF] hover:bg-[#0071E3] active:scale-[0.98] text-xs font-semibold text-white transition cursor-pointer"
            >
              Back to Parking
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="page-shell min-h-screen text-[#1d1d1f] dark:text-white flex flex-col">
        <DashboardHeader
          role="commuter"
          user={user}
          onSignOut={() => {
            logout();
            navigate('/');
          }}
          onBrandClick={() => navigate('/commuter')}
        />
        <main className="flex-1 flex flex-col justify-center items-center px-4 py-12">
          <section className="w-full max-w-md rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#161618] p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.5)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#34C759]/10 text-[#34C759]">
              <CheckCircle2 size={30} strokeWidth={2.2} />
            </div>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#34C759]">Review Published</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#111] dark:text-white">Thanks for helping commuters</h1>
            <p className="mx-auto mt-2 max-w-xs text-xs text-[#86868b] leading-relaxed">
              Your review is live and helps other commuters find parking.
            </p>
            <div className="mt-5 flex justify-center gap-1.5 text-[#ff9500]">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={22} strokeWidth={1.5} fill={i < rating ? 'currentColor' : 'none'} />
              ))}
            </div>
            <button
              onClick={() => navigate('/commuter', { state: { activeTab: 'home' } })}
              className="mt-7 w-full h-11 rounded-xl bg-[#007AFF] hover:bg-[#0071E3] active:scale-[0.98] text-xs font-semibold text-white transition-all cursor-pointer shadow-sm"
            >
              Back to Commuter Dashboard
            </button>
          </section>
        </main>
      </div>
    );
  }

  const activeRating = hoveredRating || rating;

  return (
    <div className="page-shell min-h-screen text-[#1d1d1f] dark:text-white flex flex-col">
      <DashboardHeader
        role="commuter"
        user={user}
        onSignOut={() => {
          logout();
          navigate('/');
        }}
        onBrandClick={() => navigate('/commuter')}
      />

      <main className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-5xl w-full mx-auto">
        {/* Top Navigation Row: Skip For Now & Verified Badge */}
        <div className="mb-2 sm:mb-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/commuter')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#86868b] hover:text-[#111] dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} />
            <span>Skip for now</span>
          </button>

          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#86868b]">
            <ShieldCheck size={13} className="text-[#007AFF]" />
            <span>Verified Stay</span>
          </div>
        </div>

        {/* ── Wide Horizontal 2-Column Card Across the Page ── */}
        <section className="rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#161618] shadow-[0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-black/[0.06] dark:divide-white/[0.08] w-full">
            
            {/* ── LEFT COLUMN: Spot Context & Ratings (50% Width) ── */}
            <div className="w-full p-6 sm:p-7 lg:p-8 flex flex-col justify-between space-y-5">
              {/* Header & Spot Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Check size={13} strokeWidth={2.5} />
                  <span>Parking Completed</span>
                </div>

                <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-[#111] dark:text-white leading-tight">
                  How was your parking?
                </h1>

                {/* Parking Spot Details Card */}
                <div className="flex items-start gap-3 rounded-2xl bg-[#f8f9fa] dark:bg-[#1c1c1e] p-3.5 border border-black/[0.04] dark:border-white/[0.06]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF] dark:text-[#3894FF]">
                    <MapPin size={18} strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#111] dark:text-white truncate">
                      {booking.spot.name}
                    </p>
                    <p className="text-[11px] text-[#86868b] truncate mt-0.5">
                      {booking.spot.address} · {booking.spot.station}
                    </p>
                  </div>
                </div>
              </div>

              {/* Overall Star Rating */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block">
                  Your overall rating
                </span>
                <div
                  className="flex items-center gap-2.5 pt-0.5"
                  onMouseLeave={() => setHoveredRating(0)}
                >
                  {Array.from({ length: 5 }, (_, index) => {
                    const value = index + 1;
                    const isLit = value <= activeRating;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-label={`${value} star${value > 1 ? 's' : ''}`}
                        onMouseEnter={() => setHoveredRating(value)}
                        onFocus={() => setHoveredRating(value)}
                        onBlur={() => setHoveredRating(0)}
                        onClick={() => {
                          setRating(value);
                          setError('');
                        }}
                        className={`rounded-xl p-1 transition-all duration-150 hover:scale-115 active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#007AFF] ${
                          isLit ? 'text-[#ff9500]' : 'text-[#d2d2d7] dark:text-[#3a3a3c]'
                        }`}
                      >
                        <Star
                          size={32}
                          strokeWidth={1.5}
                          fill={isLit ? 'currentColor' : 'none'}
                        />
                      </button>
                    );
                  })}
                </div>
                <p
                  className={`text-xs font-semibold min-h-4 transition-colors ${
                    activeRating ? 'text-[#ff9500]' : 'text-[#86868b]'
                  }`}
                >
                  {ratingCopy[activeRating]}
                </p>
              </div>

              {/* What Stood Out? (Highlights) */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block">
                  What stood out?
                </span>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {highlights.map((highlight) => {
                    const isSelected = selectedHighlights.includes(highlight);
                    return (
                      <button
                        key={highlight}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleHighlight(highlight)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#007AFF]/15 text-[#007AFF] dark:text-[#3894FF] border border-[#007AFF]/35 shadow-sm'
                            : 'bg-[#f5f5f7] dark:bg-[#1c1c1e] text-[#6e6e73] dark:text-[#a1a1aa] border border-black/[0.04] dark:border-white/[0.06] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={2.5} />}
                        <span>{highlight}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN: Feedback Text, Photos & Publish (50% Width) ── */}
            <div className="w-full p-6 sm:p-7 lg:p-8 flex flex-col justify-between space-y-5">
              {/* Written Feedback Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="review-comment"
                    className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider"
                  >
                    Share helpful details
                  </label>
                  <span className="text-[11px] text-[#86868b] font-mono">
                    {comment.length}/500
                  </span>
                </div>
                <textarea
                  id="review-comment"
                  value={comment}
                  maxLength={500}
                  rows={3}
                  onChange={(e) => {
                    setComment(e.target.value);
                    setError('');
                  }}
                  placeholder="Mention bay access, parking convenience, security, or walk to transit…"
                  className="w-full resize-none rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-[#f8f9fa] dark:bg-[#1c1c1e] p-3.5 text-xs sm:text-[13px] text-[#111] dark:text-white leading-relaxed outline-none transition placeholder:text-[#8e8e93] focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
                />
              </div>

              {/* Photo Upload Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                    Bay Condition & Clearance Photos
                  </label>
                  <span className="text-[11px] text-[#86868b] font-mono">
                    {photos.length}/3 photos
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {photos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="relative h-16 w-16 sm:h-18 sm:w-18 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 group shadow-sm shrink-0"
                    >
                      <img src={photo} alt={`Bay photo ${idx + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-opacity cursor-pointer"
                        aria-label="Remove photo"
                      >
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}

                  {photos.length < 3 && (
                    <label className="flex h-16 w-16 sm:h-18 sm:w-18 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-black/15 dark:border-white/20 bg-[#f8f9fa] dark:bg-[#1c1c1e] text-[#8e8e93] hover:border-[#007AFF] hover:text-[#007AFF] transition-colors shrink-0">
                      <Camera size={18} strokeWidth={1.8} />
                      <span className="mt-1 text-[10px] font-medium">Add Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}

                  <p className="text-[11px] text-[#86868b] leading-tight ml-1">
                    Clearance height signage, bay surface, or entrance pillar (max 5MB each).
                  </p>
                </div>
              </div>

              {/* Error & Publish Button */}
              <div className="space-y-2 pt-1">
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl bg-red-500/10 border border-red-500/20 px-3.5 py-2 text-xs font-medium text-[#ff453a]"
                  >
                    {error}
                  </p>
                )}

                <button
                  onClick={() => void submitReview()}
                  disabled={isSubmitting}
                  className="flex w-full h-11 sm:h-12 items-center justify-center gap-2 rounded-xl bg-[#007AFF] hover:bg-[#0071E3] active:scale-[0.99] px-5 text-sm font-semibold text-white transition cursor-pointer disabled:cursor-wait disabled:opacity-60 shadow-sm"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  <span>{isSubmitting ? 'Publishing…' : 'Publish Review'}</span>
                </button>

                <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#86868b] pt-0.5">
                  <ShieldCheck size={12} className="text-[#34C759]" />
                  <span>Verified booking · Your vehicle registration and payment details remain private</span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
