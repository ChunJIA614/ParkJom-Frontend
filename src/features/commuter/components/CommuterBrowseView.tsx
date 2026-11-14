import {
  Accessibility,
  Building2,
  CheckCircle2,
  Clock,
  Crosshair,
  Heart,
  Layers,
  Loader2,
  Map,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrainFront,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import {
  DEFAULT_PUBLIC_PARKING_PHOTO,
  getPublicLotPhotoUrl,
  type PublicParkingLot,
} from '@/features/publicParking/types';
import type { ParkingSpot } from '../types';

type GeoPoint = { lat: number; lng: number };
import { formatShortAddress, formatShortSpotName } from '../lib/formatUtils';
import {
  CATEGORY_LABELS,
  getEffectiveDailyRate,
  type BrowseFiltersState,
  type BrowseSortBy,
  type RealCategory,
} from '../lib/browseFilters';

const BROWSE_FALLBACK_PHOTOS = [
  'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1621929747188-0b4dc28498d2?auto=format&fit=crop&w=800&q=80',
];

const SORT_TABS: Array<{ id: BrowseSortBy; label: string; icon: typeof Clock }> = [
  { id: 'latest', label: 'Latest', icon: Clock },
  { id: 'nearby', label: 'Nearby', icon: Crosshair },
  { id: 'popular', label: 'Popular', icon: TrendingUp },
];

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
  browseSortBy: BrowseSortBy;
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
  onChangeSort: (sortBy: BrowseSortBy) => void;
  onUpdateFilters: (updater: (prev: BrowseFiltersState) => BrowseFiltersState) => void;
  onClearSearchQuery: () => void;
  onClearAllFilters: () => void;
  onQuickSearchSuggestion: (query: string) => void;
  onRequestLocation: () => void;
  onOpenParkingDetail: (spot: ParkingSpot, stationName?: string) => void;
  onToggleFavorite: (spot: ParkingSpot) => void;
  onInspectPublicLot: (lot: PublicParkingLot) => void;
  onSwitchToMap: () => void;
}

