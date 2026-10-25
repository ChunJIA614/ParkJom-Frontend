import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LocateFixed, Navigation, Search, SearchX, X } from 'lucide-react';

export interface NearestStation {
  name: string;
  distance: number;
}

export interface StationPickerSheetProps {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  selectedStation: string | null;
  onSelectStation: (name: string) => void;
  /** Nearest stations, shown as their own section before the full list. */
  nearestStations: NearestStation[];
  /** The full list, already filtered by the query and sorted A→Z. */
  listStations: string[];
  /** True when nearestStations should be shown (no query, location known). */
  showNearest: boolean;
  distanceFor: (name: string) => number | undefined;
  /** Conic gradient of the station's lines, matching its map marker. */
  ringFor: (name: string) => string | undefined;
  hasUserLocation: boolean;
  locationStatus: string;
  onRequestLocation?: () => void;
}

const formatDistance = (km?: number) => {
  if (km === undefined || !Number.isFinite(km)) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
};

interface StationRowProps {
  name: string;
  distanceKm?: number;
  ring?: string;
  selected: boolean;
  onSelect: () => void;
}

/**
 * One station in the picker. The leading ring is the same conic gradient the map
 * marker uses, so a row and its marker read as the same object. Selection is
 * carried by a checkmark as well as a tint — never by colour alone.
 */
