import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
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
  ArrowUpRight,
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
  Trash2
} from 'lucide-react';
import {
  ParkingSpot,
  ParkingSearchResponse,
  Booking,
  Vehicle,
  AppNotification,
  WalletTopUpStatus,
  WalletTopUpState,
} from '../types';
import CommuterMap from '../components/CommuterMap';
import ParkingPass from '../components/ParkingPass';
import JourneyStrip from '../components/JourneyStrip';
import DashboardHeader from '@/components/layout/DashboardHeader';
import AppSidebar from '@/components/layout/AppSidebar';
import BottomNav from '@/components/layout/BottomNav';
import PageTransition from '@/components/ui/PageTransition';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  clearJourneySession,
  loadJourneySession,
  saveJourneySession,
  updateJourneyStage,
} from '../lib/journeySession';
import type { JourneyStage } from '../lib/journeySession';
import { getNearbyParking, searchParking } from '../api/parkingApi';
import { createWalletTopUp, getWalletSummary, getWalletTopUpStatus } from '../api/walletApi';
import { addVehicle, deleteVehicle, getMyVehicles, modifyVehicle } from '../api/vehicleApi';
import { getVehicleCatalog, type VehicleCatalogEntry } from '../api/vehicleCatalogApi';
import { VEHICLE_CATALOG_FALLBACK } from '../data/vehicleCatalog';
import VehicleBrandModelFields from '../components/VehicleBrandModelFields';
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

const VEHICLE_CACHE_KEY = (userId: number) => `parkjom.vehicles.${userId}`;

const loadCachedVehicles = (userId: number): Vehicle[] => {
  try {
    const rawVehicles = localStorage.getItem(VEHICLE_CACHE_KEY(userId));
    if (!rawVehicles) return [];

    const parsed = JSON.parse(rawVehicles) as unknown;
    if (!Array.isArray(parsed)) return [];

    const vehicles = parsed.filter((value): value is Vehicle => {
      if (!value || typeof value !== 'object') return false;
      const vehicle = value as Partial<Vehicle>;
      return typeof vehicle.vehicleId === 'number'
        && Number.isFinite(vehicle.vehicleId)
        && vehicle.vehicleId > 0
        && typeof vehicle.plate === 'string'
        && Boolean(vehicle.plate.trim())
        && typeof vehicle.brand === 'string'
        && typeof vehicle.model === 'string'
        && typeof vehicle.color === 'string'
        && typeof vehicle.active === 'boolean';
    });
    const activeIndex = vehicles.findIndex((vehicle) => vehicle.active);
    const selectedIndex = activeIndex >= 0 ? activeIndex : vehicles.length > 0 ? 0 : -1;

    return vehicles.map((vehicle, index) => ({
      ...vehicle,
      plate: vehicle.plate.trim().toUpperCase(),
      brand: vehicle.brand.trim(),
      model: vehicle.model.trim(),
      color: vehicle.color.trim(),
      active: index === selectedIndex,
    }));
  } catch {
    return [];
  }
};

const saveCachedVehicles = (userId: number, vehicles: Vehicle[]) => {
  try {
    localStorage.setItem(VEHICLE_CACHE_KEY(userId), JSON.stringify(vehicles));
  } catch {
    // Vehicle API actions still work when browser storage is unavailable.
  }
};

