export interface WalkingRouteInfo {
  distanceText: string;
  durationText: string;
  rawDistance: number;
}

export async function getWalkingRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
): Promise<WalkingRouteInfo | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${startLon},${startLat};${endLon},${endLat}?overview=false`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.code === 'Ok' && data.routes.length > 0) {
      const route = data.routes[0];
      const distance = route.distance;
      return {
        distanceText: distance > 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`,
        durationText: `${Math.round(route.duration / 60)} mins walk`,
        rawDistance: distance,
      };
    }
    throw new Error('No route');
  } catch (error) {
    console.error('OSRM error:', error);
    return null;
  }
}
