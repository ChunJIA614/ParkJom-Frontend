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
 * - A 1 km walk takes at least 12.5 minutes (plus 45s station entrance buffer: ~13 minutes).
 * - Maneuver delays: 6-8 seconds per turn (traffic checking, curb transition).
 * - Street crossing delays: 15-25 seconds per signalized road crossing.
 * - Transit concourse / station entry buffer: 45 seconds (escalators, overhead bridges / jejantas, fare gates).
 * - Urban Street Circuity Factor: τ = 1.30 (street network walking distance ≈ 1.30 × Euclidean distance).
 */

import stationData from '../features/commuter/data/mrt_lrt_stations.json';

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

export interface CanonicalStationInfo {
  name: string;
  code: string;
  lat: number;
  lng: number;
}

const CANONICAL_STATION_OVERRIDES: Record<string, CanonicalStationInfo> = {
  maluri: { name: 'Maluri', code: 'AG13', lat: 3.12329, lng: 101.727283 },
  usj7: { name: 'USJ 7', code: 'KJ31', lat: 3.054956, lng: 101.592194 },
  tamanmelati: { name: 'Taman Melati', code: 'KJ2', lat: 3.219558, lng: 101.72197 },
  wangsamaju: { name: 'Wangsa Maju', code: 'KJ3', lat: 3.205751, lng: 101.731796 },
};

const ROUTE_CACHE_STORAGE_KEY = 'parkjom.canonicalWalkDistMeters.v2';

/**
 * Pre-seeded verified forward OSRM walking distances (Property -> Station)
 * so every device renders identical walking times immediately on first frame
 * even before async OSRM requests complete or when OSRM is rate-limited.
 */
const PRECOMPUTED_STATION_WALK_METERS: Record<string, number> = {
  // M Vertica Residences (3.119050, 101.727013) -> Maluri (3.123290, 101.727283) => 1409m (1.41 km, 18 min)
  '3.1191,101.7270->maluri': 1409,
  '3.11905,101.72701->3.12329,101.72728': 1409,
  '3.11905,101.72701->3.12327,101.72694': 1409,
  // USJ One Avenue Condominium (3.046610, 101.603126) -> USJ 7 (3.054956, 101.592194) => 3587m (3.59 km, 46 min)
  '3.0466,101.6031->usj7': 3587,
  '3.04661,101.60313->3.05496,101.59219': 3587,
  '3.04661,101.60313->3.05481,101.59198': 3587,
  // PV18 Residences (3.202784, 101.712779) -> Taman Melati (3.219558, 101.721970) => 3465m (3.46 km, 44 min)
  '3.2028,101.7128->tamanmelati': 3465,
  '3.20278,101.71278->3.21956,101.72197': 3465,
  '3.20278,101.71278->3.21953,101.72187': 3465,
  // PV128 (3.200244, 101.716867) -> Wangsa Maju (3.205751, 101.731796) => 2896m (2.90 km, 37 min)
  '3.2002,101.7169->wangsamaju': 2896,
  '3.20024,101.71687->3.20575,101.73180': 2896,
  '3.20024,101.71687->3.20575,101.73191': 2896,
  // PV 9 Setapak (3.217872, 101.722625) -> Taman Melati (3.219558, 101.721970) => 945m (0.95 km, 13 min)
  '3.2179,101.7226->tamanmelati': 945,
  '3.21787,101.72263->3.21956,101.72197': 945,
  '3.21787,101.72263->3.21953,101.72187': 945,
};

const memoryDistanceCache = new Map<string, number>(Object.entries(PRECOMPUTED_STATION_WALK_METERS));
let storageLoaded = false;

function ensureStorageCacheLoaded() {
  if (storageLoaded) return;
  storageLoaded = true;
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(ROUTE_CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0 && !memoryDistanceCache.has(k)) {
          memoryDistanceCache.set(k, v);
        }
      }
    }
  } catch {
    // Ignore storage read errors in restricted contexts.
  }
}

