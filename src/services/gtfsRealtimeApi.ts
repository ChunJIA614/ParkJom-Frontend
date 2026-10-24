import { apiRequest, readApiError } from '@/services/apiClient';

// ============================================================================
// GTFS-Realtime Contracts (Data.gov.my Open Telemetry)
// ============================================================================

export interface RealtimeAgency {
  agencyKey: string;
  agencyName: string;
  mode: 'Train' | 'Bus' | string;
  categories: string[];
  description: string;
}

export interface RealtimeVehicle {
  id: string;
  vehicleId: string;
  licensePlate?: string | null;
  label?: string | null;
  tripId?: string | null;
  routeId?: string | null;
  agency: string;
  category?: string | null;
  latitude: number;
  longitude: number;
  bearing?: number | null;
  speedKmh?: number | null;
  odometer?: number | null;
  currentStatus?: string | null;
  stopId?: string | null;
  currentStopSequence?: number | null;
  congestionLevel?: string | null;
  timestamp: string;
  distanceMeters?: number | null;
  estimatedArrivalMinutes?: number | null;
}

export interface RealtimeGeoJsonFeature {
  type: 'Feature';
  properties: RealtimeVehicle;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
}

export interface RealtimeGeoJsonCollection {
  type: 'FeatureCollection';
  properties: {
    agency?: string;
    category?: string;
    totalVehicles?: number;
    updatedAt?: string;
  };
  features: RealtimeGeoJsonFeature[];
}

export interface RealtimeVehiclesResponse {
  code: number;
  success: boolean;
  feedTimestamp?: number;
  updatedAt?: string;
  totalVehicles: number;
  message: string;
  data: RealtimeVehicle[];
}

export interface NearbyRealtimeVehiclesResponse {
  code: number;
  success: boolean;
  totalNearby: number;
  radiusMeters: number;
  message: string;
  data: RealtimeVehicle[];
}

export interface StationFeedersResponse {
  code: number;
  success: boolean;
  stopId: string;
  radiusMeters: number;
  totalApproaching: number;
  message: string;
  data: RealtimeVehicle[];
}

// ============================================================================
// API Calls
// ============================================================================

/**
 * RT-01: List supported Malaysian GTFS-Realtime transit agencies & categories.
 */
export async function getRealtimeAgencies(signal?: AbortSignal): Promise<RealtimeAgency[]> {
  const response = await apiRequest('/gtfs/realtime/agencies', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch GTFS-Realtime agencies.'));
  }

  const result = await response.json();
  return result.data ?? [];
}

/**
 * RT-02: Get live vehicle positions (JSON).
 */
export async function getRealtimeVehicles(
  options?: {
    agency?: string;
    category?: string;
    routeId?: string;
  },
  signal?: AbortSignal,
): Promise<RealtimeVehiclesResponse> {
  const params = new URLSearchParams();
  if (options?.agency) params.set('agency', options.agency);
  if (options?.category) params.set('category', options.category);
  if (options?.routeId) params.set('routeId', options.routeId);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiRequest(`/gtfs/realtime/vehicles${query}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch live vehicle telemetry.'));
  }

  return response.json();
}

/**
 * RT-03: Live vehicles for Leaflet maps (GeoJSON FeatureCollection).
 */
export async function getRealtimeVehiclesGeoJson(
  agency: string = 'prasarana',
  category: string = 'rapid-bus-mrtfeeder',
  signal?: AbortSignal,
): Promise<RealtimeGeoJsonCollection> {
  const params = new URLSearchParams({ agency, category });
  const response = await apiRequest(`/gtfs/realtime/vehicles/geojson?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/geo+json, application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch live vehicle GeoJSON map layer.'));
  }

  return response.json();
}

/**
 * RT-04: Proximity search — live transit vehicles near coordinates (lat, lng).
 */
export async function getNearbyRealtimeVehicles(
  lat: number,
  lng: number,
  radiusMeters: number = 3000,
  agency: string = 'prasarana',
  category: string = 'rapid-bus-mrtfeeder',
  signal?: AbortSignal,
): Promise<NearbyRealtimeVehiclesResponse> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
    radiusMeters: radiusMeters.toString(),
    agency,
    category,
  });

  const response = await apiRequest(`/gtfs/realtime/vehicles/nearby?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to search nearby transit vehicles.'));
  }

  return response.json();
}

/**
 * RT-05: Station approaching MRT feeder buses & connecting trains with distance and countdown.
 */
export async function getStationFeeders(
  stopId: string,
  radiusMeters: number = 3500,
  signal?: AbortSignal,
): Promise<StationFeedersResponse> {
  const params = new URLSearchParams({ radiusMeters: radiusMeters.toString() });
  const response = await apiRequest(`/gtfs/realtime/stops/${encodeURIComponent(stopId)}/feeders?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to load feeder buses for station '${stopId}'.`));
  }

  return response.json();
}
