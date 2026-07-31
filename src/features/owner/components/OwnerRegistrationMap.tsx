import { useState, useEffect } from 'react';
import {
  MapContainer, TileLayer, Marker, useMap, Popup,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Navigation, Train, Loader2, CheckCircle2, ChevronRight } from 'lucide-react';

// ---- Types ----
interface RailStopFeature {
  type: 'Feature';
  properties: { stop_id: string; stop_name: string };
  geometry: { type: 'Point'; coordinates: [number, number] };
}
interface GeoJsonCollection {
  type: 'FeatureCollection';
  features: RailStopFeature[];
}

interface OwnerLocation {
  lat: number;
  lon: number;
  address: string;
}

interface StationInfo {
  name: string;
  lat: number;
  lon: number;
}

interface WalkingInfo {
  distanceText: string;
  durationText: string;
  rawDistance: number;
}

// ---- OSRM Walking Distance ----
async function getWalkingDistance(
  startLat: number, startLon: number,
  endLat: number, endLon: number,
): Promise<WalkingInfo | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${startLon},${startLat};${endLon},${endLat}?overview=false`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.code === 'Ok' && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceMeters: number = route.distance;
      const durationSeconds: number = route.duration;

      const distanceText =
        distanceMeters > 1000
          ? `${(distanceMeters / 1000).toFixed(2)} km`
          : `${Math.round(distanceMeters)} m`;
      const durationText = `${Math.round(durationSeconds / 60)} mins walk`;

      return { distanceText, durationText, rawDistance: distanceMeters };
    }
    throw new Error('No route found');
  } catch (error) {
    console.error('OSRM routing error:', error);
    return null;
  }
}

// ---- Haversine Distance (meters) ----
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---- Custom Icons ----
const ownerMarkerIcon = L.divIcon({
  className: 'custom-owner-icon',
  html: `<div style="
    background: #7C3AED; width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid white; box-shadow: 0 2px 10px rgba(124,58,237,0.4);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 900; color: white;
  ">🏠</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18],
});

