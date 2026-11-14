import type { PublicParkingLot } from '@/features/publicParking/types';
import type { ParkingSpot } from '../types';
import { fuzzyFilterSpots } from './fuzzySearch';

export type RealCategory =
  | 'transit'
  | 'covered'
  | 'ev'
  | 'cctv'
  | 'monthly'
  | 'accessible';

export type ListingScope = 'all' | 'private' | 'public';
export type RatePlanFilter = 'all' | 'daily' | 'monthly';
export type BrowseSortBy = 'latest' | 'nearby' | 'popular';

export interface BrowseFiltersState {
  listingScope: ListingScope;
  categories: RealCategory[];
  ratePlan: RatePlanFilter;
  minDailyRate: number | null;
  maxDailyRate: number | null;
  maxStationDistanceKm: number | null;
}

export const DEFAULT_BROWSE_FILTERS: BrowseFiltersState = {
  listingScope: 'all',
  categories: [],
  ratePlan: 'all',
  minDailyRate: null,
  maxDailyRate: null,
  maxStationDistanceKm: null,
};

export const CATEGORY_FILTER_OPTIONS: Array<{
  id: 'all' | RealCategory;
  label: string;
}> = [
  { id: 'all', label: 'All Bays' },
  { id: 'transit', label: 'Near Transit' },
  { id: 'covered', label: 'Covered' },
  { id: 'ev', label: 'EV Charging' },
  { id: 'cctv', label: 'CCTV Security' },
  { id: 'monthly', label: 'Monthly Pass' },
  { id: 'accessible', label: 'Accessible' },
];

export const CATEGORY_LABELS: Record<RealCategory, string> = {
  transit: 'Near Transit',
  covered: 'Covered',
  ev: 'EV Charging',
  cctv: 'CCTV Security',
  monthly: 'Monthly Pass',
  accessible: 'Accessible',
};

export function getEffectiveDailyRate(spot: ParkingSpot): number | null {
  if (spot.dailyRate !== null && Number.isFinite(spot.dailyRate)) {
    return spot.dailyRate;
  }
  if (spot.monthlyRate > 0 && Number.isFinite(spot.monthlyRate)) {
    return spot.monthlyRate / 30;
  }
  return null;
}

export function getEffectiveStationDistanceKm(spot: ParkingSpot): number | null {
  if (typeof spot.distanceToStation === 'number' && spot.distanceToStation > 0) {
    return spot.distanceToStation;
  }
  if (typeof spot.distance === 'number' && spot.distance > 0) {
    return spot.distance / 1000;
  }
  return null;
}

export function matchesBrowseSpotFilters(
  spot: ParkingSpot,
  filters: BrowseFiltersState,
): boolean {
  if (filters.listingScope === 'public') return false;

  for (const cat of filters.categories) {
    if (
      cat === 'transit' &&
      !(spot.stationName && (spot.distanceToStation > 0 || spot.timeToStationInMinutes > 0))
    ) {
      return false;
    }
    if (cat === 'covered' && !spot.isCovered) return false;
    if (cat === 'ev' && !spot.hasEvCharging) return false;
    if (cat === 'cctv' && !spot.hasCctv) return false;
    if (cat === 'monthly' && !(spot.monthlyRate > 0)) return false;
    if (cat === 'accessible' && !spot.isHandicapAccessible) return false;
  }

  if (filters.ratePlan === 'daily' && spot.dailyRate === null) return false;
  if (filters.ratePlan === 'monthly' && !(spot.monthlyRate > 0)) return false;

  if (filters.minDailyRate !== null || filters.maxDailyRate !== null) {
    const rate = getEffectiveDailyRate(spot);
    if (rate === null) return false;
    if (filters.minDailyRate !== null && rate < filters.minDailyRate) return false;
    if (filters.maxDailyRate !== null && rate > filters.maxDailyRate) return false;
  }

  if (filters.maxStationDistanceKm !== null) {
    const distKm = getEffectiveStationDistanceKm(spot);
    if (distKm === null || distKm > filters.maxStationDistanceKm) return false;
  }

  return true;
}

