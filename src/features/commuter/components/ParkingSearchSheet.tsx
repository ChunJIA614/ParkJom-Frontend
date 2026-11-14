import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Accessibility,
  Building2,
  Calendar,
  Crosshair,
  Globe,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrainFront,
  X,
  Zap,
} from 'lucide-react';
import type { PublicParkingLot } from '@/features/publicParking/types';
import type { ParkingSpot } from '../types';
import { formatShortSpotName } from '../lib/formatUtils';
import { normalizeCompact, similarityRatio } from '../lib/fuzzySearch';
import {
  CATEGORY_FILTER_OPTIONS,
  DEFAULT_BROWSE_FILTERS,
  filterSpotsWithQuery,
  matchesPublicLotFilters,
  type BrowseFiltersState,
  type ListingScope,
  type RatePlanFilter,
  type RealCategory,
} from '../lib/browseFilters';

interface SearchSuggestionItem {
  title: string;
  subtitle: string;
  type: 'property' | 'station';
}

export interface ParkingSearchSheetProps {
  open: boolean;
  onClose: () => void;
  appliedFilters: BrowseFiltersState;
  appliedQuery: string;
  allKnownSpots: ParkingSpot[];
  searchSpots: ParkingSpot[];
  hasSearchMeta: boolean;
  publicLots: PublicParkingLot[];
  locationStatus: 'locating' | 'ready' | 'denied' | 'unavailable';
  onRequestLocation: () => void;
  isSearching: boolean;
  onApply: (next: {
    filters: BrowseFiltersState;
    query: string;
    triggerSearchApi: boolean;
  }) => void;
  onClearAll: () => void;
}

const CATEGORY_ICON_MAP = {
  all: Globe,
  transit: TrainFront,
  covered: Building2,
  ev: Zap,
  cctv: ShieldCheck,
  monthly: Calendar,
  accessible: Accessibility,
} as const;

const PRICE_PRESETS: Array<{ label: string; min: number | null; max: number | null }> = [
  { label: 'Any', min: null, max: null },
  { label: 'Under RM 5', min: null, max: 5 },
  { label: 'RM 5 – 10', min: 5, max: 10 },
  { label: 'RM 10 – 15', min: 10, max: 15 },
  { label: 'RM 15+', min: 15, max: null },
];

const DISTANCE_PRESETS: Array<{ label: string; maxKm: number | null }> = [
  { label: 'Any', maxKm: null },
  { label: '≤ 300m', maxKm: 0.3 },
  { label: '≤ 500m', maxKm: 0.5 },
  { label: '≤ 1 km', maxKm: 1.0 },
  { label: '≤ 2 km', maxKm: 2.0 },
];

const SCOPE_TABS: Array<{ id: ListingScope; label: string }> = [
  { id: 'all', label: 'All Parking' },
  { id: 'private', label: 'Condo Bays' },
  { id: 'public', label: 'Drive-In Lots' },
];

const RATE_PLAN_OPTIONS: Array<{ id: RatePlanFilter; label: string }> = [
  { id: 'all', label: 'All Rates' },
  { id: 'daily', label: 'Daily Pass' },
  { id: 'monthly', label: 'Monthly Pass' },
];

const DEFAULT_DESTINATION_SUGGESTIONS: SearchSuggestionItem[] = [
  { title: 'PV128', subtitle: 'Near Wangsa Maju · Setapak', type: 'property' },
  { title: 'PV18 Residences', subtitle: 'Near Taman Melati · Setapak', type: 'property' },
  { title: 'Wangsa Maju', subtitle: 'LRT Kelana Jaya Line', type: 'station' },
  { title: 'Taman Melati', subtitle: 'LRT Kelana Jaya Line', type: 'station' },
  { title: 'USJ 7', subtitle: 'LRT & BRT Interchange', type: 'station' },
  { title: 'Maluri', subtitle: 'MRT Kajang & LRT Ampang Line', type: 'station' },
];

