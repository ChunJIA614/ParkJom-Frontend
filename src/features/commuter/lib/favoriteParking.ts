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
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(favorites));
  } catch {
    // The API remains authoritative when browser storage is unavailable.
  }
}

export function isParkingFavorite(userId: number, parkingSpotId: number) {
  return loadFavoriteParking(userId).some((spot) => spot.parkingSpotId === parkingSpotId);
}

export function setParkingFavorite(
  userId: number,
  spot: ParkingSpot,
  isFavorite: boolean,
): ParkingSpot[] {
  const current = loadFavoriteParking(userId);
  const withoutSpot = current.filter((favorite) => favorite.parkingSpotId !== spot.parkingSpotId);
  const next = isFavorite ? [spot, ...withoutSpot] : withoutSpot;
  saveFavoriteParking(userId, next);
  return next;
}
