import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Navigation, ShieldCheck,
  Car, Wifi, CreditCard,
  Loader2, Calendar, AlertTriangle,
  Heart,
} from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { useAuth } from '@/features/auth/context/AuthContext';
import type { Booking, ParkingSpot } from '../types';
import { saveJourneySession } from '../lib/journeySession';
import { getWalkingRoute } from '@/services/walkingRoutes';
import { confirmBooking, createBookingQuote, type BookingQuote, type ConfirmedBooking } from '../api/bookingApi';
import { getMyVehicles, type VehicleApiData } from '../api/vehicleApi';
import { isParkingFavorite, toggleParkingFavorite } from '../lib/favoriteParking';

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

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

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

  // ── Booking ──
  const today = new Date();
  const [startDate, setStartDate] = useState(toDateInput(addDays(today, 1)));
  const [endDate, setEndDate] = useState(toDateInput(addDays(today, 2)));
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null);
  const [vehicles, setVehicles] = useState<VehicleApiData[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(false);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [reservationReady, setReservationReady] = useState(false);
  const [isFavorite, setIsFavorite] = useState(() => Boolean(spot && user?.userId && isParkingFavorite(user.userId, spot.parkingSpotId)));
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!spot || !stationCoords) return;
    setIsLoadingRoute(true);
    getWalkingRoute(spot.lat, spot.lon, stationCoords.lat, stationCoords.lon)
      .then(setWalkingInfo).finally(() => setIsLoadingRoute(false));
  }, [spot, stationCoords]);

  useEffect(() => {
    if (!user?.token) return;
    const controller = new AbortController();
    setIsVehiclesLoading(true);
    getMyVehicles(user.token, controller.signal)
      .then((result) => {
        setVehicles(result.data);
        setSelectedVehicleId((current) => current ?? result.data[0]?.vehicleId ?? null);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setBookingError(error instanceof Error ? error.message : 'Unable to load your vehicles.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsVehiclesLoading(false);
      });
    return () => controller.abort();
  }, [user?.token]);

  useEffect(() => {
    setIsFavorite(Boolean(spot && user?.userId && isParkingFavorite(user.userId, spot.parkingSpotId)));
  }, [spot, user?.userId]);

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

  const invalidDates = endDate <= startDate || startDate < toDateInput(today);
  const displayedRate = quote?.ratePerDay ?? spot.dailyRate ?? 0;
  const displayedTotal = quote?.rentalSubtotal ?? 0;

  const updateDates = (kind: 'start' | 'end', value: string) => {
    setQuote(null);
    setBookingError(null);
    idempotencyKeyRef.current = null;
    if (kind === 'start') {
      setStartDate(value);
      if (endDate <= value) setEndDate(toDateInput(addDays(new Date(`${value}T00:00:00`), 1)));
    } else {
      setEndDate(value);
    }
  };

  const handleBook = async () => {
    if (!user?.token || invalidDates || isBookingLoading) return;
    setBookingError(null);
    setIsBookingLoading(true);

    try {
      if (!quote) {
        const result = await createBookingQuote(user.token, spot.parkingSpotId, { startDate, endDate });
        setQuote(result.data);
        return;
      }

      if (!selectedVehicleId) throw new Error('Select a vehicle before confirming this booking.');
      idempotencyKeyRef.current ??= crypto.randomUUID();
      const confirmation = await confirmBooking(
        user.token,
        quote.quoteId,
        selectedVehicleId,
        idempotencyKeyRef.current,
      );
      setConfirmedBooking(confirmation.data);

      const parkingSpot: ParkingSpot = {
        ...spot,
        station: stationName || 'Klang Valley transit area',
        name: spot.address,
        pricePerHour: quote.ratePerDay,
        distance: walkingInfo?.rawDistance ? Math.round(walkingInfo.rawDistance) : 0,
        lat: spot.lat,
        lng: spot.lon,
        available: false,
        type: 'Condo Bay',
        owner: 'Private bay owner',
      };
      const vehicle = vehicles.find((item) => item.vehicleId === selectedVehicleId);
      const booking: Booking = {
        id: confirmation.data.bookingReference,
        spot: parkingSpot,
        startTime: new Date(`${quote.startDate}T00:00:00`),
        endTime: new Date(`${quote.endDate}T00:00:00`),
        vehiclePlate: vehicle?.numberPlate ?? '',
        status: 'Upcoming',
        totalPaid: quote.rentalSubtotal,
      };

      saveJourneySession(booking);
      setReservationReady(true);
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Unable to complete this booking.');
    } finally {
      setIsBookingLoading(false);
    }
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
                <div><p className="text-[11px] text-[#6e6e73]">Booking dates</p><p className="text-[13px] font-semibold mt-1">{quote?.startDate} to {quote?.endDate}</p></div>
                <div><p className="text-[11px] text-[#6e6e73]">Duration</p><p className="text-[13px] font-semibold mt-1">{quote?.bookedDays} day{quote?.bookedDays === 1 ? '' : 's'}</p></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#6e6e73]">Paid total</span>
                <strong>RM {quote?.rentalSubtotal.toFixed(2)}</strong>
              </div>
              <p className="text-[11px] text-[#6e6e73] leading-relaxed">Booking reference: {confirmedBooking?.bookingReference}</p>
              <button type="button" onClick={() => navigate('/commuter', { state: { activeTab: 'active' } })} className="w-full min-h-11 rounded-xl bg-[#007AFF] text-white text-[13px] font-semibold">Continue to my parking pass</button>
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
          <div className="flex items-start justify-between gap-4">
            <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#111] tracking-[-0.01em] leading-tight">{spot.address}</h1>
            <div className="flex items-center gap-1.5 mt-2 text-[13px] text-[#5f6368]">
              <MapPin size={14} className="text-[#007AFF] shrink-0" />
              <span>{stationName ? `${stationName} area` : 'Klang Valley'}</span>
            </div>
            </div>
            <button type="button" onClick={() => { if (user?.userId) { toggleParkingFavorite(user.userId, spot); setIsFavorite((current) => !current); } }}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={isFavorite}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${isFavorite ? 'border-rose-200 bg-rose-50 text-rose-500' : 'border-[#dadce0] text-[#5f6368] hover:text-rose-500'}`}>
              <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
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

          {/* Booking dates */}
          <div>
            <h3 className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Calendar size={14} className="text-[#007AFF]" /> Select Booking Dates
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#5f6368]">Start date</label>
                <input type="date" value={startDate} onChange={(event) => updateDates('start', event.target.value)}
                  min={toDateInput(today)}
                  className="w-full px-3 py-2.5 rounded-xl text-[12px] border border-[#dadce0] bg-white focus:outline-none focus:border-[#007AFF]" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#5f6368]">End date</label>
                <input type="date" value={endDate} onChange={(event) => updateDates('end', event.target.value)}
                  min={toDateInput(addDays(new Date(`${startDate}T00:00:00`), 1))}
                  className="w-full px-3 py-2.5 rounded-xl text-[12px] border border-[#dadce0] bg-white focus:outline-none focus:border-[#007AFF]" />
              </div>
            </div>

            {invalidDates && (
              <div className="mt-3 flex items-start gap-2 text-[12px] text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded-xl p-3">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>The end date must be after the start date, and dates cannot be in the past.</span>
              </div>
            )}

            <div className="mt-4 space-y-1">
              <label className="text-[11px] font-medium text-[#5f6368]">Vehicle</label>
              <select value={selectedVehicleId ?? ''} onChange={(event) => setSelectedVehicleId(Number(event.target.value) || null)}
                disabled={isVehiclesLoading || vehicles.length === 0}
                className="w-full px-3 py-2.5 rounded-xl text-[12px] border border-[#dadce0] bg-white focus:outline-none focus:border-[#007AFF]">
                {vehicles.length === 0 && <option value="">{isVehiclesLoading ? 'Loading vehicles…' : 'No vehicles available'}</option>}
                {vehicles.map((vehicle) => (
                  <option key={vehicle.vehicleId} value={vehicle.vehicleId}>{vehicle.numberPlate} · {vehicle.vehicleBrand} {vehicle.vehicleModel}</option>
                ))}
              </select>
            </div>

            {bookingError && (
              <div className="mt-3 flex items-start gap-2 text-[12px] text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded-xl p-3">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{bookingError}</span>
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
          {quote && (
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#5f6368]">RM {quote.ratePerDay.toFixed(2)} × {quote.bookedDays} day{quote.bookedDays === 1 ? '' : 's'}</span>
                <span className="font-semibold text-[#111]">RM {quote.rentalSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-[15px]">
                <span>Total</span>
                <span>RM {quote.rentalSubtotal.toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-[#9ca3af]">Quote expires {new Date(quote.expiresAt).toLocaleString('en-MY')}.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom fixed booking bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e8eaed] px-4 md:px-6 py-4 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-[#111] text-[15px]">{displayedRate > 0 ? `RM ${displayedRate.toFixed(2)}` : 'Daily rate'} <span className="text-[13px] font-normal text-[#5f6368]">/ day</span></p>
            <p className="text-[11px] text-[#9ca3af]">{quote ? `${quote.bookedDays} days · RM ${displayedTotal.toFixed(2)} total` : 'Request a quote for exact pricing'}</p>
          </div>
          <button onClick={handleBook} disabled={invalidDates || isBookingLoading || (Boolean(quote) && !selectedVehicleId)}
            className={`font-semibold text-[13px] px-8 py-3 rounded-xl transition flex items-center gap-2 ${
              invalidDates || isBookingLoading || (Boolean(quote) && !selectedVehicleId) ? 'bg-[#e8eaed] text-[#9ca3af] cursor-not-allowed' : 'bg-[#007AFF] text-white hover:bg-[#1d4ed8] active:scale-[0.98]'
            }`}>
            {isBookingLoading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
            {isBookingLoading ? (quote ? 'Confirming…' : 'Creating quote…') : quote ? `Confirm & Pay · RM ${quote.rentalSubtotal.toFixed(2)}` : 'Get Booking Quote'}
          </button>
        </div>
      </div>
    </div>
  );
}
