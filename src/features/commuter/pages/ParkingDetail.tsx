import { formatHostingDuration } from '../lib/hostingDuration';
import { parseTimestamp, displayDateOptions } from '@/lib/dateTime';
import { useEffect, useMemo, useRef, useState } from 'react';
import SystemSelect from '@/components/ui/SystemSelect';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Navigation, ShieldCheck,
  Car, CreditCard,
  Loader2, Calendar, AlertTriangle,
  Heart, Check,
  ChevronLeft, ChevronRight, MessageSquare, Pencil, Star, Trash2,
  Share2, Flag, X, LayoutGrid, RotateCcw, Clock, Lock,
} from 'lucide-react';
import { BookingReceipt, confirmBookingCancellation } from '../components/BookingReceipt';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/features/auth/context/AuthContext';
import { showAlert, showConfirm } from '@/components/common/ModalProvider';
import type { Booking, ParkingSpot, PublicParkingSpotImage } from '../types';
import { clearJourneySession, loadJourneySession, saveJourneySession } from '../lib/journeySession';
import { getWalkingRoute } from '@/services/walkingRoutes';
import {
  planMultimodalJourney,
  MultimodalPlanResult,
  CommuterPreference,
} from '@/services/multimodalRoutingService';
import { Bus, Footprints, Sparkles, Compass, CheckCircle2, Zap, Umbrella, Accessibility, Video } from 'lucide-react';
import { getPublicParkingSpot } from '../api/parkingApi';
import { AiCongestionForecastCard } from '../components/AiCongestionForecastCard';
import { GracePeriodRoadAnimation } from '../components/GracePeriodRoadAnimation';
import {
  calculateWalkingMinutes,
  resolveCanonicalStation,
  resolveSpotStationWalkMetrics,
} from '@/services/pedestrianWalkingService';
import { getTransitStops } from '@/services/gtfsApi';
import {
  cancelBooking,
  confirmBooking,
  createBookingQuote,
  evaluateBookingCancellationEligibility,
  getBookingAvailability,
  type BookingAvailabilityResponse,
  type BookingQuote,
  type ConfirmedBooking,
} from '../api/bookingApi';
import { getFavoriteParking, updateFavoriteParking } from '../api/favoriteApi';
import { deleteReview, getParkingReviews, updateReview, reportReview } from '../api/reviewApi';
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
import {
  dateFromIsoKey,
  findNearestAvailableDate,
  formatIsoDateShort,
  getDatesBetween,
  getMonthsBetween,
  isDateAvailableInMap,
  isValidIsoDateKey,
  toIsoDateKey,
  validateBookingDateRange,
  validateQuoteMatchesSelection,
} from '../lib/bookingDateValidation';

/* ================================================================
   ParkingDetail — Parking spot detail page
   Design: Apple/Google style — clean whitespace, single blue accent, no gradients
   ================================================================ */

// ── Types ──
type DetailTab = 'reserve' | 'forecast' | 'route';
interface MockParkingSpot extends ParkingSpot {
  description?: string | null;
  createdAt?: string | number | null;
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
  images?: PublicParkingSpotImage[];
  allPhotos?: string[];
}
interface WalkingInfo {
  distanceText: string;
  durationText: string;
  rawDistance: number;
  durationMinutes?: number;
}


const REVIEW_PAGE_SIZE = 10;

const toDateInput = toIsoDateKey;

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

const dateFromKey = dateFromIsoKey;

