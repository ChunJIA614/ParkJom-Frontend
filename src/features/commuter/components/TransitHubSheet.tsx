import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  Train,
  Clock,
  MapPin,
  Navigation,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  Accessibility,
  ArrowRight,
  ShieldCheck,
  Zap,
  Radio,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  TransitRoute,
  TransitStopSummary,
  TransitStopSchedule,
  StationNearbyParkingData,
  StationNearbyParkingSpot,
  getTransitRoutes,
  getTransitStops,
  getNearbyTransitStations,
  getTransitStopSchedule,
  getTransitStopNearbyParking,
  RAPID_KL_LINE_COLORS,
} from '@/services/gtfsApi';
import { ParkingSpot } from '../types';

export type SheetDetent = 'peek' | 'medium' | 'full';

interface TransitHubSheetProps {
  userLocation: { lat: number; lng: number } | null;
  selectedStationId?: string | null;
  selectedStationName?: string | null;
  onSelectStation: (stop: TransitStopSummary) => void;
  onSelectParkingSpot: (spot: StationNearbyParkingSpot) => void;
  onOpenParkingDetail?: (spot: ParkingSpot) => void;
  className?: string;
}

export default function TransitHubSheet({
  userLocation,
  selectedStationId,
  selectedStationName,
  onSelectStation,
  onSelectParkingSpot,
  onOpenParkingDetail,
  className = '',
}: TransitHubSheetProps) {
  // Sheet presentation detents: 'peek' | 'medium' | 'full'
  const [detent, setDetent] = useState<SheetDetent>('peek');

  // Route & Stops state
  const [routes, setRoutes] = useState<TransitRoute[]>([]);
  const [selectedLineFilter, setSelectedLineFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stopsList, setStopsList] = useState<TransitStopSummary[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [nearbyStations, setNearbyStations] = useState<TransitStopSummary[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState<boolean>(false);

  // Active Station Details, Schedule & Nearby Parking
  const [activeStop, setActiveStop] = useState<TransitStopSummary | null>(null);
  const [schedule, setSchedule] = useState<TransitStopSchedule | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState<boolean>(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Nearby Parking Bays State (Transit-to-Parking Integration)
  const [parkingRadius, setParkingRadius] = useState<number>(1500);
  const [nearbyParking, setNearbyParking] = useState<StationNearbyParkingData | null>(null);
  const [isLoadingParking, setIsLoadingParking] = useState<boolean>(false);
  const [parkingError, setParkingError] = useState<string | null>(null);

  // Active Direction Tab in Schedule View
  const [activeDirectionIndex, setActiveDirectionIndex] = useState<number>(0);

  // Ref for scroll container
  const sheetScrollRef = useRef<HTMLDivElement>(null);

  // 1. Load Rail Routes on Mount
  useEffect(() => {
    let isCancelled = false;
    getTransitRoutes()
      .then((data) => {
        if (!isCancelled) setRoutes(data);
      })
      .catch((err) => console.warn('[TransitHubSheet] Failed to load routes:', err));
    return () => {
      isCancelled = true;
    };
  }, []);

  // 2. Load GPS-Nearby Stations when user location is available
  useEffect(() => {
    if (!userLocation) return;
    let isCancelled = false;
    setIsLoadingNearby(true);
    getNearbyTransitStations(userLocation.lat, userLocation.lng, 3500, 6)
      .then((stations) => {
        if (!isCancelled) {
          setNearbyStations(stations);
          setIsLoadingNearby(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn('[TransitHubSheet] Failed to load nearby stations:', err);
          setIsLoadingNearby(false);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [userLocation]);

  // 3. Search and filter transit stops
  useEffect(() => {
    const controller = new AbortController();
    setIsSearching(true);

    const timer = setTimeout(() => {
      const lineParam = selectedLineFilter === 'ALL' ? undefined : selectedLineFilter;
      const searchParam = searchQuery.trim() || undefined;

      getTransitStops(
        {
          line: lineParam,
          search: searchParam,
          lat: userLocation?.lat,
          lng: userLocation?.lng,
        },
        controller.signal,
      )
        .then((data) => {
          setStopsList(data);
          setIsSearching(false);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn('[TransitHubSheet] Stop query failed:', err);
            setIsSearching(false);
          }
        });
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, selectedLineFilter, userLocation]);

  // 4. Synchronize active station if passed from parent
  useEffect(() => {
    if (!selectedStationId && !selectedStationName) return;

    if (activeStop && (activeStop.stopId === selectedStationId || activeStop.stopName === selectedStationName)) {
      return;
    }

    // Try finding in current stopsList
    const matched = stopsList.find(
      (s) =>
        (selectedStationId && s.stopId === selectedStationId) ||
        (selectedStationName && s.stopName.toLowerCase() === selectedStationName.toLowerCase()),
    );

    if (matched) {
      handleSelectStation(matched, false);
    }
  }, [selectedStationId, selectedStationName, stopsList]);

  // 5. Fetch Schedule & Nearby Parking when activeStop changes
  const loadStationData = useCallback(
    async (stopId: string, radiusMeters: number) => {
      setIsLoadingSchedule(true);
      setScheduleError(null);
      setIsLoadingParking(true);
      setParkingError(null);

      // Fetch live schedule (G-07)
      try {
        const scheduleData = await getTransitStopSchedule(stopId);
        setSchedule(scheduleData);
      } catch (err: any) {
        setScheduleError(err.message || 'Unable to load train schedule.');
      } finally {
        setIsLoadingSchedule(false);
      }

      // Fetch verified nearby parking (G-08)
      try {
        const parkingData = await getTransitStopNearbyParking(stopId, radiusMeters);
        setNearbyParking(parkingData);
      } catch (err: any) {
        setParkingError(err.message || 'Unable to load nearby parking.');
      } finally {
        setIsLoadingParking(false);
      }
    },
    [],
  );

  const handleSelectStation = (stop: TransitStopSummary, expand = true) => {
    setActiveStop(stop);
    setActiveDirectionIndex(0);
    onSelectStation(stop);
    loadStationData(stop.stopId, parkingRadius);
    if (expand) {
      setDetent('medium');
    }
  };

  const handleClearStation = () => {
    setActiveStop(null);
    setSchedule(null);
    setNearbyParking(null);
  };

  const handleCycleDetent = () => {
    if (detent === 'peek') setDetent('medium');
    else if (detent === 'medium') setDetent('full');
    else setDetent('peek');
  };

  // Convert NearbyParkingSpot to ParkingSpot DTO for direct reservation flow
  const convertToParkingSpotDto = (spot: StationNearbyParkingSpot, stop: TransitStopSummary): ParkingSpot => ({
    id: String(spot.parkingSpotId),
    parkingSpotId: spot.parkingSpotId,
    parkingLabel: spot.parkingLabel,
    propertyId: spot.propertyId,
    propertyName: spot.propertyName,
    address: spot.address,
    latitude: activeStop?.latitude || 0,
    longitude: activeStop?.longitude || 0,
    stationName: stop.stopName,
    distanceToStation: spot.distanceMeters / 1000,
    timeToStationInMinutes: spot.walkingTimeMinutes,
    availabilityStatus: spot.availabilityStatus,
    monthlyRate: spot.monthlyRate,
    dailyRate: spot.dailyRate,
    primaryImageUrl: spot.primaryImageUrl,
    station: stop.stopName,
    name: spot.propertyName,
    pricePerHour: 0,
    distance: Math.round(spot.distanceMeters),
    lat: activeStop?.latitude || 0,
    lng: activeStop?.longitude || 0,
    available: spot.availabilityStatus.toLowerCase() === 'available',
    type: 'Condo Bay',
    owner: `Property #${spot.propertyId}`,
  });

  // Calculate sheet height style based on detent
  const detentHeightClass = useMemo(() => {
    switch (detent) {
      case 'peek':
        return 'h-[160px] md:h-[180px]';
      case 'medium':
        return 'h-[52vh] min-h-[380px] max-h-[580px]';
      case 'full':
        return 'h-[86vh] max-h-[820px]';
      default:
        return 'h-[180px]';
    }
  }, [detent]);

  // Active line color info
  const lineMeta = activeStop
    ? RAPID_KL_LINE_COLORS[activeStop.routeId] || {
        name: activeStop.routeName,
        color: activeStop.routeColor || '#007AFF',
        badge: activeStop.category || 'Transit',
        category: activeStop.category || 'Rail',
      }
    : null;

  return (
    <div
      className={`transit-hub-sheet pointer-events-auto transition-all duration-300 ease-out flex flex-col
        fixed bottom-0 inset-x-0 z-[1000] ${detentHeightClass}
        md:absolute md:top-4 md:left-4 md:bottom-4 md:right-auto md:w-[420px] md:h-auto md:max-h-[calc(100%-2rem)] md:z-[999]
        ${className}`}
      role="region"
      aria-label="Transit Stations and Live Departures"
    >
      {/* Liquid Glass Frosted Functional Surface */}
      <div className="relative w-full h-full flex flex-col rounded-t-[28px] md:rounded-[24px] border border-black/[0.08] dark:border-white/[0.12] bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.12)] md:shadow-[0_8px_32px_rgba(0,0,0,0.16)] overflow-hidden">
        {/* Apple HIG Grabber Handle (Mobile detent toggle / Desktop header) */}
        <div
          onClick={handleCycleDetent}
          className="w-full pt-2.5 pb-2 cursor-pointer flex flex-col items-center justify-center shrink-0 group select-none"
          title={`Current: ${detent} (Tap to change size)`}
        >
          <div className="w-10 h-1.25 bg-[#3c3c43]/30 dark:bg-[#ebebf5]/30 rounded-full group-hover:bg-[#3c3c43]/50 transition-colors md:hidden" />
          <div className="flex items-center gap-1.5 mt-1 text-[10px] font-semibold tracking-wider uppercase text-[#86868b]">
            <Train className="w-3.5 h-3.5 text-[#007AFF]" />
            <span>Klang Valley Transit Hub</span>
            <span className="md:hidden">
              {detent === 'peek' ? (
                <ChevronUp className="w-3 h-3 inline ml-0.5" />
              ) : detent === 'full' ? (
                <ChevronDown className="w-3 h-3 inline ml-0.5" />
              ) : null}
            </span>
          </div>
        </div>

        {/* Top Control Bar: Search & Line Filters */}
        <div className="px-4 pb-2.5 shrink-0 space-y-2 border-b border-black/[0.05] dark:border-white/[0.06]">
          {/* iOS-Styled Search Bar */}
          <div className="relative flex items-center">
            <div className="absolute left-3 flex items-center pointer-events-none text-[#86868b]">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (detent === 'peek') setDetent('medium');
              }}
              onFocus={() => {
                if (detent === 'peek') setDetent('medium');
              }}
              placeholder="Search station in EN or 中文 (e.g. Subang, 城中城, TRX)..."
              className="w-full h-10 pl-9 pr-8 bg-[#767680]/12 dark:bg-[#767680]/24 rounded-xl text-sm font-normal text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] outline-none focus:ring-2 focus:ring-[#007AFF]/50 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 p-1 rounded-full text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
                aria-label="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Rapid KL Line Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setSelectedLineFilter('ALL')}
              className={`h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedLineFilter === 'ALL'
                  ? 'bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f] shadow-sm'
                  : 'bg-black/[0.05] text-[#6e6e73] dark:bg-white/[0.08] dark:text-[#a1a1a6] hover:bg-black/[0.08]'
              }`}
            >
              All Lines
            </button>
            {routes.map((route) => {
              const isSelected = selectedLineFilter === route.routeId;
              const hexColor = route.color || '#007AFF';
              return (
                <button
                  key={route.routeId}
                  type="button"
                  onClick={() => setSelectedLineFilter(route.routeId)}
                  className={`h-7 px-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-black/[0.06] dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.04] text-[#1d1d1f] dark:text-[#f5f5f7]'
                  }`}
                  style={{
                    backgroundColor: isSelected ? hexColor : undefined,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: isSelected ? '#ffffff' : hexColor }}
                  />
                  <span>{route.shortName || route.routeId}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div ref={sheetScrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* ================================================================ */}
          {/* VIEW A: Active Station Live Departures & Nearby Parking Hub       */}
          {/* ================================================================ */}
          {activeStop ? (
            <div className="space-y-4">
              {/* Station Header Card */}
              <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-4 border border-black/[0.06] dark:border-white/[0.08] shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Line Badge */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm"
                      style={{ backgroundColor: lineMeta?.color || '#007AFF' }}
                    >
                      {activeStop.stopId}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                          {activeStop.stopName}
                        </h2>
                        {activeStop.wheelchairAccessible && (
                          <span
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            title="Wheelchair accessible"
                          >
                            <Accessibility className="w-2.5 h-2.5" /> Accessible
                          </span>
                        )}
                      </div>

                      {/* Multilingual Name Subtitle */}
                      <div className="text-xs text-[#6e6e73] dark:text-[#a1a1a6] mt-0.5 truncate">
                        {activeStop.multilingualNames?.zh && (
                          <span className="mr-2">{activeStop.multilingualNames.zh}</span>
                        )}
                        {activeStop.multilingualNames?.ms && (
                          <span className="mr-2">{activeStop.multilingualNames.ms}</span>
                        )}
                        <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                          · {lineMeta?.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#86868b]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#34C759]" /> {activeStop.operatingHours}
                        </span>
                        {activeStop.distanceMeters != null && (
                          <span className="flex items-center gap-1 font-medium text-[#007AFF]">
                            <Navigation className="w-3 h-3" />
                            {activeStop.distanceMeters > 1000
                              ? `${(activeStop.distanceMeters / 1000).toFixed(1)} km`
                              : `${Math.round(activeStop.distanceMeters)} m`}{' '}
                            ({activeStop.walkingTimeMinutes} min walk)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Close / Deselect Station */}
                  <button
                    type="button"
                    onClick={handleClearStation}
                    className="p-1.5 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.1] text-[#86868b] hover:text-[#1d1d1f] transition"
                    aria-label="Back to all stations"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Live Departures Board */}
              <div className="bg-[#f2f2f7] dark:bg-[#242426] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-[#34C759] animate-pulse" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f] dark:text-[#f5f5f7]">
                      Live Train Departures
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {schedule?.isPeakHour ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        <Zap className="w-3 h-3" /> Peak · {schedule.frequencyMinutes}m Freq
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Normal ·{' '}
                        {schedule?.frequencyMinutes || 6}m Freq
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => loadStationData(activeStop.stopId, parkingRadius)}
                      disabled={isLoadingSchedule}
                      className="p-1 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition disabled:opacity-50"
                      title="Refresh timetable"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isLoadingSchedule ? 'animate-spin' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {isLoadingSchedule ? (
                  <div className="py-6 text-center text-xs text-[#86868b] flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-[#007AFF]" />
                    <span>Fetching real-time train timings…</span>
                  </div>
                ) : scheduleError ? (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl text-xs">
                    {scheduleError}
                  </div>
                ) : schedule?.departures && schedule.departures.length > 0 ? (
                  <div className="space-y-2.5">
                    {/* Direction Tabs */}
                    {schedule.departures.length > 1 && (
                      <div className="grid grid-cols-2 gap-1 bg-black/[0.05] dark:bg-white/[0.08] p-1 rounded-xl">
                        {schedule.departures.map((dep, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveDirectionIndex(idx)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold truncate transition-all ${
                              activeDirectionIndex === idx
                                ? 'bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-white shadow-xs'
                                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f]'
                            }`}
                          >
                            {dep.direction}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Selected Direction Active Departure Card */}
                    {(() => {
                      const currentDep = schedule.departures[activeDirectionIndex] || schedule.departures[0];
                      if (!currentDep) return null;

                      return (
                        <div className="bg-white dark:bg-[#1c1c1e] rounded-xl p-3.5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-[11px] font-medium text-[#86868b]">
                                Next train bound for
                              </div>
                              <div className="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                                {currentDep.destination}
                              </div>
                              <div className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6]">
                                {currentDep.trainType} · Departs at{' '}
                                <span className="font-semibold text-[#1d1d1f] dark:text-white">
                                  {currentDep.estimatedDeparture}
                                </span>
                              </div>
                            </div>

                            {/* Arrival Countdown Badge */}
                            <div className="flex flex-col items-end">
                              <div className="inline-flex items-baseline gap-1 bg-[#007AFF]/10 dark:bg-[#007AFF]/20 text-[#007AFF] px-3 py-1.5 rounded-xl border border-[#007AFF]/20">
                                <span className="text-xl font-bold font-mono tracking-tight leading-none">
                                  {currentDep.minutesUntilArrival}
                                </span>
                                <span className="text-xs font-semibold">min</span>
                              </div>
                            </div>
                          </div>

                          {/* Subsequent Departures Strip */}
                          {currentDep.subsequentDepartures && currentDep.subsequentDepartures.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center gap-2">
                              <span className="text-[10px] font-semibold uppercase text-[#86868b]">
                                Next:
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {currentDep.subsequentDepartures.map((time, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="px-2 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.08] text-[11px] font-mono font-medium text-[#1d1d1f] dark:text-[#f5f5f7]"
                                  >
                                    {time}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-[#86868b]">
                    Service currently outside operational hours ({schedule?.operatingHours || '06:00 - 23:50'}).
                  </div>
                )}
              </div>

              {/* Transit-to-Parking Integration (Core ParkJom Value) */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f] dark:text-[#f5f5f7]">
                      Verified Parking Bays Near Station
                    </h3>
                    <p className="text-[11px] text-[#86868b]">
                      {isLoadingParking
                        ? 'Finding verified bays within walking distance…'
                        : `${nearbyParking?.totalAvailableSpots ?? 0} available bay(s) within ${parkingRadius}m`}
                    </p>
                  </div>

                  {/* Radius Selector Pills */}
                  <div className="flex items-center gap-1 bg-black/[0.05] dark:bg-white/[0.08] p-0.5 rounded-lg text-[10px] font-medium">
                    {[500, 1000, 1500, 2000].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setParkingRadius(r);
                          loadStationData(activeStop.stopId, r);
                        }}
                        className={`px-2 py-1 rounded-md transition-all ${
                          parkingRadius === r
                            ? 'bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-white font-bold shadow-xs'
                            : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                        }`}
                      >
                        {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                      </button>
                    ))}
                  </div>
                </div>

                {isLoadingParking ? (
                  <div className="py-8 text-center text-xs text-[#86868b] flex flex-col items-center gap-2 bg-white dark:bg-[#2c2c2e] rounded-2xl border border-black/[0.05]">
                    <RefreshCw className="w-5 h-5 animate-spin text-[#007AFF]" />
                    <span>Cross-referencing verified parking database…</span>
                  </div>
                ) : parkingError ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-xl text-xs">
                    {parkingError}
                  </div>
                ) : nearbyParking?.parkingSpots && nearbyParking.parkingSpots.length > 0 ? (
                  <div className="space-y-2.5">
                    {nearbyParking.parkingSpots.map((spot) => (
                      <div
                        key={spot.parkingSpotId}
                        className="group bg-white dark:bg-[#2c2c2e] hover:bg-slate-50 dark:hover:bg-[#343438] rounded-2xl p-3.5 border border-black/[0.06] dark:border-white/[0.08] shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div
                            onClick={() => onSelectParkingSpot(spot)}
                            className="cursor-pointer flex items-start gap-3 min-w-0 flex-1"
                          >
                            {/* Spot Image or Modern ParkJom P Badge */}
                            {spot.primaryImageUrl ? (
                              <img
                                src={spot.primaryImageUrl}
                                alt={spot.propertyName}
                                className="w-14 h-14 rounded-xl object-cover shrink-0 border border-black/[0.06]"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex flex-col items-center justify-center text-white shrink-0 shadow-xs">
                                <span className="text-base font-extrabold leading-none">P</span>
                                <span className="text-[9px] font-semibold mt-0.5">{spot.parkingLabel}</span>
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                                  {spot.propertyName}
                                </h4>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/[0.05] dark:bg-white/[0.1] text-[#1d1d1f] dark:text-white">
                                  Bay {spot.parkingLabel}
                                </span>
                              </div>

                              <p className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6] truncate mt-0.5">
                                {spot.address}
                              </p>

                              {/* Walking Distance & Duration Pill */}
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#007AFF]">
                                  <Navigation className="w-3 h-3" />
                                  {Math.round(spot.distanceMeters)}m · {spot.walkingTimeMinutes} min walk
                                </span>

                                {spot.hasIoTDevice && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                                    <ShieldCheck className="w-2.5 h-2.5" /> Smart Bollard
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Rate & Reserve CTA */}
                          <div className="flex flex-col items-end shrink-0 gap-2">
                            <div className="text-right">
                              <span className="text-sm font-extrabold text-[#1d1d1f] dark:text-white">
                                {spot.dailyRate != null
                                  ? `RM ${spot.dailyRate.toFixed(2)}`
                                  : spot.monthlyRate > 0
                                  ? `RM ${spot.monthlyRate.toFixed(2)}`
                                  : 'Free'}
                              </span>
                              <span className="text-[10px] text-[#86868b] block">
                                {spot.dailyRate != null ? '/ day' : '/ month'}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                onSelectParkingSpot(spot);
                                if (onOpenParkingDetail) {
                                  onOpenParkingDetail(convertToParkingSpotDto(spot, activeStop));
                                }
                              }}
                              className="px-3 py-1.5 bg-[#007AFF] hover:bg-[#0071E3] active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1 transition-all"
                            >
                              <span>Reserve</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-white dark:bg-[#2c2c2e] rounded-2xl border border-black/[0.05] text-center space-y-2">
                    <MapPin className="w-6 h-6 text-[#86868b] mx-auto" />
                    <p className="text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      No verified bays within {parkingRadius}m of {activeStop.stopName}
                    </p>
                    <p className="text-[11px] text-[#86868b]">
                      Try increasing the search radius above to 2km or select an adjacent transit station.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================================================================ */
            /* VIEW B: Station Discovery, Search Results & Nearby Stations Hub   */
            /* ================================================================ */
            <div className="space-y-4">
              {/* GPS Near Me Shortcut Strip */}
              {userLocation && nearbyStations.length > 0 && !searchQuery && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#86868b] flex items-center gap-1.5">
                      <Navigation className="w-3 h-3 text-[#007AFF]" /> Closest Stations To You
                    </span>
                    <span className="text-[11px] text-[#86868b]">Live GPS</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {nearbyStations.slice(0, 4).map((station) => {
                      const color =
                        RAPID_KL_LINE_COLORS[station.routeId]?.color || station.routeColor || '#007AFF';
                      return (
                        <button
                          key={station.stopId}
                          type="button"
                          onClick={() => handleSelectStation(station)}
                          className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] hover:border-[#007AFF]/50 text-left transition-all group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                              style={{ backgroundColor: color }}
                            >
                              {station.stopId}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate group-hover:text-[#007AFF]">
                                {station.stopName}
                              </p>
                              <p className="text-[10px] text-[#86868b] truncate">
                                {station.routeName}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-[#007AFF] font-mono">
                              {station.distanceMeters != null
                                ? station.distanceMeters > 1000
                                  ? `${(station.distanceMeters / 1000).toFixed(1)}km`
                                  : `${Math.round(station.distanceMeters)}m`
                                : ''}
                            </span>
                            <span className="text-[9px] text-[#86868b] block">
                              {station.walkingTimeMinutes}m walk
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Station Search / Filtered List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#86868b]">
                    {searchQuery
                      ? `Search Results (${stopsList.length})`
                      : selectedLineFilter !== 'ALL'
                      ? `${selectedLineFilter} Line Stations (${stopsList.length})`
                      : `All Klang Valley Rail Stations (${stopsList.length})`}
                  </span>
                  {isSearching && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#007AFF]" />}
                </div>

                {stopsList.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-[#2c2c2e] rounded-2xl border border-black/[0.05]">
                    <Search className="w-6 h-6 text-[#86868b] mx-auto mb-2" />
                    <p className="text-xs font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                      No transit stations found matching "{searchQuery}".
                    </p>
                    <p className="text-[11px] text-[#86868b] mt-1">
                      Check spelling in English or Chinese, or clear line filters.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {stopsList.map((stop) => {
                      const color =
                        RAPID_KL_LINE_COLORS[stop.routeId]?.color || stop.routeColor || '#007AFF';
                      return (
                        <button
                          key={`${stop.routeId}-${stop.stopId}`}
                          type="button"
                          onClick={() => handleSelectStation(stop)}
                          className="w-full flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#2c2c2e] hover:bg-slate-50 dark:hover:bg-[#323235] border border-black/[0.04] dark:border-white/[0.06] text-left transition-all group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-xs"
                              style={{ backgroundColor: color }}
                            >
                              {stop.stopId}
                            </span>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate group-hover:text-[#007AFF]">
                                  {stop.stopName}
                                </span>
                                {stop.multilingualNames?.zh && (
                                  <span className="text-[11px] text-[#86868b]">
                                    {stop.multilingualNames.zh}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#86868b] truncate mt-0.5">
                                {stop.routeName} · {stop.category}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {stop.distanceMeters != null && (
                              <span className="text-xs font-medium text-[#007AFF]">
                                {stop.distanceMeters > 1000
                                  ? `${(stop.distanceMeters / 1000).toFixed(1)} km`
                                  : `${Math.round(stop.distanceMeters)} m`}
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-[#86868b] group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