export default function CommuterDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [initialJourney] = useState(loadJourneySession);
  type CommuterTab = 'home' | 'active' | 'wallet' | 'profile' | 'map';
  const locationParams = new URLSearchParams(location.search);
  const queryTab = locationParams.get('tab');
  const requestedTabFromQuery: CommuterTab | undefined = queryTab === 'home'
    || queryTab === 'active'
    || queryTab === 'wallet'
    || queryTab === 'profile'
    || queryTab === 'map'
    ? queryTab
    : undefined;
  const requestedTab = requestedTabFromQuery || (location.state as { activeTab?: CommuterTab } | null)?.activeTab;
  const persistedTab = (() => {
    try {
      const stored = localStorage.getItem('parkjom_commuter_tab');
      return stored === 'home' || stored === 'active' || stored === 'wallet' || stored === 'profile' || stored === 'map'
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
  const [selectedStationCoords, setSelectedStationCoords] = useState<StationCoordinates | null>(null);
  const [distanceFilter, setDistanceFilter] = useState<number>(3000); // meters
  const [spotTypeFilter, setSpotTypeFilter] = useState<string>('all');
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
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
    if (!user?.token) return;

    setIsVehiclesLoading(true);
    setVehiclesLoadError(null);
    try {
      const result = await getMyVehicles(user.token, signal);
      if (signal?.aborted) return;

      setVehicles((current) => {
        const selectedVehicleId = current.find((vehicle) => vehicle.active)?.vehicleId;
        const selectedVehicleExists = result.data.some((vehicle) => vehicle.vehicleId === selectedVehicleId);

        return result.data.map((vehicle, index) => ({
          vehicleId: vehicle.vehicleId,
          plate: vehicle.numberPlate.trim().toUpperCase(),
          brand: vehicle.vehicleBrand.trim(),
          model: vehicle.vehicleModel.trim(),
          color: vehicle.vehicleColor.trim(),
          active: selectedVehicleExists ? vehicle.vehicleId === selectedVehicleId : index === 0,
        }));
      });
    } catch (error) {
      if (signal?.aborted) return;
      setVehiclesLoadError(error instanceof Error ? error.message : 'Unable to load your vehicles.');
    } finally {
      if (!signal?.aborted) setIsVehiclesLoading(false);
    }
  }, [user?.token]);

  // Active Reservation / Session — TODO: fetch from backend
  const [activeBooking, setActiveBooking] = useState<Booking | null>(initialJourney?.booking ?? null);
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
    const controller = new AbortController();
    void getVehicleCatalog(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setVehicleCatalog(result.data);
      })
      .catch(() => {
        // Keep the local catalog available when the optional endpoint is absent.
      });
    return () => controller.abort();
  }, []);

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

  // Booking history — TODO: fetch from backend
  const [history, setHistory] = useState<Booking[]>([]);

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
    if (spot.distance > distanceFilter) return false;
    if (activeBooking && activeBooking.spot.id === spot.id) return false;
    return spot.available;
  });

  const lensSpots = mapNearbySpots;
  const lensSelectedSpot = selectedSpot ?? lensSpots[0] ?? null;
  const getStationCacheKey = (stationName: string, lat: number, lng: number) =>
    `${stationName.trim().toLowerCase()}::${lat.toFixed(5)}:${lng.toFixed(5)}`;
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
    if (activeTab !== 'home') return;

    setLocationError(null);
    setLocationStatus('locating');

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

    const cacheKey = selectedStation
      ? getStationCacheKey(selectedStation, selectedStationCoords.lat, selectedStationCoords.lng)
      : '';

    if (cacheKey && nearbySpotCache[cacheKey]) {
      setNearbySpots(nearbySpotCache[cacheKey]);
      setNearbyError(null);
      setIsNearbyLoading(false);
      setSelectedSpot(nearbySpotCache[cacheKey][0] ?? null);
      return;
    }

    const controller = new AbortController();

    async function loadNearbySpots() {
      setIsNearbyLoading(true);
      setNearbyError(null);

      try {
        const res = await getNearbyParking(selectedStationCoords.lat, selectedStationCoords.lng, controller.signal);

        const data = await res.json().catch(() => null) as ParkingSearchResponse | null;
        if (!res.ok || !data?.success) throw new Error(data?.message || `Nearby search failed (${res.status})`);
        if (!Array.isArray(data.data)) throw new Error('Nearby search returned an invalid data list.');

        const fetchedSpots = data.data.map(mapParkingResult);

        setNearbySpots(fetchedSpots);
        setNearbySpotCache((previousCache) => ({
          ...previousCache,
          [cacheKey || getStationCacheKey(selectedStation || '', selectedStationCoords.lat, selectedStationCoords.lng)]: fetchedSpots,
        }));
        setSelectedSpot(fetchedSpots[0] ?? null);
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
  }, [nearbySpotCache, selectedStation, selectedStationCoords]);

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

  const handleMapStationSelect = (name: string, lat: number, lng: number) => {
    setSelectedStation(name);
    setSelectedStationCoords({ lat, lng });
    setSelectedSpot(null);
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

  useEffect(() => {
    if (activeTab !== 'wallet' || !user?.token) return;

    void refreshWalletBalance();
    const storedPayment = loadPendingWalletTopUp(user.userId);
    if (storedPayment) void reconcilePendingTopUp(storedPayment);
  }, [activeTab, reconcilePendingTopUp, refreshWalletBalance, user?.token, user?.userId]);

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
      const result = await addVehicle(user.token, {
        numberPlate,
        vehicleBrand,
        vehicleModel,
        vehicleColor,
      });
      const createdVehicle = result.data;
      const newVehicle: Vehicle = {
        vehicleId: createdVehicle.vehicleId,
        plate: createdVehicle.numberPlate,
        brand: createdVehicle.vehicleBrand,
        model: createdVehicle.vehicleModel,
        color: createdVehicle.vehicleColor,
        active: true,
      };
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
      setVehicleFeedback({ tone: 'success', message: result.message || 'Vehicle added successfully.' });
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
    if (!window.confirm(`Delete vehicle ${vehicle.plate}? This action cannot be undone.`)) return;

    setVehicleDeletingId(vehicle.vehicleId);
    try {
      const result = await deleteVehicle(user.token, vehicle.vehicleId);
      setVehicles((current) => {
        const remaining = current.filter((item) => item.vehicleId !== vehicle.vehicleId);
        if (!vehicle.active || remaining.some((item) => item.active) || remaining.length === 0) return remaining;
        return remaining.map((item, index) => ({ ...item, active: index === 0 }));
      });
      setVehiclesLoadError(null);
      if (vehicleEditDraft?.vehicleId === vehicle.vehicleId) setVehicleEditDraft(null);
      setVehicleFeedback({ tone: 'success', message: result.message || 'Vehicle deleted successfully.' });
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
      const result = await modifyVehicle(user.token, request);
      setVehicles((current) => current.map((vehicle) => vehicle.vehicleId === request.vehicleId
        ? {
            ...vehicle,
            plate: result.data.numberPlate || request.numberPlate,
            brand: result.data.vehicleBrand || request.vehicleBrand,
            model: result.data.vehicleModel || request.vehicleModel,
            color: result.data.vehicleColor || request.vehicleColor,
          }
        : vehicle));
      setVehiclesLoadError(null);
      setVehicleEditDraft(null);
      setVehicleFeedback({ tone: 'success', message: result.message || 'Vehicle updated successfully.' });
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
    const activeVeh = vehicles.find(v => v.active)?.plate || 'VGV 8899';
    if (walletBalance === null) {
      alert('Your wallet balance is not available yet. Open Wallet to review or top up your account.');
      setActiveTab('wallet');
      return;
    }
    if (walletBalance < spot.pricePerHour * 2) {
      alert('Insufficient wallet balance. Please top up your wallet (minimum RM 10.00 required for reserve hold).');
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
    saveJourneySession(booking);
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
      clearJourneySession();
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
      setActiveTab('home');
    }
  };

  // IoT Bollard unlock flow
  const handleUnlockBollard = () => {
    if (gpsVerified !== 'verified') {
      alert('Access Denied. You must arrive and verify your GPS location near the parking spot before unlocking.');
      return;
    }

    setBollardAnimationState('lowering');
    
    // Simulate smart bollard motor lowering
    setTimeout(() => {
      setBollardAnimationState('lowered');
      setIsBollardUnlocked(true);
      setJourneyStage('unlocked');
      updateJourneyStage('unlocked');
      
      const newNotif: AppNotification = {
        id: 'iot-' + Date.now(),
        title: 'IoT Bollard Lowered',
        message: `Actuator command executed successfully for ${activeBooking?.spot.id}. You may now park.`,
        time: 'Just now',
        read: false,
        type: 'alert'
      };
      setNotifications(prev => [newNotif, ...prev]);
    }, 2000);
  };

  // Smart lock bollard flow
  const handleLockBollard = () => {
    setBollardAnimationState('raising');
    setTimeout(() => {
      setBollardAnimationState('raised');
      setIsBollardUnlocked(false);
      setJourneyStage('parked');
      updateJourneyStage('parked');
    }, 2000);
  };

  // Simulated GPS Verification toggle
  const triggerGPSCheck = () => {
    setGpsVerified('checking');
    setTimeout(() => {
      setGpsVerified('verified');
      setJourneyStage('arrived');
      updateJourneyStage('arrived');
    }, 1500);
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

  const simulateQRSuccess = () => {
    setQrCodeScanned(true);
    setTimeout(() => {
      closeQRScanner();
      handleUnlockBollard();
    }, 1200);
  };

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
      ],
    },
    {
      label: 'Account',
      items: [
        { id: 'wallet', icon: Wallet, label: 'Wallet', badge: walletBalance === null ? null : `RM ${walletBalance.toFixed(2)}` },
        { id: 'profile', icon: Car, label: 'Vehicles', badge: vehicles.length },
      ],
    },
  ];

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
      />

      {/* ─── Main Layout ─── */}
      <div className="commuter-content-grid flex-1 max-w-[1180px] w-full mx-auto px-4 md:px-8 pt-4 lg:pt-6">

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
            <button onClick={() => setActiveTab('active')}
              className="w-full bg-[#007AFF] text-white rounded-2xl p-4 flex items-center justify-between text-[13px] font-semibold mb-4 hover:bg-[#0066d6] transition-colors">
              <div className="flex items-center gap-3">
                <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/60" /><span className="relative inline-flex rounded-full h-2 w-2 bg-white" /></span>
                <span className="truncate">{activeBooking.spot.name}</span>
              </div>
              <span className="font-mono font-bold bg-white/10 px-3 py-1 rounded-lg">{formatTime(secondsRemaining)}</span>
            </button>
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
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => openParkingDetail(
                        spot,
                        currentLocation,
                        currentLocation ? 'Your location' : spot.stationName,
                      )}
                      className="w-full bg-white rounded-2xl border p-4 text-left cursor-pointer transition-all duration-150 border-[#e8eaed] hover:border-[#d2d5d9]"
                    >
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        {spot.primaryImageUrl ? (
                          <img src={spot.primaryImageUrl} alt="" className="h-36 sm:h-20 w-full sm:w-24 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <div className="h-28 sm:h-20 w-full sm:w-24 rounded-xl bg-[#eff6ff] flex items-center justify-center shrink-0"><Home size={20} className="text-[#007AFF]" /></div>
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
                          <p className="mt-1 text-[11px] text-[#5f6368]">{spot.address}</p>
                          <p className="mt-1 text-[10px] text-[#9ca3af]">Near {spot.stationName} · {spot.distanceToStation.toFixed(2)} km to station · {spot.timeToStationInMinutes} min</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-semibold text-[#5f6368]">
                            <span>Daily: {spot.dailyRate === null ? '—' : `RM ${spot.dailyRate.toFixed(2)}`}</span>
                            <span>Monthly: RM {spot.monthlyRate.toFixed(2)}</span>
                            <span>{spot.primaryImageUrl ? 'Photo available' : 'No primary photo'}</span>
                          </div>
                        </div>
                        <ChevronRight size={18} className="hidden sm:block mt-1 shrink-0 text-[#9ca3af]" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── TAB: Map ─── */}
          {activeTab === 'map' && (
            <div className="map-lens">
              <div className="map-lens__map">
                <CommuterMap
                  spots={lensSpots}
                  onStationSelect={handleMapStationSelect}
                  selectedStation={selectedStation}
                  selectedStationCoords={selectedStationCoords}
                  selectedSpot={lensSelectedSpot}
                  onSpotClick={(spot) => setSelectedSpot(spot)}
                  distanceRadius={distanceFilter}
                  onDistanceRadiusChange={setDistanceFilter}
                />
              </div>

              <div className="map-lens__rail">
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
                            <span>Bay {spot.parkingLabel} · {spot.distanceToStation.toFixed(2)} km · {spot.timeToStationInMinutes} min</span>
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
                    isNearbyLoading={isNearbyLoading}
                  />
                </div>
              </div>

              {activeBooking && <JourneyStrip activeStep={journeyStep} />}
            </div>
          )}

          {/* ─── TAB: Active Session ─── */}
          {activeTab === 'active' && (
            <div className="space-y-4">
              <JourneyStrip activeStep={journeyStep} />
              {!activeBooking ? (
                <div className="bg-white rounded-2xl border border-[#e8eaed] p-8 text-center">
                  <Clock size={32} className="mx-auto text-[#dadce0] mb-2" />
                  <p className="text-[15px] font-semibold text-[#111]">No active booking</p>
                  <p className="text-[13px] text-[#5f6368] mt-1">Find and book a parking spot to get started.</p>
                  <button onClick={() => setActiveTab('map')} className="mt-4 px-5 py-2.5 rounded-xl bg-[#007AFF] text-white text-[13px] font-semibold hover:bg-[#0066d6] transition-colors">Find a bay</button>
                </div>
              ) : (
                <>
                  {/* Session Info */}
                  <div className="bg-white rounded-2xl border border-[#e8eaed] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[12px] font-semibold text-[#5f6368] uppercase tracking-wider">Active Session</h3>
                      <span className="text-[10px] font-mono font-bold bg-[#f0fdf4] text-[#16a34a] px-2 py-0.5 rounded-full">{activeBooking.status}</span>
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-[#111]">{activeBooking.spot.name}</p>
                      <p className="text-[12px] text-[#5f6368] mt-0.5">{activeBooking.spot.station} &middot; Plate: {activeBooking.vehiclePlate}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                      <div className="flex items-center gap-2">
                        <Clock size={15} className="text-[#5f6368]" />
                        <span className="text-[13px] font-semibold text-[#111]">{formatTime(secondsRemaining)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wallet size={15} className="text-[#5f6368]" />
                        <span className="text-[13px] font-semibold text-[#111]">RM {activeBooking.totalPaid.toFixed(2)}</span>
                      </div>
                    </div>
                    {showGraceAlert && (
                      <div className="bg-[#fefce8] border border-[#fde68a] rounded-xl p-3 text-[12px] text-[#a16207] flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0" /> Session ending in under 5 minutes.
                      </div>
                    )}
                  </div>

                  {/* IoT Bollard Control */}
                  <div className="bg-white rounded-2xl border border-[#e8eaed] p-5 space-y-4">
                    <h3 className="text-[12px] font-semibold text-[#5f6368] uppercase tracking-wider">Smart Bollard Control</h3>
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                        bollardAnimationState === 'lowered' ? 'bg-[#f0fdf4]' : bollardAnimationState === 'lowering' ? 'bg-[#fefce8]' : 'bg-[#f8f9fa]'
                      }`}>
                        {bollardAnimationState === 'lowered' ? <Unlock size={28} className="text-[#16a34a]" /> :
                         bollardAnimationState === 'lowering' ? <Loader2 size={28} className="text-[#d97706] animate-spin" /> :
                         <Lock size={28} className="text-[#9ca3af]" />}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#111]">
                          {bollardAnimationState === 'lowered' ? 'Bollard Lowered' : bollardAnimationState === 'lowering' ? 'Lowering...' : 'Bollard Raised'}
                        </p>
                        <p className="text-[11px] text-[#5f6368] mt-0.5">
                          {gpsVerified === 'verified' ? 'GPS verified — ready to unlock' : 'Arrive at spot to unlock'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {!isBollardUnlocked ? (
                        <>
                          <button onClick={triggerGPSCheck}
                            className={`w-full px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-colors ${gpsVerified === 'verified' ? 'bg-[#f0fdf4] text-[#16a34a]' : 'bg-[#f8f9fa] text-[#5f6368] hover:bg-[#f1f3f4]'}`}>
                            {gpsVerified === 'verified' ? 'GPS Verified' : gpsVerified === 'checking' ? 'Checking...' : 'Verify GPS'}
                          </button>
                          <button onClick={startQRScanner}
                            className="w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] text-[#5f6368] text-[12px] font-semibold hover:bg-[#f1f3f4] transition-colors flex items-center justify-center gap-1.5">
                            <Camera size={14} /> Scan QR
                          </button>
                          <button onClick={handleUnlockBollard}
                            disabled={gpsVerified !== 'verified'}
                            className={`w-full px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-colors ${gpsVerified === 'verified' ? 'bg-[#007AFF] text-white hover:bg-[#0066d6]' : 'bg-[#e8eaed] text-[#9ca3af] cursor-not-allowed'}`}>
                            Unlock Bollard
                          </button>
                        </>
                      ) : (
                        <button onClick={handleLockBollard}
                          className="w-full sm:col-span-3 px-4 py-2.5 rounded-xl bg-[#fef2f2] text-[#dc2626] text-[12px] font-semibold hover:bg-[#fee2e2] transition-colors flex items-center justify-center gap-1.5">
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
              <div className="wallet-balance-card bg-white rounded-2xl border border-[#e8eaed] p-6 text-center">
                <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Current Balance</p>
                <p className="text-[40px] font-bold text-[#111] tracking-[-0.02em] mt-1">
                  {walletBalance === null ? 'RM —' : `RM ${walletBalance.toFixed(2)}`}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-[11px] text-[#6e6e73]">
                  {walletBalance === null
                    ? walletLoadError || 'Loading your confirmed wallet balance…'
                    : 'Only server-confirmed funds are included in this balance.'}
                </p>
                <button
                  type="button"
                  onClick={openTopUpModal}
                  disabled={isWalletRefreshing}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-[#007AFF] text-white text-[13px] font-semibold hover:bg-[#0066d6] transition-colors disabled:cursor-wait disabled:opacity-60"
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
                    <p className="text-[10px] leading-relaxed text-[#6e6e73]">
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
              <div className="bg-white rounded-2xl border border-[#e8eaed] p-5">
                <h3 className="text-[12px] font-semibold text-[#5f6368] uppercase tracking-wider mb-3">Top-up Activity</h3>
                {(walletTopUpFeedback?.payment || pendingTopUp) ? (
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-[#f8f9fa] p-3.5">
                    <div>
                      <p className="text-[13px] font-semibold text-[#111]">Wallet top-up</p>
                      <p className="text-[11px] text-[#9ca3af]">
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
                    <span className="text-[13px] font-semibold text-[#007AFF]">
                      RM {(walletTopUpFeedback?.payment || pendingTopUp)?.amount.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="flex min-h-24 flex-col items-center justify-center rounded-xl bg-[#f8f9fa] px-4 text-center">
                    <Coins size={20} className="mb-2 text-[#9ca3af]" />
                    <p className="text-[12px] font-medium text-[#5f6368]">No recent top-ups</p>
                    <p className="mt-1 text-[11px] text-[#9ca3af]">Your next wallet top-up will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── TAB: Profile / Vehicles ─── */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-[#e8eaed] p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-[12px] font-semibold text-[#5f6368] uppercase tracking-wider">Your Vehicles</h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void loadMyVehicles()}
                      disabled={isVehiclesLoading}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#5f6368] transition-colors hover:bg-[#f1f3f4] hover:text-[#111] disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[#007AFF] hover:bg-[#eff6ff]">
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
                  <div className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-[#dadce0] px-4 text-center">
                    <Car size={20} className="mb-2 text-[#9ca3af]" />
                    <p className="text-[12px] font-medium text-[#5f6368]">No vehicles added yet</p>
                    <p className="mt-1 text-[11px] text-[#9ca3af]">Add a vehicle to use it for your next parking session.</p>
                  </div>
                )}
                {vehicles.map((v) => (
                  <div key={v.vehicleId ?? v.plate}
                    className={`mb-1 flex items-center rounded-xl border transition-colors ${v.active ? 'border-[#bfdbfe] bg-[#eff6ff]' : 'border-transparent hover:bg-[#f8f9fa]'}`}>
                    <button type="button" onClick={() => setActiveVehicle(v.plate)} aria-pressed={v.active}
                      className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left">
                      <Car size={18} className={v.active ? 'text-[#007AFF]' : 'text-[#9ca3af]'} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-[#111]">{v.plate}</p>
                        <p className="truncate text-[11px] text-[#5f6368]">{v.brand} {v.model} &middot; {v.color}</p>
                      </div>
                      {v.active && <span className="text-[10px] font-semibold bg-[#007AFF] text-white px-2 py-0.5 rounded-full">Active</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => beginVehicleEdit(v)}
                      disabled={isVehicleUpdating || vehicleDeletingId !== null}
                      className="rounded-lg p-2 text-[#5f6368] transition-colors hover:bg-white hover:text-[#007AFF] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Edit vehicle ${v.plate}`}
                      title="Edit vehicle"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteVehicle(v)}
                      disabled={isVehicleUpdating || vehicleDeletingId !== null}
                      className="mr-2 rounded-lg p-2 text-[#5f6368] transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <form onSubmit={handleModifyVehicle} className="mt-3 space-y-2 rounded-xl bg-[#f8f9fa] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">Edit vehicle</p>
                      <button type="button" onClick={() => setVehicleEditDraft(null)} disabled={isVehicleUpdating}
                        className="rounded-lg p-1 text-[#5f6368] hover:bg-white hover:text-[#111] disabled:opacity-50" aria-label="Cancel vehicle edit">
                        <X size={15} />
                      </button>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-semibold uppercase text-[#5f6368]">Number plate</span>
                      <input type="text" value={vehicleEditDraft.numberPlate}
                        onChange={(event) => setVehicleEditDraft((current) => current ? { ...current, numberPlate: event.target.value } : current)}
                        maxLength={20} required disabled={isVehicleUpdating}
                        className="w-full rounded-xl border border-[#dadce0] px-3 py-2 text-[12px] uppercase focus:border-[#007AFF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
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
                      <span className="text-[10px] font-semibold uppercase text-[#5f6368]">Color</span>
                      <input type="text" value={vehicleEditDraft.vehicleColor}
                        onChange={(event) => setVehicleEditDraft((current) => current ? { ...current, vehicleColor: event.target.value } : current)}
                        maxLength={30} required disabled={isVehicleUpdating}
                        className="w-full rounded-xl border border-[#dadce0] px-3 py-2 text-[12px] focus:border-[#007AFF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
                    </label>
                    <button type="submit" disabled={isVehicleUpdating}
                      className="flex min-h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#0066d6] disabled:cursor-not-allowed disabled:opacity-60">
                      {isVehicleUpdating && <Loader2 size={14} className="animate-spin" />}
                      {isVehicleUpdating ? 'Updating Vehicle' : 'Update Vehicle'}
                    </button>
                  </form>
                )}
                {showAddVehicle && (
                  <form onSubmit={handleAddVehicle} className="mt-3 p-4 bg-[#f8f9fa] rounded-xl space-y-2">
                    <label className="block space-y-1">
                      <span className="text-[10px] font-semibold uppercase text-[#5f6368]">Number plate</span>
                      <input type="text" value={newPlate} onChange={(e) => setNewPlate(e.target.value)} placeholder="WXY1234"
                        maxLength={20} required disabled={isVehicleSaving}
                        className="w-full px-3 py-2 rounded-xl border border-[#dadce0] text-[12px] uppercase focus:outline-none focus:border-[#007AFF] disabled:cursor-not-allowed disabled:opacity-60" />
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
                      <span className="text-[10px] font-semibold uppercase text-[#5f6368]">Color</span>
                      <input type="text" value={newColor} onChange={(e) => setNewColor(e.target.value)} placeholder="Black"
                        maxLength={30} required disabled={isVehicleSaving}
                        className="w-full px-3 py-2 rounded-xl border border-[#dadce0] text-[12px] focus:outline-none focus:border-[#007AFF] disabled:cursor-not-allowed disabled:opacity-60" />
                    </label>
                    <button type="submit" disabled={isVehicleSaving}
                      className="flex min-h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#0066d6] disabled:cursor-not-allowed disabled:opacity-60">
                      {isVehicleSaving && <Loader2 size={14} className="animate-spin" />}
                      {isVehicleSaving ? 'Saving Vehicle' : 'Save Vehicle'}
                    </button>
                  </form>
                )}
              </div>
              {/* History */}
              <div className="bg-white rounded-2xl border border-[#e8eaed] p-5">
                <h3 className="text-[12px] font-semibold text-[#5f6368] uppercase tracking-wider mb-3">Booking History</h3>
                {history.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-2.5 border-b border-[#f1f3f4] last:border-0">
                    <div>
                      <p className="text-[13px] font-medium text-[#111]">{b.spot.name}</p>
                      <p className="text-[11px] text-[#9ca3af]">{b.spot.station}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[13px] font-semibold text-[#111]">RM {b.totalPaid.toFixed(2)}</span>
                      <p className="text-[10px] text-[#16a34a] font-medium">{b.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          </PageTransition>
        </main>
      </div>

      <BottomNav
        items={[
          { id: 'map', icon: Map, label: 'Transit' },
          { id: 'home', icon: Compass, label: 'Browse' },
          { id: 'active', icon: Unlock, label: 'Pass', dot: !!activeBooking },
          { id: 'wallet', icon: Wallet, label: 'Wallet' },
          { id: 'profile', icon: Car, label: 'Vehicles' },
        ]}
        activeId={activeTab}
        onChange={(id) => {
          setActiveTab(id as typeof activeTab);
          setSelectedSpot(null);
        }}
      />
      </div>

      {/* ─── Notifications Drawer ─── */}
      <AnimatePresence>
      {showNotificationsDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
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
            className="relative w-full max-w-sm bg-white h-full border-l border-black/[0.06] p-5 overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="notifications-title" className="text-[15px] font-bold text-[#111]">Notifications</h3>
              <button type="button" aria-label="Close notifications" onClick={() => setShowNotificationsDrawer(false)} className="p-1.5 rounded-lg hover:bg-[#f1f3f4]"><X size={18} /></button>
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[11px] text-[#007AFF] font-semibold mb-3 hover:underline">Mark all as read</button>
            )}
            <div className="space-y-1">
              {notifications.map((n) => (
                <div key={n.id} className={`p-3 rounded-xl ${n.read ? '' : 'bg-[#eff6ff]'}`}>
                  <p className="text-[13px] font-semibold text-[#111]">{n.title}</p>
                  <p className="text-[12px] text-[#5f6368] mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-[#9ca3af] mt-1">{n.time}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* ─── Top-Up Modal ─── */}
      {showTopUpModal && (
        <div className="wallet-topup-modal fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={() => !isTopUpLoading && setShowTopUpModal(false)} aria-hidden="true" />
          <div ref={topUpDialogRef} role="dialog" aria-modal="true" aria-labelledby="top-up-title" tabIndex={-1} className="wallet-topup-dialog relative bg-white rounded-2xl border border-[#e8eaed] p-6 w-full max-w-md">
            <div className="flex items-start gap-3 mb-5">
              <span className="wallet-topup-dialog__mark" aria-hidden="true"><Wallet size={20} /></span>
              <div className="min-w-0 flex-1">
                <h3 id="top-up-title" className="text-[15px] font-bold text-[#111]">Top up wallet</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-[#6e6e73]">Choose an amount, then complete payment on Stripe's secure checkout.</p>
              </div>
              <button type="button" aria-label="Close wallet top up" disabled={isTopUpLoading} onClick={() => setShowTopUpModal(false)} className="p-1.5 rounded-lg hover:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-40"><X size={18} /></button>
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
                    className={`py-2 rounded-xl text-[12px] font-semibold border transition disabled:cursor-not-allowed disabled:opacity-60 ${topUpAmount === amount ? 'bg-[#007AFF] text-white border-[#007AFF]' : 'bg-white text-[#5f6368] border-[#dadce0] hover:border-[#007AFF]'}`}
                  >
                    RM {amount}
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="top-up-amount" className="block text-[11px] font-medium text-[#6e6e73] mb-1.5">Top-up amount (RM)</label>
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
                  className="w-full px-3 py-2.5 rounded-xl border border-[#dadce0] text-[13px] focus:outline-none focus:border-[#007AFF] disabled:bg-[#f5f5f7]"
                  placeholder="50.00"
                />
              </div>

              <div>
                <label htmlFor="top-up-description" className="block text-[11px] font-medium text-[#6e6e73] mb-1.5">Description</label>
                <input
                  id="top-up-description"
                  type="text"
                  maxLength={200}
                  disabled={isTopUpLoading}
                  value={topUpDescription}
                  onChange={(event) => setTopUpDescription(event.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#dadce0] text-[13px] focus:outline-none focus:border-[#007AFF] disabled:bg-[#f5f5f7]"
                  placeholder="Optional"
                />
              </div>

              <p className="text-[10px] text-[#6e6e73]">Enter an amount above RM 10.00 and below RM 5,000.00.</p>

              {topUpError && <p role="alert" className="text-[11px] font-medium text-rose-600">{topUpError}</p>}

              <div className="flex items-start gap-2 rounded-xl bg-[#f5f5f7] p-3 text-[10px] leading-relaxed text-[#6e6e73]">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#007AFF]" />
                <p>You will continue to Stripe Checkout. Your balance changes only after payment confirmation.</p>
              </div>

              <button
                type="submit"
                disabled={isTopUpLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0066d6] disabled:cursor-not-allowed disabled:opacity-60"
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
        <div ref={qrDialogRef} role="dialog" aria-modal="true" aria-labelledby="qr-scanner-title" tabIndex={-1} className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <button type="button" aria-label="Close QR scanner" onClick={closeQRScanner} className="absolute top-5 right-5 text-white p-2"><X size={24} /></button>
          <div className="w-72 h-72 border-2 border-white/30 rounded-2xl relative overflow-hidden">
            {scannerCameraActive && <video ref={videoRef} autoPlay playsInline className="absolute inset-0 object-cover" />}
            <div className="absolute inset-0 border-2 border-[#007AFF] rounded-2xl m-4" />
            {!qrCodeScanned && <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#007AFF] animate-pulse motion-reduce:hidden" style={{ animation: 'scanLine 2s ease-in-out infinite' }} />}
          </div>
          <p id="qr-scanner-title" className="text-white text-[13px] mt-4 font-medium">{qrCodeScanned ? 'Scanned!' : 'Point camera at IoT bollard QR code'}</p>
          <button onClick={simulateQRSuccess} className="mt-6 px-6 py-3 rounded-xl bg-white text-[#111] text-[13px] font-semibold">Simulate Scan</button>
        </div>
      )}

    </div>
  );
}
