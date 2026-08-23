import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoJSON, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import stationData from '../data/mrt_lrt_stations.json';
import { ParkingSpot } from '../types';
import { loadRailNetworkData } from '@/services/transitData';
import {
  Search, Navigation, Car, Train,
  Clock, ChevronRight, Layers, Loader2
} from 'lucide-react';

// ---- GTFS GeoJSON types ----
interface RailLineFeature {
  type: 'Feature';
  properties: { route_id: string; route_name: string; route_color: string };
  geometry: { type: 'LineString'; coordinates: [number, number][] };
}
interface RailStopFeature {
  type: 'Feature';
  properties: { stop_id: string; stop_name: string };
  geometry: { type: 'Point'; coordinates: [number, number] };
}
interface GeoJsonCollection<T> {
  type: 'FeatureCollection';
  features: T[];
}

// ---- Custom Marker Icons ----
const parkingIcon = L.divIcon({
  className: 'custom-parking-icon',
  html: `<div style="
    background: #34C759;
    width: 28px; height: 28px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    display: flex; align-items: center; justify-content: center;
  "><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 20V4h5.5a4 4 0 010 8H8"/></svg></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18],
});

const normalizeStationKey = (value: string) => value.trim().toLowerCase().replace(/\s+(lrt|mrt)$/i, '');

const stationStatusPalette = {
  default: '#007AFF',
  selected: '#0A84FF',
  available: '#248a3d',
  full: '#d97706',
  unknown: '#94a3b8',
} as const;

type StationParkingCondition = 'available' | 'full' | 'unknown';

const buildStationIcon = (isSelected: boolean, condition: StationParkingCondition) => {
  const fillColor = isSelected
    ? stationStatusPalette.selected
    : condition === 'available'
      ? stationStatusPalette.available
      : condition === 'full'
        ? stationStatusPalette.full
        : stationStatusPalette.default;
  const ringColor = isSelected ? 'rgba(10,132,255,0.25)' : 'rgba(0,0,0,0.12)';

  return L.divIcon({
    className: 'custom-station-icon',
    html: `<div style="
      background: ${fillColor};
      width: 24px; height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 0 5px ${ringColor}, 0 2px 8px rgba(0,0,0,0.24);
      display: flex; align-items: center; justify-content: center;
    "><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="3" width="12" height="14" rx="3"/><path d="M8 20l2-3m6 3-2-3M9 8h6m-6 4h.01m5.99 0h.01"/></svg></div>`,
    // Keep a generous invisible hit area around the small visual marker. This
    // makes desktop pointer selection as forgiving as the mobile touch target.
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

const createStationIconSet = () => ({
  selected: buildStationIcon(true, 'unknown'),
  available: buildStationIcon(false, 'available'),
  full: buildStationIcon(false, 'full'),
  unknown: buildStationIcon(false, 'unknown'),
});

// ---- Props ----
interface CommuterMapProps {
  spots: ParkingSpot[];
  onStationSelect: (stationName: string, lat: number, lng: number) => void;
  selectedStation: string | null;
  selectedStationCoords: { lat: number; lng: number } | null;
  selectedSpot: ParkingSpot | null;
  onSpotClick: (spot: ParkingSpot) => void;
  distanceRadius: number;
  onDistanceRadiusChange: (radius: number) => void;
}

// ---- Focus component — jumps to the selected station without a bounce animation ----
function FlyToStation({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 15, { animate: false });
  }, [lat, lng, map]);
  return null;
}

function FocusSelectedRoute({
  station,
  spot,
}: {
  station: { lat: number; lon: number };
  spot: ParkingSpot;
}) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(
      [[station.lat, station.lon], [spot.lat, spot.lng]],
      { padding: [72, 72], maxZoom: 16, animate: false },
    );
  }, [map, spot.id, spot.lat, spot.lng, station.lat, station.lon]);

  return null;
}

