import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Bus, RefreshCw, Navigation, Gauge, Clock, ChevronRight, AlertCircle, Radio } from 'lucide-react';
import {
  RealtimeVehicle,
  getStationFeeders,
  getNearbyRealtimeVehicles,
} from '@/services/gtfsRealtimeApi';
import {
  findRoutesServingStation,
  normalizeBusRouteCode,
} from '@/services/rapidBusService';

interface StationFeedersWidgetProps {
  stopId?: string | null;
  stationName?: string | null;
  coordinates?: { lat: number; lng: number } | null;
  radiusMeters?: number;
  compact?: boolean;
  className?: string;
  selectedRoute?: string | null;
  onSelectRoute?: (routeId: string | null) => void;
  onVehicleClick?: (vehicle: RealtimeVehicle) => void;
}

export default function StationFeedersWidget({
  stopId,
  stationName,
  coordinates,
  radiusMeters = 3500,
  compact = false,
  className = '',
  selectedRoute,
  onSelectRoute,
  onVehicleClick,
}: StationFeedersWidgetProps) {
  const [feeders, setFeeders] = useState<RealtimeVehicle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const lat = coordinates?.lat;
  const lng = coordinates?.lng;

  const fetchFeeders = useCallback(
    async (isBackground = false) => {
      if (!stopId && (!lat || !lng)) {
        setFeeders([]);
        setIsLoading(false);
        return;
      }

      // Only show spinner on initial load when there is no existing data
      if (!isBackground && feeders.length === 0) {
        setIsLoading(true);
      }
      setError(null);

      try {
        let results: RealtimeVehicle[] = [];

        // 1. Try by stopId if provided (e.g. 'KJ28', 'KG09')
        if (stopId && stopId.trim().length > 0) {
          try {
            const res = await getStationFeeders(stopId.trim(), radiusMeters);
            if (res.success && Array.isArray(res.data) && res.data.length > 0) {
              results = res.data;
            }
          } catch (err) {
            console.debug(`[StationFeeders] Stop ID '${stopId}' feeder lookup fallback to nearby coordinates:`, err);
          }
        }

        // 2. If no feeders found by stopId, and coordinates are available, fallback to proximity search
        if (results.length === 0 && lat && lng) {
          try {
            const nearbyRes = await getNearbyRealtimeVehicles(
              lat,
              lng,
              radiusMeters,
              'prasarana',
              'rapid-bus-mrtfeeder',
            );
            if (nearbyRes.success && Array.isArray(nearbyRes.data)) {
              results = nearbyRes.data;
            }
          } catch (nearbyErr: any) {
            console.warn('[StationFeeders] Nearby vehicle search failed:', nearbyErr);
          }
        }

        setFeeders(results);
        setLastUpdated(new Date());
      } catch (err: any) {
        console.error('[StationFeeders] Failed to load feeders:', err);
        setError(err?.message || 'Could not load feeder bus positions.');
      } finally {
        setIsLoading(false);
      }
    },
    [stopId, lat, lng, radiusMeters, feeders.length],
  );

  useEffect(() => {
    fetchFeeders();

    // Auto-poll every 30 seconds to match data.gov.my refresh frequency
    const interval = setInterval(() => {
      fetchFeeders(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchFeeders]);

  const formatDistance = (meters?: number | null) => {
    if (meters == null) return null;
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const formatEta = (minutes?: number | null) => {
    if (minutes == null) return null;
    if (minutes <= 1) return 'Arriving';
    return `~${minutes}m`;
  };

  // Static Rapid KL / MRT Feeder routes serving this station
  const staticStationRoutes = useMemo(() => {
    if (!lat || !lng) return [];
    return findRoutesServingStation({ lat, lng }, stationName, 800);
  }, [lat, lng, stationName]);

  const isRouteMatch = (r1?: string | null, r2?: string | null) => {
    if (!r1 || !r2) return false;
    return (
      r1.trim().toUpperCase() === r2.trim().toUpperCase() ||
      normalizeBusRouteCode(r1) === normalizeBusRouteCode(r2)
    );
  };

  if (compact) {
    return (
      <div className={`station-feeders-compact mt-1.5 pt-1.5 border-t border-slate-100 ${className}`}>
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
            <Bus className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>Feeder Buses</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <button
            type="button"
            onClick={() => fetchFeeders(false)}
            disabled={isLoading}
            className="text-[9.5px] text-slate-400 hover:text-slate-600 p-0.5 rounded transition disabled:opacity-40"
            title="Refresh feeders"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isLoading && feeders.length === 0 ? (
          <div className="py-1 text-[10px] text-slate-400 flex items-center justify-center gap-1">
            <RefreshCw className="w-2.5 h-2.5 animate-spin text-emerald-600" />
            <span>Scanning buses...</span>
          </div>
        ) : feeders.length > 0 ? (
          <div className="space-y-1 max-h-24 overflow-y-auto no-scrollbar p-0.5 -m-0.5">
            {feeders.slice(0, 3).map((f) => {
              const isSelected = isRouteMatch(selectedRoute, f.routeId);
              return (
                <div
                  key={f.id || f.vehicleId}
                  onClick={(e) => {
                    e.stopPropagation();
                    onVehicleClick?.(f);
                    if (f.routeId && onSelectRoute) {
                      onSelectRoute(isSelected ? null : f.routeId);
                    }
                  }}
                  className={`flex items-center justify-between text-[10px] rounded-md px-1.5 py-1 transition-colors cursor-pointer border ${
                    isSelected
                      ? 'bg-emerald-100/90 border-emerald-500 text-emerald-900 shadow-2xs'
                      : 'bg-emerald-50/60 hover:bg-emerald-50 border-emerald-100/80'
                  }`}
                  title={isSelected ? 'Route shown on map (click to clear)' : 'Click to show full bus route on map'}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="font-bold bg-emerald-600 text-white text-[9.5px] px-1 py-0.2 rounded font-mono shrink-0">
                      {f.routeId || 'BUS'}
                    </span>
                    <span className="text-slate-600 font-mono text-[9.5px] truncate min-w-0">
                      {isSelected ? 'Route Shown' : f.licensePlate || f.vehicleId}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {f.distanceMeters != null && (
                      <span className="text-[9.5px] text-slate-500">
                        {formatDistance(f.distanceMeters)}
                      </span>
                    )}
                    {f.estimatedArrivalMinutes != null && (
                      <span className="font-bold text-emerald-700 bg-emerald-100/90 px-1 py-0.2 rounded text-[9.5px]">
                        {formatEta(f.estimatedArrivalMinutes)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : staticStationRoutes.length > 0 ? (
          <div className="space-y-1 max-h-24 overflow-y-auto no-scrollbar p-0.5 -m-0.5">
            {staticStationRoutes.slice(0, 3).map((r) => {
              const isSelected = isRouteMatch(selectedRoute, r.shortName);
              return (
                <div
                  key={r.routeId}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRoute?.(isSelected ? null : r.shortName);
                  }}
                  className={`flex items-center justify-between text-[10px] rounded-md px-1.5 py-1 transition-colors cursor-pointer border ${
                    isSelected
                      ? 'bg-emerald-100/90 border-emerald-500 text-emerald-900 shadow-2xs'
                      : 'bg-slate-50 hover:bg-emerald-50/70 border-slate-200/80'
                  }`}
                  title={isSelected ? 'Route shown on map (click to clear)' : 'Click to show full bus route on map'}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="font-bold bg-emerald-600 text-white text-[9.5px] px-1 py-0.2 rounded font-mono shrink-0">
                      {r.shortName}
                    </span>
                    <span className="text-slate-600 text-[9.5px] truncate min-w-0">
                      {r.longName}
                    </span>
                  </div>
                  <span className="text-[9px] font-semibold text-emerald-700 shrink-0 ml-1">
                    {isSelected ? 'Shown' : 'Route'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[10px] text-slate-400 py-0.5 italic">
            No active feeder buses in range.
          </p>
        )}
      </div>
    );
  }

  // Full / Sheet View (used in TransitHubSheet)
  return (
    <div className={`station-feeders-widget rounded-xl border border-slate-200/80 bg-white p-3.5 space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
            <Bus className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Approaching MRT Feeder Buses
              </h4>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold shrink-0 whitespace-nowrap">
                <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-600" />
                Live GTFS-R
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              Prasarana Rapid Bus · {stationName || 'Catchment area'} ({radiusMeters < 1000 ? `${radiusMeters}m` : `${radiusMeters / 1000}km`})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchFeeders(false)}
          disabled={isLoading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
          title="Refresh live feeder positions"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* Body States */}
      {isLoading && feeders.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
          <span className="font-medium">Connecting to Malaysia GTFS-Realtime telemetry…</span>
          <span className="text-[11px] text-slate-400">Tracking active MRT feeder buses in vicinity</span>
        </div>
      ) : error && feeders.length === 0 ? (
        <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Unable to fetch live feeders.</span>
            <p className="text-[11px] text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      ) : feeders.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-500 bg-slate-50/60 rounded-xl border border-slate-100 px-4">
          <Bus className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
          <p className="font-medium text-slate-700">No MRT feeder buses currently in catchment area</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            MRT feeder buses run at 10–15 min intervals during peak hours. Tap refresh to check for incoming buses.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 font-medium">
            <span>{feeders.length} active vehicle{feeders.length === 1 ? '' : 's'} tracked</span>
            {lastUpdated && (
              <span className="text-[10px] text-slate-400">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>

          <div className="space-y-2 max-h-[340px] overflow-y-auto no-scrollbar px-1.5 py-1.5 -mx-1.5 -my-1">
            {feeders.map((vehicle) => {
              const speed = vehicle.speedKmh != null ? Math.round(vehicle.speedKmh) : null;
              const isMoving = speed != null && speed > 3;
              const isSelected = isRouteMatch(selectedRoute, vehicle.routeId);

              return (
                <div
                  key={vehicle.id || vehicle.vehicleId}
                  onClick={() => {
                    onVehicleClick?.(vehicle);
                    if (vehicle.routeId && onSelectRoute) {
                      onSelectRoute(isSelected ? null : vehicle.routeId);
                    }
                  }}
                  style={{
                    borderColor: isSelected ? '#10b981' : '#e2e8f0',
                  }}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer group ${
                    isSelected
                      ? 'border-[1.5px] border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border border-slate-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/30 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Left: Route Badge & Plate */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="px-2 py-1 rounded-md bg-emerald-600 text-white font-bold font-mono text-xs shadow-xs shrink-0 tracking-wide">
                        {vehicle.routeId || 'T-BUS'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 min-w-0">
                          <span className="truncate">MRT Feeder {vehicle.routeId || vehicle.vehicleId}</span>
                          {isSelected && (
                            <span className="shrink-0 whitespace-nowrap text-[9.5px] leading-none bg-emerald-600 text-white font-semibold px-1.5 py-0.5 rounded-full font-sans shadow-2xs">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                          <span className="truncate">Plate: {vehicle.licensePlate || vehicle.vehicleId}</span>
                          {speed != null && (
                            <span className="flex items-center gap-0.5 text-slate-600 font-sans shrink-0">
                              <Gauge className="w-2.5 h-2.5 text-slate-400" />
                              {speed} km/h
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Distance & Live Countdown ETA */}
                    <div className="text-right shrink-0 flex flex-col items-end">
                      {vehicle.estimatedArrivalMinutes != null ? (
                        <div className="inline-flex items-baseline gap-1 bg-emerald-600 text-white px-2 py-0.5 rounded-md font-mono shadow-xs">
                          <span className="text-xs font-bold leading-none">
                            {vehicle.estimatedArrivalMinutes <= 1 ? 'Arriving' : vehicle.estimatedArrivalMinutes}
                          </span>
                          {vehicle.estimatedArrivalMinutes > 1 && (
                            <span className="text-[9px] uppercase font-semibold">min</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                          Live
                        </span>
                      )}

                      {vehicle.distanceMeters != null && (
                        <span className="text-[10px] text-slate-500 mt-1 flex items-center gap-0.5">
                          <Navigation className="w-2.5 h-2.5 text-slate-400" />
                          {formatDistance(vehicle.distanceMeters)} away
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vehicle telemetry footer */}
                  <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${isMoving ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                      {isMoving ? `In motion (${speed} km/h)` : 'Stationary / At stop'}
                    </span>
                    <span className="text-emerald-700 font-medium text-[10px]">
                      {isSelected ? 'Click to show all routes' : 'Click to show route on map'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
