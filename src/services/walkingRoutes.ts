import {
  calculateWalkingMinutes,
  estimateNetworkWalkingDistanceMeters,
  formatDistance,
  haversineDistanceMeters,
} from './pedestrianWalkingService';

export interface WalkingRouteInfo {
  distanceText: string;
  durationText: string;
  rawDistance: number;
  durationMinutes?: number;
}

/**
 * Calculates pedestrian walking route distance and duration between two GPS coordinates.
 * Grounded in Google Maps pedestrian standards (4.8 km/h, ~12.5 min/km).
 */
export async function getWalkingRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
): Promise<WalkingRouteInfo | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${startLon},${startLat};${endLon},${endLat}?overview=false`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distance = Math.round(route.distance);
        const durationMinutes = calculateWalkingMinutes(distance, { isStationDestination: true });

        return {
          distanceText: formatDistance(distance),
          durationText: `${durationMinutes} mins walk`,
          rawDistance: distance,
          durationMinutes,
        };
      }
    }
  } catch (error) {
    console.debug('[WalkingRoutes] OSRM route fetch fallback:', error);
  }

  // Robust pedestrian network fallback when routing server is unreachable
  try {
    const directDist = haversineDistanceMeters(startLat, startLon, endLat, endLon);
    const estimatedDistance = estimateNetworkWalkingDistanceMeters(directDist);
    const durationMinutes = calculateWalkingMinutes(estimatedDistance, { isStationDestination: true });

    return {
      distanceText: formatDistance(estimatedDistance),
      durationText: `${durationMinutes} mins walk`,
      rawDistance: estimatedDistance,
      durationMinutes,
    };
  } catch (err) {
    console.error('[WalkingRoutes] Calculation error:', err);
    return null;
  }
}
