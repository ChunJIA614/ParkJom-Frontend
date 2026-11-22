import ParkingPhoto from './ParkingPhoto';
import {
  Accessibility,
  Building2,
  CheckCircle2,
  Heart,
  Layers,
  Loader2,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrainFront,
  X,
  Zap,
} from 'lucide-react';
import type { PublicParkingLot } from '@/features/publicParking/types';
import type { ParkingSpot } from '../types';

type GeoPoint = { lat: number; lng: number };
import { formatShortAddress, formatShortSpotName } from '../lib/formatUtils';
import {
  CATEGORY_LABELS,
  getEffectiveDailyRate,
  LISTING_SCOPE_OPTIONS,
  type BrowseFiltersState,
  type RealCategory,
} from '../lib/browseFilters';

export interface CommuterBrowseViewProps {
  searchQuery: string;
  searchMeta: {
    totalCount: number;
    page: number;
    pageSize: number;
    suggestions?: string[];
    didYouMean?: string | null;
  } | null;
  searchError: string | null;
  browseFilters: BrowseFiltersState;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  filteredBrowseSpots: ParkingSpot[];
  matchingPublicLots: PublicParkingLot[];
  favoriteSpots: ParkingSpot[];
  isFavoritesLoading: boolean;
  isClearingFavorites: boolean;
  favoriteUpdatingIds: number[];
  spotRatings: Record<number, { averageRating: number; totalCount: number }>;
  locationStatus: 'locating' | 'ready' | 'denied' | 'unavailable';
  locationAccuracy: number | null;
  currentLocation: GeoPoint | null;
  distanceFromUser: (origin: GeoPoint, spot: ParkingSpot) => number;
  onOpenSearchSheet: () => void;
  onUpdateFilters: (updater: (prev: BrowseFiltersState) => BrowseFiltersState) => void;
  onClearSearchQuery: () => void;
  onClearAllFilters: () => void;
  onQuickSearchSuggestion: (query: string) => void;
  onRequestLocation: () => void;
  onOpenParkingDetail: (spot: ParkingSpot, stationName?: string) => void;
  onToggleFavorite: (spot: ParkingSpot) => void;
  onInspectPublicLot: (lot: PublicParkingLot) => void;
}

