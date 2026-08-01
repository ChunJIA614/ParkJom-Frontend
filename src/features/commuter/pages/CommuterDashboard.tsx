import { useState, useEffect, useRef, type FormEvent } from 'react';
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
  Loader2
} from 'lucide-react';
import { ParkingSpot, ParkingSearchResponse, WalletTopUpResponse, Booking, Vehicle, AppNotification } from '../types';
import CommuterMap from '../components/CommuterMap';
import ParkingPass from '../components/ParkingPass';
import JourneyStrip from '../components/JourneyStrip';
import DashboardHeader from '@/shared/components/DashboardHeader';
import BottomNav from '@/shared/ui/BottomNav';
import PageTransition from '@/shared/ui/PageTransition';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  clearJourneySession,
  loadJourneySession,
  saveJourneySession,
  updateJourneyStage,
} from '../lib/journeySession';
import type { JourneyStage } from '../lib/journeySession';

const API_BASE = import.meta.env.VITE_API_BASE ||
  (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? 'https://parkjom-api-gbgcbycbcjghczgu.malaysiawest-01.azurewebsites.net/api'
    : '/api');

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
type WalletTopUpFeedback = { tone: 'success' | 'warning' | 'info'; title: string; message: string };

interface PendingWalletTopUp {
  paymentId: number;
  sessionId: string;
  checkoutUrl: string;
  amount: number;
  description: string;
  message: string;
  createdAt: string;
}

const PENDING_WALLET_TOP_UP_KEY = 'parkjom.pendingWalletTopUp';