function StationRow({ name, distanceKm, ring, selected, onSelect }: StationRowProps) {
  const distance = formatDistance(distanceKm);
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={`station-row flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
          selected
            ? 'bg-[#007aff]/[0.08] dark:bg-[#007aff]/[0.2]'
            : 'hover:bg-black/[0.025] active:bg-black/[0.06] dark:hover:bg-white/[0.04] dark:active:bg-white/[0.08]'
        }`}
      >
        <span
          aria-hidden="true"
          className="station-row__disc h-[1.125rem] w-[1.125rem] shrink-0 rounded-full"
          style={{
            background: ring || '#007aff',
          }}
        />
        <span
          className={`min-w-0 flex-1 truncate text-[17px] leading-tight ${
            selected
              ? 'font-semibold text-[#007aff] dark:text-[#409cff]'
              : 'font-normal text-[#1d1d1f] dark:text-[#f2f2f7]'
          }`}
        >
          {name}
        </span>
        {distance && (
          <span className="shrink-0 text-[15px] tabular-nums text-[#6e6e73] dark:text-[#8e8e93]">
            {distance}
          </span>
        )}
        <Check
          className={`h-4 w-4 shrink-0 text-[#007aff] dark:text-[#409cff] ${selected ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden="true"
        />
      </button>
    </li>
  );
}

export default function StationPickerSheet({
  open,
  onClose,
  query,
  onQueryChange,
  selectedStation,
  onSelectStation,
  nearestStations,
  listStations,
  showNearest,
  distanceFor,
  ringFor,
  hasUserLocation,
  locationStatus,
  onRequestLocation,
}: StationPickerSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startY: 0, startTime: 0, active: false });
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;

  // Land focus in the sheet on open, without forcing the keyboard up over the list.
  useEffect(() => {
    if (!open) return;
    setDragY(0);
    const timer = window.setTimeout(() => sheetRef.current?.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  // Swipe down to dismiss: the grabber is the affordance, the drag is the expectation.
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // Let buttons in the header receive their own click; capturing the pointer
    // here would retarget the click to the header and swallow it.
    if ((event.target as HTMLElement).closest('button, a, input')) return;
    dragRef.current = { startY: event.clientY, startTime: Date.now(), active: true };
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const delta = event.clientY - dragRef.current.startY;
    // Downward follows the finger; upward resists, because the sheet is already open.
    setDragY(delta > 0 ? delta : delta * 0.12);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const { startY, startTime } = dragRef.current;
    dragRef.current.active = false;
    setDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const delta = event.clientY - startY;
    const velocity = delta / Math.max(1, Date.now() - startTime);
    if (delta > 110 || velocity > 0.6) onClose();
    setDragY(0);
  };

  return (
    <div
      id="station-picker"
      data-map-control
      ref={sheetRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="station-picker-title"
      tabIndex={-1}
      style={{ transform: `translate3d(0, ${dragY}px, 0)` }}
      className={`map-station-sheet bg-[rgba(255,255,255,0.94)] dark:bg-[rgba(26,26,30,0.95)] text-[#1d1d1f] dark:text-[#f2f2f7] absolute inset-x-0 bottom-0 z-[1000] flex max-h-[calc(100%-4rem)] flex-col overflow-hidden outline-none lg:hidden ${
        dragging ? 'is-dragging' : ''
      }`}
    >
      {/* Grabber + title: the drag surface */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="shrink-0 touch-none select-none"
      >
        <div className="map-station-sheet__grabber bg-[rgba(60,60,67,0.24)] dark:bg-[rgba(255,255,255,0.3)]" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-2.5">
          <h2 id="station-picker-title" className="text-[17px] font-semibold leading-tight text-[#1d1d1f] dark:text-[#f2f2f7]">
            Choose a station
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Collapse station list"
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#6e6e73] dark:text-[#8e8e93] transition-colors active:bg-black/[0.06] dark:active:bg-white/[0.08]"
          >
            <ChevronDown className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Search field: filled, 44pt tall, 17px so iOS never zooms on focus */}
      <div className="shrink-0 px-4 pb-2 pt-1">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[#6e6e73] dark:text-[#8e8e93]" aria-hidden="true" />
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search stations or lines"
            aria-label="Search stations"
            className="h-11 w-full rounded-[10px] bg-[rgba(118,118,128,0.12)] dark:bg-[rgba(118,118,128,0.24)] pl-9 pr-11 text-[17px] leading-none text-[#1d1d1f] dark:text-[#f2f2f7] placeholder:text-[#6e6e73] dark:placeholder:text-[#8e8e93] focus:outline-none focus:ring-2 focus:ring-[#007aff]/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Clear search"
              className="absolute right-0.5 flex h-10 w-10 items-center justify-center rounded-full text-[#6e6e73] dark:text-[#8e8e93] active:bg-black/[0.08] dark:active:bg-white/[0.08]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* The list owns the leftover height, so it scrolls instead of clipping */}
      <div className="map-station-sheet__list min-h-0 flex-1 overflow-y-auto">
        {!hasUserLocation && locationStatus !== 'locating' && !isSearching && (
          <div className="mx-4 mb-1 flex items-center gap-3 rounded-xl bg-[#007aff]/[0.07] dark:bg-[#007aff]/[0.16] px-3 py-2.5">
            <LocateFixed className="h-4 w-4 shrink-0 text-[#007aff] dark:text-[#409cff]" aria-hidden="true" />
            <p className="flex-1 text-[13px] leading-snug text-[#1d1d1f] dark:text-[#f2f2f7]">
              Turn on location to sort stations by distance.
            </p>
            <button
              type="button"
              onClick={() => onRequestLocation?.()}
              className="shrink-0 text-[13px] font-semibold text-[#007aff] dark:text-[#409cff]"
            >
              Turn on
            </button>
          </div>
        )}

        {showNearest && (
          <div className="pb-1">
            <div className="flex items-center gap-1.5 px-4 pb-1.5 pt-2">
              <Navigation className="h-3.5 w-3.5 text-[#007aff] dark:text-[#409cff]" aria-hidden="true" />
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#6e6e73] dark:text-[#8e8e93]">
                Nearest to you
              </h3>
            </div>
            <ul>
              {nearestStations.map((station) => (
                <StationRow
                  key={`nearest-${station.name}`}
                  name={station.name}
                  distanceKm={station.distance}
                  ring={ringFor(station.name)}
                  selected={selectedStation === station.name}
                  onSelect={() => onSelectStation(station.name)}
                />
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-baseline justify-between gap-3 px-4 pb-1.5 pt-3">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#6e6e73] dark:text-[#8e8e93]">
            {isSearching ? 'Results' : 'All stations'}
          </h3>
          <span className="text-[13px] tabular-nums text-[#6e6e73] dark:text-[#8e8e93]">{listStations.length}</span>
        </div>

        <ul>
          {listStations.map((name) => (
            <StationRow
              key={name}
              name={name}
              distanceKm={distanceFor(name)}
              ring={ringFor(name)}
              selected={selectedStation === name}
              onSelect={() => onSelectStation(name)}
            />
          ))}
        </ul>

        {listStations.length === 0 && (
          <div className="px-8 pb-10 pt-6 text-center">
            <SearchX className="mx-auto h-8 w-8 text-[#8e8e93]" aria-hidden="true" />
            <p className="mt-3 text-[17px] font-semibold leading-snug text-[#1d1d1f] dark:text-[#f2f2f7]">
              No station matches “{trimmedQuery}”
            </p>
            <p className="mt-1 text-[15px] leading-snug text-[#6e6e73] dark:text-[#8e8e93]">
              Try a shorter name, or a line code like KJ, MR or PY.
            </p>
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="mt-4 inline-flex h-10 items-center rounded-full bg-[#007aff] px-4 text-[15px] font-semibold text-white active:bg-[#0066d6]"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
