import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Navigation, ShieldCheck,
  Car, Wifi, CreditCard,
  Loader2, Calendar, AlertTriangle,
  Heart,
  ChevronLeft, ChevronRight, MessageSquare, Pencil, Star, Trash2,
} from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { useAuth } from '@/features/auth/context/AuthContext';
import type { Booking, ParkingSpot } from '../types';
import { saveJourneySession } from '../lib/journeySession';
import { getWalkingRoute } from '@/services/walkingRoutes';
import {
  confirmBooking,
  createBookingQuote,
  getBookingAvailability,
  type BookingAvailabilityResponse,
  type BookingQuote,
  type ConfirmedBooking,
} from '../api/bookingApi';
import { getFavoriteParking, updateFavoriteParking } from '../api/favoriteApi';
import { deleteReview, getParkingReviews, updateReview } from '../api/reviewApi';
import { getMyVehicles, type VehicleApiData } from '../api/vehicleApi';
import { isParkingFavorite, setParkingFavorite } from '../lib/favoriteParking';
import {
  deleteParkingReview,
  loadCachedParkingReviews,
  saveParkingReview,
  type ParkingReview,
} from '../lib/parkingReviews';

/* ================================================================
   ParkingDetail — Parking spot detail page
   Design: Apple/Google style — clean whitespace, single blue accent, no gradients
   ================================================================ */

// ── Types ──
interface MockParkingSpot extends ParkingSpot {
  lon: number;
  photoUrl: string;
  price: number;
}
interface WalkingInfo {
  distanceText: string;
  durationText: string;
  rawDistance: number;
}

const REVIEW_PAGE_SIZE = 10;

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);

const toMonthInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const dateFromKey = (dateKey: string) => new Date(`${dateKey}T00:00:00`);

