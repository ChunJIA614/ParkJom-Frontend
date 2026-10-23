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
import { ParkingSpot } from '../types';
import { loadRailNetworkData } from '@/services/transitData';
import { watchDeviceLocation } from '@/services/deviceCapabilities';
import { showAlert } from '@/contexts/ModalContext';
import {
  Search,
  Navigation,
  Train,
  Clock,
  ChevronRight,
  Layers,
  Loader2,
  LocateFixed,
  Info,
} from 'lucide-react';

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
  SA: { name: 'Shah Alam Line', color: '#0284C7', code: 'SA' },
  KT: { name: 'KLIA Transit / Ekspres', color: '#7B1FA2', code: 'KT' },
  BRT: { name: 'BRT Sunway', color: '#115740', code: 'BRT' },
};

export function cleanStationName(rawName: string): string {
  return rawName
    .replace(/^(?:(?:AG|SP|KJ|KG|PY|MR|SA|KT|KB|KC|KA|KD)d*\s*)+/i, '')
    .replace(/\s+(?:LRT|MRT|Station)$/i, '')
    .trim() || rawName;
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

  let discSize = 18;
  let centerSize = 9;
  let hitboxSize = 36;

  if (isSelected || isSearchOrigin) {
    discSize = 36;
    centerSize = 22;
    hitboxSize = 48;
  } else if (isInterchange) {
    discSize = 28;
    centerSize = 14;
    hitboxSize = 42;
  }

  const gradient = getRingBackground(lines);

  let discClasses = 'station-marker-disc';
  let discStyle = `width: ${discSize}px; height: ${discSize}px; background: ${gradient};`;
  let centerHtml = '';

  if (isSelected || isSearchOrigin) {
    discClasses += isSearchOrigin ? ' is-origin-glow' : ' is-selected-pulse';
    centerHtml = `
      <div style="width: ${centerSize}px; height: ${centerSize}px; border-radius: 50%; background: #0F172A; display: flex; align-items: center; justify-content: center;">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="3" width="14" height="14" rx="3.5"/>
          <path d="M7 19l2-2.5m8 2.5-2-2.5M8 7h8m-8 4h.01m7.99 0h.01"/>
        </svg>
      </div>
    `;
    if (!isSearchOrigin) {
      discStyle += `box-shadow: 0 0 0 2.5px #ffffff, 0 4px 12px rgba(15,23,42,0.35);`;
    }
  } else {
    discStyle += `box-shadow: 0 0 0 2px #ffffff, 0 2px 6px rgba(0,0,0,0.22);`;
    centerHtml = `<div style="width: ${centerSize}px; height: ${centerSize}px; border-radius: 50%; background: #ffffff;"></div>`;
  }

  const hitboxClasses = [
    'station-marker-hitbox',
    isSelected ? 'is-selected' : '',
    isSearchOrigin ? 'is-search-origin' : '',
    isInterchange ? 'is-interchange' : '',
  ].filter(Boolean).join(' ');

  const labelText = isSearchOrigin ? `${cleanName} · Origin` : cleanName;

  const html = `
    <div class="${hitboxClasses}" style="width: ${hitboxSize}px; height: ${hitboxSize}px;">
      <div class="station-pill-label">
        <span>${labelText}</span>
      </div>
      <div class="${discClasses}" style="${discStyle}">
        ${centerHtml}
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-station-icon',
    html,
    iconSize: [hitboxSize, hitboxSize],
    iconAnchor: [hitboxSize / 2, hitboxSize / 2],
    popupAnchor: [0, -(hitboxSize / 2) - 4],
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

const normalizeStationKey = (value: string) => value.trim().toLowerCase().replace(/\s+(lrt|mrt)$/i, '');

const getStationKeys = (feature: any): string[] => {
  const p = feature.properties || {};
  return [
    p.name,
    p['name:en'],
    p.full_name,
    p.ref,
    cleanStationName(p.name || ''),
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
      map.panTo([target.lat, target.lng], {
        animate: true,
        duration: 0.35,
      });
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
    SAL: '#0284C7',
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
}: CommuterMapProps) {
  const klCenter: [number, number] = [3.1390, 101.6869];
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(null);
  const [currentZoom, setCurrentZoom] = useState(12);
  const [openPanel, setOpenPanel] = useState<'stations' | 'lines' | 'legend' | null>(null);
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

  const filteredList = stationNames.filter((n) =>
    n.toLowerCase().includes(stationFilter.toLowerCase())
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

  // Station marker click: Smooth gentle pan to center, opens details popup 100% reliably
  const handleStationMarkerClick = (feature: any, e?: any) => {
    if (e?.originalEvent) {
      e.originalEvent.stopPropagation();
    }
    const coords = feature.geometry.coordinates;
    const rawName = feature.properties?.name || feature.properties?.['name:en'] || 'Unknown Station';
    const cleanName = cleanStationName(rawName);
    const network = feature.properties?.network || '';
    if (!coords || coords.length < 2) return;

    onStationSelect(cleanName, coords[1], coords[0]);
    setActiveStationPopup({
      name: cleanName,
      network,
      lat: coords[1],
      lng: coords[0],
    });
    setOpenPanel(null);

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
      const rawName = closestFeature.properties?.name || closestFeature.properties?.['name:en'] || 'Station';
      const cleanName = cleanStationName(rawName);
      const net = closestFeature.properties?.network || '';
      setActiveStationPopup({
        name: cleanName,
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

        {/* Zoom listener for clustering */}
        <MapZoomListener onZoom={setCurrentZoom} />

        {/* Station Search Radius Circle on the Map */}
        {selectedStationCoords && (
          <Circle
            center={[selectedStationCoords.lat, selectedStationCoords.lng]}
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
          const isInterchange = lines.length >= 3 || ['Masjid Jamek', 'Pasar Seni', 'KL Sentral', 'Titiwangsa', 'Chan Sow Lin', 'Tun Razak Exchange', 'Maluri', 'Hang Tuah'].some((h) => cleanName.includes(h));

          const icon = createStationMarkerIcon({
            rawName,
            lines,
            isInterchange,
            isSelected,
            isSearchOrigin,
          });

          return (
            <Marker
              key={`station-${idx}`}
              position={[coords[1], coords[0]]}
              pane="stationPane"
              icon={icon}
              zIndexOffset={isSelected ? 1000 : isInterchange ? 600 : 400}
              eventHandlers={{
                click: (e) => handleStationMarkerClick(feature, e),
              }}
            />
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
                      1 of {spot.siblingCount} available bays at this property
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

      {/* Top Bar: Station Search, Radius, Lines & Legend */}
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

        {/* Rail Lines Toggle */}
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

        {/* Legend Button */}
        <button
          type="button"
          data-map-control
          onClick={() => setOpenPanel((panel) => panel === 'legend' ? null : 'legend')}
          aria-expanded={openPanel === 'legend'}
          aria-controls="map-legend-modal"
          className="workspace-map-control flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur hover:bg-slate-50"
        >
          <Info className="h-4 w-4 text-blue-600" />
          Legend
        </button>
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
