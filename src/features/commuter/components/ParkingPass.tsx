import { Car, ChevronRight, MapPin, Radio, TicketCheck } from 'lucide-react';
import type { ParkingSpot } from '../types';

interface ParkingPassProps {
  spot: ParkingSpot | null;
  vehiclePlate?: string;
  onReserve?: () => void;
  compact?: boolean;
}

export default function ParkingPass({
  spot,
  vehiclePlate,
  onReserve,
  compact = false,
}: ParkingPassProps) {
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
                <strong>{spot.name}</strong>
                <span><MapPin size={12} /> Bay {spot.parkingLabel} · {spot.station}</span>
                <span>{spot.distanceToStation.toFixed(2)} km · {spot.timeToStationInMinutes} min · {spot.address}</span>
              </div>
              <span className="status-dot status-dot--success">{spot.availabilityStatus}</span>
            </div>

            <div className="parking-pass__vehicle">
              <span className="parking-pass__icon"><Car size={17} /></span>
              <div>
                <span>Vehicle</span>
                <strong>{vehiclePlate || 'Add before checkout'}</strong>
              </div>
              <div className="parking-pass__price">
                <span>Rate</span>
                <strong>{spot.dailyRate !== null
                  ? `RM ${spot.dailyRate.toFixed(2)}/day`
                  : spot.monthlyRate > 0
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
            <MapPin size={22} />
            <p>Select a station, then choose an available bay from the map or nearby list.</p>
          </div>
        )}
      </div>
    </section>
  );
}
