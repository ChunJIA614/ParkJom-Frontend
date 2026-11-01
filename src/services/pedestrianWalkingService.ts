/**
 * Pedestrian Walking Model & Routing Calculation Service
 *
 * Grounded in:
 * 1. Google Maps pedestrian routing model (baseline: 4.8 km/h - 5.0 km/h, ~12.0 - 12.5 min/km).
 * 2. OpenTripPlanner (OTP) standard pedestrian speed (1.333 m/s = 4.8 km/h).
 * 3. Highway Capacity Manual (HCM 2010) & Malaysian Urban Pedestrian Guidelines.
 *
 * Key physics & urban parameters:
 * - Walking speed: 4.8 km/h (1.333 m/s = 80 meters/min = 12.5 minutes per km).
 * - A 1 km walk takes at least 12.5 minutes (plus urban street crossing delays: ~13-14 minutes).
 * - Maneuver delays: 6-8 seconds per turn (traffic checking, curb transition).
 * - Street crossing delays: 15-25 seconds per signalized road crossing.
 * - Transit concourse / station entry buffer: 45 seconds (escalators, overhead bridges / jejantas, fare gates).
 * - Urban Street Circuity Factor: τ = 1.30 (street network walking distance ≈ 1.30 × Euclidean distance).
 */

export const PEDESTRIAN_CONFIG = {
  /** Baseline pedestrian speed in meters per second (4.8 km/h = 1.3333 m/s) */
  WALK_SPEED_MPS: 4.8 / 3.6, // 1.3333 m/s
  /** Baseline pedestrian speed in km/h */
  WALK_SPEED_KMH: 4.8,
  /** Pace in minutes per kilometer (12.5 min/km) */
  MINUTES_PER_KM: 12.5,
  /** Maneuver turn penalty in seconds */
  TURN_PENALTY_SECONDS: 8,
  /** Major street crossing waiting penalty in seconds */
  STREET_CROSSING_PENALTY_SECONDS: 20,
  /** Station entrance concourse & fare gate buffer in seconds */
  STATION_ENTRANCE_BUFFER_SECONDS: 45,
  /** Urban street network circuity factor for Euclidean distance fallback */
  URBAN_CIRCUITY_FACTOR: 1.3,
} as const;

/**
 * Calculates straight-line Euclidean distance between two GPS coordinates using the Haversine formula.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Estimates real street network walking distance from straight-line Euclidean distance.
 */
export function estimateNetworkWalkingDistanceMeters(euclideanDistanceMeters: number): number {
  return Math.round(euclideanDistanceMeters * PEDESTRIAN_CONFIG.URBAN_CIRCUITY_FACTOR);
}

/**
 * Calculates pedestrian step duration in seconds for an individual turn-by-turn step.
 */
export function calculateStepDurationSeconds(
  distanceMeters: number,
  modifier?: string,
  maneuverType?: string,
): number {
  if (distanceMeters <= 0) return 0;
  const travelSeconds = distanceMeters / PEDESTRIAN_CONFIG.WALK_SPEED_MPS;

  let penaltySeconds = 0;
  if (
    modifier &&
    (modifier.includes('left') ||
      modifier.includes('right') ||
      modifier.includes('sharp') ||
      modifier.includes('u-turn'))
  ) {
    penaltySeconds += PEDESTRIAN_CONFIG.TURN_PENALTY_SECONDS;
  }
  if (maneuverType === 'arrive') {
    penaltySeconds += PEDESTRIAN_CONFIG.STATION_ENTRANCE_BUFFER_SECONDS;
  }

  return Math.max(1, Math.round(travelSeconds + penaltySeconds));
}

/**
 * Calculates total walking duration in minutes for a given walking distance.
 *
 * Example:
 * - 500m => ~6 - 7 mins
 * - 1,000m (1km) => ~13 mins (must never be 2 minutes!)
 * - 1,206m => ~15 - 16 mins
 * - 1,573m => ~20 - 21 mins
 * - 2,800m => ~35 - 37 mins
 * - 3,900m => ~49 - 52 mins
 */
export function calculateWalkingMinutes(
  distanceMeters: number,
  options?: {
    turnsCount?: number;
    crossingsCount?: number;
    isStationDestination?: boolean;
  },
): number {
  if (distanceMeters <= 0) return 0;

  const baseSeconds = distanceMeters / PEDESTRIAN_CONFIG.WALK_SPEED_MPS;
  const turns = options?.turnsCount ?? 0;
  const crossings = options?.crossingsCount ?? 0;
  const isStation = options?.isStationDestination ?? false;

  const turnDelays = turns * PEDESTRIAN_CONFIG.TURN_PENALTY_SECONDS;
  const crossingDelays = crossings * PEDESTRIAN_CONFIG.STREET_CROSSING_PENALTY_SECONDS;
  const stationBuffer = isStation ? PEDESTRIAN_CONFIG.STATION_ENTRANCE_BUFFER_SECONDS : 0;

  const totalSeconds = baseSeconds + turnDelays + crossingDelays + stationBuffer;
  return Math.max(1, Math.round(totalSeconds / 60));
}

/**
 * Formats distance cleanly (e.g. 850m -> "850 m", 2800m -> "2.8 km").
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Formats duration cleanly (e.g. 15 -> "~15 mins", 75 -> "~1 hr 15 mins").
 */
export function formatWalkingDuration(minutes: number, prefixTilde = true): string {
  const prefix = prefixTilde ? '~' : '';
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${prefix}${minutes} min${minutes === 1 ? '' : 's'}`;
  const hrs = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) return `${prefix}${hrs} hr${hrs === 1 ? '' : 's'}`;
  return `${prefix}${hrs} hr ${remainingMins} min${remainingMins === 1 ? '' : 's'}`;
}
