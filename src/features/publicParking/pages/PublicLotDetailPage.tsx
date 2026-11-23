import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Compass, Footprints, MapPin, Navigation } from 'lucide-react';
import { displayDateOptions, parseTimestamp } from '@/lib/dateTime';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { useAuth } from '@/features/auth/context/AuthContext';
import { fetchPublicLot } from '../api/publicParkingApi';
import { DEFAULT_PUBLIC_PARKING_PHOTO, getPublicLotPhotoUrl, type PublicParkingLotDetail } from '../types';

const POLL_INTERVAL_MS = 5_000;
const RETRY_INTERVAL_MS = 10_000;

export default function PublicLotDetailPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user, isGuest, logout } = useAuth();
  const lotId = Number(id);
  const [result, setResult] = useState<{ id: number; lot?: PublicParkingLotDetail; error?: string }>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!Number.isSafeInteger(lotId) || lotId <= 0) return;
    const controller = new AbortController();
    let timer: number | undefined;
    let inFlight = false;

    async function refresh() {
      if (document.hidden || inFlight || controller.signal.aborted) return;
      inFlight = true;
      let delay = POLL_INTERVAL_MS;
      try {
        const lot = await fetchPublicLot(lotId, controller.signal);
        if (!controller.signal.aborted) setResult({ id: lotId, lot });
      } catch (error) {
        delay = RETRY_INTERVAL_MS;
        if (!controller.signal.aborted) {
          const message = error instanceof Error ? error.message : 'Unable to load public parking.';
          setResult(previous => ({ id: lotId, lot: previous?.id === lotId ? previous.lot : undefined, error: message }));
        }
      } finally {
        inFlight = false;
        if (!document.hidden && !controller.signal.aborted) timer = window.setTimeout(refresh, delay);
      }
    }

    function refreshWhenVisible() {
      window.clearTimeout(timer);
      void refresh();
    }

    document.addEventListener('visibilitychange', refreshWhenVisible);
    void refresh();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [lotId, attempt]);

  const current = result?.id === lotId ? result : undefined;
  const error = !Number.isSafeInteger(lotId) || lotId <= 0 ? 'This parking link is invalid.' : current?.error;
  const backPath = state?.returnTab === 'map' ? '/commuter?tab=map' : '/commuter?tab=home';

  return (
    <div className="parking-detail-workspace app-workspace page-shell min-h-screen pb-16">
      <DashboardHeader role="commuter" user={user} isGuest={Boolean(isGuest || !user)}
        onSignOut={() => { logout(); navigate('/'); }} onSignIn={() => navigate('/login')}
        onBrandClick={() => navigate('/commuter?tab=home', { replace: true })} />
      <main className="parking-detail-content mx-auto w-[92vw] max-w-7xl px-2 pb-12 pt-4 sm:px-4 lg:px-6">
        <nav className="mb-4" aria-label="Parking navigation">
          <Link to={backPath} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} aria-hidden="true" /> Back to parking
          </Link>
        </nav>
        {current?.lot ? <PublicLotDetails lot={current.lot} refreshDelayed={Boolean(current.error)} /> : error ? (
          <div className="workspace-panel space-y-3 p-5" role="alert">
            <p>{error}</p>
            {current?.error && (
              <button type="button" className="workspace-button workspace-button--secondary"
                onClick={() => { setResult(undefined); setAttempt(previous => previous + 1); }}>Try again</button>
            )}
          </div>
        ) : <p role="status" className="text-sm text-muted-foreground">Loading parking details…</p>}
      </main>
    </div>
  );
}

