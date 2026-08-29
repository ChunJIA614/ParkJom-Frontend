import type { ParkingSpot } from '../types';

const storageKey = (userId: number) => `parkjom.commuterFavorites.${userId}`;

export function loadFavoriteParking(userId: number): ParkingSpot[] {
  try {
    const value = window.localStorage.getItem(storageKey(userId));
    if (!value) return [];
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((spot): spot is ParkingSpot => Boolean(
      spot
      && typeof spot === 'object'
      && typeof (spot as ParkingSpot).parkingSpotId === 'number'
      && typeof (spot as ParkingSpot).id === 'string',
    ));
  } catch {
    return [];
  }
}

export function saveFavoriteParking(userId: number, favorites: ParkingSpot[]) {
  window.localStorage.setItem(storageKey(userId), JSON.stringify(favorites));
}

export function isParkingFavorite(userId: number, parkingSpotId: number) {
  return loadFavoriteParking(userId).some((spot) => spot.parkingSpotId === parkingSpotId);
}

export function toggleParkingFavorite(userId: number, spot: ParkingSpot): ParkingSpot[] {
  const current = loadFavoriteParking(userId);
  const exists = current.some((favorite) => favorite.parkingSpotId === spot.parkingSpotId);
  const next = exists
    ? current.filter((favorite) => favorite.parkingSpotId !== spot.parkingSpotId)
    : [spot, ...current];
  saveFavoriteParking(userId, next);
  return next;
}
