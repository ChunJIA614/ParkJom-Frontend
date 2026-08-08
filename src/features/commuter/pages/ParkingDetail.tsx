import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Clock, Navigation, ShieldCheck,
  Car, Wifi, CreditCard,
  Loader2, Calendar, AlertTriangle,
} from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { useAuth } from '@/features/auth/context/AuthContext';
import type { Booking, ParkingSpot } from '../types';
import { clearJourneySession, saveJourneySession } from '../lib/journeySession';
import { getWalkingRoute } from '@/services/walkingRoutes';

/* ================================================================
   ParkingDetail — Parking spot detail page
   Design: Apple/Google style — clean whitespace, single blue accent, no gradients
   ================================================================ */

// ── Types ──
interface MockParkingSpot extends ParkingSpot {
  lon: number;
  photoUrl: string;
  price: number;
}
interface WalkingInfo {
  distanceText: string;
  durationText: string;
  rawDistance: number;
}

export default function ParkingDetail() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
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
  const [reservationReady, setReservationReady] = useState(false);

  useEffect(() => {
    if (!spot || !stationCoords) return;
    setIsLoadingRoute(true);
    getWalkingRoute(spot.lat, spot.lon, stationCoords.lat, stationCoords.lon)
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
  const total = subtotal;

  // ── Confirm booking ──
  const handleBook = () => {
    if (conflict) { alert('Please select a future time slot before booking.'); return; }

    const parkingSpot: ParkingSpot = {
      ...spot,
      station: stationName || 'Klang Valley transit area',
      name: spot.address,
      pricePerHour: spot.price,
      distance: walkingInfo?.rawDistance ? Math.round(walkingInfo.rawDistance) : 0,
      lat: spot.lat,
      lng: spot.lon,
      available: false,
      type: 'Condo Bay',
      owner: 'Private bay owner',
    };
    const booking: Booking = {
      id: `BK-${Date.now().toString().slice(-6)}`,
      spot: parkingSpot,
      startTime: selectedStart,
      endTime: new Date(selectedStart.getTime() + durationHours * 60 * 60 * 1000),
      vehiclePlate: 'VGV 8899',
      status: 'Active',
      totalPaid: total,
    };

    saveJourneySession(booking);
    setReservationReady(true);
  };

  if (reservationReady) {
    return (
      <div className="page-shell text-[#1d1d1f]">
        <DashboardHeader
          role="commuter"
          user={user}
          onSignOut={() => { logout(); navigate('/'); }}
          onBrandClick={() => navigate('/commuter', { replace: true, state: { activeTab: 'home' } })}
        />
        <main className="max-w-xl mx-auto px-4 py-10 md:py-16">
          <div className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden">
            <div className="bg-[#1c1c1e] text-white p-6 md:p-8">
              <div className="w-11 h-11 rounded-xl bg-[#34c759] flex items-center justify-center mb-6">
                <ShieldCheck size={23} />
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-[-0.03em]">Parking Pass ready</h1>
              <p className="text-[#c7c7cc] text-[13px] mt-2 leading-relaxed">Your selected bay and booking time are collected in one pass for arrival and access.</p>
            </div>
            <div className="p-6 md:p-8 space-y-5">
              <div>
                <p className="text-[11px] text-[#6e6e73]">Bay</p>
                <p className="font-semibold mt-1">{spot.address}</p>
                <p className="text-[12px] text-[#6e6e73] mt-1">{stationName || 'Klang Valley transit area'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 py-4 border-y border-black/[0.08]">
                <div><p className="text-[11px] text-[#6e6e73]">Arrival</p><p className="text-[13px] font-semibold mt-1">{selectedDate} · {startTime}</p></div>
                <div><p className="text-[11px] text-[#6e6e73]">Parking window</p><p className="text-[13px] font-semibold mt-1">{durationHours}h · until {endTimeStr}</p></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#6e6e73]">Reservation total</span>
                <strong>RM {total.toFixed(2)}</strong>
              </div>
              <p className="text-[11px] text-[#6e6e73] leading-relaxed">This prototype stores the pass on this device. Live payment and final backend confirmation still depend on connected ParkJom services.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <button type="button" onClick={() => { clearJourneySession(); setReservationReady(false); }} className="min-h-11 rounded-xl border border-black/[0.12] text-[13px] font-semibold">Edit booking</button>
                <button type="button" onClick={() => navigate('/commuter', { state: { activeTab: 'active' } })} className="min-h-11 rounded-xl bg-[#007AFF] text-white text-[13px] font-semibold">Continue to arrival</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell text-[#1d1d1f] pb-24">
      <DashboardHeader
        role="commuter"
        user={user}
        onSignOut={() => { logout(); navigate('/'); }}
        onBrandClick={() => navigate('/commuter', { replace: true, state: { activeTab: 'home' } })}
      />

      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 md:pt-10">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6e6e73] hover:text-[#1d1d1f]">
          <ArrowLeft size={17} /> Back to map
        </button>
      </div>

      {/* ── Content card ── */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 mt-5 relative z-10">
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
                { icon: Car, label: 'Private parking bay' },
                { icon: Wifi, label: 'Smart bollard access' },
                { icon: Navigation, label: 'Transit-adjacent' },
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
              A private parking bay offered near {stationName || 'an LRT/MRT station'}. ParkJom coordinates the reservation and smart-bollard access flow for the parking session.
            </p>
          </div>

          <div className="h-px bg-[#e8eaed]" />

          {/* Price breakdown */}
          {!conflict && (
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#5f6368]">RM {spot.price.toFixed(2)} x {durationHours}h <span className="text-[#9ca3af] ml-1">({startTime} &ndash; {endTimeStr})</span></span>
                <span className="font-semibold text-[#111]">RM {subtotal.toFixed(2)}</span>
              </div>
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
            {conflict ? 'Select a Valid Time' : `Create Parking Pass · RM ${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