function persistStorageCache() {
  try {
    if (typeof localStorage === 'undefined') return;
    const obj: Record<string, number> = {};
    for (const [k, v] of memoryDistanceCache.entries()) {
      obj[k] = v;
    }
    localStorage.setItem(ROUTE_CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore storage write errors.
  }
}

export function buildCanonicalRouteCacheKey(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): string {
  return `${startLat.toFixed(5)},${startLng.toFixed(5)}->${endLat.toFixed(5)},${endLng.toFixed(5)}`;
}

export function buildSpotStationCacheKey(
  spotLat: number,
  spotLng: number,
  stationName?: string | null,
): string | null {
  const stationKey = normalizeStationKey(stationName);
  if (!stationKey) return null;
  return `${spotLat.toFixed(4)},${spotLng.toFixed(4)}->${stationKey}`;
}

export function getCachedCanonicalRouteDistanceMeters(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  stationName?: string | null,
): number | null {
  ensureStorageCacheLoaded();
  const coordKey = buildCanonicalRouteCacheKey(startLat, startLng, endLat, endLng);
  const byCoords = memoryDistanceCache.get(coordKey);
  if (typeof byCoords === 'number' && byCoords > 0) return byCoords;

  const stationKey = buildSpotStationCacheKey(startLat, startLng, stationName);
  if (stationKey) {
    const byStation = memoryDistanceCache.get(stationKey);
    if (typeof byStation === 'number' && byStation > 0) return byStation;
  }
  return null;
}

export function setCachedCanonicalRouteDistanceMeters(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  distanceMeters: number,
  stationName?: string | null,
): void {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return;
  ensureStorageCacheLoaded();
  const rounded = Math.round(distanceMeters);
  const coordKey = buildCanonicalRouteCacheKey(startLat, startLng, endLat, endLng);
  if (!PRECOMPUTED_STATION_WALK_METERS[coordKey]) {
    memoryDistanceCache.set(coordKey, rounded);
  }
  const stationKey = buildSpotStationCacheKey(startLat, startLng, stationName);
  if (stationKey && !PRECOMPUTED_STATION_WALK_METERS[stationKey]) {
    memoryDistanceCache.set(stationKey, rounded);
  }
  persistStorageCache();
}

/**
 * Strips RapidKL line prefixes (e.g. "KJ31 ", "AG13 ") and mode suffixes ("LRT", "MRT", "Station").
 */
export function cleanStationDisplayName(rawName?: string | null): string {
  if (!rawName) return '';
  return String(rawName)
    .replace(/^(?:(?:AG|SP|KJ|KG|PY|MR|SA|KT|KB|KC|KA|KD|BRT|SBK|KGL|KEL)\d*\s*)+/i, '')
    .replace(/\s+(?:LRT|MRT|Monorail|BRT|Komuter|Station|Stesen)$/i, '')
    .trim();
}

/**
 * Normalized lowercase alphanumeric key so "USJ 7", "USJ7", and "KJ31 USJ7" all map to "usj7".
 */
export function normalizeStationKey(rawName?: string | null): string {
  return cleanStationDisplayName(rawName)
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

/**
 * Resolves the canonical station coordinates for a station name so that CommuterBrowseView,
 * CommuterMap, ParkingDetail (getWalkingRoute), and Station Route (planMultimodalJourney)
 * all route to the exact same destination coordinates.
 */
export function resolveCanonicalStation(
  stationName?: string | null,
  originCoords?: { lat: number; lng: number } | null,
  explicitStationCoords?: { lat?: number | null; lng?: number | null; lon?: number | null } | null,
): CanonicalStationInfo | null {
  const targetKey = normalizeStationKey(stationName);

  if (targetKey && CANONICAL_STATION_OVERRIDES[targetKey]) {
    return CANONICAL_STATION_OVERRIDES[targetKey];
  }

  const features = ((stationData as any)?.features || []) as any[];
  if (targetKey) {
    let bestMatch: (CanonicalStationInfo & { dist: number; isExact: boolean }) | null = null;

    for (const f of features) {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const rawName = String(f.properties?.name || f.properties?.['name:en'] || '');
      const key = normalizeStationKey(rawName);
      if (!key) continue;

      const isExact = key === targetKey;
      const isPartial = !isExact && (key.includes(targetKey) || targetKey.includes(key));
      if (!isExact && !isPartial) continue;

      const sLat = Number(coords[1]);
      const sLng = Number(coords[0]);
      if (!Number.isFinite(sLat) || !Number.isFinite(sLng)) continue;

      const dist =
        originCoords && originCoords.lat && originCoords.lng
          ? haversineDistanceMeters(originCoords.lat, originCoords.lng, sLat, sLng)
          : 0;

      if (
        !bestMatch ||
        (isExact && !bestMatch.isExact) ||
        (isExact === bestMatch.isExact && dist < bestMatch.dist)
      ) {
        bestMatch = {
          name: cleanStationDisplayName(rawName) || String(stationName || '').trim(),
          code: String(f.properties?.ref || ''),
          lat: sLat,
          lng: sLng,
          dist,
          isExact,
        };
      }
    }

    if (bestMatch) {
      return {
        name: bestMatch.name,
        code: bestMatch.code,
        lat: bestMatch.lat,
        lng: bestMatch.lng,
      };
    }
  }

  const expLat = Number(explicitStationCoords?.lat ?? 0);
  const expLng = Number(explicitStationCoords?.lng ?? explicitStationCoords?.lon ?? 0);
  if (
    Number.isFinite(expLat) &&
    Number.isFinite(expLng) &&
    (expLat !== 0 || expLng !== 0) &&
    Math.abs(expLat) <= 90 &&
    Math.abs(expLng) <= 180
  ) {
    return {
      name: cleanStationDisplayName(stationName) || 'Transit Station',
      code: 'STN',
      lat: expLat,
      lng: expLng,
    };
  }

  return null;
}

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
 * Formula:
 * - Base walking speed: 4.8 km/h = 1.3333 m/s = 80 m/min (12.5 min/km).
 * - Station entrance concourse buffer (when isStationDestination = true): 45 seconds (0.75 min).
 * - Total minutes = Math.max(1, Math.round((distanceMeters / 1.3333 + bufferSeconds) / 60)).
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
 * Deterministically resolves a parking spot's walking distance and walking time to its transit station.
 * Prevents device-location pollution from `/api/parking/nearby` (e.g. 251 min walk from KL center)
 * and reverse-OSRM discrepancies (e.g. 26 min vs 18 min for M Vertica), ensuring all devices
 * and all views (Browse card, Map, Detail header, and Station Route tab) tally 100%.
 */
export function resolveSpotStationWalkMetrics(params: {
  latitude?: number | null;
  longitude?: number | null;
  stationName?: string | null;
  stationLatitude?: number | null;
  stationLongitude?: number | null;
  rawDistanceToStationKm?: number | null;
  rawDistanceToStationMeters?: number | null;
  rawTimeToStationInMinutes?: number | null;
}): {
  distanceToStationKm: number;
  distanceToStationMeters: number;
  timeToStationInMinutes: number;
  stationCoords: { lat: number; lng: number } | null;
} {
  const lat = Number(params.latitude ?? 0);
  const lng = Number(params.longitude ?? 0);
  const hasSpotCoords =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    (lat !== 0 || lng !== 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  const station = resolveCanonicalStation(
    params.stationName,
    hasSpotCoords ? { lat, lng } : null,
    { lat: params.stationLatitude, lng: params.stationLongitude },
  );

  if (hasSpotCoords && station) {
    const cachedMeters = getCachedCanonicalRouteDistanceMeters(
      lat,
      lng,
      station.lat,
      station.lng,
      params.stationName,
    );
    if (cachedMeters !== null && cachedMeters > 0) {
      const distanceMeters = Math.round(cachedMeters);
      return {
        distanceToStationKm: Number((distanceMeters / 1000).toFixed(2)),
        distanceToStationMeters: distanceMeters,
        timeToStationInMinutes: calculateWalkingMinutes(distanceMeters, { isStationDestination: true }),
        stationCoords: { lat: station.lat, lng: station.lng },
      };
    }

    const straightMeters = haversineDistanceMeters(lat, lng, station.lat, station.lng);
    let candidateMeters = 0;
    if (
      typeof params.rawDistanceToStationMeters === 'number' &&
      Number.isFinite(params.rawDistanceToStationMeters) &&
      params.rawDistanceToStationMeters > 0
    ) {
      // Handle wire ambiguity where `distanceToStation` (in km, e.g. 2.08) was read into `distanceToStationMeters`
      candidateMeters =
        params.rawDistanceToStationMeters < 35 && straightMeters > 80
          ? Math.round(params.rawDistanceToStationMeters * 1000)
          : Math.round(params.rawDistanceToStationMeters);
    } else if (
      typeof params.rawDistanceToStationKm === 'number' &&
      Number.isFinite(params.rawDistanceToStationKm) &&
      params.rawDistanceToStationKm > 0
    ) {
      candidateMeters = Math.round(params.rawDistanceToStationKm * 1000);
    }

    // Reject distances polluted by user-location `/parking/nearby` (e.g. 20.02 km from KL center to USJ One Avenue)
    const minPlausible = Math.max(50, Math.round(straightMeters * 0.9));
    const maxPlausible = Math.max(straightMeters * 2.6, straightMeters + 1200);
    const distanceMeters =
      candidateMeters >= minPlausible && candidateMeters <= maxPlausible
        ? candidateMeters
        : estimateNetworkWalkingDistanceMeters(straightMeters);

    return {
      distanceToStationKm: Number((distanceMeters / 1000).toFixed(2)),
      distanceToStationMeters: distanceMeters,
      timeToStationInMinutes: calculateWalkingMinutes(distanceMeters, { isStationDestination: true }),
      stationCoords: { lat: station.lat, lng: station.lng },
    };
  }

  // Fallback when coordinates or station lookup are unavailable
  let fallbackMeters = 0;
  if (
    typeof params.rawDistanceToStationMeters === 'number' &&
    Number.isFinite(params.rawDistanceToStationMeters) &&
    params.rawDistanceToStationMeters > 0
  ) {
    fallbackMeters =
      params.rawDistanceToStationMeters < 35
        ? Math.round(params.rawDistanceToStationMeters * 1000)
        : Math.round(params.rawDistanceToStationMeters);
  } else if (
    typeof params.rawDistanceToStationKm === 'number' &&
    Number.isFinite(params.rawDistanceToStationKm) &&
    params.rawDistanceToStationKm > 0
  ) {
    fallbackMeters = Math.round(params.rawDistanceToStationKm * 1000);
  }

  const fallbackMinutes =
    fallbackMeters > 0
      ? calculateWalkingMinutes(fallbackMeters, { isStationDestination: true })
      : typeof params.rawTimeToStationInMinutes === 'number' && params.rawTimeToStationInMinutes > 0
      ? Math.round(params.rawTimeToStationInMinutes)
      : 0;

  return {
    distanceToStationKm: Number((fallbackMeters / 1000).toFixed(2)),
    distanceToStationMeters: fallbackMeters,
    timeToStationInMinutes: fallbackMinutes,
    stationCoords: station ? { lat: station.lat, lng: station.lng } : null,
  };
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
