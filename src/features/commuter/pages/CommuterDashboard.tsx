import { useState, useEffect, useRef, useCallback, useMemo, type FormEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Search,
  SlidersHorizontal,
  Compass,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Unlock,
  Lock,
  User,
  Car,
  Wallet,
  Bell,
  History,
  Plus,
  X,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  Camera,
  Clock,
  Coins,
  ShieldCheck,
  ChevronRight,
  Info,
  Map,
  Settings,
  Share2,
  CreditCard,
  Check,
  Train,
  Home,
  Navigation,
  Loader2,
  RefreshCw,
  Pencil,
  Star,
  Trash2,
  ClipboardList,
  Heart,
  Menu,
  Calendar,
} from 'lucide-react';
import {
  ParkingSpot,
  ParkingSearchResponse,
  Booking,
  Vehicle,
  AppNotification,
  WalletTopUpStatus,
  WalletTopUpState,
  WalletTopUpHistoryItem,
  WalletTransactionItem,
} from '../types';
import CommuterMap from '../components/CommuterMap';
import ParkingPass from '../components/ParkingPass';
import JourneyStrip from '../components/JourneyStrip';
import TransitHubSheet from '../components/TransitHubSheet';
import LinearJourneyNavigator from '../components/LinearJourneyNavigator';
import { formatShortSpotName, formatShortAddress } from '../lib/formatUtils';
import type { DrivingRouteResult } from '@/services/drivingRouteService';
import type { MultimodalPlanResult } from '@/services/multimodalRoutingService';
import type { StationNearbyParkingSpot } from '@/services/gtfsApi';
import DashboardHeader from '@/components/layout/DashboardHeader';
import AppSidebar from '@/components/layout/AppSidebar';
import BottomNav from '@/components/layout/BottomNav';
import PageTransition from '@/components/ui/PageTransition';
import { useAuth } from '@/features/auth/context/AuthContext';
import ProfileDialog from '@/features/profile/components/ProfileDialog';
import { showConfirm, showAlert } from '@/contexts/ModalContext';
import {
  clearJourneySession,
  loadJourneySession,
  saveJourneySession,
  updateJourneyStage,
} from '../lib/journeySession';
import type { JourneyStage } from '../lib/journeySession';
import { getNearbyParking, searchParking } from '../api/parkingApi';
import {
  favoriteParkingSpotToParkingSpot,
  getFavoriteParking,
  updateFavoriteParking,
} from '../api/favoriteApi';
import {
  createWalletTopUp,
  getWalletHistory,
  getWalletSummary,
  getWalletTopUpHistory,
  getWalletTopUpStatus,
} from '../api/walletApi';
import { cancelBooking, getActiveBooking, normalizeActiveBooking } from '../api/bookingApi';
import type { VehicleCatalogEntry } from '../data/vehicleCatalog';
import {
  addVehicle as createVehicleRequest,
  deleteVehicle as deleteVehicleRequest,
  getMyVehicles,
  modifyVehicle as modifyVehicleRequest,
} from '../api/vehicleApi';
import {
  applyActiveVehicle,
  loadCachedVehicles,
  mapApiVehicleToVehicle,
  saveCachedVehicles,
} from '../lib/vehicleStorage';
import { getDeviceLocation, DeviceLocationError } from '@/services/deviceCapabilities';
import { isWithinArrivalRadius, resolveSpotCoordinates } from '../lib/geofence';
import { selfUnlockGate } from '@/features/support/api/supportWorkflowService';
import { updateReview } from '../api/reviewApi';
import { getCommuterBookingHistory, type BookingHistoryItem } from '@/features/bookings/api/bookingHistoryApi';
import { VEHICLE_CATALOG_FALLBACK } from '../data/vehicleCatalog';
import VehicleBrandModelFields from '../components/VehicleBrandModelFields';
import SupportWorkspace from '@/features/support/components/SupportWorkspace';
import { loadFavoriteParking, saveFavoriteParking, setParkingFavorite } from '../lib/favoriteParking';
import { isNativeApp, watchDeviceLocation } from '@/services/deviceCapabilities';
import {
  closeExternalWindow,
  isLocalWebHost,
  openExternalUrl,
  reserveExternalWindow,
} from '@/services/externalNavigation';

type ParkingResultDto = ParkingSearchResponse['data'][number];

const mapParkingResult = (spot: ParkingResultDto): ParkingSpot => ({
  ...spot,
  id: String(spot.parkingSpotId),
  station: spot.stationName,
  name: spot.propertyName,
  pricePerHour: 0,
  distance: Math.round(spot.distanceToStation * 1000),
  lat: spot.latitude,
  lng: spot.longitude,
  available: spot.availabilityStatus.toLowerCase() === 'available',
  type: 'Condo Bay',
  owner: `Property #${spot.propertyId}`,
});

const historyItemToBooking = ({ booking }: BookingHistoryItem): Booking => ({
  id: booking.bookingReference,
  bookingId: booking.bookingId,
  spot: {
    id: String(booking.parkingSpotId),
    parkingSpotId: booking.parkingSpotId,
    parkingLabel: booking.parkingLabel,
    propertyId: 0,
    propertyName: booking.parkingLabel || 'Parking spot #' + booking.parkingSpotId,
    address: booking.parkingLabel || 'Parking spot #' + booking.parkingSpotId,
    latitude: 0, longitude: 0, stationName: '', distanceToStation: 0, timeToStationInMinutes: 0,
    availabilityStatus: '', monthlyRate: 0, dailyRate: null, primaryImageUrl: null,
    station: 'ParkJom parking', name: booking.parkingLabel || 'Parking spot #' + booking.parkingSpotId,
    pricePerHour: 0, distance: 0, lat: 0, lng: 0, available: false, type: 'Condo Bay', owner: '',
  },
  startTime: new Date(booking.startDate),
  endTime: new Date(booking.endDate),
  vehiclePlate: '',
  status: booking.bookingStatus === 'Completed' ? 'Completed' : 'Upcoming',
  totalPaid: booking.totalAmount,
});

const formatParkingRate = (spot: ParkingSpot) => {
  if (spot.dailyRate !== null) return `RM ${spot.dailyRate.toFixed(2)}/day`;
  if (spot.monthlyRate > 0) return `RM ${spot.monthlyRate.toFixed(2)}/month`;
  return 'Rate not set';
};

type StationCoordinates = { lat: number; lng: number };
type LocationStatus = 'locating' | 'ready' | 'denied' | 'unavailable';
type WalletTopUpFeedback = {
  tone: 'success' | 'processing' | 'warning' | 'info';
  title: string;
  message: string;
  payment?: PendingWalletTopUp | null;
  action?: 'new-topup' | 'retry-status';
  allowNewTopUp?: boolean;
};

interface PendingWalletTopUp {
  userId: number;
  paymentId: number;
  sessionId: string;
  checkoutUrl: string;
  amount: number;
  description: string;
  message: string;
  createdAt: string;
  stage: 'checkout' | 'confirming';
}

const PENDING_WALLET_TOP_UP_KEY = (userId: number) => `parkjom.pendingWalletTopUp.${userId}`;
const WALLET_TOP_UP_EXPIRY_MS = 24 * 60 * 60 * 1000;

const clearPendingWalletTopUp = (userId?: number) => {
  if (!userId) return;
  try {
    localStorage.removeItem(PENDING_WALLET_TOP_UP_KEY(userId));
  } catch {
    // In-memory state still works when browser storage is unavailable.
  }
};

const savePendingWalletTopUp = (value: PendingWalletTopUp) => {
  try {
    localStorage.setItem(PENDING_WALLET_TOP_UP_KEY(value.userId), JSON.stringify(value));
  } catch {
    // Checkout can continue when browser storage is unavailable.
  }
};

const loadPendingWalletTopUp = (userId?: number): PendingWalletTopUp | null => {
  if (!userId) return null;
  try {
    const rawValue = localStorage.getItem(PENDING_WALLET_TOP_UP_KEY(userId));
    if (!rawValue) return null;
    const value = JSON.parse(rawValue) as Partial<PendingWalletTopUp>;
    if (
      value.userId !== userId
      || typeof value.paymentId !== 'number'
      || typeof value.sessionId !== 'string'
      || typeof value.checkoutUrl !== 'string'
      || typeof value.amount !== 'number'
    ) {
      clearPendingWalletTopUp(userId);
      return null;
    }
    const createdAt = value.createdAt || new Date().toISOString();
    const createdAtTime = Date.parse(createdAt);
    if (!Number.isFinite(createdAtTime) || Date.now() - createdAtTime > WALLET_TOP_UP_EXPIRY_MS) {
      clearPendingWalletTopUp(userId);
      return null;
    }
    return {
      userId,
      paymentId: value.paymentId,
      sessionId: value.sessionId,
      checkoutUrl: value.checkoutUrl,
      amount: value.amount,
      description: value.description || 'Top up my wallet',
      message: value.message || 'Wallet top-up checkout created.',
      createdAt,
      stage: value.stage === 'confirming' ? 'confirming' : 'checkout',
    };
  } catch {
    return null;
  }
};