export function matchesPublicLotFilters(
  lot: PublicParkingLot,
  filters: BrowseFiltersState,
  query: string,
): boolean {
  if (filters.listingScope === 'private') return false;

  // Private-bay-specific amenities/monthly pass are not carried on public drive-in lots.
  const hasPrivateOnlyCategory = filters.categories.some((c) => c !== 'transit');
  if (hasPrivateOnlyCategory) return false;
  if (filters.ratePlan === 'monthly') return false;

  if (filters.categories.includes('transit') && !lot.nearestStationName) {
    return false;
  }

  if (filters.maxStationDistanceKm !== null) {
    if (lot.distanceToStation == null || lot.distanceToStation / 1000 > filters.maxStationDistanceKm) {
      return false;
    }
  }

  if (filters.minDailyRate !== null || filters.maxDailyRate !== null) {
    const estDaily = lot.dailyCapRate ?? lot.flatRatePerEntry ?? lot.hourlyRate * 8;
    if (filters.minDailyRate !== null && estDaily < filters.minDailyRate) return false;
    if (filters.maxDailyRate !== null && estDaily > filters.maxDailyRate) return false;
  }

  const q = query.trim().toLowerCase();
  if (q) {
    const matchesText =
      lot.lotName.toLowerCase().includes(q) ||
      lot.address.toLowerCase().includes(q) ||
      (lot.nearestStationName && lot.nearestStationName.toLowerCase().includes(q));
    if (!matchesText) return false;
  }

  return true;
}

export function filterSpotsWithQuery(
  spots: ParkingSpot[],
  filters: BrowseFiltersState,
  query: string,
): ParkingSpot[] {
  const q = query.trim();
  const base = q ? fuzzyFilterSpots(spots, q) : spots;
  return base.filter((spot) => matchesBrowseSpotFilters(spot, filters));
}

export function countActiveBrowseFilters(
  filters: BrowseFiltersState,
  searchQuery: string,
  hasSearchMeta: boolean,
): number {
  let count = filters.categories.length;
  if (filters.listingScope !== 'all') count += 1;
  if (filters.ratePlan !== 'all') count += 1;
  if (filters.minDailyRate !== null || filters.maxDailyRate !== null) count += 1;
  if (filters.maxStationDistanceKm !== null) count += 1;
  if (searchQuery.trim() !== '' || hasSearchMeta) count += 1;
  return count;
}

export function sortBrowseSpots(
  spots: ParkingSpot[],
  sortBy: BrowseSortBy,
  options: {
    currentLocation: { lat: number; lng: number } | null;
    spotRatings: Record<number, { averageRating: number; totalCount: number }>;
    distanceKmFn: (origin: { lat: number; lng: number }, spot: ParkingSpot) => number;
  },
): ParkingSpot[] {
  const copy = [...spots];
  if (sortBy === 'nearby') {
    return copy.sort((a, b) => {
      const distA = options.currentLocation
        ? options.distanceKmFn(options.currentLocation, a)
        : (getEffectiveStationDistanceKm(a) ?? 999);
      const distB = options.currentLocation
        ? options.distanceKmFn(options.currentLocation, b)
        : (getEffectiveStationDistanceKm(b) ?? 999);
      return distA - distB;
    });
  }
  if (sortBy === 'popular') {
    return copy.sort((a, b) => {
      const ratingA = options.spotRatings[a.parkingSpotId]?.averageRating ?? a.averageRating ?? 0;
      const ratingB = options.spotRatings[b.parkingSpotId]?.averageRating ?? b.averageRating ?? 0;
      if (ratingB !== ratingA) return ratingB - ratingA;
      const countA = options.spotRatings[a.parkingSpotId]?.totalCount ?? a.totalReviews ?? 0;
      const countB = options.spotRatings[b.parkingSpotId]?.totalCount ?? b.totalReviews ?? 0;
      if (countB !== countA) return countB - countA;
      return b.parkingSpotId - a.parkingSpotId;
    });
  }
  return copy;
}