const formatDateKey = (dateKey: string) => dateFromKey(dateKey).toLocaleDateString('en-MY', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const getCalendarDateKeys = (month: Date) => {
  const firstDay = startOfMonth(month);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  return Array.from({ length: firstWeekday + daysInMonth }, (_, index) => {
    if (index < firstWeekday) return null;
    const day = index - firstWeekday + 1;
    return toDateInput(new Date(month.getFullYear(), month.getMonth(), day));
  });
};

export default function ParkingDetail() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { state } = useLocation() as {
    state?: { spot: MockParkingSpot; stationCoords: { lat: number; lon: number } | null; stationName: string };
  };

  const spot = state?.spot;
  const stationCoords = state?.stationCoords;
  const stationName = state?.stationName;

  const [walkingInfo, setWalkingInfo] = useState<WalkingInfo | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // ── Booking ──
  const today = new Date();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(addDays(new Date(), 1)));
  const [availabilityByMonth, setAvailabilityByMonth] = useState<Record<string, BookingAvailabilityResponse>>({});
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [dateSelectionError, setDateSelectionError] = useState<string | null>(null);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null);
  const [vehicles, setVehicles] = useState<VehicleApiData[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(false);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [reservationReady, setReservationReady] = useState(false);
  const [isFavorite, setIsFavorite] = useState(() => Boolean(spot && user?.userId && isParkingFavorite(user.userId, spot.parkingSpotId)));
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
  const [isFavoriteUpdating, setIsFavoriteUpdating] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const [reviews, setReviews] = useState(() => spot ? loadCachedParkingReviews(spot.parkingSpotId) : []);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
  const [reviewMeta, setReviewMeta] = useState<{ totalCount: number; averageRating: number; totalPages: number } | null>(null);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);
  const [reviewsLoadError, setReviewsLoadError] = useState<string | null>(null);
  const [reviewEditDraft, setReviewEditDraft] = useState<{ reviewId: number; rating: number; comment: string } | null>(null);
  const [isReviewUpdating, setIsReviewUpdating] = useState(false);
  const [reviewUpdateError, setReviewUpdateError] = useState<string | null>(null);
  const [reviewDeletingId, setReviewDeletingId] = useState<number | null>(null);
  const [reviewDeleteError, setReviewDeleteError] = useState<string | null>(null);
  const averageRating = reviewMeta?.averageRating ?? (reviews.length
    ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
    : 0);

  useEffect(() => {
    if (!spot || !stationCoords) return;
    setIsLoadingRoute(true);
    getWalkingRoute(spot.lat, spot.lon, stationCoords.lat, stationCoords.lon)
      .then(setWalkingInfo).finally(() => setIsLoadingRoute(false));
  }, [spot, stationCoords]);

  useEffect(() => {
    if (!user?.token) return;
    const controller = new AbortController();
    setIsVehiclesLoading(true);
    getMyVehicles(user.token, controller.signal)
      .then((result) => {
        setVehicles(result.data);
        setSelectedVehicleId((current) => current ?? result.data[0]?.vehicleId ?? null);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setBookingError(error instanceof Error ? error.message : 'Unable to load your vehicles.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsVehiclesLoading(false);
      });
    return () => controller.abort();
  }, [user?.token]);

  useEffect(() => {
    if (!spot) return;

    const month = toMonthInput(calendarMonth);
    if (availabilityByMonth[month]) return;

    const controller = new AbortController();
    setIsAvailabilityLoading(true);
    setAvailabilityError(null);
    void getBookingAvailability(spot.parkingSpotId, month, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setAvailabilityByMonth((current) => ({ ...current, [result.month || month]: result }));
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setAvailabilityError(error instanceof Error ? error.message : 'Unable to load booking availability.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsAvailabilityLoading(false);
      });

    return () => controller.abort();
  }, [availabilityByMonth, calendarMonth, spot]);

  useEffect(() => {
    setAvailabilityByMonth({});
    setAvailabilityError(null);
    setDateSelectionError(null);
    setStartDate('');
    setEndDate('');
    setQuote(null);
    setBookingError(null);
    setCalendarMonth(startOfMonth(addDays(new Date(), 1)));
  }, [spot?.parkingSpotId]);

  useEffect(() => {
    setIsFavorite(Boolean(spot && user?.userId && isParkingFavorite(user.userId, spot.parkingSpotId)));
    setFavoriteError(null);
    if (!spot || !user?.userId || !user.token) {
      setIsFavoriteLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsFavoriteLoading(true);
    void getFavoriteParking(user.token, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const isServerFavorite = result.data.some((favorite) => favorite.parkingSpotId === spot.parkingSpotId);
        setParkingFavorite(user.userId, spot, isServerFavorite);
        setIsFavorite(isServerFavorite);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setFavoriteError(error instanceof Error ? error.message : 'Unable to load this favorite status.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsFavoriteLoading(false);
      });

    return () => controller.abort();
  }, [spot, user?.token, user?.userId]);

  const handleToggleFavorite = async () => {
    if (!spot || !user?.userId || !user.token || isFavoriteLoading || isFavoriteUpdating) return;

    setIsFavoriteUpdating(true);
    setFavoriteError(null);
    try {
      const result = await updateFavoriteParking(user.token, spot.parkingSpotId);
      setParkingFavorite(user.userId, spot, result.data.isFavorite);
      setIsFavorite(result.data.isFavorite);
    } catch (error) {
      setFavoriteError(error instanceof Error ? error.message : 'Unable to update this favorite parking spot.');
    } finally {
      setIsFavoriteUpdating(false);
    }
  };

  useEffect(() => {
    setReviewPage(1);
  }, [spot?.parkingSpotId]);

  useEffect(() => {
    if (!spot) return;

    const controller = new AbortController();
    const cachedReviews = loadCachedParkingReviews(spot.parkingSpotId);
    if (reviewPage === 1 && reviews.length === 0) setReviews(cachedReviews);
    if (reviewPage > 1) setReviews([]);
    setReviewEditDraft(null);
    setReviewUpdateError(null);
    setReviewDeleteError(null);
    setReviewsLoadError(null);
    setIsReviewsLoading(true);

    void getParkingReviews(spot.parkingSpotId, reviewPage, REVIEW_PAGE_SIZE, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const currentCache = loadCachedParkingReviews(spot.parkingSpotId);
        setReviews(result.data.map((review) => {
          const cachedReview = currentCache.find((item) => item.reviewId === review.reviewId);
          return {
            reviewId: review.reviewId,
            bookingId: cachedReview?.bookingId ?? '',
            parkingSpotId: review.parkingSpotId,
            reviewerId: cachedReview?.reviewerId ?? 0,
            reviewerName: review.reviewerDisplayName || cachedReview?.reviewerName || 'ParkJom commuter',
            rating: review.rating,
            comment: review.comment,
            ownerReply: review.ownerReply,
            ownerReplyAt: review.ownerReplyAt,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
            parkingName: spot.name,
            stationName: spot.station,
          };
        }));
        setReviewMeta({
          totalCount: result.totalCount,
          averageRating: result.averageRating,
          totalPages: result.totalPages,
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setReviewsLoadError(error instanceof Error ? error.message : 'Unable to load parking reviews.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsReviewsLoading(false);
      });

    return () => controller.abort();
  }, [reviewPage, reviewRefreshKey, spot]);

  const startReviewEdit = (review: ParkingReview) => {
    setReviewEditDraft({
      reviewId: review.reviewId,
      rating: review.rating,
      comment: review.comment,
    });
    setReviewUpdateError(null);
  };

  const handleUpdateReview = async () => {
    if (!reviewEditDraft || !user?.token || isReviewUpdating) return;
    if (reviewEditDraft.rating < 1 || reviewEditDraft.rating > 5) {
      setReviewUpdateError('Choose a rating from 1 to 5.');
      return;
    }

    const existingReview = reviews.find((review) => review.reviewId === reviewEditDraft.reviewId);
    if (!existingReview) {
      setReviewUpdateError('This review is no longer available to edit.');
      return;
    }

    setIsReviewUpdating(true);
    setReviewUpdateError(null);
    try {
      const result = await updateReview(user.token, reviewEditDraft.reviewId, {
        rating: reviewEditDraft.rating,
        comment: reviewEditDraft.comment.trim(),
      });
      const updatedReview: ParkingReview = {
        ...existingReview,
        parkingSpotId: result.data.parkingSpotId,
        reviewerName: result.data.reviewerDisplayName || existingReview.reviewerName,
        rating: result.data.rating,
        comment: result.data.comment,
        ownerReply: result.data.ownerReply,
        ownerReplyAt: result.data.ownerReplyAt,
        createdAt: result.data.createdAt || existingReview.createdAt,
        updatedAt: result.data.updatedAt || existingReview.updatedAt,
      };
      saveParkingReview(updatedReview);
      setReviews((current) => current.map((review) => review.reviewId === updatedReview.reviewId ? updatedReview : review));
      setReviewEditDraft(null);
      setReviewRefreshKey((current) => current + 1);
    } catch (error) {
      setReviewUpdateError(error instanceof Error ? error.message : 'Unable to update this review.');
    } finally {
      setIsReviewUpdating(false);
    }
  };

  const handleDeleteReview = async (review: ParkingReview) => {
    if (!user?.token || review.reviewerId !== user.userId || reviewDeletingId !== null) return;
    if (!window.confirm('Delete your review permanently? This cannot be undone.')) return;

    setReviewDeletingId(review.reviewId);
    setReviewDeleteError(null);
    try {
      await deleteReview(user.token, review.reviewId);
      deleteParkingReview(review.reviewId, { requesterId: user.userId });
      setReviews((current) => current.filter((item) => item.reviewId !== review.reviewId));

      if (reviewPage > 1 && reviews.length === 1) {
        setReviewPage((current) => Math.max(1, current - 1));
      } else {
        setReviewRefreshKey((current) => current + 1);
      }
    } catch (error) {
      setReviewDeleteError(error instanceof Error ? error.message : 'Unable to delete this review.');
    } finally {
      setReviewDeletingId(null);
    }
  };

  if (!spot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="text-center space-y-4">
          <MapPin size={40} className="mx-auto text-[#dadce0]" />
          <p className="text-[#5f6368] font-medium text-[15px]">No parking spot selected.</p>
          <button onClick={() => navigate('/commuter')} className="text-[13px] text-[#007AFF] font-semibold hover:underline">
            &larr; Back to Transit Map
          </button>
        </div>
      </div>
    );
  }

  const availabilityRecords = Object.values(availabilityByMonth);
  const minimumBookingDate = availabilityRecords
    .map((availability) => availability.minimumBookingDate)
    .filter(Boolean)
    .sort()[0] ?? toDateInput(addDays(today, 1));
  const calendarMonthKey = toMonthInput(calendarMonth);
  const currentMonthAvailability = availabilityByMonth[calendarMonthKey];
  const calendarDateKeys = getCalendarDateKeys(calendarMonth);
  const minimumCalendarMonth = startOfMonth(dateFromKey(minimumBookingDate));
  const selectedStartAvailability = startDate ? getAvailabilityForDate(startDate) : undefined;

  function getAvailabilityForDate(dateKey: string) {
    const monthAvailability = availabilityByMonth[dateKey.slice(0, 7)];
    return monthAvailability?.availableDates.find((availableDate) => availableDate.date === dateKey);
  }

  const isDateAvailable = (dateKey: string) => dateKey >= minimumBookingDate && Boolean(getAvailabilityForDate(dateKey));

  const isRangeAvailable = (fromDate: string, toDate: string) => {
    if (!fromDate || !toDate || toDate <= fromDate) return false;

    let cursor = dateFromKey(fromDate);
    const lastDate = dateFromKey(toDate);
    while (cursor <= lastDate) {
      if (!isDateAvailable(toDateInput(cursor))) return false;
      cursor = addDays(cursor, 1);
    }
    return true;
  };

  const invalidDates = !startDate
    || !endDate
    || endDate <= startDate
    || startDate < minimumBookingDate
    || !isRangeAvailable(startDate, endDate);
  const displayedRate = quote?.ratePerDay ?? spot.dailyRate ?? 0;
  const displayedTotal = quote?.rentalSubtotal ?? 0;

  const dateValidationError = startDate && endDate
    ? endDate <= startDate
      ? 'Choose an end date after the start date.'
      : startDate < minimumBookingDate
        ? `Bookings open from ${formatDateKey(minimumBookingDate)}.`
        : !isRangeAvailable(startDate, endDate)
          ? 'Choose a continuous range where every day is available.'
          : null
    : null;

  const handleDateSelection = (dateKey: string) => {
    if (!isDateAvailable(dateKey)) return;

    setQuote(null);
    setBookingError(null);
    setDateSelectionError(null);
    idempotencyKeyRef.current = null;
    if (!startDate || endDate || dateKey <= startDate) {
      setStartDate(dateKey);
      setEndDate('');
      return;
    }

    if (!isRangeAvailable(startDate, dateKey)) {
      setDateSelectionError('Choose a continuous range where every day is available.');
      return;
    }

    setEndDate(dateKey);
  };

  const handleBook = async () => {
    if (!user?.token || invalidDates || isBookingLoading) return;
    setBookingError(null);
    setIsBookingLoading(true);

    try {
      if (!quote) {
        const result = await createBookingQuote(user.token, spot.parkingSpotId, { startDate, endDate });
        setQuote(result.data);
        return;
      }

      if (!selectedVehicleId) throw new Error('Select a vehicle before confirming this booking.');
      idempotencyKeyRef.current ??= crypto.randomUUID();
      const confirmation = await confirmBooking(
        user.token,
        quote.quoteId,
        selectedVehicleId,
        idempotencyKeyRef.current,
      );
      setConfirmedBooking(confirmation.data);

      const parkingSpot: ParkingSpot = {
        ...spot,
        station: stationName || 'Klang Valley transit area',
        name: spot.address,
        pricePerHour: quote.ratePerDay,
        distance: walkingInfo?.rawDistance ? Math.round(walkingInfo.rawDistance) : 0,
        lat: spot.lat,
        lng: spot.lon,
        available: false,
        type: 'Condo Bay',
        owner: 'Private bay owner',
      };
      const vehicle = vehicles.find((item) => item.vehicleId === selectedVehicleId);
      const booking: Booking = {
        id: confirmation.data.bookingReference,
        bookingId: confirmation.data.bookingId,
        spot: parkingSpot,
        startTime: new Date(`${quote.startDate}T00:00:00`),
        endTime: new Date(`${quote.endDate}T00:00:00`),
        vehiclePlate: vehicle?.numberPlate ?? '',
        status: 'Upcoming',
        totalPaid: quote.rentalSubtotal,
      };

      saveJourneySession(booking);
      setReservationReady(true);
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Unable to complete this booking.');
    } finally {
      setIsBookingLoading(false);
    }
  };

  if (reservationReady) {
    return (
      <div className="page-shell text-[#1d1d1f]">
        <DashboardHeader
          role="commuter"
          user={user}
          onSignOut={() => { logout(); navigate('/'); }}
          onBrandClick={() => navigate('/commuter', { replace: true, state: { activeTab: 'home' } })}
        />
        <main className="max-w-xl mx-auto px-4 py-10 md:py-16">
          <div className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden">
            <div className="bg-[#1c1c1e] text-white p-6 md:p-8">
              <div className="w-11 h-11 rounded-xl bg-[#34c759] flex items-center justify-center mb-6">
                <ShieldCheck size={23} />
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-[-0.03em]">Parking Pass ready</h1>
              <p className="text-[#c7c7cc] text-[13px] mt-2 leading-relaxed">Your selected bay and booking time are collected in one pass for arrival and access.</p>
            </div>
            <div className="p-6 md:p-8 space-y-5">
              <div>
                <p className="text-[11px] text-[#6e6e73]">Bay</p>
                <p className="font-semibold mt-1">{spot.address}</p>
                <p className="text-[12px] text-[#6e6e73] mt-1">{stationName || 'Klang Valley transit area'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 py-4 border-y border-black/[0.08]">
                <div><p className="text-[11px] text-[#6e6e73]">Booking dates</p><p className="text-[13px] font-semibold mt-1">{quote?.startDate} to {quote?.endDate}</p></div>
                <div><p className="text-[11px] text-[#6e6e73]">Duration</p><p className="text-[13px] font-semibold mt-1">{quote?.bookedDays} day{quote?.bookedDays === 1 ? '' : 's'}</p></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#6e6e73]">Paid total</span>
                <strong>RM {quote?.rentalSubtotal.toFixed(2)}</strong>
              </div>
              <p className="text-[11px] text-[#6e6e73] leading-relaxed">Booking reference: {confirmedBooking?.bookingReference}</p>
              <button type="button" onClick={() => navigate('/commuter', { state: { activeTab: 'active' } })} className="w-full min-h-11 rounded-xl bg-[#007AFF] text-white text-[13px] font-semibold">Continue to my parking pass</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell text-[#1d1d1f] pb-24">
      <DashboardHeader
        role="commuter"
        user={user}
        onSignOut={() => { logout(); navigate('/'); }}
        onBrandClick={() => navigate('/commuter', { replace: true, state: { activeTab: 'home' } })}
      />

      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 md:pt-10">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6e6e73] hover:text-[#1d1d1f]">
          <ArrowLeft size={17} /> Back to map
        </button>
      </div>

      {/* ── Content card ── */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 mt-5 relative z-10">
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 md:p-8 space-y-6">

          {/* Title */}
          <div className="flex items-start justify-between gap-4">
            <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#111] tracking-[-0.01em] leading-tight">{spot.address}</h1>
            <div className="flex items-center gap-1.5 mt-2 text-[13px] text-[#5f6368]">
              <MapPin size={14} className="text-[#007AFF] shrink-0" />
              <span>{stationName ? `${stationName} area` : 'Klang Valley'}</span>
            </div>
            </div>
            <button type="button" onClick={() => void handleToggleFavorite()} disabled={isFavoriteLoading || isFavoriteUpdating}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={isFavorite}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-wait disabled:opacity-70 ${isFavorite ? 'border-rose-200 bg-rose-50 text-rose-500' : 'border-[#dadce0] text-[#5f6368] hover:text-rose-500'}`}>
              {isFavoriteLoading || isFavoriteUpdating ? <Loader2 size={18} className="animate-spin text-[#007AFF]" /> : <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />}
            </button>
          </div>

          {favoriteError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{favoriteError}</span>
            </div>
          )}

          {/* Walking distance */}
          {isLoadingRoute ? (
            <div className="bg-[#f8f9fa] border border-[#e8eaed] rounded-xl p-4 flex items-center gap-3 text-[13px] text-[#5f6368]">
              <Loader2 size={16} className="animate-spin text-[#007AFF] shrink-0" />
              Calculating walking distance via OSRM...
            </div>
          ) : walkingInfo ? (
            <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#dcfce7] flex items-center justify-center shrink-0">
                <Navigation size={20} className="text-[#16a34a]" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-[#15803d]">{walkingInfo.distanceText} &middot; {walkingInfo.durationText}</p>
                <p className="text-[12px] text-[#16a34a]">Walking distance to {stationName || 'station'}</p>
              </div>
              <span className="text-[10px] font-semibold bg-[#bbf7d0] text-[#15803d] px-2 py-0.5 rounded-full">OSRM Verified</span>
            </div>
          ) : (
            <div className="bg-[#fefce8] border border-[#fde68a] rounded-xl p-4 flex items-center gap-3 text-[13px] text-[#a16207]">
              <MapPin size={16} className="shrink-0" />
              Select a station on the map to calculate walking distance.
            </div>
          )}

          <div className="h-px bg-[#e8eaed]" />

          {/* Amenities */}
          <div>
            <h3 className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">Parking Space Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { icon: Car, label: 'Private parking bay' },
                { icon: Wifi, label: 'Smart bollard access' },
                { icon: Navigation, label: 'Transit-adjacent' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-[13px] text-[#5f6368] bg-[#f8f9fa] rounded-xl p-3">
                  <Icon size={15} className="text-[#007AFF] shrink-0" /> {label}
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-[#e8eaed]" />

          {/* Booking dates */}
          <div>
            <h3 className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Calendar size={14} className="text-[#007AFF]" /> Select Booking Dates
            </h3>

            <div className="rounded-2xl border border-[#e8eaed] bg-[#fbfcfe] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-[#111]">{calendarMonth.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}</p>
                  <p className="mt-0.5 text-[10px] text-[#8e8e93]">
                    {isAvailabilityLoading
                      ? 'Loading available days…'
                      : currentMonthAvailability
                        ? `${currentMonthAvailability.totalAvailableDates} available day${currentMonthAvailability.totalAvailableDates === 1 ? '' : 's'}`
                        : 'Choose a month to see available days'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Previous month" disabled={isAvailabilityLoading || calendarMonth <= minimumCalendarMonth} onClick={() => setCalendarMonth((current) => addMonths(current, -1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dadce0] bg-white text-[#5f6368] transition hover:border-[#007AFF] hover:text-[#007AFF] disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16} /></button>
                  <button type="button" aria-label="Next month" disabled={isAvailabilityLoading} onClick={() => setCalendarMonth((current) => addMonths(current, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dadce0] bg-white text-[#5f6368] transition hover:border-[#007AFF] hover:text-[#007AFF] disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={16} /></button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]" aria-hidden="true">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1">
                {calendarDateKeys.map((dateKey, index) => {
                  if (!dateKey) return <span key={`empty-${index}`} className="min-h-10" aria-hidden="true" />;

                  const isAvailable = isDateAvailable(dateKey);
                  const isStart = dateKey === startDate;
                  const isEnd = dateKey === endDate;
                  const isInRange = Boolean(startDate && endDate && dateKey > startDate && dateKey < endDate);
                  const isToday = dateKey === toDateInput(today);
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      disabled={!isAvailable || isAvailabilityLoading}
                      aria-label={`${formatDateKey(dateKey)}${isAvailable ? ', available' : ', unavailable'}`}
                      aria-pressed={isStart || isEnd}
                      onClick={() => handleDateSelection(dateKey)}
                      className={`relative flex min-h-10 items-center justify-center rounded-xl text-[12px] font-semibold transition ${
                        isStart || isEnd
                          ? 'bg-[#007AFF] text-white shadow-sm'
                          : isInRange
                            ? 'bg-[#e8f0fe] text-[#0066d6]'
                            : isAvailable
                              ? 'bg-white text-[#111] ring-1 ring-[#e8eaed] hover:bg-[#e8f0fe] hover:text-[#0066d6]'
                              : 'cursor-not-allowed bg-transparent text-[#c7c7cc]'
                      } ${isToday && !isStart && !isEnd ? 'ring-2 ring-[#007AFF]/30' : ''}`}
                    >
                      {dateFromKey(dateKey).getDate()}
                      {isAvailable && !isStart && !isEnd && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#34c759]" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-[#6e6e73]">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#34c759]" /> Available</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#007AFF]" /> Selected</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#c7c7cc]" /> Unavailable</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#f8f9fa] px-3 py-2.5">
                <p className="text-[10px] font-medium text-[#8e8e93]">Start date</p>
                <p className="mt-1 text-[12px] font-semibold text-[#111]">{startDate ? formatDateKey(startDate) : 'Choose a date'}</p>
              </div>
              <div className="rounded-xl bg-[#f8f9fa] px-3 py-2.5">
                <p className="text-[10px] font-medium text-[#8e8e93]">End date</p>
                <p className="mt-1 text-[12px] font-semibold text-[#111]">{endDate ? formatDateKey(endDate) : 'Choose a date'}</p>
              </div>
            </div>

            {isAvailabilityLoading && (
              <p role="status" className="mt-3 flex items-center gap-2 text-[11px] font-medium text-[#5f6368]"><Loader2 size={13} className="animate-spin text-[#007AFF]" /> Checking this month’s availability…</p>
            )}
            {availabilityError && (
              <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{availabilityError}</span>
              </div>
            )}
            {!isAvailabilityLoading && currentMonthAvailability && currentMonthAvailability.totalAvailableDates === 0 && (
              <p className="mt-3 rounded-xl bg-[#f8f9fa] p-3 text-[11px] text-[#6e6e73]">No bookable dates are published for this month. Use the arrows to check another month.</p>
            )}
            {startDate && !endDate && !dateSelectionError && (
              <p className="mt-3 text-[11px] font-medium text-[#007AFF]">Now choose an available end date.</p>
            )}
            {selectedStartAvailability?.timeRanges.length ? (
              <p className="mt-3 text-[11px] text-[#6e6e73]">Available hours on {formatDateKey(startDate)}: {selectedStartAvailability.timeRanges.map((range) => `${range.from}–${range.to}`).join(', ')}</p>
            ) : null}

            {(dateSelectionError || dateValidationError) && (
              <div className="mt-3 flex items-start gap-2 text-[12px] text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded-xl p-3">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{dateSelectionError || dateValidationError}</span>
              </div>
            )}

            <div className="mt-4 space-y-1">
              <label className="text-[11px] font-medium text-[#5f6368]">Vehicle</label>
              <select value={selectedVehicleId ?? ''} onChange={(event) => setSelectedVehicleId(Number(event.target.value) || null)}
                disabled={isVehiclesLoading || vehicles.length === 0}
                className="w-full px-3 py-2.5 rounded-xl text-[12px] border border-[#dadce0] bg-white focus:outline-none focus:border-[#007AFF]">
                {vehicles.length === 0 && <option value="">{isVehiclesLoading ? 'Loading vehicles…' : 'No vehicles available'}</option>}
                {vehicles.map((vehicle) => (
                  <option key={vehicle.vehicleId} value={vehicle.vehicleId}>{vehicle.numberPlate} · {vehicle.vehicleBrand} {vehicle.vehicleModel}</option>
                ))}
              </select>
            </div>

            {bookingError && (
              <div className="mt-3 flex items-start gap-2 text-[12px] text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded-xl p-3">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{bookingError}</span>
              </div>
            )}
          </div>

          <div className="h-px bg-[#e8eaed]" />

          {/* Reviews */}
          <section aria-labelledby="parking-reviews-title">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">Verified stays</p>
                <h2 id="parking-reviews-title" className="mt-1 text-[17px] font-bold text-[#111]">Commuter reviews</h2>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-[#ff9500]"><Star size={16} fill="currentColor" /><strong className="text-[15px] text-[#111]">{averageRating.toFixed(1)}</strong></div>
                <p className="mt-0.5 text-[10px] text-[#8e8e93]">{reviewMeta?.totalCount ?? reviews.length} verified reviews</p>
              </div>
            </div>

            {reviewsLoadError && (
              <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[11px] font-medium text-rose-700">{reviewsLoadError}</p>
            )}
            {reviewDeleteError && (
              <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[11px] font-medium text-rose-700">{reviewDeleteError}</p>
            )}

            <div className="mt-4 space-y-3">
              {isReviewsLoading && reviews.length === 0 && (
                <div className="rounded-2xl bg-[#f8f9fa] p-8 text-center" role="status"><Loader2 size={24} className="mx-auto animate-spin text-[#007AFF]" /><p className="mt-3 text-[12px] font-medium text-[#5f6368]">Loading reviews…</p></div>
              )}
              {!isReviewsLoading && reviews.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#d2d2d7] p-8 text-center"><Star size={25} className="mx-auto text-[#d2d2d7]" /><p className="mt-3 text-[12px] font-semibold text-[#5f6368]">No reviews yet</p><p className="mt-1 text-[11px] text-[#8e8e93]">Completed commuters can be the first to review this parking spot.</p></div>
              )}
              {reviews.map((review) => {
                const isEditing = reviewEditDraft?.reviewId === review.reviewId;
                const isOwnReview = review.reviewerId !== 0 && review.reviewerId === user?.userId;
                return (
                  <article key={review.reviewId} className="rounded-2xl bg-[#f8f9fa] p-4 ring-1 ring-black/[0.04]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f0fe] text-[11px] font-bold text-[#007AFF]">{review.reviewerName.charAt(0)}</span>
                        <div><p className="text-[12px] font-semibold text-[#111]">{review.reviewerName}</p><p className="text-[10px] text-[#8e8e93]">Verified booking · {new Date(review.createdAt).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' })}</p></div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="mr-1 flex gap-0.5 text-[#ff9500]" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={12} fill={index < review.rating ? 'currentColor' : 'none'} className={index < review.rating ? '' : 'text-[#d2d2d7]'} />)}</div>
                        {isOwnReview && !isEditing && (
                          <>
                            <button type="button" aria-label="Edit your review" title="Edit your review" onClick={() => startReviewEdit(review)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8e8e93] transition hover:bg-[#e8f0fe] hover:text-[#007AFF]"><Pencil size={14} /></button>
                            <button type="button" disabled={reviewDeletingId !== null} aria-label="Delete your review" title="Delete your review" onClick={() => void handleDeleteReview(review)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8e8e93] transition hover:bg-[#fff2f1] hover:text-[#d92d20] disabled:cursor-wait disabled:opacity-60">{reviewDeletingId === review.reviewId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}</button>
                          </>
                        )}
                      </div>
                    </div>

                    {isEditing && reviewEditDraft ? (
                      <div className="mt-4 space-y-3 rounded-xl bg-white p-3 ring-1 ring-black/[0.06]">
                        <fieldset>
                          <legend className="text-[11px] font-semibold text-[#5f6368]">Rating</legend>
                          <div className="mt-2 flex gap-1 text-[#ff9500]">
                            {Array.from({ length: 5 }, (_, index) => {
                              const value = index + 1;
                              return <button key={value} type="button" disabled={isReviewUpdating} aria-label={`Set rating to ${value} star${value === 1 ? '' : 's'}`} onClick={() => { setReviewEditDraft({ ...reviewEditDraft, rating: value }); setReviewUpdateError(null); }} className="rounded-md p-1 transition hover:bg-amber-50 disabled:cursor-wait"><Star size={21} fill={value <= reviewEditDraft.rating ? 'currentColor' : 'none'} className={value <= reviewEditDraft.rating ? '' : 'text-[#d2d2d7]'} /></button>;
                            })}
                          </div>
                        </fieldset>
                        <div>
                          <div className="flex items-center justify-between"><label htmlFor={`review-edit-${review.reviewId}`} className="text-[11px] font-semibold text-[#5f6368]">Comment</label><span className="text-[10px] text-[#8e8e93]">{reviewEditDraft.comment.length}/500</span></div>
                          <textarea id={`review-edit-${review.reviewId}`} value={reviewEditDraft.comment} maxLength={500} rows={4} disabled={isReviewUpdating} onChange={(event) => { setReviewEditDraft({ ...reviewEditDraft, comment: event.target.value }); setReviewUpdateError(null); }} className="mt-2 w-full resize-none rounded-xl border border-[#d2d2d7] bg-white p-3 text-[12px] leading-5 outline-none transition focus:border-[#007AFF] focus:ring-4 focus:ring-[#007AFF]/10 disabled:cursor-wait disabled:opacity-70" />
                        </div>
                        {reviewUpdateError && <p role="alert" className="rounded-lg bg-[#fff2f1] px-3 py-2 text-[11px] font-medium text-[#d92d20]">{reviewUpdateError}</p>}
                        <div className="flex justify-end gap-2">
                          <button type="button" disabled={isReviewUpdating} onClick={() => { setReviewEditDraft(null); setReviewUpdateError(null); }} className="min-h-9 rounded-lg px-3 text-[11px] font-semibold text-[#5f6368] hover:bg-[#f1f3f4] disabled:cursor-wait disabled:opacity-70">Cancel</button>
                          <button type="button" disabled={isReviewUpdating} onClick={() => void handleUpdateReview()} className="flex min-h-9 items-center gap-1.5 rounded-lg bg-[#007AFF] px-3 text-[11px] font-semibold text-white hover:bg-[#0066d6] disabled:cursor-wait disabled:opacity-70">{isReviewUpdating && <Loader2 size={13} className="animate-spin" />}{isReviewUpdating ? 'Saving…' : 'Save changes'}</button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 whitespace-pre-line text-[12px] leading-5 text-[#5f6368]">{review.comment || 'No written comment.'}</p>
                    )}

                    {review.ownerReply && (
                      <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-black/[0.05]">
                        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#007AFF]"><MessageSquare size={11} /> Owner reply</p>
                        <p className="mt-1 text-[11px] leading-4 text-[#5f6368]">{review.ownerReply}</p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            {reviewMeta && reviewMeta.totalPages > 1 && (
              <nav aria-label="Review pages" className="mt-4 flex items-center justify-between gap-3">
                <button type="button" disabled={reviewPage <= 1 || isReviewsLoading} onClick={() => setReviewPage((current) => Math.max(1, current - 1))} className="min-h-9 rounded-lg border border-[#d2d2d7] bg-white px-3 text-[11px] font-semibold text-[#5f6368] hover:bg-[#f8f9fa] disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
                <span className="text-[11px] font-medium text-[#8e8e93]">Page {reviewPage} of {reviewMeta.totalPages}</span>
                <button type="button" disabled={reviewPage >= reviewMeta.totalPages || isReviewsLoading} onClick={() => setReviewPage((current) => Math.min(reviewMeta.totalPages, current + 1))} className="min-h-9 rounded-lg border border-[#d2d2d7] bg-white px-3 text-[11px] font-semibold text-[#5f6368] hover:bg-[#f8f9fa] disabled:cursor-not-allowed disabled:opacity-50">Next</button>
              </nav>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[#8e8e93]"><ShieldCheck size={12} /> Only commuters with a completed booking can publish a review.</p>
          </section>

          <div className="h-px bg-[#e8eaed]" />

          {/* About */}
          <div>
            <h3 className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">About This Space</h3>
            <p className="text-[13px] text-[#5f6368] leading-relaxed">
              A private parking bay offered near {stationName || 'an LRT/MRT station'}. ParkJom coordinates the reservation and smart-bollard access flow for the parking session.
            </p>
          </div>

          <div className="h-px bg-[#e8eaed]" />

          {/* Price breakdown */}
          {quote && (
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#5f6368]">RM {quote.ratePerDay.toFixed(2)} × {quote.bookedDays} day{quote.bookedDays === 1 ? '' : 's'}</span>
                <span className="font-semibold text-[#111]">RM {quote.rentalSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-[15px]">
                <span>Total</span>
                <span>RM {quote.rentalSubtotal.toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-[#9ca3af]">Quote expires {new Date(quote.expiresAt).toLocaleString('en-MY')}.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom fixed booking bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e8eaed] px-4 md:px-6 py-4 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-[#111] text-[15px]">{displayedRate > 0 ? `RM ${displayedRate.toFixed(2)}` : 'Daily rate'} <span className="text-[13px] font-normal text-[#5f6368]">/ day</span></p>
            <p className="text-[11px] text-[#9ca3af]">{quote ? `${quote.bookedDays} days · RM ${displayedTotal.toFixed(2)} total` : 'Request a quote for exact pricing'}</p>
          </div>
          <button onClick={handleBook} disabled={invalidDates || isBookingLoading || (Boolean(quote) && !selectedVehicleId)}
            className={`font-semibold text-[13px] px-8 py-3 rounded-xl transition flex items-center gap-2 ${
              invalidDates || isBookingLoading || (Boolean(quote) && !selectedVehicleId) ? 'bg-[#e8eaed] text-[#9ca3af] cursor-not-allowed' : 'bg-[#007AFF] text-white hover:bg-[#1d4ed8] active:scale-[0.98]'
            }`}>
            {isBookingLoading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
            {isBookingLoading ? (quote ? 'Confirming…' : 'Creating quote…') : quote ? `Confirm & Pay · RM ${quote.rentalSubtotal.toFixed(2)}` : 'Get Booking Quote'}
          </button>
        </div>
      </div>
    </div>
  );
}
