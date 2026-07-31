import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import stationData from '../data/mrt_lrt_stations.json';
import { ParkingSpot } from '../types';
import { 
  Search, Navigation, MapPin, Car, Train, X, 
  Clock, DollarSign, ChevronRight, Layers, Loader2
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
const stationIcon = L.divIcon({
  className: 'custom-station-icon',
  html: `<div style="
    background: #2563EB; 
    width: 16px; height: 16px; 
    border-radius: 50%; 
    border: 3px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
    font-size: 8px;
  ">🚇</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -14],
});

const parkingIcon = L.divIcon({
  className: 'custom-parking-icon',
  html: `<div style="
    background: #10B981;
    width: 28px; height: 28px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 900; color: white;
  ">P</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18],
});

const selectedStationIcon = L.divIcon({
  className: 'custom-selected-station-icon',
  html: `<div style="
    background: #EF4444;
    width: 20px; height: 20px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 0 0 4px rgba(239,68,68,0.3), 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
    font-size: 9px;
  ">🚇</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -18],
});

// ---- Props ----
interface CommuterMapProps {
  spots: ParkingSpot[];
  onStationSelect: (stationName: string, lat: number, lng: number) => void;
  selectedStation: string | null;
  onSpotClick: (spot: ParkingSpot) => void;
  distanceRadius: number;
  onDistanceRadiusChange: (radius: number) => void;
  isNearbyLoading: boolean;
  nearbyError: string | null;
}

// ---- FlyTo component — flies to station when clicked, no snap-back on scroll ----
function FlyToStation({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 15, { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

// ---- Creates a custom pane above markers so rail lines/stops render on top ----
function RailPane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('railPane')) {
      map.createPane('railPane');
      const pane = map.getPane('railPane');
      if (pane) pane.style.zIndex = '625'; // above markerPane (600), below popupPane (700)
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
      className={`${showHeader ? 'absolute top-[68px] left-4 z-[1000]' : ''} bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-lg p-3 text-xs min-w-[180px] w-auto`}
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
    <div className="absolute bottom-[100px] right-6 z-[1000] bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-lg p-3 text-[10px] space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-5 h-1 rounded-full bg-[#3388ff]" />
        <span className="text-slate-600 font-medium">Rail Line</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-white border border-slate-700" />
        <span className="text-slate-600 font-medium">Rail Stop</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-[#2563EB] border-2 border-white shadow flex items-center justify-center text-[7px]">🚇</div>
        <span className="text-slate-600 font-medium">LRT/MRT Station</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-[#EF4444] border-2 border-white shadow flex items-center justify-center text-[7px]">🚇</div>
        <span className="text-slate-600 font-medium">Selected Station</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-[#10B981] border-2 border-white shadow flex items-center justify-center text-[7px] text-white font-black">P</div>
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
  onSpotClick,
  distanceRadius,
  onDistanceRadiusChange,
  isNearbyLoading,
  nearbyError,
}: CommuterMapProps) {
  const klCenter: [number, number] = [3.1390, 101.6869];
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [showStationList, setShowStationList] = useState(false);
  const [stationFilter, setStationFilter] = useState('');

  // ---- Find parking flow state ----
  // Station coordinates clicked by user (for passing to detail page for walking distance calc)
  const [selectedStationCoords, setSelectedStationCoords] = useState<{ lat: number; lon: number } | null>(null);

  // react-router navigation
  const navigate = useNavigate();

  // ---- GTFS Rail Lines: full source data (read-only) ----
  const [allLines, setAllLines] = useState<GeoJsonCollection<RailLineFeature> | null>(null);

  // ---- Line visibility map: route_name → boolean, all visible by default ----
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({});

  const [railStops, setRailStops] = useState<GeoJsonCollection<RailStopFeature> | null>(null);
  const [gtfsLoading, setGtfsLoading] = useState(true);
  const [gtfsError, setGtfsError] = useState<string | null>(null);

  // ---- Load GTFS data, initialize allLines and visibleLines ----
  useEffect(() => {
    async function loadGtfsData() {
      try {
        const [linesRes, stopsRes] = await Promise.all([
          fetch('/data/kl_rail_lines.json'),
          fetch('/data/kl_rail_stops.json'),
        ]);
        if (!linesRes.ok || !stopsRes.ok) throw new Error('Failed to fetch GTFS data');
        const [linesData, stopsData] = await Promise.all([
          linesRes.json(),
          stopsRes.json(),
        ]);
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

        setRailStops(stopsData);
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

  // Filter stations: only LRT, MRT, Monorail (exclude KTM Komuter, ERL, etc.)
  const transitStations = (stationData as any).features.filter((f: any) => {
    const name = f.properties?.name || '';
    const network = f.properties?.network || '';
    const station = f.properties?.station || '';
    const railway = f.properties?.railway || '';

    // Keep only LRT, MRT, Monorail stations
    return (
      station === 'light_rail' ||
      station === 'monorail' ||
      network?.toLowerCase().includes('mrt') ||
      network?.toLowerCase().includes('lrt') ||
      name?.includes('MRT') ||
      name?.match(/^(AG|SP|KJ|KG|PY|MR)\d/) // LRT/MRT/Monorail station codes
    );
  });

  // Get unique station names for the list
  const allNames: string[] = transitStations
    .map((f: any) => String(f.properties?.name || ''))
    .filter((n: string) => n.length > 0);
  const stationNames: string[] = [...new Set<string>(allNames)].sort();

  const filteredList = stationNames.filter(n =>
    n.toLowerCase().includes(stationFilter.toLowerCase())
  );

  // Currently selected station name (to pass to detail page)
  const [clickedStationName, setClickedStationName] = useState<string>('');

  const handleStationClick = (feature: any) => {
    const coords = feature.geometry.coordinates;
    const name = feature.properties?.name || feature.properties?.['name:en'] || 'Unknown Station';
    if (!coords || coords.length < 2) {
      console.warn('Invalid station coordinates');
      return;
    }
    setFlyToCoords([coords[1], coords[0]]);
    onStationSelect(name, coords[1], coords[0]);

    const stationLat = coords[1];
    const stationLon = coords[0];
    setSelectedStationCoords({ lat: stationLat, lon: stationLon });
    setClickedStationName(name);
  };

  const handleListStationClick = (name: string) => {
    const feature = transitStations.find((f: any) =>
      f.properties?.name === name || f.properties?.['name:en'] === name
    );
    if (feature) {
      const coords = feature.geometry.coordinates;
      if (!coords || coords.length < 2) return;
      setFlyToCoords([coords[1], coords[0]]);
      onStationSelect(name, coords[1], coords[0]);

      // Also trigger Haversine filtering
      const stationLat = coords[1];
      const stationLon = coords[0];
      setSelectedStationCoords({ lat: stationLat, lon: stationLon });
      setClickedStationName(name);

      setShowStationList(false);
    }
  };

  const handleFindNearby = () => {
    if (!selectedStation) {
      alert('Please select an LRT/MRT station first (click on a station marker).');
      return;
    }
    if (!selectedStationCoords) {
      alert('Please click on a station marker on the map to set its coordinates.');
      return;
    }
    // Re-trigger parent station selection to ensure filtered spots render
    onStationSelect(selectedStation, selectedStationCoords.lat, selectedStationCoords.lon);
  };

  // ---- Toggle visibility of a line ----
  const handleLineToggle = (routeName: string) => {
    setVisibleLines((prev) => ({
      ...prev,
      [routeName]: !prev[routeName],
    }));
  };

  // ---- Mobile rail lines panel toggle ----
  const [showMobileLines, setShowMobileLines] = useState(false);

  // Don't show parking spots until a station is explicitly selected
  const shouldShowParking = !!selectedStation && selectedStation.length > 0 && spots.length > 0;

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
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

        {/* ---- GTFS Rail Stops (GeoJSON Points → CircleMarkers) ---- */}
        {railStops && (
          <GeoJSON
            data={railStops}
            pane="railPane"
            pointToLayer={(_feature, latlng) =>
              L.circleMarker(latlng, {
                radius: 4,
                fillColor: '#ffffff',
                fillOpacity: 1,
                color: '#1e293b',
                weight: 1.5,
              })
            }
            onEachFeature={(feature, layer) => {
              const name = feature.properties?.stop_name;
              if (name) layer.bindPopup(`<strong>${name}</strong>`);
            }}
          />
        )}

        {/* Zoom Control (positioned left) */}
        <div className="leaflet-top leaflet-left" style={{ top: '80px' }}>
          <div className="leaflet-control leaflet-bar">
            <a href="#" onClick={(e) => { e.preventDefault(); }} title="Zoom in">+</a>
            <a href="#" onClick={(e) => { e.preventDefault(); }} title="Zoom out">−</a>
          </div>
        </div>

        {/* Render Transit Station Markers */}
        {transitStations.map((feature: any, idx: number) => {
          const coords = feature.geometry.coordinates;
          const name = feature.properties?.name || feature.properties?.['name:en'] || '';
          const network = feature.properties?.network || '';
          const isSelected = selectedStation === name;

          if (!coords || coords.length < 2) return null;

          return (
            <Marker
              key={`station-${idx}`}
              position={[coords[1], coords[0]]}
              icon={isSelected ? selectedStationIcon : stationIcon}
              eventHandlers={{
                click: () => handleStationClick(feature),
              }}
            >
              <Popup>
                <div className="text-xs min-w-[140px]">
                  <strong className="text-slate-800">{name}</strong>
                  <p className="text-slate-500 mt-0.5">{network || 'Transit Station'}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStationClick(feature);
                    }}
                    className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg transition-colors"
                  >
                    Find Parking Nearby
                  </button>
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
          >
            <Popup>
              <div className="text-xs min-w-[180px]">
                <strong className="text-slate-800">{spot.name}</strong>
                <div className="flex items-center gap-1 text-slate-500 mt-1">
                  <Clock className="w-3 h-3" />
                  <span>RM {spot.pricePerHour.toFixed(2)}/hr</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500 mt-0.5">
                  <Navigation className="w-3 h-3" />
                  <span>{spot.distance}m from station</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500 mt-0.5">
                  <Car className="w-3 h-3" />
                  <span>{spot.type} &middot; {spot.owner}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSpotClick(spot);
                    navigate(`/commuter/parking/${spot.id}`, {
                      state: {
                        spot: { id: spot.id, lat: spot.lat, lon: spot.lng, address: spot.name, photoUrl: 'https://images.unsplash.com/photo-1590674899484-d5640d9da574?w=400&h=250&fit=crop', price: spot.pricePerHour },
                        stationCoords: selectedStationCoords,
                        stationName: spot.station,
                      },
                    });
                  }}
                  className="mt-2 w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[10px] font-bold py-1.5 px-3 rounded-lg transition-colors"
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

      {/* Line visibility control panel — desktop floats top-left, mobile bottom sheet */}
      {/* Desktop: always visible at top-left */}
      <div className="hidden md:block">
        <LineControlPanel
          visibleLines={visibleLines}
          onToggle={handleLineToggle}
        />
      </div>

      {/* Mobile: Rail lines toggle button & dropdown panel (inside the map container) */}
      <div className="md:hidden absolute top-[72px] right-4 z-[1000] flex flex-col items-end">
        <button
          onClick={() => setShowMobileLines(!showMobileLines)}
          className="bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-lg px-3 py-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
        >
          <Layers className="w-4 h-4 text-blue-600" />
          Lines
          <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showMobileLines ? 'rotate-90' : ''}`} />
        </button>

        {/* Dropdown expanded lines panel */}
        {showMobileLines && (
          <div className="mt-2 animate-slide-up origin-top-right">
            <LineControlPanel
              visibleLines={visibleLines}
              onToggle={handleLineToggle}
              showHeader={false}
            />
          </div>
        )}
      </div>

      {/* ---- No nearby parking message ---- (centered to avoid blocking top-right buttons) */}
      {clickedStationName && isNearbyLoading && (
        <div className="absolute top-[80px] left-1/2 -translate-x-1/2 z-[1001] animate-slide-up w-[90%] max-w-[320px]">
          <div className="bg-blue-50/95 backdrop-blur border border-blue-200 rounded-xl px-4 py-3 shadow-lg flex items-start gap-2.5">
            <Loader2 size={16} className="text-blue-600 shrink-0 mt-0.5 animate-spin" />
            <div className="text-[11px] text-blue-900 leading-relaxed">
              <strong className="block text-xs font-bold">Searching nearby parking</strong>
              <span>Looking for available spaces within <strong>{distanceRadius}m</strong> of this station.</span>
            </div>
          </div>
        </div>
      )}

      {clickedStationName && !isNearbyLoading && !nearbyError && spots.length === 0 && (
        <div className="absolute top-[80px] left-1/2 -translate-x-1/2 z-[1001] animate-slide-up w-[90%] max-w-[300px]">
          <div className="bg-amber-50/95 backdrop-blur border border-amber-200 rounded-xl px-4 py-3 shadow-lg flex items-start gap-2.5">
            <MapPin size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-800 leading-relaxed">
              <strong className="block text-xs font-bold">No parking spots nearby</strong>
              <span>No available spaces within <strong>{distanceRadius}m</strong> of this station. Try a larger radius or a different station.</span>
            </div>
          </div>
        </div>
      )}

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

      {nearbyError && (
        <div className="absolute top-16 left-4 right-4 z-[1001] bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2 rounded-lg shadow">
          ⚠️ Nearby parking search failed: {nearbyError}
        </div>
      )}

      {/* Top Bar: Station Search & Filter */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex gap-2">
        {/* Station Selector Button */}
        <button
          onClick={() => setShowStationList(!showStationList)}
          className="bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-lg px-4 py-2.5 flex items-center gap-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Train className="w-4 h-4 text-blue-600" />
          {selectedStation || 'Select Station'}
          <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showStationList ? 'rotate-90' : ''}`} />
        </button>

        {/* Radius Filter — auto-refilters nearby spots on change */}
        <select
          value={distanceRadius}
          onChange={(e) => {
            onDistanceRadiusChange(Number(e.target.value));
          }}
          className="bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-lg px-3 py-2.5 text-xs font-semibold text-slate-600 focus:outline-none"
        >
          <option value={300}>Within 300m</option>
          <option value={500}>Within 500m</option>
          <option value={1000}>Within 1km</option>
          <option value={2000}>Within 2km</option>
        </select>

        {/* Find Nearby Button */}
        {selectedStation && (
          <button
            onClick={handleFindNearby}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg px-4 py-2.5 flex items-center gap-1.5 text-xs font-bold transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            Find Parking
          </button>
        )}
      </div>

      {/* Station List Dropdown */}
      {showStationList && (
        <div className="absolute top-[60px] left-4 z-[1000] w-72 max-h-80 bg-white/98 backdrop-blur rounded-xl border border-slate-200 shadow-xl overflow-hidden">
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
          <div className="overflow-y-auto max-h-64">
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
