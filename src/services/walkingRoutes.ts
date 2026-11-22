import {
  buildCanonicalRouteCacheKey,
  calculateWalkingMinutes,
  estimateNetworkWalkingDistanceMeters,
  formatDistance,
  getCachedCanonicalRouteDistanceMeters,
  haversineDistanceMeters,
  setCachedCanonicalRouteDistanceMeters,
} from './pedestrianWalkingService';

export interface WalkingRouteInfo {
  distanceText: string;
  durationText: string;
  rawDistance: number;
  durationMinutes?: number;
}

const inflightRouteRequests = new Map<string, Promise<WalkingRouteInfo | null>>();

function buildWalkingRouteInfo(distanceMeters: number): WalkingRouteInfo {
  const distance = Math.max(1, Math.round(distanceMeters));
  const durationMinutes = calculateWalkingMinutes(distance, { isStationDestination: true });
  return {
    distanceText: formatDistance(distance),
    durationText: `${durationMinutes} mins walk`,
    rawDistance: distance,
    durationMinutes,
  };
}

/**
 * Calculates pedestrian walking route distance and duration between two GPS coordinates.
 * Grounded in Google Maps pedestrian standards (4.8 km/h, ~12.5 min/km + 45s station entrance buffer)
 * and backed by the canonical station walk cache so all screens and devices tally.
 */
export async function getWalkingRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  stationName?: string | null,
): Promise<WalkingRouteInfo | null> {
  const cachedDistance = getCachedCanonicalRouteDistanceMeters(
    startLat,
    startLon,
    endLat,
    endLon,
    stationName,
  );
  if (cachedDistance !== null && cachedDistance > 0) {
    return buildWalkingRouteInfo(cachedDistance);
  }

  const cacheKey = buildCanonicalRouteCacheKey(startLat, startLon, endLat, endLon);
  const existingRequest = inflightRouteRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const requestPromise = (async (): Promise<WalkingRouteInfo | null> => {
    try {
      const url = `https://router.project-osrm.org/route/v1/foot/${startLon},${startLat};${endLon},${endLat}?overview=false`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distance = Math.round(route.distance);
          setCachedCanonicalRouteDistanceMeters(
            startLat,
            startLon,
            endLat,
            endLon,
            distance,
            stationName,
          );
          return buildWalkingRouteInfo(distance);
        }
      }
    } catch (error) {
      console.debug('[WalkingRoutes] OSRM route fetch fallback:', error);
    }

    try {
      const directDist = haversineDistanceMeters(startLat, startLon, endLat, endLon);
      const estimatedDistance = estimateNetworkWalkingDistanceMeters(directDist);
      return buildWalkingRouteInfo(estimatedDistance);
    } catch (err) {
      console.error('[WalkingRoutes] Calculation error:', err);
      return null;
    } finally {
      inflightRouteRequests.delete(cacheKey);
    }
  })();

  inflightRouteRequests.set(cacheKey, requestPromise);
  return requestPromise;
}