const loadPendingWalletTopUp = (): PendingWalletTopUp | null => {
  try {
    const rawValue = sessionStorage.getItem(PENDING_WALLET_TOP_UP_KEY);
    if (!rawValue) return null;
    const value = JSON.parse(rawValue) as Partial<PendingWalletTopUp>;
    if (
      typeof value.paymentId !== 'number'
      || typeof value.sessionId !== 'string'
      || typeof value.checkoutUrl !== 'string'
      || typeof value.amount !== 'number'
    ) {
      sessionStorage.removeItem(PENDING_WALLET_TOP_UP_KEY);
      return null;
    }
    return {
      paymentId: value.paymentId,
      sessionId: value.sessionId,
      checkoutUrl: value.checkoutUrl,
      amount: value.amount,
      description: value.description || 'Top up my wallet',
      message: value.message || 'Wallet top-up checkout created.',
      createdAt: value.createdAt || new Date().toISOString(),
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
  const { user } = useAuth();
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
  const topUpReturnStatus = locationParams.get('topup');
  const returnedCheckoutSessionId = locationParams.get('session_id');

  // App Navigation and Module States
  const [activeTab, setActiveTab] = useState<CommuterTab>(requestedTab || (initialJourney ? 'active' : 'home'));
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [selectedStationCoords, setSelectedStationCoords] = useState<StationCoordinates | null>(null);
  const [distanceFilter, setDistanceFilter] = useState<number>(3000); // meters
  const [spotTypeFilter, setSpotTypeFilter] = useState<string>('all');
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [nearbySpots, setNearbySpots] = useState<ParkingSpot[]>([]);
  const [isNearbyLoading, setIsNearbyLoading] = useState<boolean>(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [nearbyMessage, setNearbyMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSpots, setSearchSpots] = useState<ParkingSpot[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchMeta, setSearchMeta] = useState<{ message: string; totalCount: number; page: number; pageSize: number } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<StationCoordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('locating');
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationRequestKey, setLocationRequestKey] = useState(0);
  const [suggestedSpots, setSuggestedSpots] = useState<ParkingSpot[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestionsMessage, setSuggestionsMessage] = useState('');
  
  // Wallet state — TODO: fetch from backend
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [showTopUpModal, setShowTopUpModal] = useState<boolean>(false);
  const [topUpAmount, setTopUpAmount] = useState<string>('');
  const [topUpDescription, setTopUpDescription] = useState('');
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const [pendingTopUp, setPendingTopUp] = useState<PendingWalletTopUp | null>(loadPendingWalletTopUp);
  const [walletTopUpFeedback, setWalletTopUpFeedback] = useState<WalletTopUpFeedback | null>(null);

  // Vehicles state — TODO: fetch from backend
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showAddVehicle, setShowAddVehicle] = useState<boolean>(false);
  const [newPlate, setNewPlate] = useState<string>('');
  const [newModel, setNewModel] = useState<string>('');
  const [newColor, setNewColor] = useState<string>('');

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
    if (topUpReturnStatus !== 'success' && topUpReturnStatus !== 'cancelled' && topUpReturnStatus !== 'cancel') return;

    const pendingPayment = loadPendingWalletTopUp();
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
            message: 'No balance was added. Please refresh your wallet after the server confirms the Stripe payment.',
          }
        : {
            tone: 'success',
            title: 'Payment submitted',
            message: `${pendingPayment ? `RM ${pendingPayment.amount.toFixed(2)} was submitted. ` : ''}Your balance will update only after the backend confirms the Stripe payment.`,
          });
    } else {
      setWalletTopUpFeedback({
        tone: 'info',
        title: 'Top-up cancelled',
        message: 'No payment was confirmed and your wallet balance was not changed.',
      });
    }

    try {
      sessionStorage.removeItem(PENDING_WALLET_TOP_UP_KEY);
    } catch {
      // The in-memory state is still cleared when browser storage is blocked.
    }
    setPendingTopUp(null);
    navigate('/commuter', { replace: true, state: { activeTab: 'wallet' } });
  }, [navigate, returnedCheckoutSessionId, topUpReturnStatus]);

  useEffect(() => {
    if (activeTab !== 'home') return;

    setLocationError(null);
    setLocationStatus('locating');

    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      setLocationError('Location services are not supported by this browser.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setCurrentLocation((previousLocation) => {
          if (previousLocation && distanceBetweenKm(previousLocation, nextLocation) < 0.05) {
            return previousLocation;
          }
          return nextLocation;
        });
        setLocationAccuracy(position.coords.accuracy);
        setLocationStatus('ready');
        setLocationError(null);
      },
      (error) => {
        if (error.code === 1) {
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
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 12_000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeTab, locationRequestKey]);

  useEffect(() => {
    if (!currentLocation) return;

    const controller = new AbortController();

    async function loadLocationSuggestions() {
      setIsSuggestionsLoading(true);
      setSuggestionsError(null);

      try {
        const params = new URLSearchParams({
          latitude: currentLocation.lat.toString(),
          longitude: currentLocation.lng.toString(),
        });
        const response = await fetch(`${API_BASE}/parking/nearby?${params.toString()}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        const data = await response.json().catch(() => null) as ParkingSearchResponse | null;

        if (!response.ok || !data?.success) {
          throw new Error(data?.message || `Nearby parking lookup failed (${response.status})`);
        }
        if (!Array.isArray(data.data)) throw new Error('Nearby parking returned an invalid data list.');

        const orderedSpots = data.data
          .map(mapParkingResult)
          .sort((first, second) => distanceFromUser(currentLocation, first) - distanceFromUser(currentLocation, second));

        setSuggestedSpots(orderedSpots);
        setSuggestionsMessage(data.message);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSuggestedSpots([]);
        setSuggestionsMessage('');
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
      setNearbyMessage('');
      setIsNearbyLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadNearbySpots() {
      setIsNearbyLoading(true);
      setNearbyError(null);

      try {
        const params = new URLSearchParams({
          latitude: selectedStationCoords.lat.toString(),
          longitude: selectedStationCoords.lng.toString(),
        });

        const res = await fetch(`${API_BASE}/parking/nearby?${params.toString()}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        const data = await res.json().catch(() => null) as ParkingSearchResponse | null;
        if (!res.ok || !data?.success) throw new Error(data?.message || `Nearby search failed (${res.status})`);
        if (!Array.isArray(data.data)) throw new Error('Nearby search returned an invalid data list.');

        const fetchedSpots = data.data.map(mapParkingResult);

        setNearbySpots(fetchedSpots);
        setNearbyMessage(`${data.message} · Page ${data.page} of ${Math.max(1, Math.ceil(data.totalCount / data.pageSize))}`);
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
  }, [selectedStationCoords]);

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
      const params = new URLSearchParams({ query });
      const res = await fetch(`${API_BASE}/parking/search?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => null) as ParkingSearchResponse | null;
      if (!res.ok || !data?.success) throw new Error(data?.message || `Parking search failed (${res.status})`);
      if (!Array.isArray(data.data)) throw new Error('Parking search returned an invalid data list.');

      setSearchSpots(data.data.map(mapParkingResult));
      setSearchMeta({
        message: data.message,
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

  const resumePendingTopUp = () => {
    if (!pendingTopUp) return;

    try {
      const checkoutUrl = new URL(pendingTopUp.checkoutUrl);
      if (checkoutUrl.protocol !== 'https:') throw new Error('The stored checkout URL is not secure.');
      window.location.assign(checkoutUrl.toString());
    } catch {
      try {
        sessionStorage.removeItem(PENDING_WALLET_TOP_UP_KEY);
      } catch {
        // Continue clearing the in-memory pending state.
      }
      setPendingTopUp(null);
      setWalletTopUpFeedback({
        tone: 'warning',
        title: 'Checkout session unavailable',
        message: 'The previous checkout link could not be reopened. You can start a new top-up.',
      });
    }
  };

  const openTopUpModal = () => {
    if (pendingTopUp) {
      resumePendingTopUp();
      return;
    }
    setTopUpError(null);
    setWalletTopUpFeedback(null);
    setShowTopUpModal(true);
  };

  // Create the authenticated Stripe Checkout session. The wallet balance is
  // updated only after the backend confirms payment, never optimistically here.
  const handleTopUp = async (event: FormEvent) => {
    event.preventDefault();
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

    try {
      const response = await fetch(`${API_BASE}/wallet/topup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Accept-Language': 'en-US,en;q=0.9',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          amount: Number(amount.toFixed(2)),
          ...(description ? { description } : {}),
        }),
      });
      const data = await response.json().catch(() => null) as WalletTopUpResponse | null;

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || `Unable to create a wallet top-up session (${response.status}).`);
      }
      if (!data.paymentId || !data.sessionId || !data.checkoutUrl) {
        throw new Error('The top-up response was missing its payment or checkout details.');
      }

      const checkoutUrl = new URL(data.checkoutUrl);
      if (checkoutUrl.protocol !== 'https:') throw new Error('The payment checkout URL was not secure.');

      const pendingPayment: PendingWalletTopUp = {
        paymentId: data.paymentId,
        sessionId: data.sessionId,
        checkoutUrl: checkoutUrl.toString(),
        amount: Number(amount.toFixed(2)),
        description: description || 'Wallet top-up',
        message: data.message,
        createdAt: new Date().toISOString(),
      };
      setPendingTopUp(pendingPayment);
      try {
        sessionStorage.setItem(PENDING_WALLET_TOP_UP_KEY, JSON.stringify(pendingPayment));
      } catch {
        // Checkout must still proceed when browser storage is unavailable.
      }
      window.location.assign(checkoutUrl.toString());
    } catch (error) {
      setTopUpError(error instanceof Error ? error.message : 'Unable to start wallet checkout.');
      setIsTopUpLoading(false);
    }
  };

  // Add vehicle function
  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlate.trim() && newModel.trim()) {
      const updatedVehicles = vehicles.map(v => ({ ...v, active: false }));
      const newVeh: Vehicle = {
        plate: newPlate.toUpperCase(),
        model: newModel,
        color: newColor || 'Default',
        active: true
      };
      setVehicles([...updatedVehicles, newVeh]);
      setNewPlate('');
      setNewModel('');
      setNewColor('');
      setShowAddVehicle(false);
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
    if (walletBalance < spot.pricePerHour * 2) {
      alert('Insufficient wallet balance. Please top up your wallet (minimum RM 10.00 required for reserve hold).');
      openTopUpModal();
      return;
    }

    // Deduct 2 hours advance deposit
    const cost = spot.pricePerHour * 2;
    setWalletBalance(prev => prev - cost);

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
    <div className="app-workspace page-shell text-[#1d1d1f] flex flex-col pb-16 lg:pb-0">
      <DashboardHeader
        role="commuter"
        actions={notificationActions}
        navigation={(
          <>
            {[
              { id: 'map' as const, label: 'Find a Bay' },
              { id: 'active' as const, label: 'My Pass' },
              { id: 'wallet' as const, label: 'Wallet' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                  activeTab === item.id ? 'text-[#007AFF] bg-[#e8f0fe]' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </>
        )}
      />

      {/* ─── Main Layout ─── */}
      <div className={activeTab === 'map'
        ? 'flex-1 w-full min-h-0'
        : 'flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-8 pt-4 lg:pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6'}>

        {/* Desktop Sidebar */}
        {activeTab !== 'map' && (
        <aside className="hidden lg:flex lg:col-span-3 flex-col gap-4 h-fit sticky top-[calc(3.5rem+1rem)]">
          {/* Quick actions: wallet + notifications */}
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab('wallet')}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white hover:bg-[#f8f9fa] px-3 py-2.5 rounded-xl border border-[#e8eaed] text-[12px] font-semibold text-[#333] transition">
              <Wallet size={14} className="text-[#007AFF]" /> RM {walletBalance.toFixed(2)}
            </button>
            <button onClick={() => setShowNotificationsDrawer(!showNotificationsDrawer)}
              className="relative p-2.5 bg-white hover:bg-[#f8f9fa] rounded-xl border border-[#e8eaed] text-[#5f6368] transition">
              <Bell size={16} />
              {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 bg-[#007AFF] text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">{unreadCount}</span>}
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-[#e8eaed] p-5 space-y-5">
            {/* User */}
            <div className="flex items-center gap-3 pb-4 border-b border-[#f1f3f4]">
              <div className="w-9 h-9 rounded-full bg-[#eff6ff] flex items-center justify-center shrink-0">
                <User size={17} className="text-[#007AFF]" />
              </div>
              <div className="truncate">
                <p className="text-[13px] font-semibold text-[#111]">{user?.firstName ?? 'Commuter'}</p>
                <p className="text-[11px] text-[#5f6368]">{vehicles.find(v => v.active)?.plate || 'VGV 8899'}</p>
              </div>
            </div>
            {/* Nav */}
            <nav className="flex flex-col gap-0.5">
              {[
                { id: 'home' as const, icon: Compass, label: 'Discover' },
                { id: 'map' as const, icon: Map, label: 'Transit Map' },
                { id: 'active' as const, icon: Unlock, label: 'Active Session', dot: !!activeBooking },
                { id: 'wallet' as const, icon: Wallet, label: 'Wallet' },
                { id: 'profile' as const, icon: Car, label: 'Vehicles' },
              ].map(({ id, icon: Icon, label, dot }) => (
                <button key={id} onClick={() => { setActiveTab(id); setSelectedSpot(null); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                    activeTab === id ? 'bg-[#007AFF] text-white' : 'text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#111]'
                  }`}>
                  <Icon size={16} /> {label}
                  {dot && <span className="ml-auto w-2 h-2 rounded-full bg-[#16a34a]" />}
                </button>
              ))}
            </nav>
          </div>
          {/* SDG badge */}
          <div className="bg-white rounded-2xl border border-[#e8eaed] p-4">
            <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1">SDG 11</p>
            <p className="text-[12px] text-[#5f6368] leading-relaxed">Optimizing vacant parking near transit — reducing emissions and congestion in Greater KL.</p>
          </div>
        </aside>
        )}

        {/* Main Content */}
        <main className={activeTab === 'map' ? 'min-h-0' : 'lg:col-span-9 min-h-0'}>
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
                <div className="flex items-center justify-between gap-4">
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
                    className="shrink-0 rounded-xl border border-[#dadce0] px-3 py-2 text-[11px] font-semibold text-[#5f6368] hover:border-[#007AFF] hover:text-[#007AFF]"
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
                <form onSubmit={handleParkingSearch} className="mt-3 flex gap-2">
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
                    <p className="text-[10px] text-emerald-700">
                      {searchMeta.message} · Page {searchMeta.page} · {searchMeta.pageSize} per page
                    </p>
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
                    {!searchMeta && suggestionsMessage && <p className="mt-1 text-[10px] text-[#9ca3af]">{suggestionsMessage}</p>}
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
                      <div className="flex items-start gap-4">
                        {spot.primaryImageUrl ? (
                          <img src={spot.primaryImageUrl} alt="" className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <div className="h-20 w-24 rounded-xl bg-[#eff6ff] flex items-center justify-center shrink-0"><Home size={20} className="text-[#007AFF]" /></div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[13px] font-semibold text-[#111]">{spot.propertyName}</p>
                              <p className="text-[10px] font-mono text-[#9ca3af]">Spot #{spot.parkingSpotId} · Property #{spot.propertyId} · Bay {spot.parkingLabel}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap justify-end gap-1">
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
                        <ChevronRight size={18} className="mt-1 shrink-0 text-[#9ca3af]" />
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
                  selectedSpot={lensSelectedSpot}
                  onSpotClick={(spot) => setSelectedSpot(spot)}
                  distanceRadius={distanceFilter}
                  onDistanceRadiusChange={setDistanceFilter}
                  isNearbyLoading={isNearbyLoading}
                  nearbyError={nearbyError}
                />
              </div>

              <aside className="map-lens__results nearby-sheet" aria-label="Nearby parking bays">
                <div className="nearby-sheet__header">
                  <h2>Nearby bays</h2>
                  <span>{nearbyMessage || (selectedStation ? selectedStation.replace(' LRT', '').replace(' MRT', '') : 'Select a station')}</span>
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
                />
              </div>

              <JourneyStrip activeStep={journeyStep} />
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
                    <div className="flex items-center gap-6">
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
                    <div className="flex gap-2">
                      {!isBollardUnlocked ? (
                        <>
                          <button onClick={triggerGPSCheck}
                            className={`px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-colors ${gpsVerified === 'verified' ? 'bg-[#f0fdf4] text-[#16a34a]' : 'bg-[#f8f9fa] text-[#5f6368] hover:bg-[#f1f3f4]'}`}>
                            {gpsVerified === 'verified' ? 'GPS Verified' : gpsVerified === 'checking' ? 'Checking...' : 'Verify GPS'}
                          </button>
                          <button onClick={startQRScanner}
                            className="px-4 py-2.5 rounded-xl bg-[#f8f9fa] text-[#5f6368] text-[12px] font-semibold hover:bg-[#f1f3f4] transition-colors flex items-center gap-1.5">
                            <Camera size={14} /> Scan QR
                          </button>
                          <button onClick={handleUnlockBollard}
                            disabled={gpsVerified !== 'verified'}
                            className={`px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-colors ${gpsVerified === 'verified' ? 'bg-[#007AFF] text-white hover:bg-[#0066d6]' : 'bg-[#e8eaed] text-[#9ca3af] cursor-not-allowed'}`}>
                            Unlock Bollard
                          </button>
                        </>
                      ) : (
                        <button onClick={handleLockBollard}
                          className="px-4 py-2.5 rounded-xl bg-[#fef2f2] text-[#dc2626] text-[12px] font-semibold hover:bg-[#fee2e2] transition-colors flex items-center gap-1.5">
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
                <div
                  role="status"
                  className={`flex items-start gap-3 rounded-2xl border p-4 ${
                    walletTopUpFeedback.tone === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : walletTopUpFeedback.tone === 'warning'
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-blue-200 bg-blue-50 text-blue-800'
                  }`}
                >
                  {walletTopUpFeedback.tone === 'success'
                    ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                    : <Info size={18} className="mt-0.5 shrink-0" />}
                  <div>
                    <p className="text-[12px] font-semibold">{walletTopUpFeedback.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed">{walletTopUpFeedback.message}</p>
                  </div>
                </div>
              )}
              <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 text-center">
                <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Available Balance</p>
                <p className="text-[40px] font-bold text-[#111] tracking-[-0.02em] mt-1">RM {walletBalance.toFixed(2)}</p>
                <button onClick={openTopUpModal}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-[#007AFF] text-white text-[13px] font-semibold hover:bg-[#0066d6] transition-colors">
                  {pendingTopUp ? 'Continue Pending Checkout' : 'Top Up'}
                </button>
                {pendingTopUp && (
                  <p className="mx-auto mt-3 max-w-sm text-[10px] leading-relaxed text-[#6e6e73]">
                    RM {pendingTopUp.amount.toFixed(2)} is waiting in Stripe Checkout. It has not been added to your balance. Complete this checkout before starting another top-up.
                  </p>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-[#e8eaed] p-5">
                <h3 className="text-[12px] font-semibold text-[#5f6368] uppercase tracking-wider mb-3">Recent Transactions</h3>
                {history.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-2.5 border-b border-[#f1f3f4] last:border-0">
                    <div>
                      <p className="text-[13px] font-medium text-[#111]">{b.spot.name}</p>
                      <p className="text-[11px] text-[#9ca3af]">{b.spot.station} &middot; {b.status}</p>
                    </div>
                    <span className="text-[13px] font-semibold text-[#16a34a]">+RM {b.totalPaid.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── TAB: Profile / Vehicles ─── */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-[#e8eaed] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[12px] font-semibold text-[#5f6368] uppercase tracking-wider">Your Vehicles</h3>
                  <button onClick={() => setShowAddVehicle(!showAddVehicle)}
                    className="text-[12px] font-semibold text-[#007AFF] hover:underline flex items-center gap-1">
                    <Plus size={14} /> Add
                  </button>
                </div>
                {vehicles.map((v) => (
                  <div key={v.plate} onClick={() => setActiveVehicle(v.plate)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${v.active ? 'bg-[#eff6ff] border border-[#bfdbfe]' : 'hover:bg-[#f8f9fa] border border-transparent'}`}>
                    <Car size={18} className={v.active ? 'text-[#007AFF]' : 'text-[#9ca3af]'} />
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold text-[#111]">{v.plate}</p>
                      <p className="text-[11px] text-[#5f6368]">{v.model} &middot; {v.color}</p>
                    </div>
                    {v.active && <span className="text-[10px] font-semibold bg-[#007AFF] text-white px-2 py-0.5 rounded-full">Active</span>}
                  </div>
                ))}
                {showAddVehicle && (
                  <form onSubmit={handleAddVehicle} className="mt-3 p-4 bg-[#f8f9fa] rounded-xl space-y-2">
                    <input type="text" value={newPlate} onChange={(e) => setNewPlate(e.target.value)} placeholder="Plate (e.g. VGV 8899)"
                      className="w-full px-3 py-2 rounded-xl border border-[#dadce0] text-[12px] focus:outline-none focus:border-[#007AFF]" />
                    <div className="flex gap-2">
                      <input type="text" value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="Model"
                        className="flex-1 px-3 py-2 rounded-xl border border-[#dadce0] text-[12px] focus:outline-none focus:border-[#007AFF]" />
                      <input type="text" value={newColor} onChange={(e) => setNewColor(e.target.value)} placeholder="Color"
                        className="flex-1 px-3 py-2 rounded-xl border border-[#dadce0] text-[12px] focus:outline-none focus:border-[#007AFF]" />
                    </div>
                    <button type="submit" className="w-full py-2 rounded-xl bg-[#007AFF] text-white text-[12px] font-semibold hover:bg-[#0066d6] transition-colors">Save Vehicle</button>
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
          { id: 'map', icon: Map, label: 'Find' },
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20" onClick={() => !isTopUpLoading && setShowTopUpModal(false)} aria-hidden="true" />
          <div ref={topUpDialogRef} role="dialog" aria-modal="true" aria-labelledby="top-up-title" tabIndex={-1} className="relative bg-white rounded-2xl border border-[#e8eaed] p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 id="top-up-title" className="text-[15px] font-bold text-[#111]">Top Up Wallet</h3>
              <button type="button" aria-label="Close wallet top up" disabled={isTopUpLoading} onClick={() => setShowTopUpModal(false)} className="p-1.5 rounded-lg hover:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-40"><X size={18} /></button>
            </div>
            <form onSubmit={handleTopUp} className="space-y-4">
              <div className="flex gap-2">
                {['20', '50', '100', '500'].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    disabled={isTopUpLoading}
                    onClick={() => {
                      setTopUpAmount(amount);
                      setTopUpError(null);
                    }}
                    className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition disabled:cursor-not-allowed disabled:opacity-60 ${topUpAmount === amount ? 'bg-[#007AFF] text-white border-[#007AFF]' : 'bg-white text-[#5f6368] border-[#dadce0] hover:border-[#007AFF]'}`}
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
