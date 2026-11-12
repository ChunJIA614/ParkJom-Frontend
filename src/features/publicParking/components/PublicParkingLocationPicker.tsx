import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search,
  MapPin,
  Train,
  Crosshair,
  Navigation,
  AlertCircle,
  Check,
  Compass,
  Layers,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { searchMalaysiaLocations, reverseGeocodeMalaysia } from '@/features/owner/api/propertyApi';
import { loadRailStops } from '@/services/transitData';
import { useTheme } from '@/app/theme/ThemeContext';

export interface LocationPickerValue {
  address: string;
  latitude: number;
  longitude: number;
  nearestStationName: string | null;
  distanceToStation: number | null;
}

interface PublicParkingLocationPickerProps {
  value: LocationPickerValue;
  onChange: (val: LocationPickerValue) => void;
  lotName?: string;
  onLotNameSuggest?: (name: string) => void;
  mapHeightClassName?: string;
}

interface SearchSuggestion {
  placeId: string;
  displayName: string;
  shortName: string;
  lat: number;
  lon: number;
}

// Haversine distance in meters
function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Custom Apple-styled Draggable Pin Icon
const parkingPinIcon = L.divIcon({
  className: 'custom-parking-pin-marker',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: grab;">
      <div style="position: absolute; top: -6px; width: 38px; height: 38px; border-radius: 9999px; background: rgba(0, 113, 227, 0.28); animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width: 34px; height: 34px; border-radius: 50% 50% 50% 0; background: linear-gradient(135deg, #0071e3, #0056b3); transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,113,227,0.45), 0 0 0 2px white; z-index: 2;">
        <div style="transform: rotate(45deg); color: white; font-weight: 800; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;">P</div>
      </div>
      <div style="width: 10px; height: 3.5px; border-radius: 50%; background: rgba(0,0,0,0.35); margin-top: 2px;"></div>
    </div>
  `,
  iconSize: [38, 44],
  iconAnchor: [19, 42],
  popupAnchor: [0, -42],
});

// Transit station icon on picker map
const transitStationIcon = L.divIcon({
  className: 'custom-station-pin-marker',
  html: `
    <div style="display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 9999px; background: #059669; color: white; font-size: 10px; font-weight: 700; font-family: -apple-system, system-ui, sans-serif; box-shadow: 0 3px 10px rgba(0,0,0,0.25), 0 0 0 1.5px white; white-space: nowrap;">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg>
      <span>Transit Stop</span>
    </div>
  `,
  iconSize: [84, 24],
  iconAnchor: [42, 12],
  popupAnchor: [0, -12],
});

// Map View Controller for animated fly-to when coordinates change
function MapCenterController({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], Math.max(map.getZoom(), 15), {
      duration: 0.6,
      easeLinearity: 0.25,
    });
  }, [lat, lon, map]);
  return null;
}

// Invalidate size using ResizeObserver to ensure map tiles always render properly
function MapSizeInvalidator() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(container);

    const t1 = setTimeout(() => map.invalidateSize(), 50);
    const t2 = setTimeout(() => map.invalidateSize(), 200);
    const t3 = setTimeout(() => map.invalidateSize(), 500);
    const t4 = setTimeout(() => map.invalidateSize(), 1000);

    return () => {
      ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [map]);
  return null;
}

// Map Click Listener to move pin
function MapClickInterceptor({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handleClick = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onMapClick]);
  return null;
}

export const PublicParkingLocationPicker: React.FC<PublicParkingLocationPickerProps> = ({
  value,
  onChange,
  lotName,
  onLotNameSuggest,
  mapHeightClassName,
}) => {
  const { isDark } = useTheme();
  const basemapStyle = isDark ? 'dark_all' : 'light_all';
  const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY || 'cb1_4my4_1_ce393a0ceb5a0f20bceb66ff';

  const [searchQuery, setSearchQuery] = useState(value.address || '');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [allStops, setAllStops] = useState<{ name: string; lat: number; lon: number }[]>([]);
  const [nearestStationCoords, setNearestStationCoords] = useState<{ lat: number; lon: number } | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Load rail stops on mount
  useEffect(() => {
    let active = true;
    async function initStops() {
      try {
        const data = (await loadRailStops()) as {
          features: Array<{
            properties?: { stop_name?: string };
            geometry: { coordinates: [number, number] };
          }>;
        };
        if (!active) return;
        const stops = data.features.map((f) => ({
          name: f.properties?.stop_name ?? 'Transit Station',
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
        }));
        setAllStops(stops);
      } catch {
        // Fallback silently
      }
    }
    void initStops();
    return () => {
      active = false;
    };
  }, []);

  // Compute nearest station given lat/lon
  const computeNearestStation = useCallback(
    (lat: number, lon: number) => {
      if (allStops.length === 0) return { name: null, distance: null, coords: null };
      let closest = allStops[0];
      let minDist = haversineDistanceMeters(lat, lon, closest.lat, closest.lon);

      for (let i = 1; i < allStops.length; i++) {
        const d = haversineDistanceMeters(lat, lon, allStops[i].lat, allStops[i].lon);
        if (d < minDist) {
          minDist = d;
          closest = allStops[i];
        }
      }

      return {
        name: closest.name,
        distance: Math.round(minDist),
        coords: { lat: closest.lat, lon: closest.lon },
      };
    },
    [allStops]
  );

  // Recalculate nearest station if allStops finishes loading or coordinates change
  useEffect(() => {
    if (value.latitude && value.longitude && allStops.length > 0) {
      const nearest = computeNearestStation(value.latitude, value.longitude);
      setNearestStationCoords(nearest.coords);
      if (
        nearest.name !== value.nearestStationName ||
        nearest.distance !== value.distanceToStation
      ) {
        onChange({
          ...value,
          nearestStationName: nearest.name,
          distanceToStation: nearest.distance,
        });
      }
    }
  }, [allStops, computeNearestStation, value.latitude, value.longitude]);

  // Click outside suggestions listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search places via Nominatim
  const handlePerformSearch = async (queryText: string) => {
    const q = queryText.trim();
    if (!q || q.length < 2) return;

    setIsSearching(true);
    try {
      const res = await searchMalaysiaLocations(q);
      const data = await res.json();
      if (Array.isArray(data)) {
        const items: SearchSuggestion[] = data.map((item: any) => ({
          placeId: String(item.place_id || item.osm_id),
          displayName: item.display_name,
          shortName: item.name || item.display_name.split(',')[0],
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
        }));
        setSuggestions(items);
        setShowSuggestions(true);
      }
    } catch {
      // Fallback
    } finally {
      setIsSearching(false);
    }
  };

  // Reverse geocode when pin moves to update address
  const handleReverseGeocode = async (lat: number, lon: number) => {
    setIsReverseGeocoding(true);
    try {
      const res = await reverseGeocodeMalaysia(lat, lon);
      const data = await res.json();
      if (data && data.display_name) {
        setSearchQuery(data.display_name);
        const nearest = computeNearestStation(lat, lon);
        setNearestStationCoords(nearest.coords);
        onChange({
          ...value,
          address: data.display_name,
          latitude: parseFloat(lat.toFixed(6)),
          longitude: parseFloat(lon.toFixed(6)),
          nearestStationName: nearest.name,
          distanceToStation: nearest.distance,
        });
        if (!lotName && onLotNameSuggest && (data.name || data.address?.building)) {
          onLotNameSuggest(data.name || data.address?.building);
        }
      }
    } catch {
      // Keep existing address if reverse geocode fails
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Select suggestion from dropdown
  const handleSelectSuggestion = (s: SearchSuggestion) => {
    setSearchQuery(s.displayName);
    setShowSuggestions(false);

    const nearest = computeNearestStation(s.lat, s.lon);
    setNearestStationCoords(nearest.coords);

    onChange({
      ...value,
      address: s.displayName,
      latitude: parseFloat(s.lat.toFixed(6)),
      longitude: parseFloat(s.lon.toFixed(6)),
      nearestStationName: nearest.name,
      distanceToStation: nearest.distance,
    });

    if (!lotName && onLotNameSuggest) {
      onLotNameSuggest(s.shortName);
    }
  };

  // Handle pin drag end
  const handlePinDragEnd = (e: L.DragEndEvent) => {
    const marker = e.target;
    const pos = marker.getLatLng();
    const lat = parseFloat(pos.lat.toFixed(6));
    const lon = parseFloat(pos.lng.toFixed(6));

    const nearest = computeNearestStation(lat, lon);
    setNearestStationCoords(nearest.coords);

    onChange({
      ...value,
      latitude: lat,
      longitude: lon,
      nearestStationName: nearest.name,
      distanceToStation: nearest.distance,
    });

    void handleReverseGeocode(lat, lon);
  };

  // Handle map click
  const handleMapClick = (lat: number, lon: number) => {
    const cleanLat = parseFloat(lat.toFixed(6));
    const cleanLon = parseFloat(lon.toFixed(6));

    const nearest = computeNearestStation(cleanLat, cleanLon);
    setNearestStationCoords(nearest.coords);

    onChange({
      ...value,
      latitude: cleanLat,
      longitude: cleanLon,
      nearestStationName: nearest.name,
      distanceToStation: nearest.distance,
    });

    void handleReverseGeocode(cleanLat, cleanLon);
  };

  // GPS Locate current position
  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lon = parseFloat(pos.coords.longitude.toFixed(6));
        const nearest = computeNearestStation(lat, lon);
        setNearestStationCoords(nearest.coords);

        onChange({
          ...value,
          latitude: lat,
          longitude: lon,
          nearestStationName: nearest.name,
          distanceToStation: nearest.distance,
        });

        void handleReverseGeocode(lat, lon);
        setIsLocatingUser(false);
      },
      () => {
        setIsLocatingUser(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-3.5">
      {/* 1. Location Search Input with Autocomplete */}
      <div className="relative" ref={searchContainerRef}>
        <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300 text-xs">
          Search Location / Landmark / Address <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search e.g. Bangsar South, KL Sentral, Mid Valley, KLCC..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                onChange({ ...value, address: e.target.value });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handlePerformSearch(searchQuery);
                }
              }}
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none text-xs text-neutral-900 dark:text-white"
            />
          </div>

          <button
            type="button"
            onClick={() => void handlePerformSearch(searchQuery)}
            disabled={isSearching || !searchQuery.trim()}
            className="h-10 px-4 rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 font-semibold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>Search</span>
          </button>

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocatingUser}
            title="Use my current GPS location"
            className="h-10 w-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 flex items-center justify-center transition-all shrink-0 cursor-pointer"
          >
            <Navigation className={`w-4 h-4 ${isLocatingUser ? 'animate-spin text-[#0071e3]' : ''}`} />
          </button>
        </div>

        {/* Search Suggestions Popover */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-[1500] bg-white dark:bg-[#252528] rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden divide-y divide-black/[0.04] dark:divide-white/[0.06] animate-in fade-in zoom-in-95 duration-150">
            {suggestions.map((item) => (
              <button
                key={item.placeId}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="w-full text-left p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/80 transition-colors flex items-start gap-2.5 cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-[#0071e3] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs text-[#1d1d1f] dark:text-white truncate">
                    {item.shortName}
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1">
                    {item.displayName}
                  </div>
                  <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
                    ({item.lat.toFixed(4)}, {item.lon.toFixed(4)})
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Coordinates Numerical Inputs (Latitude / Longitude) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-medium mb-1 text-neutral-600 dark:text-neutral-400 text-[11px]">
            Latitude (Lat) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.000001"
              required
              value={value.latitude || ''}
              onChange={(e) => {
                const lat = parseFloat(e.target.value) || 0;
                const nearest = computeNearestStation(lat, value.longitude);
                setNearestStationCoords(nearest.coords);
                onChange({
                  ...value,
                  latitude: lat,
                  nearestStationName: nearest.name,
                  distanceToStation: nearest.distance,
                });
              }}
              className="w-full h-9 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-xs text-neutral-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1 text-neutral-600 dark:text-neutral-400 text-[11px]">
            Longitude (Lon) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.000001"
              required
              value={value.longitude || ''}
              onChange={(e) => {
                const lon = parseFloat(e.target.value) || 0;
                const nearest = computeNearestStation(value.latitude, lon);
                setNearestStationCoords(nearest.coords);
                onChange({
                  ...value,
                  longitude: lon,
                  nearestStationName: nearest.name,
                  distanceToStation: nearest.distance,
                });
              }}
              className="w-full h-9 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#0071e3] outline-none font-mono text-xs text-neutral-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* 3. Interactive Leaflet Pinning Map */}
      <div className={`relative rounded-3xl overflow-hidden border border-black/10 dark:border-white/10 shadow-sm w-full bg-neutral-100 dark:bg-neutral-900 ${mapHeightClassName || 'h-80 sm:h-96'}`}>
        <MapContainer
          center={[value.latitude || 3.139, value.longitude || 101.6869]}
          zoom={15}
          style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}
          zoomControl={false}
        >
          <TileLayer
            key={basemapStyle}
            url={
              cartoApiKey
                ? `https://{s}.basemaps.cartocdn.com/${basemapStyle}/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`
                : `https://{s}.basemaps.cartocdn.com/${basemapStyle}/{z}/{x}/{y}{r}.png`
            }
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          />

          <ZoomControl position="bottomright" />

          <MapSizeInvalidator />
          <MapCenterController lat={value.latitude || 3.139} lon={value.longitude || 101.6869} />
          <MapClickInterceptor onMapClick={handleMapClick} />

          {/* Draggable Parking Pin */}
          <Marker
            position={[value.latitude || 3.139, value.longitude || 101.6869]}
            draggable={true}
            icon={parkingPinIcon}
            eventHandlers={{
              dragend: handlePinDragEnd,
            }}
          >
            <Popup autoPan={false}>
              <div className="text-xs p-1 text-center font-sans">
                <strong className="block text-[#0071e3] font-bold">
                  {lotName || 'Your Parking Location'}
                </strong>
                <span className="text-[10px] text-neutral-500">
                  Drag pin or click map to reposition
                </span>
              </div>
            </Popup>
          </Marker>

          {/* Nearest Transit Station Marker & Line */}
          {nearestStationCoords && value.nearestStationName && (
            <>
              <Marker
                position={[nearestStationCoords.lat, nearestStationCoords.lon]}
                icon={transitStationIcon}
              >
                <Popup autoPan={false}>
                  <div className="text-xs p-1">
                    <strong className="block text-emerald-600 font-bold">
                      {value.nearestStationName}
                    </strong>
                    <span className="text-[10px] text-neutral-500">
                      {value.distanceToStation}m direct to parking
                    </span>
                  </div>
                </Popup>
              </Marker>
              <Polyline
                positions={[
                  [value.latitude, value.longitude],
                  [nearestStationCoords.lat, nearestStationCoords.lon],
                ]}
                color="#059669"
                dashArray="6, 8"
                weight={2.5}
                opacity={0.8}
              />
            </>
          )}
        </MapContainer>

        {/* Map Overlay Instruction Pill (positioned at top-right to prevent any overlap with controls) */}
        <div className="absolute top-3 right-3 z-[1000] bg-slate-900/85 backdrop-blur-md text-white text-[10px] font-medium px-3.5 py-1.5 rounded-full shadow-md flex items-center gap-1.5 pointer-events-none select-none border border-white/10">
          <Crosshair className="w-3 h-3 text-[#0071e3]" />
          <span>Click map or drag the <strong>P</strong> pin to set exact entrance</span>
        </div>

        {isReverseGeocoding && (
          <div className="absolute bottom-2.5 left-2.5 z-[1000] bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-md text-[#1d1d1f] dark:text-white text-[10px] font-medium px-2.5 py-1 rounded-full shadow flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 animate-spin text-[#0071e3]" />
            <span>Resolving address...</span>
          </div>
        )}
      </div>

      {/* 4. Nearest Transit Station Live Badge */}
      {value.nearestStationName && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1.5 rounded-xl bg-emerald-500/20 shrink-0">
              <Train className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-bold text-xs truncate">
                <span>Nearest Transit: {value.nearestStationName}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono">
                  {value.distanceToStation}m direct
                </span>
              </div>
              <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 truncate">
                ~{Math.max(1, Math.round((value.distanceToStation || 100) / 75))} min walk • Pinned on Transit Map
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-lg bg-emerald-500/20 shrink-0">
            Transit Linked
          </span>
        </div>
      )}
    </div>
  );
};