export default function CommuterBrowseView({
  searchQuery,
  searchMeta,
  searchError,
  browseFilters,
  activeFilterCount,
  hasActiveFilters,
  filteredBrowseSpots,
  matchingPublicLots,
  favoriteSpots,
  isFavoritesLoading,
  isClearingFavorites,
  favoriteUpdatingIds,
  spotRatings,
  locationStatus,
  locationAccuracy,
  currentLocation,
  distanceFromUser,
  onOpenSearchSheet,
  onUpdateFilters,
  onClearSearchQuery,
  onClearAllFilters,
  onQuickSearchSuggestion,
  onRequestLocation,
  onOpenParkingDetail,
  onToggleFavorite,
  onInspectPublicLot,
}: CommuterBrowseViewProps) {
  const showPublicSection =
    browseFilters.listingScope !== 'private' && matchingPublicLots.length > 0;
  const showPrivateSection = browseFilters.listingScope !== 'public';
  const totalResultsCount =
    (showPublicSection ? matchingPublicLots.length : 0) +
    (showPrivateSection ? filteredBrowseSpots.length : 0);

  const removeCategory = (cat: RealCategory) => {
    onUpdateFilters((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c !== cat),
    }));
  };

  return (
    <div className="commuter-browse space-y-5 pb-24 md:pb-12">
      <h1 className="commuter-browse__title md:sr-only">Browse parking</h1>
      <div className="commuter-browse__controls max-w-3xl mx-auto space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="commuter-browse__search workspace-panel flex min-w-0 flex-1 items-center">
            <button
              type="button"
              onClick={onOpenSearchSheet}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 text-left"
              aria-label={searchQuery.trim() ? `Edit parking search: ${searchQuery.trim()}` : 'Search for a station or parking'}
              aria-haspopup="dialog"
            >
              <Search size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1 truncate text-sm">{searchQuery.trim() || 'Search station or parking'}</span>
              <SlidersHorizontal size={16} className="commuter-browse__filter-icon shrink-0 text-muted-foreground" aria-hidden="true" />
              {activeFilterCount > 0 && <span className="workspace-status" aria-label={`${activeFilterCount} active filters`}>{activeFilterCount}</span>}
            </button>
            {searchQuery.trim() && (
              <button type="button" onClick={onClearSearchQuery} aria-label="Clear parking search" className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground">
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onRequestLocation}
            disabled={locationStatus === 'locating'}
            title={
              locationStatus === 'ready'
                ? `Using your location (±${Math.round(locationAccuracy ?? 50)}m)`
                : 'Use your location'
            }
            aria-label={locationStatus === 'ready' ? 'Refresh GPS location' : 'Use my location'}
            className={`commuter-browse__location workspace-button workspace-button--secondary size-12 shrink-0 p-0! sm:w-auto sm:px-4! ${
              locationStatus === 'ready'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                : 'bg-white dark:bg-[#1C1C1F] border-black/[0.09] dark:border-white/[0.11] text-[#111111] dark:text-white hover:border-[#007AFF]/45'
            }`}
          >
            {locationStatus === 'locating' ? (
              <Loader2 size={16} className="animate-spin text-[#007AFF]" />
            ) : (
              <Navigation
                size={16}
                className={locationStatus === 'ready' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#007AFF] dark:text-[#0A84FF]'}
              />
            )}
            <span className="hidden sm:inline">
              {locationStatus === 'ready' ? 'Location on' : 'Use my location'}
            </span>
          </button>
        </div>

        <div className="commuter-browse__scope md:hidden" role="group" aria-label="Parking type">
          {LISTING_SCOPE_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={browseFilters.listingScope === id}
              onClick={() => onUpdateFilters((previous) => ({ ...previous, listingScope: id }))}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Dismissible Active Filter Badges (Hidmo-style) */}
        {hasActiveFilters && (
          <div className="commuter-browse__chips flex flex-wrap items-center gap-1.5 pt-0.5">
            {browseFilters.listingScope !== 'all' && (
              <button
                type="button"
                onClick={() =>
                  onUpdateFilters((prev) => ({ ...prev, listingScope: 'all' }))
                }
                className="commuter-browse__scope-chip inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#3894FF] border border-[#007AFF]/20 px-3 py-1 text-[11px] font-semibold hover:bg-[#007AFF]/15 transition-colors cursor-pointer"
              >
                <span>{browseFilters.listingScope === 'private' ? 'Condo Bays' : 'Drive-In Lots'}</span>
                <X size={12} />
              </button>
            )}

            {browseFilters.categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => removeCategory(cat)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#3894FF] border border-[#007AFF]/20 px-3 py-1 text-[11px] font-semibold hover:bg-[#007AFF]/15 transition-colors cursor-pointer"
              >
                <span>{CATEGORY_LABELS[cat]}</span>
                <X size={12} />
              </button>
            ))}

            {browseFilters.ratePlan !== 'all' && (
              <button
                type="button"
                onClick={() =>
                  onUpdateFilters((prev) => ({ ...prev, ratePlan: 'all' }))
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#3894FF] border border-[#007AFF]/20 px-3 py-1 text-[11px] font-semibold hover:bg-[#007AFF]/15 transition-colors cursor-pointer"
              >
                <span>{browseFilters.ratePlan === 'daily' ? 'Daily Pass' : 'Monthly Pass'}</span>
                <X size={12} />
              </button>
            )}

            {(browseFilters.minDailyRate !== null || browseFilters.maxDailyRate !== null) && (
              <button
                type="button"
                onClick={() =>
                  onUpdateFilters((prev) => ({
                    ...prev,
                    minDailyRate: null,
                    maxDailyRate: null,
                  }))
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#3894FF] border border-[#007AFF]/20 px-3 py-1 text-[11px] font-semibold hover:bg-[#007AFF]/15 transition-colors cursor-pointer"
              >
                <span>
                  {browseFilters.minDailyRate !== null && browseFilters.maxDailyRate !== null
                    ? `RM ${browseFilters.minDailyRate}–${browseFilters.maxDailyRate}/day`
                    : browseFilters.maxDailyRate !== null
                      ? `≤ RM ${browseFilters.maxDailyRate}/day`
                      : `RM ${browseFilters.minDailyRate}+/day`}
                </span>
                <X size={12} />
              </button>
            )}

            {browseFilters.maxStationDistanceKm !== null && (
              <button
                type="button"
                onClick={() =>
                  onUpdateFilters((prev) => ({ ...prev, maxStationDistanceKm: null }))
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#3894FF] border border-[#007AFF]/20 px-3 py-1 text-[11px] font-semibold hover:bg-[#007AFF]/15 transition-colors cursor-pointer"
              >
                <span>
                  {browseFilters.maxStationDistanceKm < 1
                    ? `≤ ${Math.round(browseFilters.maxStationDistanceKm * 1000)}m walk`
                    : `≤ ${browseFilters.maxStationDistanceKm} km walk`}
                </span>
                <X size={12} />
              </button>
            )}

            {searchQuery.trim() && (
              <button
                type="button"
                onClick={onClearSearchQuery}
                className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.1] text-[#111111] dark:text-white px-3 py-1 text-[11px] font-semibold hover:bg-black/[0.1] dark:hover:bg-white/[0.15] transition-colors cursor-pointer"
              >
                <span>&ldquo;{searchQuery.trim()}&rdquo;</span>
                <X size={12} />
              </button>
            )}

            <button
              type="button"
              onClick={onClearAllFilters}
              className="px-2 py-1 text-[11px] font-semibold text-[#6E6E73] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white transition-colors cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}

        <p className="commuter-browse__count text-right text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1AA]">
          <span className="md:hidden">{totalResultsCount} {totalResultsCount === 1 ? 'result' : 'results'}</span>
          <span className="hidden md:inline">
            {totalResultsCount} {totalResultsCount === 1 ? 'space' : 'spaces'} available
          </span>
        </p>

        {/* Fuzzy / Related Suggestions from API search */}
        {searchMeta?.suggestions && searchMeta.suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
            <span className="text-[#6E6E73] dark:text-[#A1A1AA] font-medium inline-flex items-center gap-1 shrink-0">
              <Sparkles size={12} className="text-[#007AFF]" />
              Related:
            </span>
            {searchMeta.suggestions.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => onQuickSearchSuggestion(sug)}
                className="px-2.5 py-1 rounded-full bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#3894FF] font-semibold hover:bg-[#007AFF]/15 transition cursor-pointer text-[11px]"
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        {searchError && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 text-[12px] font-medium text-amber-800 dark:text-amber-200">
            {searchError}
          </div>
        )}
      </div>

      {/* ── Empty State ── */}
      {totalResultsCount === 0 ? (
        <div className="commuter-browse__empty bg-white dark:bg-[#1C1C1F] rounded-3xl border border-black/[0.08] dark:border-white/[0.1] p-8 sm:p-12 text-center max-w-xl mx-auto shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#007AFF]/10 text-[#007AFF] dark:text-[#0A84FF] flex items-center justify-center mx-auto mb-3">
            <Search size={26} />
          </div>
          <p className="text-[16px] font-bold text-[#111111] dark:text-white">
            {searchMeta && searchQuery.trim()
              ? `No bays matched "${searchQuery.trim()}"`
              : hasActiveFilters
                ? 'No parking bays match your filters'
                : 'No parking bays loaded yet'}
          </p>
          <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1AA] mt-1 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Try loosening your price or distance filter, or pick a popular rail station area below.'
              : 'Use your location above or pick a popular rail station area below.'}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {['PV128', 'PV18 Residences', 'Wangsa Maju', 'Taman Melati', 'USJ 7', 'M Vertica'].map(
              (pop) => (
                <button
                  key={pop}
                  type="button"
                  onClick={() => onQuickSearchSuggestion(pop)}
                  className="px-3 py-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] text-[#111111] dark:text-white text-[11px] font-semibold transition cursor-pointer"
                >
                  {pop}
                </button>
              ),
            )}
          </div>

          <div className="commuter-browse__empty-actions mt-6 flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onOpenSearchSheet}
              className="px-4 py-2 rounded-full border border-black/[0.1] dark:border-white/[0.15] text-[12px] font-semibold text-[#111111] dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer"
            >
              Adjust filters
            </button>
            <button
              type="button"
              onClick={onClearAllFilters}
              className="px-4 py-2 rounded-full bg-[#007AFF] dark:bg-[#0A84FF] text-white text-[12px] font-semibold hover:bg-[#0066d6] transition cursor-pointer"
            >
              Show all bays
            </button>
          </div>
        </div>
      ) : (
        <div className="commuter-browse__results space-y-8 pt-1">
          {/* ── Public Drive-In Parking Facilities (Hidmo Card Format) ── */}
          {showPublicSection && (
            <section className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[17px] sm:text-xl font-bold tracking-tight text-[#111111] dark:text-white">
                      Public drive-in lots
                    </h2>
                  </div>
                  <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1AA] mt-0.5">
                    Drive in anytime without booking — gate reads your plate automatically.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {matchingPublicLots.map((lot) => {
                  const isFull = lot.availableSpaces <= 0;
                  return (
                    <article key={`browse-pub-${lot.publicParkingLotId}`} className="parking-result workspace-panel">
                      <button type="button" className="parking-result__open" onClick={() => onInspectPublicLot(lot)} aria-label={`View ${lot.lotName}`} />
                      <div className="parking-result__photo">
                        <ParkingPhoto key={lot.facilityPhotoUrl} src={lot.facilityPhotoUrl} />
                        <div className="absolute top-3 left-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/65 text-white backdrop-blur-md">
                            <Layers className="w-3 h-3 text-[#3894FF]" />
                            <span>Drive-In Lot</span>
                          </span>
                        </div>

                        <div className="absolute top-3 right-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold backdrop-blur-md shadow-sm ${
                              isFull
                                ? 'bg-rose-500/90 text-white'
                                : 'bg-emerald-600/90 text-white'
                            }`}
                          >
                            <span>
                              {isFull ? 'FULL' : `${lot.availableSpaces}/${lot.totalCapacity} bays`}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="commuter-browse__card-body p-4 flex-1 flex flex-col justify-between space-y-2.5">
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-[15px] leading-snug text-[#111111] dark:text-white group-hover:text-[#007AFF] transition-colors line-clamp-1">
                              {lot.lotName}
                            </h3>
                            <span className="shrink-0 font-extrabold text-[15px] text-[#111111] dark:text-white whitespace-nowrap">
                              RM {lot.hourlyRate.toFixed(2)}
                              <span className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1AA]">
                                /hr
                              </span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[12px] text-[#6E6E73] dark:text-[#A1A1AA]">
                            <MapPin size={13} className="text-[#007AFF] shrink-0" />
                            <span className="truncate">{lot.address}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {lot.nearestStationName && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-[#3A3A3C] dark:text-[#D4D4D8]">
                              <TrainFront size={12} className="text-[#007AFF]" />
                              {lot.nearestStationName}
                              {lot.distanceToStation ? ` · ${lot.distanceToStation}m` : ''}
                            </span>
                          )}
                          {lot.dailyCapRate != null && lot.dailyCapRate > 0 && (
                            <span className="inline-flex items-center rounded-lg bg-black/[0.04] dark:bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-[#3A3A3C] dark:text-[#D4D4D8]">
                              Cap RM {lot.dailyCapRate.toFixed(0)}/day
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Main Vertical / Responsive Verified Bays Feed (Hidmo-Style Cards) ── */}
          {showPrivateSection && filteredBrowseSpots.length > 0 && (
            <section className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[17px] sm:text-xl font-bold tracking-tight text-[#111111] dark:text-white">
                  {hasActiveFilters ? 'Matching Condo & Verified Bays' : 'Reservable parking'}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {filteredBrowseSpots.map((spot) => {
                  const isSaved = favoriteSpots.some(
                    (f) => f.parkingSpotId === spot.parkingSpotId,
                  );
                  const isFavPending =
                    isFavoritesLoading ||
                    isClearingFavorites ||
                    favoriteUpdatingIds.includes(spot.parkingSpotId);
                  const ratingData = spotRatings[spot.parkingSpotId];
                  const effectiveDaily = getEffectiveDailyRate(spot);
                  const userDistanceKm = currentLocation
                    ? distanceFromUser(currentLocation, spot)
                    : null;
                  const shortTitle =
                    spot.propertyName || formatShortSpotName(spot.name);

                  return (
                    <article key={spot.id} className="parking-result workspace-panel">
                      <button
                        type="button"
                        className="parking-result__open"
                        aria-label={`View parking at ${shortTitle}`}
                        onClick={() => onOpenParkingDetail(spot, spot.stationName || spot.station)}
                      />
                      <div className="parking-result__photo">
                        <ParkingPhoto key={spot.primaryImageUrl} src={spot.primaryImageUrl} />
                        {/* Top-left subtle type badge */}
                        <div className="absolute top-3 left-3 pointer-events-none">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-black/75 text-white px-2.5 py-1 text-sm font-semibold">
                            <CheckCircle2 size={11} className="text-emerald-400" />
                            <span>{spot.type === 'Condo Bay' ? 'Condo Bay' : 'Private Bay'}</span>
                          </span>
                        </div>

                        {/* Top-right Heart button */}
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(spot)}
                          aria-pressed={isSaved}
                          disabled={isFavPending}
                          aria-label={isSaved ? 'Remove from favorites' : 'Save to favorites'}
                          className="absolute top-3 right-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/35 hover:bg-black/55 text-white backdrop-blur-md border border-white/20 transition-all hover:scale-105 active:scale-90 cursor-pointer"
                        >
                          <Heart
                            size={16}
                            strokeWidth={2}
                            className={
                              isSaved ? 'text-rose-500 fill-rose-500' : 'text-white fill-none'
                            }
                          />
                        </button>

                        {/* Bottom-left frosted amenity pills (Hidmo overlay style) */}
                        <div className="commuter-browse__amenities absolute bottom-2.5 left-3 flex flex-wrap items-center gap-1.5 pointer-events-none">
                          {spot.hasEvCharging && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 text-white px-2.5 py-0.5 text-[10px] font-bold backdrop-blur-md">
                              <Zap size={10} /> EV Ready
                            </span>
                          )}
                          {spot.isCovered && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 text-white px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-md">
                              <Building2 size={10} /> Covered
                            </span>
                          )}
                          {spot.hasCctv && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 text-white px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-md">
                              <ShieldCheck size={10} /> CCTV
                            </span>
                          )}
                        </div>

                        {/* Bottom-right rating pill */}
                        <div className="absolute bottom-2.5 right-3 pointer-events-none">
                          <span className="inline-flex items-center gap-1 rounded-full bg-black/65 text-white px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md">
                            <Star
                              size={11}
                              className={
                                ratingData && ratingData.averageRating > 0
                                  ? 'text-[#FF9500] fill-[#FF9500]'
                                  : 'text-white/75'
                              }
                            />
                            <span>
                              {ratingData && ratingData.totalCount > 0 && ratingData.averageRating > 0
                                ? `${ratingData.averageRating.toFixed(1)} (${ratingData.totalCount})`
                                : 'New'}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="commuter-browse__card-body p-4 flex-1 flex flex-col justify-between space-y-2.5">
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2.5">
                            <h3 className="text-[15px] font-bold leading-snug text-[#111111] dark:text-white group-hover:text-[#007AFF] transition-colors line-clamp-1">
                              {shortTitle}
                            </h3>
                            <div className="text-right shrink-0">
                              <span className="text-[15px] font-extrabold text-[#111111] dark:text-white whitespace-nowrap">
                                RM {effectiveDaily !== null ? effectiveDaily.toFixed(2) : '—'}
                                <span className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1AA]">
                                  /day
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[12px] text-[#6E6E73] dark:text-[#A1A1AA] min-w-0">
                              <MapPin size={13} className="text-[#007AFF] dark:text-[#0A84FF] shrink-0" />
                              <span className="truncate">
                                {spot.stationName
                                  ? `Near ${spot.stationName}`
                                  : formatShortAddress(spot.address)}
                              </span>
                            </div>
                            {spot.monthlyRate > 0 && (
                              <span className="text-[11px] font-semibold text-[#007AFF] dark:text-[#3894FF] shrink-0">
                                RM {spot.monthlyRate.toFixed(0)}/mo
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Compact Hidmo-style spec chips */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-[#3A3A3C] dark:text-[#D4D4D8]">
                            <TrainFront size={11} className="text-[#007AFF]" />
                            {spot.timeToStationInMinutes > 0
                              ? `${Math.round(spot.timeToStationInMinutes)} min walk`
                              : 'Walking time unavailable'}
                          </span>

                          {userDistanceKm !== null && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-[#3A3A3C] dark:text-[#D4D4D8]">
                              {userDistanceKm < 1
                                ? `${Math.max(1, Math.round(userDistanceKm * 1000))}m away`
                                : `${userDistanceKm.toFixed(1)}km away`}
                            </span>
                          )}

                          {spot.isHandicapAccessible && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-[#3A3A3C] dark:text-[#D4D4D8]">
                              <Accessibility size={11} className="text-[#007AFF]" /> Accessible
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

    </div>
  );
}
