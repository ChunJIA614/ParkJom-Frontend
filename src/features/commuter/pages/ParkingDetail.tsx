import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Clock, Navigation, ShieldCheck,
  Car, Home, Wifi, Video, Zap, CreditCard, User,
  Loader2, Calendar, AlertTriangle, Star,
} from 'lucide-react';
import DashboardHeader from '@/shared/components/DashboardHeader';

/* ================================================================
   ParkingDetail — Parking spot detail page
   Design: Apple/Google style — clean whitespace, single blue accent, no gradients
   ================================================================ */

// ── Types ──
interface MockParkingSpot {
  id: string;
  lat: number;
  lon: number;
  address: string;
  photoUrl: string;
  price: number;
}
interface WalkingInfo {
  distanceText: string;
  durationText: string;
  rawDistance: number;
}

// ── OSRM Walking Distance Query ──
async function getWalkingDistance(
  startLat: number, startLon: number,
  endLat: number, endLon: number,
): Promise<WalkingInfo | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${startLon},${startLat};${endLon},${endLat}?overview=false`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes.length > 0) {
      const route = data.routes[0];
      const d = route.distance;
      return {
        distanceText: d > 1000 ? `${(d / 1000).toFixed(2)} km` : `${Math.round(d)} m`,
        durationText: `${Math.round(route.duration / 60)} mins walk`,
        rawDistance: d,
      };
    }
    throw new Error('No route');
  } catch (e) {
    console.error('OSRM error:', e);
    return null;
  }
}

export default function ParkingDetail() {
  const navigate = useNavigate();
  const { state } = useLocation() as {
    state?: { spot: MockParkingSpot; stationCoords: { lat: number; lon: number } | null; stationName: string };
  };

  const spot = state?.spot;
  const stationCoords = state?.stationCoords;
  const stationName = state?.stationName;

  const [walkingInfo, setWalkingInfo] = useState<WalkingInfo | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // ── Date / Time ──
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const dateOptions = [
    { label: 'Today', value: today.toISOString().slice(0, 10) },
    { label: 'Tomorrow', value: tomorrow.toISOString().slice(0, 10) },
  ];
  for (let i = 2; i <= 6; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    dateOptions.push({
      label: d.toLocaleDateString('en-MY', { weekday: 'short', month: 'short', day: 'numeric' }),
      value: d.toISOString().slice(0, 10),
    });
  }

  const startTimeOptions: string[] = [];
  for (let h = 6; h <= 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      startTimeOptions.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  const [selectedDate, setSelectedDate] = useState(dateOptions[0].value);
  const [startTime, setStartTime] = useState('09:00');
  const [durationHours, setDurationHours] = useState(2);

  useEffect(() => {
    if (!spot || !stationCoords) return;
    setIsLoadingRoute(true);
    getWalkingDistance(spot.lat, spot.lon, stationCoords.lat, stationCoords.lon)
      .then(setWalkingInfo).finally(() => setIsLoadingRoute(false));
  }, [spot, stationCoords]);

  if (!spot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="text-center space-y-4">
          <MapPin size={40} className="mx-auto text-[#dadce0]" />
          <p className="text-[#5f6368] font-medium text-[15px]">No parking spot selected.</p>
          <button onClick={() => navigate('/commuter')} className="text-[13px] text-[#007AFF] font-semibold hover:underline">
            &larr; Back to Transit Map
          </button>
        </div>
      </div>
    );
  }

  // ── Calculate pricing ──
  const [h, m] = startTime.split(':').map(Number);
  const selectedStart = new Date(`${selectedDate}T${startTime}:00`);
  const isPastTime = selectedStart <= new Date();
  const endH = Math.floor((h * 60 + m + durationHours * 60) / 60) % 24;
  const endM = (h * 60 + m + durationHours * 60) % 60;
  const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  const isDateToday = selectedDate === new Date().toISOString().slice(0, 10);
  const conflict = isDateToday && isPastTime;
  const subtotal = spot.price * durationHours;
  const serviceFee = 1.0;
  const total = subtotal + serviceFee;

  // ── Confirm booking ──
  const handleBook = () => {
    if (conflict) { alert('Please select a future time slot before booking.'); return; }
    alert(
      `Redirecting to Payment Gateway\n\n` +
      `Spot: ${spot.address}\nDate: ${selectedDate}\n` +
      `Time: ${startTime} - ${endTimeStr}\nDuration: ${durationHours}h\n` +
      `Total: RM ${total.toFixed(2)}\n` +
      (walkingInfo ? `Walk: ${walkingInfo.distanceText} · ${walkingInfo.durationText}` : '')
    );
  };

  return (
    <div className="page-shell text-[#1d1d1f] pb-24">
      <DashboardHeader role="commuter" />

      {/* ── Top image ── */}
      <div className="relative w-full h-64 md:h-80 bg-[#e8eaed]">
        <img src={spot.photoUrl} alt={spot.address} className="w-full h-full object-cover" />
        <button onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-white/90 hover:bg-white border border-[#e8eaed] rounded-full p-2.5 text-[#5f6368] transition-colors shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <span className="absolute top-4 right-4 bg-[#007AFF] text-white text-[13px] font-semibold px-4 py-2 rounded-xl shadow-sm">
          RM {spot.price.toFixed(2)} <span className="text-[10px] opacity-70 font-normal">/hr</span>
        </span>
      </div>

      {/* ── Content card ── */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 md:p-8 space-y-6">

          {/* Title */}
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#111] tracking-[-0.01em] leading-tight">{spot.address}</h1>
            <div className="flex items-center gap-1.5 mt-2 text-[13px] text-[#5f6368]">
              <MapPin size={14} className="text-[#007AFF] shrink-0" />
              <span>{stationName ? `${stationName} area` : 'Klang Valley'}</span>
            </div>
          </div>

          {/* Walking distance */}
          {isLoadingRoute ? (
            <div className="bg-[#f8f9fa] border border-[#e8eaed] rounded-xl p-4 flex items-center gap-3 text-[13px] text-[#5f6368]">
              <Loader2 size={16} className="animate-spin text-[#007AFF] shrink-0" />
              Calculating walking distance via OSRM...
            </div>
          ) : walkingInfo ? (
            <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#dcfce7] flex items-center justify-center shrink-0">
                <Navigation size={20} className="text-[#16a34a]" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-[#15803d]">{walkingInfo.distanceText} &middot; {walkingInfo.durationText}</p>
                <p className="text-[12px] text-[#16a34a]">Walking distance to {stationName || 'station'}</p>
              </div>
              <span className="text-[10px] font-semibold bg-[#bbf7d0] text-[#15803d] px-2 py-0.5 rounded-full">OSRM Verified</span>
            </div>
          ) : (
            <div className="bg-[#fefce8] border border-[#fde68a] rounded-xl p-4 flex items-center gap-3 text-[13px] text-[#a16207]">
              <MapPin size={16} className="shrink-0" />
              Select a station on the map to calculate walking distance.
            </div>
          )}

          <div className="h-px bg-[#e8eaed]" />

          {/* Amenities */}
          <div>
            <h3 className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">Parking Space Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { icon: Car, label: 'Covered Bay' },
                { icon: Home, label: 'Residential' },
                { icon: ShieldCheck, label: '24/7 Security' },
                { icon: Wifi, label: 'IoT Actuator' },
                { icon: Video, label: 'CCTV Monitored' },
                { icon: Zap, label: 'EV Charger Nearby' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-[13px] text-[#5f6368] bg-[#f8f9fa] rounded-xl p-3">
                  <Icon size={15} className="text-[#007AFF] shrink-0" /> {label}
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-[#e8eaed]" />

          {/* Booking time */}
          <div>
            <h3 className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Calendar size={14} className="text-[#007AFF]" /> Select Booking Time
            </h3>

            <div className="space-y-1 mb-3">
              <label className="text-[11px] font-medium text-[#5f6368]">Date</label>
              <div className="flex gap-2 flex-wrap">
                {dateOptions.slice(0, 3).map((opt) => (
                  <button key={opt.value} onClick={() => setSelectedDate(opt.value)}
                    className={`px-4 py-2 rounded-xl text-[12px] font-semibold border transition ${
                      selectedDate === opt.value ? 'bg-[#007AFF] text-white border-[#007AFF]' : 'bg-white text-[#5f6368] border-[#dadce0] hover:border-[#007AFF]'
                    }`}>{opt.label}</button>
                ))}
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                  min={today.toISOString().slice(0, 10)}
                  max={(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })()}
                  className="px-3 py-2 rounded-xl text-[12px] border border-[#dadce0] bg-white focus:outline-none focus:border-[#007AFF]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#5f6368]">Start Time</label>
                <select value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-[12px] border border-[#dadce0] bg-white focus:outline-none focus:border-[#007AFF] appearance-none">
                  {startTimeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#5f6368]">Duration</label>
                <select value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl text-[12px] border border-[#dadce0] bg-white focus:outline-none focus:border-[#007AFF] appearance-none">
                  {[1, 2, 3, 4].map((h) => <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>)}
                </select>
              </div>
            </div>

            {conflict && (
              <div className="mt-3 flex items-start gap-2 text-[12px] text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded-xl p-3">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>Selected time has already passed. Please choose a future time slot.</span>
              </div>
            )}
          </div>

          <div className="h-px bg-[#e8eaed]" />

          {/* About */}
          <div>
            <h3 className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">About This Space</h3>
            <p className="text-[13px] text-[#5f6368] leading-relaxed">
              A private parking bay in a secured residential compound, just a short walk from {stationName || 'the nearby LRT/MRT station'}.
              Perfect for daily commuters seeking a safe, affordable, and convenient parking solution.
              The space is well-lit, covered, and monitored 24/7 by CCTV and IoT smart bollard actuation.
            </p>
          </div>

          <div className="h-px bg-[#e8eaed]" />

          {/* Host */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#eff6ff] flex items-center justify-center shrink-0">
              <User size={18} className="text-[#007AFF]" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-[#111]">Verified Host</p>
              <p className="text-[12px] text-[#5f6368]">ParkJom Verified &middot; 4.8 &starf; &middot; 12 bookings</p>
            </div>
            <div className="flex items-center gap-1 text-[#f59e0b] text-[13px] font-bold">
              <Star size={14} className="fill-current" /> 4.8
            </div>
          </div>

          <div className="h-px bg-[#e8eaed]" />

          {/* Price breakdown */}
          {!conflict && (
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#5f6368]">RM {spot.price.toFixed(2)} x {durationHours}h <span className="text-[#9ca3af] ml-1">({startTime} &ndash; {endTimeStr})</span></span>
                <span className="font-semibold text-[#111]">RM {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5f6368]">Service fee</span>
                <span className="font-semibold text-[#111]">RM {serviceFee.toFixed(2)}</span>
              </div>
              <div className="h-px bg-[#e8eaed]" />
              <div className="flex justify-between font-bold text-[15px]">
                <span>Total</span>
                <span>RM {total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom fixed booking bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e8eaed] px-4 md:px-6 py-4 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-[#111] text-[15px]">RM {spot.price.toFixed(2)} <span className="text-[13px] font-normal text-[#5f6368]">/ hour</span></p>
            <p className="text-[11px] text-[#9ca3af]">{durationHours}h &middot; RM {total.toFixed(2)} total</p>
          </div>
          <button onClick={handleBook} disabled={conflict}
            className={`font-semibold text-[13px] px-8 py-3 rounded-xl transition flex items-center gap-2 ${
              conflict ? 'bg-[#e8eaed] text-[#9ca3af] cursor-not-allowed' : 'bg-[#007AFF] text-white hover:bg-[#1d4ed8] active:scale-[0.98]'
            }`}>
            <CreditCard size={16} />
            {conflict ? 'Select a Valid Time' : `Reserve (RM ${total.toFixed(2)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
