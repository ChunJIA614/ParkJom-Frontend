import { useEffect, useMemo, useRef, useState } from 'react';
import SystemSelect from '@/components/ui/SystemSelect';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Navigation, ShieldCheck,
  Car, Wifi, CreditCard,
  Loader2, Calendar, AlertTriangle,
  Heart, Copy, Check,
  ChevronLeft, ChevronRight, MessageSquare, Pencil, Star, Trash2,
  Share2,
} from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { useAuth } from '@/features/auth/context/AuthContext';
import { showConfirm } from '@/contexts/ModalContext';
import type { Booking, ParkingSpot } from '../types';
import { loadJourneySession, saveJourneySession } from '../lib/journeySession';
import { getWalkingRoute } from '@/services/walkingRoutes';
import {
  planMultimodalJourney,
  MultimodalPlanResult,
  CommuterPreference,
} from '@/services/multimodalRoutingService';
import { Bus, Footprints, Sparkles, Compass, CheckCircle2 } from 'lucide-react';
import { getPublicParkingSpot } from '../api/parkingApi';
import { AiCongestionForecastCard } from '../components/AiCongestionForecastCard';
import { calculateWalkingMinutes } from '@/services/pedestrianWalkingService';
import { getTransitStops } from '@/services/gtfsApi';
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
import { getMyVehicles } from '../api/vehicleApi';
import {
  applyActiveVehicle,
  loadCachedVehicles,
  mapApiVehicleToVehicle,
  saveCachedVehicles,
  type Vehicle,
} from '../lib/vehicleStorage';
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
type DetailTab = 'reserve' | 'forecast' | 'route';
interface MockParkingSpot extends ParkingSpot {
  stationLatitude?: number | null;
  stationLongitude?: number | null;
  lon: number;
  photoUrl: string;
  price: number;
  /**
   * False when the backend did not return bay coordinates. `lat`/`lon` are then
   * 0 placeholders and every distance/route affordance must stay hidden.
   */
  hasCoordinates?: boolean;
}
interface WalkingInfo {
  distanceText: string;
  durationText: string;
  rawDistance: number;
  durationMinutes?: number;
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
  const { id: routeId } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const { state } = useLocation() as {
    state?: {
      spot?: MockParkingSpot;
      stationCoords?: { lat: number; lon: number } | null;
      stationName?: string;
      /** Dates proposed by ParkJom Copilot; validated by the normal availability rules below. */
      copilotPrefill?: { startDate: string; endDate: string };
    };
  };

  const [fetchedSpot, setFetchedSpot] = useState<MockParkingSpot | null>(null);
  const [isFetchingSpot, setIsFetchingSpot] = useState(false);
  const [fetchSpotError, setFetchSpotError] = useState<string | null>(null);

  const stateSpotMatchesRoute = Boolean(
    state?.spot && String(state.spot.parkingSpotId ?? state.spot.id) === String(routeId),
  );
  const spot = fetchedSpot ?? (stateSpotMatchesRoute ? state?.spot ?? null : null);
  const [activeTab, setActiveTab] = useState<DetailTab>('reserve');
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const handleShare = () => {
    if (navigator?.clipboard) {
      void navigator.clipboard.writeText(window.location.href);
      setIsLinkCopied(true);
      setTimeout(() => setIsLinkCopied(false), 2200);
    }
  };
  const stateStationCoords = state?.stationCoords ?? null;
  const [resolvedStationCoords, setResolvedStationCoords] = useState<{ lat: number; lon: number } | null>(stateStationCoords);
  const rawStateStation = state?.stationName && state.stationName !== 'Your location'
    ? state.stationName
    : '';
  const stationName = (
    spot?.stationName ||
    spot?.station ||
    rawStateStation ||
    (spot ? `${spot.propertyName || spot.address}` : '')
  ).trim();

  useEffect(() => {
    if (stateStationCoords?.lat && stateStationCoords?.lon) {
      setResolvedStationCoords(stateStationCoords);
      return;
    }
    if (spot?.stationLatitude && spot?.stationLongitude) {
      setResolvedStationCoords({
        lat: Number(spot.stationLatitude),
        lon: Number(spot.stationLongitude),
      });
      return;
    }
    if (stationName && !resolvedStationCoords) {
      getTransitStops({ search: stationName })
        .then((stops) => {
          if (stops && stops.length > 0) {
            setResolvedStationCoords({
              lat: stops[0].latitude,
              lon: stops[0].longitude,
            });
          }
        })
        .catch(() => {});
    }
  }, [stateStationCoords?.lat, stateStationCoords?.lon, spot?.stationLatitude, spot?.stationLongitude, stationName]);

  const [walkingInfo, setWalkingInfo] = useState<WalkingInfo | null>(null);
  const [multimodalPlan, setMultimodalPlan] = useState<MultimodalPlanResult | null>(null);
  const [preference, setPreference] = useState<CommuterPreference>('balanced');
  const [activeItineraryId, setActiveItineraryId] = useState<string>('');
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  useEffect(() => {
    if (state?.spot || !routeId) return;
    const controller = new AbortController();
    setIsFetchingSpot(true);
    setFetchSpotError(null);
    getPublicParkingSpot(routeId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const d = result.data;
        const primaryImg =
          d.images?.[0]?.secureUrl ||
          (d.images?.[0]?.mediaFileId ? `/api/media/view/image/${d.images[0].mediaFileId}` : '') ||
          'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80';
        const latitude = d.latitude ?? 0;
        const longitude = d.longitude ?? 0;
        const hasCoordinates = latitude !== 0 || longitude !== 0;
        const mockSpot: MockParkingSpot = {
          id: String(d.parkingSpotId),
          parkingSpotId: d.parkingSpotId,
          parkingLabel: d.parkingLabel || 'Bay',
          propertyId: d.propertyId,
          propertyName: d.propertyName,
          address: d.address,
          latitude,
          longitude,
          lat: latitude,
          lng: longitude,
          lon: longitude,
          hasCoordinates,
          stationName: d.stationName ?? '',
          distanceToStation: d.distanceToStationMeters ?? 0,
          timeToStationInMinutes: d.timeToStationInMinutes ?? 0,
          availabilityStatus: String(d.availabilityStatus),
          monthlyRate: d.monthlyRate,
          dailyRate: d.dailyRate,
          primaryImageUrl: primaryImg,
          photoUrl: primaryImg,
          price: d.dailyRate ?? (d.monthlyRate ? Number((d.monthlyRate / 30).toFixed(2)) : 0),
          station: d.stationName ?? '',
          name: d.propertyName || d.address,
          pricePerHour: d.dailyRate ?? 0,
          distance: 0,
          available: d.isPublished,
          type: 'Condo Bay',
          owner: d.ownerName || 'Bay Owner',
        };
        setFetchedSpot(mockSpot);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setFetchSpotError(err instanceof Error ? err.message : 'Unable to load parking details.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsFetchingSpot(false);
      });

    return () => controller.abort();
  }, [routeId, state?.spot]);

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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(false);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [reservationReady, setReservationReady] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [isFavorite, setIsFavorite] = useState(() => Boolean(spot && user?.userId && isParkingFavorite(user.userId, spot.parkingSpotId)));
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
  const [isFavoriteUpdating, setIsFavoriteUpdating] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const appliedPrefillRef = useRef<string | null>(null);
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

  // `0,0` is the placeholder used when the API omits coordinates, so treat it
  // as "unknown" rather than as a real bay in the Gulf of Guinea.
  const bayCoordinates = (() => {
    if (!spot || spot.hasCoordinates === false) return null;
    const lat = spot.lat || spot.latitude || 0;
    const lng = spot.lon || spot.lng || spot.longitude || 0;
    return lat && lng ? { lat, lng } : null;
  })();

  const calculatedWalkMinutes = useMemo(() => {
    if (walkingInfo?.durationMinutes) {
      return walkingInfo.durationMinutes;
    }
    if (spot && spot.distanceToStation > 0) {
      return calculateWalkingMinutes(spot.distanceToStation * 1000, { isStationDestination: true });
    }
    if (spot?.timeToStationInMinutes && spot.timeToStationInMinutes > 0) {
      return Math.round(spot.timeToStationInMinutes);
    }
    return null;
  }, [walkingInfo?.durationMinutes, spot?.distanceToStation, spot?.timeToStationInMinutes]);

  useEffect(() => {
    if (!bayCoordinates || !resolvedStationCoords) {
      setWalkingInfo(null);
      setIsLoadingRoute(false);
      return;
    }
    setIsLoadingRoute(true);
    getWalkingRoute(bayCoordinates.lat, bayCoordinates.lng, resolvedStationCoords.lat, resolvedStationCoords.lon)
      .then(setWalkingInfo).finally(() => setIsLoadingRoute(false));
  }, [bayCoordinates?.lat, bayCoordinates?.lng, resolvedStationCoords?.lat, resolvedStationCoords?.lon]);

