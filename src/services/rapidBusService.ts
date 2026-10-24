import rapidBusRoutesData from '@/features/commuter/data/rapid_bus_routes.json';

export interface RapidBusStop {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
}

export interface RapidBusRoute {
  routeId: string;
  shortName: string;
  longName: string;
  color: string;
  shapeId: string | null;
  coordinates: [number, number][]; // [lat, lon]
  stops: RapidBusStop[];
  connectedStations: string[];
}

export interface ConnectingBusRouteResult {
  route: RapidBusRoute;
  distanceToSpotMeters: number;
  distanceToStationMeters: number;
  nearestStopToSpot: {
    stop: RapidBusStop;
    distanceMeters: number;
  } | null;
  nearestStopToStation: {
    stop: RapidBusStop;
    distanceMeters: number;
  } | null;
}

// Haversine distance in meters
export function distanceMetersBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

const allRoutes: RapidBusRoute[] = rapidBusRoutesData as RapidBusRoute[];

/**
 * Get all available Rapid Bus KL routes from static GTFS.
 */
export function getAllRapidBusRoutes(): RapidBusRoute[] {
  return allRoutes;
}

/**
 * Normalizes a bus route code (e.g. 'T155 INBOUND' -> 'T155', 'T406B' -> 'T406', 'U3000' -> '300')
 */
export function normalizeBusRouteCode(code?: string | null): string {
  if (!code) return '';
  return code
    .trim()
    .toUpperCase()
    .replace(/\s+(INBOUND|OUTBOUND|LOOP|A|B)$/i, '')
    .replace(/^([A-Z]\d{3})B$/i, '$1')
    .trim();
}

/**
 * Lookup a Rapid Bus KL or MRT Feeder route by its short name (e.g. 'T401', 'T780', '770', '300') or routeId.
 */
export function getRapidBusRoute(shortNameOrId?: string | null): RapidBusRoute | null {
  if (!shortNameOrId) return null;
  const target = shortNameOrId.trim().toUpperCase();

  // 1. Exact match on shortName or routeId
  const exact = allRoutes.find(
    (r) => r.shortName.toUpperCase() === target || r.routeId.toUpperCase() === target,
  );
  if (exact) return exact;

  // 2. Normalized match (handles 'T155 INBOUND' -> 'T155', 'T406B' -> 'T406', etc.)
  const normTarget = normalizeBusRouteCode(target);
  if (!normTarget) return null;

  return (
    allRoutes.find(
      (r) =>
        normalizeBusRouteCode(r.shortName) === normTarget ||
        normalizeBusRouteCode(r.routeId) === normTarget ||
        r.shortName.toUpperCase().startsWith(normTarget) ||
        normTarget.startsWith(r.shortName.toUpperCase()),
    ) || null
  );
}

/**
 * Finds Rapid Bus KL routes that pass within walking distance of a parking spot
 * and connect to the specified transit station.
 */
export function findConnectingBusRoutes(
  spotCoords: { lat: number; lng: number },
  stationCoords?: { lat: number; lng: number } | null,
  stationName?: string | null,
  maxSpotDistanceMeters = 700,
  maxStationDistanceMeters = 700,
): ConnectingBusRouteResult[] {
  const results: ConnectingBusRouteResult[] = [];

  for (const route of allRoutes) {
    if (!route.coordinates || route.coordinates.length === 0) continue;

    // 1. Calculate minimum distance from parking spot to route coordinates
    let minSpotDist = Infinity;
    for (const [pLat, pLon] of route.coordinates) {
      const d = distanceMetersBetween(spotCoords.lat, spotCoords.lng, pLat, pLon);
      if (d < minSpotDist) minSpotDist = d;
    }

    if (minSpotDist > maxSpotDistanceMeters) continue;

    // 2. Check if route connects to or passes near the station
    let minStationDist = Infinity;
    if (stationCoords) {
      for (const [pLat, pLon] of route.coordinates) {
        const d = distanceMetersBetween(stationCoords.lat, stationCoords.lng, pLat, pLon);
        if (d < minStationDist) minStationDist = d;
      }
    }

    // Also check station name match in longName or connectedStations
    const nameMatch =
      stationName &&
      (route.longName.toUpperCase().includes(stationName.toUpperCase()) ||
        route.connectedStations.some((s) => stationName.toUpperCase().includes(s)));

    // Must be near station OR match station name
    if (stationCoords && minStationDist > maxStationDistanceMeters && !nameMatch) {
      continue;
    }

    // 3. Find closest bus stops to parking spot and station
    let nearestStopToSpot: { stop: RapidBusStop; distanceMeters: number } | null = null;
    let nearestStopToStation: { stop: RapidBusStop; distanceMeters: number } | null = null;

    if (route.stops && route.stops.length > 0) {
      let closestSpotStopDist = Infinity;
      let closestStationStopDist = Infinity;

      for (const stop of route.stops) {
        const dSpot = distanceMetersBetween(spotCoords.lat, spotCoords.lng, stop.lat, stop.lon);
        if (dSpot < closestSpotStopDist) {
          closestSpotStopDist = dSpot;
          nearestStopToSpot = { stop, distanceMeters: Math.round(dSpot) };
        }

        if (stationCoords) {
          const dStation = distanceMetersBetween(stationCoords.lat, stationCoords.lng, stop.lat, stop.lon);
          if (dStation < closestStationStopDist) {
            closestStationStopDist = dStation;
            nearestStopToStation = { stop, distanceMeters: Math.round(dStation) };
          }
        }
      }
    }

    results.push({
      route,
      distanceToSpotMeters: Math.round(minSpotDist),
      distanceToStationMeters: Math.round(minStationDist),
      nearestStopToSpot,
      nearestStopToStation,
    });
  }

  // Sort by closest to parking spot
  return results.sort((a, b) => a.distanceToSpotMeters - b.distanceToSpotMeters);
}

/**
 * Finds Rapid Bus KL routes that pass near or serve an LRT/MRT station.
 */
export function findRoutesServingStation(
  stationCoords: { lat: number; lng: number },
  stationName?: string | null,
  maxDistanceMeters = 600,
): RapidBusRoute[] {
  const matched: { route: RapidBusRoute; dist: number }[] = [];

  for (const route of allRoutes) {
    if (!route.coordinates || route.coordinates.length === 0) continue;

    let minDist = Infinity;
    for (const [pLat, pLon] of route.coordinates) {
      const d = distanceMetersBetween(stationCoords.lat, stationCoords.lng, pLat, pLon);
      if (d < minDist) minDist = d;
    }

    const nameMatch =
      stationName &&
      (route.longName.toUpperCase().includes(stationName.toUpperCase()) ||
        route.connectedStations.some((s) => stationName.toUpperCase().includes(s)));

    if (minDist <= maxDistanceMeters || nameMatch) {
      matched.push({ route, dist: minDist });
    }
  }

  return matched.sort((a, b) => a.dist - b.dist).map((m) => m.route);
}
