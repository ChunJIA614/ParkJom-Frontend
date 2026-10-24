import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  Train,
  Clock,
  MapPin,
  Navigation,
  X,
  RefreshCw,
  Accessibility,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Bus,
} from 'lucide-react';
import StationFeedersWidget from './StationFeedersWidget';
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

interface TransitHubSheetProps {
  userLocation: { lat: number; lng: number } | null;
  selectedStationId?: string | null;
  selectedStationName?: string | null;
  onSelectStation: (stop: TransitStopSummary) => void;
  onSelectParkingSpot: (spot: StationNearbyParkingSpot) => void;
  onOpenParkingDetail?: (spot: ParkingSpot) => void;
  className?: string;
  selectedBusRoute?: string | null;
  onSelectBusRoute?: (routeId: string | null) => void;
}

export default function TransitHubSheet({
  userLocation,
  selectedStationId,
  selectedStationName,
  onSelectStation,
  onSelectParkingSpot,
  onOpenParkingDetail,
  className = '',
  selectedBusRoute,
  onSelectBusRoute,
}: TransitHubSheetProps) {
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

  // Active Sub-tab in Station View: 'departures' | 'feeders' | 'bays'
  const [stationTab, setStationTab] = useState<'departures' | 'feeders' | 'bays'>('departures');

  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 1. Load Rail Routes on Mount
  useEffect(() => {
    let isCancelled = false;
    getTransitRoutes()
      .then((data) => {
        if (!isCancelled) setRoutes(data);
      })
      .catch((err) => console.warn('[TransitHubPanel] Failed to load routes:', err));
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
          console.warn('[TransitHubPanel] Failed to load nearby stations:', err);
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
            console.warn('[TransitHubPanel] Stop query failed:', err);
            setIsSearching(false);
          }
        });
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, selectedLineFilter, userLocation]);

  // Unified deduplication for interchange stations (e.g. Ampang Park, Titiwangsa, Chan Sow Lin)
  const displayedStops = useMemo<(TransitStopSummary & { extraLines?: Array<{ stopId: string; routeId: string; color: string }> })[]>(() => {
    if (selectedLineFilter !== 'ALL' || searchQuery.trim()) {
      return stopsList as (TransitStopSummary & { extraLines?: Array<{ stopId: string; routeId: string; color: string }> })[];
    }
    const map = new Map<string, TransitStopSummary & { extraLines?: Array<{ stopId: string; routeId: string; color: string }> }>();
    stopsList.forEach((stop) => {
      const key = stop.stopName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!map.has(key)) {
        map.set(key, { ...stop, extraLines: [] });
      } else {
        const existing = map.get(key)!;
        const color = RAPID_KL_LINE_COLORS[stop.routeId]?.color || stop.routeColor || '#007AFF';
        if (existing.stopId !== stop.stopId && !existing.extraLines?.some((l) => l.routeId === stop.routeId)) {
          existing.extraLines = existing.extraLines || [];
          existing.extraLines.push({ stopId: stop.stopId, routeId: stop.routeId, color });
        }
      }
    });
    return Array.from(map.values());
  }, [stopsList, selectedLineFilter, searchQuery]);

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
      setActiveStop(matched);
      setActiveDirectionIndex(0);
      loadStationData(matched.stopId, parkingRadius);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [selectedStationId, selectedStationName, stopsList]);

  // 5. Fetch Schedule & Nearby Parking when activeStop changes
  const loadStationData = useCallback(
    async (stopId: string, radiusMeters: number) => {
      setIsLoadingSchedule(true);
      setScheduleError(null);
      setIsLoadingParking(true);
      setParkingError(null);

      try {
        const scheduleData = await getTransitStopSchedule(stopId);
        setSchedule(scheduleData);
      } catch (err: any) {
        setScheduleError(err.message || 'Unable to load train schedule.');
      } finally {
        setIsLoadingSchedule(false);
      }

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

  const handleSelectStation = (stop: TransitStopSummary) => {
    setActiveStop(stop);
    setActiveDirectionIndex(0);
    onSelectStation(stop);
    loadStationData(stop.stopId, parkingRadius);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const handleClearStation = () => {
    setActiveStop(null);
    setSchedule(null);
    setNearbyParking(null);
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
      className={`transit-hub-panel flex flex-col h-full bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden ${className}`}
      role="region"
      aria-label="Transit Stations and Live Departures"
    >
      {/* Refined Functional Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Train className="w-4 h-4 text-blue-600" />
          </span>
          <div>
            <h2 className="text-xs font-bold text-slate-900 tracking-tight">Transit Explorer</h2>
            <p className="text-[10px] text-slate-500">Rapid KL GTFS Network</p>
          </div>
        </div>

        {activeStop && (
          <button
            type="button"
            onClick={handleClearStation}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
          >
            All stations
          </button>
        )}
      </div>

      {/* Control Bar: Search & Subtle Line Filter Chips */}
      <div className="px-4 py-2.5 shrink-0 space-y-2 border-b border-slate-100 bg-slate-50/40">
        {/* Subtle Search Bar */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search station (e.g. Chow Kit, KLCC, TRX)..."
            className="w-full h-8 pl-8 pr-7 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 p-0.5 rounded text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Rapid KL Line Filter Chips — Refined Quiet Neutrals with 6px Color Dots */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setSelectedLineFilter('ALL')}
            className={`h-6 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
              selectedLineFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100'
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
                className={`h-6 px-2 rounded-md text-[11px] font-medium flex items-center gap-1.5 whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: hexColor }}
                />
                <span>{route.shortName || route.routeId}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Content Body */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* ================================================================ */}
        {/* VIEW A: Active Station Overview & Live GTFS Departures           */}
        {/* ================================================================ */}
        {activeStop ? (
          <div className="space-y-3">
            {/* Station Header Card */}
            <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-200/80">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  {/* Compact Line Badge */}
                  <span
                    className="px-2 py-0.5 rounded text-[11px] font-mono font-bold text-white shrink-0 mt-0.5 shadow-xs"
                    style={{ backgroundColor: lineMeta?.color || '#007AFF' }}
                  >
                    {activeStop.stopId}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {activeStop.stopName}
                      </h3>
                      {activeStop.wheelchairAccessible && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white text-slate-600 border border-slate-200"
                          title="Wheelchair accessible"
                        >
                          <Accessibility className="w-2.5 h-2.5 text-blue-600" /> Accessible
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      <span>{lineMeta?.name || activeStop.routeName}</span>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {activeStop.operatingHours}
                      </span>
                      {activeStop.distanceMeters != null && (
                        <span className="flex items-center gap-1 text-blue-600 font-medium">
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

                <button
                  type="button"
                  onClick={handleClearStation}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition"
                  aria-label="Back to all stations"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Segmented Sub-tabs: Departures vs Feeder Buses vs Parking Bays */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStationTab('departures')}
                className={`flex-1 py-1 px-2 rounded-md transition-all ${
                  stationTab === 'departures'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Departures
              </button>
              <button
                type="button"
                onClick={() => setStationTab('feeders')}
                className={`flex-1 py-1 px-2 rounded-md transition-all flex items-center justify-center gap-1 ${
                  stationTab === 'feeders'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Feeders</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </button>
              <button
                type="button"
                onClick={() => setStationTab('bays')}
                className={`flex-1 py-1 px-2 rounded-md transition-all flex items-center justify-center gap-1 ${
                  stationTab === 'bays'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Bays</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-200/70 text-[10px] text-slate-700">
                  {nearbyParking?.totalAvailableSpots ?? '…'}
                </span>
              </button>
            </div>

            {/* Sub-tab 1: Live Departures */}
            {stationTab === 'departures' && (
              <div className="rounded-xl border border-slate-200/80 bg-white p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Live Departures
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-slate-500">
                      {schedule?.isPeakHour
                        ? `Peak · ${schedule.frequencyMinutes}m interval`
                        : `Normal · ${schedule?.frequencyMinutes || 6}m interval`}
                    </span>
                    <button
                      type="button"
                      onClick={() => loadStationData(activeStop.stopId, parkingRadius)}
                      disabled={isLoadingSchedule}
                      className="p-1 text-slate-400 hover:text-slate-700 transition disabled:opacity-50"
                      title="Refresh timetable"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isLoadingSchedule ? 'animate-spin' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {isLoadingSchedule ? (
                  <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Fetching live train times…</span>
                  </div>
                ) : scheduleError ? (
                  <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg text-xs">
                    {scheduleError}
                  </div>
                ) : schedule?.departures && schedule.departures.length > 0 ? (
                  <div className="space-y-2">
                    {/* Direction Tabs */}
                    {schedule.departures.length > 1 && (
                      <div className="flex bg-slate-100 p-0.5 rounded-lg gap-1">
                        {schedule.departures.map((dep, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveDirectionIndex(idx)}
                            className={`flex-1 py-1 px-2 rounded-md text-xs font-semibold truncate transition-all ${
                              activeDirectionIndex === idx
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {dep.direction}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Active Departure Card */}
                    {(() => {
                      const currentDep =
                        schedule.departures[activeDirectionIndex] || schedule.departures[0];
                      if (!currentDep) return null;

                      return (
                        <div className="rounded-lg bg-slate-50 border border-slate-200/60 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                                Next train to
                              </div>
                              <div className="text-sm font-bold text-slate-900 truncate">
                                {currentDep.destination}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {currentDep.trainType} · Departs {currentDep.estimatedDeparture}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="inline-flex items-baseline gap-1 bg-slate-900 text-white px-2.5 py-1 rounded-md font-mono">
                                <span className="text-base font-bold leading-none">
                                  {currentDep.minutesUntilArrival}
                                </span>
                                <span className="text-[10px] uppercase font-semibold">min</span>
                              </div>
                            </div>
                          </div>

                          {/* Subsequent Departures */}
                          {currentDep.subsequentDepartures &&
                            currentDep.subsequentDepartures.length > 0 && (
                              <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-[11px]">
                                <span className="text-slate-400 font-medium">Next:</span>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {currentDep.subsequentDepartures.map((time, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-mono text-[10px]"
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
                  <div className="py-4 text-center text-xs text-slate-500">
                    Outside operating hours ({schedule?.operatingHours || '06:00 - 23:50'}).
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: Connecting MRT Feeder Buses */}
            {stationTab === 'feeders' && activeStop && (
              <StationFeedersWidget
                stopId={activeStop.stopId}
                stationName={activeStop.stopName}
                coordinates={{ lat: activeStop.latitude, lng: activeStop.longitude }}
                radiusMeters={3500}
                selectedRoute={selectedBusRoute}
                onSelectRoute={onSelectBusRoute}
              />
            )}

            {/* Sub-tab 3: Nearby Parking Bays */}
            {stationTab === 'bays' && (
              <div className="rounded-xl border border-slate-200/80 bg-white p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Verified Bays Near Station
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      {isLoadingParking
                        ? 'Searching walking distance bays…'
                        : `${nearbyParking?.totalAvailableSpots ?? 0} available bay(s)`}
                    </p>
                  </div>

                  {/* Radius selector */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-medium">
                    {[500, 1500, 3000].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setParkingRadius(r);
                          loadStationData(activeStop.stopId, r);
                        }}
                        className={`px-1.5 py-0.5 rounded ${
                          parkingRadius === r
                            ? 'bg-white text-slate-900 font-bold shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                      </button>
                    ))}
                  </div>
                </div>

                {isLoadingParking ? (
                  <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Loading verified parking spots…</span>
                  </div>
                ) : parkingError ? (
                  <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg text-xs">
                    {parkingError}
                  </div>
                ) : nearbyParking?.parkingSpots && nearbyParking.parkingSpots.length > 0 ? (
                  <div className="space-y-1.5">
                    {nearbyParking.parkingSpots.map((spot) => (
                      <div
                        key={spot.parkingSpotId}
                        onClick={() => onSelectParkingSpot(spot)}
                        className="p-2.5 rounded-lg border border-slate-200/80 hover:border-blue-500/60 bg-white hover:bg-slate-50/50 transition cursor-pointer flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-blue-50 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                              P
                            </span>
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {spot.propertyName}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Bay {spot.parkingLabel} · {spot.walkingTimeMinutes} min walk ({spot.distanceMeters}m)
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-slate-900 font-mono block">
                            RM {spot.monthlyRate.toFixed(2)}/mo
                          </span>
                          {onOpenParkingDetail && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenParkingDetail(convertToParkingSpotDto(spot, activeStop));
                              }}
                              className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold"
                            >
                              Reserve →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500 space-y-1">
                    <MapPin className="w-5 h-5 text-slate-400 mx-auto" />
                    <p className="font-semibold text-slate-700">No bays within {parkingRadius}m</p>
                    <p className="text-[11px] text-slate-400">
                      Try expanding the search radius above.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ================================================================ */
          /* VIEW B: Station Discovery, Search Results & Nearby Stations Hub   */
          /* ================================================================ */
          <div className="space-y-3">
            {/* GPS Near Me Shortcut Strip */}
            {userLocation && nearbyStations.length > 0 && !searchQuery && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                  <span className="flex items-center gap-1 text-slate-700">
                    <Navigation className="w-3 h-3 text-blue-600" /> Nearest Stations
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">GPS</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {nearbyStations.slice(0, 4).map((station) => {
                    const color =
                      RAPID_KL_LINE_COLORS[station.routeId]?.color || station.routeColor || '#007AFF';
                    return (
                      <button
                        key={station.stopId}
                        type="button"
                        onClick={() => handleSelectStation(station)}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/70 text-left transition group"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="min-w-[2.4rem] px-1.5 h-5 rounded-md text-[9.5px] font-mono font-bold text-white inline-flex items-center justify-center tracking-tight shrink-0 shadow-xs"
                            style={{ backgroundColor: color }}
                          >
                            {station.stopId}
                          </span>
                          <span className="text-xs font-medium text-slate-900 truncate group-hover:text-blue-600">
                            {station.stopName}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-medium text-slate-500 shrink-0 ml-1">
                          {station.walkingTimeMinutes}m
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Station Search / Filtered List */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>
                  {searchQuery
                    ? `Results (${displayedStops.length})`
                    : selectedLineFilter !== 'ALL'
                    ? `${selectedLineFilter} Stations (${displayedStops.length})`
                    : `Stations (${displayedStops.length})`}
                </span>
                {isSearching && <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />}
              </div>

              {displayedStops.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200/70">
                  <Search className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-slate-800">
                    No stations found for "{searchQuery}"
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Check spelling or clear line filter.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {displayedStops.slice(0, 60).map((stop) => {
                    const color =
                      RAPID_KL_LINE_COLORS[stop.routeId]?.color || stop.routeColor || '#007AFF';
                    return (
                      <button
                        key={`${stop.routeId}-${stop.stopId}`}
                        type="button"
                        onClick={() => handleSelectStation(stop)}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/60 text-left transition group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className="min-w-[2.5rem] px-1.5 h-5 rounded-md text-[9.5px] font-mono font-bold text-white inline-flex items-center justify-center tracking-tight shrink-0 shadow-xs"
                              style={{ backgroundColor: color }}
                            >
                              {stop.stopId}
                            </span>
                            {stop.extraLines?.map((extra) => (
                              <span
                                key={extra.stopId}
                                className="min-w-[2.5rem] px-1.5 h-5 rounded-md text-[9.5px] font-mono font-bold text-white inline-flex items-center justify-center tracking-tight shrink-0 shadow-xs"
                                style={{ backgroundColor: extra.color }}
                              >
                                {extra.stopId}
                              </span>
                            ))}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 truncate block">
                              {stop.stopName}
                            </span>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {stop.extraLines && stop.extraLines.length > 0
                                ? 'Interchange Station'
                                : stop.routeName}
                            </span>
                          </div>
                        </div>

                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
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
  );
}
