import React, { useMemo } from 'react';
import { Bus, Car, ChevronRight, MapPin, Radio, TicketCheck } from 'lucide-react';
import type { ParkingSpot } from '../types';
import { findConnectingBusRoutes } from '@/services/rapidBusService';
import { formatShortSpotName, formatShortAddress } from '../lib/formatUtils';

interface ParkingPassProps {
  spot: ParkingSpot | null;
  vehiclePlate?: string;
  onReserve?: () => void;
  compact?: boolean;
  stationName?: string | null;
  stationCoords?: { lat: number; lng: number } | null;
  isNearbyLoading?: boolean;
  selectedBusRoute?: string | null;
  onSelectBusRoute?: (routeId: string | null) => void;
}

export default function ParkingPass({
  spot,
  vehiclePlate,
  onReserve,
  compact = false,
  stationName,
  stationCoords,
  isNearbyLoading = false,
  selectedBusRoute,
  onSelectBusRoute,
}: ParkingPassProps) {
  // Find Rapid KL bus routes that pass near this parking bay and connect to the transit station
  const connectingRoutes = useMemo(() => {
    if (!spot) return [];
    const lat = spot.lat || spot.latitude || 0;
    const lng = spot.lng || spot.longitude || 0;
    if (!lat || !lng) return [];
    return findConnectingBusRoutes(
      { lat, lng },
      stationCoords,
      stationName || spot.station,
      800,
      800,
    );
  }, [spot, stationCoords, stationName]);

  return (
    <section className={`parking-pass ${compact ? 'parking-pass--compact' : ''}`} aria-label="Parking Pass">
      <div className="parking-pass__header">
        <span className="parking-pass__mark" aria-hidden="true">
          <TicketCheck size={18} />
        </span>
        <div>
          <h2>Parking Pass</h2>
          <p>{spot ? 'Ready to reserve' : 'Choose a bay to begin'}</p>
        </div>
        <Radio size={19} aria-hidden="true" />
      </div>

      <div className="parking-pass__body">
        {spot ? (
          <>
            <div className="parking-pass__bay">
              <span className="parking-pass__bay-code">P</span>
              <div className="min-w-0">
                <strong>{formatShortSpotName(spot.name)}</strong>
                <span><MapPin size={12} /> Bay {spot.parkingLabel} · {spot.station}</span>
                <span>{(spot.distanceToStation ?? 0).toFixed(2)} km · {spot.timeToStationInMinutes ?? 0} min · {formatShortAddress(spot.address, 30)}</span>
              </div>
              <span className="status-dot status-dot--success">{spot.availabilityStatus}</span>
            </div>

            {/* Connecting Rapid KL Bus Route to Station */}
            {connectingRoutes.length > 0 && (
              <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/90 p-2.5 my-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-950 text-[11px]">
                    <Bus size={14} className="text-emerald-600 shrink-0" />
                    <span>Transit Connecting Bus</span>
                  </div>
                  <span className="bg-emerald-200/80 text-emerald-900 font-mono font-bold px-1.5 py-0.2 rounded text-[10px]">
                    Route {connectingRoutes[0].route.shortName}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-800 mt-1 leading-tight">
                  {connectingRoutes[0].nearestStopToSpot ? (
                    <>
                      <strong>{connectingRoutes[0].distanceToSpotMeters}m walk</strong> to stop <em>{connectingRoutes[0].nearestStopToSpot.stop.stopName}</em> → connects directly to <strong>{stationName || spot.station}</strong>
                    </>
                  ) : (
                    <>Feeder route connecting this bay to {stationName || spot.station}</>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onSelectBusRoute?.(
                      selectedBusRoute === connectingRoutes[0].route.shortName
                         ? null
                        : connectingRoutes[0].route.shortName,
                    )
                  }
                  className={`mt-2 w-full py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                    selectedBusRoute === connectingRoutes[0].route.shortName
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  }`}
                >
                  <Bus size={13} />
                  <span>
                    {selectedBusRoute === connectingRoutes[0].route.shortName
                      ? '✕ Hide Bus Route on Map'
                      : `Show Route ${connectingRoutes[0].route.shortName} on Map`}
                  </span>
                </button>
              </div>
            )}

            <div className="parking-pass__vehicle">
              <span className="parking-pass__icon"><Car size={17} /></span>
              <div>
                <span>Vehicle</span>
                <strong>{vehiclePlate || 'Add before checkout'}</strong>
              </div>
              <div className="parking-pass__price">
                <span>Rate</span>
                <strong>{spot.dailyRate != null
                  ? `RM ${spot.dailyRate.toFixed(2)}/day`
                  : (spot.monthlyRate != null && spot.monthlyRate > 0)
                    ? `RM ${spot.monthlyRate.toFixed(2)}/month`
                    : 'Not set'}</strong>
              </div>
            </div>

            <button type="button" className="parking-pass__action" onClick={onReserve}>
              Reserve this bay <ChevronRight size={17} />
            </button>
          </>
        ) : (
          <div className="parking-pass__empty">
            {isNearbyLoading ? <Radio size={22} className="animate-pulse" /> : <MapPin size={22} />}
            <p>
              {isNearbyLoading && stationName
                ? `Loading parking details for ${stationName}...`
                : 'Select a station, then choose an available bay from the map or nearby list.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
