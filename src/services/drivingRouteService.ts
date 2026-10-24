/**
 * drivingRouteService.ts
 * Computes road driving routes from user's current GPS location to a designated parking spot
 * using OSRM driving profile, with turn-by-turn steps, geometry polylines, and navigation deep links (Google Maps / Waze).
 */

export interface DrivingStep {
  instruction: string;
  distanceMeters: number;
  durationMinutes: number;
  streetName?: string;
  maneuverType?: string;
  modifier?: string;
}

export interface DrivingRouteResult {
  origin: {
    lat: number;
    lng: number;
    name?: string;
  };
  destination: {
    lat: number;
    lng: number;
    name: string;
    address?: string;
  };
  distanceMeters: number;
  distanceText: string;
  durationMinutes: number;
  durationText: string;
  geometry: [number, number][]; // [lat, lng] array ready for Leaflet Polyline
  bounds: [[number, number], [number, number]];
  steps: DrivingStep[];
  googleMapsUrl: string;
  wazeUrl: string;
}

const haversineDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDistance = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
};

const formatDuration = (minutes: number): string => {
  if (minutes < 1) return '< 1 min';
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
  }
  return `${Math.round(minutes)} min`;
};

export const getGoogleMapsDrivingUrl = (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): string => {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
};

export const getWazeDrivingUrl = (destination: {
  lat: number;
  lng: number;
}): string => {
  return `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;
};

/**
 * Calculates a driving route between the user's location and the parking bay.
 */
export async function calculateDrivingRoute(
  origin: { lat: number; lng: number; name?: string },
  destination: { lat: number; lng: number; name: string; address?: string }
): Promise<DrivingRouteResult> {
  const googleMapsUrl = getGoogleMapsDrivingUrl(origin, destination);
  const wazeUrl = getWazeDrivingUrl(destination);

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const rawCoords: [number, number][] = route.geometry.coordinates; // [lng, lat]
        const geometry: [number, number][] = rawCoords.map(([lng, lat]) => [
          lat,
          lng,
        ]);

        const distanceMeters = Math.round(route.distance);
        const durationMinutes = Math.max(1, Math.round(route.duration / 60));

        // Parse turn-by-turn driving steps
        const steps: DrivingStep[] = [];
        if (route.legs && route.legs.length > 0) {
          for (const leg of route.legs) {
            for (const step of leg.steps || []) {
              const maneuver = step.maneuver || {};
              const street = step.name ? step.name : '';
              let instruction = '';

              switch (maneuver.type) {
                case 'depart':
                  instruction = street
                    ? `Head ${maneuver.modifier || 'forward'} on ${street}`
                    : 'Start driving from current location';
                  break;
                case 'turn':
                  instruction = `Turn ${maneuver.modifier || ''} ${
                    street ? `onto ${street}` : ''
                  }`.trim();
                  break;
                case 'merge':
                  instruction = `Merge ${maneuver.modifier || ''} ${
                    street ? `onto ${street}` : ''
                  }`.trim();
                  break;
                case 'on ramp':
                  instruction = `Take ramp ${
                    street ? `onto ${street}` : ''
                  }`.trim();
                  break;
                case 'off ramp':
                  instruction = `Take exit ${
                    street ? `toward ${street}` : ''
                  }`.trim();
                  break;
                case 'fork':
                  instruction = `Keep ${maneuver.modifier || 'right'} ${
                    street ? `onto ${street}` : ''
                  }`.trim();
                  break;
                case 'roundabout':
                case 'rotary':
                  instruction = `Enter roundabout and take exit ${
                    maneuver.exit || 1
                  } ${street ? `onto ${street}` : ''}`.trim();
                  break;
                case 'arrive':
                  instruction = `Arrive at ${destination.name}`;
                  break;
                default:
                  instruction = street
                    ? `Continue on ${street}`
                    : 'Continue along route';
                  break;
              }

              steps.push({
                instruction,
                distanceMeters: Math.round(step.distance),
                durationMinutes: Math.max(
                  0.5,
                  Math.round((step.duration / 60) * 10) / 10
                ),
                streetName: street,
                maneuverType: maneuver.type,
                modifier: maneuver.modifier,
              });
            }
          }
        }

        // Compute bounding box
        let minLat = Math.min(origin.lat, destination.lat);
        let maxLat = Math.max(origin.lat, destination.lat);
        let minLng = Math.min(origin.lng, destination.lng);
        let maxLng = Math.max(origin.lng, destination.lng);

        geometry.forEach(([lat, lng]) => {
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        });

        return {
          origin,
          destination,
          distanceMeters,
          distanceText: formatDistance(distanceMeters),
          durationMinutes,
          durationText: formatDuration(durationMinutes),
          geometry,
          bounds: [
            [minLat, minLng],
            [maxLat, maxLng],
          ],
          steps: steps.length > 0 ? steps : createFallbackSteps(origin, destination, distanceMeters, durationMinutes),
          googleMapsUrl,
          wazeUrl,
        };
      }
    }
  } catch (err) {
    console.warn('[DrivingRoute] OSRM driving API request failed or timed out, using fallback estimation:', err);
  }

  // Fallback estimation using urban road factor
  const straightMeters = haversineDistanceMeters(
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng
  );
  const roadDistanceMeters = Math.round(straightMeters * 1.35); // standard urban road factor
  // Average urban speed ~32 km/h (Klang valley traffic)
  const durationMinutes = Math.max(2, Math.round((roadDistanceMeters / 1000 / 32) * 60));

  // Generate intermediate road-like curvature points
  const midLat = (origin.lat + destination.lat) / 2 + (destination.lng - origin.lng) * 0.05;
  const midLng = (origin.lng + destination.lng) / 2 - (destination.lat - origin.lat) * 0.05;
  const geometry: [number, number][] = [
    [origin.lat, origin.lng],
    [midLat, midLng],
    [destination.lat, destination.lng],
  ];

  const minLat = Math.min(origin.lat, midLat, destination.lat);
  const maxLat = Math.max(origin.lat, midLat, destination.lat);
  const minLng = Math.min(origin.lng, midLng, destination.lng);
  const maxLng = Math.max(origin.lng, midLng, destination.lng);

  return {
    origin,
    destination,
    distanceMeters: roadDistanceMeters,
    distanceText: formatDistance(roadDistanceMeters),
    durationMinutes,
    durationText: formatDuration(durationMinutes),
    geometry,
    bounds: [
      [minLat, minLng],
      [maxLat, maxLng],
    ],
    steps: createFallbackSteps(origin, destination, roadDistanceMeters, durationMinutes),
    googleMapsUrl,
    wazeUrl,
  };
}

function createFallbackSteps(
  origin: { lat: number; lng: number; name?: string },
  destination: { name: string; address?: string },
  distanceMeters: number,
  durationMinutes: number
): DrivingStep[] {
  return [
    {
      instruction: `Depart from ${origin.name || 'current location'} toward main road`,
      distanceMeters: Math.round(distanceMeters * 0.2),
      durationMinutes: Math.max(1, Math.round(durationMinutes * 0.2)),
    },
    {
      instruction: 'Follow main expressway / arterial road toward destination',
      distanceMeters: Math.round(distanceMeters * 0.6),
      durationMinutes: Math.max(1, Math.round(durationMinutes * 0.6)),
    },
    {
      instruction: `Turn into ${destination.address || destination.name} access gate and park at reserved bay`,
      distanceMeters: Math.round(distanceMeters * 0.2),
      durationMinutes: Math.max(1, Math.round(durationMinutes * 0.2)),
    },
  ];
}