const distanceBetweenKm = (origin: StationCoordinates, destination: StationCoordinates) => {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const latitudeDelta = toRadians(destination.lat - origin.lat);
  const longitudeDelta = toRadians(destination.lng - origin.lng);
  const originLatitude = toRadians(origin.lat);
  const destinationLatitude = toRadians(destination.lat);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const distanceFromUser = (origin: StationCoordinates, spot: ParkingSpot) =>
  distanceBetweenKm(origin, { lat: spot.latitude, lng: spot.longitude });

const formatUserDistance = (distanceKm: number) =>
  distanceKm < 1 ? `${Math.max(1, Math.round(distanceKm * 1000))} m away` : `${distanceKm.toFixed(1)} km away`;


export default function CommuterDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const supportViewer = useMemo(() => user ? ({
    userId: user.userId,
    name: `${user.firstName} ${user.lastName}`.trim() || user.email,
    email: user.email,
    role: 'Commuter' as const,
    token: user.token,
  }) : null, [user]);
  const prefersReducedMotion = useReducedMotion();
  const [initialJourney] = useState(() => loadJourneySession(user?.userId));
  type CommuterTab = 'home' | 'active' | 'wallet' | 'profile' | 'map' | 'favorites' | 'support';
  const locationParams = new URLSearchParams(location.search);
  const queryTab = locationParams.get('tab');
  const requestedTabFromQuery: CommuterTab | undefined = queryTab === 'home'
    || queryTab === 'active'
    || queryTab === 'wallet'
    || queryTab === 'profile'
    || queryTab === 'map'
    || queryTab === 'support'
    || queryTab === 'favorites'
    ? queryTab
    : undefined;
  const requestedTab = requestedTabFromQuery || (location.state as { activeTab?: CommuterTab } | null)?.activeTab;
  const persistedTab = (() => {
    try {
      const stored = localStorage.getItem('parkjom_commuter_tab');
      return stored === 'home' || stored === 'active' || stored === 'wallet' || stored === 'profile' || stored === 'map' || stored === 'support' || stored === 'favorites'
        ? stored as CommuterTab
        : undefined;
    } catch {
      return undefined;
    }
  })();
  const topUpReturnStatus = locationParams.get('topup');
  const returnedCheckoutSessionId = locationParams.get('session_id');

  // App Navigation and Module States
  const [activeTab, setActiveTab] = useState<CommuterTab>(requestedTab || persistedTab || (initialJourney ? 'active' : 'home'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('parkjom_commuter_sidebar_collapsed') === 'true',
  );
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedStationCoords, setSelectedStationCoords] = useState<StationCoordinates | null>(null);
  const [distanceFilter, setDistanceFilter] = useState<number>(3000); // meters
  const [mobileTransitTab, setMobileTransitTab] = useState<'map' | 'transit' | 'bays'>('map');
  const [transitWorkspaceMode, setTransitWorkspaceMode] = useState<'explore' | 'navigation'>('explore');
  const [navigationRoutes, setNavigationRoutes] = useState<{
    drivingRoute: DrivingRouteResult | null;
    linearPlan: MultimodalPlanResult | null;
    targetSpot: ParkingSpot | null;
  }>({ drivingRoute: null, linearPlan: null, targetSpot: null });
  const [navigationJourneyTab, setNavigationJourneyTab] = useState<'drive' | 'transit'>('drive');
  const [selectedBusRoute, setSelectedBusRoute] = useState<string | null>(null);
  const [spotTypeFilter, setSpotTypeFilter] = useState<string>('all');
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [favoriteSpots, setFavoriteSpots] = useState<ParkingSpot[]>(() => user?.userId ? loadFavoriteParking(user.userId) : []);
  const [isFavoritesLoading, setIsFavoritesLoading] = useState(false);
  const [favoriteUpdatingIds, setFavoriteUpdatingIds] = useState<number[]>([]);
  const [isClearingFavorites, setIsClearingFavorites] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [nearbySpots, setNearbySpots] = useState<ParkingSpot[]>([]);
  const [isNearbyLoading, setIsNearbyLoading] = useState<boolean>(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [nearbySpotCache, setNearbySpotCache] = useState<Record<string, ParkingSpot[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSpots, setSearchSpots] = useState<ParkingSpot[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchMeta, setSearchMeta] = useState<{ totalCount: number; page: number; pageSize: number } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<StationCoordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('locating');
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationRequestKey, setLocationRequestKey] = useState(0);
  const [suggestedSpots, setSuggestedSpots] = useState<ParkingSpot[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  
  // The supplied API creates top-up sessions but does not expose a wallet
  // summary endpoint, so an unknown balance is never presented as RM 0.00.
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [showTopUpModal, setShowTopUpModal] = useState<boolean>(false);
  const [topUpAmount, setTopUpAmount] = useState<string>('');
  const [topUpDescription, setTopUpDescription] = useState('');
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [isWalletRefreshing, setIsWalletRefreshing] = useState(false);
  const [walletLoadError, setWalletLoadError] = useState<string | null>(null);
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const [pendingTopUp, setPendingTopUp] = useState<PendingWalletTopUp | null>(() => loadPendingWalletTopUp(user?.userId));
  const [walletTopUpFeedback, setWalletTopUpFeedback] = useState<WalletTopUpFeedback | null>(null);
  const [topUpHistory, setTopUpHistory] = useState<WalletTopUpHistoryItem[]>([]);
  const [isTopUpHistoryLoading, setIsTopUpHistoryLoading] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionItem[]>([]);
  const [walletActivityFilter, setWalletActivityFilter] = useState<'all' | 'topup' | 'deduction'>('all');
  const [walletActivityPage, setWalletActivityPage] = useState(1);
  const [isWalletActivityLoading, setIsWalletActivityLoading] = useState(false);
  const [cancelingBookingId, setCancelingBookingId] = useState<number | null>(null);
  const handledTopUpReturnRef = useRef<string | null>(null);
  const walletReconciliationRef = useRef(false);
  const localCheckoutWindowRef = useRef<Window | null>(null);

  // The API is authoritative; the cache keeps the previous list visible while
  // a fresh authenticated request is in flight.
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleCacheUserId, setVehicleCacheUserId] = useState<number | null>(null);
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(false);
  const [vehiclesLoadError, setVehiclesLoadError] = useState<string | null>(null);
  const [vehicleCatalog, setVehicleCatalog] = useState<VehicleCatalogEntry[]>(VEHICLE_CATALOG_FALLBACK);
  const [showAddVehicle, setShowAddVehicle] = useState<boolean>(false);
  const [newPlate, setNewPlate] = useState<string>('');
  const [newBrand, setNewBrand] = useState<string>('');
  const [newModel, setNewModel] = useState<string>('');
  const [newColor, setNewColor] = useState<string>('');
  const [isVehicleSaving, setIsVehicleSaving] = useState(false);
  const [vehicleEditDraft, setVehicleEditDraft] = useState<{
    vehicleId: number;
    numberPlate: string;
    vehicleBrand: string;
    vehicleModel: string;
    vehicleColor: string;
  } | null>(null);
  const [isVehicleUpdating, setIsVehicleUpdating] = useState(false);
  const [vehicleDeletingId, setVehicleDeletingId] = useState<number | null>(null);
  const [vehicleFeedback, setVehicleFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const loadMyVehicles = useCallback(async (signal?: AbortSignal) => {
    if (!user?.userId) return;

    setIsVehiclesLoading(true);
    setVehiclesLoadError(null);
    // Capture the commuter's current selection before the request resolves, so
    // the active vehicle survives a refresh.
    const previousActiveId = loadCachedVehicles(user.userId).find((vehicle) => vehicle.active)?.vehicleId ?? null;
    try {
      if (!user.token) {
        // No session to authenticate with: fall back to whatever was cached.
        setVehicles(loadCachedVehicles(user.userId));
        return;
      }

      const result = await getMyVehicles(user.token, signal);
      if (signal?.aborted) return;

      const mapped = applyActiveVehicle(
        result.data.map((vehicle) => mapApiVehicleToVehicle(vehicle)),
        previousActiveId,
      );
      setVehicles(mapped);
    } catch (error) {
      if (signal?.aborted) return;
      setVehiclesLoadError(error instanceof Error ? error.message : 'Unable to load your vehicles.');
    } finally {
      if (!signal?.aborted) setIsVehiclesLoading(false);
    }
  }, [user?.token, user?.userId]);

  // Active Reservation / Session — TODO: fetch from backend
  const [activeBooking, setActiveBooking] = useState<Booking | null>(initialJourney?.booking ?? null);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [activeBookingRefreshKey, setActiveBookingRefreshKey] = useState<number>(0);
  const [journeyStage, setJourneyStage] = useState<JourneyStage>(initialJourney?.stage ?? 'reserved');

  // IoT Access Control & Bollard states
  const [isBollardUnlocked, setIsBollardUnlocked] = useState<boolean>(initialJourney?.stage === 'unlocked');
  const [bollardAnimationState, setBollardAnimationState] = useState<'raised' | 'lowering' | 'lowered' | 'raising'>(initialJourney?.stage === 'unlocked' ? 'lowered' : 'raised');
  const [gpsVerified, setGpsVerified] = useState<'checking' | 'verified' | 'unverified' | 'idle'>(initialJourney?.stage === 'arrived' || initialJourney?.stage === 'unlocked' || initialJourney?.stage === 'parked' ? 'verified' : 'idle');
  const [showQRScanner, setShowQRScanner] = useState<boolean>(false);
  const [qrCodeScanned, setQrCodeScanned] = useState<boolean>(false);
  const [scannerCameraActive, setScannerCameraActive] = useState<boolean>(false);

  // Time remaining countdown
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => initialJourney
    ? Math.max(0, Math.floor((initialJourney.booking.endTime.getTime() - Date.now()) / 1000))
    : 0);
  const [showGraceAlert, setShowGraceAlert] = useState<boolean>(false);

  // Notifications — TODO: fetch from backend
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);

  // Synchronize active reservation strictly with the current authenticated user (local session + server cross-device restore)
  useEffect(() => {
    const resetJourneyState = () => {
      setActiveBooking(null);
      setUpcomingBookings([]);
      setJourneyStage('reserved');
      setIsBollardUnlocked(false);
      setBollardAnimationState('raised');
      setGpsVerified('idle');
      setSecondsRemaining(0);
    };

    if (!user?.userId || !user?.token) {
      resetJourneyState();
      return;
    }

    const localSession = loadJourneySession(user.userId);
    if (localSession?.booking) {
      setActiveBooking(localSession.booking);
      setJourneyStage(localSession.stage);
      setIsBollardUnlocked(localSession.stage === 'unlocked');
      setBollardAnimationState(localSession.stage === 'unlocked' ? 'lowered' : 'raised');
      setGpsVerified(
        localSession.stage === 'arrived' || localSession.stage === 'unlocked' || localSession.stage === 'parked'
          ? 'verified'
          : 'idle',
      );
      setSecondsRemaining(Math.max(0, Math.floor((localSession.booking.endTime.getTime() - Date.now()) / 1000)));
    }

    const controller = new AbortController();
    void getActiveBooking(user.token, controller.signal)
      .then((activeResult) => {
        if (controller.signal.aborted) return;

        if (!activeResult.current && (!activeResult.upcoming || activeResult.upcoming.length === 0)) {
          clearJourneySession(user.userId);
          resetJourneyState();
          return;
        }

        if (activeResult.current) {
          const normalized = normalizeActiveBooking(activeResult.current);
        const stage: JourneyStage =
          localSession?.booking?.bookingId === normalized.bookingId ? localSession.stage : 'reserved';

        setActiveBooking(normalized);
        setJourneyStage(stage);
        setIsBollardUnlocked(stage === 'unlocked');
        setBollardAnimationState(stage === 'unlocked' ? 'lowered' : 'raised');
        setGpsVerified(
          stage === 'arrived' || stage === 'unlocked' || stage === 'parked' ? 'verified' : 'idle',
        );
        setSecondsRemaining(Math.max(0, Math.floor((normalized.endTime.getTime() - Date.now()) / 1000)));
        saveJourneySession(normalized, stage, user.userId);
        } else {
          setActiveBooking(null);
        }

        setUpcomingBookings((activeResult.upcoming || []).map(normalizeActiveBooking));
      })
      .catch(() => {
        // Fallback: If offline or API fails, keep local session if valid
        if (!localSession) {
          resetJourneyState();
        }
      });

    return () => controller.abort();
  }, [user?.token, user?.userId, activeBookingRefreshKey]);

  useEffect(() => {
    if (!user?.userId || !user.token) {
      setVehicles([]);
      setVehicleCacheUserId(null);
      setVehiclesLoadError(null);
      return;
    }

    setVehicles(loadCachedVehicles(user.userId));
    setVehicleCacheUserId(user.userId);
    const controller = new AbortController();
    void loadMyVehicles(controller.signal);
    return () => controller.abort();
  }, [loadMyVehicles, user?.token, user?.userId]);

  useEffect(() => {
    if (!user?.userId || vehicleCacheUserId !== user.userId) return;
    saveCachedVehicles(user.userId, vehicles);
  }, [vehicleCacheUserId, user?.userId, vehicles]);


  useEffect(() => {
    try {
      localStorage.setItem('parkjom_commuter_tab', activeTab);
    } catch {
      // Continue when browser storage is unavailable.
    }

    const params = new URLSearchParams(location.search);
    if (params.get('tab') === activeTab) return;
    params.set('tab', activeTab);
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
  }, [activeTab, location.pathname, location.search, navigate]);

  useEffect(() => {
    localStorage.setItem('parkjom_commuter_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!user?.userId || !user.token) {
      setFavoriteSpots([]);
      setIsFavoritesLoading(false);
      setFavoriteUpdatingIds([]);
      setIsClearingFavorites(false);
      setFavoriteError(null);
      return;
    }

    const cachedFavorites = loadFavoriteParking(user.userId);
    const controller = new AbortController();
    setFavoriteSpots(cachedFavorites);
    setIsFavoritesLoading(true);
    setFavoriteUpdatingIds([]);
    setIsClearingFavorites(false);
    setFavoriteError(null);

    void getFavoriteParking(user.token, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const currentCache = loadFavoriteParking(user.userId);
        const favorites = result.data.map((favorite) => favoriteParkingSpotToParkingSpot(
          favorite,
          currentCache.find((spot) => spot.parkingSpotId === favorite.parkingSpotId),
        ));
        saveFavoriteParking(user.userId, favorites);
        setFavoriteSpots(favorites);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setFavoriteError(error instanceof Error ? error.message : 'Unable to load your favorite parking spots.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsFavoritesLoading(false);
      });

    return () => controller.abort();
  }, [user?.token, user?.userId, activeBookingRefreshKey]);

  const handleToggleFavorite = async (spot: ParkingSpot) => {
    if (!user?.userId || !user.token || isFavoritesLoading || isClearingFavorites || favoriteUpdatingIds.includes(spot.parkingSpotId)) return;

    setFavoriteUpdatingIds((current) => [...current, spot.parkingSpotId]);
    setFavoriteError(null);
    try {
      const result = await updateFavoriteParking(user.token, spot.parkingSpotId);
      setFavoriteSpots(setParkingFavorite(user.userId, spot, result.data.isFavorite));
    } catch (error) {
      setFavoriteError(error instanceof Error ? error.message : 'Unable to update this favorite parking spot.');
    } finally {
      setFavoriteUpdatingIds((current) => current.filter((id) => id !== spot.parkingSpotId));
    }
  };

  const handleClearFavorites = async () => {
    if (!user?.userId || !user.token || favoriteSpots.length === 0 || isFavoritesLoading || isClearingFavorites) return;
    const confirmed = await showConfirm({
      title: 'Clear Favorites',
      message: 'Remove all parking spaces from your favorites?',
      confirmText: 'Remove All',
      cancelText: 'Keep Favorites',
      variant: 'danger',
      icon: 'trash',
    });
    if (!confirmed) return;

    const spotsToRemove = [...favoriteSpots];
    let failureCount = 0;
    setIsClearingFavorites(true);
    setFavoriteError(null);

    for (const spot of spotsToRemove) {
      try {
        const result = await updateFavoriteParking(user.token, spot.parkingSpotId);
        setFavoriteSpots(setParkingFavorite(user.userId, spot, result.data.isFavorite));
        if (result.data.isFavorite) failureCount += 1;
      } catch {
        failureCount += 1;
      }
    }

    if (failureCount > 0) {
      setFavoriteError(`${failureCount} favorite${failureCount === 1 ? '' : 's'} could not be removed. Please try again.`);
    }
    setIsClearingFavorites(false);
  };

  // Booking history from the authenticated commuter endpoint.
  const [history, setHistory] = useState<Booking[]>([]);
  const [bookingHistory, setBookingHistory] = useState<BookingHistoryItem[]>([]);
  const [bookingHistoryPage, setBookingHistoryPage] = useState(1);
  const [bookingHistoryMeta, setBookingHistoryMeta] = useState({ totalPages: 0, totalCount: 0 });
  const [isBookingHistoryLoading, setIsBookingHistoryLoading] = useState(false);
  const [bookingHistoryError, setBookingHistoryError] = useState<string | null>(null);
  const [bookingHistoryRefreshKey, setBookingHistoryRefreshKey] = useState(0);
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [editingReviewRating, setEditingReviewRating] = useState(0);
  const [editingReviewComment, setEditingReviewComment] = useState('');
  const [editingReviewError, setEditingReviewError] = useState<string | null>(null);
  const [isReviewSaving, setIsReviewSaving] = useState(false);

  const startReviewEdit = (item: BookingHistoryItem) => {
    if (!item.review) return;
    setEditingReviewId(item.review.reviewId);
    setEditingReviewRating(item.review.rating);
    setEditingReviewComment(item.review.comment);
    setEditingReviewError(null);
  };

  const resetReviewEdit = () => {
    setEditingReviewId(null);
    setEditingReviewRating(0);
    setEditingReviewComment('');
    setEditingReviewError(null);
  };

  const cancelReviewEdit = () => {
    if (isReviewSaving) return;
    resetReviewEdit();
  };

  const saveReviewEdit = async () => {
    if (!editingReviewId || !user?.token || isReviewSaving) return;
    if (!editingReviewRating) {
      setEditingReviewError('Choose a star rating before saving.');
      return;
    }

    setIsReviewSaving(true);
    setEditingReviewError(null);
    try {
      const result = await updateReview(user.token, editingReviewId, {
        rating: editingReviewRating,
        comment: editingReviewComment.trim(),
      });
      setBookingHistory((current) => current.map((item) => (
        item.review?.reviewId === result.data.reviewId
          ? {
              ...item,
              review: {
                ...item.review,
                ...result.data,
                ownerReply: result.data.ownerReply ?? item.review.ownerReply,
                ownerReplyAt: result.data.ownerReplyAt ?? item.review.ownerReplyAt,
              },
            }
          : item
      )));
      resetReviewEdit();
    } catch (saveError) {
      setEditingReviewError(saveError instanceof Error ? saveError.message : 'Unable to update your review.');
    } finally {
      setIsReviewSaving(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'profile' || !user?.token) return;
    const controller = new AbortController();
    setIsBookingHistoryLoading(true);
    setBookingHistoryError(null);
    void getCommuterBookingHistory(user.token, bookingHistoryPage, 10, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setBookingHistory(result.data);
        setBookingHistoryMeta({ totalPages: result.totalPages, totalCount: result.totalCount });
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setBookingHistoryError(reason instanceof Error ? reason.message : 'Unable to load booking history.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsBookingHistoryLoading(false);
      });
    return () => controller.abort();
  }, [activeTab, bookingHistoryPage, bookingHistoryRefreshKey, user?.token]);

  // Video scanner setup
  const videoRef = useRef<HTMLVideoElement>(null);
  const notificationDrawerRef = useRef<HTMLDivElement>(null);
  const topUpDialogRef = useRef<HTMLDivElement>(null);
  const qrDialogRef = useRef<HTMLDivElement>(null);

  // Filter spots — flexible match stripping LRT/MRT to handle GeoJSON name differences
  const filteredSpots = searchSpots.filter(spot => {
    if (spotTypeFilter !== 'all' && spot.type !== spotTypeFilter) return false;
    if (activeBooking && activeBooking.spot.id === spot.id) return false;
    return spot.available;
  });

  const locationSuggestedSpots = suggestedSpots.filter((spot) => {
    if (spotTypeFilter !== 'all' && spot.type !== spotTypeFilter) return false;
    if (activeBooking && activeBooking.spot.id === spot.id) return false;
    return spot.available;
  });

  const discoverySpots = searchMeta ? filteredSpots : locationSuggestedSpots;

  const mapNearbySpots = nearbySpots.filter((spot) => {
    if (spotTypeFilter !== 'all' && spot.type !== spotTypeFilter) return false;
    const actualDistance = selectedStationCoords
      ? distanceBetweenKm(selectedStationCoords, { lat: spot.lat, lng: spot.lng }) * 1000
      : spot.distance;
    if (actualDistance > distanceFilter) return false;
    if (activeBooking && activeBooking.spot.id === spot.id) return false;
    return spot.available;
  });

  const lensSpots = mapNearbySpots;
  const lensSelectedSpot = selectedSpot ?? lensSpots[0] ?? null;
  const getStationCacheKey = (stationName: string, lat: number, lng: number, radius: number = 3000) =>
    `${stationName.trim().toLowerCase()}::${lat.toFixed(5)}:${lng.toFixed(5)}::${radius}`;
  const journeyStep = activeBooking
    ? journeyStage === 'parked'
      ? 3
      : journeyStage === 'unlocked'
        ? 2
        : journeyStage === 'arrived'
          ? 1
          : 0
    : 0;

  useEffect(() => {
    if (topUpReturnStatus !== 'success' && topUpReturnStatus !== 'cancelled' && topUpReturnStatus !== 'cancel') {
      handledTopUpReturnRef.current = null;
      return;
    }

    const returnKey = `${topUpReturnStatus}:${returnedCheckoutSessionId || 'no-session'}`;
    if (handledTopUpReturnRef.current === returnKey) return;
    handledTopUpReturnRef.current = returnKey;

    const pendingPayment = loadPendingWalletTopUp(user?.userId);
    setActiveTab('wallet');
    setShowTopUpModal(false);
    setIsTopUpLoading(false);

    if (topUpReturnStatus === 'success') {
      const hasMismatchedSession = Boolean(
        returnedCheckoutSessionId
        && pendingPayment?.sessionId
        && returnedCheckoutSessionId !== pendingPayment.sessionId,
      );
      setWalletTopUpFeedback(hasMismatchedSession
        ? {
            tone: 'warning',
            title: 'Payment return could not be matched',
            message: 'We kept your pending payment reference, but could not match this Stripe return. Your balance has not been changed in the app.',
            payment: pendingPayment,
          }
        : {
            tone: 'processing',
            title: 'Checkout completed',
            message: 'Stripe returned you to ParkJom. The wallet credit is now waiting for secure webhook confirmation from the server.',
            payment: pendingPayment,
          });

      if (!hasMismatchedSession && pendingPayment) {
        const confirmingPayment = { ...pendingPayment, stage: 'confirming' as const };
        savePendingWalletTopUp(confirmingPayment);
        setPendingTopUp(confirmingPayment);
      }
    } else {
      setWalletTopUpFeedback({
        tone: 'info',
        title: 'Top-up cancelled',
        message: 'No payment was confirmed and your wallet balance was not changed.',
        payment: pendingPayment,
      });
      clearPendingWalletTopUp(user?.userId);
      setPendingTopUp(null);
    }
    navigate(`${location.pathname}?tab=wallet`, { replace: true });
  }, [location.pathname, navigate, returnedCheckoutSessionId, topUpReturnStatus, user?.userId]);

  useEffect(() => {
    if (activeTab !== 'home' && activeTab !== 'map') return;

    setLocationError(null);
    if (!currentLocation) {
      setLocationStatus('locating');
    }

    let isActive = true;
    let stopWatching: (() => void) | undefined;
    void watchDeviceLocation(
      (position) => {
        const nextLocation = { lat: position.lat, lng: position.lng };

        setCurrentLocation((previousLocation) => {
          if (previousLocation && distanceBetweenKm(previousLocation, nextLocation) < 0.05) {
            return previousLocation;
          }
          return nextLocation;
        });
        setLocationAccuracy(position.accuracy);
        setLocationStatus('ready');
        setLocationError(null);
      },
      (error) => {
        if (error.code === 1 || error.code === 'PERMISSION_DENIED') {
          setLocationStatus('denied');
          setLocationError('Location access is off. Allow location access to receive nearby parking suggestions.');
        } else if (error.code === 2) {
          setLocationStatus('unavailable');
          setLocationError('Your current location could not be determined.');
        } else {
          setLocationStatus('unavailable');
          setLocationError('Location tracking timed out. Please try again.');
        }
      },
    ).then((stop) => {
      if (isActive) stopWatching = stop;
      else stop();
    });

    return () => {
      isActive = false;
      stopWatching?.();
    };
  }, [activeTab, locationRequestKey]);

  useEffect(() => {
    if (!currentLocation) return;

    const controller = new AbortController();

    async function loadLocationSuggestions() {
      setIsSuggestionsLoading(true);
      setSuggestionsError(null);

      try {
        const response = await getNearbyParking(currentLocation.lat, currentLocation.lng, controller.signal);
        const data = await response.json().catch(() => null) as ParkingSearchResponse | null;

        if (!response.ok || !data?.success) {
          throw new Error(data?.message || `Nearby parking lookup failed (${response.status})`);
        }
        if (!Array.isArray(data.data)) throw new Error('Nearby parking returned an invalid data list.');

        const orderedSpots = data.data
          .map(mapParkingResult)
          .sort((first, second) => distanceFromUser(currentLocation, first) - distanceFromUser(currentLocation, second));

        setSuggestedSpots(orderedSpots);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSuggestedSpots([]);
        setSuggestionsError(error instanceof Error ? error.message : 'Unable to find parking near your current location.');
      } finally {
        if (!controller.signal.aborted) setIsSuggestionsLoading(false);
      }
    }

    loadLocationSuggestions();
    return () => controller.abort();
  }, [currentLocation]);

  useEffect(() => {
    if (!selectedStationCoords) {
      setNearbySpots([]);
      setNearbyError(null);
      setIsNearbyLoading(false);
      return;
    }

    const radiusKm = Math.max(0.5, distanceFilter / 1000);
    const cacheKey = selectedStation
      ? getStationCacheKey(selectedStation, selectedStationCoords.lat, selectedStationCoords.lng, distanceFilter)
      : '';

    if (cacheKey && nearbySpotCache[cacheKey]) {
      setNearbySpots(nearbySpotCache[cacheKey]);
      setNearbyError(null);
      setIsNearbyLoading(false);
      setSelectedSpot(null);
      return;
    }

    const controller = new AbortController();

    async function loadNearbySpots() {
      setIsNearbyLoading(true);
      setNearbyError(null);

      try {
        const res = await getNearbyParking(selectedStationCoords.lat, selectedStationCoords.lng, radiusKm, controller.signal);

        const data = await res.json().catch(() => null) as ParkingSearchResponse | null;
        if (!res.ok || !data?.success) throw new Error(data?.message || `Nearby search failed (${res.status})`);
        if (!Array.isArray(data.data)) throw new Error('Nearby search returned an invalid data list.');

        const fetchedSpots = data.data.map(mapParkingResult);

        setNearbySpots(fetchedSpots);
        setNearbySpotCache((previousCache) => ({
          ...previousCache,
          [cacheKey || getStationCacheKey(selectedStation || '', selectedStationCoords.lat, selectedStationCoords.lng, distanceFilter)]: fetchedSpots,
        }));
        setSelectedSpot(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setNearbySpots([]);
        setNearbyError(error instanceof Error ? error.message : 'Unable to load nearby parking right now.');
      } finally {
        if (!controller.signal.aborted) {
          setIsNearbyLoading(false);
        }
      }
    }

    loadNearbySpots();

    return () => controller.abort();
  }, [distanceFilter, nearbySpotCache, selectedStation, selectedStationCoords]);

  const handleParkingSearch = async (event: FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchError('Enter a property, address, area, or station name.');
      return;
    }

    setIsSearchLoading(true);
    setSearchError(null);
    setSearchMeta(null);

    try {
      const res = await searchParking(query);
      const data = await res.json().catch(() => null) as ParkingSearchResponse | null;
      if (!res.ok || !data?.success) throw new Error(data?.message || `Parking search failed (${res.status})`);
      if (!Array.isArray(data.data)) throw new Error('Parking search returned an invalid data list.');

      setSearchSpots(data.data.map(mapParkingResult));
      setSearchMeta({
        totalCount: data.totalCount,
        page: data.page,
        pageSize: data.pageSize,
      });
    } catch (error) {
      setSearchSpots([]);
      setSearchError(error instanceof Error ? error.message : 'Unable to search for parking right now.');
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleMapStationSelect = (name: string, lat: number, lng: number, stopId?: string) => {
    setSelectedStation(name);
    setSelectedStationCoords({ lat, lng });
    if (stopId) setSelectedStationId(stopId);
    setSelectedSpot(null);
  };

  const handleSheetParkingSpotSelect = (spot: StationNearbyParkingSpot) => {
    const existing = lensSpots.find((s) => s.parkingSpotId === spot.parkingSpotId);
    if (existing) {
      setSelectedSpot(existing);
      return;
    }
    const syntheticSpot: ParkingSpot = {
      id: String(spot.parkingSpotId),
      parkingSpotId: spot.parkingSpotId,
      parkingLabel: spot.parkingLabel,
      propertyId: spot.propertyId,
      propertyName: spot.propertyName,
      address: spot.address,
      latitude: selectedStationCoords?.lat || 0,
      longitude: selectedStationCoords?.lng || 0,
      stationName: selectedStation,
      distanceToStation: spot.distanceMeters / 1000,
      timeToStationInMinutes: spot.walkingTimeMinutes,
      availabilityStatus: spot.availabilityStatus,
      monthlyRate: spot.monthlyRate,
      dailyRate: spot.dailyRate,
      primaryImageUrl: spot.primaryImageUrl,
      station: selectedStation,
      name: spot.propertyName,
      pricePerHour: 0,
      distance: Math.round(spot.distanceMeters),
      lat: selectedStationCoords?.lat || 0,
      lng: selectedStationCoords?.lng || 0,
      available: spot.availabilityStatus.toLowerCase() === 'available',
      type: 'Condo Bay',
      owner: `Property #${spot.propertyId}`,
    };
    setSelectedSpot(syntheticSpot);
  };

  const handleCommuterBrandClick = () => {
    setActiveTab('home');
    setSelectedSpot(null);
    navigate('/commuter', { replace: true, state: { activeTab: 'home' } });
  };

  const openParkingDetail = (
    spot: ParkingSpot,
    origin: StationCoordinates | null = selectedStationCoords,
    originName = selectedStation || spot.station,
  ) => {
    navigate(`/commuter/parking/${spot.id}`, {
      state: {
        spot: {
          ...spot,
          id: spot.id,
          lat: spot.lat,
          lon: spot.lng,
          address: spot.address,
          photoUrl: spot.primaryImageUrl ?? '',
          price: spot.pricePerHour,
        },
        stationCoords: origin
          ? { lat: origin.lat, lon: origin.lng }
          : null,
        stationName: originName,
      },
    });
  };

  // Countdown timer effect
  useEffect(() => {
    let timer: any;
    if (activeBooking && secondsRemaining > 0) {
      timer = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 300) {
            setShowGraceAlert(true);
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeBooking, secondsRemaining]);

  // Format countdown duration
  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const refreshWalletBalance = useCallback(async (showLoading = true) => {
    if (!user?.token) return;
    if (showLoading) setIsWalletRefreshing(true);

    try {
      const wallet = await getWalletSummary(user.token);
      setWalletBalance(wallet.balance);
      setWalletLoadError(null);
    } catch (error) {
      setWalletLoadError(error instanceof Error ? error.message : 'Unable to load your wallet balance.');
    } finally {
      if (showLoading) setIsWalletRefreshing(false);
    }
  }, [user?.token]);

  const reconcilePendingTopUp = useCallback(async (
    payment: PendingWalletTopUp,
    options: { openWhenAvailable?: boolean; silent?: boolean; checkoutWindow?: Window | null } = {},
  ): Promise<WalletTopUpState | 'error'> => {
    if (!user?.token || walletReconciliationRef.current) {
      closeExternalWindow(options.checkoutWindow);
      return 'error';
    }
    walletReconciliationRef.current = true;
    let checkoutWindowTransferred = false;
    if (!options.silent) setIsWalletRefreshing(true);

    try {
      const status: WalletTopUpStatus = await getWalletTopUpStatus(user.token, payment.sessionId);
      setWalletBalance(status.walletBalance);
      setWalletLoadError(null);

      const reconciledPayment: PendingWalletTopUp = {
        ...payment,
        paymentId: status.paymentId,
        sessionId: status.sessionId,
        amount: status.amount > 0 ? status.amount : payment.amount,
        checkoutUrl: status.checkoutUrl || payment.checkoutUrl,
        stage: status.state === 'open' ? 'checkout' : 'confirming',
      };

      if (status.state === 'completed' && status.isCredited) {
        clearPendingWalletTopUp(user.userId);
        setPendingTopUp(null);
        setWalletTopUpFeedback({
          tone: 'success',
          title: 'Top-up completed',
          message: `${status.currency} ${status.amount.toFixed(2)} has been credited to your wallet.`,
          payment: reconciledPayment,
        });
        closeExternalWindow(localCheckoutWindowRef.current);
        localCheckoutWindowRef.current = null;
        return status.state;
      }

      if (status.state === 'processing') {
        // A completed Stripe session cannot be reopened. Keep its receipt in the
        // verification card, but do not let that terminal link block a new top-up.
        clearPendingWalletTopUp(user.userId);
        setPendingTopUp(null);
        setWalletTopUpFeedback({
          tone: 'processing',
          title: 'Confirming your payment',
          message: 'Stripe received the payment. ParkJom is waiting for the verified webhook before showing it in your balance; this completed checkout will not block another top-up.',
          payment: reconciledPayment,
        });
        closeExternalWindow(localCheckoutWindowRef.current);
        localCheckoutWindowRef.current = null;
        return status.state;
      }

      if (status.state === 'open' && status.canContinue && status.checkoutUrl) {
        const checkoutUrl = new URL(status.checkoutUrl);
        if (checkoutUrl.protocol !== 'https:') throw new Error('The checkout URL was not secure.');

        reconciledPayment.checkoutUrl = checkoutUrl.toString();
        savePendingWalletTopUp(reconciledPayment);
        setPendingTopUp(reconciledPayment);

        if (options.openWhenAvailable) {
          await openExternalUrl(checkoutUrl.toString(), options.checkoutWindow);
          checkoutWindowTransferred = true;
          setWalletTopUpFeedback({
            tone: 'info',
            title: 'Checkout reopened',
            message: isLocalWebHost()
              ? 'Checkout reopened in a new tab. Return to this local tab when you are done so ParkJom can verify the payment.'
              : 'This Stripe session is still active. Complete it there, then ParkJom will verify the payment automatically.',
            payment: reconciledPayment,
          });
        }
        return status.state;
      }

      clearPendingWalletTopUp(user.userId);
      setPendingTopUp(null);
      setWalletTopUpFeedback({
        tone: 'warning',
        title: status.state === 'expired'
          ? 'Checkout expired'
          : status.state === 'cancelled'
            ? 'Top-up cancelled'
            : status.state === 'failed'
              ? 'Top-up failed'
              : 'Checkout cannot continue',
        message: status.message || 'The saved Stripe session can no longer be used. Start a new top-up to continue.',
        payment: reconciledPayment,
        action: 'new-topup',
      });
      closeExternalWindow(localCheckoutWindowRef.current);
      localCheckoutWindowRef.current = null;
      return status.state;
    } catch (error) {
      if (!options.silent) {
        setWalletTopUpFeedback({
          tone: 'warning',
          title: 'Could not check this checkout',
          message: `${error instanceof Error ? error.message : 'The checkout status is temporarily unavailable.'} You can retry, or remove only this saved link to start again. Removing it does not cancel or reverse a Stripe payment.`,
          payment,
          action: 'retry-status',
          allowNewTopUp: true,
        });
      }
      return 'error';
    } finally {
      if (!checkoutWindowTransferred) closeExternalWindow(options.checkoutWindow);
      walletReconciliationRef.current = false;
      if (!options.silent) setIsWalletRefreshing(false);
    }
  }, [user?.token, user?.userId]);

  const startNewTopUp = () => {
    clearPendingWalletTopUp(user?.userId);
    setPendingTopUp(null);
    setWalletTopUpFeedback(null);
    setTopUpAmount('');
    setTopUpDescription('');
    setTopUpError(null);
    setShowTopUpModal(true);
  };

  const resumePendingTopUp = async () => {
    if (!pendingTopUp) return;

    const checkoutWindow = reserveExternalWindow();
    localCheckoutWindowRef.current = checkoutWindow;
    if (isLocalWebHost() && !checkoutWindow) {
      setWalletTopUpFeedback({
        tone: 'warning',
        title: 'Checkout window blocked',
        message: 'Allow pop-ups for localhost, then try continuing this checkout again.',
        payment: pendingTopUp,
        action: 'retry-status',
      });
      return;
    }

    const state = await reconcilePendingTopUp(pendingTopUp, {
      openWhenAvailable: true,
      checkoutWindow,
    });
    if (state !== 'open') localCheckoutWindowRef.current = null;
  };

  const openTopUpModal = () => {
    if (pendingTopUp) {
      void resumePendingTopUp();
      return;
    }
    setTopUpError(null);
    setWalletTopUpFeedback(null);
    setShowTopUpModal(true);
  };

  const refreshWalletActivity = useCallback(async () => {
    if (!user?.token) return;
    setIsWalletActivityLoading(true);
    setIsTopUpHistoryLoading(true);
    try {
      const [historyResult, topUpResult] = await Promise.allSettled([
        getWalletHistory(user.token, { page: 1, pageSize: 50 }),
        getWalletTopUpHistory(user.token, 1, 10),
      ]);
      if (historyResult.status === 'fulfilled') {
        setWalletTransactions(historyResult.value.data);
      }
      if (topUpResult.status === 'fulfilled') {
        setTopUpHistory(topUpResult.value.data);
      }
    } catch {
      // keep existing on error
    } finally {
      setIsWalletActivityLoading(false);
      setIsTopUpHistoryLoading(false);
    }
  }, [user?.token]);

  const refreshTopUpHistory = refreshWalletActivity;

  const allWalletActivities = useMemo(() => {
    interface ActivityItem {
      id: string;
      type: 'topup' | 'deduction' | 'refund';
      category: 'topup' | 'deduction';
      title: string;
      subtitle: string;
      amount: number;
      currency: string;
      status: string;
      createdAt: string;
      isPending?: boolean;
    }

    const list: ActivityItem[] = [];
    const seenRefs = new Set<string>();

    for (const item of walletTransactions) {
      const isDeduction = item.amount < 0 || item.type === 'Payment' || item.type === 'Withdrawal' || item.type === 'OverstayPenalty';
      const isRefund = item.type === 'Refund';

      let type: 'topup' | 'deduction' | 'refund' = 'topup';
      let category: 'topup' | 'deduction' = 'topup';
      let title = 'Wallet top-up';

      if (isRefund) {
        type = 'refund';
        category = 'topup';
        title = 'Booking refund';
      } else if (item.type === 'Payment') {
        type = 'deduction';
        category = 'deduction';
        title = 'Parking payment';
      } else if (item.type === 'OverstayPenalty') {
        type = 'deduction';
        category = 'deduction';
        title = 'Overstay penalty';
      } else if (item.type === 'Withdrawal') {
        type = 'deduction';
        category = 'deduction';
        title = 'Wallet withdrawal';
      } else if (isDeduction) {
        type = 'deduction';
        category = 'deduction';
        title = 'Wallet deduction';
      }

      const dateStr = item.createdAt
        ? new Date(item.createdAt).toLocaleDateString('en-MY')
        : '';

      const refPart = item.bookingId
        ? `Booking #${item.bookingId}`
        : item.referenceNumber
        ? `Ref #${item.referenceNumber.length > 20 ? item.referenceNumber.slice(0, 20) + '...' : item.referenceNumber}`
        : `Tx #${item.transactionId}`;

      const subtitle = `${refPart} · ${item.status || 'Completed'} · ${dateStr}`;

      if (item.referenceNumber) {
        seenRefs.add(item.referenceNumber.toLowerCase());
      }

      list.push({
        id: `tx-${item.transactionId}`,
        type,
        category,
        title,
        subtitle,
        amount: Math.abs(item.amount),
        currency: 'MYR',
        status: item.status || 'Completed',
        createdAt: item.createdAt,
        isPending: item.status?.toLowerCase() === 'pending',
      });
    }

    for (const item of topUpHistory) {
      const isPending = item.status?.toLowerCase() === 'pending';
      const topUpRef = `topup-${item.paymentId}`.toLowerCase();
      if (seenRefs.has(topUpRef) || seenRefs.has(`payment-${item.paymentId}`)) continue;

      if (isPending || walletTransactions.length === 0) {
        const dateStr = item.createdAt
          ? new Date(item.createdAt).toLocaleDateString('en-MY')
          : '';
        list.push({
          id: `topup-${item.paymentId}`,
          type: 'topup',
          category: 'topup',
          title: 'Wallet top-up',
          subtitle: `Payment #${item.paymentId} · ${item.status} · ${dateStr}`,
          amount: Math.abs(item.amount),
          currency: item.currency || 'MYR',
          status: item.status,
          createdAt: item.createdAt,
          isPending,
        });
      }
    }

    return list.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });
  }, [walletTransactions, topUpHistory]);

  const filteredActivities = useMemo(() => {
    if (walletActivityFilter === 'all') return allWalletActivities;
    return allWalletActivities.filter((a) => a.category === walletActivityFilter);
  }, [allWalletActivities, walletActivityFilter]);

  const ACTIVITY_PAGE_SIZE = 10;
  const totalActivityPages = Math.max(1, Math.ceil(filteredActivities.length / ACTIVITY_PAGE_SIZE));
  const paginatedActivities = useMemo(() => {
    const start = (walletActivityPage - 1) * ACTIVITY_PAGE_SIZE;
    return filteredActivities.slice(start, start + ACTIVITY_PAGE_SIZE);
  }, [filteredActivities, walletActivityPage]);

  const handleCancelBooking = async (bookingId: number) => {
    if (!user?.token || cancelingBookingId !== null) return;
    const confirmed = await showConfirm({
      title: 'Cancel Booking',
      message: 'Are you sure you want to cancel this booking? Cancellations 3+ days before start receive a 100% refund; less than 3 days before start receive a 50% refund.',
      confirmText: 'Yes, Cancel',
      cancelText: 'Keep Booking',
      variant: 'danger',
      icon: 'trash',
    });
    if (!confirmed) return;

    setCancelingBookingId(bookingId);
    try {
      const res = await cancelBooking(user.token, {
        bookingId,
        cancellationReason: 'Cancelled by commuter',
      });
      await showAlert({
        title: 'Booking Cancelled',
        message: res.message || 'Your booking has been cancelled successfully.',
        variant: 'success',
      });
      if (activeBooking?.bookingId === bookingId) {
        clearJourneySession(user?.userId);
        setActiveBooking(null);
      setUpcomingBookings([]);
        setJourneyStage('reserved');
        setIsBollardUnlocked(false);
        setBollardAnimationState('raised');
      }
      setBookingHistoryRefreshKey((prev) => prev + 1);
      setActiveBookingRefreshKey((prev) => prev + 1);
    } catch (err) {
      await showAlert({
        title: 'Cancellation Failed',
        message: err instanceof Error ? err.message : 'Unable to cancel booking.',
        variant: 'danger',
      });
    } finally {
      setCancelingBookingId(null);
    }
  };

  useEffect(() => {
    if (activeTab !== 'wallet' || !user?.token) return;

    void refreshWalletBalance();
    void refreshTopUpHistory();
    const storedPayment = loadPendingWalletTopUp(user.userId);
    if (storedPayment) void reconcilePendingTopUp(storedPayment);
  }, [activeTab, reconcilePendingTopUp, refreshTopUpHistory, refreshWalletBalance, user?.token, user?.userId]);

  // Stripe's web callback is configured for the deployed site. On localhost,
  // re-check the pending session when the local app becomes visible again.
  useEffect(() => {
    if (!isLocalWebHost() || activeTab !== 'wallet' || !user?.token || !pendingTopUp) return;

    const reconcileWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const storedPayment = loadPendingWalletTopUp(user.userId) || pendingTopUp;
      void reconcilePendingTopUp(storedPayment, { silent: true });
    };

    window.addEventListener('focus', reconcileWhenVisible);
    window.addEventListener('pageshow', reconcileWhenVisible);
    document.addEventListener('visibilitychange', reconcileWhenVisible);

    return () => {
      window.removeEventListener('focus', reconcileWhenVisible);
      window.removeEventListener('pageshow', reconcileWhenVisible);
      document.removeEventListener('visibilitychange', reconcileWhenVisible);
    };
  }, [activeTab, pendingTopUp, reconcilePendingTopUp, user?.token, user?.userId]);

  // Keep the localhost app authoritative while Stripe runs in its own window.
  // Once the API reports a terminal state, close that window and show the result here.
  useEffect(() => {
    if (!isLocalWebHost() || activeTab !== 'wallet' || !user?.token || !pendingTopUp) return;

    let disposed = false;
    let timer: number | undefined;

    const pollLocalCheckout = async () => {
      const checkoutWindow = localCheckoutWindowRef.current;
      if (!checkoutWindow || checkoutWindow.closed) {
        localCheckoutWindowRef.current = null;
        return;
      }

      const storedPayment = loadPendingWalletTopUp(user.userId) || pendingTopUp;
      const state = await reconcilePendingTopUp(storedPayment, { silent: true });
      if (disposed) return;

      if (state !== 'open' && state !== 'error') {
        closeExternalWindow(checkoutWindow);
        localCheckoutWindowRef.current = null;
        window.focus();
        return;
      }

      timer = window.setTimeout(pollLocalCheckout, 5000);
    };

    timer = window.setTimeout(pollLocalCheckout, 2500);
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [activeTab, pendingTopUp, reconcilePendingTopUp, user?.token, user?.userId]);

  useEffect(() => {
    const processingPayment = walletTopUpFeedback?.tone === 'processing'
      ? walletTopUpFeedback.payment
      : null;
    if (activeTab !== 'wallet' || !processingPayment) return;

    const payment = processingPayment;
    let disposed = false;
    let attempts = 0;
    let timer: number | undefined;

    const poll = async () => {
      attempts += 1;
      const state = await reconcilePendingTopUp(payment, { silent: true });
      if (!disposed && state === 'processing' && attempts < 6) {
        timer = window.setTimeout(poll, 3000);
      }
    };

    timer = window.setTimeout(poll, 2500);
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [
    activeTab,
    reconcilePendingTopUp,
    walletTopUpFeedback?.payment?.sessionId,
    walletTopUpFeedback?.tone,
  ]);

  // Create the authenticated Stripe Checkout session. The wallet balance is
  // updated only after the backend confirms payment, never optimistically here.
  const handleTopUp = async (event: FormEvent) => {
    event.preventDefault();
    if (isTopUpLoading) return;
    const amount = Number(topUpAmount);
    const description = topUpDescription.trim();

    if (!Number.isFinite(amount) || amount <= 10 || amount >= 5000) {
      setTopUpError('Top-up amount must be greater than RM 10.00 and less than RM 5,000.00.');
      return;
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(topUpAmount.trim())) {
      setTopUpError('Enter an amount with no more than two decimal places.');
      return;
    }
    if (!user?.token) {
      setTopUpError('Your commuter session is missing an authorization token. Please sign in again.');
      return;
    }

    setIsTopUpLoading(true);
    setTopUpError(null);
    const checkoutWindow = reserveExternalWindow();
    localCheckoutWindowRef.current = checkoutWindow;
    if (isLocalWebHost() && !checkoutWindow) {
      setTopUpError('Allow pop-ups for localhost to open secure checkout.');
      setIsTopUpLoading(false);
      return;
    }

    try {
      const data = await createWalletTopUp(
        user.token,
        Number(amount.toFixed(2)),
        description,
        isNativeApp ? 'native' : 'web',
      );

      const checkoutUrl = new URL(data.checkoutUrl);
      if (checkoutUrl.protocol !== 'https:') throw new Error('The payment checkout URL was not secure.');

      const pendingPayment: PendingWalletTopUp = {
        userId: user.userId,
        paymentId: data.paymentId,
        sessionId: data.sessionId,
        checkoutUrl: checkoutUrl.toString(),
        amount: Number(amount.toFixed(2)),
        description: description || 'Wallet top-up',
        message: data.message,
        createdAt: new Date().toISOString(),
        stage: 'checkout',
      };
      setPendingTopUp(pendingPayment);
      savePendingWalletTopUp(pendingPayment);
      await openExternalUrl(checkoutUrl.toString(), checkoutWindow);
      setShowTopUpModal(false);
      setIsTopUpLoading(false);
      setWalletTopUpFeedback({
        tone: 'info',
        title: 'Checkout opened',
        message: isLocalWebHost()
          ? 'Checkout opened in a new tab. Keep this local tab open and return here when you are done.'
          : 'Complete the secure Stripe checkout. If you close it, you can continue this pending payment from your wallet.',
        payment: pendingPayment,
      });
    } catch (error) {
      closeExternalWindow(checkoutWindow);
      localCheckoutWindowRef.current = null;
      setTopUpError(error instanceof Error ? error.message : 'Unable to start wallet checkout.');
      setIsTopUpLoading(false);
    }
  };

  // Add a vehicle to the authenticated commuter account.
  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setVehicleFeedback(null);

    if (!user?.token) {
      setVehicleFeedback({ tone: 'error', message: 'Your commuter session is missing an authorization token.' });
      return;
    }

    const numberPlate = newPlate.trim().toUpperCase();
    const vehicleBrand = newBrand.trim();
    const vehicleModel = newModel.trim();
    const vehicleColor = newColor.trim();

    if (!numberPlate || !vehicleBrand || !vehicleModel || !vehicleColor) {
      setVehicleFeedback({ tone: 'error', message: 'Number plate, brand, model, and color are required.' });
      return;
    }

    setIsVehicleSaving(true);
    try {
      const created = await createVehicleRequest(user.token, {
        numberPlate,
        vehicleBrand,
        vehicleModel,
        vehicleColor,
      });
      if (!created.data) {
        throw new Error('The vehicle service did not return the new vehicle.');
      }

      const newVehicle = mapApiVehicleToVehicle(created.data, true);
      setVehicles((current) => [
        ...current.map((vehicle) => ({ ...vehicle, active: false })),
        newVehicle,
      ]);
      setVehiclesLoadError(null);
      setNewPlate('');
      setNewBrand('');
      setNewModel('');
      setNewColor('');
      setShowAddVehicle(false);
      setVehicleFeedback({ tone: 'success', message: created.message || 'Vehicle added successfully.' });
    } catch (error) {
      setVehicleFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to add this vehicle.',
      });
    } finally {
      setIsVehicleSaving(false);
    }
  };

  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    setVehicleFeedback(null);
    if (!user?.token) {
      setVehicleFeedback({ tone: 'error', message: 'Your commuter session is missing an authorization token.' });
      return;
    }
    if (vehicle.vehicleId === null) {
      setVehicleFeedback({ tone: 'error', message: 'This vehicle is missing its backend vehicle ID and cannot be deleted.' });
      return;
    }
    const confirmed = await showConfirm({
      title: 'Delete Vehicle',
      message: `Delete vehicle ${vehicle.plate}? This action cannot be undone.`,
      confirmText: 'Delete Vehicle',
      cancelText: 'Cancel',
      variant: 'danger',
      icon: 'trash',
    });
    if (!confirmed) return;

    setVehicleDeletingId(vehicle.vehicleId);
    try {
      const removed = await deleteVehicleRequest(user.token, vehicle.vehicleId);
      setVehicles((current) => {
        const remaining = current.filter((item) => item.vehicleId !== vehicle.vehicleId);
        if (!vehicle.active || remaining.some((item) => item.active) || remaining.length === 0) return remaining;
        return remaining.map((item, index) => ({ ...item, active: index === 0 }));
      });
      setVehiclesLoadError(null);
      if (vehicleEditDraft?.vehicleId === vehicle.vehicleId) setVehicleEditDraft(null);
      setVehicleFeedback({ tone: 'success', message: removed.message || 'Vehicle deleted successfully.' });
    } catch (error) {
      setVehicleFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to delete this vehicle.',
      });
    } finally {
      setVehicleDeletingId(null);
    }
  };

  const beginVehicleEdit = (vehicle: Vehicle) => {
    if (vehicle.vehicleId === null) {
      setVehicleFeedback({
        tone: 'error',
        message: 'This vehicle is missing its backend vehicle ID and cannot be edited yet.',
      });
      return;
    }

    setShowAddVehicle(false);
    setVehicleFeedback(null);
    setVehicleEditDraft({
      vehicleId: vehicle.vehicleId,
      numberPlate: vehicle.plate,
      vehicleBrand: vehicle.brand,
      vehicleModel: vehicle.model,
      vehicleColor: vehicle.color,
    });
  };

  const handleModifyVehicle = async (event: React.FormEvent) => {
    event.preventDefault();
    setVehicleFeedback(null);

    if (!user?.token) {
      setVehicleFeedback({ tone: 'error', message: 'Your commuter session is missing an authorization token.' });
      return;
    }
    if (!vehicleEditDraft) return;

    const request = {
      vehicleId: vehicleEditDraft.vehicleId,
      numberPlate: vehicleEditDraft.numberPlate.trim().toUpperCase(),
      vehicleBrand: vehicleEditDraft.vehicleBrand.trim(),
      vehicleModel: vehicleEditDraft.vehicleModel.trim(),
      vehicleColor: vehicleEditDraft.vehicleColor.trim(),
    };
    if (!request.numberPlate || !request.vehicleBrand || !request.vehicleModel || !request.vehicleColor) {
      setVehicleFeedback({ tone: 'error', message: 'Number plate, brand, model, and color are required.' });
      return;
    }

    setIsVehicleUpdating(true);
    try {
      const updated = await modifyVehicleRequest(user.token, request);
      const patch = mapApiVehicleToVehicle(updated.data);
      setVehicles((current) =>
        current.map((item) =>
          item.vehicleId === request.vehicleId
            ? { ...item, plate: patch.plate, brand: patch.brand, model: patch.model, color: patch.color }
            : item
        )
      );
      setVehiclesLoadError(null);
      setVehicleEditDraft(null);
      setVehicleFeedback({ tone: 'success', message: updated.message || 'Vehicle updated successfully.' });
    } catch (error) {
      setVehicleFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to update this vehicle.',
      });
    } finally {
      setIsVehicleUpdating(false);
    }
  };

  // Select active vehicle
  const setActiveVehicle = (plate: string) => {
    setVehicles(prev => prev.map(v => ({
      ...v,
      active: v.plate === plate
    })));
  };

  // Booking action
  const handleBookSpot = (spot: ParkingSpot) => {
    const activeVeh = vehicles.find(v => v.active)?.plate ?? '';
    if (walletBalance === null) {
      void showAlert({
        title: 'Wallet Unavailable',
        message: 'Your wallet balance is not available yet. Open Wallet to review or top up your account.',
        variant: 'warning',
      });
      setActiveTab('wallet');
      return;
    }
    if (walletBalance < spot.pricePerHour * 2) {
      void showAlert({
        title: 'Insufficient Balance',
        message: 'Insufficient wallet balance. Please top up your wallet (minimum RM 10.00 required for reserve hold).',
        buttonText: 'Top Up Wallet',
        variant: 'warning',
      });
      openTopUpModal();
      return;
    }

    // Deduct 2 hours advance deposit
    const cost = spot.pricePerHour * 2;
    setWalletBalance(prev => prev === null ? null : prev - cost);

    const booking: Booking = {
      id: 'BK-' + Math.floor(1000 + Math.random() * 9000),
      spot: spot,
      startTime: new Date(),
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      vehiclePlate: activeVeh,
      status: 'Active',
      totalPaid: cost
    };

    setActiveBooking(booking);
    saveJourneySession(booking, 'reserved', user?.userId);
    setJourneyStage('reserved');
    setSecondsRemaining(7200); // 2 hours
    setIsBollardUnlocked(false);
    setBollardAnimationState('raised');
    setSelectedSpot(null);
    setActiveTab('active');

    // Create Notification
    const newNotif: AppNotification = {
      id: 'book-' + Date.now(),
      title: 'Booking Confirmed!',
      message: `Reserved ${spot.name} near ${spot.station}. e-wallet held RM ${cost.toFixed(2)}.`,
      time: 'Just now',
      read: false,
      type: 'booking'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // Release booking (simulation)
  const handleCompleteBooking = () => {
    if (activeBooking && journeyStage === 'parked' && bollardAnimationState === 'raised') {
      const completed: Booking = {
        ...activeBooking,
        status: 'Completed',
        endTime: new Date()
      };
      setHistory(prev => [completed, ...prev]);
      setActiveBooking(null);
      setUpcomingBookings([]);
      clearJourneySession(user?.userId);
      setJourneyStage('reserved');
      setIsBollardUnlocked(false);
      setBollardAnimationState('raised');

      const newNotif: AppNotification = {
        id: 'complete-' + Date.now(),
        title: 'Booking Finished',
        message: `Your session at ${completed.spot.name} has concluded. Thank you for using ParkJom!`,
        time: 'Just now',
        read: false,
        type: 'booking'
      };
      setNotifications(prev => [newNotif, ...prev]);
      navigate(`/commuter/parking/${completed.spot.parkingSpotId}/review`, { state: { booking: completed } });
    }
  };

  // IoT Bollard unlock flow — command is dispatched by the backend, not simulated.
  const handleUnlockBollard = async () => {
    if (gpsVerified !== 'verified') {
      void showAlert({
        title: 'GPS Verification Required',
        message: 'Access Denied. You must arrive and verify your GPS location near the parking spot before unlocking.',
        variant: 'warning',
      });
      return;
    }

    const token = user?.token ?? '';
    if (!token) {
      void showAlert({
        title: 'Session expired',
        message: 'Your session is no longer valid. Sign in again to unlock the barrier.',
        variant: 'warning',
      });
      return;
    }

    if (!activeBooking) return;

    if (!activeBooking.bookingId) {
      void showAlert({
        title: 'Booking not linked',
        message: 'This parking pass is not linked to a server booking yet, so the barrier cannot be released. Open your booking history, refresh, and try again.',
        variant: 'warning',
      });
      return;
    }

    setBollardAnimationState('lowering');

    try {
      const result = await selfUnlockGate(token, {
        bookingId: activeBooking.bookingId,
        action: 'Enter',
      });

      if (!result.success) {
        setBollardAnimationState('raised');
        void showAlert({
          title: 'Barrier did not release',
          message: result.message
            || 'The barrier could not be released. Please raise a support request for assistance.',
          variant: 'warning',
        });
        return;
      }

      setBollardAnimationState('lowered');
      setIsBollardUnlocked(true);
      setJourneyStage('unlocked');
      updateJourneyStage('unlocked', user?.userId);

      const newNotif: AppNotification = {
        id: 'iot-' + Date.now(),
        title: 'Barrier released',
        message: result.commandId
          ? `Command ${result.commandId} accepted for ${activeBooking.spot.name}. You may now park.`
          : `The barrier at ${activeBooking.spot.name} has been released. You may now park.`,
        time: 'Just now',
        read: false,
        type: 'alert'
      };
      setNotifications(prev => [newNotif, ...prev]);
    } catch (error) {
      setBollardAnimationState('raised');
      void showAlert({
        title: 'Barrier did not release',
        message: error instanceof Error
          ? error.message
          : 'The gate unlock request failed. Please raise a support request for assistance.',
        variant: 'danger',
      });
    }
  };

  // Smart lock bollard flow
  const handleLockBollard = () => {
    setBollardAnimationState('raising');
    setTimeout(() => {
      setBollardAnimationState('raised');
      setIsBollardUnlocked(false);
      setJourneyStage('parked');
      updateJourneyStage('parked', user?.userId);
    }, 2000);
  };

  /**
   * Real arrival check: read the device position and compare it with the bay.
   * When the bay has no coordinates on file we still require a genuine GPS fix
   * but say so plainly, rather than reporting "verified" unconditionally.
   */
  const triggerGPSCheck = async () => {
    setGpsVerified('checking');

    let position;
    try {
      position = await getDeviceLocation();
    } catch (error) {
      setGpsVerified('unverified');
      void showAlert({
        title: 'Location check failed',
        message: error instanceof DeviceLocationError
          ? error.message
          : 'We could not read your device location. Check that location services are enabled and try again.',
        variant: 'warning',
      });
      return;
    }

    const bay = resolveSpotCoordinates(activeBooking?.spot);

    if (!bay) {
      setGpsVerified('verified');
      setJourneyStage('arrived');
      updateJourneyStage('arrived', user?.userId);
      void showAlert({
        title: 'Location confirmed',
        message: 'We confirmed your device location, but this bay has no map coordinates on file, so your distance from it could not be measured. Your booking window is still validated when the barrier is released.',
        variant: 'info',
      });
      return;
    }

    const check = isWithinArrivalRadius(position, bay);

    if (!check.arrived) {
      setGpsVerified('unverified');
      void showAlert({
        title: 'Not at the parking spot yet',
        message: `You are about ${Math.round(check.distance)} m from this bay. Move closer than ${Math.round(check.tolerance)} m and verify again.`,
        variant: 'warning',
      });
      return;
    }

    setGpsVerified('verified');
    setJourneyStage('arrived');
    updateJourneyStage('arrived', user?.userId);
  };

  // QR Code Camera/Scan simulation
  const startQRScanner = async () => {
    setShowQRScanner(true);
    setScannerCameraActive(true);
    setQrCodeScanned(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.log('Webcam feed unavailable, falling back to mock scanner beam simulation.');
    }
  };

  const closeQRScanner = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setScannerCameraActive(false);
    setShowQRScanner(false);
  };

  useEffect(() => {
    const dialog = showQRScanner
      ? qrDialogRef.current
      : showTopUpModal
        ? topUpDialogRef.current
        : showNotificationsDrawer
          ? notificationDrawerRef.current
          : null;
    if (!dialog) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    const focusFirst = () => {
      const first = dialog.querySelector<HTMLElement>(focusableSelector);
      (first || dialog).focus();
    };
    const frame = window.requestAnimationFrame(focusFirst);

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (showQRScanner) closeQRScanner();
        else if (showTopUpModal && !isTopUpLoading) setShowTopUpModal(false);
        else setShowNotificationsDrawer(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleDialogKeyDown);
      previouslyFocused?.focus();
    };
  }, [isTopUpLoading, showNotificationsDrawer, showQRScanner, showTopUpModal]);

  // Mark all notifications as read
  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const commuterViewMeta = {
    home: { title: 'Parking near you', description: 'Compare verified bays around your route and choose with confidence.' },
    map: { title: 'Transit map', description: 'Choose a rail station and compare nearby verified parking bays.' },
    active: { title: 'My parking pass', description: 'Everything you need to arrive, unlock, park, and leave.' },
    wallet: { title: 'Wallet', description: 'Top up securely and keep track of every parking payment.' },
    profile: { title: 'Vehicles', description: 'Choose the vehicle attached to your next parking session.' },
    support: { title: 'Support', description: 'Report booking, access, wallet, payment, or account issues.' },
    favorites: { title: 'Favorites', description: 'Keep parking spaces you are interested in within easy reach.' },
  } as const;
  const commuterSidebarGroups = [
    {
      label: 'Discover',
      items: [
        { id: 'home', icon: Compass, label: 'Browse' },
        { id: 'map', icon: Map, label: 'Transit Map' },
      ],
    },
    {
      label: 'My Parking',
      items: [
        { id: 'active', icon: Unlock, label: 'My Pass', dot: Boolean(activeBooking) },
        { id: 'favorites', icon: Heart, label: 'Favorites', badge: favoriteSpots.length },
      ],
    },
    {
      label: 'Account',
      items: [
        { id: 'wallet', icon: Wallet, label: 'Wallet', badge: walletBalance === null ? null : `RM ${walletBalance.toFixed(2)}` },
        { id: 'profile', icon: Car, label: 'Vehicles', badge: vehicles.length },
        { id: 'support', icon: ClipboardList, label: 'Support' },
      ],
    },
  ];
  const commuterSearchItems = commuterSidebarGroups.flatMap((group) => group.items.map((item) => ({
    id: item.id,
    label: item.label,
    keywords: item.id === 'home'
      ? ['browse', 'parking near me', 'search parking']
      : item.id === 'active'
        ? ['parking pass', 'booking', 'reservation']
        : [commuterViewMeta[item.id as CommuterTab].title],
  })));

  const notificationActions = (
    <button
      type="button"
      onClick={() => setShowNotificationsDrawer(true)}
      aria-label="Notifications"
      className="relative p-2 text-[#5f6368] hover:text-[#111] hover:bg-black/[0.04] active:bg-black/[0.06] rounded-xl transition-colors"
    >
      <Bell size={18} strokeWidth={2} />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-[#ff3b30] text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );

  return (
    <div className="app-workspace commuter-workspace page-shell text-[#1d1d1f] flex" data-workspace-role="commuter" data-commuter-tab={activeTab}>
      <AppSidebar
        id="commuter-workspace-navigation"
        workspaceLabel="Commuter workspace"
        groups={commuterSidebarGroups}
        activeId={activeTab}
        onNavigate={(id) => { setActiveTab(id as CommuterTab); setSelectedSpot(null); }}
        onBrandClick={handleCommuterBrandClick}
        mobileOpen={sidebarOpen}
        onMobileOpenChange={setSidebarOpen}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        footer="Find, book, and manage transit parking."
      />

      <div className="workspace-main flex min-h-screen min-w-0 flex-1 flex-col">
      <DashboardHeader
        role="commuter"
        user={user}
        onSignOut={() => { logout(); navigate('/'); }}
        onBrandClick={handleCommuterBrandClick}
        showMenuButton
        onMenuClick={() => setSidebarOpen(true)}
        menuExpanded={sidebarOpen}
        menuControls="commuter-workspace-navigation"
        actions={notificationActions}
        hideDesktopBrand
        searchItems={commuterSearchItems}
        onSearchSelect={(id) => {
          setActiveTab(id as CommuterTab);
          setSelectedSpot(null);
          setSidebarOpen(false);
        }}
      />

      {/* ─── Main Layout ─── */}
      <div className={`commuter-content-grid flex-1 ${activeTab === 'map' ? 'max-w-[1520px]' : 'max-w-[1180px]'} w-full mx-auto px-4 md:px-8 pt-4 lg:pt-6 pb-20 md:pb-8`}>

        {/* Main Content */}
        <main className="min-h-0">
          <div className="workspace-heading workspace-heading--compact">
            <div>
              <h1>{commuterViewMeta[activeTab].title}</h1>
              <p>{commuterViewMeta[activeTab].description}</p>
            </div>
          </div>
          <PageTransition transitionKey={activeTab}>

          {/* Active booking banner */}
          {activeBooking && activeTab !== 'active' && (
            <div className="active-booking-banner w-full rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px] font-semibold mb-4 transition-all duration-200">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-2.5 w-2.5 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="active-booking-tag text-[10px] font-bold uppercase tracking-wider">Reserved Parking Bay</span>
                    <span className="active-booking-bay-badge text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">Bay {activeBooking.spot.parkingLabel}</span>
                  </div>
                  <div className="active-booking-spot-name truncate font-bold">{formatShortSpotName(activeBooking.spot.name)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="active-booking-timer font-mono font-bold px-3 py-1.5 rounded-xl text-xs">{formatTime(secondsRemaining)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSpot(activeBooking.spot);
                    setActiveTab('map');
                    setMobileTransitTab('transit');
                    setTransitWorkspaceMode('navigation');
                  }}
                  className="active-booking-drive-btn px-3.5 py-1.5 font-bold rounded-xl text-xs transition shadow-xs flex items-center gap-1.5"
                >
                  <Navigation size={13} />
                  <span>Drive to Bay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('active')}
                  className="active-booking-pass-btn px-3 py-1.5 font-semibold rounded-xl text-xs transition"
                >
                  Pass
                </button>
              </div>
            </div>
          )}

          {favoriteError && (
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="flex-1">{favoriteError}</span>
              <button type="button" onClick={() => setFavoriteError(null)} aria-label="Dismiss favorite error" className="rounded-md p-0.5 hover:bg-rose-100">
                <X size={14} />
              </button>
            </div>
          )}

          {/* ─── TAB: Home / Discovery ─── */}
          {activeTab === 'home' && (
            <div className="space-y-4">
              <section className="bg-white rounded-2xl border border-[#e8eaed] p-4" aria-live="polite">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eff6ff] text-[#007AFF]">
                      {locationStatus === 'locating' ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[12px] font-semibold text-[#5f6368] uppercase tracking-wider">Parking near you</h3>
                      <p className="mt-1 text-[11px] text-[#9ca3af]">
                        {locationStatus === 'ready'
                          ? `Live location active${locationAccuracy ? ` · accurate to about ${Math.round(locationAccuracy)} m` : ''}. Suggestions refresh as you move.`
                          : locationStatus === 'locating'
                            ? 'Finding your current location and the closest available properties…'
                            : 'Location is needed to recommend the closest available parking.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocationRequestKey((request) => request + 1)}
                    className="w-full sm:w-auto shrink-0 rounded-xl border border-[#dadce0] px-3 py-2 text-[11px] font-semibold text-[#5f6368] hover:border-[#007AFF] hover:text-[#007AFF]"
                  >
                    {locationStatus === 'ready' ? 'Refresh location' : 'Use my location'}
                  </button>
                </div>
                {locationError && <p role="alert" className="mt-3 text-[11px] font-medium text-rose-600">{locationError}</p>}
                {suggestionsError && <p role="alert" className="mt-3 text-[11px] font-medium text-rose-600">{suggestionsError}</p>}
              </section>

              <div className="bg-white rounded-2xl border border-[#e8eaed] p-4">
                <h3 className="text-[12px] font-semibold text-[#5f6368] uppercase tracking-wider">Going somewhere else?</h3>
                <p className="mt-1 text-[11px] text-[#9ca3af]">Search a different property, address, area, or station.</p>
                <form onSubmit={handleParkingSearch} className="mt-3 flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="e.g. Setapak or Taman Melati"
                      className="w-full rounded-xl border border-[#dadce0] py-2.5 pl-9 pr-3 text-[13px] outline-none focus:border-[#007AFF]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#0066d6] disabled:opacity-60"
                  >
                    {isSearchLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    Search
                  </button>
                </form>
                {searchError && <p role="alert" className="mt-2 text-[11px] font-medium text-rose-600">{searchError}</p>}
                {searchMeta && (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-[10px] text-[#6e6e73]">Page {searchMeta.page} · {searchMeta.pageSize} per page</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchMeta(null);
                        setSearchSpots([]);
                        setSearchError(null);
                      }}
                      className="shrink-0 text-[10px] font-semibold text-[#007AFF] hover:text-[#0066d6]"
                    >
                      Show parking near me
                    </button>
                  </div>
                )}
              </div>

              {/* Spot Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[12px] font-semibold text-[#5f6368] uppercase tracking-wider">
                      {searchMeta ? 'Search results' : 'Recommended near you'} ({searchMeta?.totalCount ?? locationSuggestedSpots.length})
                    </h3>
                  </div>
                  {!searchMeta && isSuggestionsLoading && <Loader2 size={16} className="animate-spin text-[#007AFF]" />}
                </div>
                {!searchMeta && (locationStatus === 'locating' || (isSuggestionsLoading && discoverySpots.length === 0)) && (
                  <div className="bg-white rounded-2xl border border-[#e8eaed] p-8 text-center">
                    <Loader2 size={28} className="mx-auto mb-2 animate-spin text-[#007AFF]" />
                    <p className="text-[13px] text-[#5f6368] font-medium">Finding the closest parking</p>
                    <p className="text-[11px] text-[#9ca3af] mt-1">Your nearest available properties will appear automatically.</p>
                  </div>
                )}
                {!searchMeta && locationStatus !== 'locating' && !isSuggestionsLoading && discoverySpots.length === 0 && (
                  <div className="bg-white rounded-2xl border border-[#e8eaed] p-8 text-center">
                    <MapPin size={32} className="mx-auto text-[#dadce0] mb-2" />
                    <p className="text-[13px] text-[#5f6368] font-medium">
                      {locationStatus === 'ready' ? 'No available parking found nearby' : 'Turn on location recommendations'}
                    </p>
                    <p className="text-[11px] text-[#9ca3af] mt-1">
                      {locationStatus === 'ready'
                        ? 'We will refresh the recommendations automatically as your location changes.'
                        : 'Allow location access, or use the optional area search above.'}
                    </p>
                  </div>
                )}
                {searchMeta && !isSearchLoading && discoverySpots.length === 0 && (
                  <div className="bg-white rounded-2xl border border-[#e8eaed] p-8 text-center">
                    <MapPin size={32} className="mx-auto text-[#dadce0] mb-2" />
                    <p className="text-[13px] text-[#5f6368] font-medium">No matching parking found</p>
                    <p className="text-[11px] text-[#9ca3af] mt-1">Try a broader area, or return to parking recommendations near you.</p>
                  </div>
                )}
                {discoverySpots.map((spot, index) => {
                  const userDistance = currentLocation ? distanceFromUser(currentLocation, spot) : null;
                  return (
                    <div key={spot.id} className="relative">
                    <button type="button" onClick={() => openParkingDetail(spot, currentLocation, currentLocation ? 'Your location' : spot.stationName)}
                      className="w-full bg-white rounded-2xl border p-3 sm:p-4 sm:pr-12 text-left cursor-pointer transition-all duration-150 border-[#e8eaed] hover:border-[#d2d5d9] shadow-[0_4px_14px_rgba(15,23,42,0.04)] sm:shadow-none">
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        {spot.primaryImageUrl ? (
                          <img src={spot.primaryImageUrl} alt="" className="aspect-[16/9] sm:aspect-auto sm:h-20 w-full sm:w-24 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <div className="aspect-[16/9] sm:aspect-auto sm:h-20 w-full sm:w-24 rounded-xl bg-[#eff6ff] flex items-center justify-center shrink-0"><Home size={24} className="text-[#007AFF]" /></div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
                            <div>
                              <p className="text-[13px] font-semibold text-[#111]">{spot.propertyName}</p>
                              <p className="text-[10px] font-mono text-[#9ca3af]">Spot #{spot.parkingSpotId} · Property #{spot.propertyId} · Bay {spot.parkingLabel}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap sm:justify-end gap-1">
                              {!searchMeta && userDistance !== null && (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-[#007AFF]">
                                  {index === 0 ? 'Nearest · ' : ''}{formatUserDistance(userDistance)}
                                </span>
                              )}
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">{spot.availabilityStatus}</span>
                            </div>
                          </div>
                          <p className="mt-1 text-[11px] text-[#5f6368] dark:text-[#a1a1a6]">{spot.address}</p>
                          <p className="mt-1 text-[10px] text-[#9ca3af]">Near {spot.stationName} · {(spot.distanceToStation ?? 0).toFixed(2)} km to station · {spot.timeToStationInMinutes ?? 0} min</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-semibold text-[#5f6368]">
                            <span>Daily: {spot.dailyRate === null ? '—' : `RM ${spot.dailyRate.toFixed(2)}`}</span>
                            <span>Monthly: RM {spot.monthlyRate.toFixed(2)}</span>
                            <span>{spot.primaryImageUrl ? 'Photo available' : 'No primary photo'}</span>
                          </div>
                        </div>
                        <ChevronRight size={18} className="hidden sm:block mt-1 shrink-0 text-[#9ca3af]" />
                      </div>
                    </button>
                    <button type="button" onClick={() => void handleToggleFavorite(spot)}
                      disabled={isFavoritesLoading || isClearingFavorites || favoriteUpdatingIds.includes(spot.parkingSpotId)}
                      aria-label={favoriteSpots.some((favorite) => favorite.parkingSpotId === spot.parkingSpotId) ? `Remove ${spot.propertyName} from favorites` : `Add ${spot.propertyName} to favorites`}
                      aria-pressed={favoriteSpots.some((favorite) => favorite.parkingSpotId === spot.parkingSpotId)}
                      className="absolute right-5 top-5 sm:right-3 sm:top-3 z-10 flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-black/[0.08] bg-white/95 text-[#5f6368] shadow-md backdrop-blur transition hover:text-rose-500 active:scale-95 disabled:cursor-wait disabled:opacity-70">
                      {favoriteUpdatingIds.includes(spot.parkingSpotId)
                        ? <Loader2 size={17} className="animate-spin text-[#007AFF]" />
                        : <Heart size={17} fill={favoriteSpots.some((favorite) => favorite.parkingSpotId === spot.parkingSpotId) ? 'currentColor' : 'none'} className={favoriteSpots.some((favorite) => favorite.parkingSpotId === spot.parkingSpotId) ? 'text-rose-500' : ''} />}
                    </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── TAB: Map ─── */}
          {activeTab === 'map' && (
            <div className="space-y-3">
              {/* Mobile View Switcher */}
              <div className="flex lg:hidden bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setMobileTransitTab('transit')}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition-all ${
                    mobileTransitTab === 'transit'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {transitWorkspaceMode === 'navigation' ? 'Directions' : 'Transit Hub'}
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTransitTab('map')}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition-all ${
                    mobileTransitTab === 'map'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Transit Map
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTransitTab('bays')}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition-all ${
                    mobileTransitTab === 'bays'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Nearby Bays ({lensSpots.length})
                </button>
              </div>

              <div className="map-lens">
                {/* 1. DEDICATED LEFT WORKSPACE PANEL: TRANSIT HUB (Explore) OR JOURNEY NAVIGATOR (Navigation) */}
                <div className={`map-lens__gtfs ${mobileTransitTab !== 'transit' ? 'hidden lg:block' : ''}`}>
                  {transitWorkspaceMode === 'navigation' ? (
                    <div className="h-full overflow-hidden rounded-2xl border border-slate-200/90 shadow-xs bg-white">
                      <LinearJourneyNavigator
                        plan={navigationRoutes.linearPlan}
                        drivingRoute={navigationRoutes.drivingRoute}
                        journeyTab={navigationJourneyTab}
                        onChangeJourneyTab={setNavigationJourneyTab}
                        onClose={() => setTransitWorkspaceMode('explore')}
                      />
                    </div>
                  ) : (
                    <TransitHubSheet
                      userLocation={currentLocation}
                      selectedStationId={selectedStationId}
                      selectedStationName={selectedStation}
                      selectedBusRoute={selectedBusRoute}
                      onSelectBusRoute={setSelectedBusRoute}
                      onSelectStation={(stop) => {
                        handleMapStationSelect(stop.stopName, stop.latitude, stop.longitude, stop.stopId);
                        setMobileTransitTab('map');
                      }}
                      onSelectParkingSpot={handleSheetParkingSpotSelect}
                      onOpenParkingDetail={(spot) => openParkingDetail(spot)}
                    />
                  )}
                </div>

                {/* 2. EXPANSIVE FULL-WIDTH MAP CANVAS */}
                <div className={`map-lens__map relative ${mobileTransitTab !== 'map' ? 'hidden lg:block' : ''}`}>
                  <CommuterMap
                    spots={lensSpots}
                    onStationSelect={handleMapStationSelect}
                    selectedStation={selectedStation}
                    selectedStationCoords={selectedStationCoords}
                    selectedStationId={selectedStationId}
                    selectedSpot={selectedSpot}
                    onSpotClick={(spot) => setSelectedSpot(spot)}
                    distanceRadius={distanceFilter}
                    onDistanceRadiusChange={setDistanceFilter}
                    userLocation={currentLocation}
                    locationAccuracy={locationAccuracy}
                    locationStatus={locationStatus}
                    onRequestLocation={() => setLocationRequestKey((request) => request + 1)}
                    selectedBusRoute={selectedBusRoute}
                    onBusRouteSelect={setSelectedBusRoute}
                    activeBookingSpot={activeBooking?.spot}
                    activeBooking={activeBooking}
                    workspaceMode={transitWorkspaceMode}
                    onNavigate={() => {
                      setTransitWorkspaceMode('navigation');
                      setMobileTransitTab('transit');
                    }}
                    onExitNavigation={() => setTransitWorkspaceMode('explore')}
                    onRoutesCalculated={setNavigationRoutes}
                  />
                </div>

                {/* 3. MOBILE-ONLY NEARBY BAYS TAB */}
                {mobileTransitTab === 'bays' && (
                  <div className="map-lens__rail lg:hidden flex">
                    <aside className="map-lens__results nearby-sheet" aria-label="Nearby parking bays">
                      <div className="nearby-sheet__header">
                        <h2>Nearby bays</h2>
                        <span>
                          {selectedStation
                            ? `${mapNearbySpots.length} available · ${selectedStation.replace(' LRT', '').replace(' MRT', '')}`
                            : `${locationSuggestedSpots.length} available near you · Select a station`}
                        </span>
                      </div>
                      <div className="nearby-sheet__list">
                        {isNearbyLoading ? (
                          <div className="nearby-sheet__state">
                            <Loader2 size={20} className="animate-spin" />
                            <p>Finding parking within {distanceFilter}m…</p>
                          </div>
                        ) : nearbyError ? (
                          <div className="nearby-sheet__state" role="alert">
                            <AlertCircle size={20} />
                            <p>{nearbyError} Select another station or try again.</p>
                          </div>
                        ) : lensSpots.length === 0 ? (
                          <div className="nearby-sheet__state">
                            <MapPin size={20} />
                            <p>{selectedStation ? `No available bays within ${distanceFilter}m.` : 'Choose an LRT or MRT station on the map to see nearby parking.'}</p>
                          </div>
                        ) : (
                          lensSpots.map((spot) => (
                            <button
                              key={spot.id}
                              type="button"
                              onClick={() => setSelectedSpot(spot)}
                              className={`nearby-bay ${lensSelectedSpot?.id === spot.id ? 'is-selected' : ''}`}
                            >
                              <span className="nearby-bay__mark">P</span>
                              <div className="nearby-bay__content min-w-0">
                                <strong>{spot.name}</strong>
                                <span>Bay {spot.parkingLabel} · {(spot.distanceToStation ?? 0).toFixed(2)} km · {spot.timeToStationInMinutes ?? 0} min</span>
                              </div>
                              <span className="nearby-bay__rate">{formatParkingRate(spot)}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </aside>

                    <div className="map-lens__pass">
                      <ParkingPass
                        spot={lensSelectedSpot}
                        vehiclePlate={vehicles.find((vehicle) => vehicle.active)?.plate}
                        onReserve={lensSelectedSpot ? () => openParkingDetail(lensSelectedSpot) : undefined}
                        compact
                        stationName={selectedStation}
                        stationCoords={selectedStationCoords}
                        selectedBusRoute={selectedBusRoute}
                        onSelectBusRoute={setSelectedBusRoute}
                        isNearbyLoading={isNearbyLoading}
                      />
                    </div>
                  </div>
                )}

                {activeBooking && <JourneyStrip activeStep={journeyStep} />}
              </div>
            </div>
          )}

          {/* ─── TAB: Active Session ─── */}
          {activeTab === 'active' && (
            <div className="flex flex-col gap-5">
              <JourneyStrip activeStep={journeyStep} />
              {!activeBooking ? (
                upcomingBookings.length > 0 ? (
                  <div className="bg-[#eff6ff] dark:bg-blue-950/30 rounded-2xl border border-blue-200/60 dark:border-blue-900/40 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-1">
                    <div>
                      <p className="text-[14px] font-semibold text-[#111] dark:text-white">No parking session in progress right now</p>
                      <p className="text-[12px] text-[#5f6368] dark:text-[#A1A1AA] mt-0.5">
                        You have {upcomingBookings.length} future reservation{upcomingBookings.length > 1 ? 's' : ''} scheduled below.
                      </p>
                    </div>
                    <button onClick={() => setActiveTab('map')} className="shrink-0 px-4 py-2 rounded-xl bg-[#007AFF] text-white text-[12px] font-semibold hover:bg-[#0066d6] transition-colors cursor-pointer">Book another</button>
                  </div>
                ) : (
                <div className="bg-white dark:bg-[#141417] rounded-2xl border border-[#e8eaed] dark:border-white/10 p-8 text-center mt-1">
                  <Clock size={32} className="mx-auto text-[#dadce0] dark:text-[#71717A] mb-2" />
                  <p className="text-[15px] font-semibold text-[#111] dark:text-white">No active booking</p>
                  <p className="text-[13px] text-[#5f6368] dark:text-[#A1A1AA] mt-1">Find and book a parking spot to get started.</p>
                  <button onClick={() => setActiveTab('map')} className="mt-4 px-5 py-2.5 rounded-xl bg-[#007AFF] text-white text-[13px] font-semibold hover:bg-[#0066d6] transition-colors cursor-pointer">Find a bay</button>
                </div>
              )
              ) : (
                <>
                  {/* Session Info */}
                  <div className="bg-white dark:bg-[#141417] rounded-2xl border border-[#e8eaed] dark:border-white/10 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[12px] font-semibold text-[#5f6368] dark:text-[#A1A1AA] uppercase tracking-wider">Active Session</h3>
                      <span className="text-[10px] font-mono font-bold bg-[#f0fdf4] dark:bg-emerald-950/60 text-[#16a34a] dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50 px-2 py-0.5 rounded-full">{activeBooking.status}</span>
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-[#111] dark:text-white">{activeBooking.spot.name}</p>
                      <p className="text-[12px] text-[#5f6368] dark:text-[#A1A1AA] mt-0.5">{activeBooking.spot.station} &middot; Plate: {activeBooking.vehiclePlate}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                      <div className="flex items-center gap-2">
                        <Clock size={15} className="text-[#5f6368] dark:text-[#A1A1AA]" />
                        <span className="text-[13px] font-semibold text-[#111] dark:text-white">{formatTime(secondsRemaining)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wallet size={15} className="text-[#5f6368] dark:text-[#A1A1AA]" />
                        <span className="text-[13px] font-semibold text-[#111] dark:text-white">RM {(activeBooking.totalPaid ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                    {showGraceAlert && (
                      <div className="bg-[#fefce8] dark:bg-amber-950/40 border border-[#fde68a] dark:border-amber-800/50 rounded-xl p-3 text-[12px] text-[#a16207] dark:text-amber-300 flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0" /> Session ending in under 5 minutes.
                      </div>
                    )}
                  </div>

                  {/* IoT Bollard Control */}
                  <div className="bg-white dark:bg-[#141417] rounded-2xl border border-[#e8eaed] dark:border-white/10 p-5 space-y-4">
                    <h3 className="text-[12px] font-semibold text-[#5f6368] dark:text-[#A1A1AA] uppercase tracking-wider">Smart Bollard Control</h3>
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                        bollardAnimationState === 'lowered' ? 'bg-[#f0fdf4] dark:bg-emerald-950/60' : bollardAnimationState === 'lowering' ? 'bg-[#fefce8] dark:bg-amber-950/60' : 'bg-[#f8f9fa] dark:bg-[#1C1C1E]'
                      }`}>
                        {bollardAnimationState === 'lowered' ? <Unlock size={28} className="text-[#16a34a] dark:text-emerald-400" /> :
                         bollardAnimationState === 'lowering' ? <Loader2 size={28} className="text-[#d97706] dark:text-amber-400 animate-spin" /> :
                         <Lock size={28} className="text-[#9ca3af] dark:text-[#71717A]" />}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#111] dark:text-white">
                          {bollardAnimationState === 'lowered' ? 'Bollard Lowered' : bollardAnimationState === 'lowering' ? 'Lowering...' : 'Bollard Raised'}
                        </p>
                        <p className="text-[11px] text-[#5f6368] dark:text-[#A1A1AA] mt-0.5">
                          {gpsVerified === 'verified' ? 'GPS verified — ready to unlock'
                            : gpsVerified === 'checking' ? 'Checking your location...'
                            : gpsVerified === 'unverified' ? 'Not at this bay — verify again'
                            : 'Arrive at spot to unlock'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {!isBollardUnlocked ? (
                        <>
                          <button onClick={() => void triggerGPSCheck()}
                            disabled={gpsVerified === 'checking'}
                            className={`w-full px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-colors ${gpsVerified === 'verified' ? 'bg-[#f0fdf4] dark:bg-emerald-950/60 text-[#16a34a] dark:text-emerald-400' : 'bg-[#f8f9fa] dark:bg-[#242429] text-[#5f6368] dark:text-[#A1A1AA] hover:bg-[#f1f3f4] dark:hover:bg-[#2C2C32] dark:border dark:border-white/10'} disabled:cursor-wait disabled:opacity-60`}>
                            {gpsVerified === 'verified' ? 'GPS Verified' : gpsVerified === 'checking' ? 'Checking...' : 'Verify GPS'}
                          </button>
                          <button onClick={startQRScanner}
                            className="w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] dark:bg-[#242429] text-[#5f6368] dark:text-[#A1A1AA] dark:border dark:border-white/10 text-[12px] font-semibold hover:bg-[#f1f3f4] dark:hover:bg-[#2C2C32] transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                            <Camera size={14} /> Scan QR
                          </button>
                          <button onClick={() => void handleUnlockBollard()}
                            disabled={gpsVerified !== 'verified' || bollardAnimationState === 'lowering'}
                            className={`w-full px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${gpsVerified === 'verified' && bollardAnimationState !== 'lowering' ? 'bg-[#007AFF] text-white hover:bg-[#0066d6] cursor-pointer' : 'bg-[#e8eaed] dark:bg-[#242429] text-[#9ca3af] dark:text-[#71717A] cursor-not-allowed'}`}>
                            {bollardAnimationState === 'lowering' && <Loader2 size={14} className="animate-spin" />}
                            {bollardAnimationState === 'lowering' ? 'Releasing...' : 'Unlock Bollard'}
                          </button>
                        </>
                      ) : (
                        <button onClick={handleLockBollard}
                          className="w-full sm:col-span-3 px-4 py-2.5 rounded-xl bg-[#fef2f2] dark:bg-red-950/60 text-[#dc2626] dark:text-red-400 border border-red-200/50 dark:border-red-900/50 text-[12px] font-semibold hover:bg-[#fee2e2] dark:hover:bg-red-900/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                          <Lock size={14} /> Lock Bollard
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleCompleteBooking}
                    disabled={journeyStage !== 'parked' || bollardAnimationState !== 'raised'}
                    className={`w-full py-3 rounded-xl text-[13px] font-bold transition-colors flex items-center justify-center gap-2 ${journeyStage === 'parked' && bollardAnimationState === 'raised' ? 'bg-[#007AFF] text-white hover:bg-[#0066d6]' : 'bg-[#e8eaed] text-[#8e8e93] cursor-not-allowed'}`}
                  >
                    <CheckCircle2 size={17} /> {journeyStage === 'parked' ? 'Complete Booking' : 'Unlock and re-secure the bay to complete'}
                  </button>
                </>
              )}

              {upcomingBookings.length > 0 && (
                <div className="bg-white dark:bg-[#141417] rounded-2xl border border-[#e8eaed] dark:border-white/10 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[12px] font-semibold text-[#5f6368] dark:text-[#A1A1AA] uppercase tracking-wider">
                        Upcoming Reservations
                      </h3>
                      <span className="text-[10px] font-mono font-bold bg-[#eef5ff] dark:bg-white/10 text-[#007AFF] dark:text-blue-400 px-2 py-0.5 rounded-full">
                        {upcomingBookings.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9ca3af] dark:text-[#71717A]">Future bookings</p>
                  </div>

                  <div className="divide-y divide-[#f1f3f4] dark:divide-white/10">
                    {upcomingBookings.map((b) => (
                      <article key={b.bookingId} className="py-3.5 first:pt-1 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[14px] font-bold text-[#111] dark:text-white">{b.spot.name}</p>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#007AFF] dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                              Confirmed
                            </span>
                          </div>
                          <p className="text-[12px] text-[#5f6368] dark:text-[#A1A1AA] mt-1">
                            {b.spot.station} &middot; Plate: {b.vehiclePlate || 'N/A'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-[#007AFF]">
                            <Calendar size={13} />
                            <span>
                              {b.startTime.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {' – '}
                              {b.endTime.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                          <span className="text-[14px] font-bold text-[#111] dark:text-white">
                            RM {(b.totalPaid ?? 0).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            disabled={cancelingBookingId === b.bookingId}
                            onClick={() => void handleCancelBooking(b.bookingId)}
                            className="text-[11px] font-semibold text-[#dc2626] hover:underline disabled:opacity-50 cursor-pointer"
                          >
                            {cancelingBookingId === b.bookingId ? 'Cancelling…' : 'Cancel reservation'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── TAB: Wallet ─── */}
          {activeTab === 'wallet' && (
            <div className="space-y-4">
              {walletTopUpFeedback && (
                <section
                  role="status"
                  aria-live="polite"
                  className={`wallet-topup-result wallet-topup-result--${walletTopUpFeedback.tone}`}
                >
                  <div className="wallet-topup-result__icon" aria-hidden="true">
                    {walletTopUpFeedback.tone === 'success'
                      ? <CheckCircle2 size={28} />
                      : walletTopUpFeedback.tone === 'processing'
                        ? <Loader2 size={28} className="animate-spin" />
                      : walletTopUpFeedback.tone === 'warning'
                        ? <AlertCircle size={28} />
                        : <Info size={28} />}
                  </div>
                  <div className="wallet-topup-result__content">
                    <p className="wallet-topup-result__eyebrow">
                      {walletTopUpFeedback.tone === 'success'
                        ? 'Payment confirmed'
                        : walletTopUpFeedback.tone === 'processing'
                          ? 'Secure payment verification'
                          : 'Wallet update'}
                    </p>
                    <h2>{walletTopUpFeedback.title}</h2>
                    <p>{walletTopUpFeedback.message}</p>

                    {walletTopUpFeedback.payment && (
                      <dl className="wallet-topup-result__receipt">
                        <div>
                          <dt>Amount</dt>
                          <dd>RM {walletTopUpFeedback.payment.amount.toFixed(2)}</dd>
                        </div>
                        <div>
                          <dt>Payment reference</dt>
                          <dd>#{walletTopUpFeedback.payment.paymentId}</dd>
                        </div>
                        <div>
                          <dt>Status</dt>
                          <dd>
                            {walletTopUpFeedback.tone === 'success'
                              ? 'Credited'
                              : walletTopUpFeedback.tone === 'processing'
                                ? 'Confirming'
                                : walletTopUpFeedback.title.replace('Top-up ', '')}
                          </dd>
                        </div>
                      </dl>
                    )}

                    {walletTopUpFeedback.tone === 'processing' && (
                      <ol className="wallet-topup-result__steps" aria-label="Wallet top-up progress">
                        <li className="is-complete"><Check size={14} /> Stripe checkout completed</li>
                        <li className="is-current"><Loader2 size={14} className="animate-spin" /> Confirming wallet credit</li>
                      </ol>
                    )}

                    <div className="wallet-topup-result__actions">
                      <button type="button" onClick={() => setWalletTopUpFeedback(null)}>Done</button>
                      {walletTopUpFeedback.tone === 'processing' && (
                        <button
                          type="button"
                          className="is-primary"
                          disabled={isWalletRefreshing || !walletTopUpFeedback.payment}
                          onClick={() => walletTopUpFeedback.payment
                            && void reconcilePendingTopUp(walletTopUpFeedback.payment)}
                        >
                          {isWalletRefreshing ? <Loader2 size={15} className="animate-spin" /> : <ArrowUpRight size={15} />}
                          {isWalletRefreshing ? 'Checking' : 'Check status'}
                        </button>
                      )}
                      {walletTopUpFeedback.action === 'new-topup' && (
                        <button type="button" className="is-primary" onClick={startNewTopUp}>
                          Start new top-up <ArrowUpRight size={15} />
                        </button>
                      )}
                      {walletTopUpFeedback.action === 'retry-status' && walletTopUpFeedback.payment && (
                        <button
                          type="button"
                          className="is-primary"
                          disabled={isWalletRefreshing}
                          onClick={() => void reconcilePendingTopUp(walletTopUpFeedback.payment!)}
                        >
                          {isWalletRefreshing && <Loader2 size={15} className="animate-spin" />}
                          Try checking again
                        </button>
                      )}
                      {walletTopUpFeedback.allowNewTopUp && (
                        <button type="button" onClick={startNewTopUp}>
                          Remove saved link & start new
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              )}
              <div className="wallet-balance-card bg-white dark:bg-[#141417] rounded-2xl border border-[#e8eaed] dark:border-white/10 p-6 text-center">
                <p className="text-[11px] font-semibold text-[#9ca3af] dark:text-[#A1A1AA] uppercase tracking-wider">Current Balance</p>
                <p className="text-[40px] font-bold text-[#111] dark:text-white tracking-[-0.02em] mt-1">
                  {walletBalance === null ? 'RM —' : `RM ${walletBalance.toFixed(2)}`}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">
                  {walletBalance === null
                    ? walletLoadError || 'Loading your confirmed wallet balance…'
                    : 'Only server-confirmed funds are included in this balance.'}
                </p>
                <button
                  type="button"
                  onClick={openTopUpModal}
                  disabled={isWalletRefreshing}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-[#007AFF] text-white text-[13px] font-semibold hover:bg-[#0066d6] transition-colors disabled:cursor-wait disabled:opacity-60 cursor-pointer"
                >
                  {isWalletRefreshing
                    ? 'Checking payment…'
                    : pendingTopUp?.stage === 'checkout'
                    ? 'Check & Continue Checkout'
                    : pendingTopUp?.stage === 'confirming'
                      ? 'Check Confirmation'
                      : 'Top Up Wallet'}
                </button>
                {walletBalance === null && walletLoadError && !pendingTopUp && (
                  <button
                    type="button"
                    className="mx-auto mt-2 block text-[11px] font-semibold text-[#007AFF] hover:underline"
                    onClick={() => void refreshWalletBalance()}
                  >
                    Retry balance
                  </button>
                )}
                {pendingTopUp && (
                  <div className="mx-auto mt-3 max-w-sm text-center">
                    <p className="text-[10px] leading-relaxed text-[#6e6e73] dark:text-[#A1A1AA]">
                      {pendingTopUp.stage === 'checkout'
                        ? `RM ${pendingTopUp.amount.toFixed(2)} is saved. ParkJom will verify it is still open before returning to Stripe.`
                        : `RM ${pendingTopUp.amount.toFixed(2)} has returned from Stripe and is awaiting server confirmation.`}
                    </p>
                    <button
                      type="button"
                      className="mt-2 text-[10px] font-semibold text-[#007AFF] hover:underline"
                      onClick={() => void reconcilePendingTopUp(pendingTopUp)}
                    >
                      Can’t continue? Check this payment
                    </button>
                  </div>
                )}
              </div>
              <div className="bg-white dark:bg-[#141417] rounded-2xl border border-[#e8eaed] dark:border-white/10 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[12px] font-semibold text-[#5f6368] dark:text-[#A1A1AA] uppercase tracking-wider">
                      Wallet Activity
                    </h3>
                    <div className="inline-flex rounded-lg bg-[#f1f3f4] dark:bg-[#1E1E24] p-0.5 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => { setWalletActivityFilter('all'); setWalletActivityPage(1); }}
                        className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                          walletActivityFilter === 'all'
                            ? 'bg-white dark:bg-[#2A2A32] text-[#111] dark:text-white shadow-xs'
                            : 'text-[#5f6368] dark:text-[#A1A1AA] hover:text-[#111] dark:hover:text-white'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => { setWalletActivityFilter('topup'); setWalletActivityPage(1); }}
                        className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                          walletActivityFilter === 'topup'
                            ? 'bg-white dark:bg-[#2A2A32] text-[#111] dark:text-white shadow-xs'
                            : 'text-[#5f6368] dark:text-[#A1A1AA] hover:text-[#111] dark:hover:text-white'
                        }`}
                      >
                        Top-ups
                      </button>
                      <button
                        type="button"
                        onClick={() => { setWalletActivityFilter('deduction'); setWalletActivityPage(1); }}
                        className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                          walletActivityFilter === 'deduction'
                            ? 'bg-white dark:bg-[#2A2A32] text-[#111] dark:text-white shadow-xs'
                            : 'text-[#5f6368] dark:text-[#A1A1AA] hover:text-[#111] dark:hover:text-white'
                        }`}
                      >
                        Deductions
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshWalletActivity()}
                    disabled={isWalletActivityLoading}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#007AFF] hover:underline disabled:opacity-50 self-start sm:self-auto cursor-pointer"
                  >
                    <RefreshCw size={12} className={isWalletActivityLoading ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>

                {paginatedActivities.length > 0 ? (
                  <div className="space-y-2">
                    {paginatedActivities.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-4 rounded-xl bg-[#f8f9fa] dark:bg-[#18181C] dark:border dark:border-white/10 p-3.5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                              item.category === 'deduction'
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                                : item.type === 'refund'
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] dark:text-[#38bdf8]'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {item.category === 'deduction' ? (
                              <ArrowUpRight size={16} />
                            ) : (
                              <ArrowDownLeft size={16} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-[13px] font-semibold text-[#111] dark:text-white">
                                {item.title}
                              </p>
                              {item.isPending && (
                                <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                  Pending
                                </span>
                              )}
                            </div>
                            <p className="truncate text-[11px] text-[#9ca3af] dark:text-[#71717A]">
                              {item.subtitle}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 text-[13px] font-semibold ${
                            item.category === 'deduction'
                              ? 'text-rose-600 dark:text-rose-400'
                              : item.isPending
                              ? 'text-[#5f6368] dark:text-[#A1A1AA]'
                              : 'text-[#007AFF] dark:text-[#38bdf8]'
                          }`}
                        >
                          {item.category === 'deduction' ? '-' : '+'}{item.currency} {item.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}

                    {totalActivityPages > 1 && (
                      <div className="flex items-center justify-between pt-3 border-t border-[#e8eaed] dark:border-white/10 text-[11px] font-semibold text-[#5f6368] dark:text-[#A1A1AA]">
                        <button
                          type="button"
                          onClick={() => setWalletActivityPage((p) => Math.max(1, p - 1))}
                          disabled={walletActivityPage === 1 || isWalletActivityLoading}
                          className="disabled:opacity-40 disabled:cursor-not-allowed hover:text-[#111] dark:hover:text-white cursor-pointer"
                        >
                          Previous
                        </button>
                        <span>
                          Page {walletActivityPage} of {totalActivityPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setWalletActivityPage((p) => Math.min(totalActivityPages, p + 1))}
                          disabled={walletActivityPage >= totalActivityPages || isWalletActivityLoading}
                          className="disabled:opacity-40 disabled:cursor-not-allowed hover:text-[#111] dark:hover:text-white cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                ) : (walletTopUpFeedback?.payment || pendingTopUp) && walletActivityFilter !== 'deduction' ? (
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-[#f8f9fa] dark:bg-[#18181C] dark:border dark:border-white/10 p-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#007AFF]">
                        <ArrowDownLeft size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#111] dark:text-white">Wallet top-up</p>
                        <p className="truncate text-[11px] text-[#9ca3af] dark:text-[#71717A]">
                          Payment #{(walletTopUpFeedback?.payment || pendingTopUp)?.paymentId}
                          {' · '}
                          {walletTopUpFeedback?.tone === 'success'
                            ? 'Credited'
                            : walletTopUpFeedback?.title === 'Top-up cancelled'
                            ? 'Cancelled'
                            : walletTopUpFeedback?.title === 'Checkout expired'
                              ? 'Expired'
                            : (walletTopUpFeedback?.payment || pendingTopUp)?.stage === 'confirming'
                              ? 'Confirmation pending'
                              : 'Checkout incomplete'}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold text-[#007AFF]">
                      RM {(walletTopUpFeedback?.payment || pendingTopUp)?.amount.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="flex min-h-24 flex-col items-center justify-center rounded-xl bg-[#f8f9fa] dark:bg-[#18181C] dark:border dark:border-white/10 px-4 text-center">
                    {walletActivityFilter === 'deduction' ? (
                      <ArrowUpRight size={20} className="mb-2 text-[#9ca3af] dark:text-[#71717A]" />
                    ) : walletActivityFilter === 'topup' ? (
                      <ArrowDownLeft size={20} className="mb-2 text-[#9ca3af] dark:text-[#71717A]" />
                    ) : (
                      <Coins size={20} className="mb-2 text-[#9ca3af] dark:text-[#71717A]" />
                    )}
                    <p className="text-[12px] font-medium text-[#5f6368] dark:text-[#A1A1AA]">
                      {walletActivityFilter === 'deduction'
                        ? 'No deductions yet'
                        : walletActivityFilter === 'topup'
                        ? 'No top-ups yet'
                        : 'No wallet activity'}
                    </p>
                    <p className="mt-1 text-[11px] text-[#9ca3af] dark:text-[#71717A]">
                      {walletActivityFilter === 'deduction'
                        ? 'Your parking payments and deductions will appear here.'
                        : walletActivityFilter === 'topup'
                        ? 'Your wallet top-ups will appear here.'
                        : 'Your top-ups and parking payments will appear here.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── TAB: Profile / Vehicles ─── */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-[#141417] rounded-2xl border border-[#e8eaed] dark:border-white/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {user?.picture ? (
                    <img src={user.picture} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-black/[0.08]" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f0fe] dark:bg-blue-950/60 text-[16px] font-bold text-[#007AFF] ring-1 ring-black/[0.08] dark:ring-white/10">
                      {(user?.firstName?.charAt(0) || user?.email?.charAt(0) || '?').toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-bold text-[#1d1d1f] dark:text-white">
                        {`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email}
                      </p>
                      <span className="rounded-full bg-[#e8f0fe] dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-[#007AFF] dark:text-white">
                        Commuter
                      </span>
                    </div>
                    <p className="truncate text-[12px] text-[#6e6e73] dark:text-[#A1A1AA]">{user?.email}</p>
                    {user?.phoneNumber && <p className="text-[11px] text-[#8e8e93] dark:text-[#71717A] mt-0.5">{user.phoneNumber}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfileDialog(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/14 bg-white dark:bg-[#242429] px-4 py-2 text-[12px] font-semibold text-[#1d1d1f] dark:text-white hover:bg-[#f5f5f7] dark:hover:bg-[#2C2C32] transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <User size={14} className="text-[#007AFF]" />
                  Manage Profile &amp; Role
                </button>
              </div>

              <ProfileDialog open={showProfileDialog} onClose={() => setShowProfileDialog(false)} />

              <div className="bg-white dark:bg-[#141417] rounded-2xl border border-[#e8eaed] dark:border-white/10 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-[12px] font-semibold text-[#5f6368] dark:text-[#A1A1AA] uppercase tracking-wider">Your Vehicles</h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void loadMyVehicles()}
                      disabled={isVehiclesLoading}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#5f6368] dark:text-[#A1A1AA] transition-colors hover:bg-[#f1f3f4] dark:hover:bg-[#202025] hover:text-[#111] dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Refresh vehicles"
                      title="Refresh vehicles"
                    >
                      <RefreshCw size={14} className={isVehiclesLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddVehicle((current) => !current);
                        setVehicleEditDraft(null);
                        setVehicleFeedback(null);
                      }}
                      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[#007AFF] hover:bg-[#eff6ff] dark:hover:bg-white/10 cursor-pointer">
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>
                {vehiclesLoadError && (
                  <div role="alert" className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
                    <span className="flex min-w-0 items-start gap-2">
                      <AlertCircle size={15} className="mt-0.5 shrink-0" />
                      <span>{vehiclesLoadError}</span>
                    </span>
                    <button type="button" onClick={() => void loadMyVehicles()} disabled={isVehiclesLoading}
                      className="shrink-0 font-semibold underline underline-offset-2 disabled:opacity-50">
                      Retry
                    </button>
                  </div>
                )}
                {vehicleFeedback && (
                  <div
                    role={vehicleFeedback.tone === 'error' ? 'alert' : 'status'}
                    className={`mb-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12px] ${
                      vehicleFeedback.tone === 'error'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {vehicleFeedback.tone === 'error'
                      ? <AlertCircle size={15} className="mt-0.5 shrink-0" />
                      : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
                    <span>{vehicleFeedback.message}</span>
                  </div>
                )}
                {isVehiclesLoading && vehicles.length === 0 && (
                  <div className="flex min-h-24 items-center justify-center gap-2 text-[12px] text-[#5f6368]">
                    <Loader2 size={16} className="animate-spin" /> Loading your vehicles
                  </div>
                )}
                {!isVehiclesLoading && !vehiclesLoadError && vehicles.length === 0 && (
                  <div className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-[#dadce0] dark:border-white/15 px-4 text-center">
                    <Car size={20} className="mb-2 text-[#9ca3af] dark:text-[#71717A]" />
                    <p className="text-[12px] font-medium text-[#5f6368] dark:text-[#A1A1AA]">No vehicles added yet</p>
                    <p className="mt-1 text-[11px] text-[#9ca3af] dark:text-[#71717A]">Add a vehicle to use it for your next parking session.</p>
                  </div>
                )}
                {vehicles.map((v) => (
                  <div key={v.vehicleId ?? v.plate}
                    className={`mb-1 flex items-center rounded-xl border transition-colors ${v.active ? 'border-[#bfdbfe] dark:border-[#0071E3]/50 bg-[#eff6ff] dark:bg-[#1E2430]' : 'border-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#18181C]'}`}>
                    <button type="button" onClick={() => setActiveVehicle(v.plate)} aria-pressed={v.active}
                      className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left cursor-pointer">
                      <Car size={18} className={v.active ? 'text-[#007AFF]' : 'text-[#9ca3af] dark:text-[#71717A]'} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-[#111] dark:text-white">{v.plate}</p>
                        <p className="truncate text-[11px] text-[#5f6368] dark:text-[#A1A1AA]">{v.brand} {v.model} &middot; {v.color}</p>
                      </div>
                      {v.active && <span className="text-[10px] font-semibold bg-[#007AFF] text-white px-2 py-0.5 rounded-full">Active</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => beginVehicleEdit(v)}
                      disabled={isVehicleUpdating || vehicleDeletingId !== null}
                      className="rounded-lg p-2 text-[#5f6368] dark:text-[#A1A1AA] transition-colors hover:bg-white dark:hover:bg-[#202025] hover:text-[#007AFF] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                      aria-label={`Edit vehicle ${v.plate}`}
                      title="Edit vehicle"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteVehicle(v)}
                      disabled={isVehicleUpdating || vehicleDeletingId !== null}
                      className="mr-2 rounded-lg p-2 text-[#5f6368] dark:text-[#A1A1AA] transition-colors hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                      aria-label={`Delete vehicle ${v.plate}`}
                      title="Delete vehicle"
                    >
                      {vehicleDeletingId === v.vehicleId
                        ? <Loader2 size={15} className="animate-spin" />
                        : <Trash2 size={15} />}
                    </button>
                  </div>
                ))}
                {vehicleEditDraft && (
                  <form onSubmit={handleModifyVehicle} className="mt-3 space-y-2 rounded-xl bg-[#f8f9fa] dark:bg-[#18181C] dark:border dark:border-white/10 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368] dark:text-[#A1A1AA]">Edit vehicle</p>
                      <button type="button" onClick={() => setVehicleEditDraft(null)} disabled={isVehicleUpdating}
                        className="rounded-lg p-1 text-[#5f6368] dark:text-[#A1A1AA] hover:bg-white dark:hover:bg-[#202025] hover:text-[#111] dark:hover:text-white disabled:opacity-50 cursor-pointer" aria-label="Cancel vehicle edit">
                        <X size={15} />
                      </button>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-semibold uppercase text-[#5f6368] dark:text-[#A1A1AA]">Number plate</span>
                      <input type="text" value={vehicleEditDraft.numberPlate}
                        onChange={(event) => setVehicleEditDraft((current) => current ? { ...current, numberPlate: event.target.value } : current)}
                        maxLength={20} required disabled={isVehicleUpdating}
                        className="w-full rounded-xl border border-[#dadce0] dark:border-white/10 bg-white dark:bg-[#141417] px-3 py-2 text-[12px] uppercase text-[#111] dark:text-white focus:border-[#007AFF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
                    </label>
                    <VehicleBrandModelFields
                      brand={vehicleEditDraft.vehicleBrand}
                      model={vehicleEditDraft.vehicleModel}
                      catalog={vehicleCatalog}
                      disabled={isVehicleUpdating}
                      onBrandChange={(value) => setVehicleEditDraft((current) => current ? { ...current, vehicleBrand: value } : current)}
                      onModelChange={(value) => setVehicleEditDraft((current) => current ? { ...current, vehicleModel: value } : current)}
                    />
                    <label className="block space-y-1">
                      <span className="text-[10px] font-semibold uppercase text-[#5f6368] dark:text-[#A1A1AA]">Color</span>
                      <input type="text" value={vehicleEditDraft.vehicleColor}
                        onChange={(event) => setVehicleEditDraft((current) => current ? { ...current, vehicleColor: event.target.value } : current)}
                        maxLength={30} required disabled={isVehicleUpdating}
                        className="w-full rounded-xl border border-[#dadce0] dark:border-white/10 bg-white dark:bg-[#141417] px-3 py-2 text-[12px] text-[#111] dark:text-white focus:border-[#007AFF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
                    </label>
                    <button type="submit" disabled={isVehicleUpdating}
                      className="flex min-h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#0066d6] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer">
                      {isVehicleUpdating && <Loader2 size={14} className="animate-spin" />}
                      {isVehicleUpdating ? 'Updating Vehicle' : 'Update Vehicle'}
                    </button>
                  </form>
                )}
                {showAddVehicle && (
                  <form onSubmit={handleAddVehicle} className="mt-3 p-4 bg-[#f8f9fa] dark:bg-[#18181C] dark:border dark:border-white/10 rounded-xl space-y-2">
                    <label className="block space-y-1">
                      <span className="text-[10px] font-semibold uppercase text-[#5f6368] dark:text-[#A1A1AA]">Number plate</span>
                      <input type="text" value={newPlate} onChange={(e) => setNewPlate(e.target.value)} placeholder="WXY1234"
                        maxLength={20} required disabled={isVehicleSaving}
                        className="w-full px-3 py-2 rounded-xl border border-[#dadce0] dark:border-white/10 bg-white dark:bg-[#141417] text-[12px] uppercase text-[#111] dark:text-white placeholder:text-[#9ca3af] dark:placeholder:text-[#71717A] focus:outline-none focus:border-[#007AFF] disabled:cursor-not-allowed disabled:opacity-60" />
                    </label>
                    <VehicleBrandModelFields
                      brand={newBrand}
                      model={newModel}
                      catalog={vehicleCatalog}
                      disabled={isVehicleSaving}
                      onBrandChange={setNewBrand}
                      onModelChange={setNewModel}
                    />
                    <label className="block space-y-1">
                      <span className="text-[10px] font-semibold uppercase text-[#5f6368] dark:text-[#A1A1AA]">Color</span>
                      <input type="text" value={newColor} onChange={(e) => setNewColor(e.target.value)} placeholder="Black"
                        maxLength={30} required disabled={isVehicleSaving}
                        className="w-full px-3 py-2 rounded-xl border border-[#dadce0] dark:border-white/10 bg-white dark:bg-[#141417] text-[12px] text-[#111] dark:text-white placeholder:text-[#9ca3af] dark:placeholder:text-[#71717A] focus:outline-none focus:border-[#007AFF] disabled:cursor-not-allowed disabled:opacity-60" />
                    </label>
                    <button type="submit" disabled={isVehicleSaving}
                      className="flex min-h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#0066d6] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer">
                      {isVehicleSaving && <Loader2 size={14} className="animate-spin" />}
                      {isVehicleSaving ? 'Saving Vehicle' : 'Save Vehicle'}
                    </button>
                  </form>
                )}
              </div>
              {/* History */}
              <div className="bg-white dark:bg-[#141417] rounded-2xl border border-[#e8eaed] dark:border-white/10 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[#5f6368] dark:text-[#A1A1AA]">Booking History</h3>
                  <button type="button" onClick={() => setBookingHistoryRefreshKey((value) => value + 1)} disabled={isBookingHistoryLoading} className="rounded-lg p-1.5 text-[#5f6368] dark:text-[#A1A1AA] hover:bg-[#f1f3f4] dark:hover:bg-[#202025] cursor-pointer" aria-label="Refresh booking history"><RefreshCw size={14} className={isBookingHistoryLoading ? 'animate-spin' : ''} /></button>
                </div>
                {bookingHistoryError && <div role="alert" className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/50 dark:border-red-900/50 px-3 py-2 text-[11px] text-red-700 dark:text-red-300"><AlertCircle size={14} />{bookingHistoryError}</div>}
                {isBookingHistoryLoading && bookingHistory.length === 0 ? <div className="py-5 text-center text-[11px] text-[#5f6368] dark:text-[#A1A1AA]"><Loader2 size={18} className="mx-auto animate-spin text-[#007AFF]" />Loading history...</div> : null}
                {bookingHistory.map((item) => {
                  const { booking, review } = item;
                  const isEditingReview = review?.reviewId === editingReviewId;
                  return <article key={booking.bookingId} className="border-b border-[#f1f3f4] dark:border-white/10 py-4 last:border-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-semibold text-[#111] dark:text-white">{booking.parkingLabel || 'Parking lot #' + booking.parkingSpotId}</p>
                          <span className="rounded-full bg-[#eef5ff] dark:bg-white/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#007AFF] dark:text-white">Parking ID #{booking.parkingSpotId}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">{new Date(booking.startDate).toLocaleDateString('en-MY')} – {new Date(booking.endDate).toLocaleDateString('en-MY')}</p>
                        <p className="mt-1 text-[10px] text-[#9ca3af] dark:text-[#71717A]">Booking {booking.bookingReference || '#' + booking.bookingId}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="text-[13px] font-semibold text-[#111] dark:text-white">RM {booking.totalAmount.toFixed(2)}</span>
                        <p className={`text-[10px] font-medium ${booking.bookingStatus.toLowerCase() === 'cancelled' ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{booking.bookingStatus}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {item.canReview && !review && <button type="button" onClick={() => navigate('/commuter/parking/' + booking.parkingSpotId + '/review', { state: { booking: historyItemToBooking(item) } })} className="text-[11px] font-semibold text-[#007AFF] hover:underline cursor-pointer">Write a review</button>}
                      {booking.bookingStatus.toLowerCase() === 'confirmed' && new Date(booking.startDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0) && (
                        <button
                          type="button"
                          disabled={cancelingBookingId === booking.bookingId}
                          onClick={() => void handleCancelBooking(booking.bookingId)}
                          className="text-[11px] font-semibold text-[#dc2626] hover:underline disabled:opacity-50 cursor-pointer"
                        >
                          {cancelingBookingId === booking.bookingId ? 'Cancelling…' : 'Cancel booking'}
                        </button>
                      )}
                    </div>

                    {review && !isEditingReview && <div className="mt-3 rounded-xl border border-[#e8eaed] dark:border-white/10 bg-[#f8f9fa] dark:bg-[#18181C] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[11px] font-semibold text-[#111] dark:text-white">Your commuter review</p>
                            {review.isVerifiedBooking && <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfdf3] dark:bg-emerald-950/60 px-2 py-0.5 text-[9px] font-semibold text-[#15803d] dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50"><ShieldCheck size={11} /> Verified stay</span>}
                          </div>
                          <div className="mt-1 flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>
                            {[1, 2, 3, 4, 5].map((value) => <Star key={value} size={13} className={value <= review.rating ? 'text-[#f59e0b]' : 'text-[#d1d5db] dark:text-[#71717A]'} fill={value <= review.rating ? 'currentColor' : 'none'} />)}
                            <span className="ml-1 text-[10px] font-semibold text-[#6e6e73] dark:text-[#A1A1AA]">{review.rating}/5</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => startReviewEdit(item)} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#dbeafe] dark:border-white/14 bg-white dark:bg-[#242429] px-2.5 text-[10px] font-semibold text-[#007AFF] dark:text-white hover:bg-[#eff6ff] dark:hover:bg-[#2C2C32] cursor-pointer"><Pencil size={12} /> Edit</button>
                      </div>
                      <p className="review-comment-text mt-3 whitespace-pre-line text-[11px] leading-5">{review.comment || 'You submitted a rating without a written comment.'}</p>
                      <div className="review-owner-reply-box mt-3 rounded-lg px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2"><p className="review-owner-reply-title text-[9px] font-semibold uppercase tracking-wide">Owner reply</p>{review.ownerReplyAt && <time dateTime={review.ownerReplyAt} className="review-owner-reply-time text-[9px]">{new Date(review.ownerReplyAt).toLocaleDateString('en-MY')}</time>}</div>
                        <p className={`mt-1 text-[10px] leading-4 ${review.ownerReply ? 'review-owner-reply-text' : 'text-[#9ca3af] dark:text-[#71717A]'}`}>{review.ownerReply || 'The owner has not replied to this review yet.'}</p>
                      </div>
                    </div>}

                    {review && isEditingReview && <div className="mt-3 rounded-xl border border-[#bfdbfe] dark:border-white/10 bg-[#eff6ff] dark:bg-[#18181C] p-3">
                      <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold text-[#111] dark:text-white">Edit your review</p><button type="button" onClick={cancelReviewEdit} disabled={isReviewSaving} className="text-[10px] font-semibold text-[#5f6368] dark:text-[#A1A1AA] hover:text-[#111] dark:hover:text-white disabled:opacity-50 cursor-pointer">Cancel</button></div>
                      <div className="mt-3"><span className="block text-[10px] font-semibold uppercase tracking-wide text-[#5f6368] dark:text-[#A1A1AA]">Rating</span><div className="mt-1 flex items-center gap-1" role="radiogroup" aria-label="Review rating">
                        {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" role="radio" aria-checked={editingReviewRating === value} aria-label={`${value} star${value === 1 ? '' : 's'}`} onClick={() => setEditingReviewRating(value)} disabled={isReviewSaving} className="rounded p-0.5 hover:bg-white dark:hover:bg-[#202025] disabled:opacity-50 cursor-pointer"><Star size={19} className={value <= editingReviewRating ? 'text-[#f59e0b]' : 'text-[#cbd5e1] dark:text-[#71717A]'} fill={value <= editingReviewRating ? 'currentColor' : 'none'} /></button>)}
                      </div></div>
                      <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-[#5f6368] dark:text-[#A1A1AA]">Comment<textarea value={editingReviewComment} onChange={(event) => setEditingReviewComment(event.target.value)} maxLength={1000} rows={4} disabled={isReviewSaving} placeholder="Share what you thought about this parking lot." className="mt-1 w-full resize-y rounded-lg border border-[#dbeafe] dark:border-white/10 bg-white dark:bg-[#141417] px-3 py-2 text-[11px] font-normal leading-5 text-[#111] dark:text-white outline-none focus:border-[#007AFF] disabled:opacity-60" /></label>
                      <div className="review-owner-reply-box mt-3 rounded-lg px-3 py-2.5"><p className="review-owner-reply-title text-[9px] font-semibold uppercase tracking-wide">Owner reply</p><p className={`mt-1 text-[10px] leading-4 ${review.ownerReply ? 'review-owner-reply-text' : 'text-[#9ca3af] dark:text-[#71717A]'}`}>{review.ownerReply || 'The owner has not replied to this review yet.'}</p></div>
                      <div className="mt-1 flex items-center justify-between gap-3"><span className="text-[10px] text-[#6e6e73] dark:text-[#A1A1AA]">{editingReviewComment.length}/1000</span>{editingReviewError && <span role="alert" className="text-right text-[10px] text-[#dc2626] dark:text-red-400">{editingReviewError}</span>}</div>
                      <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={cancelReviewEdit} disabled={isReviewSaving} className="rounded-lg border border-[#d1d5db] dark:border-white/14 bg-white dark:bg-[#242429] px-3 py-2 text-[10px] font-semibold text-[#5f6368] dark:text-[#A1A1AA] hover:bg-[#f8f9fa] dark:hover:bg-[#2C2C32] disabled:opacity-50 cursor-pointer">Cancel</button><button type="button" onClick={() => void saveReviewEdit()} disabled={isReviewSaving || !editingReviewRating} className="inline-flex items-center gap-1.5 rounded-lg bg-[#007AFF] px-3 py-2 text-[10px] font-semibold text-white hover:bg-[#0066d6] disabled:cursor-wait disabled:opacity-60 cursor-pointer">{isReviewSaving && <Loader2 size={12} className="animate-spin" />}{isReviewSaving ? 'Saving…' : 'Save changes'}</button></div>
                    </div>}
                  </article>;
                })}
                {bookingHistory.length === 0 && history.length === 0 && !isBookingHistoryLoading && !bookingHistoryError && <p className="py-4 text-center text-[11px] text-[#9ca3af] dark:text-[#71717A]">No booking history yet.</p>}
                {history.map((b) => <div key={b.id} className="flex items-center justify-between py-2.5 border-b border-[#f1f3f4] dark:border-white/10 last:border-0"><div><p className="text-[13px] font-medium text-[#111] dark:text-white">{b.spot.name}</p><p className="text-[11px] text-[#9ca3af] dark:text-[#71717A]">{b.spot.station}</p></div><div className="text-right"><span className="text-[13px] font-semibold text-[#111] dark:text-white">RM {(b.totalPaid ?? 0).toFixed(2)}</span><p className="text-[10px] text-[#16a34a] font-medium">{b.status}</p></div></div>)}
                {bookingHistoryMeta.totalPages > 1 && <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-[#5f6368] dark:text-[#A1A1AA]"><button type="button" onClick={() => setBookingHistoryPage((value) => Math.max(1, value - 1))} disabled={bookingHistoryPage === 1} className="cursor-pointer">Previous</button><span>Page {bookingHistoryPage} of {bookingHistoryMeta.totalPages}</span><button type="button" onClick={() => setBookingHistoryPage((value) => Math.min(bookingHistoryMeta.totalPages, value + 1))} disabled={bookingHistoryPage === bookingHistoryMeta.totalPages} className="cursor-pointer">Next</button></div>}
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            supportViewer && <SupportWorkspace mode="user" viewer={supportViewer} />
          )}

          {activeTab === 'favorites' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#e8eaed] dark:border-white/10 bg-white dark:bg-[#141417] px-4 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-500 dark:text-rose-400">{isFavoritesLoading ? <Loader2 size={17} className="animate-spin" /> : <Heart size={17} fill="currentColor" />}</span><div><p className="text-[13px] font-semibold text-[#111] dark:text-white">Saved parking</p><p className="text-[11px] text-[#5f6368] dark:text-[#A1A1AA]">{isFavoritesLoading ? 'Refreshing favorites…' : `${favoriteSpots.length} space${favoriteSpots.length === 1 ? '' : 's'} ready to revisit`}</p></div></div>
                {favoriteSpots.length > 0 && <button type="button" onClick={() => void handleClearFavorites()} disabled={isFavoritesLoading || isClearingFavorites} className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:cursor-wait disabled:opacity-70 cursor-pointer">{isClearingFavorites && <Loader2 size={13} className="animate-spin" />}{isClearingFavorites ? 'Clearing…' : 'Clear all'}</button>}
              </div>
              {isFavoritesLoading && favoriteSpots.length === 0 ? (
                <div className="rounded-2xl border border-[#e8eaed] dark:border-white/10 bg-white dark:bg-[#141417] p-10 text-center" role="status">
                  <Loader2 size={28} className="mx-auto animate-spin text-[#007AFF]" />
                  <p className="mt-3 text-[13px] font-semibold text-[#111] dark:text-white">Loading your favorites…</p>
                </div>
              ) : favoriteSpots.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#dadce0] dark:border-white/15 bg-white dark:bg-[#141417] p-10 text-center">
                  <Heart size={32} className="mx-auto text-[#dadce0] dark:text-[#71717A]" />
                  <p className="mt-3 text-[14px] font-semibold text-[#111] dark:text-white">No favorite parking yet</p>
                  <p className="mt-1 text-[12px] text-[#5f6368] dark:text-[#A1A1AA]">Tap the heart on a parking space to save it here.</p>
                  <button type="button" onClick={() => setActiveTab('home')} className="mt-4 rounded-xl bg-[#007AFF] px-5 py-2.5 text-[12px] font-semibold text-white hover:bg-[#0066d6] cursor-pointer">Browse parking</button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {favoriteSpots.map((spot) => (
                    <article key={spot.parkingSpotId} className="overflow-hidden rounded-2xl border border-[#e8eaed] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                      <div className="relative">
                        {spot.primaryImageUrl ? <img src={spot.primaryImageUrl} alt="" className="aspect-[16/9] w-full object-cover" /> : <div className="flex aspect-[16/9] items-center justify-center bg-[#eff6ff]"><Home size={28} className="text-[#007AFF]" /></div>}
                        <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 shadow-sm backdrop-blur">{spot.availabilityStatus}</span>
                        <button type="button" onClick={() => void handleToggleFavorite(spot)} disabled={isFavoritesLoading || isClearingFavorites || favoriteUpdatingIds.includes(spot.parkingSpotId)} aria-label={`Remove ${spot.propertyName} from favorites`} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-black/[0.06] bg-white/95 text-rose-500 shadow-md backdrop-blur active:scale-95 disabled:cursor-wait disabled:opacity-70">{favoriteUpdatingIds.includes(spot.parkingSpotId) ? <Loader2 size={18} className="animate-spin text-[#007AFF]" /> : <Heart size={18} fill="currentColor" />}</button>
                      </div>
                      <div className="p-4">
                        <div className="min-w-0"><h3 className="truncate text-[15px] font-semibold text-[#111] dark:text-[#f5f5f7]">{spot.propertyName}</h3><p className="mt-1 text-[11px] text-[#5f6368]">Bay {spot.parkingLabel} · Near {spot.stationName}</p></div>
                        <p className="mt-2 line-clamp-2 text-[11px] text-[#6e6e73] dark:text-[#a1a1a6]">{spot.address}</p>
                        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[#f8f9fa] dark:bg-white/[0.06] p-3 text-[11px]"><div><span className="block text-[10px] text-[#9ca3af] dark:text-[#a1a1a6]">Daily rate</span><strong className="mt-0.5 block text-[#111] dark:text-[#f5f5f7]">{spot.dailyRate === null ? 'Not set' : `RM ${spot.dailyRate.toFixed(2)}`}</strong></div><div><span className="block text-[10px] text-[#9ca3af] dark:text-[#a1a1a6]">To station</span><strong className="mt-0.5 block text-[#111] dark:text-[#f5f5f7]">{(spot.distanceToStation ?? 0).toFixed(2)} km</strong></div></div>
                        <button type="button" onClick={() => openParkingDetail(spot, null, spot.stationName)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-4 text-[12px] font-semibold text-white hover:bg-[#0066d6]">View parking <ChevronRight size={15} /></button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          </PageTransition>
        </main>
      </div>

      <BottomNav
        items={[
          { id: 'map', icon: Map, label: 'Transit' },
          { id: 'home', icon: Compass, label: 'Browse' },
          { id: 'active', icon: Unlock, label: 'Pass', dot: !!activeBooking || upcomingBookings.length > 0 },
          { id: 'wallet', icon: Wallet, label: 'Wallet' },
          { id: 'more', icon: Menu, label: 'More' },
        ]}
        activeId={['profile', 'favorites', 'support'].includes(activeTab) ? 'more' : activeTab}
        onChange={(id) => {
          if (id === 'more') {
            setSidebarOpen(true);
            return;
          }
          setActiveTab(id as typeof activeTab);
          setSelectedSpot(null);
        }}
      />
      </div>

      {/* ─── Notifications Drawer ─── */}
      <AnimatePresence>
      {showNotificationsDrawer && (
        <div className="fixed inset-0 z-[1250] flex justify-end">
          <motion.div
            initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: prefersReducedMotion ? 1 : 0 }}
            className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
            onClick={() => setShowNotificationsDrawer(false)}
            aria-hidden="true"
          />
          <motion.div
            ref={notificationDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-title"
            tabIndex={-1}
            initial={{ x: prefersReducedMotion ? 0 : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: prefersReducedMotion ? 0 : '100%' }}
            transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-sm bg-white dark:bg-[#141417] h-full border-l border-black/[0.06] dark:border-white/10 p-5 overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="notifications-title" className="text-[15px] font-bold text-[#111] dark:text-white">Notifications</h3>
              <button type="button" aria-label="Close notifications" onClick={() => setShowNotificationsDrawer(false)} className="p-1.5 rounded-lg hover:bg-[#f1f3f4] dark:hover:bg-[#202025] text-[#5f6368] dark:text-[#A1A1AA] hover:text-[#111] dark:hover:text-white cursor-pointer"><X size={18} /></button>
            </div>
            <div className="mt-3 space-y-4">
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-[#1C1C1E] p-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-[#0A84FF]">
                  <Bell className="h-6 w-6" />
                </div>
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Notification Center</h4>
                  <span className="rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40">
                    Service Upcoming
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-[#A1A1AA] leading-relaxed">
                  Real-time push alerts, booking confirmation receipts, and 15-minute grace period reminders will be delivered directly here once the notifications engine is connected.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* ─── Top-Up Modal ─── */}
      {showTopUpModal && (
        <div className="wallet-topup-modal fixed inset-0 z-[1250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => !isTopUpLoading && setShowTopUpModal(false)} aria-hidden="true" />
          <div ref={topUpDialogRef} role="dialog" aria-modal="true" aria-labelledby="top-up-title" tabIndex={-1} className="wallet-topup-dialog relative bg-white dark:bg-[#141417] rounded-2xl border border-[#e8eaed] dark:border-white/10 p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-start gap-3 mb-5">
              <span className="wallet-topup-dialog__mark" aria-hidden="true"><Wallet size={20} /></span>
              <div className="min-w-0 flex-1">
                <h3 id="top-up-title" className="text-[15px] font-bold text-[#111] dark:text-white">Top up wallet</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-[#6e6e73] dark:text-[#A1A1AA]">Choose an amount, then complete payment on Stripe's secure checkout.</p>
              </div>
              <button type="button" aria-label="Close wallet top up" disabled={isTopUpLoading} onClick={() => setShowTopUpModal(false)} className="p-1.5 rounded-lg hover:bg-[#f1f3f4] dark:hover:bg-[#202025] text-[#5f6368] dark:text-[#A1A1AA] hover:text-[#111] dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handleTopUp} className="space-y-4">
              <div className="wallet-topup-presets grid grid-cols-4 gap-2" aria-label="Suggested top-up amounts">
                {['20', '50', '100', '500'].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    disabled={isTopUpLoading}
                    onClick={() => {
                      setTopUpAmount(amount);
                      setTopUpError(null);
                    }}
                    className={`py-2 rounded-xl text-[12px] font-semibold border transition disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer ${topUpAmount === amount ? 'bg-[#007AFF] text-white border-[#007AFF]' : 'bg-white dark:bg-[#18181C] text-[#5f6368] dark:text-[#A1A1AA] border-[#dadce0] dark:border-white/10 hover:border-[#007AFF]'}`}
                  >
                    RM {amount}
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="top-up-amount" className="block text-[11px] font-medium text-[#6e6e73] dark:text-[#A1A1AA] mb-1.5">Top-up amount (RM)</label>
                <input
                  id="top-up-amount"
                  type="number"
                  min="10.01"
                  max="4999.99"
                  step="0.01"
                  inputMode="decimal"
                  required
                  disabled={isTopUpLoading}
                  value={topUpAmount}
                  onChange={(event) => {
                    setTopUpAmount(event.target.value);
                    setTopUpError(null);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#dadce0] dark:border-white/10 bg-white dark:bg-[#18181C] text-[13px] text-[#111] dark:text-white focus:outline-none focus:border-[#007AFF] disabled:bg-[#f5f5f7] dark:disabled:bg-[#202025]"
                  placeholder="50.00"
                />
              </div>

              <div>
                <label htmlFor="top-up-description" className="block text-[11px] font-medium text-[#6e6e73] dark:text-[#A1A1AA] mb-1.5">Description</label>
                <input
                  id="top-up-description"
                  type="text"
                  maxLength={200}
                  disabled={isTopUpLoading}
                  value={topUpDescription}
                  onChange={(event) => setTopUpDescription(event.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#dadce0] dark:border-white/10 bg-white dark:bg-[#18181C] text-[13px] text-[#111] dark:text-white focus:outline-none focus:border-[#007AFF] disabled:bg-[#f5f5f7] dark:disabled:bg-[#202025]"
                  placeholder="Optional"
                />
              </div>

              <p className="text-[10px] text-[#6e6e73] dark:text-[#A1A1AA]">Enter an amount above RM 10.00 and below RM 5,000.00.</p>

              {topUpError && <p role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">{topUpError}</p>}

              <div className="flex items-start gap-2 rounded-xl bg-[#f5f5f7] dark:bg-[#18181C] dark:border dark:border-white/10 p-3 text-[10px] leading-relaxed text-[#6e6e73] dark:text-[#A1A1AA]">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#007AFF]" />
                <p>You will continue to Stripe Checkout. Your balance changes only after payment confirmation.</p>
              </div>

              <button
                type="submit"
                disabled={isTopUpLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0066d6] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {isTopUpLoading ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                {isTopUpLoading ? 'Creating checkout…' : 'Continue to checkout'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── QR Scanner Modal ─── */}
      {showQRScanner && (
        <div ref={qrDialogRef} role="dialog" aria-modal="true" aria-labelledby="qr-scanner-title" tabIndex={-1} className="fixed inset-0 z-[1250] bg-black flex flex-col items-center justify-center">
          <button type="button" aria-label="Close QR scanner" onClick={closeQRScanner} className="absolute top-5 right-5 text-white p-2"><X size={24} /></button>
          <div className="w-72 h-72 border-2 border-white/30 rounded-2xl relative overflow-hidden">
            {scannerCameraActive && <video ref={videoRef} autoPlay playsInline className="absolute inset-0 object-cover" />}
            <div className="absolute inset-0 border-2 border-[#007AFF] rounded-2xl m-4" />
            {!qrCodeScanned && <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#007AFF] animate-pulse motion-reduce:hidden" style={{ animation: 'scanLine 2s ease-in-out infinite' }} />}
          </div>
          <p id="qr-scanner-title" className="text-white text-[13px] mt-4 font-medium">Point camera at IoT bollard QR code</p>
          <div className="mt-5 flex flex-col items-center gap-2 max-w-xs text-center px-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-[11px] font-bold text-amber-300 border border-amber-500/30">
              <Sparkles className="h-3 w-3" />
              Camera Auto-Scan Upcoming
            </span>
            <p className="text-white/70 text-xs leading-relaxed">
              Automated camera frame QR recognition is currently in preview. To unlock the bay, please use the <strong>Unlock Barrier</strong> button on your active reservation pass.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
