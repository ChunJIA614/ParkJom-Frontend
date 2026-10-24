import { apiRequest, readApiError } from '@/services/apiClient';

// ============================================================================
// GTFS & Transit API Contracts & Data Types
// ============================================================================

export interface MultilingualNames {
  en?: string;
  zh?: string;
  ms?: string;
  ta?: string;
}

export interface TransitRouteStop {
  stopId: string;
  stopName: string;
  sequence: number;
  latitude: number;
  longitude: number;
}

export interface TransitRoute {
  routeId: string;
  routeName: string;
  shortName: string;
  category: 'LRT' | 'MRT' | 'Monorail' | 'BRT' | string;
  color: string;
  operator: string;
  totalStops: number;
  firstStation: string;
  terminalStation: string;
  operatingHours: string;
  stops?: TransitRouteStop[];
}

export interface TransitStopSummary {
  stopId: string;
  stopName: string;
  routeId: string;
  routeName: string;
  routeColor: string;
  category: string;
  latitude: number;
  longitude: number;
  wheelchairAccessible: boolean;
  multilingualNames: MultilingualNames;
  distanceMeters: number | null;
  walkingTimeMinutes: number | null;
  operatingHours: string;
}

export interface TransitDeparture {
  direction: string;
  destination: string;
  estimatedDeparture: string;
  minutesUntilArrival: number;
  trainType: string;
  subsequentDepartures: string[];
}

export interface TransitStopSchedule {
  stopId: string;
  stopName: string;
  routeId: string;
  routeName: string;
  currentTime: string;
  isOperating: boolean;
  serviceStatus: string;
  isPeakHour: boolean;
  frequencyMinutes: number;
  operatingHours: string;
  firstTrain: string;
  lastTrain: string;
  departures: TransitDeparture[];
}

export interface StationNearbyParkingSpot {
  parkingSpotId: number;
  parkingLabel: string;
  propertyId: number;
  propertyName: string;
  address: string;
  distanceMeters: number;
  walkingTimeMinutes: number;
  dailyRate: number | null;
  monthlyRate: number;
  availabilityStatus: string;
  primaryImageUrl: string | null;
  hasIoTDevice: boolean;
}

export interface StationNearbyParkingData {
  stopId: string;
  stopName: string;
  latitude: number;
  longitude: number;
  searchRadiusMeters: number;
  totalAvailableSpots: number;
  parkingSpots: StationNearbyParkingSpot[];
}

export interface RouteShapeData {
  routeId: string;
  routeName: string;
  routeColor: string;
  coordinates: [number, number][]; // [longitude, latitude]
}

export interface GeoJsonFeature<P = Record<string, unknown>, G = unknown> {
  type: 'Feature';
  properties: P;
  geometry: G;
}

export interface GeoJsonFeatureCollection<T = any> {
  type: 'FeatureCollection';
  features: T[];
}

// In-memory cache to avoid duplicate network roundtrips for static transit topology
let cachedRoutes: TransitRoute[] | null = null;
let cachedLinesGeoJson: GeoJsonFeatureCollection | null = null;
let cachedStopsGeoJson: GeoJsonFeatureCollection | null = null;

// ============================================================================
// Master GTFS Backend API Client Methods (G-01 to G-10)
// ============================================================================

/**
 * G-01: List All Transit Lines
 * GET /api/gtfs/routes
 */
export async function getTransitRoutes(signal?: AbortSignal): Promise<TransitRoute[]> {
  if (cachedRoutes && cachedRoutes.length > 0) {
    return cachedRoutes;
  }

  const response = await apiRequest('/gtfs/routes', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch transit routes.'));
  }

  const payload = await response.json();
  const routes = (payload?.data || []) as TransitRoute[];
  if (routes.length > 0) {
    cachedRoutes = routes;
  }
  return routes;
}

/**
 * G-02: Get Route Details & Ordered Stops
 * GET /api/gtfs/routes/{routeId}
 */
export async function getTransitRouteDetails(
  routeId: string,
  signal?: AbortSignal,
): Promise<TransitRoute> {
  const response = await apiRequest(`/gtfs/routes/${encodeURIComponent(routeId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to fetch route ${routeId} details.`));
  }

  const payload = await response.json();
  return payload?.data as TransitRoute;
}

/**
 * G-03: Get Route Polyline Coordinates
 * GET /api/gtfs/routes/{routeId}/shape
 */
