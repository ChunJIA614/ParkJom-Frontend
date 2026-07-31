import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
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
import { ParkingSpot, Booking, Vehicle, AppNotification, Station, Property } from '../types';
import { simulatedSpots } from '../data/parkingSpots';
import CommuterMap from '../components/CommuterMap';
import DashboardHeader from '@/shared/components/DashboardHeader';
import BottomNav from '@/shared/ui/BottomNav';
import PageTransition from '@/shared/ui/PageTransition';
import { useAuth } from '@/features/auth/context/AuthContext';

export default function CommuterDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  type StationCoordinates = { lat: number; lng: number };

  // App Navigation and Module States
  const [activeTab, setActiveTab] = useState<'home' | 'active' | 'wallet' | 'profile' | 'map'>('home');
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [selectedStationCoords, setSelectedStationCoords] = useState<StationCoordinates | null>(null);
  const [distanceFilter, setDistanceFilter] = useState<number>(500); // meters
  const [spotTypeFilter, setSpotTypeFilter] = useState<string>('all');
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [nearbySpots, setNearbySpots] = useState<ParkingSpot[]>([]);
  const [isNearbyLoading, setIsNearbyLoading] = useState<boolean>(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  
  // Wallet state — TODO: fetch from backend
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [showTopUpModal, setShowTopUpModal] = useState<boolean>(false);
  const [topUpAmount, setTopUpAmount] = useState<string>('');

  // Vehicles state — TODO: fetch from backend
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showAddVehicle, setShowAddVehicle] = useState<boolean>(false);
  const [newPlate, setNewPlate] = useState<string>('');
  const [newModel, setNewModel] = useState<string>('');
  const [newColor, setNewColor] = useState<string>('');

  // Active Reservation / Session — TODO: fetch from backend
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);

  // IoT Access Control & Bollard states
  const [isBollardUnlocked, setIsBollardUnlocked] = useState<boolean>(false);
  const [bollardAnimationState, setBollardAnimationState] = useState<'raised' | 'lowering' | 'lowered' | 'raising'>('raised');
  const [gpsVerified, setGpsVerified] = useState<'checking' | 'verified' | 'unverified' | 'idle'>('idle');
  const [showQRScanner, setShowQRScanner] = useState<boolean>(false);
  const [qrCodeScanned, setQrCodeScanned] = useState<boolean>(false);
  const [scannerCameraActive, setScannerCameraActive] = useState<boolean>(false);

  // Time remaining countdown
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [showGraceAlert, setShowGraceAlert] = useState<boolean>(false);

  // Stations & Properties from backend
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [isStationsLoading, setIsStationsLoading] = useState<boolean>(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isPropertiesLoading, setIsPropertiesLoading] = useState<boolean>(false);

  // Fetch all stations on load
  useEffect(() => {
    const fetchStations = async () => {
      setIsStationsLoading(true);
      try {
        const res = await fetch('/api/station');
        const data = await res.json();
        if (data.success && data.stations) {
          setStations(data.stations);
        }
      } catch (e) {
        console.error('Failed to fetch stations', e);
      } finally {
        setIsStationsLoading(false);
      }
    };
    fetchStations();
  }, []);

  // Fetch properties when selectedStationId changes
  useEffect(() => {
    if (!selectedStationId) {
      setProperties([]);
      return;
    }

    const fetchProperties = async () => {
      setIsPropertiesLoading(true);
      try {
        const params = new URLSearchParams({ stationId: selectedStationId.toString() });
        const res = await fetch(`/api/station/get-property?${params.toString()}`);
        const data = await res.json();
        if (data.success && data.properties) {
          setProperties(data.properties);
        }
      } catch (e) {
        console.error('Failed to fetch properties', e);
      } finally {
        setIsPropertiesLoading(false);
      }
    };
    fetchProperties();
  }, [selectedStationId]);

  // Notifications — TODO: fetch from backend
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);

  // Booking history — TODO: fetch from backend
  const [history, setHistory] = useState<Booking[]>([]);

  // Video scanner setup
  const videoRef = useRef<HTMLVideoElement>(null);

  // Filter spots — flexible match stripping LRT/MRT to handle GeoJSON name differences
  const filteredSpots = simulatedSpots.filter(spot => {
    const spotBase = spot.station.toLowerCase().replace(' lrt','').replace(' mrt','');
    const selBase = (selectedStation || '').toLowerCase().replace(' lrt','').replace(' mrt','');
    if (selectedStation && spotBase !== selBase && !spotBase.includes(selBase) && !selBase.includes(spotBase)) return false;
    if (spot.distance > distanceFilter) return false;
    if (spotTypeFilter !== 'all' && spot.type !== spotTypeFilter) return false;
    // Hide active booked spot from search to simulate status changes
    if (activeBooking && activeBooking.spot.id === spot.id) return false;
    return spot.available;
  });

  const mapNearbySpots = nearbySpots.filter((spot) => {
    if (spotTypeFilter !== 'all' && spot.type !== spotTypeFilter) return false;
    if (activeBooking && activeBooking.spot.id === spot.id) return false;
    return spot.available;
  });

  useEffect(() => {
    if (!selectedStationCoords) {
      setNearbySpots([]);
      setNearbyError(null);
      setIsNearbyLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadNearbySpots() {
      setIsNearbyLoading(true);
      setNearbyError(null);

      try {
        const params = new URLSearchParams({
          lat: selectedStationCoords.lat.toString(),
          lng: selectedStationCoords.lng.toString(),
          radius: distanceFilter.toString(),
        });

        const res = await fetch(`/api/parkingspots/nearby?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Nearby search failed (${res.status})`);
        }

        const data = await res.json();
        const fetchedSpots: ParkingSpot[] = Array.isArray(data?.spots)
          ? data.spots.map((spot: any) => ({
              id: spot.id,
              station: spot.station,
              name: spot.name,
              pricePerHour: spot.pricePerHour,
              distance: spot.distance,
              lat: spot.lat,
              lng: spot.lng,
              available: spot.available,
              type: spot.type,
              owner: spot.owner,
            }))
          : [];

        setNearbySpots(fetchedSpots);
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        setNearbySpots([]);
        setNearbyError('Unable to load nearby parking right now.');
      } finally {
        if (!controller.signal.aborted) {
          setIsNearbyLoading(false);
        }
      }
    }

    loadNearbySpots();

    return () => controller.abort();
  }, [selectedStationCoords, distanceFilter]);

  const handleHomeStationSelect = (station: string) => {
    setSelectedStation(station);
    setSelectedStationCoords(null);
    setNearbySpots([]);
    setNearbyError(null);
    setSelectedSpot(null);
  };

  const handleMapStationSelect = (name: string, lat: number, lng: number) => {
    setSelectedStation(name);
    setSelectedStationCoords({ lat, lng });
    setSelectedSpot(null);
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

  // Top-Up function
  const handleTopUp = () => {
    const amount = parseFloat(topUpAmount);
    if (!isNaN(amount) && amount > 0) {
      setWalletBalance(prev => prev + amount);
      const newNotif: AppNotification = {
        id: 'topup-' + Date.now(),
        title: 'Top-up Successful',
        message: `RM ${amount.toFixed(2)} added to your digital wallet.`,
        time: 'Just now',
        read: false,
        type: 'wallet'
      };
      setNotifications(prev => [newNotif, ...prev]);
      setShowTopUpModal(false);
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
      setShowTopUpModal(true);
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
    if (activeBooking) {
      const completed: Booking = {
        ...activeBooking,
        status: 'Completed',
        endTime: new Date()
      };
      setHistory(prev => [completed, ...prev]);
      setActiveBooking(null);
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
    }, 2000);
  };

  // Simulated GPS Verification toggle
  const triggerGPSCheck = () => {
    setGpsVerified('checking');
    setTimeout(() => {
      setGpsVerified('verified');
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
    <div className="page-shell text-[#1d1d1f] flex flex-col pb-16 lg:pb-0">
      <DashboardHeader role="commuter" actions={notificationActions} />

      {/* ─── Main Layout ─── */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-8 pt-4 lg:pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Desktop Sidebar */}
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

        {/* Main Content */}
        <main className="lg:col-span-9 min-h-0">
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
              {/* Station Pills */}
              <div className="bg-white rounded-2xl border border-[#e8eaed] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[12px] font-semibold text-[#5f6368] uppercase tracking-wider">Select Station</h3>
                  <span className="text-[11px] text-[#9ca3af]">{simulatedSpots.filter(s => s.available).length} spots</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {stations.map(station => {
                    const count = simulatedSpots.filter(s => s.station === station.stationName && s.available).length;
                    return (
                      <button key={station.stationId} onClick={() => handleHomeStationSelect(station.stationName)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold border transition ${
                          selectedStation === station.stationName ? 'bg-[#007AFF] text-white border-[#007AFF]' : 'bg-white text-[#5f6368] border-[#dadce0] hover:border-[#007AFF]'
                        }`}>
                        <Train size={12} /> {station.stationName.replace(' LRT', '').replace(' MRT', '')}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${selectedStation === station.stationName ? 'bg-white/20 text-white' : 'bg-[#f1f3f4] text-[#5f6368]'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#f1f3f4]">
                  <span className="text-[10px] font-semibold text-[#9ca3af]">Max walk</span>
                  <input type="range" min="100" max="500" step="50" value={distanceFilter} onChange={(e) => setDistanceFilter(parseInt(e.target.value))}
                    className="flex-1 accent-[#007AFF] h-1" />
                  <span className="text-[10px] font-bold text-[#007AFF] w-12 text-right">{distanceFilter}m</span>
                </div>
              </div>

              {/* Spot Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-semibold text-[#5f6368] uppercase tracking-wider">
                    {selectedStation
                      ? `${filteredSpots.length} spots near ${selectedStation.replace(' LRT','').replace(' MRT','')}`
                      : `All available spots (${simulatedSpots.filter(s => s.available).length})`}
                  </h3>
                </div>
                {/* Show all available spots when no station is selected */}
                {(selectedStation ? filteredSpots : simulatedSpots.filter(s => s.available)).length === 0 && (
                  <div className="bg-white rounded-2xl border border-[#e8eaed] p-8 text-center">
                    <MapPin size={32} className="mx-auto text-[#dadce0] mb-2" />
                    <p className="text-[13px] text-[#5f6368] font-medium">No spots available</p>
                    <p className="text-[11px] text-[#9ca3af] mt-1">Try selecting a different station or adjusting filters.</p>
                  </div>
                )}
                {(selectedStation ? filteredSpots : simulatedSpots.filter(s => s.available)).map((spot) => (
                  <div key={spot.id}
                    onClick={() => navigate(`/commuter/parking/${spot.id}`, { state: { spot: { id: spot.id, lat: spot.lat, lon: spot.lng, address: spot.name, photoUrl: 'https://images.unsplash.com/photo-1590674899484-d5640d9da574?w=400&h=250&fit=crop', price: spot.pricePerHour }, stationCoords: null, stationName: spot.station } })}
                    className="bg-white rounded-2xl border p-4 flex items-center gap-4 cursor-pointer transition-all duration-150 border-[#e8eaed] hover:border-[#d2d5d9]">
                    <div className="w-12 h-12 rounded-xl bg-[#eff6ff] flex items-center justify-center shrink-0">
                      <Home size={20} className="text-[#007AFF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#111] truncate">{spot.name}</p>
                      <p className="text-[11px] text-[#5f6368]">{spot.distance}m walk &middot; {spot.type} &middot; {spot.station}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[15px] font-bold text-[#111]">RM {spot.pricePerHour.toFixed(2)}</p>
                      <p className="text-[10px] text-[#9ca3af]">/hr</p>
                    </div>
                    <ChevronRight size={18} className="text-[#9ca3af]" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── TAB: Map ─── */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              {/* Map */}
              <div className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden h-[55vh] lg:h-[500px]">
                <CommuterMap
                  spots={mapNearbySpots}
                  onStationSelect={handleMapStationSelect}
                  selectedStation={selectedStation}
                  onSpotClick={(spot) => setSelectedSpot(spot)}
                  distanceRadius={distanceFilter}
                  onDistanceRadiusChange={setDistanceFilter}
                  isNearbyLoading={isNearbyLoading}
                  nearbyError={nearbyError}
                />
              </div>

              {/* Nearby parking list — only when a station is selected */}
              {selectedStation && (
                <div className="space-y-2">
                  <h3 className="text-[12px] font-semibold text-[#5f6368] uppercase tracking-wider px-1">
                    {mapNearbySpots.length} spot{mapNearbySpots.length !== 1 ? 's' : ''} near {selectedStation.replace(' LRT', '').replace(' MRT', '')}
                  </h3>
                  {isNearbyLoading ? (
                    <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 text-center">
                      <Loader2 size={28} className="mx-auto text-[#007AFF] mb-2 animate-spin" />
                      <p className="text-[13px] text-[#5f6368]">Finding parking within {distanceFilter}m...</p>
                    </div>
                  ) : nearbyError ? (
                    <div className="bg-white rounded-2xl border border-red-200 p-6 text-center">
                      <AlertCircle size={28} className="mx-auto text-red-500 mb-2" />
                      <p className="text-[13px] text-red-700">{nearbyError}</p>
                    </div>
                  ) : mapNearbySpots.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 text-center">
                      <MapPin size={28} className="mx-auto text-[#dadce0] mb-2" />
                      <p className="text-[13px] text-[#5f6368]">No spots within {distanceFilter}m</p>
                    </div>
                  ) : (
                    mapNearbySpots.map((spot) => (
                      <div
                        key={spot.id}
                        onClick={() => navigate(`/commuter/parking/${spot.id}`, {
                          state: {
                            spot: { id: spot.id, lat: spot.lat, lon: spot.lng, address: spot.name, photoUrl: 'https://images.unsplash.com/photo-1590674899484-d5640d9da574?w=400&h=250&fit=crop', price: spot.pricePerHour },
                            stationCoords: selectedStationCoords ? { lat: selectedStationCoords.lat, lon: selectedStationCoords.lng } : null,
                            stationName: selectedStation || spot.station,
                          },
                        })}
                        className="bg-white rounded-2xl border border-[#e8eaed] hover:border-[#d2d5d9] p-4 flex items-center gap-4 cursor-pointer transition-colors"
                      >
                        <div className="w-11 h-11 rounded-xl bg-[#eff6ff] flex items-center justify-center shrink-0">
                          <Home size={18} className="text-[#007AFF]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-[#111] truncate">{spot.name}</p>
                          <p className="text-[11px] text-[#5f6368]">{spot.distance}m walk &middot; {spot.type} &middot; {spot.owner}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[15px] font-bold text-[#111]">RM {spot.pricePerHour.toFixed(2)}</p>
                          <p className="text-[10px] text-[#9ca3af]">/hr</p>
                        </div>
                        <ChevronRight size={16} className="text-[#9ca3af]" />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── TAB: Active Session ─── */}
          {activeTab === 'active' && (
            <div className="space-y-4">
              {!activeBooking ? (
                <div className="bg-white rounded-2xl border border-[#e8eaed] p-8 text-center">
                  <Clock size={32} className="mx-auto text-[#dadce0] mb-2" />
                  <p className="text-[15px] font-semibold text-[#111]">No active booking</p>
                  <p className="text-[13px] text-[#5f6368] mt-1">Find and book a parking spot to get started.</p>
                  <button onClick={() => setActiveTab('home')} className="mt-4 px-5 py-2.5 rounded-xl bg-[#007AFF] text-white text-[13px] font-semibold hover:bg-[#0066d6] transition-colors">Discover Spots</button>
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

                  <button onClick={handleCompleteBooking}
                    className="w-full py-3 rounded-xl bg-[#007AFF] text-white text-[13px] font-bold hover:bg-[#0066d6] transition-colors flex items-center justify-center gap-2">
                    <CheckCircle2 size={17} /> Complete Booking
                  </button>
                </>
              )}
            </div>
          )}

          {/* ─── TAB: Wallet ─── */}
          {activeTab === 'wallet' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 text-center">
                <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Available Balance</p>
                <p className="text-[40px] font-bold text-[#111] tracking-[-0.02em] mt-1">RM {walletBalance.toFixed(2)}</p>
                <button onClick={() => setShowTopUpModal(true)}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-[#007AFF] text-white text-[13px] font-semibold hover:bg-[#0066d6] transition-colors">Top Up</button>
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
          { id: 'home', icon: Compass, label: 'Discover' },
          { id: 'map', icon: Map, label: 'Map' },
          { id: 'active', icon: Unlock, label: 'Active', dot: !!activeBooking },
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
            onClick={() => setShowNotificationsDrawer(false)}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-sm bg-white h-full border-l border-black/[0.06] p-5 overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-[#111]">Notifications</h3>
              <button onClick={() => setShowNotificationsDrawer(false)} className="p-1.5 rounded-lg hover:bg-[#f1f3f4]"><X size={18} /></button>
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
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowTopUpModal(false)} />
          <div className="relative bg-white rounded-2xl border border-[#e8eaed] p-6 w-full max-w-sm">
            <h3 className="text-[15px] font-bold text-[#111] mb-4">Top Up Wallet</h3>
            <div className="flex gap-2 mb-4">
              {['10', '20', '50', '100'].map((a) => (
                <button key={a} onClick={() => setTopUpAmount(a)}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition ${topUpAmount === a ? 'bg-[#007AFF] text-white border-[#007AFF]' : 'bg-white text-[#5f6368] border-[#dadce0] hover:border-[#007AFF]'}`}>
                  RM {a}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl border border-[#dadce0] text-[13px] focus:outline-none focus:border-[#007AFF]" placeholder="Custom" />
              <button onClick={handleTopUp} className="px-5 py-2.5 rounded-xl bg-[#007AFF] text-white text-[13px] font-semibold hover:bg-[#0066d6] transition-colors">Top Up</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── QR Scanner Modal ─── */}
      {showQRScanner && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <button onClick={closeQRScanner} className="absolute top-5 right-5 text-white p-2"><X size={24} /></button>
          <div className="w-72 h-72 border-2 border-white/30 rounded-2xl relative overflow-hidden">
            {scannerCameraActive && <video ref={videoRef} autoPlay playsInline className="absolute inset-0 object-cover" />}
            <div className="absolute inset-0 border-2 border-[#007AFF] rounded-2xl m-4" />
            {!qrCodeScanned && <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#007AFF] animate-pulse" style={{ animation: 'scanLine 2s ease-in-out infinite' }} />}
          </div>
          <p className="text-white text-[13px] mt-4 font-medium">{qrCodeScanned ? 'Scanned!' : 'Point camera at IoT bollard QR code'}</p>
          <button onClick={simulateQRSuccess} className="mt-6 px-6 py-3 rounded-xl bg-white text-[#111] text-[13px] font-semibold">Simulate Scan</button>
        </div>
      )}

    </div>
  );
}