  useEffect(() => {
    if (!spot || !bayCoordinates) {
      setMultimodalPlan(null);
      return;
    }

    planMultimodalJourney(
      {
        name: spot.propertyName || spot.name || 'Parking Bay',
        lat: bayCoordinates.lat,
        lng: bayCoordinates.lng,
        address: spot.address,
      },
      resolvedStationCoords
        ? { name: stationName || 'Transit Station', lat: resolvedStationCoords.lat, lng: resolvedStationCoords.lon }
        : null,
      undefined,
      preference,
    ).then((plan) => {
      setMultimodalPlan(plan);
      setActiveItineraryId(plan.recommendedItinerary.id);
    });
  }, [spot?.parkingSpotId, bayCoordinates?.lat, bayCoordinates?.lng, resolvedStationCoords?.lat, resolvedStationCoords?.lon, stationName, preference]);

  useEffect(() => {
    if (!user?.userId) return;

    // Paint the cached list first so the selector is usable immediately.
    const cached = loadCachedVehicles(user.userId);
    if (cached.length > 0) {
      setVehicles(cached);
      setSelectedVehicleId((current) => current ?? cached.find((v) => v.active)?.vehicleId ?? cached[0]?.vehicleId ?? null);
    }

    if (!user.token) {
      setIsVehiclesLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsVehiclesLoading(true);
    void getMyVehicles(user.token, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const mapped = applyActiveVehicle(
          result.data.map((vehicle) => mapApiVehicleToVehicle(vehicle)),
          cached.find((vehicle) => vehicle.active)?.vehicleId ?? null,
        );
        setVehicles(mapped);
        saveCachedVehicles(user.userId, mapped);
        setSelectedVehicleId((current) => (
          current != null && mapped.some((vehicle) => vehicle.vehicleId === current)
            ? current
            : mapped.find((vehicle) => vehicle.active)?.vehicleId ?? mapped[0]?.vehicleId ?? null
        ));
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        // A vehicle-list failure must not block the detail page when a cached
        // list is already on screen.
        if (cached.length === 0) {
          setBookingError(error instanceof Error ? error.message : 'Unable to load your vehicles.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsVehiclesLoading(false);
      });

    return () => controller.abort();
  }, [user?.userId, user?.token]);

  useEffect(() => {
    if (!spot || !user?.token) return;

    const month = toMonthInput(calendarMonth);
    if (availabilityByMonth[month]) return;

    const controller = new AbortController();
    setIsAvailabilityLoading(true);
    setAvailabilityError(null);
    void getBookingAvailability(user.token, spot.parkingSpotId, month, controller.signal)
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
  }, [availabilityByMonth, calendarMonth, spot, user?.token]);

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

  // Apply Copilot-proposed dates once, after the reset above has run for this spot.
  useEffect(() => {
    const prefill = state?.copilotPrefill;
    if (!spot || !prefill) return;
    const key = `${spot.parkingSpotId}:${prefill.startDate}:${prefill.endDate}`;
    if (appliedPrefillRef.current === key) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(prefill.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(prefill.endDate)) return;
    appliedPrefillRef.current = key;
    setStartDate(prefill.startDate);
    setEndDate(prefill.endDate);
    setCalendarMonth(startOfMonth(dateFromKey(prefill.startDate)));
  }, [spot, state?.copilotPrefill]);

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
    if (!spot || !user?.token) return;

    const controller = new AbortController();
    const cachedReviews = loadCachedParkingReviews(spot.parkingSpotId);
    if (reviewPage === 1 && reviews.length === 0) setReviews(cachedReviews);
    if (reviewPage > 1) setReviews([]);
    setReviewEditDraft(null);
    setReviewUpdateError(null);
    setReviewDeleteError(null);
    setReviewsLoadError(null);
    setIsReviewsLoading(true);

    void getParkingReviews(user.token, spot.parkingSpotId, reviewPage, REVIEW_PAGE_SIZE, controller.signal)
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
  }, [reviewPage, reviewRefreshKey, spot, user?.token]);

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
    const confirmed = await showConfirm({
      title: 'Delete Review',
      message: 'Delete your review permanently? This cannot be undone.',
      confirmText: 'Delete Review',
      cancelText: 'Cancel',
      variant: 'danger',
      icon: 'trash',
    });
    if (!confirmed) return;

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