export default function ParkingSearchSheet({
  open,
  onClose,
  appliedFilters,
  appliedQuery,
  allKnownSpots,
  searchSpots,
  hasSearchMeta,
  publicLots,
  locationStatus,
  onRequestLocation,
  isSearching,
  onApply,
  onClearAll,
}: ParkingSearchSheetProps) {
  const [draftFilters, setDraftFilters] = useState<BrowseFiltersState>(appliedFilters);
  const [draftQuery, setDraftQuery] = useState(appliedQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraftFilters(appliedFilters);
    setDraftQuery(appliedQuery);
    setShowSuggestions(false);
  }, [open, appliedFilters, appliedQuery]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  const liveSuggestions = useMemo<SearchSuggestionItem[]>(() => {
    const rawQ = draftQuery.trim().toLowerCase();
    const compactQ = normalizeCompact(rawQ);
    const items: Array<{ item: SearchSuggestionItem; rank: number }> = [];
    const seen = new Set<string>();

    const scoreText = (title: string, subtitle: string): number => {
      if (!rawQ) return 1;
      const lowerTitle = title.toLowerCase();
      const lowerSub = subtitle.toLowerCase();
      const compactTitle = normalizeCompact(title);
      if (lowerTitle.startsWith(rawQ)) return 1.0;
      if (lowerTitle.includes(rawQ) || lowerSub.includes(rawQ)) return 0.9;
      if (compactQ.length >= 2 && compactTitle.includes(compactQ)) return 0.88;
      if (compactQ.length >= 3) {
        const sim = Math.max(
          similarityRatio(compactQ, compactTitle.slice(0, compactQ.length + 3)),
          similarityRatio(rawQ, lowerTitle),
        );
        if (sim >= 0.52) return sim * 0.85;
      }
      return 0;
    };

    for (const lot of publicLots) {
      const title = lot.lotName;
      const subtitle = lot.nearestStationName
        ? `Drive-In Lot · Near ${lot.nearestStationName}`
        : `Drive-In Lot · ${lot.address}`;
      const rank = scoreText(title, subtitle);
      if (rank > 0 && !seen.has(`pub-${title}`)) {
        seen.add(`pub-${title}`);
        items.push({ item: { title, subtitle, type: 'property' }, rank });
      }
    }

    for (const spot of allKnownSpots) {
      const propTitle = spot.propertyName || formatShortSpotName(spot.name);
      if (propTitle && !seen.has(`prop-${propTitle}`)) {
        const subtitle = spot.stationName ? `Condo Bay · Near ${spot.stationName}` : 'Condo Parking';
        const rank = scoreText(propTitle, subtitle);
        if (rank > 0) {
          seen.add(`prop-${propTitle}`);
          items.push({ item: { title: propTitle, subtitle, type: 'property' }, rank });
        }
      }
      if (spot.stationName && !seen.has(`stn-${spot.stationName}`)) {
        const subtitle = 'LRT / MRT Station Area';
        const rank = scoreText(spot.stationName, subtitle);
        if (rank > 0) {
          seen.add(`stn-${spot.stationName}`);
          items.push({ item: { title: spot.stationName, subtitle, type: 'station' }, rank });
        }
      }
    }

    for (const item of DEFAULT_DESTINATION_SUGGESTIONS) {
      const rank = scoreText(item.title, item.subtitle);
      if (rank > 0) {
        const prefix = item.type === 'station' ? 'stn' : 'prop';
        if (!seen.has(`${prefix}-${item.title}`)) {
          seen.add(`${prefix}-${item.title}`);
          items.push({ item, rank: rank * 0.9 });
        }
      }
    }

    return items
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 6)
      .map((entry) => entry.item);
  }, [allKnownSpots, publicLots, draftQuery]);

  const previewCount = useMemo(() => {
    const trimmed = draftQuery.trim();
    const useSearchPool =
      hasSearchMeta && trimmed !== '' && trimmed.toLowerCase() === appliedQuery.trim().toLowerCase();
    const basePool = (useSearchPool ? searchSpots : allKnownSpots).filter((s) => s.available);
    const matchingSpots = filterSpotsWithQuery(basePool, draftFilters, useSearchPool ? '' : trimmed);
    const matchingLots = publicLots.filter((lot) => matchesPublicLotFilters(lot, draftFilters, trimmed));
    return matchingSpots.length + matchingLots.length;
  }, [
    allKnownSpots,
    appliedQuery,
    draftFilters,
    draftQuery,
    hasSearchMeta,
    publicLots,
    searchSpots,
  ]);

  if (!open) return null;

  const toggleCategory = (cat: 'all' | RealCategory) => {
    setDraftFilters((prev) => {
      if (cat === 'all') {
        return { ...prev, categories: [] };
      }
      const exists = prev.categories.includes(cat);
      const next = exists
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat];
      return { ...prev, categories: next };
    });
  };

  const allCategoriesSelected =
    draftFilters.categories.length === CATEGORY_FILTER_OPTIONS.length - 1;

  const handleToggleAllCategories = () => {
    setDraftFilters((prev) => ({
      ...prev,
      categories: allCategoriesSelected
        ? []
        : CATEGORY_FILTER_OPTIONS.filter((c): c is { id: RealCategory; label: string } => c.id !== 'all').map(
            (c) => c.id,
          ),
    }));
  };

  const priceSummaryLabel = (() => {
    const { minDailyRate, maxDailyRate } = draftFilters;
    if (minDailyRate === null && maxDailyRate === null) return 'Any price';
    if (minDailyRate !== null && maxDailyRate !== null) {
      return `RM ${minDailyRate} – RM ${maxDailyRate}`;
    }
    if (maxDailyRate !== null) return `Up to RM ${maxDailyRate}/day`;
    return `RM ${minDailyRate}+/day`;
  })();

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = draftQuery.trim();
    const triggerSearchApi =
      trimmed !== '' && (!hasSearchMeta || trimmed.toLowerCase() !== appliedQuery.trim().toLowerCase());
    onApply({
      filters: draftFilters,
      query: trimmed,
      triggerSearchApi,
    });
  };

  const handleResetSheet = () => {
    setDraftFilters(DEFAULT_BROWSE_FILTERS);
    setDraftQuery('');
    setShowSuggestions(false);
    onClearAll();
  };

  const ctaLabel = (() => {
    if (isSearching) return 'Searching...';
    const trimmed = draftQuery.trim();
    if (trimmed && previewCount === 0 && trimmed.toLowerCase() !== appliedQuery.trim().toLowerCase()) {
      return `Search "${trimmed}"`;
    }
    return `Show ${previewCount} ${previewCount === 1 ? 'bay' : 'bays'}`;
  })();

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-end md:items-center justify-center bg-black/55 backdrop-blur-sm md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="parking-search-sheet-title"
    >
      <div
        className="w-full md:max-w-[580px] max-h-[92dvh] md:max-h-[88vh] flex flex-col rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#141417] border-t md:border border-black/[0.08] dark:border-white/[0.1] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 md:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-black/15 dark:bg-white/20" />
        </div>

        {/* Header + Scope Tabs */}
        <div className="px-5 pt-2 md:pt-4 pb-3 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={17} className="text-[#007AFF] dark:text-[#0A84FF]" />
              <h2
                id="parking-search-sheet-title"
                className="text-[17px] font-bold tracking-tight text-[#111111] dark:text-white"
              >
                Search &amp; Filters
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search and filters"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[#6E6E73] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div
            className="grid grid-cols-3 p-1 rounded-full bg-black/[0.05] dark:bg-white/[0.06]"
            role="tablist"
            aria-label="Parking listing type"
          >
            {SCOPE_TABS.map((tab) => {
              const active = draftFilters.listingScope === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() =>
                    setDraftFilters((prev) => ({ ...prev, listingScope: tab.id }))
                  }
                  className={`py-2 px-2.5 rounded-full text-[12px] font-semibold transition-all ${
                    active
                      ? 'bg-[#111111] text-white dark:bg-white dark:text-[#111111] shadow-sm'
                      : 'text-[#6E6E73] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable filter sections */}
        <form
          id="parking-search-sheet-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3.5"
        >
          {/* 1. Location & Query Card */}
          <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.09] bg-black/[0.02] dark:bg-white/[0.03] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-[#111111] dark:text-white">
                Location or Station
              </span>
              <button
                type="button"
                onClick={onRequestLocation}
                disabled={locationStatus === 'locating'}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                  locationStatus === 'ready'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#0A84FF]/15 dark:text-[#0A84FF] hover:bg-[#007AFF]/15'
                }`}
              >
                {locationStatus === 'locating' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Crosshair size={12} />
                )}
                {locationStatus === 'ready' ? 'Nearby GPS Active' : 'Use GPS'}
              </button>
            </div>

            <div className="relative flex items-center gap-2 rounded-xl border border-black/[0.09] dark:border-white/[0.11] bg-white dark:bg-[#1C1C1F] px-3 py-2.5 focus-within:border-[#007AFF] dark:focus-within:border-[#0A84FF] transition-colors">
              <Search size={16} className="text-[#8E8E93] dark:text-[#71717A] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={draftQuery}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setDraftQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                placeholder="Search station, condo, or area..."
                className="w-full bg-transparent text-[14px] text-[#111111] dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#71717A] focus:outline-none"
              />
              {draftQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftQuery('');
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear location search"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-black/[0.06] dark:bg-white/[0.1] text-[#6E6E73] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white shrink-0"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {(showSuggestions || draftQuery.trim().length > 0) && liveSuggestions.length > 0 && (
              <div className="pt-1 space-y-1">
                <p className="text-[11px] font-medium text-[#8E8E93] dark:text-[#71717A] px-1">
                  {draftQuery.trim() ? 'Matching destinations' : 'Popular stations & condos'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {liveSuggestions.map((s) => (
                    <button
                      key={`${s.type}-${s.title}`}
                      type="button"
                      onClick={() => {
                        setDraftQuery(s.title);
                        setShowSuggestions(false);
                      }}
                      className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left bg-white/80 dark:bg-white/[0.04] hover:bg-[#007AFF]/10 dark:hover:bg-[#0A84FF]/15 border border-black/[0.05] dark:border-white/[0.06] transition-colors"
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          s.type === 'station'
                            ? 'bg-[#007AFF]/12 text-[#007AFF] dark:text-[#0A84FF]'
                            : 'bg-black/[0.06] dark:bg-white/[0.08] text-[#52525B] dark:text-[#D4D4D8]'
                        }`}
                      >
                        {s.type === 'station' ? <TrainFront size={13} /> : <MapPin size={13} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold text-[#111111] dark:text-white">
                          {s.title}
                        </span>
                        <span className="block truncate text-[10px] text-[#6E6E73] dark:text-[#A1A1AA]">
                          {s.subtitle}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Bay Type & Amenities (all screenshot categories inside modal) */}
          <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.09] bg-black/[0.02] dark:bg-white/[0.03] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-[#111111] dark:text-white">
                Bay Type &amp; Security
              </span>
              <button
                type="button"
                onClick={handleToggleAllCategories}
                className="text-[12px] font-semibold text-[#007AFF] dark:text-[#0A84FF] hover:underline"
              >
                {allCategoriesSelected || draftFilters.categories.length > 0 ? 'Reset' : 'Select All'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORY_FILTER_OPTIONS.map((cat) => {
                const Icon = CATEGORY_ICON_MAP[cat.id];
                const isSelected =
                  cat.id === 'all'
                    ? draftFilters.categories.length === 0
                    : draftFilters.categories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    aria-pressed={isSelected}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold border transition-all ${
                      isSelected
                        ? 'bg-[#007AFF] dark:bg-[#0A84FF] border-[#007AFF] dark:border-[#0A84FF] text-white shadow-sm shadow-[#007AFF]/20'
                        : 'bg-white dark:bg-[#1C1C1F] border-black/[0.07] dark:border-white/[0.08] text-[#3A3A3C] dark:text-[#D4D4D8] hover:border-black/20 dark:hover:border-white/25'
                    }`}
                  >
                    <Icon size={15} className="shrink-0" strokeWidth={2} />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Rate Plan */}
          <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.09] bg-black/[0.02] dark:bg-white/[0.03] p-4 space-y-3">
            <span className="block text-[13px] font-semibold text-[#111111] dark:text-white">
              Rate Plan
            </span>
            <div className="grid grid-cols-3 gap-2">
              {RATE_PLAN_OPTIONS.map((opt) => {
                const active = draftFilters.ratePlan === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setDraftFilters((prev) => ({ ...prev, ratePlan: opt.id }))
                    }
                    aria-pressed={active}
                    className={`rounded-xl py-2.5 px-2 text-center text-[12px] font-semibold border transition-all ${
                      active
                        ? 'bg-[#111111] text-white border-[#111111] dark:bg-white dark:text-[#111111] dark:border-white'
                        : 'bg-white dark:bg-[#1C1C1F] border-black/[0.07] dark:border-white/[0.08] text-[#3A3A3C] dark:text-[#D4D4D8] hover:border-black/20 dark:hover:border-white/25'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Daily Rate Range */}
          <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.09] bg-black/[0.02] dark:bg-white/[0.03] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-[#111111] dark:text-white">
                Daily Rate
              </span>
              <span className="text-[12px] font-semibold text-[#007AFF] dark:text-[#0A84FF]">
                {priceSummaryLabel}
              </span>
            </div>

            <div className="space-y-1.5">
              <input
                type="range"
                min={2}
                max={40}
                step={1}
                value={draftFilters.maxDailyRate ?? 40}
                aria-label="Maximum daily rate in RM"
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDraftFilters((prev) => ({
                    ...prev,
                    maxDailyRate: val >= 40 ? null : val,
                    minDailyRate:
                      prev.minDailyRate !== null && val < prev.minDailyRate ? null : prev.minDailyRate,
                  }));
                }}
                className="w-full accent-[#007AFF] dark:accent-[#0A84FF] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-medium text-[#8E8E93] dark:text-[#71717A]">
                <span>RM 2</span>
                <span>RM 15</span>
                <span>RM 40+</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRICE_PRESETS.map((preset) => {
                const active =
                  draftFilters.minDailyRate === preset.min &&
                  draftFilters.maxDailyRate === preset.max;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        minDailyRate: preset.min,
                        maxDailyRate: preset.max,
                      }))
                    }
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold border transition-all ${
                      active
                        ? 'bg-[#111111] text-white border-[#111111] dark:bg-white dark:text-[#111111] dark:border-white'
                        : 'bg-white dark:bg-[#1C1C1F] border-black/[0.07] dark:border-white/[0.08] text-[#3A3A3C] dark:text-[#D4D4D8] hover:border-black/20 dark:hover:border-white/25'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Walk Distance to Station */}
          <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.09] bg-black/[0.02] dark:bg-white/[0.03] p-4 space-y-3">
            <span className="block text-[13px] font-semibold text-[#111111] dark:text-white">
              Distance to LRT / MRT Station
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DISTANCE_PRESETS.map((preset) => {
                const active = draftFilters.maxStationDistanceKm === preset.maxKm;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        maxStationDistanceKm: preset.maxKm,
                      }))
                    }
                    className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold border transition-all ${
                      active
                        ? 'bg-[#111111] text-white border-[#111111] dark:bg-white dark:text-[#111111] dark:border-white'
                        : 'bg-white dark:bg-[#1C1C1F] border-black/[0.07] dark:border-white/[0.08] text-[#3A3A3C] dark:text-[#D4D4D8] hover:border-black/20 dark:hover:border-white/25'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {/* Sticky Bottom CTA Footer (Hidmo-style) */}
        <div className="px-5 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] border-t border-black/[0.08] dark:border-white/[0.08] bg-white/95 dark:bg-[#141417]/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleResetSheet}
            className="rounded-full px-4 py-2.5 text-[13px] font-semibold text-[#111111] dark:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
          >
            Clear All
          </button>

          <button
            type="submit"
            form="parking-search-sheet-form"
            disabled={isSearching}
            className="flex-1 sm:flex-none sm:min-w-[200px] inline-flex items-center justify-center gap-2 rounded-full bg-[#007AFF] dark:bg-[#0A84FF] hover:bg-[#0066d6] px-6 py-3 text-[14px] font-semibold text-white shadow-lg shadow-[#007AFF]/25 active:scale-[0.99] transition-all disabled:opacity-60"
          >
            {isSearching && <Loader2 size={15} className="animate-spin" />}
            <span>{ctaLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