// ---- Creates a custom pane above markers so rail lines/stops render on top ----
function RailPane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('railPane')) {
      map.createPane('railPane');
      const pane = map.getPane('railPane');
      if (pane) {
        pane.style.zIndex = '625'; // above markerPane (600), below popupPane (700)
        pane.style.pointerEvents = 'none';
      }
    }
  }, [map]);
  return null;
}

function StationPane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('stationPane')) {
      map.createPane('stationPane');
      const pane = map.getPane('stationPane');
      if (pane) pane.style.zIndex = '650';
    }
  }, [map]);
  return null;
}

// ---- Route name mapping: route_id code → display name ----
const ROUTE_NAME_MAP: Record<string, string> = {
  AGL: 'Ampang Line',
  KJL: 'Kelana Jaya Line',
  SPL: 'Sri Petaling Line',
  KGL: 'Kajang Line',
  PYL: 'Putrajaya Line',
  MRL: 'KL Monorail',
  BRT: 'BRT Sunway Line',
  SAL: 'Shah Alam Line',
};

const getStationKeys = (feature: any) => {
  const coordinates = feature.geometry?.coordinates;
  const rawName = String(feature.properties?.name || feature.properties?.['name:en'] || '');
  const rawRef = String(feature.properties?.ref || '');
  const keys = new Set<string>();

  [rawRef, rawName].forEach((value) => {
    const normalized = normalizeStationKey(value);
    if (normalized) keys.add(normalized);
  });

  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    keys.add(`${coordinates[1]?.toFixed?.(5) ?? coordinates[1]}:${coordinates[0]?.toFixed?.(5) ?? coordinates[0]}`);
  }

  return [...keys];
};