  if (isFetchingSpot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#000000]">
        <div className="text-center space-y-4">
          <Loader2 size={36} className="mx-auto text-[#007AFF] dark:text-[#0A84FF] animate-spin" />
          <p className="text-[#5f6368] dark:text-[#A1A1AA] font-medium text-[14px]">Loading parking spot...</p>
        </div>
      </div>
    );
  }

  if (!spot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#000000]">
        <div className="text-center space-y-4">
          <MapPin size={40} className="mx-auto text-[#dadce0] dark:text-white/20" />
          <p className="text-[#5f6368] dark:text-[#A1A1AA] font-medium text-[15px]">{fetchSpotError || 'No parking spot selected.'}</p>
          <button onClick={() => navigate('/commuter')} className="text-[13px] text-[#007AFF] dark:text-[#0A84FF] font-semibold hover:underline cursor-pointer">
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

  const getDatesBetween = (fromDate: string, toDate: string) => {
    if (!fromDate || !toDate || toDate < fromDate) return [];
    const dates: string[] = [];
    let cursor = dateFromKey(fromDate);
    const lastDate = dateFromKey(toDate);
    while (cursor <= lastDate) {
      dates.push(toDateInput(cursor));
      cursor = addDays(cursor, 1);
    }
    return dates;
  };

  const getOpenDatesInRange = (fromDate: string, toDate: string) => {
    return getDatesBetween(fromDate, toDate).filter((dateKey) => isDateAvailable(dateKey));
  };

  const getNextAvailableDate = (fromDateKey: string): string | null => {
    let cursor = dateFromKey(fromDateKey);
    for (let i = 1; i <= 31; i++) {
      cursor = addDays(cursor, 1);
      const candidate = toDateInput(cursor);
      if (isDateAvailable(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  const getPreviousAvailableDate = (fromDateKey: string): string | null => {
    let cursor = dateFromKey(fromDateKey);
    for (let i = 1; i <= 31; i++) {
      cursor = addDays(cursor, -1);
      const candidate = toDateInput(cursor);
      if (candidate < minimumBookingDate) break;
      if (isDateAvailable(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  const openDaysInRange = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return [];
    return getOpenDatesInRange(startDate, endDate);
  }, [startDate, endDate, availabilityByMonth]);

  const closedDaysInRangeCount = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return 0;
    const totalDays = getDatesBetween(startDate, endDate).length;
    return Math.max(0, totalDays - openDaysInRange.length);
  }, [startDate, endDate, openDaysInRange]);

  const invalidDates = !startDate
    || !endDate
    || endDate < startDate
    || startDate < minimumBookingDate
    || openDaysInRange.length === 0;
  const displayedRate = quote?.ratePerDay ?? spot.dailyRate ?? 0;
  const displayedTotal = quote?.rentalSubtotal ?? 0;

  const dateValidationError = startDate && endDate
    ? endDate < startDate
      ? 'Choose an end date on or after the start date.'
      : startDate < minimumBookingDate
        ? `Bookings open from ${formatDateKey(minimumBookingDate)}.`
        : openDaysInRange.length === 0
          ? 'No open booking dates are available within this range.'
          : null
    : null;

  const handleDateSelection = (rawDateKey: string) => {
    if (isAvailabilityLoading) return;
    if (rawDateKey < minimumBookingDate) {
      setDateSelectionError(`Bookings open from ${formatDateKey(minimumBookingDate)}.`);
      return;
    }

    setQuote(null);
    setBookingError(null);
    setDateSelectionError(null);
    idempotencyKeyRef.current = null;

    let targetDateKey = rawDateKey;

    // If the clicked date is closed (e.g. weekend is closed):
    if (!isDateAvailable(targetDateKey)) {
      // Automatically ignore the closed date and continue with next week's open date
      const nextOpen = getNextAvailableDate(targetDateKey);
      if (nextOpen) {
        targetDateKey = nextOpen;
      } else {
        const prevOpen = getPreviousAvailableDate(targetDateKey);
        if (prevOpen && (!startDate || prevOpen >= startDate)) {
          targetDateKey = prevOpen;
        } else {
          setDateSelectionError(`${formatDateKey(rawDateKey)} is not open for booking.`);
          return;
        }
      }
    }

    if (!startDate) {
      setStartDate(targetDateKey);
      setEndDate('');
      return;
    }

    if (!endDate) {
      if (targetDateKey >= startDate) {
        setEndDate(targetDateKey);
        return;
      }
      setStartDate(targetDateKey);
      setEndDate('');
      return;
    }

    if (startDate === endDate && targetDateKey > startDate) {
      setEndDate(targetDateKey);
      return;
    }

    setStartDate(targetDateKey);
    setEndDate('');
  };

  const handleBottomAction = () => {
    if (activeTab !== 'reserve') {
      setActiveTab('reserve');
      window.scrollTo({ top: 320, behavior: 'smooth' });
      return;
    }
    void handleBook();
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
        vehiclePlate: vehicle?.plate ?? '',
        status: 'Upcoming',
        totalPaid: quote.renterTotal,
      };

      const currentSession = loadJourneySession(user.userId);
      if (!currentSession || new Date(currentSession.booking.endTime) <= new Date() || new Date(booking.startTime) <= new Date(currentSession.booking.startTime)) {
        saveJourneySession(booking, 'reserved', user.userId);
      }
      setReservationReady(true);
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Unable to complete this booking.');
    } finally {
      setIsBookingLoading(false);
    }
  };

  if (reservationReady) {
    const spotPhoto = spot.primaryImageUrl || spot.photoUrl || 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80';
    return (
      <div className="page-shell text-[#1d1d1f] dark:text-white">
        <DashboardHeader
          role="commuter"
          user={user}
          onSignOut={() => { logout(); navigate('/'); }}
          onBrandClick={() => navigate('/commuter', { replace: true, state: { activeTab: 'home' } })}
        />
        <main className="max-w-xl mx-auto px-4 py-8 md:py-12">
          {/* Back link */}
          <button
            type="button"
            onClick={() => navigate('/commuter', { state: { activeTab: 'active' } })}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#6e6e73] dark:text-[#A1A1AA] hover:text-[#111] dark:hover:text-white cursor-pointer transition"
          >
            <ArrowLeft size={15} /> Back to dashboard
          </button>

          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl border border-black/[0.08] dark:border-white/10 overflow-hidden shadow-xl">
            {/* Minimalist Hero Image Card (Airbnb Style) */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-white/5 border-b border-black/[0.06] dark:border-white/10">
              <img
                src={spotPhoto}
                alt={spot.propertyName || spot.name || 'Parking bay'}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute top-4 left-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white shadow-sm backdrop-blur-md">
                  <CheckCircle2 size={13} /> Booking Confirmed
                </span>
              </div>
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-white/20 backdrop-blur-md mb-1.5">
                  Bay {spot.parkingLabel}
                </span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight drop-shadow-xs">
                  {spot.propertyName || spot.name || spot.address}
                </h1>
                <p className="text-xs text-white/80 flex items-center gap-1 mt-0.5">
                  <MapPin size={12} className="shrink-0" />
                  <span>{stationName ? `Near ${stationName}` : spot.station || 'Klang Valley'}</span>
                  {spot.distanceToStation > 0 && <span>· {(spot.distanceToStation / 1000).toFixed(2)} km</span>}
                </p>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {/* Airbnb Signature Twin-Box (Dates & Times) */}
              <div className="grid grid-cols-2 rounded-2xl border border-black/[0.08] dark:border-white/10 divide-x divide-black/[0.08] dark:divide-white/10 bg-[#F9F9FB] dark:bg-white/[0.03] overflow-hidden">
                <div className="p-4">
                  <span className="block text-[10px] font-bold text-[#6e6e73] dark:text-[#A1A1AA] uppercase tracking-wider">
                    Check-in Date
                  </span>
                  <span className="block text-sm sm:text-base font-bold text-[#111] dark:text-white mt-1">
                    {quote?.startDate}
                  </span>
                  <span className="block text-[11px] text-[#6e6e73] dark:text-[#A1A1AA] mt-0.5">
                    From 12:00 AM (Full Day)
                  </span>
                </div>
                <div className="p-4">
                  <span className="block text-[10px] font-bold text-[#6e6e73] dark:text-[#A1A1AA] uppercase tracking-wider">
                    Check-out Date
                  </span>
                  <span className="block text-sm sm:text-base font-bold text-[#111] dark:text-white mt-1">
                    {quote?.endDate}
                  </span>
                  <span className="block text-[11px] text-[#6e6e73] dark:text-[#A1A1AA] mt-0.5">
                    {quote?.bookedDays} Day{quote?.bookedDays === 1 ? '' : 's'} Total
                  </span>
                </div>
              </div>

              {/* Access & Smart Gate Instructions */}
              <div className="rounded-2xl border border-black/[0.06] dark:border-white/10 bg-[#F5F5F7]/80 dark:bg-[#18181C] p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-white dark:bg-white/[0.08] text-[#007AFF] shadow-2xs">
                      <Wifi size={16} />
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-[#111] dark:text-white">Smart Barrier Access</h3>
                      <p className="text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">Automatic IoT gate release upon arrival</p>
                    </div>
                  </div>
                  {vehicles.find(v => v.vehicleId === selectedVehicleId)?.plate && (
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-white/10 border border-black/[0.06] dark:border-white/10 text-[#111] dark:text-white">
                      {vehicles.find(v => v.vehicleId === selectedVehicleId)?.plate}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#6e6e73] dark:text-[#A1A1AA] leading-relaxed">
                  Drive up to the bay bollard. Use your Parking Pass or ALPR camera scanner to unlock in 1 tap.
                </p>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${spot.lat || spot.latitude},${spot.lng || spot.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border border-black/[0.08] dark:border-white/14 bg-white dark:bg-[#242429] text-[#111] dark:text-white hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C32] transition"
                >
                  <Navigation size={14} className="text-[#007AFF]" />
                  Open Navigation (Google Maps)
                </a>
              </div>

              {/* Price Breakdown Receipt */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between text-xs text-[#6e6e73] dark:text-[#A1A1AA]">
                  <span>RM {quote?.ratePerDay.toFixed(2)} × {quote?.bookedDays} days</span>
                  <span className="font-medium text-[#111] dark:text-white">RM {quote?.renterTotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#6e6e73] dark:text-[#A1A1AA]">
                  <span>ParkJom Service & Smart Access Fee</span>
                  <span className="text-[#34C759] font-medium">Included</span>
                </div>
                <div className="border-t border-black/[0.08] dark:border-white/10 pt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#111] dark:text-white">Total Paid</span>
                  <span className="text-xl font-bold text-[#111] dark:text-white">RM {quote?.renterTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Booking Reference Pill */}
              <div className="flex items-center justify-between rounded-xl bg-[#F5F5F7] dark:bg-[#18181C] px-3.5 py-2.5 border border-black/[0.06] dark:border-white/10 text-xs">
                <div>
                  <span className="block text-[10px] text-[#6e6e73] dark:text-[#A1A1AA] uppercase tracking-wider font-semibold">Booking Reference</span>
                  <span className="font-mono font-bold text-xs text-[#111] dark:text-white">{confirmedBooking?.bookingReference}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmedBooking?.bookingReference) {
                      navigator.clipboard.writeText(confirmedBooking.bookingReference);
                      setCopiedRef(true);
                      setTimeout(() => setCopiedRef(false), 2000);
                    }
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#007AFF] hover:underline cursor-pointer"
                >
                  {copiedRef ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/commuter', { state: { activeTab: 'active' } })}
                  className="w-full min-h-12 rounded-xl bg-[#007AFF] dark:bg-[#0071E3] hover:bg-[#0066d6] dark:hover:bg-[#0077ED] text-white text-[13px] font-semibold transition-all shadow-md active:scale-[0.99] cursor-pointer"
                >
                  Continue to my parking pass
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/commuter', { state: { activeTab: 'home' } })}
                  className="w-full min-h-10 rounded-xl bg-transparent hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] text-[#6e6e73] dark:text-[#A1A1AA] text-xs font-semibold transition cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell text-[#1d1d1f] dark:text-white min-h-screen pb-24 lg:pb-16">
      <DashboardHeader
        role="commuter"
        user={user}
        onSignOut={() => { logout(); navigate('/'); }}
        onBrandClick={() => navigate('/commuter', { replace: true, state: { activeTab: 'home' } })}
      />

      <main className="w-[92vw] max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 pt-4 pb-12">
        {/* Top Navigation & Breadcrumb */}
        <div className="flex items-center justify-between pb-3 shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6e6e73] dark:text-[#A1A1AA] hover:text-[#111] dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} /> Back to map
          </button>
          <span className="text-xs font-semibold text-[#8e8e93] dark:text-[#71717A] hidden sm:inline-flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-[#34C759]" /> Verified Bay · Instant Reservation
          </span>
        </div>

        {/* ── Title & Header Info Bar (Airbnb Style) ── */}
        <div className="space-y-1.5 pt-1 pb-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111] dark:text-white tracking-[-0.02em] leading-tight break-words">
            {spot.propertyName || spot.name || spot.address}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-xs sm:text-[13px] text-[#5f6368] dark:text-[#A1A1AA]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 font-bold text-[#111] dark:text-white">
                <Star size={14} className="text-[#ff9500] fill-[#ff9500]" />
                <span>{averageRating.toFixed(1)}</span>
                <span className="font-normal text-[#5f6368] dark:text-[#A1A1AA]">·</span>
                <button
                  type="button"
                  onClick={() => document.getElementById('commuter-reviews-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="font-normal underline hover:text-[#111] dark:hover:text-white cursor-pointer"
                >
                  {reviewMeta?.totalCount ?? reviews.length} reviews
                </button>
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} className="text-[#007AFF] shrink-0" />
                <span>{stationName ? `Near ${stationName}` : 'Klang Valley'}</span>
                {spot.address && spot.address !== (spot.propertyName || spot.name) && (
                  <span className="hidden md:inline text-[#8e8e93] dark:text-[#71717A]">({spot.address})</span>
                )}
              </span>
            </div>

            {/* Share & Save Buttons (Airbnb Top Right) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#dadce0] dark:border-white/10 hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] text-xs font-semibold text-[#111] dark:text-white transition cursor-pointer"
              >
                {isLinkCopied ? (
                  <>
                    <Check size={14} className="text-[#34C759]" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 size={14} />
                    <span>Share</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => void handleToggleFavorite()}
                disabled={isFavoriteLoading || isFavoriteUpdating}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition cursor-pointer text-xs font-semibold ${
                  isFavorite
                    ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400'
                    : 'border-[#dadce0] dark:border-white/10 hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] text-[#111] dark:text-white'
                }`}
              >
                {isFavoriteLoading || isFavoriteUpdating ? (
                  <Loader2 size={14} className="animate-spin text-[#007AFF]" />
                ) : (
                  <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-rose-500' : ''} />
                )}
                <span>{isFavorite ? 'Saved' : 'Save'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Full-Width Top Hero Banner (Airbnb listing hero spanning full container width) ── */}
        <div className="relative aspect-[21/9] sm:aspect-[24/9] md:aspect-[2.6/1] w-full min-h-[260px] max-h-[460px] overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/10 bg-[#F5F5F7] dark:bg-[#1C1C1E] shadow-sm mb-10">
          <img
            src={spot.primaryImageUrl || spot.photoUrl || 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=1200&auto=format&fit=crop&q=80'}
            alt={spot.name || 'Parking bay'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/65 dark:bg-black/75 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/15">
              <CheckCircle2 size={13} className="text-[#34C759]" /> Verified Bay Photo
            </span>
          </div>
          {spot.parkingLabel && (
            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/65 dark:bg-black/75 px-3.5 py-1.5 text-xs font-mono font-bold text-white backdrop-blur-md border border-white/15">
                Bay {spot.parkingLabel}
              </span>
            </div>
          )}
        </div>

        {favoriteError && (
          <div role="alert" className="mb-6 flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{favoriteError}</span>
          </div>
        )}

        {/* ── Two-Column Layout Below Hero (65% Unboxed Left Column, 35% Sticky Right Booking Card) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-10 lg:gap-14 xl:gap-16 items-start">

          {/* ════════ LEFT COLUMN (65% Width) - Completely Unboxed, Sits on page background ════════ */}
          <div className="w-full space-y-8">
            {/* 1. Property Summary & Metadata Pills */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#111] dark:text-white">
                    Private parking bay · Hosted by verified owner
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-[#5f6368] dark:text-[#A1A1AA]">
                    1 dedicated bay {spot.parkingLabel ? `(${spot.parkingLabel})` : ''} · Smart IoT bollard · Transit-connected
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-[#007AFF]/10 dark:bg-[#0071E3]/20 flex items-center justify-center shrink-0 text-[#007AFF] font-bold text-base">
                  <Car size={22} />
                </div>
              </div>

              {/* Metadata Pills */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-[#1E1E22] px-3.5 py-1.5 font-bold text-blue-700 dark:text-[#3894FF] border border-blue-100 dark:border-white/10">
                  RM {displayedRate.toFixed(2)} <span className="font-normal text-blue-600">/ day</span>
                </span>
                {spot.parkingLabel && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-[#1E1E22] px-3.5 py-1.5 font-semibold text-slate-700 dark:text-[#E4E4E7] border border-transparent dark:border-white/10">
                    <Car size={14} className="text-slate-500 dark:text-[#A1A1AA]" /> Bay {spot.parkingLabel}
                  </span>
                )}
                {calculatedWalkMinutes !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('route');
                      document.getElementById('booking-calendar-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    title="Click to view walking & transit route to station"
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-1.5 font-medium text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/60 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50 transition cursor-pointer"
                  >
                    <Footprints size={14} className="text-emerald-600 dark:text-emerald-400" />
                    <span>~{calculatedWalkMinutes} mins walk ({spot.distanceToStation > 0 ? `${spot.distanceToStation.toFixed(2)} km` : walkingInfo?.distanceText || 'to station'})</span>
                  </button>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 dark:bg-[#1E1E22] px-3.5 py-1.5 text-slate-600 dark:text-[#D4D4D8] border border-slate-200 dark:border-white/10">
                  <Wifi size={14} className="text-[#007AFF] dark:text-[#0A84FF]" /> Smart bollard access
                </span>
              </div>

              {/* Airbnb Signature Highlight Rows */}
              <div className="space-y-4 pt-4">
                <div className="flex items-start gap-4">
                  <Wifi size={22} className="text-[#007AFF] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-[#111] dark:text-white">Self check-in via smart bollard</h3>
                    <p className="text-xs text-[#5f6368] dark:text-[#A1A1AA] mt-0.5">
                      Check yourself in with the ParkJom 1-tap Bluetooth or IoT barrier pass upon arrival.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <MapPin size={22} className="text-[#007AFF] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-[#111] dark:text-white">Great commuter location</h3>
                    <p className="text-xs text-[#5f6368] dark:text-[#A1A1AA] mt-0.5">
                      100% of recent commuters rated the proximity to {stationName || 'the transit station'} 5 stars.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <ShieldCheck size={22} className="text-[#34C759] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-[#111] dark:text-white">ParkJom Verified Guarantee</h3>
                    <p className="text-xs text-[#5f6368] dark:text-[#A1A1AA] mt-0.5">
                      Physical spot dimensions and automated barrier hardware are verified by ParkJom specialists.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-[#e8eaed] dark:bg-white/10" />

            {/* 2. PARKING SPACE DETAILS */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] dark:text-[#A1A1AA]">
                PARKING SPACE DETAILS
              </h2>
              <div className="grid grid-cols-2 gap-3 pt-1">
                {[
                  { icon: Car, label: 'Private dedicated bay', desc: 'Reserved exclusively for your booked dates' },
                  { icon: Wifi, label: 'Smart bollard access', desc: 'Automated entry and exit via ParkJom pass' },
                  { icon: Navigation, label: 'Transit-adjacent', desc: 'Direct walking connectivity to train station' },
                  { icon: ShieldCheck, label: 'Secure automated access', desc: 'Continuous sensor monitoring and protection' },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="p-3.5 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-[#F9F9FB] dark:bg-white/[0.03]">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className="text-[#007AFF] shrink-0" />
                      <span className="text-xs font-bold text-[#111] dark:text-white">{label}</span>
                    </div>
                    <p className="text-[11px] text-[#5f6368] dark:text-[#A1A1AA] mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-[#e8eaed] dark:bg-white/10" />

            {/* 3. ABOUT THIS SPACE */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] dark:text-[#A1A1AA]">
                ABOUT THIS SPACE
              </h2>
              <p className="text-sm text-[#333] dark:text-[#D4D4D8] leading-relaxed">
                Welcome to {spot.propertyName || spot.name || 'this premier commuter parking space'}. Strategically located near {stationName || 'the transit interchange'}, this private parking bay offers commuters seamless park-and-ride accessibility.
              </p>
              <p className="text-sm text-[#5f6368] dark:text-[#A1A1AA] leading-relaxed">
                ParkJom coordinates reservation confirmation, calendar synchronization, and automated IoT barrier clearance so your bay is guaranteed and ready when you arrive.
              </p>
            </div>

            <div className="h-px bg-[#e8eaed] dark:bg-white/10" />

            {/* 4. Tabs & Interactive Calendar / AI Forecast / Station Route */}
            <div id="booking-calendar-section" className="space-y-5 pt-1 scroll-mt-20">
              {/* Apple Segmented Control */}
              <div
                role="tablist"
                aria-label="Parking detail views"
                className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-[#1C1C20] rounded-2xl border border-slate-200/80 dark:border-white/10 text-xs font-semibold select-none shadow-xs"
              >
                <button
                  role="tab"
                  aria-selected={activeTab === 'reserve'}
                  type="button"
                  onClick={() => setActiveTab('reserve')}
                  className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'reserve'
                      ? 'bg-white dark:bg-[#28282E] text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500 dark:text-[#A1A1AA] hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Calendar size={15} className={activeTab === 'reserve' ? 'text-[#007AFF] dark:text-[#0A84FF]' : ''} />
                  <span>Reserve Bay</span>
                </button>
                <button
                  role="tab"
                  aria-selected={activeTab === 'forecast'}
                  type="button"
                  onClick={() => setActiveTab('forecast')}
                  className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'forecast'
                      ? 'bg-white dark:bg-[#28282E] text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500 dark:text-[#A1A1AA] hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Sparkles size={15} className={activeTab === 'forecast' ? 'text-blue-600 dark:text-[#3894FF]' : ''} />
                  <span>AI Forecast</span>
                </button>
                <button
                  role="tab"
                  aria-selected={activeTab === 'route'}
                  type="button"
                  onClick={() => setActiveTab('route')}
                  className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'route'
                      ? 'bg-white dark:bg-[#28282E] text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500 dark:text-[#A1A1AA] hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Compass size={15} className={activeTab === 'route' ? 'text-[#007AFF] dark:text-[#0A84FF]' : ''} />
                  <span>Station Route</span>
                </button>
              </div>

              {/* ── TAB 1: RESERVE BAY & UNBOXED CALENDAR ── */}
              {activeTab === 'reserve' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-[#111] dark:text-white">
                        Select Booking Dates
                      </h3>
                      <p className="text-xs text-[#5f6368] dark:text-[#A1A1AA]">
                        {isAvailabilityLoading
                          ? 'Checking spot availability…'
                          : currentMonthAvailability
                            ? `${currentMonthAvailability.totalAvailableDates} available days published for this period`
                            : 'Choose dates to reserve your bay'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Previous month"
                        disabled={isAvailabilityLoading || calendarMonth <= minimumCalendarMonth}
                        onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dadce0] dark:border-white/12 bg-white dark:bg-[#242429] text-[#5f6368] dark:text-[#A1A1AA] transition hover:border-[#007AFF] hover:text-[#007AFF] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <span className="text-xs font-bold text-[#111] dark:text-white px-2">
                        {calendarMonth.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        aria-label="Next month"
                        disabled={isAvailabilityLoading}
                        onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dadce0] dark:border-white/12 bg-white dark:bg-[#242429] text-[#5f6368] dark:text-[#A1A1AA] transition hover:border-[#007AFF] hover:text-[#007AFF] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Unboxed Calendar Grid */}
                  <div className="rounded-2xl border border-black/[0.06] dark:border-white/10 bg-[#FBFBFC] dark:bg-white/[0.02] p-4 sm:p-5">
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] dark:text-[#71717A] pb-2 border-b border-black/[0.04] dark:border-white/[0.06]" aria-hidden="true">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
                    </div>

                    <div className="mt-3 grid grid-cols-7 gap-1.5">
                      {calendarDateKeys.map((dateKey, index) => {
                        if (!dateKey) return <span key={`empty-${index}`} className="min-h-10 sm:min-h-11" aria-hidden="true" />;

                        const isAvailable = isDateAvailable(dateKey);
                        const isStart = dateKey === startDate;
                        const isEnd = dateKey === endDate;
                        const isEndpoint = isStart || isEnd;
                        const isInCalendarSpan = Boolean(startDate && endDate && dateKey > startDate && dateKey < endDate);
                        const isInRangeOpen = isInCalendarSpan && isAvailable;
                        const isInRangeClosed = isInCalendarSpan && !isAvailable;
                        const isPast = dateKey < minimumBookingDate;
                        const isToday = dateKey === toDateInput(today);
                        return (
                          <button
                            key={dateKey}
                            type="button"
                            disabled={isPast || isAvailabilityLoading}
                            title={
                              isEndpoint
                                ? `${formatDateKey(dateKey)} (${isStart ? 'Booking Start' : 'Booking End'})`
                                : isInRangeOpen
                                  ? `${formatDateKey(dateKey)} (Available · Included in booking)`
                                  : isInRangeClosed
                                    ? `${formatDateKey(dateKey)} (Closed · Excluded from booking)`
                                    : isAvailable
                                      ? `${formatDateKey(dateKey)} (Available)`
                                      : `${formatDateKey(dateKey)} (Closed · Click to continue to next open date)`
                            }
                            aria-label={`${formatDateKey(dateKey)}${isAvailable ? ', available' : ', closed'}${isEndpoint ? ', selected' : isInRangeOpen ? ', in booking range' : isInRangeClosed ? ', closed and excluded' : ''}`}
                            aria-pressed={isEndpoint}
                            onClick={() => handleDateSelection(dateKey)}
                            className={`relative flex min-h-10 sm:min-h-11 items-center justify-center rounded-xl text-xs sm:text-[13px] font-semibold transition cursor-pointer select-none ${
                              isEndpoint
                                ? 'bg-[#007AFF] dark:bg-[#0071E3] text-white shadow-sm font-bold'
                                : isInRangeOpen
                                  ? 'bg-[#e8f0fe] dark:bg-blue-950/60 text-[#0066d6] dark:text-blue-200 font-semibold'
                                  : isInRangeClosed
                                    ? 'bg-slate-100/70 dark:bg-white/[0.04] text-[#8e8e93] dark:text-[#71717A] border border-dashed border-slate-300/80 dark:border-white/10 line-through decoration-slate-400 dark:decoration-white/30'
                                    : isAvailable
                                      ? 'bg-white dark:bg-[#1E1E22] text-[#111] dark:text-white ring-1 ring-[#e8eaed] dark:ring-white/10 hover:bg-[#e8f0fe] dark:hover:bg-[#2C2C32] hover:text-[#0066d6] dark:hover:text-white'
                                      : isPast
                                        ? 'cursor-not-allowed bg-transparent text-[#c7c7cc] dark:text-[#3F3F46]'
                                        : 'bg-transparent text-[#8e8e93] dark:text-[#71717A] hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                            } ${isToday && !isEndpoint ? 'ring-2 ring-[#007AFF]/30 dark:ring-[#0071E3]/50' : ''}`}
                          >
                            {dateFromKey(dateKey).getDate()}
                            {isAvailable && !isEndpoint && (
                              <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#34c759] dark:bg-[#30D158]" aria-hidden="true" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[#6e6e73] dark:text-[#A1A1AA] pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#34c759] dark:bg-[#30D158]" /> Available</span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#007AFF] dark:bg-[#0071E3]" /> Selected</span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#c7c7cc] dark:bg-[#52525B]" /> Unavailable / Closed</span>
                      <span className="inline-flex items-center gap-1.5 text-slate-400 dark:text-[#71717A]"><span className="line-through decoration-slate-400">12</span> Excluded</span>
                    </div>
                  </div>

                  {/* Range selection notices */}
                  {startDate && !endDate && !dateSelectionError && (
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f0f7ff] dark:bg-blue-950/30 p-3 border border-[#007AFF]/20 dark:border-blue-500/30">
                      <p className="text-xs font-medium text-[#007AFF] dark:text-[#3894FF]">Choose an end date, or reserve for 1 day.</p>
                      <button
                        type="button"
                        onClick={() => handleDateSelection(startDate)}
                        className="shrink-0 rounded-lg bg-[#007AFF] dark:bg-[#0071E3] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0066d6] dark:hover:bg-[#0077ED] transition active:scale-95 cursor-pointer shadow-xs"
                      >
                        Book 1 day ({formatDateKey(startDate)})
                      </button>
                    </div>
                  )}

                  {startDate && endDate && startDate === endDate && !dateSelectionError && (
                    <p className="text-xs font-medium text-[#16a34a]">
                      ✓ 1-day booking selected for {formatDateKey(startDate)}. Click any later date on the calendar to extend your reservation.
                    </p>
                  )}

                  {startDate && endDate && startDate !== endDate && !dateSelectionError && !dateValidationError && (
                    <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span>✓</span>
                        <span>{openDaysInRange.length} open day{openDaysInRange.length === 1 ? '' : 's'} selected ({formatDateKey(startDate)} – {formatDateKey(endDate)})</span>
                      </div>
                      {closedDaysInRangeCount > 0 && (
                        <p className="mt-0.5 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                          {closedDaysInRangeCount} closed date{closedDaysInRangeCount === 1 ? '' : 's'} automatically excluded from pricing.
                        </p>
                      )}
                    </div>
                  )}

                  {selectedStartAvailability?.timeRanges.length ? (
                    <p className="text-xs text-[#6e6e73] dark:text-[#A1A1AA]">Hours on {formatDateKey(startDate)}: {selectedStartAvailability.timeRanges.map((range) => `${range.from}–${range.to}`).join(', ')}</p>
                  ) : null}

                  {(dateSelectionError || dateValidationError) && (
                    <div className="flex items-start gap-2 text-xs text-[#dc2626] dark:text-rose-400 bg-[#fef2f2] dark:bg-rose-950/30 border border-[#fecaca] dark:border-rose-900/40 rounded-xl p-3">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                      <span>{dateSelectionError || dateValidationError}</span>
                    </div>
                  )}

                  {/* Teasers to AI Forecast & Continuous Route */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('forecast')}
                      className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181C] hover:bg-blue-50/40 dark:hover:bg-[#1E1E24] text-left transition cursor-pointer group shadow-2xs"
                    >
                      <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0 text-blue-600 dark:text-[#3894FF]">
                        <Sparkles size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-white">AI Congestion Forecast</span>
                          <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA] mt-0.5">
                          Hourly occupancy trends and off-peak advice
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('route')}
                      className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181C] hover:bg-emerald-50/40 dark:hover:bg-[#1E1E24] text-left transition cursor-pointer group shadow-2xs"
                    >
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                        <Compass size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-white">Continuous Station Route</span>
                          <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA] mt-0.5">
                          {calculatedWalkMinutes ? `~${calculatedWalkMinutes} min walk` : 'Walking options'} & transit to station
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* ── TAB 2: AI CONGESTION & AVAILABILITY FORECAST ── */}
              {activeTab === 'forecast' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Sparkles size={16} className="text-blue-600 dark:text-[#3894FF]" /> AI Congestion & Demand Forecast
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-[#A1A1AA] mt-0.5">
                        Predictive hourly occupancy trends and arrival advice
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('reserve')}
                      className="text-xs font-semibold text-[#007AFF] dark:text-[#0A84FF] hover:underline cursor-pointer"
                    >
                      ← Back to Reserve
                    </button>
                  </div>

                  <AiCongestionForecastCard
                    parkingSpotId={spot.parkingSpotId}
                    stationName={stationName || undefined}
                    targetName={spot.propertyName || spot.address}
                    walkDistanceMeters={walkingInfo?.rawDistance ?? Math.round((spot.distanceToStation || 0.35) * 1000)}
                    dailyRate={displayedRate}
                  />

                  <div className="pt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab('reserve')}
                      className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1E1E24] hover:bg-slate-200 dark:hover:bg-[#282830] text-slate-700 dark:text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Calendar size={14} className="text-[#007AFF]" />
                      <span>Ready to Book? Return to Booking Dates</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── TAB 3: CONTINUOUS ROUTE & MULTIMODAL JOURNEY ── */}
              {activeTab === 'route' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Compass size={16} className="text-[#007AFF] dark:text-[#0A84FF]" /> Continuous Route: Parking ➔ Station
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-[#A1A1AA] mt-0.5">
                        Walking and transit options from parking bay to {stationName ? `${stationName} Station` : 'the station entrance'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('reserve')}
                      className="text-xs font-semibold text-[#007AFF] dark:text-[#0A84FF] hover:underline cursor-pointer"
                    >
                      ← Back to Reserve
                    </button>
                  </div>

                  {multimodalPlan ? (
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-4 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Compass className="w-4 h-4 text-blue-600 dark:text-[#0A84FF]" />
                          <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                            Continuous Route: Parking ➔ Station Entrance
                          </h4>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#121214] p-0.5 rounded-lg text-[10px] font-semibold border border-transparent dark:border-white/[0.06]">
                          {(['balanced', 'less_walk', 'fastest'] as CommuterPreference[]).map((pref) => (
                            <button
                              key={pref}
                              type="button"
                              onClick={() => setPreference(pref)}
                              className={`px-2 py-0.5 rounded capitalize transition cursor-pointer ${
                                preference === pref
                                  ? 'bg-white dark:bg-[#2C2C31] text-slate-900 dark:text-white font-bold shadow-xs'
                                  : 'text-slate-500 dark:text-[#A1A1AA] hover:text-slate-800 dark:hover:text-white'
                              }`}
                            >
                              {pref.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Itinerary Options */}
                      {multimodalPlan.allItineraries.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {multimodalPlan.allItineraries.map((it) => {
                            const isSelected = it.id === (activeItineraryId || multimodalPlan.recommendedItinerary.id);
                            return (
                              <div
                                key={it.id}
                                onClick={() => setActiveItineraryId(it.id)}
                                className={`p-2.5 rounded-xl border transition cursor-pointer relative ${
                                  isSelected
                                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 dark:border-[#0071E3]/60 text-blue-950 dark:text-blue-100 shadow-xs'
                                    : 'bg-slate-50 dark:bg-[#141417] border-slate-200 dark:border-white/10 text-slate-700 dark:text-[#D4D4D8] hover:bg-slate-100 dark:hover:bg-[#1E1E22]'
                                }`}
                              >
                                {it.isRecommended && (
                                  <span className="absolute -top-2 right-2 bg-emerald-600 dark:bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider flex items-center gap-0.5 shadow-xs">
                                    <Sparkles size={8} />
                                    Optimal
                                  </span>
                                )}
                                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                                  {it.type === 'transit_feeder' ? (
                                    <Bus size={13} className="text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <Footprints size={13} className="text-blue-600 dark:text-[#0A84FF]" />
                                  )}
                                  <span>{it.title}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-[#A1A1AA] mt-1 flex items-center gap-2">
                                  <strong className="text-slate-900 dark:text-white font-semibold">~{it.totalDurationMinutes} mins</strong>
                                  <span>·</span>
                                  <span>{(it.totalWalkDistanceMeters >= 1000 ? (it.totalWalkDistanceMeters / 1000).toFixed(1) + " km" : it.totalWalkDistanceMeters + "m")} walk</span>
                                </div>
                                {it.savingsSummary && (
                                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mt-1">
                                    ✓ {it.savingsSummary}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Turn-by-turn Linear Journey */}
                      {(() => {
                        const activeIt =
                          multimodalPlan.allItineraries.find((i) => i.id === activeItineraryId) ||
                          multimodalPlan.recommendedItinerary;
                        return (
                          <div className="space-y-1.5 pt-1.5 border-t border-slate-100 dark:border-white/[0.08] text-xs">
                            <div className="text-[10px] font-bold text-slate-400 dark:text-[#A1A1AA] uppercase tracking-wider">
                              Turn-by-turn Linear Journey
                            </div>
                            {activeIt.legs.map((leg, lIdx) => (
                              <div key={lIdx} className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-[#141417] border border-slate-100 dark:border-white/[0.06]">
                                <div className="w-5 h-5 rounded-full bg-blue-600 dark:bg-[#0071E3] text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                  {lIdx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-slate-800 dark:text-white text-[11px]">{leg.title}</div>
                                  <p className="text-[10px] text-slate-500 dark:text-[#A1A1AA] mt-0.5">{leg.summary}</p>
                                  {leg.transitDetails && (
                                    <div className="mt-1 text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-medium border border-emerald-200 dark:border-emerald-800/60">
                                      Ride {leg.transitDetails.routeShortName} ({leg.transitDetails.numStops} stops) ➔ {leg.transitDetails.alightingStopName}
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 dark:text-[#8E8E93] shrink-0 font-medium">
                                  ~{leg.durationMinutes} min
                                </span>
                              </div>
                            ))}
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200 font-semibold text-xs">
                              <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>Arrive at {activeIt.targetStationEntranceName}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : isLoadingRoute ? (
                    <div className="bg-[#f8f9fa] dark:bg-[#18181C] border border-[#e8eaed] dark:border-white/10 rounded-xl p-4 flex items-center gap-3 text-[12px] text-[#5f6368] dark:text-[#A1A1AA]">
                      <Loader2 size={15} className="animate-spin text-[#007AFF] shrink-0" />
                      Calculating multimodal route via OTP engine...
                    </div>
                  ) : walkingInfo ? (
                    <div className="bg-[#f0fdf4] dark:bg-emerald-950/40 border border-[#bbf7d0] dark:border-emerald-800/60 rounded-xl p-3.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#dcfce7] flex items-center justify-center shrink-0">
                        <Navigation size={18} className="text-[#16a34a]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[#15803d] dark:text-emerald-300">
                          {walkingInfo.distanceText} &middot; {walkingInfo.durationText}
                        </p>
                        <p className="text-[11px] text-[#16a34a] dark:text-emerald-400">
                          Walking distance to {stationName || 'station'}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold bg-[#bbf7d0] text-[#15803d] px-2 py-0.5 rounded-full shrink-0">
                        OSRM Verified
                      </span>
                    </div>
                  ) : bayCoordinates ? (
                    <div className="bg-[#fefce8] dark:bg-amber-950/30 border border-[#fde68a] dark:border-amber-800/40 rounded-xl p-3 text-[12px] text-[#a16207] dark:text-amber-300 flex items-center gap-2.5">
                      <MapPin size={15} className="shrink-0" />
                      Select a station on the map to calculate multimodal route.
                    </div>
                  ) : (
                    <div className="bg-[#f8f9fa] dark:bg-[#18181C] border border-[#e8eaed] dark:border-white/10 rounded-xl p-3 text-[12px] text-[#5f6368] dark:text-[#A1A1AA] flex items-center gap-2.5">
                      <MapPin size={15} className="shrink-0" />
                      Route preview unavailable — this bay has no location data yet.
                    </div>
                  )}

                  <div className="pt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab('reserve')}
                      className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1E1E24] hover:bg-slate-200 dark:hover:bg-[#282830] text-slate-700 dark:text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Calendar size={14} className="text-[#007AFF]" />
                      <span>Ready to Book? Return to Booking Dates</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-[#e8eaed] dark:bg-white/10" />

            {/* 5. COMMUTER REVIEWS (Airbnb Style) */}
            <section id="commuter-reviews-section" aria-labelledby="parking-reviews-title" className="space-y-4 scroll-mt-20">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af] dark:text-[#A1A1AA]">Verified stays</p>
                  <h2 id="parking-reviews-title" className="mt-1 text-lg sm:text-xl font-bold text-[#111] dark:text-white flex items-center gap-2">
                    <Star size={18} className="text-[#ff9500] fill-[#ff9500]" />
                    <span>{averageRating.toFixed(1)} · {reviewMeta?.totalCount ?? reviews.length} reviews</span>
                  </h2>
                </div>
              </div>

              {/* Airbnb Review Category Pillars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-black/[0.04] dark:border-white/[0.06]">
                <div>
                  <span className="block text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">Overall rating</span>
                  <span className="block text-sm font-bold text-[#111] dark:text-white mt-0.5">{averageRating.toFixed(1)} / 5.0</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">Gate access</span>
                  <span className="block text-sm font-bold text-[#111] dark:text-white mt-0.5">5.0</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">Station transit</span>
                  <span className="block text-sm font-bold text-[#111] dark:text-white mt-0.5">4.9</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">Value</span>
                  <span className="block text-sm font-bold text-[#111] dark:text-white mt-0.5">5.0</span>
                </div>
              </div>

              {reviewsLoadError && (
                <p role="alert" className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-3 py-2.5 text-[11px] font-medium text-rose-700 dark:text-rose-300">{reviewsLoadError}</p>
              )}
              {reviewDeleteError && (
                <p role="alert" className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-3 py-2.5 text-[11px] font-medium text-rose-700 dark:text-rose-300">{reviewDeleteError}</p>
              )}

              <div className="space-y-4 pt-1">
                {isReviewsLoading && reviews.length === 0 && (
                  <div className="rounded-2xl bg-[#f8f9fa] dark:bg-[#18181C] p-8 text-center" role="status">
                    <Loader2 size={22} className="mx-auto animate-spin text-[#007AFF] dark:text-[#0A84FF]" />
                    <p className="mt-2 text-xs font-medium text-[#5f6368] dark:text-[#A1A1AA]">Loading reviews…</p>
                  </div>
                )}
                {!isReviewsLoading && reviews.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[#d2d2d7] dark:border-white/12 bg-[#f8f9fa]/50 dark:bg-[#18181C]/50 p-8 text-center">
                    <Star size={24} className="mx-auto text-[#d2d2d7] dark:text-[#71717A]" />
                    <p className="mt-2 text-sm font-semibold text-[#5f6368] dark:text-white">No reviews yet</p>
                    <p className="mt-0.5 text-xs text-[#8e8e93] dark:text-[#A1A1AA]">Completed commuters can be the first to review this parking spot.</p>
                  </div>
                )}
                {reviews.map((review) => {
                  const isEditing = reviewEditDraft?.reviewId === review.reviewId;
                  const isOwnReview = review.reviewerId !== 0 && review.reviewerId === user?.userId;
                  return (
                    <article key={review.reviewId} className="rounded-2xl bg-[#F9F9FB] dark:bg-[#18181C]/60 border border-black/[0.04] dark:border-white/[0.06] p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f0fe] dark:bg-blue-950/50 text-xs font-bold text-[#007AFF] dark:text-[#3894FF]">
                            {review.reviewerName.charAt(0)}
                          </span>
                          <div>
                            <p className="text-xs sm:text-sm font-semibold text-[#111] dark:text-white">{review.reviewerName}</p>
                            <p className="text-[10px] text-[#8e8e93] dark:text-[#A1A1AA]">Verified booking · {new Date(review.createdAt).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' })}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="mr-1 flex gap-0.5 text-[#ff9500]" aria-label={`${review.rating} out of 5 stars`}>
                            {Array.from({ length: 5 }, (_, index) => <Star key={index} size={12} fill={index < review.rating ? 'currentColor' : 'none'} className={index < review.rating ? '' : 'text-[#d2d2d7]'} />)}
                          </div>
                          {isOwnReview && !isEditing && (
                            <>
                              <button type="button" aria-label="Edit your review" title="Edit your review" onClick={() => startReviewEdit(review)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8e8e93] dark:text-[#A1A1AA] transition hover:bg-[#e8f0fe] dark:hover:bg-white/[0.08] hover:text-[#007AFF] dark:hover:text-white cursor-pointer"><Pencil size={13} /></button>
                              <button type="button" disabled={reviewDeletingId !== null} aria-label="Delete your review" title="Delete your review" onClick={() => void handleDeleteReview(review)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8e8e93] dark:text-[#A1A1AA] transition hover:bg-[#fff2f1] dark:hover:bg-rose-950/40 hover:text-[#d92d20] dark:hover:text-rose-400 disabled:cursor-wait disabled:opacity-60 cursor-pointer">{reviewDeletingId === review.reviewId ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}</button>
                            </>
                          )}
                        </div>
                      </div>

                      {isEditing && reviewEditDraft ? (
                        <div className="mt-3 space-y-3 rounded-xl bg-white dark:bg-[#121214] p-3 ring-1 ring-black/[0.06] dark:ring-white/10">
                          <fieldset>
                            <legend className="text-[11px] font-semibold text-[#5f6368] dark:text-[#A1A1AA]">Rating</legend>
                            <div className="mt-1.5 flex gap-1 text-[#ff9500]">
                              {Array.from({ length: 5 }, (_, index) => {
                                const value = index + 1;
                                return (
                                  <button key={value} type="button" disabled={isReviewUpdating} aria-label={`Set rating to ${value} star${value === 1 ? '' : 's'}`} onClick={() => { setReviewEditDraft({ ...reviewEditDraft, rating: value }); setReviewUpdateError(null); }} className="rounded-md p-1 transition hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:cursor-wait">
                                    <Star size={18} fill={value <= reviewEditDraft.rating ? 'currentColor' : 'none'} className={value <= reviewEditDraft.rating ? '' : 'text-[#d2d2d7] dark:text-[#52525B]'} />
                                  </button>
                                );
                              })}
                            </div>
                          </fieldset>
                          <div>
                            <div className="flex items-center justify-between">
                              <label htmlFor={`review-edit-${review.reviewId}`} className="text-[11px] font-semibold text-[#5f6368] dark:text-[#A1A1AA]">Comment</label>
                              <span className="text-[10px] text-[#8e8e93] dark:text-[#A1A1AA]">{reviewEditDraft.comment.length}/500</span>
                            </div>
                            <textarea id={`review-edit-${review.reviewId}`} value={reviewEditDraft.comment} maxLength={500} rows={3} disabled={isReviewUpdating} onChange={(event) => { setReviewEditDraft({ ...reviewEditDraft, comment: event.target.value }); setReviewUpdateError(null); }} className="mt-1.5 w-full resize-none rounded-2xl border border-[#d2d2d7] dark:border-white/10 bg-white dark:bg-[#18181C] text-[#111] dark:text-white p-2.5 text-[12px] leading-5 outline-none transition focus:border-[#007AFF] focus:ring-4 focus:ring-[#007AFF]/10 disabled:cursor-wait disabled:opacity-70" />
                          </div>
                          {reviewUpdateError && <p role="alert" className="rounded-lg bg-[#fff2f1] dark:bg-rose-950/40 px-3 py-2 text-[11px] font-medium text-[#d92d20] dark:text-rose-400">{reviewUpdateError}</p>}
                          <div className="flex justify-end gap-2">
                            <button type="button" disabled={isReviewUpdating} onClick={() => { setReviewEditDraft(null); setReviewUpdateError(null); }} className="min-h-8 rounded-xl px-2.5 text-[11px] font-semibold text-[#5f6368] dark:text-[#A1A1AA] hover:bg-[#f1f3f4] dark:hover:bg-[#242429] disabled:cursor-wait disabled:opacity-70 cursor-pointer">Cancel</button>
                            <button type="button" disabled={isReviewUpdating} onClick={() => void handleUpdateReview()} className="flex min-h-8 items-center gap-1.5 rounded-xl bg-[#007AFF] dark:bg-[#0071E3] px-3 text-[11px] font-semibold text-white hover:bg-[#0066d6] dark:hover:bg-[#0077ED] disabled:cursor-wait disabled:opacity-70 cursor-pointer">{isReviewUpdating && <Loader2 size={12} className="animate-spin" />}{isReviewUpdating ? 'Saving…' : 'Save changes'}</button>
                          </div>
                        </div>
                      ) : (
                        <p className="review-comment-text mt-2.5 whitespace-pre-line text-xs sm:text-[13px] leading-5 text-[#333] dark:text-[#D4D4D8]">{review.comment || 'No written comment.'}</p>
                      )}

                      {review.ownerReply && (
                        <div className="review-owner-reply-box mt-3 rounded-xl p-3 bg-slate-100/70 dark:bg-[#121214] border border-slate-200 dark:border-white/[0.08]">
                          <p className="review-owner-reply-title flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#5f6368] dark:text-[#A1A1AA]"><MessageSquare size={11} /> Owner reply</p>
                          <p className="review-owner-reply-text mt-1 text-[11px] leading-4 text-slate-700 dark:text-[#D4D4D8]">{review.ownerReply}</p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {reviewMeta && reviewMeta.totalPages > 1 && (
                <nav aria-label="Review pages" className="pt-2 flex items-center justify-between gap-3">
                  <button type="button" disabled={reviewPage <= 1 || isReviewsLoading} onClick={() => setReviewPage((current) => Math.max(1, current - 1))} className="min-h-8 rounded-lg border border-[#d2d2d7] dark:border-white/12 bg-white dark:bg-[#18181C] px-3 text-xs font-semibold text-[#5f6368] dark:text-[#A1A1AA] hover:bg-[#f8f9fa] dark:hover:bg-[#242429] dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">Previous</button>
                  <span className="text-xs font-medium text-[#8e8e93] dark:text-[#A1A1AA]">Page {reviewPage} of {reviewMeta.totalPages}</span>
                  <button type="button" disabled={reviewPage >= reviewMeta.totalPages || isReviewsLoading} onClick={() => setReviewPage((current) => Math.min(reviewMeta.totalPages, current + 1))} className="min-h-8 rounded-lg border border-[#d2d2d7] dark:border-white/12 bg-white dark:bg-[#18181C] px-3 text-xs font-semibold text-[#5f6368] dark:text-[#A1A1AA] hover:bg-[#f8f9fa] dark:hover:bg-[#242429] dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">Next</button>
                </nav>
              )}
              <p className="pt-1 flex items-center gap-1.5 text-[10px] text-[#8e8e93] dark:text-[#A1A1AA]"><ShieldCheck size={12} /> Only commuters with a completed booking can publish a review.</p>
            </section>
          </div>

          {/* ════════ RIGHT COLUMN (35% Width) - Sticky Floating Booking Card ════════ */}
          <div className="w-full lg:sticky lg:top-8">
            <div className="bg-white dark:bg-[#141417] rounded-3xl border border-black/[0.08] dark:border-white/10 shadow-xl lg:shadow-2xl p-6 sm:p-7 space-y-5 backdrop-blur-xl">
              {/* Card Header: Price per day & rating snippet */}
              <div className="flex items-baseline justify-between gap-3 pb-1 border-b border-black/[0.06] dark:border-white/[0.08]">
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-[#111] dark:text-white">
                    RM {displayedRate.toFixed(2)}
                  </span>
                  <span className="text-sm font-normal text-[#5f6368] dark:text-[#A1A1AA] ml-1">
                    / day
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#111] dark:text-white">
                  <Star size={13} className="text-[#ff9500] fill-[#ff9500]" />
                  <span>{averageRating.toFixed(1)}</span>
                  <span className="font-normal text-[#8e8e93] dark:text-[#71717A]">·</span>
                  <button
                    type="button"
                    onClick={() => document.getElementById('commuter-reviews-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="font-normal underline text-[#5f6368] dark:text-[#A1A1AA] hover:text-[#111] dark:hover:text-white cursor-pointer"
                  >
                    {reviewMeta?.totalCount ?? reviews.length} reviews
                  </button>
                </div>
              </div>

              {/* Airbnb Signature Reservation Twin-Box */}
              <div
                onClick={() => {
                  setActiveTab('reserve');
                  document.getElementById('booking-calendar-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="grid grid-cols-2 rounded-2xl border border-black/[0.12] dark:border-white/15 divide-x divide-black/[0.12] dark:divide-white/15 overflow-hidden cursor-pointer hover:border-[#007AFF] transition bg-white dark:bg-white/[0.02]"
              >
                <div className="p-3">
                  <span className="block text-[10px] font-bold text-[#6e6e73] dark:text-[#A1A1AA] uppercase tracking-wider">
                    CHECK-IN
                  </span>
                  <span className="block text-xs sm:text-[13px] font-bold text-[#111] dark:text-white mt-0.5 truncate">
                    {startDate ? formatDateKey(startDate) : 'Add date'}
                  </span>
                </div>
                <div className="p-3">
                  <span className="block text-[10px] font-bold text-[#6e6e73] dark:text-[#A1A1AA] uppercase tracking-wider">
                    CHECKOUT
                  </span>
                  <span className="block text-xs sm:text-[13px] font-bold text-[#111] dark:text-white mt-0.5 truncate">
                    {endDate ? formatDateKey(endDate) : 'Add date'}
                  </span>
                </div>
              </div>

              {/* Vehicle Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#6e6e73] dark:text-[#A1A1AA] uppercase tracking-wider">
                  VEHICLE
                </label>
                <SystemSelect
                  value={selectedVehicleId ?? ''}
                  onChange={(event) => setSelectedVehicleId(Number(event.target.value) || null)}
                  disabled={isVehiclesLoading || vehicles.length === 0}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-black/[0.12] dark:border-white/15 bg-white dark:bg-[#18181C] text-[#111] dark:text-white focus:outline-none focus:border-[#007AFF]"
                >
                  {vehicles.length === 0 && <option value="">{isVehiclesLoading ? 'Loading vehicles…' : 'No vehicles available'}</option>}
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.vehicleId} value={vehicle.vehicleId}>{vehicle.plate} · {vehicle.brand} {vehicle.model}</option>
                  ))}
                </SystemSelect>
              </div>

              {/* Price Quote Breakdown */}
              {quote && (
                <div className="space-y-2 pt-2 text-xs border-t border-black/[0.06] dark:border-white/[0.08]">
                  <div className="flex justify-between">
                    <span className="text-[#5f6368] dark:text-[#A1A1AA]">RM {quote.ratePerDay.toFixed(2)} × {quote.bookedDays} open day{quote.bookedDays === 1 ? '' : 's'}</span>
                    <span className="font-semibold text-[#111] dark:text-white">RM {quote.rentalSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5f6368] dark:text-[#A1A1AA]">10% platform fee</span>
                    <span className="font-semibold text-[#111] dark:text-white">RM {quote.platformFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-[#111] dark:text-white pt-2 border-t border-black/[0.06] dark:border-white/10">
                    <span>Total</span>
                    <span className="text-[#007AFF] dark:text-[#3894FF]">RM {quote.renterTotal.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-[#9ca3af] dark:text-[#71717A] pt-0.5">Quote expires {new Date(quote.expiresAt).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}.</p>
                </div>
              )}

              {bookingError && (
                <div className="flex items-start gap-2 text-xs text-[#dc2626] dark:text-rose-400 bg-[#fef2f2] dark:bg-rose-950/30 border border-[#fecaca] dark:border-rose-900/40 rounded-xl p-2.5">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{bookingError}</span>
                </div>
              )}

              {/* Primary Action Button */}
              <button
                onClick={handleBottomAction}
                disabled={activeTab === 'reserve' && (invalidDates || isBookingLoading || (Boolean(quote) && !selectedVehicleId))}
                className={`w-full min-h-12 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                  activeTab === 'reserve' && (invalidDates || isBookingLoading || (Boolean(quote) && !selectedVehicleId))
                    ? 'bg-[#e8eaed] dark:bg-[#242429] text-[#9ca3af] dark:text-[#71717A] cursor-not-allowed shadow-none'
                    : 'bg-[#007AFF] hover:bg-[#0066d6] dark:bg-[#0071E3] dark:hover:bg-[#0077ED] text-white active:scale-[0.98]'
                }`}
              >
                {activeTab !== 'reserve' ? (
                  <>
                    <Calendar size={16} />
                    <span>Return to Reserve Bay</span>
                  </>
                ) : isBookingLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{quote ? 'Confirming…' : 'Creating quote…'}</span>
                  </>
                ) : (
                  <>
                    <CreditCard size={16} />
                    <span>{quote ? `Confirm & Pay · RM ${quote.renterTotal.toFixed(2)}` : 'Get Booking Quote'}</span>
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-[#8e8e93] dark:text-[#71717A]">
                {quote ? 'Instant confirmation upon payment' : "You won't be charged yet"}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ── Mobile bottom fixed booking bar (Hidden on desktop screens) ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#141417]/95 border-t border-[#e8eaed] dark:border-white/10 px-4 py-3 z-40 backdrop-blur-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-[#111] dark:text-white text-sm">{displayedRate > 0 ? `RM ${displayedRate.toFixed(2)}` : 'Daily rate'} <span className="text-xs font-normal text-[#5f6368] dark:text-[#A1A1AA]">/ day</span></p>
            <p className="text-[10px] text-[#9ca3af] dark:text-[#A1A1AA] truncate">{quote ? `${quote.bookedDays} ${quote.bookedDays === 1 ? 'day' : 'days'} · RM ${quote.renterTotal.toFixed(2)}` : 'Request a quote'}</p>
          </div>
          <button
            onClick={handleBottomAction}
            disabled={activeTab === 'reserve' && (invalidDates || isBookingLoading || (Boolean(quote) && !selectedVehicleId))}
            className={`font-semibold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'reserve' && (invalidDates || isBookingLoading || (Boolean(quote) && !selectedVehicleId))
                ? 'bg-[#e8eaed] dark:bg-[#242429] text-[#9ca3af] dark:text-[#71717A] cursor-not-allowed'
                : 'bg-[#007AFF] dark:bg-[#0071E3] text-white hover:bg-[#0066d6] dark:hover:bg-[#0077ED] active:scale-[0.98] cursor-pointer shadow-sm'
            }`}
          >
            {activeTab !== 'reserve' ? (
              <>
                <Calendar size={14} />
                <span>Return</span>
              </>
            ) : isBookingLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>{quote ? 'Confirming…' : 'Creating…'}</span>
              </>
            ) : (
              <>
                <CreditCard size={14} />
                <span>{quote ? `Pay · RM ${quote.renterTotal.toFixed(2)}` : 'Get Quote'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