export default function CommuterBrowseView({
  searchQuery,
  searchMeta,
  searchError,
  browseFilters,
  browseSortBy,
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
  onChangeSort,
  onUpdateFilters,
  onClearSearchQuery,
  onClearAllFilters,
  onQuickSearchSuggestion,
  onRequestLocation,
  onOpenParkingDetail,
  onToggleFavorite,
  onInspectPublicLot,
  onSwitchToMap,
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
    <div className="space-y-4 pb-24 md:pb-12">
      {/* ── Hidmo-Style Floating Top Search Bar + GPS Trigger ── */}
      <div className="max-w-3xl mx-auto space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div
            role="button"
            tabIndex={0}
            onClick={onOpenSearchSheet}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenSearchSheet();
              }
            }}
            aria-label="Search station, condo, or open parking filters"
            className="flex-1 min-w-0 h-12 sm:h-[52px] rounded-full bg-white dark:bg-[#1C1C1F] border border-black/[0.09] dark:border-white/[0.11] shadow-[0_6px_22px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.45)] pl-4 pr-2 flex items-center gap-2.5 cursor-pointer hover:border-[#007AFF]/45 active:scale-[0.995] transition-all"
          >
            <Search
              size={17}
              className={
                searchQuery.trim()
                  ? 'text-[#007AFF] dark:text-[#0A84FF] shrink-0'
                  : 'text-[#8E8E93] dark:text-[#71717A] shrink-0'
              }
            />
            <span
              className={`flex-1 min-w-0 truncate text-left text-[14px] ${
                searchQuery.trim()
                  ? 'font-semibold text-[#111111] dark:text-white'
                  : 'font-medium text-[#8E8E93] dark:text-[#71717A]'
              }`}
            >
              {searchQuery.trim() || 'Search station, condo, or area...'}
            </span>

            {searchQuery.trim() && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearSearchQuery();
                }}
                aria-label="Clear destination search"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[#6E6E73] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white shrink-0"
              >
                <X size={13} />
              </button>
            )}

            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[#111111] dark:text-white shrink-0">
              <SlidersHorizontal size={15} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#007AFF] dark:bg-[#0A84FF] px-1 text-[9px] font-bold text-white shadow-xs">
                  {activeFilterCount}
                </span>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={onRequestLocation}
            disabled={locationStatus === 'locating'}
            title={
              locationStatus === 'ready'
                ? `Using your location (±${Math.round(locationAccuracy ?? 50)}m)`
                : 'Enable precise GPS nearby'
            }
            aria-label={locationStatus === 'ready' ? 'Refresh GPS location' : 'Enable nearby GPS'}
            className={`h-12 w-12 sm:w-auto sm:h-[52px] sm:px-4 rounded-full border shadow-[0_6px_22px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.45)] flex items-center justify-center gap-1.5 shrink-0 text-[12px] font-semibold transition-all cursor-pointer active:scale-95 ${
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
              {locationStatus === 'ready' ? 'GPS Ready' : 'Nearby'}
            </span>
          </button>
        </div>

        {/* Dismissible Active Filter Badges (Hidmo-style) */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {browseFilters.listingScope !== 'all' && (
              <button
                type="button"
                onClick={() =>
                  onUpdateFilters((prev) => ({ ...prev, listingScope: 'all' }))
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#3894FF] border border-[#007AFF]/20 px-3 py-1 text-[11px] font-semibold hover:bg-[#007AFF]/15 transition-colors cursor-pointer"
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

        {/* Hidmo-Style Centered Segmented Sort Control + Live Result Count */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
          <div
            className="inline-flex self-center sm:self-auto items-center p-1 rounded-full bg-white dark:bg-[#1C1C1F] border border-black/[0.08] dark:border-white/[0.1] shadow-xs"
            role="group"
            aria-label="Sort parking bays"
          >
            {SORT_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = browseSortBy === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChangeSort(tab.id)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#111111] text-white dark:bg-white dark:text-[#111111] shadow-xs'
                      : 'text-[#6E6E73] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  <Icon size={13} strokeWidth={2.2} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <p className="text-center sm:text-right text-[12px] font-medium text-[#6E6E73] dark:text-[#A1A1AA]">
            {totalResultsCount} {totalResultsCount === 1 ? 'space' : 'spaces'} available
            {locationStatus === 'ready' && browseSortBy === 'nearby' && ' · Sorted near you'}
          </p>
        </div>

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
        <div className="bg-white dark:bg-[#1C1C1F] rounded-3xl border border-black/[0.08] dark:border-white/[0.1] p-8 sm:p-12 text-center max-w-xl mx-auto shadow-sm">
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
              : 'Enable Nearby GPS above or pick a popular rail station area below.'}
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

          <div className="mt-6 flex items-center justify-center gap-2.5">
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
        <div className="space-y-8 pt-1">
          {/* ── Public Drive-In Parking Facilities (Hidmo Card Format) ── */}
          {showPublicSection && (
            <section className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[17px] sm:text-xl font-bold tracking-tight text-[#111111] dark:text-white">
                      Public Drive-In Lots
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      Real-Time ANPR
                    </span>
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
                    <div
                      key={`browse-pub-${lot.publicParkingLotId}`}
                      onClick={() => onInspectPublicLot(lot)}
                      className="group cursor-pointer rounded-3xl bg-white dark:bg-[#1C1C1F] border border-black/[0.07] dark:border-white/[0.09] shadow-xs hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col"
                    >
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-white/[0.04]">
                        {lot.facilityPhotoUrl ? (
                          <img
                            src={getPublicLotPhotoUrl(lot.facilityPhotoUrl)}
                            alt={lot.lotName}
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (target.src !== DEFAULT_PUBLIC_PARKING_PHOTO) {
                                target.src = DEFAULT_PUBLIC_PARKING_PHOTO;
                              }
                            }}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-600/20 to-indigo-600/30 flex items-center justify-center">
                            <Layers className="w-10 h-10 text-[#007AFF] opacity-60" />
                          </div>
                        )}

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
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span>
                              {isFull ? 'FULL' : `${lot.availableSpaces}/${lot.totalCapacity} bays`}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-2.5">
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
                          {lot.dailyCapRate && (
                            <span className="inline-flex items-center rounded-lg bg-black/[0.04] dark:bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-[#3A3A3C] dark:text-[#D4D4D8]">
                              Cap RM {lot.dailyCapRate.toFixed(0)}/day
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
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
                  {hasActiveFilters ? 'Matching Condo & Verified Bays' : 'Verified Condo & Station Bays'}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {filteredBrowseSpots.map((spot, index) => {
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
                    <div
                      key={spot.id}
                      onClick={() =>
                        onOpenParkingDetail(spot, spot.stationName || spot.station)
                      }
                      className="group cursor-pointer rounded-3xl bg-white dark:bg-[#1C1C1F] border border-black/[0.07] dark:border-white/[0.09] shadow-xs hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col text-left"
                    >
                      {/* Photo Header */}
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-white/[0.04]">
                        <img
                          src={
                            spot.primaryImageUrl ||
                            BROWSE_FALLBACK_PHOTOS[index % BROWSE_FALLBACK_PHOTOS.length]
                          }
                          alt={shortTitle}
                          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              BROWSE_FALLBACK_PHOTOS[index % BROWSE_FALLBACK_PHOTOS.length];
                          }}
                        />

                        {/* Top-left subtle type badge */}
                        <div className="absolute top-3 left-3 pointer-events-none">
                          <span className="inline-flex items-center gap-1 rounded-full bg-black/60 text-white px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md">
                            <CheckCircle2 size={11} className="text-emerald-400" />
                            <span>{spot.type === 'Condo Bay' ? 'Condo Bay' : 'Private Bay'}</span>
                          </span>
                        </div>

                        {/* Top-right Heart button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(spot);
                          }}
                          disabled={isFavPending}
                          aria-label={isSaved ? 'Remove from favorites' : 'Save to favorites'}
                          className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 hover:bg-black/55 text-white backdrop-blur-md border border-white/20 transition-all hover:scale-105 active:scale-90 cursor-pointer"
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
                        <div className="absolute bottom-2.5 left-3 flex flex-wrap items-center gap-1.5 pointer-events-none">
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
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-2.5">
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
                            {spot.distanceToStation > 0
                              ? `${spot.distanceToStation.toFixed(1)} km to rail`
                              : `${spot.timeToStationInMinutes || 5} min walk`}
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
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Hidmo-Style Mobile Floating "Map" Switch Pill ── */}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(5.65rem+var(--parkjom-safe-bottom))] z-[1040] md:hidden pointer-events-auto">
        <button
          type="button"
          onClick={onSwitchToMap}
          aria-label="Open Transit Map view"
          className="inline-flex items-center gap-2 rounded-full bg-[#111111] dark:bg-white text-white dark:text-[#111111] px-5 py-2.5 text-[13px] font-bold shadow-[0_10px_28px_rgba(0,0,0,0.28)] border border-black/15 dark:border-white/25 active:scale-95 transition-transform cursor-pointer"
        >
          <Map size={15} strokeWidth={2.2} />
          <span>Map</span>
        </button>
      </div>
    </div>
  );
}
