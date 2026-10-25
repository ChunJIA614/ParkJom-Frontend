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
  useMap,
  ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import stationData from '../data/mrt_lrt_stations.json';
import { ParkingSpot, Booking } from '../types';
import { loadRailNetworkData } from '@/services/transitData';
import { watchDeviceLocation } from '@/services/deviceCapabilities';
import { showAlert } from '@/contexts/ModalContext';
import { useTheme } from '@/app/theme/ThemeContext';
import SystemSelect from '@/components/ui/SystemSelect';
import StationPickerSheet from './StationPickerSheet';
import {
  Search,
  Navigation,
  Train,
  Clock,
  ChevronDown,
  Layers,
  Loader2,
  LocateFixed,
  Info,
  Bus,
  Compass,
  Footprints,
  Sparkles,
  Zap,
  Car,
  ExternalLink,
  X,
} from 'lucide-react';
import {
  RealtimeGeoJsonCollection,
  getRealtimeVehiclesGeoJson,
} from '@/services/gtfsRealtimeApi';
import {
  getAllRapidBusRoutes,
  getRapidBusRoute,
  normalizeBusRouteCode,
  findConnectingBusRoutes,
  findRoutesServingStation,
  distanceMetersBetween,
  RapidBusRoute,
  ConnectingBusRouteResult,
} from '@/services/rapidBusService';
import {
  planMultimodalJourney,
  MultimodalPlanResult,
  MultimodalItinerary,
  CommuterPreference,
} from '@/services/multimodalRoutingService';
import {
  calculateDrivingRoute,
  DrivingRouteResult,
} from '@/services/drivingRouteService';
import { formatShortSpotName, formatShortAddress } from '../lib/formatUtils';
import StationFeedersWidget from './StationFeedersWidget';
import LinearJourneyNavigator from './LinearJourneyNavigator';

// ---- GTFS GeoJSON types ----
interface RailLineFeature {
  type: 'Feature';
  properties: { route_id: string; route_name: string; route_color: string };
  geometry: { type: 'LineString'; coordinates: [number, number][] };
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

// ---- Official Line Colors & Design Specification ----
export const TRANSIT_LINE_COLORS: Record<string, { name: string; color: string; code: string }> = {
  KJ: { name: 'Kelana Jaya', color: '#D9248A', code: 'KJ' },
  AG: { name: 'Ampang', color: '#F59E0B', code: 'AG' },
  SP: { name: 'Sri Petaling', color: '#8E2A4E', code: 'SP' },
  KG: { name: 'Kajang Line', color: '#059669', code: 'KG' },
  PY: { name: 'Putrajaya Line', color: '#FFCD00', code: 'PY' },
  MR: { name: 'KL Monorail', color: '#84BD00', code: 'MR' },
  SA: { name: 'Shah Alam Line', color: '#FF00FF', code: 'SA' },
  KT: { name: 'KLIA Transit / Ekspres', color: '#7B1FA2', code: 'KT' },
  BRT: { name: 'BRT Sunway', color: '#115740', code: 'BRT' },
};

export function cleanStationName(rawName: string): string {
  if (!rawName) return '';
  return rawName
    .replace(/^(?:(?:(?:AG|SP|KJ|KG|PY|MR|SA|KT|KB|KC|KA|KD)\d{1,3}[A-Z]?|ERL|BRT)\s*[\/-]?\s*)+/i, '')
    .replace(/\s+(?:LRT|MRT|Station|Komuter Station)$/i, '')
    .replace(/\s*\((?:LRT|MRT|Monorail|Komuter)\)$/i, '')
    .trim() || rawName;
}

export function getStationCode(feature: any): string {
  const p = feature?.properties || {};
  if (p.ref && typeof p.ref === 'string') {
    const m = p.ref.match(/\b(KJ|AG|SP|KG|PY|MR|SA)\d+\b/i);
    if (m) return m[0].toUpperCase();
    return p.ref.split(';')[0].trim().toUpperCase();
  }
  const name = String(p.name || '');
  const m = name.match(/\b(KJ|AG|SP|KG|PY|MR|SA)\d+\b/i);
  if (m) return m[0].toUpperCase();
  return '';
}

export function getStationLines(feature: any): string[] {
  const p = feature.properties || {};
  const name = String(p.name || '');
  const ref = String(p.ref || '');
  const network = String(p.network || '');
  const combined = (name + ' ' + ref + ' ' + network);

  const matched: string[] = [];
  const matches: string[] = Array.from(combined.match(/\b(KJ|AG|SP|KG|PY|MR|SA)\d*\b/g) ?? []);
  matches.forEach((m: string) => {
    const code = m.slice(0, 2);
    if (TRANSIT_LINE_COLORS[code] && !matched.includes(code)) {
      matched.push(code);
    }
  });

  if (/kelana jaya/i.test(combined) && !matched.includes('KJ')) matched.push('KJ');
  if (/ampang/i.test(combined) && !matched.includes('AG')) matched.push('AG');
  if (/sri petaling/i.test(combined) && !matched.includes('SP')) matched.push('SP');
  if (/(kajang|sbk)/i.test(combined) && !matched.includes('KG')) matched.push('KG');
  if (/(putrajaya|ssp)/i.test(combined) && !matched.includes('PY')) matched.push('PY');
  if (/monorail/i.test(combined) && !matched.includes('MR')) matched.push('MR');
  if (/(shah alam line|lrt\s*3|lrt3|\bsal\b)/i.test(combined) && !matched.includes('SA')) matched.push('SA');

  // Key Klang Valley interchanges and shared corridors
  if (/Masjid Jamek/i.test(name)) {
    ['AG', 'SP', 'KJ'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  } else if (/Pasar Seni/i.test(name)) {
    ['KJ', 'KG'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  } else if (/KL Sentral/i.test(name)) {
    ['KJ', 'MR', 'KG'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  } else if (/Titiwangsa/i.test(name)) {
    ['AG', 'SP', 'MR', 'PY'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  } else if (/Hang Tuah/i.test(name)) {
    ['AG', 'SP', 'MR'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  } else if (/Chan Sow Lin/i.test(name)) {
    ['AG', 'SP', 'PY'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  } else if (/Tun Razak Exchange/i.test(name)) {
    ['KG', 'PY'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  } else if (/Maluri/i.test(name)) {
    ['AG', 'KG'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  } else if (/Bukit Bintang/i.test(name)) {
    ['MR', 'KG'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  } else if (/Ampang Park/i.test(name)) {
    ['KJ', 'PY'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  } else if (/Sungai Besi/i.test(name)) {
    ['SP', 'PY'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  } else if (/Bandar Utama/i.test(name)) {
    ['KG', 'SA'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  } else if (/Kwasa Damansara/i.test(name)) {
    ['KG', 'PY'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  } else if (/Bandar Tasik Selatan/i.test(name)) {
    ['SP', 'KT'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  } else if (/Kampung Batu/i.test(name)) {
    ['PY', 'KC'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  } else if (/Putra Heights/i.test(name)) {
    ['SP', 'KJ'].forEach((c) => { if (!matched.includes(c)) matched.push(c); });
  }

  // Shared track corridor for Ampang & Sri Petaling (Sentul Timur to Chan Sow Lin)
  const sharedAgSp = ['Sentul Timur', 'Sentul', 'PWTC', 'Sultan Ismail', 'Bandaraya', 'Plaza Rakyat', 'Pudu'];
  if (sharedAgSp.some((s) => name.includes(s))) {
    if (!matched.includes('AG')) matched.push('AG');
    if (!matched.includes('SP')) matched.push('SP');
  }

  return matched.length > 0 ? matched : ['KJ'];
}

function getRingBackground(lineCodes: string[]): string {
  const colors = lineCodes.map((c) => TRANSIT_LINE_COLORS[c]?.color || '#007AFF');
  if (colors.length === 1) return colors[0];
  const step = 360 / colors.length;
  const segments = colors.map((col, i) => `${col} ${i * step}deg ${(i + 1) * step}deg`);
  return `conic-gradient(${segments.join(', ')})`;
}

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

// Prominent glowing beacon icon for the user's reserved parking bay
const activeReservedParkingIcon = L.divIcon({
  className: 'custom-active-booking-icon',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
      <div style="position: absolute; top: -6px; width: 44px; height: 44px; border-radius: 9999px; background: rgba(0, 122, 255, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width: 36px; height: 36px; border-radius: 12px; background: linear-gradient(135deg, #007AFF, #0051cb); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; box-shadow: 0 4px 14px rgba(0, 122, 255, 0.5); border: 2.5px solid #ffffff; z-index: 2;">
        🅿️
      </div>
      <div style="background: #0f172a; color: white; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 9999px; margin-top: 3px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 1.5px solid rgba(255,255,255,0.4); z-index: 2;">
        Reserved Bay
      </div>
    </div>
  `,
  iconSize: [44, 58],
  iconAnchor: [22, 48],
  popupAnchor: [0, -46],
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

// Linear Journey Multimodal Icons
const boardStopIcon = L.divIcon({
  className: 'custom-board-stop-icon',
  html: `
    <div style="
      background: #059669; color: white; padding: 3px 8px; border-radius: 9999px;
      font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      border: 2px solid white; display: flex; align-items: center; gap: 4px;
    ">
      <span>🚌 Board Bus Here</span>
    </div>
  `,
  iconSize: [95, 24],
  iconAnchor: [48, 12],
  popupAnchor: [0, -14],
});

const alightStopIcon = L.divIcon({
  className: 'custom-alight-stop-icon',
  html: `
    <div style="
      background: #0284c7; color: white; padding: 3px 8px; border-radius: 9999px;
      font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      border: 2px solid white; display: flex; align-items: center; gap: 4px;
    ">
      <span>🛑 Alight Bus Here</span>
    </div>
  `,
  iconSize: [95, 24],
  iconAnchor: [48, 12],
  popupAnchor: [0, -14],
});

const stationEntranceIcon = L.divIcon({
  className: 'custom-station-entrance-icon',
  html: `
    <div style="
      background: #0f172a; color: white; padding: 3px 8px; border-radius: 9999px;
      font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 2px solid #14b8a6; display: flex; align-items: center; gap: 4px;
    ">
      <span>🚉 Station Entrance</span>
    </div>
  `,
  iconSize: [110, 24],
  iconAnchor: [55, 12],
  popupAnchor: [0, -14],
});

// ---- Station Marker Generator based on Station Marker System Spec ----
interface StationMarkerOptions {
  rawName: string;
  lines: string[];
  isInterchange: boolean;
  isSelected: boolean;
  isSearchOrigin: boolean;
}

function createStationMarkerIcon(opts: StationMarkerOptions): L.DivIcon {
  const { rawName, lines, isInterchange, isSelected, isSearchOrigin } = opts;
  const cleanName = cleanStationName(rawName);

  const size = 44;
  const primaryColor = TRANSIT_LINE_COLORS[lines[0]]?.color || '#007AFF';
  const background = getRingBackground(lines);

  const markerClasses = [
    'station-marker',
    'station-marker-hitbox',
    isSelected ? 'is-active is-selected' : '',
    isSearchOrigin ? 'is-search-origin' : '',
    isInterchange ? 'is-interchange' : '',
  ].filter(Boolean).join(' ');

  const labelText = isSearchOrigin ? `${cleanName} · Origin` : cleanName;

  const html = `
    <div class="${markerClasses}" style="--station-color: ${primaryColor}; width: ${size}px; height: ${size}px;">
      <div class="station-pill-label">
        <span>${labelText}</span>
      </div>
      <span class="station-marker__pulse"></span>
      <div class="station-marker__dot station-marker-disc" style="background: ${background};">
        <span class="station-marker__center"></span>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-station-icon',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 4],
  });
}

function createClusterIcon(count: number): L.DivIcon {
  const html = `
    <div class="station-cluster-bubble">
      ${count}
    </div>
  `;
  return L.divIcon({
    className: 'custom-station-icon',
    html,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

const normalizeStationKey = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const getStationKeys = (feature: any): string[] => {
  const p = feature.properties || {};
  return [
    p.name,
    p['name:en'],
    p.full_name,
    p.ref,
    cleanStationName(p.name || ''),
    cleanStationName(p['name:en'] || ''),
  ]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map(normalizeStationKey);
};

// ---- Props ----
interface CommuterMapProps {
  spots: ParkingSpot[];
  onStationSelect: (stationName: string, lat: number, lng: number, stopId?: string) => void;
  selectedStationId?: string | null;
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
  selectedBusRoute?: string | null;
  onBusRouteSelect?: (routeId: string | null) => void;
  activeBookingSpot?: ParkingSpot | null;
  activeBooking?: Booking | null;
  workspaceMode?: 'explore' | 'navigation';
  onNavigate?: () => void;
  onExitNavigation?: () => void;
  onRoutesCalculated?: (routes: {
    drivingRoute: DrivingRouteResult | null;
    linearPlan: MultimodalPlanResult | null;
    targetSpot: ParkingSpot | null;
  }) => void;
}

interface MapTarget {
  lat?: number;
  lng?: number;
  zoom?: number;
  animate?: boolean;
  timestamp?: number;
  bounds?: [[number, number], [number, number]];
}

// ---- Map View Controller: Handles programmatic smooth pans, flies, and bounding box fits ----
function MapViewController({ target }: { target: MapTarget | null }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    if (target.bounds) {
      map.fitBounds(target.bounds, {
        padding: [60, 60],
        maxZoom: 16,
        animate: target.animate !== false,
      });
      return;
    }
    if (target.lat !== undefined && target.lng !== undefined) {
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
        map.panTo([target.lat, target.lng], {
          animate: true,
          duration: 0.35,
        });
      }
    }
  }, [target, map]);

  return null;
}

// ---- Map Zoom Listener for Clustering ----
function MapZoomListener({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMap();

  useEffect(() => {
    onZoom(map.getZoom());
    const handleZoomEnd = () => onZoom(map.getZoom());
    map.on('zoomend', handleZoomEnd);
    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map, onZoom]);

  return null;
}

// ---- Custom Panes ----
function RailPane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('railPane')) {
      const pane = map.createPane('railPane');
      pane.style.zIndex = '350';
    }
  }, [map]);
  return null;
}

function StationPane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('stationPane')) {
      const pane = map.createPane('stationPane');
      pane.style.zIndex = '450';
    }
  }, [map]);
  return null;
}

function UserLocationPane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('userLocationPane')) {
      const pane = map.createPane('userLocationPane');
      pane.style.zIndex = '500';
    }
  }, [map]);
  return null;
}

function LiveVehiclePane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('liveVehiclePane')) {
      const pane = map.createPane('liveVehiclePane');
      pane.style.zIndex = '420';
    }
  }, [map]);
  return null;
}

