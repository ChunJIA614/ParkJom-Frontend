import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle, FileText, Landmark, ShieldCheck, HelpCircle, FileCheck, Map, Train, Loader2, Search, AlertCircle } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import OwnerRegistrationMap from './OwnerRegistrationMap';

// Backend API URL — matches the pattern used in GoogleLoginButton
const API_BASE = (window as any).VITE_API_BASE ||
  (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? 'https://parkjom-api-gbgcbycbcjghczgu.malaysiawest-01.azurewebsites.net/api'
    : '/api');

interface StationLookup {
  stationId: number;
  stationName: string;
  latitude: number;
  longitude: number;
}

interface PropertyOnboardingProps {
  onOnboardProperty: (property: {
    propertyName: string;
    stationName: string;
    bayNumber: string;
    level: string;
    docName: string;
    lat?: number;
    lon?: number;
  }) => void;
}

export default function PropertyOnboarding({ onOnboardProperty }: PropertyOnboardingProps) {
  const { user } = useAuth();
  // Form states
  const [propName, setPropName] = useState('');
  const [propertyType, setPropertyType] = useState<number>(1); // 1=Condominium, 2=Apartment
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [stationName, setStationName] = useState('');
  const [nearestStationId, setNearestStationId] = useState<number | null>(null);
  const [distanceToStation, setDistanceToStation] = useState<number>(0);
  const [bayNumber, setBayNumber] = useState('');
  const [level, setLevel] = useState('');

  // Auto-detect station state
  const [allStops, setAllStops] = useState<{ name: string; lat: number; lon: number }[]>([]);
  const [stations, setStations] = useState<StationLookup[]>([]);
  const [isSearchingStation, setIsSearchingStation] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Map-detected data (from OwnerRegistrationMap callback)
  const [mapLat, setMapLat] = useState<number | undefined>();
  const [mapLon, setMapLon] = useState<number | undefined>();
  const [showMap, setShowMap] = useState(false);

  // API submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Upload States
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string } | null>(null);
  const [uploadedFileObject, setUploadedFileObject] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Fetch rail stop data + backend stations on mount ----
  useEffect(() => {
    async function loadStops() {
      try {
        const res = await fetch('/data/kl_rail_stops.json');
        const data = await res.json();
        const stops: { name: string; lat: number; lon: number }[] = data.features.map((f: any) => ({
          name: f.properties.stop_name,
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
        }));
        setAllStops(stops);
      } catch (err) {
        console.error('Failed to load rail stops:', err);
      }
    }
    async function loadStations() {
      try {
        const res = await fetch(`${API_BASE}/property/stations`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setStations(
            data.map((s: any) => ({
              stationId: s.stationId,
              stationName: s.stationName,
              latitude: s.latitude,
              longitude: s.longitude,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load stations from API:', err);
      }
    }
    loadStops();
    loadStations();
  }, []);

  // ---- Haversine (straight-line meters) ----
  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // ---- Search property name → Nominatim geocode → find nearest station ----
  const handlePropertySearch = async () => {
    const q = propName.trim();
    if (!q) {
      setSearchError('Please enter a property/condo name first.');
      return;
    }
    setIsSearchingStation(true);
    setSearchError(null);
    setStationName('');

    try {
      // 1. Geocode the property address via Nominatim
      const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=my&limit=3`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();

      if (!geoData || geoData.length === 0) {
        setSearchError('Address not found in Malaysia. Try a more specific name (e.g. "PV9 Condominium, Setapak").');
        setIsSearchingStation(false);
        return;
      }

      const loc = geoData[0];
      const lat = parseFloat(loc.lat);
      const lon = parseFloat(loc.lon);
      setMapLat(lat);
      setMapLon(lon);

      // 2. Find the nearest LRT/MRT station
      if (allStops.length === 0) {
        setSearchError('Station data not loaded yet. Please wait or try again.');
        setIsSearchingStation(false);
        return;
      }

      let closest = allStops[0];
      let minDist = haversine(lat, lon, closest.lat, closest.lon);

      for (let i = 1; i < allStops.length; i++) {
        const d = haversine(lat, lon, allStops[i].lat, allStops[i].lon);
        if (d < minDist) {
          minDist = d;
          closest = allStops[i];
        }
      }

      setStationName(closest.name);
      setDistanceToStation(Math.round(minDist));

      // Look up station ID from the backend stations list
      const matched = stations.find(
        (s) => s.stationName.toLowerCase() === closest.name.toLowerCase()
      );
      if (matched) {
        setNearestStationId(matched.stationId);
      } else {
        // Fallback: try a fuzzy match
        const fuzzyMatch = stations.find(
          (s) =>
            closest.name.toLowerCase().includes(s.stationName.toLowerCase()) ||
            s.stationName.toLowerCase().includes(closest.name.toLowerCase())
        );
        if (fuzzyMatch) {
          setNearestStationId(fuzzyMatch.stationId);
        } else {
          console.warn('No matching station ID found for:', closest.name);
        }
      }
    } catch (err) {
      setSearchError('Network error. Please check your connection and try again.');
    } finally {
      setIsSearchingStation(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const simulateUpload = (name: string, sizeBytes: number, file?: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadedFile(null);
    setUploadedFileObject(file ?? null);

    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2) + ' MB';

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setUploadedFile({ name, size: sizeMB });
          return 100;
        }
        return prev + 15;
      });
    }, 100);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      simulateUpload(file.name, file.size, file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      simulateUpload(file.name, file.size, file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile || !uploadedFileObject) {
      alert('Please upload your Strata Title or Identification document for verification.');
      return;
    }
    if (!nearestStationId) {
      alert('Could not determine nearest station. Please ensure the property name is correct and try again.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Step 1: Create Property
      const propRes = await fetch(`${API_BASE}/property/create-property`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyName: propName,
          propertyType,
          address: address || propName,
          latitude: mapLat ?? 0,
          longitude: mapLon ?? 0,
          nearestStationId,
          distanceToStation: parseFloat((distanceToStation / 1000).toFixed(2)),
          description: description || null,
        }),
      });

      if (!propRes.ok) {
        const errData = await propRes.json().catch(() => null);
        throw new Error(errData?.message || `Property creation failed (${propRes.status})`);
      }

      const createdProperty = await propRes.json();
      const propertyId = createdProperty.propertyId;

      // Step 2: Register Parking Spot with document
      const formData = new FormData();
      formData.append('propertyId', propertyId.toString());
      formData.append('bayNumber', bayNumber);
      formData.append('Level', level);
      formData.append('DocumentType', '1'); // 1 = Strata Title / Ownership document
      formData.append('Document', uploadedFileObject);

      const token = user?.token ?? '';
      const parkRes = await fetch(`${API_BASE}/parking/register-parking`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // ⚠️ Don't set Content-Type — browser sets it with boundary for FormData
        },
        body: formData,
      });

      if (!parkRes.ok) {
        const errData = await parkRes.json().catch(() => null);
        throw new Error(errData?.message || `Parking registration failed (${parkRes.status})`);
      }

      const parkResult = await parkRes.json();

      // Notify parent
      onOnboardProperty({
        propertyName: propName,
        stationName,
        bayNumber,
        level,
        docName: uploadedFile.name,
        lat: mapLat,
        lon: mapLon,
      });

      // Success feedback
      alert(
        `✅ Property & Parking Registered!\n\n` +
        `Property: ${propName} (ID: ${propertyId})\n` +
        `Parking Spot ID: ${parkResult.parkingSpotId}\n` +
        `Bay: ${bayNumber} (Level ${level})\n` +
        `Station: ${stationName}\n\n` +
        `Admin will review your documents.`
      );

      // Reset Form
      setPropName('');
      setPropertyType(1);
      setAddress('');
      setDescription('');
      setStationName('');
      setNearestStationId(null);
      setDistanceToStation(0);
      setBayNumber('');
      setLevel('');
      setMapLat(undefined);
      setMapLon(undefined);
      setUploadedFile(null);
      setUploadedFileObject(null);
    } catch (err: any) {
      console.error('❌ Registration failed:', err.message);
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Onboard Parking Supply</h1>
        <p className="text-slate-500 text-xs mt-1 leading-normal">
          Register new private parking spaces near LRT/MRT stations. Verification of Strata Titles guarantees platform safety and legal compliance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Registration Form Card */}
        <div className="lg:col-span-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                <Landmark className="w-5 h-5 text-slate-800" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm">Regulatory Compliance & Registry Form</h2>
                <span className="text-[10px] text-slate-400 font-medium">Malaysia Strata Management Act 2013 (SMA 2013) Form</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Property Name + Type row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Condominium / Property Name *</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder='e.g. "PV9 Condominium, Setapak"'
                      value={propName}
                      onChange={(e) => { setPropName(e.target.value); setSearchError(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePropertySearch(); } }}
                      className="w-full text-xs border border-slate-200 rounded-lg pl-3 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                      required
                    />
                    <button
                      type="button"
                      onClick={handlePropertySearch}
                      disabled={isSearchingStation}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
                    >
                      {isSearchingStation ? (
                        <Loader2 size={15} className="animate-spin text-blue-600" />
                      ) : (
                        <Search size={15} className="text-slate-400" />
                      )}
                    </button>
                  </div>
                  {searchError && (
                    <p className="text-[10px] text-rose-600 mt-1 flex items-center gap-1">
                      <span>⚠️</span> {searchError}
                    </p>
                  )}
                </div>

                {/* Property Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Property Type *</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(Number(e.target.value))}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 bg-white"
                    required
                  >
                    <option value={1}>Condominium</option>
                    <option value={2}>Apartment</option>
                  </select>
                </div>
              </div>

              {/* Transit station + Distance row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Closest RapidKL Transit Station *
                  </label>
                  <div className="relative">
                    {isSearchingStation ? (
                      <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50">
                        <Loader2 size={14} className="animate-spin text-blue-600" />
                        <span className="text-xs text-slate-500">Detecting nearest station...</span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={stationName}
                        readOnly
                        disabled
                        placeholder={propName ? 'Press Enter on Property Name to auto-detect' : 'Enter property name above first'}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 text-slate-700 cursor-not-allowed disabled:opacity-70"
                      />
                    )}
                  </div>
                  {stationName && (
                    <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                      <CheckCircle size={11} /> {distanceToStation > 1000
                        ? `${(distanceToStation / 1000).toFixed(2)} km`
                        : `${Math.round(distanceToStation)} m`}{' '}
                      from station{nearestStationId ? ` (ID: ${nearestStationId})` : ''}
                    </p>
                  )}
                </div>

                {/* Distance to station (read-only, auto-calculated) */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Distance to Station (km)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={distanceToStation > 0 ? parseFloat((distanceToStation / 1000).toFixed(2)) : ''}
                    readOnly
                    disabled
                    placeholder="Auto-calculated from coordinates"
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 text-slate-700 cursor-not-allowed disabled:opacity-70"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Full Address *</label>
                <input
                  type="text"
                  placeholder="e.g. Jln Langkawi, Taman Setapak, 53000 Kuala Lumpur"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Description (optional)</label>
                <textarea
                  placeholder="e.g. Covered walkway, 24-hour security, CCTV monitored"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 resize-none"
                />
              </div>

              {/* Bay Number + Level row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Exact Bay Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. Bay 104"
                    value={bayNumber}
                    onChange={(e) => setBayNumber(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Level / Floor *</label>
                  <input
                    type="text"
                    placeholder="e.g. Level 3 (Basement, Block A)"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                    required
                  />
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Proof of Accessory Parcel Ownership * (Strata Title, IC, or SPA)
                </label>
                
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center
                    ${isDragOver 
                      ? 'border-blue-600 bg-blue-50/15' 
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/40 hover:bg-slate-50/70'
                    }
                  `}
                >
                  <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
                  <h3 className="font-bold text-xs text-slate-700 mb-1">Drag & drop strata PDF document here</h3>
                  <p className="text-[10px] text-slate-400 mb-3">PDF, JPEG, or PNG files up to 10MB</p>
                  <span className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm">
                    Browse Files
                  </span>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.png,.jpg,.jpeg"
                  />
                </div>

                {/* Upload Loading Simulator */}
                {isUploading && (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-slate-600 flex items-center gap-1.5 animate-pulse">
                        <FileText className="w-3.5 h-3.5 text-slate-400" /> Uploading Strata File...
                      </span>
                      <span className="font-mono font-bold text-slate-700">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-100" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                )}

                {/* Upload Status Card */}
                {uploadedFile && (
                  <div className="mt-3 p-3 bg-blue-50/40 border border-blue-100 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="block font-bold text-xs text-slate-800">{uploadedFile.name}</span>
                        <span className="block text-[10px] text-slate-400 font-mono">{uploadedFile.size}</span>
                      </div>
                    </div>
                    <span className="bg-blue-600 text-white font-mono text-[9px] font-extrabold px-2 py-0.5 rounded flex items-center gap-0.5 uppercase tracking-wider">
                      <CheckCircle className="w-3 h-3" /> LOADED
                    </span>
                  </div>
                )}
              </div>

              {/* Legal Declaration */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex gap-3 text-[10px] leading-relaxed text-slate-500">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 font-bold">Onboarding Legal Affirmation</strong>
                  <p className="mt-0.5">
                    By submitting this registration, I declare that I am the legitimate holder/accessory parcel deed owner of the specified bay. I authorize the ParkJom compliance committee to process this whitelisting profile for RapidKL transit micro-leasing under Joint Management Body (JMB) bylaws.
                  </p>
                </div>
              </div>

              {/* Submit error */}
              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-[11px] text-rose-700">
                  <AlertCircle size={14} className="shrink-0" />
                  {submitError}
                </div>
              )}

              {/* Submit Action */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#0f172a] hover:bg-[#1e293b] disabled:bg-slate-400 text-white font-bold text-xs py-3 px-6 rounded-xl transition-colors shadow flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Landmark className="w-4 h-4 text-blue-400" />
                  )}
                  {isSubmitting ? 'Submitting...' : 'Submit Onboarding Request'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Regulatory Guidelines sidebar card */}
        <div className="lg:col-span-4 space-y-6">
          {/* FAQ panel */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <HelpCircle className="w-4 h-4 text-slate-500" />
              Onboarding Checklist
            </h3>

            <div className="space-y-3.5 text-xs text-slate-600">
              <div className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold font-mono text-[10px] flex items-center justify-center shrink-0">1</span>
                <div>
                  <strong className="text-slate-800">Submit Strata Verification</strong>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">Strata documents are reviewed within 24 hours to whitelisting accessory parcels.</p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold font-mono text-[10px] flex items-center justify-center shrink-0">2</span>
                <div>
                  <strong className="text-slate-800">Receive ESP32 Bollard</strong>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">We dispatch a plug-and-play battery-powered smart parking bollard directly to your guardhouse.</p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold font-mono text-[10px] flex items-center justify-center shrink-0">3</span>
                <div>
                  <strong className="text-slate-800">Activate IoT Link</strong>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">Simply stick the device to your bay, scan the pairing QR code, and open schedule leasing!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