const stationMarkerIcon = L.divIcon({
  className: 'custom-station-owner-icon',
  html: `<div style="
    background: #F59E0B; width: 22px; height: 22px; border-radius: 50%;
    border: 3px solid white; box-shadow: 0 2px 6px rgba(245,158,11,0.4);
    display: flex; align-items: center; justify-content: center;
    font-size: 8px;
  ">🚇</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

// ---- FlyTo sub-component (uses useMap hook) ----
function FlyToLocation({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 16, { duration: 1.0 });
    }
  }, [lat, lng, map]);
  return null;
}

// ---- Main Component ----
interface OwnerRegistrationMapProps {
  onStationFound?: (stationName: string, lat: number, lon: number) => void;
}

export default function OwnerRegistrationMap({ onStationFound }: OwnerRegistrationMapProps) {
  const klCenter: [number, number] = [3.1390, 101.6869];

  // ---- State ----
  const [searchQuery, setSearchQuery] = useState('');
  const [ownerLocation, setOwnerLocation] = useState<OwnerLocation | null>(null);
  const [nearestStation, setNearestStation] = useState<StationInfo | null>(null);
  const [walkingInfo, setWalkingInfo] = useState<WalkingInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Store all rail stops after fetch
  const [allStops, setAllStops] = useState<RailStopFeature[]>([]);

  // ---- Fetch Rail Stops on Mount ----
  useEffect(() => {
    async function loadStops() {
      try {
        const res = await fetch('/data/kl_rail_stops.json');
        const data: GeoJsonCollection = await res.json();
        setAllStops(data.features);
      } catch (err) {
        console.error('Failed to load rail stops:', err);
      }
    }
    loadStops();
  }, []);

  // ---- Handle Address Search (Nominatim Geocoding) ----
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setErrorMsg('Please enter an address or condo name first.');
      return;
    }
    setIsSearching(true);
    setErrorMsg(null);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=my&limit=5`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data || data.length === 0) {
        setErrorMsg('No matching location found in Malaysia. Try a more specific address.');
        setIsSearching(false);
        return;
      }

      const first = data[0];
      const lat = parseFloat(first.lat);
      const lon = parseFloat(first.lon);
      const address = first.display_name;

      setOwnerLocation({ lat, lon, address });
    } catch (err) {
      setErrorMsg('Network error. Please check your connection and try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // ---- When ownerLocation changes: find nearest station + OSRM ----
  useEffect(() => {
    if (!ownerLocation || allStops.length === 0) return;

    // Find the nearest station using Haversine
    let closest: StationInfo | null = null;
    let minDist = Infinity;

    for (const stop of allStops) {
      const [lon, lat] = stop.geometry.coordinates; // GeoJSON: [lon, lat]
      const dist = haversineDistance(ownerLocation.lat, ownerLocation.lon, lat, lon);
      if (dist < minDist) {
        minDist = dist;
        closest = {
          name: stop.properties.stop_name,
          lat,
          lon,
        };
      }
    }

    if (closest) {
      setNearestStation(closest);

      // Notify parent form
      onStationFound?.(closest.name, closest.lat, closest.lon);

      // Fetch OSRM walking distance
      getWalkingDistance(
        ownerLocation.lat, ownerLocation.lon,
        closest.lat, closest.lon,
      ).then(setWalkingInfo);
    }
  }, [ownerLocation, allStops]);

  // ---- Handle Marker Drag: update coords, re-trigger nearest-station logic ----
  const handleMarkerDragEnd = (e: L.LeafletEvent) => {
    const marker = e.target;
    const pos = marker.getLatLng();
    setOwnerLocation((prev) =>
      prev
        ? { ...prev, lat: pos.lat, lon: pos.lng }
        : { lat: pos.lat, lon: pos.lng, address: 'Manually placed marker' },
    );
  };

  // ---- Confirm & Save ----
  const handleConfirm = () => {
    const payload = {
      parking_spot: {
        lat: ownerLocation?.lat,
        lon: ownerLocation?.lon,
        address: ownerLocation?.address,
      },
      nearest_station: {
        name: nearestStation?.name,
        lat: nearestStation?.lat,
        lon: nearestStation?.lon,
      },
      walking: walkingInfo
        ? {
            distance_meters: walkingInfo.rawDistance,
            distance_text: walkingInfo.distanceText,
            duration_text: walkingInfo.durationText,
          }
        : null,
      registered_at: new Date().toISOString(),
    };

    console.log('📤 Ready to POST to backend:', JSON.stringify(payload, null, 2));
    alert('✅ Location confirmed! Check the browser console (F12) for the payload JSON.');
  };

  return (
    <div className="flex flex-col h-full min-h-0" id="owner-registration-container">
      {/* ---- Top Search Bar ---- */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex gap-2" id="owner-search-bar">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder='e.g. "PV9 Condominium, Setapak" or "Casa Subang, Subang Jaya"'
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setErrorMsg(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center gap-1.5 disabled:opacity-60"
        >
          {isSearching ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Search size={14} />
          )}
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* ---- Error Banner ---- */}
      {errorMsg && (
        <div className="shrink-0 bg-rose-50 border-b border-rose-100 text-rose-700 text-xs px-4 py-2 flex items-center gap-2">
          <MapPin size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ---- Map ---- */}
      <div className="flex-1 min-h-0" id="owner-registration-map">
        <MapContainer
          center={klCenter}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          {/* CartoDB Light basemap */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          />

          {/* Draggable Owner Marker */}
          {ownerLocation && (
            <Marker
              position={[ownerLocation.lat, ownerLocation.lon]}
              icon={ownerMarkerIcon}
              draggable={true}
              eventHandlers={{ dragend: handleMarkerDragEnd }}
            >
              <Popup>
                <div className="text-xs min-w-[160px]">
                  <strong className="text-slate-800">Your Parking Spot</strong>
                  <p className="text-slate-500 mt-0.5">
                    Drag the marker to fine-tune the exact position.
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Nearest Station Marker */}
          {nearestStation && (
            <Marker
              position={[nearestStation.lat, nearestStation.lon]}
              icon={stationMarkerIcon}
            >
              <Popup>
                <div className="text-xs">
                  <strong className="text-slate-800">{nearestStation.name}</strong>
                  <p className="text-slate-500 mt-0.5">Nearest transit station</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Fly to owner location */}
          {ownerLocation && (
            <FlyToLocation lat={ownerLocation.lat} lng={ownerLocation.lon} />
          )}
        </MapContainer>
      </div>

      {/* ---- Bottom Floating Info Card ---- */}
      {ownerLocation && (
        <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-4 space-y-3 animate-slide-up max-h-[40vh] overflow-y-auto" id="owner-info-card">
          {/* Pin Location */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <MapPin size={16} className="text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">
                Spot Location
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                [{ownerLocation.lat.toFixed(6)}, {ownerLocation.lon.toFixed(6)}]
              </p>
            </div>
          </div>

          {/* Nearest Station */}
          {nearestStation && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Train size={16} className="text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">
                  Nearest Station
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {nearestStation.name}
                </p>
              </div>
            </div>
          )}

          {/* Walking Info */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              {walkingInfo ? (
                <CheckCircle2 size={16} className="text-emerald-600" />
              ) : (
                <Loader2 size={16} className="animate-spin text-emerald-600" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800">
                Walking to Station
              </p>
              {walkingInfo ? (
                <p className="text-[11px] text-slate-500">
                  {walkingInfo.distanceText} &bull; {walkingInfo.durationText}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">Calculating...</p>
              )}
            </div>
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            disabled={!walkingInfo}
            className={`w-full py-3 rounded-xl font-bold text-sm shadow transition flex items-center justify-center gap-2 ${
              walkingInfo
                ? 'bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white shadow-purple-100'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {walkingInfo ? (
              <>
                <CheckCircle2 size={16} />
                Confirm & Save Location
              </>
            ) : (
              <>
                <Loader2 size={16} className="animate-spin" />
                Computing walking distance...
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