function createLiveBusIcon(bearing: number = 0, routeId: string = '') {
  const safeBearing = Math.round(bearing || 0);
  const safeRoute = (routeId || 'FEEDER').trim();
  return L.divIcon({
    className: 'custom-live-bus-icon',
    html: `
      <div class="live-transit-bus-marker">
        <div class="live-bus-body" style="transform: rotate(${safeBearing}deg);">
          <div class="live-bus-pointer"></div>
          <div class="live-bus-glyph">🚌</div>
        </div>
        <div class="live-bus-badge-label">${safeRoute}</div>
      </div>
    `,
    iconSize: [40, 48],
    iconAnchor: [20, 24],
    popupAnchor: [0, -20],
  });
}

function createBusStopIcon(stopName: string, color: string = '#008716'): L.DivIcon {
  return L.divIcon({
    className: 'rapid-bus-stop-icon',
    html: `<div class="bus-stop-dot" style="background-color: ${color};" title="${stopName}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -7],
  });
}

// ---- Line Control Panel (GTFS Rail Lines Toggle) ----
interface LineControlPanelProps {
  visibleLines: Record<string, boolean>;
  onToggle: (routeName: string) => void;
  showHeader?: boolean;
}

function LineControlPanel({
  visibleLines,
  onToggle,
  showHeader = true,
}: LineControlPanelProps) {
  const lineDisplayNames: Record<string, string> = {
    AGL: 'Ampang Line (LRT)',
    SPL: 'Sri Petaling Line (LRT)',
    KJL: 'Kelana Jaya Line (LRT)',
    MRL: 'KL Monorail',
    KGL: 'Kajang Line (MRT)',
    PYL: 'Putrajaya Line (MRT)',
    BRT: 'BRT Sunway Line',
    SAL: 'Shah Alam Line (LRT3)',
  };

  const lineColors: Record<string, string> = {
    AGL: '#F59E0B',
    SPL: '#8E2A4E',
    KJL: '#D9248A',
    MRL: '#84BD00',
    KGL: '#059669',
    PYL: '#FFCD00',
    BRT: '#115740',
    SAL: '#FF00FF',
  };

  const routes = Object.keys(visibleLines);

  return (
    <div className="line-control-panel bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-lg p-3 text-xs min-w-[200px]">
      {showHeader && (
        <div className="flex items-center gap-2 font-bold text-slate-700 mb-2 border-b border-slate-100 pb-2">
          <Layers size={14} className="text-blue-600" />
          <span>Rail Lines</span>
        </div>
      )}
      <div className="space-y-1.5">
        {routes.map((routeName) => {
          const isChecked = visibleLines[routeName] !== false;
          const displayName = lineDisplayNames[routeName] || routeName;
          const color = lineColors[routeName] || '#3388ff';

          return (
            <label
              key={routeName}
              className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                style={{ backgroundColor: color }}
              />
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

// ---- Station Marker System Legend Modal ----
interface MapLegendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function MapLegendModal({ isOpen, onClose }: MapLegendModalProps) {
  if (!isOpen) return null;

  return (
    <div
      data-map-control
      className="map-legend-modal absolute top-[68px] right-4 z-[1001] w-[340px] max-w-[calc(100vw-2rem)] bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xl p-4 text-xs space-y-4 max-h-[calc(100dvh-12rem)] overflow-y-auto animate-slide-up"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <Train className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-slate-800 text-sm">Station Marker System</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors text-sm font-bold"
          aria-label="Close legend"
        >
          ✕
        </button>
      </div>

      {/* Marker Types */}
      <div className="space-y-2.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Station Types</span>
        
        <div className="grid grid-cols-2 gap-2">
          {/* Station */}
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
            <div className="w-[18px] h-[18px] rounded-full bg-[#8E2A4E] shadow-[0_0_0_2px_#fff,0_2px_4px_rgba(0,0,0,0.18)] flex items-center justify-center shrink-0">
              <div className="w-[9px] h-[9px] rounded-full bg-white" />
            </div>
            <div>
              <div className="font-bold text-slate-700 text-[11px]">Station</div>
              <div className="text-[10px] text-slate-400">18px line colour ring</div>
            </div>
          </div>

          {/* Shared Track */}
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
            <div
              className="w-[18px] h-[18px] rounded-full shadow-[0_0_0_2px_#fff,0_2px_4px_rgba(0,0,0,0.18)] flex items-center justify-center shrink-0"
              style={{ background: 'conic-gradient(#F59E0B 0deg 180deg, #8E2A4E 180deg 360deg)' }}
            >
              <div className="w-[9px] h-[9px] rounded-full bg-white" />
            </div>
            <div>
              <div className="font-bold text-slate-700 text-[11px]">Shared track</div>
              <div className="text-[10px] text-slate-400">Equal line segments</div>
            </div>
          </div>

          {/* Interchange */}
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
            <div
              className="w-[24px] h-[24px] rounded-full shadow-[0_0_0_2px_#fff,0_2px_6px_rgba(0,0,0,0.22)] flex items-center justify-center shrink-0"
              style={{ background: 'conic-gradient(#F59E0B 0deg 120deg, #8E2A4E 120deg 240deg, #D9248A 240deg 360deg)' }}
            >
              <div className="w-[12px] h-[12px] rounded-full bg-white" />
            </div>
            <div>
              <div className="font-bold text-slate-700 text-[11px]">Interchange</div>
              <div className="text-[10px] text-slate-400">28px multi-line hub</div>
            </div>
          </div>

          {/* Selected */}
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
            <div className="w-[26px] h-[26px] rounded-full bg-[#D9248A] shadow-[0_0_0_2px_#fff,0_2px_6px_rgba(0,0,0,0.25)] flex items-center justify-center shrink-0">
              <div className="w-[18px] h-[18px] rounded-full bg-[#0F172A] flex items-center justify-center">
                <Train size={9} className="text-white" />
              </div>
            </div>
            <div>
              <div className="font-bold text-slate-700 text-[11px]">Selected</div>
              <div className="text-[10px] text-slate-400">36px navy + train glyph</div>
            </div>
          </div>

          {/* Search Origin */}
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
            <div className="w-[20px] h-[20px] rounded-full bg-[#8E2A4E] shadow-[0_0_0_2px_#fff,0_0_0_4px_rgba(20,184,166,0.5),0_0_8px_rgba(20,184,166,0.6)] flex items-center justify-center shrink-0">
              <div className="w-[9px] h-[9px] rounded-full bg-white" />
            </div>
            <div>
              <div className="font-bold text-slate-700 text-[11px]">Search origin</div>
              <div className="text-[10px] text-teal-600 font-semibold">Teal radius halo</div>
            </div>
          </div>

          {/* Cluster */}
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
            <div className="w-[22px] h-[22px] rounded-full bg-[#0F172A] border-2 border-teal-500 shadow-sm flex items-center justify-center text-[10px] font-black text-white shrink-0">
              12
            </div>
            <div>
              <div className="font-bold text-slate-700 text-[11px]">Cluster</div>
              <div className="text-[10px] text-slate-400">Zoomed-out count</div>
            </div>
          </div>

          {/* Live Feeder Bus */}
          <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center gap-2.5 col-span-2">
            <div className="w-[26px] h-[26px] rounded-full bg-[#059669] shadow-[0_0_0_2px_#fff,0_2px_6px_rgba(5,150,105,0.3)] flex items-center justify-center text-xs text-white shrink-0">
              🚌
            </div>
            <div>
              <div className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                <span>Live MRT Feeder Bus</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-[10px] text-slate-500">Real-time GPS telemetry from data.gov.my</div>
            </div>
          </div>
        </div>
      </div>

      {/* Line Colours */}
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Line Colours</span>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50">
            <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ background: '#D9248A' }} />
            <span className="font-medium text-slate-700 truncate">Kelana Jaya</span>
            <span className="text-[10px] text-slate-400 font-mono ml-auto">#D9248A</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50">
            <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ background: '#F59E0B' }} />
            <span className="font-medium text-slate-700 truncate">Ampang</span>
            <span className="text-[10px] text-slate-400 font-mono ml-auto">#F59E0B</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50">
            <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ background: '#8E2A4E' }} />
            <span className="font-medium text-slate-700 truncate">Sri Petaling</span>
            <span className="text-[10px] text-slate-400 font-mono ml-auto">#8E2A4E</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50">
            <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ background: '#059669' }} />
            <span className="font-medium text-slate-700 truncate">Kajang Line</span>
            <span className="text-[10px] text-slate-400 font-mono ml-auto">#059669</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50">
            <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ background: '#FFCD00' }} />
            <span className="font-medium text-slate-700 truncate">Putrajaya Line</span>
            <span className="text-[10px] text-slate-400 font-mono ml-auto">#FFCD00</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50">
            <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ background: '#84BD00' }} />
            <span className="font-medium text-slate-700 truncate">KL Monorail</span>
            <span className="text-[10px] text-slate-400 font-mono ml-auto">#84BD00</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50">
            <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ background: '#FF00FF' }} />
            <span className="font-medium text-slate-700 truncate">Shah Alam Line (LRT3)</span>
            <span className="text-[10px] text-slate-400 font-mono ml-auto">#FF00FF</span>
          </div>
        </div>
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
  selectedStationId,
  selectedSpot,
  onSpotClick,
  distanceRadius,
  onDistanceRadiusChange,
  userLocation,
  locationAccuracy,
  locationStatus,
  onRequestLocation,
  selectedBusRoute,
  onBusRouteSelect,
  activeBookingSpot,
  activeBooking,
  workspaceMode = 'explore',
  onNavigate,
  onExitNavigation,
  onRoutesCalculated,
}: CommuterMapProps) {
  const klCenter: [number, number] = [3.1390, 101.6869];
  // Basemap follows the app appearance: CARTO ships matched light/dark styles,
  // which reads far better than inverting light tiles with a CSS filter.
  const { isDark } = useTheme();
  const basemapStyle = isDark ? 'dark_all' : 'light_all';
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(null);
  const [currentZoom, setCurrentZoom] = useState(12);
  const [openPanel, setOpenPanel] = useState<'stations' | 'lines' | 'legend' | 'busRoutes' | null>(null);
  const [stationFilter, setStationFilter] = useState('');
  const [dismissedStation, setDismissedStation] = useState<string | null>(null);
  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
      }
    };
  }, []);

  // Active Station Details popup state (guaranteed to render independently of marker re-renders)
  const [activeStationPopup, setActiveStationPopup] = useState<{
    name: string;
    network: string;
    lat: number;
    lng: number;
    code?: string;
  } | null>(null);

  // Target parking spot: either currently selected bay or user's active reservation
  const targetSpot = selectedSpot || activeBookingSpot;

  // ---- Driving Route from Current Location to Parking Bay ----
  const [drivingRoute, setDrivingRoute] = useState<DrivingRouteResult | null>(null);
  const [isLoadingDrivingRoute, setIsLoadingDrivingRoute] = useState<boolean>(false);
  const [journeyTab, setJourneyTab] = useState<'drive' | 'transit'>('drive');
  const [isNavigatorMinimized, setIsNavigatorMinimized] = useState<boolean>(false);

  // ---- GTFS-Realtime Live Moving Transit Vehicles Layer ----
  const [showLiveBuses, setShowLiveBuses] = useState<boolean>(true);
  const [liveBusesData, setLiveBusesData] = useState<RealtimeGeoJsonCollection | null>(null);
  const [isLoadingLiveBuses, setIsLoadingLiveBuses] = useState<boolean>(false);

  // Selective Bus Route State (controlled or uncontrolled)
  const [internalBusRoute, setInternalBusRoute] = useState<string | null>(null);
  const effectiveBusRoute = selectedBusRoute !== undefined ? selectedBusRoute : internalBusRoute;
  const [busRouteSearch, setBusRouteSearch] = useState('');

  // ── OpenTripPlanner Linear Multimodal Itinerary Engine State ──
  const [linearPlan, setLinearPlan] = useState<MultimodalPlanResult | null>(null);
  const [activeItineraryId, setActiveItineraryId] = useState<string>('');
  const [focusedLegIndex, setFocusedLegIndex] = useState<number | null>(null);
  const [showLinearNavigator, setShowLinearNavigator] = useState<boolean>(false);
  const [preference, setPreference] = useState<CommuterPreference>('balanced');
  const [isLoadingLinearPlan, setIsLoadingLinearPlan] = useState<boolean>(false);

  // Automatically plan multimodal journey when spot or station changes
  useEffect(() => {
    if (!targetSpot) {
      setLinearPlan(null);
      setShowLinearNavigator(false);
      return;
    }

    let isSubscribed = true;
    setIsLoadingLinearPlan(true);

    const spotLat = targetSpot.lat || targetSpot.latitude;
    const spotLng = targetSpot.lng || targetSpot.longitude;

    planMultimodalJourney(
      {
        name: targetSpot.name || `Bay ${targetSpot.parkingLabel}`,
        lat: spotLat,
        lng: spotLng,
        address: targetSpot.address,
      },
      selectedStationCoords && selectedStation
        ? { name: selectedStation, lat: selectedStationCoords.lat, lng: selectedStationCoords.lng }
        : null,
      liveBusesData?.features?.map((f) => ({
        id: f.properties.vehicleId,
        vehicleId: f.properties.vehicleId,
        licensePlate: f.properties.licensePlate,
        routeId: f.properties.routeId,
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
        bearing: f.properties.bearing,
        speedKmh: f.properties.speedKmh,
        distanceMeters: undefined,
        estimatedArrivalMinutes: 3,
        timestamp: new Date().toISOString(),
        agency: 'prasarana',
        category: 'rapid-bus-mrtfeeder',
      })),
      preference,
    )
      .then((plan) => {
        if (!isSubscribed) return;
        setLinearPlan(plan);
        setActiveItineraryId(plan.recommendedItinerary.id);
      })
      .catch((err) => console.warn('[CommuterMap] Linear plan error:', err))
      .finally(() => {
        if (isSubscribed) setIsLoadingLinearPlan(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [
    targetSpot?.id,
    targetSpot?.lat,
    targetSpot?.lng,
    targetSpot?.latitude,
    targetSpot?.longitude,
    selectedStation,
    selectedStationCoords?.lat,
    selectedStationCoords?.lng,
    preference,
  ]);

  const activeItinerary = useMemo(() => {
    if (!linearPlan) return null;
    return (
      linearPlan.allItineraries.find((it) => it.id === activeItineraryId) ||
      linearPlan.recommendedItinerary
    );
  }, [linearPlan, activeItineraryId]);

  const handleSetBusRoute = (route: string | null) => {
    setInternalBusRoute(route);
    onBusRouteSelect?.(route);
  };

  // Filtered live vehicles: ONLY return vehicles when a specific bus route is selected!
  // When no route is selected, return [] so ZERO bus markers clutter the map by default!
  const displayVehicles = useMemo(() => {
    if (!liveBusesData?.features || !effectiveBusRoute) return [];
    const target = effectiveBusRoute.trim().toUpperCase();
    const normTarget = normalizeBusRouteCode(target);
    return liveBusesData.features.filter((f) => {
      const r = (f.properties?.routeId || '').trim().toUpperCase();
      return r === target || (normTarget && normalizeBusRouteCode(r) === normTarget);
    });
  }, [liveBusesData, effectiveBusRoute]);

  // Active selected Rapid Bus KL / MRT Feeder route details (road polyline coordinates and bus stops from GTFS, with fallback)
  const activeRouteDetails = useMemo<RapidBusRoute | null>(() => {
    if (!effectiveBusRoute) return null;
    const staticMatch = getRapidBusRoute(effectiveBusRoute);
    if (staticMatch && staticMatch.coordinates && staticMatch.coordinates.length > 0) {
      return staticMatch;
    }

    // Fallback: if a live route is not in static GTFS, construct a connecting route path from station + live buses
    const pts: [number, number][] = [];
    if (activeStationPopup) {
      pts.push([activeStationPopup.lat, activeStationPopup.lng]);
    } else if (selectedStationCoords) {
      pts.push([selectedStationCoords.lat, selectedStationCoords.lng]);
    }
    displayVehicles.forEach((f) => {
      const c = f.geometry?.coordinates;
      if (c && c.length >= 2) {
        pts.push([c[1], c[0]]);
      }
    });
    if (pts.length >= 2) {
      return {
        routeId: effectiveBusRoute,
        shortName: effectiveBusRoute,
        longName: selectedStation ? `Feeder Route ${effectiveBusRoute} (${selectedStation})` : `Rapid KL Route ${effectiveBusRoute}`,
        color: '#008716',
        shapeId: null,
        coordinates: pts,
        stops: [],
        connectedStations: selectedStation ? [selectedStation.toUpperCase()] : [],
      };
    }
    return staticMatch;
  }, [effectiveBusRoute, displayVehicles, activeStationPopup, selectedStationCoords, selectedStation]);

  // All Rapid Bus KL + MRT Feeder routes from static GTFS
  const allStaticRoutes = useMemo(() => {
    return getAllRapidBusRoutes();
  }, []);

  // Distinct bus routes currently operating in live telemetry
  const availableBusRoutes = useMemo(() => {
    if (!liveBusesData?.features) return [];
    const counts = new Map<string, number>();
    liveBusesData.features.forEach((f) => {
      const r = (f.properties?.routeId || '').trim().toUpperCase();
      if (r) {
        counts.set(r, (counts.get(r) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .map(([routeId, count]) => ({ routeId, count }))
      .sort((a, b) => a.routeId.localeCompare(b.routeId, undefined, { numeric: true }));
  }, [liveBusesData]);

  const focusBusRouteOnMap = (routeId: string) => {
    const routeData = getRapidBusRoute(routeId);
    const normTarget = normalizeBusRouteCode(routeId);
    const matchedVehicles =
      liveBusesData?.features?.filter((f) => {
        const r = (f.properties?.routeId || '').trim().toUpperCase();
        return r === routeId.trim().toUpperCase() || (normTarget && normalizeBusRouteCode(r) === normTarget);
      }) || [];

    const allPoints: [number, number][] = [];
    if (routeData?.coordinates && routeData.coordinates.length > 0) {
      routeData.coordinates.forEach(([lat, lng]) => allPoints.push([lat, lng]));
    }
    matchedVehicles.forEach((f) => {
      const c = f.geometry?.coordinates;
      if (c && c.length >= 2) allPoints.push([c[1], c[0]]);
    });

    if (allPoints.length >= 2) {
      let minLat = 90;
      let maxLat = -90;
      let minLng = 180;
      let maxLng = -180;
      allPoints.forEach(([lat, lng]) => {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      });

      setMapTarget({
        lat: (minLat + maxLat) / 2,
        lng: (minLng + maxLng) / 2,
        bounds: [
          [minLat, minLng],
          [maxLat, maxLng],
        ],
        animate: true,
        timestamp: Date.now(),
      });
      return;
    }

    if (allPoints.length === 1) {
      setMapTarget({
        lat: allPoints[0][0],
        lng: allPoints[0][1],
        zoom: 15,
        animate: true,
        timestamp: Date.now(),
      });
    }
  };

  const lastFocusedBusRouteRef = useRef<string | null>(null);
  useEffect(() => {
    if (!effectiveBusRoute) {
      lastFocusedBusRouteRef.current = null;
      return;
    }
    if (lastFocusedBusRouteRef.current !== effectiveBusRoute) {
      lastFocusedBusRouteRef.current = effectiveBusRoute;
      focusBusRouteOnMap(effectiveBusRoute);
    }
  }, [effectiveBusRoute]);

  const handleSelectRoute = (routeId: string | null) => {
    handleSetBusRoute(routeId);
    setOpenPanel(null);

    if (!routeId) return;
    lastFocusedBusRouteRef.current = routeId;
    focusBusRouteOnMap(routeId);
  };

  useEffect(() => {
    if (!showLiveBuses) return;

    let isSubscribed = true;
    const fetchLiveBuses = async () => {
      try {
        setIsLoadingLiveBuses(true);
        const data = await getRealtimeVehiclesGeoJson('prasarana', 'rapid-bus-mrtfeeder');
        if (isSubscribed) {
          setLiveBusesData(data);
        }
      } catch (err: any) {
        if (isSubscribed) {
          console.warn('[CommuterMap] Failed to load live GTFS-R vehicles:', err);
        }
      } finally {
        if (isSubscribed) {
          setIsLoadingLiveBuses(false);
        }
      }
    };

    fetchLiveBuses();
    // Refresh every 30 seconds to sync with data.gov.my 30s broadcast cycle
    const interval = setInterval(fetchLiveBuses, 30000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [showLiveBuses]);

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
    if (effectiveUserLocation && !selectedStationCoords && !activeBookingSpot && !hasAutoCenteredOnUserRef.current) {
      hasAutoCenteredOnUserRef.current = true;
      setMapTarget({
        lat: effectiveUserLocation.lat,
        lng: effectiveUserLocation.lng,
        zoom: 14,
        animate: true,
        timestamp: Date.now(),
      });
    }
  }, [effectiveUserLocation, selectedStationCoords, activeBookingSpot]);

  // Automatically calculate road driving route from current location to target parking spot
  useEffect(() => {
    if (!effectiveUserLocation || !targetSpot) {
      setDrivingRoute(null);
      return;
    }

    let isMounted = true;
    setIsLoadingDrivingRoute(true);

    const destLat = targetSpot.lat || targetSpot.latitude;
    const destLng = targetSpot.lng || targetSpot.longitude;

    calculateDrivingRoute(
      {
        lat: effectiveUserLocation.lat,
        lng: effectiveUserLocation.lng,
        name: 'Current Location',
      },
      {
        lat: destLat,
        lng: destLng,
        name: targetSpot.name || `Bay ${targetSpot.parkingLabel}`,
        address: targetSpot.address,
      }
    )
      .then((res) => {
        if (!isMounted) return;
        setDrivingRoute(res);
      })
      .catch((err) => console.warn('[CommuterMap] Driving route error:', err))
      .finally(() => {
        if (isMounted) setIsLoadingDrivingRoute(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    effectiveUserLocation?.lat,
    effectiveUserLocation?.lng,
    targetSpot?.id,
    targetSpot?.lat,
    targetSpot?.lng,
    targetSpot?.latitude,
    targetSpot?.longitude,
  ]);

  // Notify parent of calculated routes for linear process integration
  useEffect(() => {
    onRoutesCalculated?.({
      drivingRoute,
      linearPlan,
      targetSpot,
    });
  }, [drivingRoute, linearPlan, targetSpot, onRoutesCalculated]);

  // When workspaceMode is navigation, ensure bounds frame the drive
  useEffect(() => {
    if (workspaceMode === 'navigation') {
      setShowLinearNavigator(true);
      setJourneyTab('drive');
      if (drivingRoute) {
        setMapTarget({
          bounds: drivingRoute.bounds,
          animate: true,
          timestamp: Date.now(),
        });
      } else if (activeBookingSpot && effectiveUserLocation) {
        const pLat = activeBookingSpot.lat || activeBookingSpot.latitude;
        const pLng = activeBookingSpot.lng || activeBookingSpot.longitude;
        const minLat = Math.min(effectiveUserLocation.lat, pLat);
        const maxLat = Math.max(effectiveUserLocation.lat, pLat);
        const minLng = Math.min(effectiveUserLocation.lng, pLng);
        const maxLng = Math.max(effectiveUserLocation.lng, pLng);
        setMapTarget({
          bounds: [
            [minLat, minLng],
            [maxLat, maxLng],
          ],
          animate: true,
          timestamp: Date.now(),
        });
      }
    }
  }, [workspaceMode, drivingRoute, activeBookingSpot?.id, effectiveUserLocation?.lat, effectiveUserLocation?.lng]);

  // react-router navigation
  const navigate = useNavigate();

  // ---- GTFS Rail Lines: full source data (read-only) ----
  const [allLines, setAllLines] = useState<GeoJsonCollection<RailLineFeature> | null>(null);
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({});
  const [gtfsLoading, setGtfsLoading] = useState(true);
  const [gtfsError, setGtfsError] = useState<string | null>(null);

  // ---- Load GTFS data, initialize allLines and visibleLines ----
  useEffect(() => {
    async function loadGtfsData() {
      try {
        const { lines } = await loadRailNetworkData();
        const linesData = lines as GeoJsonCollection<RailLineFeature>;
        if (linesData && Array.isArray(linesData.features)) {
          setAllLines(linesData);

          const uniqueRoutes = [
            ...new Set<string>(linesData.features.map((f: RailLineFeature) => f.properties.route_name)),
          ];
          const initVisible: Record<string, boolean> = {};
          uniqueRoutes.forEach((route) => {
            initVisible[route] = true;
          });
          setVisibleLines(initVisible);
        }

        setGtfsLoading(false);
      } catch (err: any) {
        setGtfsError(err.message);
        setGtfsLoading(false);
      }
    }
    loadGtfsData();
  }, []);

  const filteredLines: GeoJsonCollection<RailLineFeature> | null = useMemo(() => {
    if (!allLines || !Array.isArray(allLines.features)) return null;
    const filtered = allLines.features.filter(
      (feature) => visibleLines[feature.properties.route_name] === true
    );
    return { type: 'FeatureCollection', features: filtered };
  }, [allLines, visibleLines]);

  // Filter stations: only LRT, MRT, Monorail
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
      name?.match(/^(AG|SP|KJ|KG|PY|MR|SA)\d/)
    );
  }), []);

  const stationFeatures = useMemo(() => {
    const deduped = new Map<string, any>();

    transitStations.forEach((feature: any) => {
      const rawName = String(feature.properties?.['name:en'] || feature.properties?.name || '');
      const cleanName = cleanStationName(rawName);
      const key = normalizeStationKey(cleanName);
      if (!key) return;

      if (!deduped.has(key)) {
        deduped.set(key, {
          ...feature,
          properties: {
            ...feature.properties,
            name: cleanName,
            'name:en': cleanName,
            allRefs: feature.properties?.ref ? [feature.properties.ref] : [],
            allNetworks: feature.properties?.network ? [feature.properties.network] : [],
          },
        });
      } else {
        const existing = deduped.get(key);
        if (feature.properties?.ref && !existing.properties.allRefs.includes(feature.properties.ref)) {
          existing.properties.allRefs.push(feature.properties.ref);
        }
        if (feature.properties?.network && !existing.properties.allNetworks.includes(feature.properties.network)) {
          existing.properties.allNetworks.push(feature.properties.network);
        }
        existing.properties.ref = existing.properties.allRefs.join(';');
        existing.properties.network = existing.properties.allNetworks.join('; ');
      }
    });

    return [...deduped.values()];
  }, [transitStations]);

  const selectedStationKey = normalizeStationKey(selectedStation || '');

  // Memoized popup LatLng to prevent Leaflet autoPan thrashing and flashing
  const popupPosition = useMemo<[number, number] | null>(() => {
    return activeStationPopup ? [activeStationPopup.lat, activeStationPopup.lng] : null;
  }, [activeStationPopup?.lat, activeStationPopup?.lng]);

  const popupCoords = useMemo(() => {
    return activeStationPopup ? { lat: activeStationPopup.lat, lng: activeStationPopup.lng } : null;
  }, [activeStationPopup?.lat, activeStationPopup?.lng]);

  const selectedStationFeature = useMemo(() => {
    if (!selectedStationKey) return null;
    return stationFeatures.find((f: any) => getStationKeys(f).includes(selectedStationKey)) || null;
  }, [stationFeatures, selectedStationKey]);

  const resolvedStationCoords = useMemo(() => {
    const coords = selectedStationFeature?.geometry?.coordinates;
    if (coords && coords.length >= 2) {
      return { lat: coords[1], lng: coords[0] };
    }
    return selectedStationCoords;
  }, [selectedStationFeature, selectedStationCoords]);

  // Keep activeStationPopup in sync when selectedStation or selectedStationCoords changes (smooth delay for ripple animation)
  useEffect(() => {
    if (selectedStation && resolvedStationCoords) {
      if (dismissedStation === selectedStation) return;
      const feat = selectedStationFeature;
      const network = feat?.properties?.network || '';
      const code = feat ? getStationCode(feat) : (selectedStationId || '');

      if (activeStationPopup?.name === selectedStation) return;

      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      popupTimerRef.current = setTimeout(() => {
        setActiveStationPopup({
          name: selectedStation,
          network,
          lat: resolvedStationCoords.lat,
          lng: resolvedStationCoords.lng,
          code,
        });
      }, 550);
    }
  }, [selectedStation, resolvedStationCoords, selectedStationId, selectedStationFeature, dismissedStation]);

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

  // Map of parking spot ID -> connecting Rapid Bus routes that pass near the bay and serve the selected station
  const spotConnectingRoutesMap = useMemo(() => {
    const map = new Map<string, ConnectingBusRouteResult[]>();
    spots.forEach((s) => {
      const results = findConnectingBusRoutes(
        { lat: s.lat, lng: s.lng },
        selectedStationCoords,
        selectedStation,
        800,
        800,
      );
      if (results.length > 0) {
        map.set(String(s.id), results);
      }
    });
    return map;
  }, [spots, selectedStationCoords, selectedStation]);

  // Connecting routes specifically for the currently selected spot
  const selectedSpotConnectingRoutes = useMemo(() => {
    if (!selectedSpot) return [];
    return spotConnectingRoutesMap.get(String(selectedSpot.id)) || [];
  }, [selectedSpot, spotConnectingRoutesMap]);

  // Rapid Bus KL routes directly serving the currently selected station
  const stationServingRoutes = useMemo(() => {
    if (!selectedStationCoords) return [];
    return findRoutesServingStation(selectedStationCoords, selectedStation);
  }, [selectedStationCoords, selectedStation]);

  // Nearest bus stop on the active bus route to the currently selected parking spot
  const nearestStopToActiveSpot = useMemo(() => {
    if (!selectedSpot || !activeRouteDetails?.stops || activeRouteDetails.stops.length === 0) return null;
    let minDistance = Infinity;
    let closestStop: typeof activeRouteDetails.stops[0] | null = null;
    for (const stop of activeRouteDetails.stops) {
      const d = distanceMetersBetween(selectedSpot.lat, selectedSpot.lng, stop.lat, stop.lon);
      if (d < minDistance) {
        minDistance = d;
        closestStop = stop;
      }
    }
    if (!closestStop || minDistance > 1200) return null;
    return { stop: closestStop, distanceMeters: Math.round(minDistance) };
  }, [selectedSpot, activeRouteDetails]);

  // Unique clean station names for the search list
  const stationNames: string[] = useMemo(() => {
    const names = stationFeatures
      .map((f: any) => cleanStationName(String(f.properties?.name || f.properties?.['name:en'] || '')))
      .filter((n: string) => n.length > 0);
    return [...new Set<string>(names)].sort();
  }, [stationFeatures]);

  // Distances from effective user location to stations
  const stationDistances = useMemo(() => {
    if (!effectiveUserLocation) return new Map<string, number>();

    const distances = new Map<string, number>();
    stationFeatures.forEach((feature: any) => {
      const coords = feature.geometry?.coordinates;
      const rawName = feature.properties?.name || feature.properties?.['name:en'] || '';
      const clean = cleanStationName(rawName);
      if (coords && coords.length >= 2 && rawName) {
        const dist = distanceBetweenKm(effectiveUserLocation, { lat: coords[1], lng: coords[0] });
        distances.set(rawName, dist);
        distances.set(clean, dist);
        const norm = normalizeStationKey(rawName);
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

  // Line colours + codes per station, so a list row can carry the same ring the
  // marker uses on the map instead of a generic train glyph.
  const stationMeta = useMemo(() => {
    const meta = new Map<string, { lines: string[]; ring: string; code: string }>();
    stationFeatures.forEach((feature: any) => {
      const rawName = String(feature?.properties?.name || '');
      if (!rawName) return;
      const lines = getStationLines(feature);
      const entry = { lines, ring: getRingBackground(lines), code: getStationCode(feature) };
      [rawName, cleanStationName(rawName)].forEach((key) => {
        if (!key) return;
        if (!meta.has(key)) meta.set(key, entry);
        const normalized = normalizeStationKey(key);
        if (normalized && !meta.has(normalized)) meta.set(normalized, entry);
      });
    });
    return meta;
  }, [stationFeatures]);

  const metaForStation = (name: string) =>
    stationMeta.get(name) ?? stationMeta.get(normalizeStationKey(name));

  const stationQuery = stationFilter.trim().toLowerCase();

  // "Nearest to you" only earns its space when it is not duplicating the list.
  const showNearest = Boolean(effectiveUserLocation) && nearestStations.length > 0 && !stationQuery;

  const matchingStations = useMemo(
    () => stationNames.filter((name) => name.toLowerCase().includes(stationQuery)),
    [stationNames, stationQuery],
  );

  const nearestKeys = useMemo(
    () => new Set(nearestStations.map((station) => normalizeStationKey(station.name))),
    [nearestStations],
  );

  // stationNames is already sorted A→Z, which is how people scan a long list.
  const listStations = useMemo(
    () =>
      showNearest
        ? matchingStations.filter((name) => !nearestKeys.has(normalizeStationKey(name)))
        : matchingStations,
    [matchingStations, showNearest, nearestKeys],
  );

  // Zoomed-out station clusters (for zoom <= 11)
  const stationClusters = useMemo(() => {
    if (currentZoom >= 12) return null;
    const gridSize = currentZoom === 11 ? 0.038 : 0.075;
    const grid = new Map<string, { count: number; latSum: number; lngSum: number }>();

    stationFeatures.forEach((feat: any) => {
      const coords = feat.geometry?.coordinates;
      if (!coords || coords.length < 2) return;
      const lat = coords[1];
      const lng = coords[0];
      const key = `${Math.floor(lat / gridSize)}:${Math.floor(lng / gridSize)}`;
      if (!grid.has(key)) {
        grid.set(key, { count: 0, latSum: 0, lngSum: 0 });
      }
      const cell = grid.get(key)!;
      cell.count += 1;
      cell.latSum += lat;
      cell.lngSum += lng;
    });

    return Array.from(grid.values()).map((cell, idx) => ({
      id: `cluster-${idx}`,
      count: cell.count,
      lat: cell.latSum / cell.count,
      lng: cell.lngSum / cell.count,
    }));
  }, [stationFeatures, currentZoom]);

  // Station marker click: Keep station 100% stationary in place, trigger ripple pulse, and open details popup
  const handleStationMarkerClick = (feature: any, e?: any) => {
    if (e?.originalEvent) {
      e.originalEvent.stopPropagation();
    }
    const coords = feature.geometry.coordinates;
    const rawName = feature.properties?.name || feature.properties?.['name:en'] || 'Unknown Station';
    const cleanName = cleanStationName(rawName);
    const network = feature.properties?.network || '';
    const code = getStationCode(feature);
    if (!coords || coords.length < 2) return;

    // 1. Immediately select station and trigger line-color ripple animation in place (no map pan/shift)
    onStationSelect(cleanName, coords[1], coords[0], code);
    setDismissedStation(null);
    setOpenPanel(null);

    // 2. Reveal Station Info Card smoothly once the 500-600ms ripple pulse completes
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    popupTimerRef.current = setTimeout(() => {
      setActiveStationPopup({
        name: cleanName,
        network,
        lat: coords[1],
        lng: coords[0],
        code,
      });
    }, 550);
  };

  // Selecting station from dropdown search list: Pan/fly to station with zoom 15
  const handleListStationClick = (name: string) => {
    const normalizedTarget = normalizeStationKey(name);
    const feature = stationFeatures.find((f: any) => getStationKeys(f).includes(normalizedTarget));
    if (feature) {
      const coords = feature.geometry.coordinates;
      const net = feature.properties?.network || '';
      const code = getStationCode(feature);
      if (!coords || coords.length < 2) return;
      onStationSelect(name, coords[1], coords[0]);
      setActiveStationPopup({
        name,
        network: net,
        lat: coords[1],
        lng: coords[0],
        code,
      });
      setOpenPanel(null);
      // Start the next open on the nearest list, not on a stale query.
      setStationFilter('');
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
      const rawName = closestFeature.properties?.name || closestFeature.properties?.['name:en'] || 'Station';
      const cleanName = cleanStationName(rawName);
      const net = closestFeature.properties?.network || '';
      const code = getStationCode(closestFeature);
      setActiveStationPopup({
        name: cleanName,
        network: net,
        lat: coords[1],
        lng: coords[0],
        code,
      });
      setMapTarget({
        lat: coords[1],
        lng: coords[0],
        zoom: 15,
        animate: true,
        timestamp: Date.now(),
      });
      onStationSelect(cleanName, coords[1], coords[0]);
    }
  };

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
        {/* CARTO basemap — light/dark variant tracks the app appearance */}
        <TileLayer
          key={basemapStyle}
          url={
            import.meta.env.VITE_CARTO_API_KEY
              ? `https://{s}.basemaps.cartocdn.com/${basemapStyle}/{z}/{x}/{y}{r}.png?key=${import.meta.env.VITE_CARTO_API_KEY}`
              : `https://{s}.basemaps.cartocdn.com/${basemapStyle}/{z}/{x}/{y}{r}.png`
          }
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        />

        {/* Custom panes */}
        <RailPane />
        <StationPane />
        <UserLocationPane />
        <LiveVehiclePane />

        {/* Map View Controller for smooth animated centering */}
        <MapViewController target={mapTarget} />

        {/* Zoom listener for clustering */}
        <MapZoomListener onZoom={setCurrentZoom} />

        {/* Station Search Radius Circle on the Map */}
        {resolvedStationCoords && (
          <Circle
            center={[resolvedStationCoords.lat, resolvedStationCoords.lng]}
            radius={distanceRadius}
            pathOptions={{
              color: '#14B8A6',
              fillColor: '#14B8A6',
              fillOpacity: 0.06,
              weight: 1.8,
              dashArray: '6 6',
              interactive: false,
            }}
          />
        )}

        {/* ---- GTFS Rail Lines (GeoJSON LineStrings) ---- */}
        {filteredLines && (
          <GeoJSON
            key={JSON.stringify(visibleLines)}
            data={filteredLines}
            pane="railPane"
            style={(feature) => ({
              color: feature?.properties?.route_color || '#3388ff',
              weight: 4.5,
              opacity: 0.9,
              interactive: false,
            })}
          />
        )}

        <ZoomControl position="bottomright" />

        {/* ---- Driving Road Route from Current Location to Parking Bay ---- */}
        {drivingRoute && (showLinearNavigator || journeyTab === 'drive') && (
          <>
            <Polyline
              positions={drivingRoute.geometry}
              pathOptions={{
                color: '#ffffff',
                weight: 8,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
                interactive: false,
              }}
            />
            <Polyline
              positions={drivingRoute.geometry}
              pathOptions={{
                color: '#2563EB',
                weight: 5.5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            >
              <Popup autoPan={false}>
                <div className="text-xs p-1">
                  <div className="flex items-center gap-1.5 font-bold text-blue-700 text-sm">
                    <Car size={15} />
                    <span>Drive to {drivingRoute.destination.name}</span>
                  </div>
                  <div className="text-[12px] text-slate-800 font-bold mt-1">
                    {drivingRoute.durationText} · {drivingRoute.distanceText}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Road driving route from current location
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-100">
                    <a
                      href={drivingRoute.wazeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-cyan-700 font-bold hover:underline"
                    >
                      Open in Waze ➔
                    </a>
                    <span>·</span>
                    <a
                      href={drivingRoute.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-blue-700 font-bold hover:underline"
                    >
                      Google Maps ➔
                    </a>
                  </div>
                </div>
              </Popup>
            </Polyline>
          </>
        )}

        {/* Polyline connecting selected station to selected parking spot (default view) */}
        {selectedStationCoords && selectedSpot && !showLinearNavigator && (
          <Polyline
            positions={[
              [selectedStationCoords.lat, selectedStationCoords.lng],
              [selectedSpot.lat, selectedSpot.lng],
            ]}
            pathOptions={{ color: '#007AFF', weight: 3, opacity: 0.6, dashArray: '6 8', interactive: false }}
          />
        )}

        {/* ---- Render Linear Multimodal Continuous Journey (OpenTripPlanner Model) ---- */}
        {showLinearNavigator && activeItinerary && (
          <>
            {/* Draw each leg of the journey */}
            {activeItinerary.legs.map((leg, lIdx) => {
              const isThisLegFocused = focusedLegIndex === lIdx;
              if (leg.mode === 'WALK') {
                return (
                  <Polyline
                    key={`linear-leg-walk-${lIdx}`}
                    positions={leg.geometry}
                    pathOptions={{
                      color: isThisLegFocused ? '#007AFF' : '#2563EB',
                      weight: isThisLegFocused ? 6 : 4.5,
                      opacity: 0.95,
                      dashArray: '6 8',
                      lineCap: 'round',
                    }}
                  >
                    <Popup autoPan={false}>
                      <div className="text-xs p-1">
                        <div className="flex items-center gap-1.5 font-bold text-blue-700">
                          <Footprints size={14} />
                          <span>{leg.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">{leg.summary}</p>
                      </div>
                    </Popup>
                  </Polyline>
                );
              } else if (leg.mode === 'BUS') {
                return (
                  <React.Fragment key={`linear-leg-bus-${lIdx}`}>
                    {/* Casing */}
                    <Polyline
                      positions={leg.geometry}
                      pathOptions={{
                        color: '#ffffff',
                        weight: 8,
                        opacity: 0.95,
                        lineCap: 'round',
                        lineJoin: 'round',
                        interactive: false,
                      }}
                    />
                    {/* Route line */}
                    <Polyline
                      positions={leg.geometry}
                      pathOptions={{
                        color: leg.transitDetails?.routeColor || '#008716',
                        weight: isThisLegFocused ? 6.5 : 5,
                        opacity: 0.95,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    >
                      <Popup autoPan={false}>
                        <div className="text-xs p-1">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                            <Bus size={14} />
                            <span>{leg.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1">{leg.summary}</p>
                        </div>
                      </Popup>
                    </Polyline>

                    {/* Boarding Stop Badge */}
                    <Marker
                      position={[leg.fromCoords.lat, leg.fromCoords.lng]}
                      icon={boardStopIcon}
                      zIndexOffset={600}
                    />

                    {/* Alighting Stop Badge */}
                    <Marker
                      position={[leg.toCoords.lat, leg.toCoords.lng]}
                      icon={alightStopIcon}
                      zIndexOffset={600}
                    />
                  </React.Fragment>
                );
              }
              return null;
            })}

            {/* Real Origin (Passable Street Exit) Marker */}
            {linearPlan && (
              <Marker
                position={[linearPlan.origin.exitCoords.lat, linearPlan.origin.exitCoords.lng]}
                icon={L.divIcon({
                  className: 'custom-exit-marker',
                  html: `
                    <div style="background: #2563eb; color: white; border: 2px solid white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                      🚪
                    </div>
                  `,
                  iconSize: [22, 22],
                  iconAnchor: [11, 11],
                })}
              >
                <Popup autoPan={false}>
                  <div className="text-xs p-1">
                    <strong>Passable Exit</strong>
                    <div className="text-[10px] text-slate-500 mt-0.5">{linearPlan.origin.exitName}</div>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Target Station Entrance Marker */}
            {activeItinerary.legs.length > 0 && (
              <Marker
                position={[
                  activeItinerary.legs[activeItinerary.legs.length - 1].toCoords.lat,
                  activeItinerary.legs[activeItinerary.legs.length - 1].toCoords.lng,
                ]}
                icon={stationEntranceIcon}
                zIndexOffset={650}
              />
            )}
          </>
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
              <Popup autoPan={false}>
                <div className="text-xs min-w-[160px] py-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#007AFF] shadow-xs" />
                    <span>Your Current Location</span>
                  </div>
                  <p className="text-slate-500 dark:text-[#a1a1aa] text-[11px] mt-1">
                    {effectiveAccuracy
                      ? `Accurate to ~${Math.round(effectiveAccuracy)} m`
                      : 'GPS position active'}
                  </p>
                  <div className="mt-1 text-[10px] text-slate-400 dark:text-[#71717a] font-mono">
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

        {/* ---- Render Zoomed-Out Cluster Markers (at zoom <= 11) ---- */}
        {stationClusters &&
          stationClusters.map((cluster) => (
            <Marker
              key={cluster.id}
              position={[cluster.lat, cluster.lng]}
              pane="stationPane"
              icon={createClusterIcon(cluster.count)}
              eventHandlers={{
                click: (e) => {
                  e.originalEvent?.stopPropagation();
                  setMapTarget({
                    lat: cluster.lat,
                    lng: cluster.lng,
                    zoom: 13,
                    animate: true,
                    timestamp: Date.now(),
                  });
                },
              }}
            />
          ))}

        {/* ---- Render Transit Station Markers (at zoom >= 12, or always for selected station) ---- */}
        {stationFeatures.map((feature: any, idx: number) => {
          const coords = feature.geometry.coordinates;
          const rawName = feature.properties?.name || feature.properties?.['name:en'] || '';
          const cleanName = cleanStationName(rawName);
          const stationKeys = getStationKeys(feature);
          const isSelected = stationKeys.includes(selectedStationKey);
          const isSearchOrigin = isSelected && Boolean(selectedStationCoords);

          // If zoomed out, only show the selected / active origin station individually
          if (currentZoom < 12 && !isSelected) return null;
          if (!coords || coords.length < 2) return null;

          const lines = getStationLines(feature);
          const isInterchange = lines.length >= 2 || ['Masjid Jamek', 'Pasar Seni', 'KL Sentral', 'Titiwangsa', 'Chan Sow Lin', 'Tun Razak Exchange', 'Maluri', 'Hang Tuah', 'Ampang Park', 'Sungai Besi', 'Bandar Utama', 'Kwasa Damansara', 'Bukit Bintang'].some((h) => cleanName.includes(h));

          const icon = createStationMarkerIcon({
            rawName,
            lines,
            isInterchange,
            isSelected,
            isSearchOrigin,
          });

          return (
            <Marker
              key={`station-${cleanName}`}
              position={[coords[1], coords[0]]}
              pane="stationPane"
              icon={icon}
              zIndexOffset={isSelected ? 1000 : isInterchange ? 600 : 400}
              eventHandlers={{
                click: (e) => {
                  e.originalEvent?.stopPropagation();
                  handleStationMarkerClick(feature, e);
                },
              }}
            />
          );
        })}

        {/* ---- Render Selected Rapid Bus KL Route Geometry & Bus Stops (From static GTFS) ---- */}
        {activeRouteDetails && activeRouteDetails.coordinates && activeRouteDetails.coordinates.length > 0 && (
          <>
            {/* White casing outline for high contrast on map */}
            <Polyline
              key={`bus-route-casing-${activeRouteDetails.routeId}`}
              positions={activeRouteDetails.coordinates}
              pathOptions={{
                color: '#ffffff',
                weight: 7,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
                interactive: false,
              }}
            />
            {/* Main colored bus route road line */}
            <Polyline
              key={`bus-route-line-${activeRouteDetails.routeId}`}
              positions={activeRouteDetails.coordinates}
              pathOptions={{
                color: activeRouteDetails.color || '#008716',
                weight: 4.5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            >
              <Popup autoPan={false}>
                <div className="text-xs p-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: activeRouteDetails.color || '#008716' }}
                    />
                    <span>Rapid KL Route {activeRouteDetails.shortName}</span>
                  </div>
                  <div className="text-slate-600 text-[11px] mt-0.5">
                    {activeRouteDetails.longName}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                    {activeRouteDetails.stops?.length || 0} stops along route
                  </div>
                </div>
              </Popup>
            </Polyline>

            {/* Bus stops along this selected route */}
            {activeRouteDetails.stops &&
              activeRouteDetails.stops.map((stop, sIdx) => (
                <Marker
                  key={`bus-stop-${stop.stopId || sIdx}`}
                  position={[stop.lat, stop.lon]}
                  icon={createBusStopIcon(stop.stopName, activeRouteDetails.color || '#008716')}
                  zIndexOffset={410}
                >
                  <Popup autoPan={false}>
                    <div className="text-xs min-w-[170px] py-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: activeRouteDetails.color || '#008716' }}
                        />
                        <span className="truncate">{stop.stopName}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        Stop ID: {stop.stopId}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-medium mt-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center justify-between">
                        <span>Rapid KL Route</span>
                        <strong className="font-mono">{activeRouteDetails.shortName}</strong>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* Walking connector from selected parking spot to nearest bus stop on this route */}
            {selectedSpot && nearestStopToActiveSpot && (
              <Polyline
                positions={[
                  [selectedSpot.lat, selectedSpot.lng],
                  [nearestStopToActiveSpot.stop.lat, nearestStopToActiveSpot.stop.lon],
                ]}
                pathOptions={{
                  color: '#059669',
                  weight: 3,
                  opacity: 0.9,
                  dashArray: '4 6',
                  interactive: false,
                }}
              />
            )}
          </>
        )}

        {/* ---- Render Live Moving Transit Buses (GTFS-Realtime - Filtered by Route) ---- */}
        {showLiveBuses &&
          displayVehicles.map((feature, fIdx) => {
            const coords = feature.geometry?.coordinates;
            const props = feature.properties;
            if (!coords || coords.length < 2) return null;
            const lat = coords[1];
            const lng = coords[0];
            const bearing = props.bearing || 0;
            const routeId = props.routeId || '';
            const speed = props.speedKmh != null ? Math.round(props.speedKmh) : null;
            const icon = createLiveBusIcon(bearing, routeId);

            return (
              <Marker
                key={`bus-${props.vehicleId || props.id || fIdx}`}
                position={[lat, lng]}
                pane="liveVehiclePane"
                icon={icon}
                zIndexOffset={effectiveBusRoute ? 450 : 380}
              >
                <Popup autoPan={false}>
                  <div className="text-xs min-w-[180px] py-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 text-sm">
                      <Bus className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>MRT Feeder {routeId || props.vehicleId}</span>
                      {effectiveBusRoute && (
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-mono font-bold px-1.5 py-0.2 rounded ml-auto">
                          Isolated
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Plate:</span>
                        <strong className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          {props.licensePlate || props.vehicleId}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Speed:</span>
                        <strong className="text-slate-800">
                          {speed != null ? `${speed} km/h` : 'N/A'}{' '}
                          <span className={`text-[10px] font-medium ml-1 ${speed && speed > 5 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            ({speed && speed > 5 ? 'Moving' : 'Idle'})
                          </span>
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Heading:</span>
                        <span className="font-mono text-slate-700">{Math.round(bearing)}°</span>
                      </div>
                      {effectiveUserLocation && (
                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-blue-600 font-medium">
                          <span>From you:</span>
                          <strong>{(distanceBetweenKm(effectiveUserLocation, { lat, lng })).toFixed(1)} km</strong>
                        </div>
                      )}
                      {routeId && (
                        <button
                          type="button"
                          onClick={() => handleSelectRoute(effectiveBusRoute === routeId ? null : routeId)}
                          className="w-full mt-2 py-1 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] transition-colors border border-emerald-200 text-center"
                        >
                          {effectiveBusRoute === routeId ? '✕ Clear Route Filter' : `Isolate Route ${routeId} on Map`}
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* Active Station Details Popup: Compact Apple-HIG Popover */}
        {activeStationPopup && popupPosition && (
          <Popup
            position={popupPosition}
            offset={[0, -14]}
            autoPan={false}
            closeOnClick={false}
            autoClose={false}
            closeButton={false}
          >
            <div className="w-[196px] sm:w-[208px] text-[11px] leading-snug select-none">
              <div className="flex items-center gap-1 font-bold text-slate-900 dark:text-white text-[12px]">
                <Train className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="truncate">{activeStationPopup.name}</span>
                {activeStationPopup.code && (
                  <span className="font-mono text-[9.5px] font-bold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white px-1 py-0.2 rounded border border-slate-200 dark:border-white/15 shrink-0">
                    {activeStationPopup.code}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDismissedStation(activeStationPopup.name);
                    setActiveStationPopup(null);
                  }}
                  className="ml-auto w-4 h-4 flex items-center justify-center text-slate-400 dark:text-[#a1a1aa] hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors shrink-0"
                  aria-label="Close station popup"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="text-slate-500 dark:text-[#a1a1aa] text-[10px] mt-0.5 truncate">
                {(activeStationPopup.network || 'Transit Station').replace(/;/g, ' · ')}
              </div>
              <div className="mt-1.5 pt-1 border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-1.5 text-[10px]">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {spots.length} bay{spots.length === 1 ? '' : 's'} in range
                </span>
                <span className="text-[9.5px] text-slate-400 dark:text-[#71717a]">
                  ≤ {distanceRadius < 1000 ? `${distanceRadius}m` : `${distanceRadius / 1000}km`}
                </span>
              </div>

              {/* Connecting MRT Feeder Buses Widget with Selective Route Filter */}
              <StationFeedersWidget
                compact={true}
                stopId={activeStationPopup.code}
                stationName={activeStationPopup.name}
                coordinates={popupCoords}
                selectedRoute={effectiveBusRoute}
                onSelectRoute={handleSelectRoute}
              />

              {/* Action Button: Navigate / View Nearby Parking Bays */}
              {spots.length > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (spots[0]) onSpotClick(spots[0]);
                  }}
                  className="mt-1.5 w-full flex items-center justify-center gap-1 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[10px] font-semibold py-1 px-2 rounded-md transition-colors shadow-2xs"
                >
                  <Car className="w-3 h-3 text-emerald-300 shrink-0" />
                  <span className="truncate">View Parking Bays ({spots.length})</span>
                </button>
              ) : (
                <div className="mt-1.5 w-full py-1 px-1.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-md text-center text-[9.5px] text-slate-500 dark:text-[#a1a1aa] flex items-center justify-center gap-1">
                  <Car className="w-2.5 h-2.5 text-slate-400 dark:text-[#71717a] shrink-0" />
                  <span className="truncate">No private bays in radius</span>
                </div>
              )}
            </div>
          </Popup>
        )}

        {/* Guaranteed Pinpoint for User's Active Reserved Parking Spot */}
        {activeBookingSpot && (
          <Marker
            position={[
              activeBookingSpot.lat || activeBookingSpot.latitude,
              activeBookingSpot.lng || activeBookingSpot.longitude,
            ]}
            icon={activeReservedParkingIcon}
            zIndexOffset={1200}
            eventHandlers={{
              click: () => {
                onSpotClick(activeBookingSpot);
                if (onNavigate) {
                  onNavigate();
                } else {
                  setShowLinearNavigator(true);
                  setJourneyTab('drive');
                }
              },
            }}
          >
            <Popup autoPan={false}>
              <div className="text-xs min-w-[210px] p-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm">
                  <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-xs font-mono font-bold">
                    P
                  </span>
                  <span className="truncate">{formatShortSpotName(activeBookingSpot.name)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50">
                  <span>Your Reserved Bay</span>
                  <span>Bay {activeBookingSpot.parkingLabel}</span>
                </div>
                {activeBookingSpot.address && (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-[#A1A1AA] leading-tight line-clamp-2">
                    {formatShortAddress(activeBookingSpot.address)}
                  </p>
                )}
                {drivingRoute && (
                  <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-[#A1A1AA]">From your location:</span>
                    <strong className="text-blue-700 dark:text-blue-400 font-bold">
                      {drivingRoute.durationText} ({drivingRoute.distanceText})
                    </strong>
                  </div>
                )}
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  <a
                    href={
                      drivingRoute?.wazeUrl ||
                      `https://waze.com/ul?ll=${activeBookingSpot.lat || activeBookingSpot.latitude},${activeBookingSpot.lng || activeBookingSpot.longitude}&navigate=yes`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="py-1 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 dark:bg-white/10 dark:text-white dark:border-white/14 dark:hover:bg-white/15 font-bold text-[11px] text-center flex items-center justify-center gap-1 shadow-2xs transition"
                  >
                    <Navigation size={11} className="text-cyan-600 dark:text-cyan-400" />
                    <span>Waze</span>
                  </a>
                  <a
                    href={
                      drivingRoute?.googleMapsUrl ||
                      `https://www.google.com/maps/dir/?api=1&destination=${activeBookingSpot.lat || activeBookingSpot.latitude},${activeBookingSpot.lng || activeBookingSpot.longitude}&travelmode=driving`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="py-1 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 dark:bg-white/10 dark:text-white dark:border-white/14 dark:hover:bg-white/15 font-bold text-[11px] text-center flex items-center justify-center gap-1 shadow-2xs transition"
                  >
                    <Navigation size={11} className="text-blue-600 dark:text-blue-400" />
                    <span>Google Maps</span>
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate();
                    } else {
                      setShowLinearNavigator(true);
                      setJourneyTab('drive');
                    }
                    if (drivingRoute) {
                      setMapTarget({
                        bounds: drivingRoute.bounds,
                        animate: true,
                        timestamp: Date.now(),
                      });
                    }
                  }}
                  className="w-full mt-2 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Navigation size={12} />
                  <span>Turn-by-Turn Driving Route</span>
                </button>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Render ALL available parking spots in range of selected station */}
        {shouldShowParking && displaySpots.map((spot) => {
          const isThisSelected = selectedSpot?.id === spot.id;
          const spotRoutes = spotConnectingRoutesMap.get(String(spot.id)) || [];
          return (
            <Marker
              key={spot.id}
              position={[spot.displayLat, spot.displayLng]}
              icon={isThisSelected ? selectedParkingIcon : parkingIcon}
              zIndexOffset={isThisSelected ? 800 : 500}
              eventHandlers={{
                click: () => {
                  setActiveStationPopup(null);
                  onSpotClick(spot);
                },
              }}
            >
              <Popup autoPan={false}>
                <div className="w-[196px] sm:w-[208px] text-[10.5px] leading-snug select-none">
                  <div className="flex items-center justify-between gap-1">
                    <strong className="text-slate-900 dark:text-white text-[12px] truncate">{formatShortSpotName(spot.name)}</strong>
                    <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[9.5px] font-bold px-1 py-0.2 rounded border border-emerald-200 dark:border-emerald-800/50 shrink-0">
                      Bay {spot.parkingLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-slate-600 dark:text-[#D4D4D8] mt-1 font-semibold text-[10px]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                      {spot.dailyRate !== null
                        ? `RM ${spot.dailyRate.toFixed(2)}/day`
                        : spot.monthlyRate > 0
                          ? `RM ${spot.monthlyRate.toFixed(2)}/mo`
                          : 'Rate not set'}
                    </span>
                    <span className="text-slate-400 dark:text-[#A1A1AA] font-normal text-[9.5px]">
                      {spot.distanceToStation ? spot.distanceToStation.toFixed(1) : (spot.distance / 1000).toFixed(1)}km
                      {spot.timeToStationInMinutes ? ` · ${spot.timeToStationInMinutes}m` : ''}
                    </span>
                  </div>
                  {spot.address && (
                    <div className="mt-0.5 text-[9.5px] text-slate-400 dark:text-[#A1A1AA] truncate">{formatShortAddress(spot.address)}</div>
                  )}

                  {/* Connecting Rapid KL Bus Route to Station */}
                  {spotRoutes.length > 0 && (
                    <div className="mt-1.5 p-1.5 bg-emerald-50/80 dark:bg-emerald-950/60 rounded-md border border-emerald-200/80 dark:border-emerald-800/50 text-[10px]">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 font-bold text-emerald-900 dark:text-emerald-200 text-[10px] truncate">
                          <Bus className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="truncate">Feeder Bus</span>
                        </div>
                        <span className="text-[9.5px] bg-emerald-600 text-white font-mono font-bold px-1 py-0.2 rounded shrink-0">
                          {spotRoutes[0].route.shortName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectRoute(
                            effectiveBusRoute === spotRoutes[0].route.shortName ? null : spotRoutes[0].route.shortName
                          );
                        }}
                        className={`mt-1 w-full py-1 px-1.5 rounded font-semibold text-[9.5px] transition-colors flex items-center justify-center gap-1 ${
                          effectiveBusRoute === spotRoutes[0].route.shortName
                            ? 'bg-emerald-800 dark:bg-emerald-700 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                        }`}
                      >
                        <Bus className="w-2.5 h-2.5" />
                        <span>
                          {effectiveBusRoute === spotRoutes[0].route.shortName
                            ? '✕ Hide Bus Route'
                            : `Show ${spotRoutes[0].route.shortName} Route`}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-1.5 grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSpotClick(spot);
                        if (onNavigate) {
                          onNavigate();
                        } else {
                          setShowLinearNavigator(true);
                        }
                        if (linearPlan) {
                          const it = linearPlan.recommendedItinerary;
                          setMapTarget({
                            bounds: it.bounds,
                            animate: true,
                            timestamp: Date.now(),
                          });
                        }
                      }}
                      className="py-1 px-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[9.5px] transition-colors flex items-center justify-center gap-1"
                    >
                      <Compass className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">Route</span>
                    </button>

                    <button
                      type="button"
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
                      className="py-1 px-1.5 bg-slate-900 dark:bg-[#242429] dark:border dark:border-white/14 hover:bg-slate-800 dark:hover:bg-[#2C2C32] text-white text-[9.5px] font-semibold rounded-md transition-colors truncate cursor-pointer"
                    >
                      Book Bay
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Station Marker System Legend Modal */}
      <MapLegendModal
        isOpen={openPanel === 'legend'}
        onClose={() => setOpenPanel(null)}
      />

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

      {/* Top Bar: Station Indicator (mobile only), Radius, Lines & Legend */}
      <div className="map-toolbar absolute top-3 left-3 right-3 z-[800] flex items-center justify-between gap-2 pointer-events-none">
        {/* Left: Active Station control (mobile only; on desktop the sidebar handles stations).
            On phones it gets its own full-width row: picking a station is the screen's primary job. */}
        <div className="map-toolbar__station-wrap pointer-events-auto flex min-w-0 items-center lg:hidden">
          <button
            type="button"
            data-map-control
            onClick={() => setOpenPanel((panel) => panel === 'stations' ? null : 'stations')}
            aria-expanded={openPanel === 'stations'}
            aria-haspopup="dialog"
            aria-controls="station-picker"
            aria-label={selectedStation ? `Station: ${selectedStation}. Change station` : 'Choose a station'}
            className="map-toolbar__station map-capsule flex min-w-0 items-center gap-2.5 pl-2 pr-3.5 text-left"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#007aff] text-white" aria-hidden="true">
              <Train className="h-4 w-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[11px] font-medium text-[#6e6e73] dark:text-[#8e8e93]">
                {selectedStation ? 'Station' : 'Start here'}
              </span>
              <span className={`truncate text-[15px] font-semibold ${
                selectedStation
                  ? 'text-[#1d1d1f] dark:text-[#f2f2f7]'
                  : 'text-[#007aff] dark:text-[#409cff]'
              }`}>
                {selectedStation || 'Choose a station'}
              </span>
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-[#8e8e93] transition-transform ${openPanel === 'stations' ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>

        {/* Right: Radius Filter, Lines Toggle, Legend */}
        <div className="map-toolbar__filters pointer-events-auto flex items-center gap-1.5 flex-wrap justify-end ml-auto">
          {/* Radius Filter — auto-refilters nearby spots on change */}
          <SystemSelect
            value={distanceRadius}
            onChange={(e) => {
              onDistanceRadiusChange(Number(e.target.value));
            }}
            aria-label="Parking search radius"
            className="map-toolbar__radius map-capsule workspace-map-control whitespace-nowrap px-3.5 text-[13px] font-semibold"
          >
            <option value={300}>Within 300m</option>
            <option value={500}>Within 500m</option>
            <option value={1000}>Within 1km</option>
            <option value={2000}>Within 2km</option>
            <option value={3000}>Within 3km</option>
            <option value={5000}>Within 5km</option>
          </SystemSelect>

          {/* Rail Lines Toggle */}
          <div className="map-lines-control relative flex flex-col items-start" data-map-control>
            <button
              type="button"
              onClick={() => setOpenPanel((panel) => panel === 'lines' ? null : 'lines')}
              aria-expanded={openPanel === 'lines'}
              aria-controls="rail-lines-panel"
              className="map-capsule workspace-map-control flex items-center gap-1.5 whitespace-nowrap px-3.5 text-[13px] font-semibold"
            >
              <Layers className="h-3.5 w-3.5 text-blue-600" />
              Lines
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${openPanel === 'lines' ? 'rotate-180' : ''}`} />
            </button>

            {openPanel === 'lines' && (
              <div id="rail-lines-panel" className="map-lines-control__panel origin-top-right right-0 absolute top-full mt-1.5 animate-slide-up">
                <LineControlPanel
                  visibleLines={visibleLines}
                  onToggle={handleLineToggle}
                  showHeader={false}
                />
              </div>
            )}
          </div>

          {/* Selective Rapid KL Bus Route Dropdown Filter */}
          <div className="map-bus-routes-control relative flex flex-col items-start" data-map-control>
            <button
              type="button"
              onClick={() => setOpenPanel((panel) => panel === 'busRoutes' ? null : 'busRoutes')}
              aria-expanded={openPanel === 'busRoutes'}
              aria-controls="bus-routes-panel"
              className={`map-capsule workspace-map-control flex items-center gap-1.5 whitespace-nowrap px-3.5 text-[13px] font-semibold ${
                effectiveBusRoute ? 'is-active-bus' : ''
              }`}
            >
              <Bus className={`h-3.5 w-3.5 ${effectiveBusRoute ? 'text-white' : 'text-emerald-600'}`} />
              {effectiveBusRoute ? (
                <span>{`Route ${effectiveBusRoute}`}</span>
              ) : (
                <span>
                  <span className="sm:hidden">Bus</span>
                  <span className="hidden sm:inline">Bus Routes</span>
                </span>
              )}
              {effectiveBusRoute ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectRoute(null);
                  }}
                  className="ml-0.5 hover:bg-emerald-700 rounded-full w-4 h-4 flex items-center justify-center text-[10px] cursor-pointer"
                  title="Clear bus route"
                >
                  ✕
                </span>
              ) : (
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${openPanel === 'busRoutes' ? 'rotate-180' : ''}`} />
              )}
            </button>

            {openPanel === 'busRoutes' && (
              <div
                id="bus-routes-panel"
                className="origin-top-right right-0 absolute top-full mt-1.5 z-[1001] w-72 sm:w-80 bg-white/98 backdrop-blur-md rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-slide-up"
              >
                <div className="p-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Bus className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[11px] font-bold text-slate-800">Rapid KL Bus Route</span>
                  </div>
                  {effectiveBusRoute && (
                    <button
                      type="button"
                      onClick={() => handleSelectRoute(null)}
                      className="text-[10px] text-rose-600 hover:text-rose-700 font-semibold"
                    >
                      Hide Route
                    </button>
                  )}
                </div>

                <div className="p-2 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search routes (e.g. T776, 770, 400)..."
                      value={busRouteSearch}
                      onChange={(e) => setBusRouteSearch(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="p-1 max-h-64 overflow-y-auto no-scrollbar space-y-1">
                  {/* Clear route option */}
                  {effectiveBusRoute && (
                    <button
                      type="button"
                      onClick={() => handleSelectRoute(null)}
                      className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between text-rose-600 hover:bg-rose-50"
                    >
                      <span className="font-semibold">✕ Hide Bus Route (Clean View)</span>
                    </button>
                  )}

                  {/* Section 1: Connecting routes passing near parking spot to station */}
                  {selectedSpot && selectedSpotConnectingRoutes.length > 0 && !busRouteSearch && (
                    <div className="mb-1">
                      <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
                        <span>🌟 Connecting to this Parking Bay</span>
                      </div>
                      {selectedSpotConnectingRoutes.map((cr) => {
                        const isThisSelected = effectiveBusRoute?.toUpperCase() === cr.route.shortName.toUpperCase();
                        return (
                          <button
                            key={`conn-${cr.route.routeId}`}
                            type="button"
                            onClick={() => handleSelectRoute(cr.route.shortName)}
                            className={`w-full text-left px-2.5 py-2 text-xs rounded-lg transition-colors flex items-center justify-between ${
                              isThisSelected ? 'bg-emerald-600 text-white font-bold' : 'bg-emerald-50/70 hover:bg-emerald-100/70 text-slate-800'
                            }`}
                          >
                            <div className="min-w-0 pr-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                                  isThisSelected ? 'bg-emerald-800 text-white' : 'bg-emerald-200/90 text-emerald-900'
                                }`}>
                                  {cr.route.shortName}
                                </span>
                                <span className="truncate font-semibold">{cr.route.longName}</span>
                              </div>
                              <div className={`text-[10px] mt-0.5 ${isThisSelected ? 'text-emerald-100' : 'text-emerald-700'}`}>
                                {cr.nearestStopToSpot
                                  ? `${cr.distanceToSpotMeters}m walk to ${cr.nearestStopToSpot.stop.stopName}`
                                  : `Passes within ${cr.distanceToSpotMeters}m`}
                              </div>
                            </div>
                            <span className="text-[10px] shrink-0 font-bold">Select</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Section 2: Routes serving the selected station */}
                  {selectedStationCoords && stationServingRoutes.length > 0 && !busRouteSearch && (
                    <div className="mb-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1">
                        Serving {selectedStation || 'Selected Station'}
                      </div>
                      {stationServingRoutes.slice(0, 8).map((r) => {
                        const isThisSelected = effectiveBusRoute?.toUpperCase() === r.shortName.toUpperCase();
                        return (
                          <button
                            key={`srv-${r.routeId}`}
                            type="button"
                            onClick={() => handleSelectRoute(r.shortName)}
                            className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between ${
                              isThisSelected ? 'bg-emerald-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                                isThisSelected ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {r.shortName}
                              </span>
                              <span className="truncate">{r.longName}</span>
                            </div>
                            <span className={`text-[10px] font-mono shrink-0 ml-1.5 ${isThisSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                              {r.stops?.length || 0} stops
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Section 3: All Rapid Bus KL Routes */}
                  <div>
                    {(!selectedStationCoords || busRouteSearch) && (
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                        All Rapid Bus Routes ({allStaticRoutes.length})
                      </div>
                    )}
                    {allStaticRoutes
                      .filter((r) =>
                        r.shortName.toLowerCase().includes(busRouteSearch.toLowerCase()) ||
                        r.longName.toLowerCase().includes(busRouteSearch.toLowerCase())
                      )
                      .slice(0, 30)
                      .map((r) => {
                        const isThisSelected = effectiveBusRoute?.toUpperCase() === r.shortName.toUpperCase();
                        return (
                          <button
                            key={r.routeId}
                            type="button"
                            onClick={() => handleSelectRoute(r.shortName)}
                            className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between ${
                              isThisSelected ? 'bg-emerald-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                                isThisSelected ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {r.shortName}
                              </span>
                              <span className="truncate">{r.longName}</span>
                            </div>
                            <span className={`text-[10px] font-mono shrink-0 ml-1.5 ${isThisSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                              {r.stops?.length || 0} stops
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Legend Button */}
          <button
            type="button"
            data-map-control
            onClick={() => setOpenPanel((panel) => panel === 'legend' ? null : 'legend')}
            aria-expanded={openPanel === 'legend'}
            aria-controls="map-legend-modal"
            className="map-capsule workspace-map-control hidden sm:flex items-center gap-1.5 whitespace-nowrap px-3.5 text-[13px] font-semibold"
          >
            <Info className="h-3.5 w-3.5 text-blue-600" />
            Legend
          </button>
        </div>
      </div>

      {/* Floating My Location Button */}
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

      <StationPickerSheet
        open={openPanel === 'stations'}
        onClose={() => setOpenPanel(null)}
        query={stationFilter}
        onQueryChange={setStationFilter}
        selectedStation={selectedStation}
        onSelectStation={handleListStationClick}
        nearestStations={nearestStations}
        listStations={listStations}
        showNearest={showNearest}
        distanceFor={(name) =>
          stationDistances.get(name) ?? stationDistances.get(normalizeStationKey(name))
        }
        ringFor={(name) => metaForStation(name)?.ring}
        hasUserLocation={Boolean(effectiveUserLocation)}
        locationStatus={effectiveStatus}
        onRequestLocation={onRequestLocation}
      />

      {/* ── Google Maps Style Navigation Drawer / Mobile Bottom Sheet ── */}
      {showLinearNavigator && (drivingRoute || linearPlan) && (
        <div
          data-map-control
          className={`absolute z-[1001] animate-slide-up flex flex-col justify-end ${
            isNavigatorMinimized
              ? 'lg:top-14 lg:left-3.5 lg:bottom-auto lg:right-auto lg:w-[360px] bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-3 left-3 right-3'
              : 'lg:top-14 lg:left-3.5 lg:bottom-auto lg:right-auto lg:w-[360px] lg:max-h-[calc(100%-4.5rem)] bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 w-full max-h-[calc(100%-4.5rem)]'
          } ${workspaceMode === 'navigation' ? 'hidden' : ''}`}
        >
          <LinearJourneyNavigator
            plan={linearPlan}
            drivingRoute={drivingRoute}
            activeItineraryId={activeItineraryId}
            onSelectItinerary={(id) => {
              setActiveItineraryId(id);
              const it = linearPlan?.allItineraries.find((i) => i.id === id);
              if (it) {
                setMapTarget({
                  bounds: it.bounds,
                  animate: true,
                  timestamp: Date.now(),
                });
              }
            }}
            focusedLegIndex={focusedLegIndex}
            onFocusLeg={(idx) => {
              setFocusedLegIndex(idx);
              if (idx === null) {
                if (activeItinerary) {
                  setMapTarget({
                    bounds: activeItinerary.bounds,
                    animate: true,
                    timestamp: Date.now(),
                  });
                }
              } else if (activeItinerary && activeItinerary.legs[idx]) {
                const leg = activeItinerary.legs[idx];
                let minLat = 90;
                let maxLat = -90;
                let minLng = 180;
                let maxLng = -180;
                leg.geometry.forEach(([lat, lng]) => {
                  if (lat < minLat) minLat = lat;
                  if (lat > maxLat) maxLat = lat;
                  if (lng < minLng) minLng = lng;
                  if (lng > maxLng) maxLng = lng;
                });
                setMapTarget({
                  bounds: [
                    [minLat, minLng],
                    [maxLat, maxLng],
                  ],
                  animate: true,
                  timestamp: Date.now(),
                });
              }
            }}
            preference={preference}
            onChangePreference={(pref) => setPreference(pref)}
            journeyTab={journeyTab}
            onChangeJourneyTab={setJourneyTab}
            isMinimized={isNavigatorMinimized}
            onToggleMinimize={() => setIsNavigatorMinimized(!isNavigatorMinimized)}
            onFocusDrivingRoute={() => {
              if (drivingRoute) {
                setMapTarget({
                  bounds: drivingRoute.bounds,
                  animate: true,
                  timestamp: Date.now(),
                });
              }
            }}
            onFocusTransitRoute={() => {
              if (activeItinerary) {
                setMapTarget({
                  bounds: activeItinerary.bounds,
                  animate: true,
                  timestamp: Date.now(),
                });
              }
            }}
            onClose={() => {
              setShowLinearNavigator(false);
              setFocusedLegIndex(null);
              onExitNavigation?.();
            }}
          />
        </div>
      )}

      {/* ── Unified Bottom Floating Stack: Active Bus Route Pill + Driving Navigation Quick Pill (Zero Overlap) ── */}
      {!showLinearNavigator && (effectiveBusRoute || (targetSpot && (drivingRoute || linearPlan))) && (
        <div
          data-map-control
          className="map-bottom-stack absolute bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-4 left-3 right-14 z-[800] flex flex-col items-start gap-2 pointer-events-none"
        >
          {/* 1. Floating Active Bus Route Filter Pill */}
          {effectiveBusRoute && (
            <div className="pointer-events-auto bg-slate-900/95 text-white backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-xl border border-white/15 flex items-center gap-2.5 text-xs animate-slide-up w-auto max-w-full sm:max-w-md">
              <div className="px-2 h-6 rounded-md bg-emerald-600 flex items-center justify-center font-bold font-mono text-white text-[10.5px] shrink-0 shadow-xs">
                {effectiveBusRoute}
              </div>
              <div className="min-w-0 pr-1">
                <div className="font-bold text-white truncate text-[11px] leading-tight">
                  {activeRouteDetails?.longName || `Rapid KL Route ${effectiveBusRoute}`}
                </div>
                <div className="text-[9.5px] flex items-center gap-1.5 mt-0.5 truncate" style={{ color: '#86efac' }}>
                  <span>{activeRouteDetails?.stops?.length || 0} stops</span>
                  {displayVehicles.length > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-white/90">{displayVehicles.length} live bus{displayVehicles.length === 1 ? '' : 'es'}</span>
                    </>
                  )}
                  {nearestStopToActiveSpot && (
                    <>
                      <span>·</span>
                      <span className="font-semibold" style={{ color: '#5eead4' }}>
                        🚶 {nearestStopToActiveSpot.distanceMeters}m walk
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={() => handleSelectRoute(effectiveBusRoute)}
                  className="h-6 px-2 rounded-md bg-white/15 hover:bg-white/25 text-white text-[10px] font-semibold transition flex items-center justify-center"
                >
                  Focus
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectRoute(null)}
                  className="w-6 h-6 rounded-md bg-white/10 hover:bg-rose-600 hover:text-white text-slate-300 flex items-center justify-center text-[11px] font-bold transition"
                  title="Clear bus route"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* 2. Floating Quick Pill to open Navigation Guide */}
          {targetSpot && (drivingRoute || linearPlan) && (
            <button
              type="button"
              onClick={() => {
                if (onNavigate) {
                  onNavigate();
                } else {
                  setShowLinearNavigator(true);
                  setIsNavigatorMinimized(false);
                }
                if (journeyTab === 'drive' && drivingRoute) {
                  setMapTarget({
                    bounds: drivingRoute.bounds,
                    animate: true,
                    timestamp: Date.now(),
                  });
                } else if (activeItinerary) {
                  setMapTarget({
                    bounds: activeItinerary.bounds,
                    animate: true,
                    timestamp: Date.now(),
                  });
                }
              }}
              className={`pointer-events-auto bg-white/98 text-slate-800 backdrop-blur-md px-3 py-2 rounded-2xl shadow-xl border border-slate-200/90 flex items-center gap-2 text-xs font-bold hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition animate-slide-up w-auto max-w-full sm:max-w-md ${
                workspaceMode === 'navigation' ? 'lg:hidden' : ''
              }`}
            >
              <Compass className="w-4 h-4 text-blue-600 animate-spin-slow shrink-0" />
              <span className="truncate min-w-0 flex-1 text-left text-[11.5px]">
                {drivingRoute
                  ? `🚗 ${drivingRoute.durationText} drive to ${formatShortSpotName(targetSpot.name)}`
                  : `Route to ${formatShortSpotName(activeItinerary?.targetStationName || selectedStation || 'Station')}: ~${activeItinerary?.totalDurationMinutes} mins`}
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold shrink-0 ml-1">
                {workspaceMode === 'navigation' ? 'View Steps ➔' : 'Navigate ➔'}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