const formatDateKey = formatIsoDateShort;

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
  const isMobile = useIsMobile();
  const { id: routeId } = useParams<{ id: string }>();
  const { user, isGuest, promptLogin, logout } = useAuth();
  const { state } = useLocation() as {
    state?: {
      spot?: MockParkingSpot;
      stationCoords?: { lat: number; lon: number } | null;
      stationName?: string;
      /** Dates proposed by ParkJom Copilot; validated by the normal availability rules below. */
      copilotPrefill?: { startDate: string; endDate: string };
    };
  };

  const [fetchedSpot, setFetchedSpot] = useState<{ routeId: string; spot: MockParkingSpot } | null>(null);
  const [fetchSpotError, setFetchSpotError] = useState<string | null>(null);

  const rawRouteId = routeId ? String(routeId).trim() : '';
  const cleanSpotId = rawRouteId.replace(/^spot-/, '');

  const stateSpotMatchesRoute = Boolean(
    state?.spot && (
      String(state.spot.parkingSpotId) === cleanSpotId ||
      String(state.spot.id) === rawRouteId ||
      String(state.spot.id) === cleanSpotId
    ),
  );
  const [isFetchingSpot, setIsFetchingSpot] = useState(Boolean(cleanSpotId && !stateSpotMatchesRoute));
  const routeSpot = fetchedSpot?.routeId === cleanSpotId ? fetchedSpot.spot : null;
  const spot = routeSpot ?? (stateSpotMatchesRoute ? state?.spot ?? null : null);
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
    const originHint =
      spot && (spot.lat || spot.latitude) && (spot.lon || spot.lng || spot.longitude)
        ? {
            lat: Number(spot.lat || spot.latitude),
            lng: Number(spot.lon || spot.lng || spot.longitude),
          }
        : null;
    const canonical = resolveCanonicalStation(stationName, originHint, {
      lat: stateStationCoords?.lat ?? spot?.stationLatitude,
      lon: stateStationCoords?.lon ?? spot?.stationLongitude,
    });
    if (canonical) {
      setResolvedStationCoords({ lat: canonical.lat, lon: canonical.lng });
      return;
    }
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
  }, [
    stateStationCoords?.lat,
    stateStationCoords?.lon,
    spot?.lat,
    spot?.latitude,
    spot?.lon,
    spot?.lng,
    spot?.longitude,
    spot?.stationLatitude,
    spot?.stationLongitude,
    stationName,
  ]);

  const [walkingInfo, setWalkingInfo] = useState<WalkingInfo | null>(null);
  const [multimodalPlan, setMultimodalPlan] = useState<MultimodalPlanResult | null>(null);
  const [preference, setPreference] = useState<CommuterPreference>('balanced');
  const [activeItineraryId, setActiveItineraryId] = useState<string>('');
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  useEffect(() => {
    if (!cleanSpotId) return;
    const controller = new AbortController();
    setIsFetchingSpot(!stateSpotMatchesRoute);
    setFetchSpotError(null);
    getPublicParkingSpot(cleanSpotId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const d = result.data;
        const rawImages = d.images || [];
        const imageUrls = rawImages
          .map((img: any) => img.secureUrl || (img.mediaFileId ? `/api/media/view/image/${img.mediaFileId}` : ''))
          .filter(Boolean);
        const primaryImg =
          imageUrls[0] ||
          d.images?.[0]?.secureUrl ||
          (d.images?.[0]?.mediaFileId ? `/api/media/view/image/${d.images[0].mediaFileId}` : '') || null;
        const latitude = d.latitude ?? 0;
        const longitude = d.longitude ?? 0;
        const hasCoordinates = latitude !== 0 || longitude !== 0;
        const walkMetrics = resolveSpotStationWalkMetrics({
          latitude,
          longitude,
          stationName: d.stationName,
          stationLatitude: d.stationLatitude,
          stationLongitude: d.stationLongitude,
          rawDistanceToStationMeters: d.distanceToStationMeters,
          rawTimeToStationInMinutes: d.timeToStationInMinutes,
        });
        const mockSpot: MockParkingSpot = {
          id: String(d.parkingSpotId),
          parkingSpotId: d.parkingSpotId,
          parkingLabel: d.parkingLabel || 'Bay',
          propertyId: d.propertyId,
          propertyName: d.propertyName,
          description: d.description,
          address: d.address,
          latitude,
          longitude,
          lat: latitude,
          lng: longitude,
          lon: longitude,
          hasCoordinates,
          stationName: d.stationName ?? '',
          stationLatitude: walkMetrics.stationCoords?.lat ?? d.stationLatitude ?? null,
          stationLongitude: walkMetrics.stationCoords?.lng ?? d.stationLongitude ?? null,
          distanceToStation: walkMetrics.distanceToStationKm,
          timeToStationInMinutes: walkMetrics.timeToStationInMinutes,
          availabilityStatus: String(d.availabilityStatus),
          monthlyRate: d.monthlyRate,
          dailyRate: d.dailyRate,
          primaryImageUrl: primaryImg,
          photoUrl: primaryImg,
          images: d.images,
          allPhotos: imageUrls,
          price: d.dailyRate ?? (d.monthlyRate ? Number((d.monthlyRate / 30).toFixed(2)) : 0),
          station: d.stationName ?? '',
          name: d.propertyName || d.address,
          pricePerHour: d.dailyRate ?? 0,
          distance: walkMetrics.distanceToStationMeters,
          available: d.isPublished,
          type: 'Condo Bay',
          owner: d.ownerName || 'Bay Owner',
          createdAt: d.createdAt,
        };
        setFetchedSpot({ routeId: cleanSpotId, spot: mockSpot });
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
  }, [cleanSpotId, stateSpotMatchesRoute]);

  // ── Booking ──
  const today = new Date();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(addDays(new Date(), 1)));
  const [availabilityByMonth, setAvailabilityByMonth] = useState<Record<string, BookingAvailabilityResponse>>({});
  const [availabilityRetryKey, setAvailabilityRetryKey] = useState(0);
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [dateSelectionError, setDateSelectionError] = useState<string | null>(null);
  const [pendingCopilotPrefill, setPendingCopilotPrefill] = useState<{ startDate: string; endDate: string } | null>(null);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(false);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingNotice, setBookingNotice] = useState<string | null>(null);
  const [isGracePeriodActive, setIsGracePeriodActive] = useState(false);
  const [graceProgress, setGraceProgress] = useState(0);
  const [graceSecondsLeft, setGraceSecondsLeft] = useState(7);
  const [isFinalizingBooking, setIsFinalizingBooking] = useState(false);
  const graceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const graceStartTimeRef = useRef<number>(0);
  const activeVehicle = useMemo(() => vehicles.find((item) => item.vehicleId === selectedVehicleId), [vehicles, selectedVehicleId]);
  const [reservationReady, setReservationReady] = useState(false);
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
  const [reportingReview, setReportingReview] = useState<ParkingReview | null>(null);
  const [reportReason, setReportReason] = useState('Inappropriate or offensive language');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
  const hideFailedPhoto = (url: string) => {
    setGalleryIndex(null);
    setFailedPhotos((current) => current.includes(url) ? current : [...current, url]);
  };

  const displayPhotos = useMemo(() => {
    const extracted: string[] = [];
    if (spot) {
      if (spot.allPhotos && Array.isArray(spot.allPhotos)) {
        spot.allPhotos.forEach((p) => {
          if (p && typeof p === 'string' && p.trim() && !extracted.includes(p.trim())) {
            extracted.push(p.trim());
          }
        });
      }
      if (spot.images && Array.isArray(spot.images)) {
        spot.images.forEach((img: any) => {
          const url = typeof img === 'string' ? img : (img?.secureUrl || (img?.mediaFileId ? `/api/media/view/image/${img.mediaFileId}` : ''));
          if (url && typeof url === 'string' && url.trim() && !extracted.includes(url.trim())) {
            extracted.push(url.trim());
          }
        });
      }
      const primary = spot.primaryImageUrl || spot.photoUrl;
      if (primary && typeof primary === 'string' && primary.trim() && !extracted.includes(primary.trim())) {
        extracted.unshift(primary.trim());
      }
    }
    return extracted.filter((url) => !failedPhotos.includes(url));
  }, [spot, failedPhotos]);

  useEffect(() => {
    if (galleryIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGalleryIndex(null);
      if (e.key === 'ArrowLeft') {
        setGalleryIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : displayPhotos.length - 1));
      }
      if (e.key === 'ArrowRight') {
        setGalleryIndex((prev) => (prev !== null && prev < displayPhotos.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [galleryIndex, displayPhotos.length]);
  const averageRating = reviewMeta?.averageRating ?? (reviews.length
    ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
    : 0);
  const totalReviewCount = reviewMeta?.totalCount ?? reviews.length;

  // `0,0` is the placeholder used when the API omits coordinates, so treat it
  // as "unknown" rather than as a real bay in the Gulf of Guinea.
  const bayCoordinates = (() => {
    if (!spot || spot.hasCoordinates === false) return null;
    const lat = spot.lat || spot.latitude || 0;
    const lng = spot.lon || spot.lng || spot.longitude || 0;
    return lat && lng ? { lat, lng } : null;
  })();

  const calculatedWalkMinutes = useMemo(() => {
    const directWalkItinerary = multimodalPlan?.allItineraries.find(
      (it) => it.type === 'direct_walk',
    );
    if (directWalkItinerary?.totalDurationMinutes) {
      return directWalkItinerary.totalDurationMinutes;
    }
    if (walkingInfo?.durationMinutes) {
      return walkingInfo.durationMinutes;
    }
    if (spot?.timeToStationInMinutes && spot.timeToStationInMinutes > 0) {
      return Math.round(spot.timeToStationInMinutes);
    }
    if (spot && spot.distanceToStation > 0) {
      return calculateWalkingMinutes(spot.distanceToStation * 1000, { isStationDestination: true });
    }
    return null;
  }, [
    multimodalPlan,
    walkingInfo?.durationMinutes,
    spot?.distanceToStation,
    spot?.timeToStationInMinutes,
  ]);

  useEffect(() => {
    if (!bayCoordinates || !resolvedStationCoords) {
      setWalkingInfo(null);
      setIsLoadingRoute(false);
      return;
    }
    setIsLoadingRoute(true);
    getWalkingRoute(
      bayCoordinates.lat,
      bayCoordinates.lng,
      resolvedStationCoords.lat,
      resolvedStationCoords.lon,
      stationName,
    )
      .then(setWalkingInfo)
      .finally(() => setIsLoadingRoute(false));
  }, [
    bayCoordinates?.lat,
    bayCoordinates?.lng,
    resolvedStationCoords?.lat,
    resolvedStationCoords?.lon,
    stationName,
  ]);

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
    const spotId = spot?.parkingSpotId;
    if (!spotId) return;
    if (!user?.token) {
      setIsAvailabilityLoading(false);
      setAvailabilityError(null);
      return;
    }

    const monthsSet = new Set<string>([toMonthInput(calendarMonth)]);
    if (startDate && endDate && endDate >= startDate) {
      for (const spannedMonth of getMonthsBetween(startDate, endDate).slice(0, 3)) {
        monthsSet.add(spannedMonth);
      }
    }
    if (pendingCopilotPrefill) {
      for (const spannedMonth of getMonthsBetween(pendingCopilotPrefill.startDate, pendingCopilotPrefill.endDate).slice(0, 3)) {
        monthsSet.add(spannedMonth);
      }
    }

    const missingMonths = [...monthsSet].filter((month) => !availabilityByMonth[month]);
    if (missingMonths.length === 0) return;

    const controller = new AbortController();
    setIsAvailabilityLoading(true);
    setAvailabilityError(null);
    void Promise.all(
      missingMonths.map(async (month) => {
        const result = await getBookingAvailability(user.token, spotId, month, controller.signal);
        return { requestedMonth: month, result };
      }),
    )
      .then((entries) => {
        if (controller.signal.aborted) return;
        setAvailabilityByMonth((current) => {
          const next = { ...current };
          for (const { requestedMonth, result } of entries) {
            next[result.month || requestedMonth] = result;
          }
          return next;
        });
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
  }, [availabilityByMonth, availabilityRetryKey, calendarMonth, endDate, pendingCopilotPrefill, spot?.parkingSpotId, startDate, user?.token]);

  useEffect(() => {
    setAvailabilityByMonth({});
    setAvailabilityError(null);
    setDateSelectionError(null);
    setPendingCopilotPrefill(null);
    setStartDate('');
    setEndDate('');
    setQuote(null);
    setBookingError(null);
    setCalendarMonth(startOfMonth(addDays(new Date(), 1)));
  }, [spot?.parkingSpotId]);

  // Capture Copilot-proposed dates once per spot, then validate after availability loads.
  useEffect(() => {
    const prefill = state?.copilotPrefill;
    if (!spot || !prefill) return;
    const key = `${spot.parkingSpotId}:${prefill.startDate}:${prefill.endDate}`;
    if (appliedPrefillRef.current === key) return;
    if (!isValidIsoDateKey(prefill.startDate) || !isValidIsoDateKey(prefill.endDate)) return;
    appliedPrefillRef.current = key;
    setCalendarMonth(startOfMonth(dateFromKey(prefill.startDate)));
    setPendingCopilotPrefill(prefill);
  }, [spot?.parkingSpotId, state?.copilotPrefill]);

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
    if (isGuest || !user?.userId || !user?.token) {
      promptLogin('Save to Favorites', 'Sign in to save this bay to your favorites for fast rebooking.');
      return;
    }
    if (!spot || isFavoriteLoading || isFavoriteUpdating) return;

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
            photos: review.photos ?? cachedReview?.photos ?? [],
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
        photos: result.data.photos ?? existingReview.photos,
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

  const handleReportReview = async () => {
    if (!reportingReview || !user?.token || isSubmittingReport) return;
    setIsSubmittingReport(true);
    setReportStatus(null);
    try {
      const res = await reportReview(user.token, reportingReview.reviewId, {
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
      setIsSubmittingReport(false);
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

  const isDateAvailable = (dateKey: string) =>
    isDateAvailableInMap(dateKey, availabilityByMonth, minimumBookingDate);

  useEffect(() => {
    if (!spot || !pendingCopilotPrefill) return;
    if (!user?.token) {
      setPendingCopilotPrefill(null);
      return;
    }
    if (availabilityError) {
      setPendingCopilotPrefill(null);
      return;
    }

    const spannedMonths = getMonthsBetween(pendingCopilotPrefill.startDate, pendingCopilotPrefill.endDate);
    const requiredMonths = spannedMonths.length > 0
      ? spannedMonths.slice(0, 3)
      : [pendingCopilotPrefill.startDate.slice(0, 7)];
    if (!requiredMonths.every((month) => Boolean(availabilityByMonth[month]))) {
      return;
    }

    const prefill = pendingCopilotPrefill;
    setPendingCopilotPrefill(null);
    setQuote(null);
    setBookingError(null);
    idempotencyKeyRef.current = null;

    const validation = validateBookingDateRange({
      startDate: prefill.startDate,
      endDate: prefill.endDate,
      availabilityByMonth,
      minimumBookingDate,
    });

    if (validation.isValid) {
      setStartDate(prefill.startDate);
      setEndDate(prefill.endDate);
      setDateSelectionError(null);
      return;
    }

    setStartDate('');
    setEndDate('');
    const prefillLabel = prefill.startDate === prefill.endDate
      ? formatDateKey(prefill.startDate)
      : `${formatDateKey(prefill.startDate)} – ${formatDateKey(prefill.endDate)}`;
    const nextOpen = findNearestAvailableDate(availabilityByMonth, prefill.startDate, minimumBookingDate);
    setDateSelectionError(
      `Copilot suggested ${prefillLabel}, which is not available.${
        nextOpen
          ? ` Next available date: ${formatDateKey(nextOpen)}.`
          : ' Please choose an available date below.'
      }`,
    );
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('booking-calendar-section')?.scrollIntoView({
      behavior: reduceMotion ? 'instant' : 'smooth',
    });
  }, [availabilityByMonth, availabilityError, minimumBookingDate, pendingCopilotPrefill, spot?.parkingSpotId, user?.token]);

  const rangeValidation = useMemo(
    () => validateBookingDateRange({
      startDate,
      endDate,
      availabilityByMonth,
      minimumBookingDate,
    }),
    [availabilityByMonth, endDate, minimumBookingDate, startDate],
  );

  const openDaysInRange = rangeValidation.openDates;

  // Clean up grace period timer on unmount
  useEffect(() => {
    return () => {
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
    };
  }, []);

  if (isFetchingSpot || !spot) {
    return (
      <div className="app-workspace">
        <DashboardHeader
          role="commuter"
          user={user}
          onSignOut={() => { logout(); navigate('/'); }}
          onSignIn={() => navigate('/login')}
          isGuest={Boolean(isGuest || !user)}
          onBrandClick={() => navigate('/commuter?tab=home')}
        />
        <main className="workspace-frame py-8">
          <header className="workspace-heading"><h1>Parking details</h1></header>
          <div className="workspace-panel p-6">
            {isFetchingSpot ? (
              <p role="status" className="flex items-center gap-2 text-muted-foreground">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" /> Loading parking details…
              </p>
            ) : (
              <>
                <p role="alert">{fetchSpotError || 'This parking spot could not be found.'}</p>
                <button type="button" onClick={() => navigate('/commuter?tab=home')} className="workspace-button workspace-button--secondary mt-4">Browse parking</button>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  const invalidDates = !rangeValidation.isValid
    || isAvailabilityLoading
    || rangeValidation.isLoadingMonths
    || Boolean(availabilityError);
  const showChooseDates = isMobile && !isBookingLoading && (activeTab !== 'reserve' || invalidDates);
  const bottomBookingUnavailable = activeTab === 'reserve' && !showChooseDates
    && (invalidDates || isBookingLoading || (Boolean(quote) && !selectedVehicleId));
  const displayedRate = quote?.ratePerDay ?? spot.dailyRate ?? 0;
  const hostingDuration = formatHostingDuration(spot.createdAt);
  const displayedTotal = quote?.rentalSubtotal ?? 0;

  const dateValidationError = rangeValidation.error;

  const clearSelectedDates = () => {
    setStartDate('');
    setEndDate('');
    setQuote(null);
    setBookingError(null);
    setDateSelectionError(null);
    idempotencyKeyRef.current = null;
  };

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

    if (!isDateAvailable(rawDateKey)) {
      setDateSelectionError(`${formatDateKey(rawDateKey)} is unavailable for booking.`);
      return;
    }

    if (!startDate) {
      setStartDate(rawDateKey);
      setEndDate('');
      return;
    }

    if (!endDate || (startDate === endDate && rawDateKey > startDate)) {
      if (rawDateKey >= startDate) {
        const candidate = validateBookingDateRange({
          startDate,
          endDate: rawDateKey,
          availabilityByMonth,
          minimumBookingDate,
        });
        if (candidate.unavailableDates.length > 0) {
          const firstBlocked = formatDateKey(candidate.unavailableDates[0]);
          setDateSelectionError(
            `${formatDateKey(startDate)} – ${formatDateKey(rawDateKey)} includes unavailable date (${firstBlocked}). Starting a new selection from ${formatDateKey(rawDateKey)}.`,
          );
          setStartDate(rawDateKey);
          setEndDate('');
          return;
        }
        if (!candidate.isValid && !candidate.isLoadingMonths && candidate.error) {
          setDateSelectionError(candidate.error);
          return;
        }
        setEndDate(rawDateKey);
        return;
      }
      setStartDate(rawDateKey);
      setEndDate('');
      return;
    }

    setStartDate(rawDateKey);
    setEndDate('');
  };

  const handleBottomAction = () => {
    if (isGuest || !user?.token) {
      promptLogin('Reserve Parking Bay', 'Sign in to select dates, book this parking bay, and receive automated gate access clearance.');
      return;
    }
    if (showChooseDates) {
      setActiveTab('reserve');
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('booking-calendar-section')?.scrollIntoView({
        behavior: reduceMotion ? 'instant' : 'smooth',
      });
      return;
    }
    if (activeTab !== 'reserve') {
      setActiveTab('reserve');
      window.scrollTo({ top: 320, behavior: 'smooth' });
      return;
    }
    void handleBook();
  };

  const GRACE_PERIOD_DURATION_MS = 7000; // 7 seconds

  const handleCancelGracePeriod = () => {
    if (graceTimerRef.current) {
      clearInterval(graceTimerRef.current);
      graceTimerRef.current = null;
    }
    setIsGracePeriodActive(false);
    setIsBookingLoading(false);
    setIsFinalizingBooking(false);
    setBookingNotice('Order cancelled. You have not been charged.');
  };

  const executeConfirmBooking = async () => {
    if (!user?.token || !quote) {
      setIsGracePeriodActive(false);
      setIsBookingLoading(false);
      setIsFinalizingBooking(false);
      return;
    }

    try {
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
        bookingReference: confirmation.data.bookingReference,
        bookedDays: quote.bookedDays,
        ratePerDay: quote.ratePerDay,
        platformFee: quote.platformFee,
        rentalSubtotal: quote.rentalSubtotal,
        createdAt: confirmation.data.createdAt,
        spot: parkingSpot,
        startTime: new Date(`${quote.startDate}T00:00:00`),
        endTime: new Date(`${quote.endDate}T00:00:00`),
        vehiclePlate: vehicle?.plate ?? '',
        status: 'Upcoming',
        totalPaid: quote.renterTotal,
      };

      const currentSession = loadJourneySession(user.userId);
      if (!currentSession || parseTimestamp(currentSession.booking.endTime) <= new Date() || parseTimestamp(booking.startTime) <= parseTimestamp(currentSession.booking.startTime)) {
        saveJourneySession(booking, 'reserved', user.userId);
      }
      setIsGracePeriodActive(false);
      setReservationReady(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete this booking.';
      setIsGracePeriodActive(false);
      setBookingError(message);
      if (/no longer available|already booked|conflict|expired|period/i.test(message)) {
        setQuote(null);
        idempotencyKeyRef.current = null;
        setAvailabilityByMonth({});
      }
    } finally {
      setIsBookingLoading(false);
      setIsFinalizingBooking(false);
    }
  };

  const startGracePeriodBooking = () => {
    if (!user?.token || !quote) return;
    if (!selectedVehicleId) {
      setBookingError('Select a vehicle before confirming this booking.');
      return;
    }
    const quoteError = validateQuoteMatchesSelection(quote, startDate, endDate, openDaysInRange.length);
    if (quoteError) {
      setQuote(null);
      setBookingError(quoteError);
      return;
    }

    setBookingError(null);
    setBookingNotice(null);
    setIsGracePeriodActive(true);
    setGraceProgress(0);
    setGraceSecondsLeft(7);
    setIsFinalizingBooking(false);

    const startTime = Date.now();
    graceStartTimeRef.current = startTime;

    if (graceTimerRef.current) clearInterval(graceTimerRef.current);

    graceTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progressPercent = Math.min(100, (elapsed / GRACE_PERIOD_DURATION_MS) * 100);
      const remainingSeconds = Math.max(0, Math.ceil((GRACE_PERIOD_DURATION_MS - elapsed) / 1000));

      setGraceProgress(progressPercent);
      setGraceSecondsLeft(remainingSeconds);

      if (elapsed >= GRACE_PERIOD_DURATION_MS) {
        if (graceTimerRef.current) {
          clearInterval(graceTimerRef.current);
          graceTimerRef.current = null;
        }
        setIsFinalizingBooking(true);
        void executeConfirmBooking();
      }
    }, 40);
  };

  const handleBook = async () => {
    if (isGuest || !user?.token) {
      promptLogin('Reserve Parking Bay', 'Sign in to select dates, book this parking bay, and receive automated gate access clearance.');
      return;
    }
    if (!rangeValidation.isValid) {
      setBookingError(rangeValidation.error || 'Select consecutive available dates before requesting a quote.');
      return;
    }
    if (invalidDates || isBookingLoading || isGracePeriodActive) return;
    setBookingError(null);
    setBookingNotice(null);

    // If quote is not generated yet, get quote first
    if (!quote) {
      setIsBookingLoading(true);
      try {
        const result = await createBookingQuote(user.token, spot.parkingSpotId, { startDate, endDate });
        const quoteMismatch = validateQuoteMatchesSelection(
          result.data,
          startDate,
          endDate,
          rangeValidation.openDates.length,
        );
        if (quoteMismatch) {
          const spanned = getMonthsBetween(startDate, endDate);
          setAvailabilityByMonth((current) => {
            const next = { ...current };
            for (const month of spanned) delete next[month];
            return next;
          });
          setBookingError(quoteMismatch);
          return;
        }
        setQuote(result.data);
      } catch (error) {
        setBookingError(error instanceof Error ? error.message : 'Unable to create booking quote.');
      } finally {
        setIsBookingLoading(false);
      }
      return;
    }

    // Quote already present: User clicks "Confirm & Pay" -> Start Zus Coffee Grace Period!
    startGracePeriodBooking();
  };

  async function cancelConfirmedBooking() {
    if (!user?.token || !confirmedBooking || isCancelling) return;
    setIsCancelling(true);
    try {
      if (!await confirmBookingCancellation()) return;
      const response = await cancelBooking(user.token, { bookingId: confirmedBooking.bookingId, cancellationReason: 'Cancelled by commuter' });
      const session = loadJourneySession(user.userId);
      if (session?.booking.bookingId === confirmedBooking.bookingId) clearJourneySession(user.userId);
      setConfirmedBooking({ ...confirmedBooking, bookingStatus: 'Cancelled' });
      void showAlert({ title: 'Booking cancelled', message: response.message, variant: 'success' });
    } catch (error) {
      void showAlert({ title: 'Could not cancel booking', message: error instanceof Error ? error.message : 'Try again later.', variant: 'danger' });
    } finally {
      setIsCancelling(false);
    }
  }

  if (reservationReady) {
    const status = confirmedBooking?.bookingStatus || 'Confirmed';
    const canUsePass = ['confirmed', 'active'].includes(status.toLowerCase());
    const cancellation = confirmedBooking && status.toLowerCase() === 'confirmed'
      ? evaluateBookingCancellationEligibility({ status: 'Upcoming', createdAt: confirmedBooking.createdAt }) : null;
    const latitude = spot.lat || spot.latitude;
    const longitude = spot.lng || spot.longitude;
    return (
      <div className="page-shell min-h-screen text-foreground">
        <DashboardHeader role="commuter" user={user}
          onSignOut={() => { logout(); navigate('/'); }}
          onBrandClick={() => navigate('/commuter?tab=home', { replace: true })} />
        <BookingReceipt
          backLabel="Back to dashboard"
          onBack={() => navigate('/commuter?tab=home')}
          onParkingPass={canUsePass ? () => navigate('/commuter?tab=active') : undefined}
          onCancel={cancellation?.canCancel ? () => void cancelConfirmedBooking() : undefined}
          cancelling={isCancelling}
          cancellationUnavailableReason={cancellation?.reason}
          data={{
            title: spot.propertyName || spot.name || spot.address, status,
            photo: displayPhotos[0], bay: spot.parkingLabel, station: stationName || spot.station,
            startDate: quote?.startDate || '—', endDate: quote?.endDate || '—',
            days: quote?.bookedDays, rate: quote?.ratePerDay, total: quote?.renterTotal ?? 0,
            reference: confirmedBooking?.bookingReference,
            plate: vehicles.find(vehicle => vehicle.vehicleId === selectedVehicleId)?.plate,
            address: spot.address,
            platformFee: quote?.platformFee,
            directions: latitude && longitude || spot.address ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(latitude && longitude ? latitude + ',' + longitude : spot.address) : undefined,
          }}
        />
      </div>
    );
  }

  return (
    <div className="parking-detail-workspace app-workspace page-shell min-h-screen pb-24 lg:pb-16">
      <DashboardHeader
        role="commuter"
        user={user}
        onSignOut={() => { logout(); navigate('/'); }}
        onSignIn={() => navigate('/login')}
        isGuest={Boolean(isGuest || !user)}
        onBrandClick={() => navigate('/commuter', { replace: true, state: { activeTab: 'home' } })}
      />

      <main className="parking-detail-content w-[92vw] max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 pt-4 pb-12">
        <nav className="mb-4" aria-label="Parking navigation">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => stateSpotMatchesRoute ? navigate(-1) : navigate('/commuter?tab=home')}
              className="inline-flex min-h-10 items-center gap-1.5 text-xs font-medium text-[#6e6e73] transition-colors hover:text-[#111] dark:text-[#A1A1AA] dark:hover:text-white sm:text-[13px] cursor-pointer"
            >
              <ArrowLeft size={16} aria-hidden="true" /> Back to parking
            </button>

            <div className="flex shrink-0 items-center gap-1" aria-label="Parking actions">
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#5f6368] transition-colors hover:bg-black/[0.04] dark:text-[#A1A1AA] dark:hover:bg-white/[0.06] cursor-pointer"
              >
                {isLinkCopied ? <Check size={15} className="text-[#34C759]" aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />}
                <span>{isLinkCopied ? 'Copied!' : 'Share'}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleToggleFavorite()}
                disabled={isFavoriteLoading || isFavoriteUpdating}
                aria-pressed={isFavorite}
                className={'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:cursor-wait disabled:opacity-60 cursor-pointer ' + (isFavorite ? 'text-rose-500 dark:text-rose-400' : 'text-[#5f6368] dark:text-[#A1A1AA]')}
              >
                {isFavoriteLoading || isFavoriteUpdating
                  ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  : <Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />}
                <span>{isFavorite ? 'Saved' : 'Save'}</span>
              </button>
            </div>
          </div>

        </nav>

        <section className="mb-6" aria-labelledby="parking-detail-title">
          <div className="space-y-3">
            <h1 id="parking-detail-title" className="parking-detail-title max-w-5xl break-words text-[#111] dark:text-white">
              {spot.propertyName || spot.name || spot.address}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#6e6e73] dark:text-[#A1A1AA] sm:text-[13px]">
              {totalReviewCount > 0 ? (
                <button
                  type="button"
                  onClick={() => document.getElementById('commuter-reviews-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center gap-1.5 hover:text-[#111] dark:hover:text-white cursor-pointer"
                >
                  <Star size={14} className="fill-[#ff9500] text-[#ff9500]" aria-hidden="true" />
                  <span className="font-semibold text-[#111] dark:text-white">{averageRating.toFixed(1)}</span>
                  <span className="underline underline-offset-2">({totalReviewCount} {totalReviewCount === 1 ? 'review' : 'reviews'})</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5"><Star size={14} aria-hidden="true" /> New listing</span>
              )}
              {(calculatedWalkMinutes != null || stationName) && (
                <div className="inline-flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Footprints size={15} className="shrink-0" aria-hidden="true" />
                    <span>{calculatedWalkMinutes != null ? calculatedWalkMinutes + ' min walk to ' + (stationName || 'the station') : 'Near ' + stationName}</span>
                  </span>
                  {calculatedWalkMinutes != null && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('route');
                        document.getElementById('booking-calendar-section')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="font-medium text-[#007AFF] underline underline-offset-2 hover:text-[#0066d6] dark:text-[#64a8ff] dark:hover:text-[#90c2ff] cursor-pointer"
                      aria-label="View route to the station"
                    >
                      View route
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

        </section>

        {displayPhotos.length > 0 ? (
          <section aria-label="Parking photos" className={`mb-6 grid gap-2 ${displayPhotos.length > 1 ? 'sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}`}>
            <button type="button" className="workspace-panel relative h-56 overflow-hidden sm:h-80" onClick={() => setGalleryIndex(0)} aria-label={`View parking photos (1 of ${displayPhotos.length})`}>
              <img src={displayPhotos[0]} alt="" className="h-full w-full object-cover" onError={() => hideFailedPhoto(displayPhotos[0])} />
              <span className="absolute bottom-3 right-3 rounded-lg bg-black/75 px-2.5 py-1 text-sm text-white">
                {displayPhotos.length === 1 ? 'View photo' : `View ${displayPhotos.length} photos`}
              </span>
            </button>
            {displayPhotos.length > 1 && (
              <div className="hidden h-80 gap-2 sm:grid">
                {displayPhotos.slice(1, 3).map((url, index) => (
                  <button key={url} type="button" className="workspace-panel min-h-0 overflow-hidden" onClick={() => setGalleryIndex(index + 1)} aria-label={`View photo ${index + 2} of ${displayPhotos.length}`}>
                    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => hideFailedPhoto(url)} />
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="workspace-panel mb-6 grid min-h-32 place-content-center justify-items-center gap-1 p-5 text-center">
            <Car size={28} className="mb-1 text-muted-foreground" aria-hidden="true" />
            <p className="font-semibold">No bay photo available</p>
            {spot.parkingLabel && <p className="text-sm text-muted-foreground">{spot.parkingLabel}</p>}
          </div>
        )}

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
            <section className="space-y-3" aria-labelledby="parking-bay-heading">
              <h2 id="parking-bay-heading" className="text-xl font-semibold">
                {spot.parkingLabel ? `${spot.parkingLabel}` : 'Private parking bay'}
              </h2>
              <div aria-label="Parking location">
                {spot.address && (
                  <p className="flex max-w-4xl items-start gap-2 text-sm leading-relaxed text-[#6e6e73] dark:text-[#A1A1AA]">
                    <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{spot.address}</span>
                  </p>
                )}
              </div>

            </section>

            {/* 2. PARKING SPACE DETAILS */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] dark:text-[#A1A1AA]">
                Parking features
              </h2>
              <div className="grid grid-cols-2 gap-3 pt-1">
                {[
                  { icon: Car, label: spot.isCovered ? 'Covered / Indoor bay' : 'Open-air bay', desc: spot.isCovered ? 'Sheltered from rain and direct sun' : 'Outdoor surface parking bay' },
                  { icon: Zap, label: spot.hasEvCharging ? (spot.evChargingSpeed ? 'EV Charging (' + spot.evChargingSpeed + ')' : 'EV Charging Available') : 'No EV Charger', desc: spot.hasEvCharging ? 'Dedicated charging point for electric vehicles' : 'Standard combustion / hybrid bay' },
                  { icon: Accessibility, label: spot.isHandicapAccessible ? 'OKU / Handicap accessible' : 'Standard access bay', desc: spot.isHandicapAccessible ? 'Wider berth & step-free transit pathway' : 'Standard commuter parking width' },
                  { icon: ShieldCheck, label: spot.hasCctv ? '24/7 CCTV & Security' : 'Continuous sensor access', desc: spot.hasCctv ? 'Active surveillance on premise' : 'Monitored smart bollard bay' },
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
                About this bay
              </h2>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e8eaed] text-sm font-semibold text-[#5f6368] dark:bg-white/10 dark:text-[#D4D4D8]">
                  {(spot.owner || 'Bay Owner').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="break-words text-base font-semibold text-[#111] dark:text-white">Hosted by {spot.owner || 'Bay Owner'}</p>
                  {hostingDuration && <p className="mt-0.5 text-sm text-[#6e6e73] dark:text-[#A1A1AA]">{hostingDuration}</p>}
                </div>
              </div>
              {spot.description?.trim() && (
                <p className="whitespace-pre-line break-words text-sm leading-relaxed text-[#5f6368] dark:text-[#A1A1AA]">
                  {spot.description.trim()}
                </p>
              )}
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-[#111] dark:text-white">
                        Select booking dates
                      </h3>
                      <p className="text-xs text-[#5f6368] dark:text-[#A1A1AA]">
                        {!user?.token
                          ? 'Sign in to check live date availability'
                          : isAvailabilityLoading
                            ? 'Checking spot availability…'
                            : currentMonthAvailability
                              ? `${currentMonthAvailability.totalAvailableDates} available days published for this period`
                              : 'Choose consecutive available dates to reserve your bay'}
                      </p>
                    </div>

                    {startDate && (
                      <button
                        type="button"
                        onClick={clearSelectedDates}
                        className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[#6e6e73] dark:text-[#A1A1AA] hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-[#111] dark:hover:text-white transition cursor-pointer"
                      >
                        Clear dates
                      </button>
                    )}
                  </div>

                  {!user?.token && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#007AFF]/20 bg-[#f0f7ff] dark:border-blue-500/30 dark:bg-blue-950/30 p-3 text-xs text-[#007AFF] dark:text-[#3894FF]">
                      <span>Sign in to view live availability dates and reserve this bay.</span>
                      <button
                        type="button"
                        onClick={() => promptLogin('Reserve Parking Bay', 'Sign in to check live date availability and reserve this parking bay.')}
                        className="shrink-0 rounded-lg bg-[#007AFF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0066d6] cursor-pointer"
                      >
                        Sign in
                      </button>
                    </div>
                  )}

                  {availabilityError && (
                    <div
                      role="alert"
                      className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300"
                    >
                      <span className="flex items-start gap-2">
                        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                        <span>{availabilityError}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAvailabilityError(null);
                          setAvailabilityRetryKey((value) => value + 1);
                        }}
                        className="shrink-0 font-semibold underline underline-offset-2 cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Unboxed Circular Calendar Grid */}
                  <div className="rounded-2xl border border-black/[0.06] dark:border-white/10 bg-[#FBFBFC] dark:bg-white/[0.02] p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2 pb-3 mb-2">
                      <button
                        type="button"
                        aria-label="Previous month"
                        disabled={isAvailabilityLoading || calendarMonth <= minimumCalendarMonth}
                        onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] dark:border-white/12 bg-white dark:bg-[#242429] text-[#5f6368] dark:text-[#A1A1AA] transition hover:border-[#111827]/30 hover:text-[#111827] dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm sm:text-base font-bold text-[#111] dark:text-white tracking-tight">
                        {calendarMonth.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        aria-label="Next month"
                        disabled={isAvailabilityLoading}
                        onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] dark:border-white/12 bg-white dark:bg-[#242429] text-[#5f6368] dark:text-[#A1A1AA] transition hover:border-[#111827]/30 hover:text-[#111827] dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 text-center text-xs font-bold uppercase tracking-wider text-[#9ca3af] dark:text-[#71717A] pb-2 border-b border-black/[0.06] dark:border-white/[0.08]" aria-hidden="true">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => <span key={idx}>{day}</span>)}
                    </div>

                    <div className="mt-3 grid grid-cols-7 gap-y-1.5">
                      {calendarDateKeys.map((dateKey, index) => {
                        if (!dateKey) return <span key={`empty-${index}`} className="h-10 sm:h-11" aria-hidden="true" />;

                        const isAvailable = isDateAvailable(dateKey);
                        const isStart = dateKey === startDate;
                        const isEnd = dateKey === endDate;
                        const isEndpoint = isStart || isEnd;
                        const isRangeActive = Boolean(startDate && endDate && startDate !== endDate);
                        const isInCalendarSpan = Boolean(startDate && endDate && dateKey > startDate && dateKey < endDate);
                        const isInRangeOpen = isInCalendarSpan && isAvailable;
                        const isPast = dateKey < minimumBookingDate;
                        const isToday = dateKey === toDateInput(today);
                        const isDisabled = isPast || !isAvailable || isAvailabilityLoading;
                        const colIndex = index % 7;

                        return (
                          <div key={dateKey} className="relative flex h-10 sm:h-11 items-center justify-center">
                            {isRangeActive && isStart && isAvailable && colIndex < 6 && (
                              <span
                                className="pointer-events-none absolute inset-y-0.5 left-1/2 right-0 bg-black/[0.08] dark:bg-white/[0.14]"
                                aria-hidden="true"
                              />
                            )}
                            {isRangeActive && isEnd && isAvailable && colIndex > 0 && (
                              <span
                                className="pointer-events-none absolute inset-y-0.5 left-0 right-1/2 bg-black/[0.08] dark:bg-white/[0.14]"
                                aria-hidden="true"
                              />
                            )}
                            {isInRangeOpen && (
                              <span
                                className={`pointer-events-none absolute inset-y-0.5 inset-x-0 bg-black/[0.08] dark:bg-white/[0.14] ${
                                  colIndex === 0 ? 'rounded-l-full' : ''
                                } ${colIndex === 6 ? 'rounded-r-full' : ''}`}
                                aria-hidden="true"
                              />
                            )}
                            <button
                              type="button"
                              disabled={isDisabled}
                              title={
                                isEndpoint && !isAvailable
                                  ? `${formatDateKey(dateKey)} (Not Available)`
                                  : isEndpoint
                                    ? `${formatDateKey(dateKey)} (${isStart ? 'Booking Start' : 'Booking End'})`
                                    : isInRangeOpen
                                      ? `${formatDateKey(dateKey)} (Available · Included in booking)`
                                      : isAvailable && !isPast
                                        ? `${formatDateKey(dateKey)} (Available)`
                                        : `${formatDateKey(dateKey)} (Not Available)`
                              }
                              aria-label={`${formatDateKey(dateKey)}${isAvailable && !isPast ? ', available' : ', not available'}${isEndpoint ? ', selected' : isInRangeOpen ? ', in booking range' : ''}`}
                              aria-pressed={isEndpoint && isAvailable}
                              onClick={() => handleDateSelection(dateKey)}
                              className={`relative z-10 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-sm sm:text-base font-semibold transition select-none ${
                                isEndpoint && !isAvailable
                                  ? 'cursor-not-allowed bg-transparent text-slate-400/80 dark:text-zinc-600 line-through'
                                  : isEndpoint
                                    ? 'cursor-pointer bg-[#111827] dark:bg-white text-white dark:text-[#111827] shadow-sm font-bold'
                                    : isInRangeOpen
                                      ? 'cursor-pointer bg-transparent text-[#111827] dark:text-white font-semibold hover:bg-black/[0.06] dark:hover:bg-white/[0.12]'
                                      : isAvailable && !isDisabled
                                        ? 'cursor-pointer bg-emerald-100/85 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-100 hover:bg-emerald-200/85 dark:hover:bg-emerald-900/70'
                                        : 'cursor-not-allowed bg-transparent text-slate-400/80 dark:text-zinc-600'
                              } ${isToday && !isEndpoint && !isDisabled ? 'ring-2 ring-[#111827]/35 dark:ring-white/45 ring-offset-1 ring-offset-[#FBFBFC] dark:ring-offset-[#18181B]' : ''}`}
                            >
                              {dateFromKey(dateKey).getDate()}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm font-medium text-[#6e6e73] dark:text-[#A1A1AA] pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-emerald-100 dark:bg-emerald-950/80 ring-1 ring-emerald-300/80 dark:ring-emerald-700/60" />
                        Available
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-slate-300/70 dark:bg-zinc-700" />
                        Not Available
                      </span>
                    </div>
                  </div>

                  {/* Range selection notices */}
                  {startDate && !endDate && !dateSelectionError && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-[#f0f7ff] dark:bg-blue-950/30 p-3 border border-[#007AFF]/20 dark:border-blue-500/30">
                      <p className="text-sm sm:text-base font-medium text-[#007AFF] dark:text-[#3894FF]">Choose a consecutive end date, or reserve for 1 day.</p>
                      <button
                        type="button"
                        onClick={() => handleDateSelection(startDate)}
                        className="shrink-0 rounded-lg bg-[#007AFF] dark:bg-[#0071E3] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0066d6] dark:hover:bg-[#0077ED] transition active:scale-95 cursor-pointer shadow-xs"
                      >
                        Book 1 day ({formatDateKey(startDate)})
                      </button>
                    </div>
                  )}

                  {startDate && endDate && startDate === endDate && !dateSelectionError && !dateValidationError && (
                    <p className="text-xs font-medium text-[#16a34a]">
                      ✓ 1-day booking selected for {formatDateKey(startDate)}. Click any later consecutive available date on the calendar to extend your reservation.
                    </p>
                  )}

                  {startDate && endDate && startDate !== endDate && !dateSelectionError && !dateValidationError && rangeValidation.isValid && (
                    <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span>✓</span>
                        <span>{openDaysInRange.length} consecutive day{openDaysInRange.length === 1 ? '' : 's'} selected ({formatDateKey(startDate)} – {formatDateKey(endDate)})</span>
                      </div>
                    </div>
                  )}

                  {selectedStartAvailability?.timeRanges.length ? (
                    <p className="rounded-xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-white/5 p-4 text-base font-medium text-[#333] dark:text-[#E4E4E7]">Hours on {formatDateKey(startDate)}: {selectedStartAvailability.timeRanges.map((range) => `${range.from}–${range.to}`).join(', ')}</p>
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
                    {totalReviewCount > 0 ? (
                      <>
                        <Star size={18} className="text-[#ff9500] fill-[#ff9500]" />
                        <span>{averageRating.toFixed(1)} · {totalReviewCount} {totalReviewCount === 1 ? 'review' : 'reviews'}</span>
                      </>
                    ) : (
                      <>
                        <Star size={18} className="text-[#8e8e93] dark:text-[#71717A]" />
                        <span>New · No reviews yet</span>
                      </>
                    )}
                  </h2>
                </div>
              </div>

              {/* Review Summary Pillars - Only show when real reviews exist */}
              {totalReviewCount > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-black/[0.04] dark:border-white/[0.06]">
                  <div>
                    <span className="block text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">Overall rating</span>
                    <span className="block text-sm font-bold text-[#111] dark:text-white mt-0.5">{averageRating.toFixed(1)} / 5.0</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">Total reviews</span>
                    <span className="block text-sm font-bold text-[#111] dark:text-white mt-0.5">{totalReviewCount}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">Authenticity</span>
                    <span className="block text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">Verified stays</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">Transit proximity</span>
                    <span className="block text-sm font-bold text-[#111] dark:text-white mt-0.5 truncate">{spot.stationName || spot.station || 'Near Transit'}</span>
                  </div>
                </div>
              )}

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
                            <p className="text-[10px] text-[#8e8e93] dark:text-[#A1A1AA]">Verified booking · {parseTimestamp(review.createdAt).toLocaleDateString('en-MY', displayDateOptions({ month: 'short', day: 'numeric' }))}</p>
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
                          {!isOwnReview && (
                            <button
                              type="button"
                              aria-label="Report review"
                              title="Report this review for moderation"
                              onClick={() => {
                                setReportingReview(review);
                                setReportStatus(null);
                                setReportDetails('');
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8e8e93] dark:text-[#A1A1AA] transition hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-[#d92d20] dark:hover:text-rose-400 cursor-pointer"
                            >
                              <Flag size={13} />
                            </button>
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
                        <div>
                          <p className="review-comment-text mt-2.5 whitespace-pre-line text-xs sm:text-[13px] leading-5 text-[#333] dark:text-[#D4D4D8]">{review.comment || 'No written comment.'}</p>
                          {review.photos && review.photos.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {review.photos.map((photo, pIdx) => (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={() => setViewingPhotoUrl(photo)}
                                  className="relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-xl border border-black/10 dark:border-white/10 hover:opacity-90 transition cursor-zoom-in"
                                  title="View full size photo"
                                >
                                  <img src={photo} alt={`Bay condition ${pIdx + 1}`} className="h-full w-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
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
            </section>
          </div>

          {/* ════════ RIGHT COLUMN (35% Width) - Sticky Floating Booking Card ════════ */}
          <div className="w-full lg:sticky lg:top-8">
            <div className="bg-white dark:bg-[#141417] rounded-3xl border border-black/[0.08] dark:border-white/10 shadow-xl lg:shadow-2xl p-6 sm:p-7 space-y-5 backdrop-blur-xl">
              {/* Card Header: Price per day */}
              <div className="flex items-baseline justify-between gap-3 pb-1 border-b border-black/[0.06] dark:border-white/[0.08]">
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-[#111] dark:text-white">
                    RM {displayedRate.toFixed(2)}
                  </span>
                  <span className="text-sm font-normal text-[#5f6368] dark:text-[#A1A1AA] ml-1">
                    / day
                  </span>
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
                    <span className="text-[#5f6368] dark:text-[#A1A1AA]">RM {quote.ratePerDay.toFixed(2)} × {quote.bookedDays} day{quote.bookedDays === 1 ? '' : 's'}</span>
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
                  <p className="text-[10px] text-[#9ca3af] dark:text-[#71717A] pt-0.5">Quote expires {parseTimestamp(quote.expiresAt).toLocaleTimeString('en-MY', displayDateOptions({ hour: '2-digit', minute: '2-digit' }))}.</p>
                </div>
              )}

              {bookingNotice && (
                <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 rounded-xl p-2.5">
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-blue-600" />
                  <span>{bookingNotice}</span>
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
                disabled={Boolean(user?.token) && activeTab === 'reserve' && (invalidDates || isBookingLoading || (Boolean(quote) && !selectedVehicleId))}
                className={`w-full min-h-12 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                  activeTab === 'reserve' && (invalidDates || isBookingLoading || (Boolean(quote) && !selectedVehicleId))
                    ? 'bg-[#e8eaed] dark:bg-[#242429] text-[#9ca3af] dark:text-[#71717A] cursor-not-allowed shadow-none'
                    : 'bg-[#007AFF] hover:bg-[#0066d6] dark:bg-[#0071E3] dark:hover:bg-[#0077ED] text-white active:scale-[0.98]'
                }`}
              >
                {!user?.token ? (
                  <>
                    <Lock size={16} />
                    <span>Sign In to Reserve Bay</span>
                  </>
                ) : activeTab !== 'reserve' ? (
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

      {/* Report Review Modal */}
      {reportingReview && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
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
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121214] text-[#111] dark:text-white outline-none focus:border-[#007AFF]"
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
                  placeholder="Explain what is misleading, abusive, or violating community guidelines..."
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121214] p-2.5 text-xs text-[#111] dark:text-white outline-none resize-none focus:border-[#007AFF]"
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
                  disabled={isSubmittingReport}
                  onClick={() => { setReportingReview(null); setReportStatus(null); }}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-[#5f6368] dark:text-[#A1A1AA] hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingReport}
                  onClick={() => void handleReportReview()}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingReport && <Loader2 size={13} className="animate-spin" />}
                  {isSubmittingReport ? 'Submitting…' : 'Submit Report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Photo Gallery Modal */}
      {galleryIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo gallery"
          className="fixed inset-0 z-[2000] flex flex-col justify-between bg-black/95 text-white backdrop-blur-md p-4 sm:p-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 shrink-0 relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-medium text-white/70">
                {galleryIndex + 1} / {displayPhotos.length}
              </span>
              <span className="text-xs text-white/50">·</span>
              <span className="text-xs font-semibold text-white truncate max-w-[200px] sm:max-w-md">
                {spot.propertyName || spot.name || 'Parking Bay Gallery'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setGalleryIndex(null)}
              className="rounded-full bg-white/20 hover:bg-white/30 active:scale-95 p-2 text-white transition-all cursor-pointer shadow-md border border-white/20"
              aria-label="Close photo gallery"
            >
              <X size={20} />
            </button>
          </div>

          {/* Main Photo with navigation arrows */}
          <div className="relative flex-1 min-h-0 flex items-center justify-center py-2">
            <img
              src={displayPhotos[galleryIndex]}
              alt={`Parking bay photo ${galleryIndex + 1}`}
              className="max-h-full max-w-full object-contain rounded-xl select-none shadow-2xl"
              onError={() => hideFailedPhoto(displayPhotos[galleryIndex])}
            />

            {displayPhotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setGalleryIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : displayPhotos.length - 1))}
                  className="absolute left-2 sm:left-4 rounded-full bg-black/60 hover:bg-black/90 p-2 sm:p-3 text-white transition backdrop-blur-xs border border-white/15 cursor-pointer"
                  aria-label="Previous photo"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryIndex((prev) => (prev !== null && prev < displayPhotos.length - 1 ? prev + 1 : 0))}
                  className="absolute right-2 sm:right-4 rounded-full bg-black/60 hover:bg-black/90 p-2 sm:p-3 text-white transition backdrop-blur-xs border border-white/15 cursor-pointer"
                  aria-label="Next photo"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail Strip */}
          {displayPhotos.length > 1 && (
            <div className="flex items-center justify-center gap-2 pt-3 shrink-0 overflow-x-auto no-scrollbar">
              {displayPhotos.map((photo, idx) => (
                <button
                  key={`${photo}-${idx}`}
                  type="button"
                  onClick={() => setGalleryIndex(idx)}
                  className={`relative h-12 w-16 sm:h-14 sm:w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all cursor-pointer ${
                    galleryIndex === idx ? 'border-white scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={photo}
                    alt={`Thumbnail ${idx + 1}`}
                    className="h-full w-full object-cover"
                    onError={() => hideFailedPhoto(photo)}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enlarged Photo Preview Modal */}
      {viewingPhotoUrl && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs cursor-pointer"
          onClick={() => setViewingPhotoUrl(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-black">
            <img src={viewingPhotoUrl} alt="Bay condition enlarged preview" className="max-h-[85vh] w-auto object-contain" />
            <button
              type="button"
              onClick={() => setViewingPhotoUrl(null)}
              className="absolute top-3 right-3 rounded-full bg-black/70 p-1.5 text-white hover:bg-black cursor-pointer"
              aria-label="Close image"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile bottom fixed booking bar (Hidden on desktop screens) ── */}
      <div className="parking-detail-booking-bar lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#141417]/95 border-t border-[#e8eaed] dark:border-white/10 px-4 py-3 z-40 backdrop-blur-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-[#111] dark:text-white text-sm">{displayedRate > 0 ? `RM ${displayedRate.toFixed(2)}` : 'Daily rate'} <span className="text-xs font-normal text-[#5f6368] dark:text-[#A1A1AA]">/ day</span></p>
            <p className="text-[10px] text-[#9ca3af] dark:text-[#A1A1AA] truncate">{quote ? `${quote.bookedDays} ${quote.bookedDays === 1 ? 'day' : 'days'} · RM ${quote.renterTotal.toFixed(2)}` : 'Request a quote'}</p>
          </div>
          <button
            onClick={handleBottomAction}
            disabled={Boolean(user?.token) && bottomBookingUnavailable}
            className={`font-semibold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
              bottomBookingUnavailable
                ? 'bg-[#e8eaed] dark:bg-[#242429] text-[#9ca3af] dark:text-[#71717A] cursor-not-allowed'
                : 'bg-[#007AFF] dark:bg-[#0071E3] text-white hover:bg-[#0066d6] dark:hover:bg-[#0077ED] active:scale-[0.98] cursor-pointer shadow-sm'
            }`}
          >
            {!user?.token ? (
              <>
                <Lock size={14} />
                <span>Sign In to Book</span>
              </>
            ) : showChooseDates || activeTab !== 'reserve' ? (
              <>
                <Calendar size={14} />
                <span>{showChooseDates ? 'Choose dates' : 'Return'}</span>
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

      {/* ── Apple-style Full Page Grace Period Screen ── */}
      {isGracePeriodActive && (
        <div className="fixed inset-0 z-[2500] flex flex-col justify-between bg-[#000000] text-white p-5 sm:p-8 md:p-12 select-none overflow-y-auto no-scrollbar animate-in fade-in duration-300">
          {/* Top Bar / Header */}
          <header className="w-full max-w-2xl mx-auto flex flex-col items-center text-center space-y-2 pt-2 sm:pt-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-4 py-1.5 text-xs font-semibold text-white/90 shadow-sm">
              <Clock size={13} className="text-[#007AFF] animate-pulse" />
              <span>Auto-confirming in {graceSecondsLeft}s</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white pt-1">
              {isFinalizingBooking ? 'Securing Your Bay…' : 'Driving to Your Parking Bay'}
            </h1>
            <p className="text-xs sm:text-sm text-[#86868b] max-w-md leading-relaxed">
              {isFinalizingBooking
                ? 'Processing payment and registering vehicle access…'
                : `Heading to ${spot.propertyName || spot.address}. You can regret and cancel anytime before arrival.`}
            </p>
          </header>

          {/* ── Middle: Animated Road with Moving Cities & Trees ── */}
          <GracePeriodRoadAnimation
            graceProgress={graceProgress}
            isFinalizingBooking={isFinalizingBooking}
            destinationName={spot.propertyName || spot.address}
          />

          {/* ── Bottom Section: Minimalist Summary & Action ── */}
          <footer className="w-full max-w-md mx-auto space-y-4 pb-2 sm:pb-4">
            {/* Borderless Summary Card */}
            <div className="rounded-2xl bg-[#1c1c1e] p-4 sm:p-5 text-xs space-y-2.5 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-[#86868b]">Parking bay</span>
                <span className="font-semibold text-white truncate max-w-[220px]">
                  {spot.propertyName || spot.address}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#86868b]">Dates</span>
                <span className="font-medium text-white">
                  {startDate ? formatDateKey(startDate) : ''}
                  {endDate && endDate !== startDate ? ` – ${formatDateKey(endDate)}` : ''}
                </span>
              </div>
              {activeVehicle && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#86868b] shrink-0">Vehicle</span>
                  <span className="font-medium text-white truncate max-w-[220px]" title={`${activeVehicle.plate} ${activeVehicle.makeModel ? `· ${activeVehicle.makeModel}` : ''}`}>
                    {activeVehicle.plate} {activeVehicle.makeModel ? `· ${activeVehicle.makeModel}` : ''}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.06] text-sm">
                <span className="font-semibold text-[#86868b]">Total Amount</span>
                <span className="font-bold text-white text-base">RM {quote?.renterTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Apple HIG Destructive Cancel Button */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={isFinalizingBooking}
                onClick={handleCancelGracePeriod}
                className="w-full h-12 rounded-xl bg-red-500/[0.12] hover:bg-red-500/[0.18] active:scale-[0.98] text-[#ff453a] font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                <RotateCcw size={15} strokeWidth={2.2} />
                <span>Cancel Order</span>
              </button>
              <p className="text-center text-[11px] text-[#86868b]">
                {isFinalizingBooking
                  ? 'Securing booking details…'
                  : 'Tap to cancel immediately without being charged'}
              </p>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