function PublicLotDetails({ lot, refreshDelayed }: { lot: PublicParkingLotDetail; refreshDelayed: boolean }) {
  const available = lot.occupancyStatus !== 'unknown' && typeof lot.availableSpaces === 'number'
    && Number.isFinite(lot.availableSpaces) && lot.totalCapacity > 0
    ? Math.min(lot.totalCapacity, Math.max(0, lot.availableSpaces)) : null;
  const live = available != null && lot.occupancyStatus === 'live' && !refreshDelayed;
  const freshness = available == null ? 'Unavailable' : live ? 'Live' :
    refreshDelayed || lot.occupancyStatus === 'stale' ? 'Last known' : null;
  const observedAt = parseTimestamp(lot.occupancyUpdatedAt);
  const observedTime = Number.isNaN(observedAt.getTime()) ? null
    : observedAt.toLocaleTimeString([], displayDateOptions({ hour: 'numeric', minute: '2-digit', second: '2-digit' }));
  const openAllDay = lot.operatingType === 1 || lot.operatingType === 'Unlimited24Hours';
  const hours = openAllDay ? 'Open 24 hours'
    : lot.openingTime && lot.closingTime ? lot.openingTime + ' – ' + lot.closingTime
    : 'Hours unavailable';

  const flatRate = lot.flatRatePerEntry != null && lot.flatRatePerEntry > 0 ? lot.flatRatePerEntry : null;
  const coordinates = lot.latitude + ',' + lot.longitude;
  const directionsClass = 'workspace-button workspace-button--secondary inline-flex items-center gap-2';

  return (
    <>
      <header className="mb-6">
        <h1 className="parking-detail-title break-words">
          {lot.lotName}
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>Public drive-in parking</span>
          {lot.nearestStationName && (
            <span className="inline-flex min-w-0 items-start gap-1.5">
              <Footprints size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                {lot.distanceToStation == null ? 'Near ' : 'About ' + lot.distanceToStation + ' m to '}
                {lot.nearestStationName}
              </span>
            </span>
          )}
        </div>
      </header>

      <figure className="workspace-panel overflow-hidden">
        <img
          src={getPublicLotPhotoUrl(lot.facilityPhotoUrl)}
          alt={lot.lotName}
          className="aspect-[16/7] max-h-80 w-full object-cover sm:aspect-[16/6]"
          onError={({ currentTarget }) => {
            if (currentTarget.getAttribute('src') !== DEFAULT_PUBLIC_PARKING_PHOTO) {
              currentTarget.src = DEFAULT_PUBLIC_PARKING_PHOTO;
            }
          }}
        />
      </figure>

      <div className="mt-5 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.72fr)] md:gap-8">
        <div className="space-y-3 md:sticky md:top-0 md:col-start-2 md:row-start-1">
          <section aria-labelledby="public-lot-availability-heading" className="workspace-panel p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="public-lot-availability-heading" className="text-sm font-semibold">Parking availability</h2>
              {freshness && (
                <span className={'inline-flex items-center gap-1.5 text-xs font-medium ' + (live ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
                  <span aria-hidden="true" className={'size-1.5 rounded-full ' + (live ? 'bg-emerald-500' : 'bg-current')} />
                  {freshness}
                </span>
              )}
            </div>
            {available == null ? (
              <p className="mt-2 text-sm text-muted-foreground">Waiting for sensor data</p>
            ) : (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2" aria-live="polite">
                <span className="text-3xl font-bold leading-none tracking-tight tabular-nums">{available}</span>
                <span className="text-sm text-muted-foreground">of {lot.totalCapacity} bays free</span>
              </div>
            )}
            {available != null && observedTime && (
              <p className="mt-2 text-xs text-muted-foreground">Updated at <time dateTime={observedAt.toISOString()}>{observedTime}</time></p>
            )}
          </section>
          <section aria-label="Parking rates" className="workspace-panel p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-2xl font-bold tracking-tight">RM {(flatRate ?? lot.hourlyRate).toFixed(2)}</span>
              <span className="text-sm text-muted-foreground">/ {flatRate == null ? 'hour' : 'entry'}</span>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Daily maximum</dt>
                <dd className="text-right font-medium">{lot.dailyCapRate ? 'RM ' + lot.dailyCapRate.toFixed(2) : 'No cap'}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Free entry grace period</dt>
                <dd className="text-right font-medium">{lot.initialGraceMinutes > 0 ? lot.initialGraceMinutes + ' min' : 'None'}</dd>
              </div>
            </dl>
            <Link to={'/public-pay?lot=' + lot.publicParkingLotId}
              className="workspace-button workspace-button--primary mt-4 flex w-full items-center justify-center gap-2">
              Drive in &amp; pay <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
        </div>

        <div className="min-w-0 space-y-5 md:col-start-1 md:row-start-1">
          <section className="space-y-2" aria-labelledby="public-lot-location-heading">
            <h2 id="public-lot-location-heading" className="text-lg font-semibold">Location</h2>
            {lot.address && (
              <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="break-words">{lot.address}</span>
              </p>
            )}
            <p className="text-sm font-medium">{hours}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a href={'https://www.google.com/maps/dir/?api=1&destination=' + coordinates} target="_blank" rel="noopener noreferrer" className={directionsClass}>
                <Navigation size={15} className="text-[#007AFF]" aria-hidden="true" /> Google Maps
              </a>
              <a href={'https://waze.com/ul?ll=' + coordinates + '&navigate=yes'} target="_blank" rel="noopener noreferrer" className={directionsClass}>
                <Compass size={15} className="text-[#007AFF]" aria-hidden="true" /> Waze
              </a>
            </div>
          </section>

          <section className="space-y-2 border-t border-border pt-4" aria-labelledby="public-lot-access-heading">
            <h2 id="public-lot-access-heading" className="text-lg font-semibold">How to park</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Drive up to the entrance barrier so the camera can read your plate. Pay in ParkJom or scan the QR code at the exit.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
