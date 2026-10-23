import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Circle,
  GeoJSON,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import stationData from '../data/mrt_lrt_stations.json';
import { ParkingSpot } from '../types';
import { loadRailNetworkData } from '@/services/transitData';
import { watchDeviceLocation } from '@/services/deviceCapabilities';
import { showAlert } from '@/contexts/ModalContext';
import {
  Search,
  Navigation,
  Car,
  Train,
  Clock,
  ChevronRight,
  Layers,
  Loader2,
  LocateFixed,
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

// ---- Distance calculation helper (Haversine formula in km) ----
const distanceBetweenKm = (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
) => {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const latitudeDelta = toRadians(destination.lat - origin.lat);
  const longitudeDelta = toRadians(destination.lng - origin.lng);
  const originLatitude = toRadians(origin.lat);
  const destinationLatitude = toRadians(destination.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

// ---- Custom Marker Icons ----
const parkingIcon = L.divIcon({
  className: 'custom-parking-icon',
  html: `<div style="
    background: #34C759;
    width: 28px; height: 28px;
    border-radius: 50%;
    border: 2.5px solid white;
    box-shadow: 0 0 0 3px rgba(52, 199, 89, 0.25), 0 2px 8px rgba(0,0,0,0.22);
    display: flex; align-items: center; justify-content: center;
    color: white; font-weight: 800; font-size: 11px;
    cursor: pointer;
  ">P</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

const selectedParkingIcon = L.divIcon({
  className: 'custom-parking-icon',
  html: `<div style="
    background: #007AFF;
    width: 30px; height: 30px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 0 0 5px rgba(0, 122, 255, 0.35), 0 2px 8px rgba(0,0,0,0.25);
    display: flex; align-items: center; justify-content: center;
    color: white; font-weight: 800; font-size: 12px;
    cursor: pointer;
  ">P</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -19],
});

// Modern user location pulsing dot icon
const userLocationIcon = L.divIcon({
  className: 'custom-user-location-icon',
  html: `
    <div class="user-marker-pulse-wrapper">
      <div class="user-marker-pulse"></div>
      <div class="user-marker-core"></div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
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
  const ringColor = isSelected ? 'rgba(10,132,255,0.35)' : 'rgba(0,0,0,0.14)';

  return L.divIcon({
    className: 'custom-station-icon',
    html: `<div class="station-icon-hitbox" style="
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
    ">
      <div style="
        background: ${fillColor};
        width: 25px; height: 25px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 0 0 5px ${ringColor}, 0 2px 8px rgba(0,0,0,0.24);
        display: flex; align-items: center; justify-content: center;
        pointer-events: auto;
      "><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="3" width="12" height="14" rx="3"/><path d="M8 20l2-3m6 3-2-3M9 8h6m-6 4h.01m5.99 0h.01"/></svg></div>
    </div>`,
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
  userLocation?: { lat: number; lng: number } | null;
  locationAccuracy?: number | null;
  locationStatus?: 'locating' | 'ready' | 'denied' | 'unavailable';
  onRequestLocation?: () => void;
}

interface MapTarget {
  lat: number;
  lng: number;
  zoom?: number;
  animate?: boolean;
  timestamp?: number;
}

// ---- Map View Controller: Handles programmatic smooth pans and flies without jarring camera jumps ----
function MapViewController({ target }: { target: MapTarget | null }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    if (target.zoom !== undefined) {
      if (target.animate === false) {
        map.setView([target.lat, target.lng], target.zoom);
      } else {
        map.flyTo([target.lat, target.lng], target.zoom, {
          duration: 0.6,
          easeLinearity: 0.3,
        });
      }
    } else {
      // Gentle, calm pan to target keeping existing zoom level
      map.panTo([target.lat, target.lng], {
        animate: true,
        duration: 0.35,
      });
    }
  }, [target, map]);

  return null;
}

// ---- Custom Panes ----
function RailPane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('railPane')) {
      map.createPane('railPane');
      const pane = map.getPane('railPane');
      if (pane) {
        pane.style.zIndex = '625';
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

function UserLocationPane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('userLocationPane')) {
      map.createPane('userLocationPane');
      const pane = map.getPane('userLocationPane');
      if (pane) pane.style.zIndex = '660';
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
      <div className="flex items-center gap-2">
        <div className="w-3.5 h-3.5 rounded-full bg-[#007AFF] ring-2 ring-[#007AFF]/30 border-2 border-white shadow flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
        </div>
        <span className="text-slate-600 font-medium">Your Location</span>
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
  userLocation,
  locationAccuracy,
  locationStatus,
  onRequestLocation,
}: CommuterMapProps) {
  const klCenter: [number, number] = [3.1390, 101.6869];
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(null);
  const [openPanel, setOpenPanel] = useState<'stations' | 'lines' | null>(null);
  const [stationFilter, setStationFilter] = useState('');

  // Active Station Details popup state (guaranteed to render independently of marker re-renders)
  const [activeStationPopup, setActiveStationPopup] = useState<{
    name: string;
    network: string;
    lat: number;
    lng: number;
  } | null>(null);

  // Local fallback location watcher if parent does not provide userLocation
  const [localLocation, setLocalLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [localAccuracy, setLocalAccuracy] = useState<number | null>(null);
  const [localStatus, setLocalStatus] = useState<'locating' | 'ready' | 'denied' | 'unavailable'>('locating');

  useEffect(() => {
    if (userLocation !== undefined) return;

    let isActive = true;
    let stopWatching: (() => void) | undefined;
    setLocalStatus('locating');

    void watchDeviceLocation(
      (pos) => {
        if (!isActive) return;
        setLocalLocation({ lat: pos.lat, lng: pos.lng });
        setLocalAccuracy(pos.accuracy);
        setLocalStatus('ready');
      },
      (err) => {
        if (!isActive) return;
        setLocalStatus(err?.code === 1 ? 'denied' : 'unavailable');
      },
    ).then((stop) => {
      if (isActive) stopWatching = stop;
      else stop();
    });

    return () => {
      isActive = false;
      stopWatching?.();
    };
  }, [userLocation]);

  const effectiveUserLocation = userLocation ?? localLocation;
  const effectiveAccuracy = locationAccuracy ?? localAccuracy;
  const effectiveStatus = locationStatus ?? localStatus;

  // Auto-center on user location when first acquired, if no station is pre-selected
  const hasAutoCenteredOnUserRef = useRef(false);
  useEffect(() => {
    if (effectiveUserLocation && !selectedStationCoords && !hasAutoCenteredOnUserRef.current) {
      hasAutoCenteredOnUserRef.current = true;
      setMapTarget({
        lat: effectiveUserLocation.lat,
        lng: effectiveUserLocation.lng,
        zoom: 14,
        animate: true,
        timestamp: Date.now(),
      });
    }
  }, [effectiveUserLocation, selectedStationCoords]);

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

  const filteredLines: GeoJsonCollection<RailLineFeature> | null = useMemo(() => {
    if (!allLines) return null;
    const filtered = allLines.features.filter(
      (feature) => visibleLines[feature.properties.route_name] === true
    );
    return { type: 'FeatureCollection', features: filtered };
  }, [allLines, visibleLines]);

  const stationIcons = useMemo(createStationIconSet, []);

  // Filter stations: only LRT, MRT, Monorail (exclude KTM Komuter, ERL, etc.)
  const transitStations = useMemo(() => (stationData as any).features.filter((f: any) => {
    const name = f.properties?.name || '';
    const network = f.properties?.network || '';
    const station = f.properties?.station || '';

    return (
      station === 'light_rail' ||
      station === 'monorail' ||
      network?.toLowerCase().includes('mrt') ||
      network?.toLowerCase().includes('lrt') ||
      name?.includes('MRT') ||
      name?.match(/^(AG|SP|KJ|KG|PY|MR)\d/)
    );
  }), []);

  const stationFeatures = useMemo(() => {
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

  const selectedStationKey = normalizeStationKey(selectedStation || '');

  // Keep activeStationPopup in sync when selectedStation or selectedStationCoords changes
  useEffect(() => {
    if (selectedStation && selectedStationCoords) {
      const feat = stationFeatures.find((f: any) =>
        getStationKeys(f).includes(selectedStationKey)
      );
      const network = feat?.properties?.network || '';
      setActiveStationPopup({
        name: selectedStation,
        network,
        lat: selectedStationCoords.lat,
        lng: selectedStationCoords.lng,
      });
    }
  }, [selectedStation, selectedStationCoords, selectedStationKey, stationFeatures]);

  const stationParkingConditions = useMemo(() => {
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

  // Distribute spots with identical coordinates slightly (~18m) so every bay is visible and clickable
  const displaySpots = useMemo(() => {
    const coordCounts = new Map<string, number>();
    const coordIndices = new Map<string, number>();

    spots.forEach((spot) => {
      const key = `${spot.lat.toFixed(5)}:${spot.lng.toFixed(5)}`;
      coordCounts.set(key, (coordCounts.get(key) || 0) + 1);
    });

    return spots.map((spot) => {
      const key = `${spot.lat.toFixed(5)}:${spot.lng.toFixed(5)}`;
      const count = coordCounts.get(key) || 1;
      if (count <= 1) {
        return { ...spot, displayLat: spot.lat, displayLng: spot.lng, siblingCount: 1 };
      }

      const index = coordIndices.get(key) || 0;
      coordIndices.set(key, index + 1);

      const angle = (index / count) * 2 * Math.PI;
      const offsetMeters = 18;
      const latOffset = (offsetMeters / 111320) * Math.sin(angle);
      const lngOffset = (offsetMeters / (111320 * Math.cos((spot.lat * Math.PI) / 180))) * Math.cos(angle);

      return {
        ...spot,
        displayLat: spot.lat + latOffset,
        displayLng: spot.lng + lngOffset,
        siblingCount: count,
      };
    });
  }, [spots]);

  // Get unique station names for the list
  const allNames: string[] = transitStations
    .map((f: any) => String(f.properties?.name || ''))
    .filter((n: string) => n.length > 0);
  const stationNames: string[] = [...new Set<string>(allNames)].sort();

  // Distances from effective user location to stations
  const stationDistances = useMemo(() => {
    if (!effectiveUserLocation) return new Map<string, number>();

    const distances = new Map<string, number>();
    stationFeatures.forEach((feature: any) => {
      const coords = feature.geometry?.coordinates;
      const name = feature.properties?.name || feature.properties?.['name:en'] || '';
      if (coords && coords.length >= 2 && name) {
        const dist = distanceBetweenKm(effectiveUserLocation, { lat: coords[1], lng: coords[0] });
        distances.set(name, dist);
        const norm = normalizeStationKey(name);
        if (norm) distances.set(norm, dist);
      }
    });

    return distances;
  }, [effectiveUserLocation, stationFeatures]);

  // Nearest stations for quick selection
  const nearestStations = useMemo(() => {
    if (!effectiveUserLocation) return [];
    return stationNames
      .map((name) => {
        const dist = stationDistances.get(name) ?? stationDistances.get(normalizeStationKey(name));
        return { name, distance: dist ?? Infinity };
      })
      .filter((s) => s.distance !== Infinity)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
  }, [effectiveUserLocation, stationNames, stationDistances]);

  const filteredList = stationNames.filter((n) =>
    n.toLowerCase().includes(stationFilter.toLowerCase())
  );

  // Station marker click: Smooth gentle pan to center, opens details popup 100% reliably
  const handleStationMarkerClick = (feature: any, e?: any) => {
    if (e?.originalEvent) {
      e.originalEvent.stopPropagation();
    }
    const coords = feature.geometry.coordinates;
    const name = feature.properties?.name || feature.properties?.['name:en'] || 'Unknown Station';
    const network = feature.properties?.network || '';
    if (!coords || coords.length < 2) return;

    onStationSelect(name, coords[1], coords[0]);
    setActiveStationPopup({
      name,
      network,
      lat: coords[1],
      lng: coords[0],
    });
    setOpenPanel(null);

    // Smooth, gentle pan to center the clicked station without violent zooms or double-bounces
    setMapTarget({
      lat: coords[1],
      lng: coords[0],
      zoom: undefined,
      animate: true,
      timestamp: Date.now(),
    });
  };

  // Selecting station from dropdown search list: Pan/fly to station with zoom 15
  const handleListStationClick = (name: string) => {
    const normalizedTarget = normalizeStationKey(name);
    const feature = stationFeatures.find((f: any) => getStationKeys(f).includes(normalizedTarget));
    if (feature) {
      const coords = feature.geometry.coordinates;
      const net = feature.properties?.network || '';
      if (!coords || coords.length < 2) return;
      onStationSelect(name, coords[1], coords[0]);
      setActiveStationPopup({
        name,
        network: net,
        lat: coords[1],
        lng: coords[0],
      });
      setOpenPanel(null);
      setMapTarget({
        lat: coords[1],
        lng: coords[0],
        zoom: 15,
        animate: true,
        timestamp: Date.now(),
      });
    }
  };

  const handleLocateUser = () => {
    if (effectiveUserLocation) {
      setMapTarget({
        lat: effectiveUserLocation.lat,
        lng: effectiveUserLocation.lng,
        zoom: 15,
        animate: true,
        timestamp: Date.now(),
      });
    } else {
      onRequestLocation?.();
      if (effectiveStatus === 'denied') {
        void showAlert({
          title: 'Location Permission Denied',
          message: 'Please allow location permissions in your browser or device settings to view your current location on the map.',
          variant: 'warning',
        });
      }
    }
  };

  const handleSelectClosestStation = () => {
    if (!effectiveUserLocation || stationFeatures.length === 0) return;

    let closestFeature: any = null;
    let minDistance = Infinity;

    stationFeatures.forEach((feature: any) => {
      const coords = feature.geometry?.coordinates;
      if (coords && coords.length >= 2) {
        const dist = distanceBetweenKm(effectiveUserLocation, { lat: coords[1], lng: coords[0] });
        if (dist < minDistance) {
          minDistance = dist;
          closestFeature = feature;
        }
      }
    });

    if (closestFeature) {
      const coords = closestFeature.geometry.coordinates;
      const name = closestFeature.properties?.name || closestFeature.properties?.['name:en'] || 'Station';
      const net = closestFeature.properties?.network || '';
      setActiveStationPopup({
        name,
        network: net,
        lat: coords[1],
        lng: coords[0],
      });
      setMapTarget({
        lat: coords[1],
        lng: coords[0],
        zoom: 15,
        animate: true,
        timestamp: Date.now(),
      });
      onStationSelect(name, coords[1], coords[0]);
    }
  };

  // ---- Toggle visibility of a line ----
  const handleLineToggle = (routeName: string) => {
    setVisibleLines((prev) => ({
      ...prev,
      [routeName]: !prev[routeName],
    }));
  };

  // Show parking spots whenever a station is selected
  const shouldShowParking = Boolean(selectedStation && selectedStationCoords);

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
        {/* CartoDB Dataviz Light Tile Layer */}
        <TileLayer
          url={
            import.meta.env.VITE_CARTO_API_KEY
              ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${import.meta.env.VITE_CARTO_API_KEY}`
              : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
          }
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        />

        {/* Custom panes */}
        <RailPane />
        <StationPane />
        <UserLocationPane />

        {/* Map View Controller for smooth animated centering */}
        <MapViewController target={mapTarget} />

        {/* Station Search Radius Circle on the Map */}
        {selectedStationCoords && (
          <Circle
            center={[selectedStationCoords.lat, selectedStationCoords.lng]}
            radius={distanceRadius}
            pathOptions={{
              color: '#007AFF',
              fillColor: '#007AFF',
              fillOpacity: 0.05,
              weight: 1.5,
              dashArray: '6 6',
              interactive: false,
            }}
          />
        )}

        {/* ---- GTFS Rail Lines (GeoJSON LineStrings) ----
            interactive: false inside style prevents rail line paths from blocking clicks on stations on PC view */}
        {filteredLines && (
          <GeoJSON
            key={JSON.stringify(visibleLines)}
            data={filteredLines}
            pane="railPane"
            style={(feature) => ({
              color: feature?.properties?.route_color || '#3388ff',
              weight: 5,
              opacity: 0.85,
              interactive: false,
            })}
          />
        )}

        <ZoomControl position="bottomright" />

        {/* Polyline connecting selected station to selected parking spot */}
        {selectedStationCoords && selectedSpot && (
          <Polyline
            positions={[
              [selectedStationCoords.lat, selectedStationCoords.lng],
              [selectedSpot.lat, selectedSpot.lng],
            ]}
            pathOptions={{ color: '#007AFF', weight: 4, opacity: 0.9, dashArray: '8 10', interactive: false }}
          />
        )}

        {/* ---- Render User Current Location Marker & Accuracy Circle ---- */}
        {effectiveUserLocation && (
          <>
            {effectiveAccuracy && effectiveAccuracy > 0 && effectiveAccuracy <= 2000 && (
              <Circle
                center={[effectiveUserLocation.lat, effectiveUserLocation.lng]}
                radius={effectiveAccuracy}
                pathOptions={{
                  color: '#007AFF',
                  fillColor: '#007AFF',
                  fillOpacity: 0.1,
                  weight: 1.5,
                  opacity: 0.35,
                  interactive: false,
                }}
              />
            )}
            <Marker
              position={[effectiveUserLocation.lat, effectiveUserLocation.lng]}
              icon={userLocationIcon}
              pane="userLocationPane"
              zIndexOffset={1000}
            >
              <Popup autoPan={true}>
                <div className="text-xs min-w-[160px] py-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#007AFF] shadow-xs" />
                    <span>Your Current Location</span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-1">
                    {effectiveAccuracy
                      ? `Accurate to ~${Math.round(effectiveAccuracy)} m`
                      : 'GPS position active'}
                  </p>
                  <div className="mt-1 text-[10px] text-slate-400 font-mono">
                    {effectiveUserLocation.lat.toFixed(5)}, {effectiveUserLocation.lng.toFixed(5)}
                  </div>
                  {stationFeatures.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectClosestStation();
                      }}
                      className="mt-2.5 w-full flex items-center justify-center gap-1.5 bg-[#007AFF] hover:bg-[#0066D6] text-white text-[11px] font-semibold py-1.5 px-2.5 rounded-lg transition-colors shadow-xs"
                    >
                      <Train className="w-3.5 h-3.5" />
                      <span>Select Nearest Station</span>
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Render Transit Station Markers */}
        {stationFeatures.map((feature: any, idx: number) => {
          const coords = feature.geometry.coordinates;
          const name = feature.properties?.name || feature.properties?.['name:en'] || '';
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
                click: (e) => handleStationMarkerClick(feature, e),
              }}
            >
              <Tooltip direction="top" offset={[0, -18]} className="station-tooltip">
                <span>{name}</span>
              </Tooltip>
            </Marker>
          );
        })}

        {/* Active Station Details Popup: Guaranteed to show independently of marker DOM node lifecycles */}
        {activeStationPopup && (
          <Popup
            position={[activeStationPopup.lat, activeStationPopup.lng]}
            autoPan={true}
            closeButton={true}
            eventHandlers={{ remove: () => setActiveStationPopup(null) }}
          >
            <div className="text-xs min-w-[170px] py-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-sm">
                <Train className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">{activeStationPopup.name}</span>
              </div>
              <p className="text-slate-500 text-[11px] mt-0.5 ml-5">
                {activeStationPopup.network || 'Transit Station'}
              </p>
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-emerald-600">
                  {spots.length} bay{spots.length === 1 ? '' : 's'} in range
                </span>
                <span className="text-[10px] text-slate-400">
                  Within {distanceRadius < 1000 ? `${distanceRadius}m` : `${distanceRadius / 1000}km`}
                </span>
              </div>
            </div>
          </Popup>
        )}

        {/* Render ALL available parking spots in range of selected station */}
        {shouldShowParking && displaySpots.map((spot) => {
          const isThisSelected = selectedSpot?.id === spot.id;
          return (
            <Marker
              key={spot.id}
              position={[spot.displayLat, spot.displayLng]}
              icon={isThisSelected ? selectedParkingIcon : parkingIcon}
              zIndexOffset={isThisSelected ? 800 : 500}
              eventHandlers={{ click: () => onSpotClick(spot) }}
            >
              <Popup autoPan={true}>
                <div className="text-xs min-w-[190px]">
                  <div className="flex items-center justify-between gap-1">
                    <strong className="text-slate-800 text-sm">{spot.name}</strong>
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                      Bay {spot.parkingLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-600 mt-1 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>
                      {spot.dailyRate !== null
                        ? `RM ${spot.dailyRate.toFixed(2)}/day`
                        : spot.monthlyRate > 0
                          ? `RM ${spot.monthlyRate.toFixed(2)}/month`
                          : 'Rate not set'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 mt-0.5">
                    <Navigation className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span>
                      {spot.distanceToStation ? spot.distanceToStation.toFixed(2) : (spot.distance / 1000).toFixed(2)} km to {selectedStation || 'station'}
                      {spot.timeToStationInMinutes ? ` · ${spot.timeToStationInMinutes} min walk` : ''}
                    </span>
                  </div>
                  {spot.siblingCount > 1 && (
                    <div className="mt-1 text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      1 of ${spot.siblingCount} available bays at this property
                    </div>
                  )}
                  <p className="mt-1 text-[10px] text-slate-400 leading-tight">{spot.address}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSpotClick(spot);
                      navigate(`/commuter/parking/${spot.id}`, {
                        state: {
                          spot: {
                            ...spot,
                            id: spot.id,
                            lat: spot.lat,
                            lon: spot.lng,
                            address: spot.address,
                            photoUrl: spot.primaryImageUrl ?? '',
                            price: spot.pricePerHour,
                          },
                          stationCoords: selectedStationCoords
                            ? { lat: selectedStationCoords.lat, lon: selectedStationCoords.lng }
                            : null,
                          stationName: spot.station || selectedStation,
                        },
                      });
                    }}
                    className="mt-2.5 w-full bg-[#007AFF] hover:bg-[#0066D6] text-white text-[11px] font-bold py-1.5 px-3 rounded-lg transition-colors shadow-xs"
                  >
                    View Details &amp; Book
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
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

      {/* Top Bar: Station Search & Filter (Strictly clean 3 controls, no extra wrapped buttons) */}
      <div className="map-toolbar absolute top-4 left-4 right-4 z-[1000] flex items-center gap-2">
        {/* Station Selector Button */}
        <button
          type="button"
          data-map-control
          onClick={() => setOpenPanel((panel) => panel === 'stations' ? null : 'stations')}
          aria-expanded={openPanel === 'stations'}
          aria-controls="station-picker"
          className="map-toolbar__station bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-lg px-4 py-2.5 flex items-center gap-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Train className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="truncate">{selectedStation || 'Select Station'}</span>
          <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${openPanel === 'stations' ? 'rotate-90' : ''}`} />
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

      {/* Floating My Location Button (Neatly placed directly above bottom-right zoom controls) */}
      <button
        type="button"
        onClick={handleLocateUser}
        title={effectiveUserLocation ? 'Center map on your location' : 'Locate your current position'}
        aria-label={effectiveUserLocation ? 'Center map on your location' : 'Locate your current position'}
        className={`map-relocate-btn ${
          effectiveUserLocation ? 'text-blue-600 border-blue-300 bg-blue-50/70' : 'text-slate-600'
        }`}
      >
        {effectiveStatus === 'locating' ? (
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        ) : (
          <LocateFixed className={`w-4 h-4 ${effectiveUserLocation ? 'text-blue-600' : 'text-slate-500'}`} />
        )}
      </button>

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

          {/* Quick select: nearest stations */}
          {effectiveUserLocation && !stationFilter && nearestStations.length > 0 && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/60">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
                <Navigation className="w-3 h-3 text-blue-600" />
                Nearest to you
              </div>
              <div className="space-y-0.5 mt-1">
                {nearestStations.map((station) => (
                  <button
                    key={`nearest-${station.name}`}
                    onClick={() => handleListStationClick(station.name)}
                    className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-white hover:shadow-xs transition-all flex items-center justify-between text-slate-700"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Train className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate font-medium">{station.name}</span>
                    </div>
                    <span className="text-[10px] text-blue-600 font-semibold shrink-0 ml-2">
                      {station.distance < 1 ? `${Math.round(station.distance * 1000)}m` : `${station.distance.toFixed(1)}km`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="map-station-dropdown__list overflow-y-auto">
            {filteredList.slice(0, 50).map((name) => {
              const distance = stationDistances.get(name) ?? stationDistances.get(normalizeStationKey(name));
              return (
                <button
                  key={name}
                  onClick={() => handleListStationClick(name)}
                  className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center justify-between ${
                    selectedStation === name ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Train className={`w-3.5 h-3.5 shrink-0 ${selectedStation === name ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="truncate">{name}</span>
                  </div>
                  {distance !== undefined && (
                    <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">
                      {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                    </span>
                  )}
                </button>
              );
            })}
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