// ---- LineControlPanel: rail line visibility control panel ----
function LineControlPanel({
  visibleLines,
  onToggle,
  showHeader = true,
}: {
  visibleLines: Record<string, boolean>;
  onToggle: (routeName: string) => void;
  showHeader?: boolean;
}) {
  return (
    <div
      className={`${showHeader ? 'absolute top-[68px] left-4 z-[1000]' : ''} line-control-panel bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-lg p-3 text-xs min-w-[180px] w-auto`}
    >
      {showHeader && (
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-bold text-slate-700">Rail Lines</span>
        </div>
      )}
      <div className="space-y-1.5 max-h-[260px] md:max-h-[300px] overflow-y-auto">
        {Object.keys(visibleLines).map((routeName) => {
          const displayName = ROUTE_NAME_MAP[routeName] || routeName;
          const isChecked = visibleLines[routeName];
          return (
            <label
              key={routeName}
              className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors select-none"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(routeName)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-200 focus:ring-2 accent-blue-600"
              />
              <span
                className={`font-medium leading-tight ${
                  isChecked ? 'text-slate-800' : 'text-slate-400'
                }`}
              >
                {displayName}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ---- Legend Overlay ----
function MapLegend() {
  return (
    <div className="map-legend absolute bottom-[100px] right-6 z-[1000] bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-lg p-3 text-[10px] space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-5 h-1 rounded-full bg-[#3388ff]" />
        <span className="text-slate-600 font-medium">Rail Line</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-white border border-slate-700" />
        <span className="text-slate-600 font-medium">Rail Stop</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-[#007AFF] border-2 border-white shadow flex items-center justify-center" aria-hidden="true"><Train size={8} className="text-white" /></div>
        <span className="text-slate-600 font-medium">LRT/MRT Station</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-[#007AFF] ring-2 ring-[#007AFF]/20 border-2 border-white shadow flex items-center justify-center" aria-hidden="true"><Train size={8} className="text-white" /></div>
        <span className="text-slate-600 font-medium">Selected Station</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-[#34C759] border-2 border-white shadow flex items-center justify-center text-[8px] text-white font-black">P</div>
        <span className="text-slate-600 font-medium">Available Parking</span>
      </div>
    </div>
  );
}

// ---- Main CommuterMap Component ----
export default function CommuterMap({
  spots,
  onStationSelect,
  selectedStation,
  selectedStationCoords,
  selectedSpot,
  onSpotClick,
  distanceRadius,
  onDistanceRadiusChange,
}: CommuterMapProps) {
  const klCenter: [number, number] = [3.1390, 101.6869];
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [openPanel, setOpenPanel] = useState<'stations' | 'lines' | null>(null);
  const [stationFilter, setStationFilter] = useState('');

  // react-router navigation
  const navigate = useNavigate();

  // ---- GTFS Rail Lines: full source data (read-only) ----
  const [allLines, setAllLines] = useState<GeoJsonCollection<RailLineFeature> | null>(null);

  // ---- Line visibility map: route_name → boolean, all visible by default ----
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({});

  const [gtfsLoading, setGtfsLoading] = useState(true);
  const [gtfsError, setGtfsError] = useState<string | null>(null);

  // ---- Load GTFS data, initialize allLines and visibleLines ----
  useEffect(() => {
    async function loadGtfsData() {
      try {
        const { lines } = await loadRailNetworkData();
        const linesData = lines as GeoJsonCollection<RailLineFeature>;
        setAllLines(linesData);

        // Extract all unique route_names from data, all enabled by default
        const uniqueRoutes = [
          ...new Set<string>(linesData.features.map((f: RailLineFeature) => f.properties.route_name)),
        ];
        const initVisible: Record<string, boolean> = {};
        uniqueRoutes.forEach((route) => {
          initVisible[route] = true;
        });
        setVisibleLines(initVisible);

        setGtfsLoading(false);
      } catch (err: any) {
        setGtfsError(err.message);
        setGtfsLoading(false);
      }
    }
    loadGtfsData();
  }, []);

  // ---- Compute filteredLines directly during render (no useEffect to avoid GeoJSON stale redraw) ----
  const filteredLines: GeoJsonCollection<RailLineFeature> | null = React.useMemo(() => {
    if (!allLines) return null;
    const filtered = allLines.features.filter(
      (feature) => visibleLines[feature.properties.route_name] === true
    );
    return { type: 'FeatureCollection', features: filtered };
  }, [allLines, visibleLines]);

  const stationIcons = React.useMemo(createStationIconSet, []);

  // Filter stations: only LRT, MRT, Monorail (exclude KTM Komuter, ERL, etc.)
  const transitStations = React.useMemo(() => (stationData as any).features.filter((f: any) => {
    const name = f.properties?.name || '';
    const network = f.properties?.network || '';
    const station = f.properties?.station || '';

    // Keep only LRT, MRT, Monorail stations
    return (
      station === 'light_rail' ||
      station === 'monorail' ||
      network?.toLowerCase().includes('mrt') ||
      network?.toLowerCase().includes('lrt') ||
      name?.includes('MRT') ||
      name?.match(/^(AG|SP|KJ|KG|PY|MR)\d/) // LRT/MRT/Monorail station codes
    );
  }), []);

  const stationFeatures = React.useMemo(() => {
    const deduped = new Map<string, any>();

    transitStations.forEach((feature: any) => {
      const coordinates = feature.geometry?.coordinates;
      const rawName = String(feature.properties?.name || feature.properties?.['name:en'] || '');
      const rawRef = String(feature.properties?.ref || '');
      const key = normalizeStationKey(rawRef || rawName)
        || (Array.isArray(coordinates) ? `${coordinates[1]?.toFixed?.(5) ?? coordinates[1]}:${coordinates[0]?.toFixed?.(5) ?? coordinates[0]}` : rawName);

      if (!deduped.has(key)) {
        deduped.set(key, feature);
      }
    });

    return [...deduped.values()];
  }, [transitStations]);

  const stationParkingConditions = React.useMemo(() => {
    const conditionByStation = new Map<string, StationParkingCondition>();
    const groupedByStation = new Map<string, ParkingSpot[]>();

    spots.forEach((spot) => {
      const stationKeys = [spot.stationName, spot.station].flatMap((value) => {
        const normalized = normalizeStationKey(value || '');
        return normalized ? [normalized] : [];
      });

      stationKeys.forEach((key) => {
        const current = groupedByStation.get(key) ?? [];
        current.push(spot);
        groupedByStation.set(key, current);
      });
    });

    groupedByStation.forEach((stationSpots, key) => {
      const hasAvailable = stationSpots.some((spot) => spot.available);
      conditionByStation.set(key, hasAvailable ? 'available' : 'full');
    });

    stationFeatures.forEach((feature: any) => {
      getStationKeys(feature).forEach((key) => {
        if (!conditionByStation.has(key)) {
          conditionByStation.set(key, 'unknown');
        }
      });
    });

    return conditionByStation;
  }, [spots, stationFeatures]);

  // Get unique station names for the list
  const allNames: string[] = transitStations
    .map((f: any) => String(f.properties?.name || ''))
    .filter((n: string) => n.length > 0);
  const stationNames: string[] = [...new Set<string>(allNames)].sort();

  const filteredList = stationNames.filter(n =>
    n.toLowerCase().includes(stationFilter.toLowerCase())
  );

  const selectedStationKey = normalizeStationKey(selectedStation || '');

  const handleStationClick = (feature: any) => {
    const coords = feature.geometry.coordinates;
    const name = feature.properties?.name || feature.properties?.['name:en'] || 'Unknown Station';
    if (!coords || coords.length < 2) {
      console.warn('Invalid station coordinates');
      return;
    }
    setFlyToCoords([coords[1], coords[0]]);
    onStationSelect(name, coords[1], coords[0]);
    setOpenPanel(null);
  };

  const handleListStationClick = (name: string) => {
    const normalizedTarget = normalizeStationKey(name);
    const feature = stationFeatures.find((f: any) => getStationKeys(f).includes(normalizedTarget));
    if (feature) {
      const coords = feature.geometry.coordinates;
      if (!coords || coords.length < 2) return;
      setFlyToCoords([coords[1], coords[0]]);
      onStationSelect(name, coords[1], coords[0]);
      setOpenPanel(null);
    }
  };

  // ---- Toggle visibility of a line ----
  const handleLineToggle = (routeName: string) => {
    setVisibleLines((prev) => ({
      ...prev,
      [routeName]: !prev[routeName],
    }));
  };

  // Don't show parking spots until a station is explicitly selected
  const shouldShowParking = !!selectedStation && selectedStation.length > 0 && spots.length > 0;

  useEffect(() => {
    if (!openPanel) return;

    const closeOpenPanel = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-map-control]')) return;
      setOpenPanel(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPanel(null);
    };

    document.addEventListener('pointerdown', closeOpenPanel);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOpenPanel);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openPanel]);

  return (
    <div className="commuter-map relative w-full h-full min-h-[400px] overflow-hidden">
      {/* Map Container */}
      <MapContainer
        center={klCenter}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        {/* CartoDB Dataviz Light Tile Layer — clean light style, suitable for data overlay */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        />

        {/* Custom pane: z-index 625, above markers so rail renders on top of station icons */}
        <RailPane />
        {/* Station markers sit above rail geometry for reliable desktop clicks. */}
        <StationPane />

        {/* ---- GTFS Rail Lines (GeoJSON LineStrings) ----
             Use dynamic key={JSON.stringify(visibleLines)} to force React-Leaflet
             to destroy and rebuild GeoJSON layer on each toggle change ---- */}
        {filteredLines && (
          <GeoJSON
            key={JSON.stringify(visibleLines)}
            data={filteredLines}
            pane="railPane"
            style={(feature) => ({
              color: feature?.properties?.route_color || '#3388ff',
              weight: 5,
              opacity: 0.85,
            })}
          />
        )}

        <ZoomControl position="bottomright" />

        {selectedStationCoords && selectedSpot && (
          <>
            <Polyline
              positions={[
                [selectedStationCoords.lat, selectedStationCoords.lng],
                [selectedSpot.lat, selectedSpot.lng],
              ]}
              pathOptions={{ color: '#007AFF', weight: 4, opacity: 0.9, dashArray: '8 10' }}
            />
            <FocusSelectedRoute
              station={{ lat: selectedStationCoords.lat, lon: selectedStationCoords.lng }}
              spot={selectedSpot}
            />
          </>
        )}

        {/* Render Transit Station Markers */}
        {stationFeatures.map((feature: any, idx: number) => {
          const coords = feature.geometry.coordinates;
          const name = feature.properties?.name || feature.properties?.['name:en'] || '';
          const network = feature.properties?.network || '';
          const stationKeys = getStationKeys(feature);
          const isSelected = stationKeys.includes(selectedStationKey);
          const stationCondition = stationKeys
            .map((key) => stationParkingConditions.get(key))
            .find((value): value is StationParkingCondition => Boolean(value)) ?? 'unknown';

          if (!coords || coords.length < 2) return null;

          return (
            <Marker
              key={`station-${idx}`}
              position={[coords[1], coords[0]]}
              pane="stationPane"
              icon={isSelected ? stationIcons.selected : stationIcons[stationCondition]}
              eventHandlers={{
                click: () => handleStationClick(feature),
              }}
            >
              <Popup>
                <div className="text-xs min-w-[140px]">
                  <strong className="text-slate-800">{name}</strong>
                  <p className="text-slate-500 mt-0.5">{network || 'Transit Station'}</p>
                  <p className="mt-2 text-[10px] font-semibold text-[#007AFF]">Finding nearby bays…</p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Render nearby parking spots returned by the backend */}
        {shouldShowParking && spots.map((spot) => (
          <Marker
            key={spot.id}
            position={[spot.lat, spot.lng]}
            icon={parkingIcon}
            eventHandlers={{ click: () => onSpotClick(spot) }}
          >
            <Popup>
              <div className="text-xs min-w-[180px]">
                <strong className="text-slate-800">{spot.name}</strong>
                <div className="flex items-center gap-1 text-slate-500 mt-1">
                  <Clock className="w-3 h-3" />
                  <span>{spot.dailyRate !== null
                    ? `RM ${spot.dailyRate.toFixed(2)}/day`
                    : spot.monthlyRate > 0
                      ? `RM ${spot.monthlyRate.toFixed(2)}/month`
                      : 'Rate not set'}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500 mt-0.5">
                  <Navigation className="w-3 h-3" />
                  <span>{spot.distanceToStation.toFixed(2)} km · {spot.timeToStationInMinutes} min</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500 mt-0.5">
                  <Car className="w-3 h-3" />
                  <span>Bay {spot.parkingLabel} · {spot.availabilityStatus}</span>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">{spot.address}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSpotClick(spot);
                    navigate(`/commuter/parking/${spot.id}`, {
                      state: {
                        spot: { ...spot, id: spot.id, lat: spot.lat, lon: spot.lng, address: spot.address, photoUrl: spot.primaryImageUrl ?? '', price: spot.pricePerHour },
                        stationCoords: selectedStationCoords
                          ? { lat: selectedStationCoords.lat, lon: selectedStationCoords.lng }
                          : null,
                        stationName: spot.station,
                      },
                    });
                  }}
                  className="mt-2 w-full bg-[#007AFF] hover:bg-[#0066D6] text-white text-[10px] font-bold py-1.5 px-3 rounded-lg transition-colors"
                >
                  View Details &amp; Book
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Fly to selected station */}
        {flyToCoords && <FlyToStation lat={flyToCoords[0]} lng={flyToCoords[1]} />}
      </MapContainer>

      {/* Map Legend */}
      <MapLegend />

      {/* GTFS Data Loading Overlay */}
      {gtfsLoading && (
        <div className="absolute inset-0 z-[1001] bg-white/70 backdrop-blur-sm flex items-center justify-center rounded-2xl">
          <div className="flex items-center gap-3 bg-white border border-slate-200 shadow-lg px-5 py-3 rounded-xl">
            <Loader2 size={20} className="animate-spin text-blue-600" />
            <span className="text-sm font-semibold text-slate-700">Loading map data...</span>
          </div>
        </div>
      )}

      {/* GTFS Error Banner */}
      {gtfsError && (
        <div className="absolute top-16 left-4 right-4 z-[1001] bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2 rounded-lg shadow">
          ⚠️ Rail data unavailable: {gtfsError}
        </div>
      )}

      {/* Top Bar: Station Search & Filter */}
      <div className="map-toolbar absolute top-4 left-4 right-4 z-[1000] flex gap-2">
        {/* Station Selector Button */}
        <button
          type="button"
          data-map-control
          onClick={() => setOpenPanel((panel) => panel === 'stations' ? null : 'stations')}
          aria-expanded={openPanel === 'stations'}
          aria-controls="station-picker"
          className="map-toolbar__station bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-lg px-4 py-2.5 flex items-center gap-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Train className="w-4 h-4 text-blue-600" />
          <span className="truncate">{selectedStation || 'Select Station'}</span>
          <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${openPanel === 'stations' ? 'rotate-90' : ''}`} />
        </button>

        {/* Radius Filter — auto-refilters nearby spots on change */}
        <select
          value={distanceRadius}
          onChange={(e) => {
            onDistanceRadiusChange(Number(e.target.value));
          }}
          aria-label="Parking search radius"
          className="map-toolbar__radius bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-lg px-3 py-2.5 text-xs font-semibold text-slate-600 focus:outline-none"
        >
          <option value={300}>Within 300m</option>
          <option value={500}>Within 500m</option>
          <option value={1000}>Within 1km</option>
          <option value={2000}>Within 2km</option>
          <option value={3000}>Within 3km</option>
          <option value={5000}>Within 5km</option>
        </select>

        <div className="map-lines-control relative flex flex-col items-start" data-map-control>
          <button
            type="button"
            onClick={() => setOpenPanel((panel) => panel === 'lines' ? null : 'lines')}
            aria-expanded={openPanel === 'lines'}
            aria-controls="rail-lines-panel"
            className="workspace-map-control flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur hover:bg-slate-50"
          >
            <Layers className="h-4 w-4 text-blue-600" />
            Lines
            <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform ${openPanel === 'lines' ? 'rotate-90' : ''}`} />
          </button>

          {openPanel === 'lines' && (
            <div id="rail-lines-panel" className="map-lines-control__panel origin-top-left animate-slide-up">
              <LineControlPanel
                visibleLines={visibleLines}
                onToggle={handleLineToggle}
                showHeader={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* Station List Dropdown */}
      {openPanel === 'stations' && (
        <div id="station-picker" data-map-control className="map-station-dropdown absolute top-[60px] left-4 z-[1000] w-72 bg-white/98 backdrop-blur rounded-xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter stations..."
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
              />
            </div>
          </div>
          <div className="map-station-dropdown__list overflow-y-auto">
            {filteredList.slice(0, 50).map((name) => (
              <button
                key={name}
                onClick={() => handleListStationClick(name)}
                className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center gap-2 ${
                  selectedStation === name ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'
                }`}
              >
                <Train className={`w-3.5 h-3.5 ${selectedStation === name ? 'text-blue-600' : 'text-slate-400'}`} />
                {name}
              </button>
            ))}
            {filteredList.length === 0 && (
              <div className="px-4 py-4 text-xs text-slate-400 text-center">
                No stations found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
