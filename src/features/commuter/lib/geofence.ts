/**
 * Geofence helpers for the commuter arrival check.
 *
 * The bay coordinates arrive from several wire shapes (camelCase, PascalCase,
 * `lat`/`lng` aliases) and may be missing entirely — `ParkingSpotDetailDTO`
 * does not currently expose them. `0,0` is treated as "unknown" rather than a
 * point in the Atlantic, matching the rule used by `getPublicParkingSpot`.
 */

const EARTH_RADIUS_METERS = 6_371_000;

/**
 * How far from the bay a commuter may be and still unlock. Parking bays sit
 * inside buildings, so GPS error dominates; this is deliberately generous and
 * the server-side access window remains the authoritative check.
 */
export const ARRIVAL_RADIUS_METERS = 150;

export interface Coordinates {
  lat: number;
  lng: number;
}

export function isUsableCoordinate(
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  // 0,0 is the "no location data" sentinel used across the API layer.
  return !(lat === 0 && lng === 0);
}

/**
 * Picks the first usable coordinate pair from the aliases a `ParkingSpot`
 * may carry. Returns null when the bay has no real location on file.
 */
export function resolveSpotCoordinates(spot: {
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
} | null | undefined): Coordinates | null {
  if (!spot) return null;

  const candidates: Array<[number | null | undefined, number | null | undefined]> = [
    [spot.latitude, spot.longitude],
    [spot.lat, spot.lng],
  ];

  for (const [lat, lng] of candidates) {
    if (isUsableCoordinate(lat, lng)) return { lat: lat as number, lng: lng as number };
  }
  return null;
}

/** Great-circle distance in metres between two WGS-84 points. */
export function distanceInMeters(from: Coordinates, to: Coordinates): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * True when the device is close enough to the bay. The tolerance widens with
 * the reported GPS accuracy so an urban canyon fix does not block a real
 * arrival.
 */
export function isWithinArrivalRadius(
  device: Coordinates & { accuracy?: number },
  bay: Coordinates,
  radiusMeters: number = ARRIVAL_RADIUS_METERS,
): { arrived: boolean; distance: number; tolerance: number } {
  const distance = distanceInMeters(device, bay);
  const accuracy = Number.isFinite(device.accuracy) ? Number(device.accuracy) : 0;
  const tolerance = Math.max(radiusMeters, accuracy);
  return { arrived: distance <= tolerance, distance, tolerance };
}