export async function getTransitRouteShape(
  routeId: string,
  signal?: AbortSignal,
): Promise<RouteShapeData> {
  const response = await apiRequest(`/gtfs/routes/${encodeURIComponent(routeId)}/shape`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to fetch shape for route ${routeId}.`));
  }

  const payload = await response.json();
  return payload?.data as RouteShapeData;
}

export interface TransitStopQueryParams {
  line?: string;
  search?: string;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
}

/**
 * G-04: Query & Filter Transit Stops
 * GET /api/gtfs/stops
 */
export async function getTransitStops(
  params?: TransitStopQueryParams,
  signal?: AbortSignal,
): Promise<TransitStopSummary[]> {
  const searchParams = new URLSearchParams();
  if (params?.line) searchParams.set('line', params.line);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.lat !== undefined) searchParams.set('lat', params.lat.toString());
  if (params?.lng !== undefined) searchParams.set('lng', params.lng.toString());
  if (params?.radiusMeters !== undefined) {
    searchParams.set('radiusMeters', params.radiusMeters.toString());
  }

  const qs = searchParams.toString();
  const endpoint = qs ? `/gtfs/stops?${qs}` : '/gtfs/stops';

  const response = await apiRequest(endpoint, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch transit stops.'));
  }

  const payload = await response.json();
  return (payload?.data || []) as TransitStopSummary[];
}

/**
 * G-05: Get Stop Details
 * GET /api/gtfs/stops/{stopId}
 */
export async function getTransitStopDetails(
  stopId: string,
  signal?: AbortSignal,
): Promise<TransitStopSummary> {
  const response = await apiRequest(`/gtfs/stops/${encodeURIComponent(stopId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to fetch stop ${stopId} details.`));
  }

  const payload = await response.json();
  return payload?.data as TransitStopSummary;
}

/**
 * G-06: Fast GPS Station Finder
 * GET /api/gtfs/nearby-stations
 */
export async function getNearbyTransitStations(
  lat: number,
  lng: number,
  radiusMeters = 3000,
  limit = 10,
  signal?: AbortSignal,
): Promise<TransitStopSummary[]> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
    radiusMeters: radiusMeters.toString(),
    limit: limit.toString(),
  });

  const response = await apiRequest(`/gtfs/nearby-stations?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to find nearby transit stations.'));
  }

  const payload = await response.json();
  return (payload?.data || []) as TransitStopSummary[];
}

/**
 * G-07: Live Train Departures & Timetable
 * GET /api/gtfs/stops/{stopId}/schedule
 */
export async function getTransitStopSchedule(
  stopId: string,
  signal?: AbortSignal,
): Promise<TransitStopSchedule> {
  const response = await apiRequest(`/gtfs/stops/${encodeURIComponent(stopId)}/schedule`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to fetch schedule for stop ${stopId}.`));
  }

  const payload = await response.json();
  return payload?.data as TransitStopSchedule;
}

/**
 * G-08: Find Verified Parking Near Transit Station (Core ParkJom Value)
 * GET /api/gtfs/stops/{stopId}/nearby-parking
 */
export async function getTransitStopNearbyParking(
  stopId: string,
  radiusMeters = 1500,
  signal?: AbortSignal,
): Promise<StationNearbyParkingData> {
  const params = new URLSearchParams({
    radiusMeters: radiusMeters.toString(),
  });

  const response = await apiRequest(
    `/gtfs/stops/${encodeURIComponent(stopId)}/nearby-parking?${params.toString()}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(response, `Failed to fetch parking near transit station ${stopId}.`),
    );
  }

  const payload = await response.json();
  return payload?.data as StationNearbyParkingData;
}

/**
 * G-09: Full Klang Valley Rail Lines Layer
 * GET /api/gtfs/geojson/lines
 */
export async function getTransitLinesGeoJson(
  signal?: AbortSignal,
): Promise<GeoJsonFeatureCollection> {
  if (cachedLinesGeoJson) {
    return cachedLinesGeoJson;
  }

  const response = await apiRequest('/gtfs/geojson/lines', {
    method: 'GET',
    headers: { Accept: 'application/geo+json, application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch transit rail lines GeoJSON.'));
  }

  const geoJson = await response.json();
  cachedLinesGeoJson = geoJson;
  return geoJson;
}

/**
 * G-10: Full Klang Valley Rail Stops Layer
 * GET /api/gtfs/geojson/stops
 */
export async function getTransitStopsGeoJson(
  signal?: AbortSignal,
): Promise<GeoJsonFeatureCollection> {
  if (cachedStopsGeoJson) {
    return cachedStopsGeoJson;
  }

  const response = await apiRequest('/gtfs/geojson/stops', {
    method: 'GET',
    headers: { Accept: 'application/geo+json, application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch transit rail stops GeoJSON.'));
  }

  const geoJson = await response.json();
  cachedStopsGeoJson = geoJson;
  return geoJson;
}

// Rapid KL Official Line Brand Colors Reference
export const RAPID_KL_LINE_COLORS: Record<string, { name: string; color: string; badge: string; category: string }> = {
  KJ: { name: 'Kelana Jaya Line', color: '#D50032', badge: 'LRT', category: 'LRT' },
  KJL: { name: 'Kelana Jaya Line', color: '#D50032', badge: 'LRT', category: 'LRT' },
  KG: { name: 'Kajang Line', color: '#047940', badge: 'MRT', category: 'MRT' },
  KGL: { name: 'Kajang Line', color: '#047940', badge: 'MRT', category: 'MRT' },
  PY: { name: 'Putrajaya Line', color: '#FFCD00', badge: 'MRT', category: 'MRT' },
  PYL: { name: 'Putrajaya Line', color: '#FFCD00', badge: 'MRT', category: 'MRT' },
  AG: { name: 'Ampang Line', color: '#E57200', badge: 'LRT', category: 'LRT' },
  AGL: { name: 'Ampang Line', color: '#E57200', badge: 'LRT', category: 'LRT' },
  SP: { name: 'Sri Petaling Line', color: '#76232F', badge: 'LRT', category: 'LRT' },
  SPL: { name: 'Sri Petaling Line', color: '#76232F', badge: 'LRT', category: 'LRT' },
  MR: { name: 'KL Monorail', color: '#84BD00', badge: 'MR', category: 'Monorail' },
  MRL: { name: 'KL Monorail', color: '#84BD00', badge: 'MR', category: 'Monorail' },
  BRT: { name: 'Sunway BRT', color: '#115740', badge: 'BRT', category: 'BRT' },
  SA: { name: 'Shah Alam Line', color: '#FF00FF', badge: 'LRT3', category: 'LRT' },
  SAL: { name: 'Shah Alam Line', color: '#FF00FF', badge: 'LRT3', category: 'LRT' },
};
