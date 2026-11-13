import React from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  MapPin,
  Train,
  Clock,
  ShieldCheck,
  ExternalLink,
  Navigation,
  Compass,
  Radio,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import type { PublicParkingLot } from '../types';
import { DEFAULT_PUBLIC_PARKING_PHOTO, getPublicLotPhotoUrl } from '../types';

interface PublicLotDetailModalProps {
  lot: PublicParkingLot | null;
  onClose: () => void;
}

export const PublicLotDetailModal: React.FC<PublicLotDetailModalProps> = ({ lot, onClose }) => {
  if (!lot) return null;

  const isFull = lot.availableSpaces <= 0;
  const isLow = lot.availableSpaces > 0 && lot.availableSpaces <= 5;
  const occupancyPercent = Math.round(((lot.totalCapacity - lot.availableSpaces) / lot.totalCapacity) * 100);

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lot.latitude},${lot.longitude}`;
  const wazeUrl = `https://waze.com/ul?ll=${lot.latitude},${lot.longitude}&navigate=yes`;

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#1c1c1e] rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-lot-detail-title"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-20 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-md"
          aria-label="Close details"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Hero Photo Section */}
        <div className="relative w-full h-48 sm:h-56 bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden">
          <img
            src={getPublicLotPhotoUrl(lot.facilityPhotoUrl)}
            alt={lot.lotName}
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src !== DEFAULT_PUBLIC_PARKING_PHOTO) {
                target.src = DEFAULT_PUBLIC_PARKING_PHOTO;
              }
            }}
            className="w-full h-full object-cover"
          />

          {/* Badges Overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-black/75 text-white backdrop-blur-md border border-white/15 shadow-md">
              <Layers className="w-3.5 h-3.5 text-[#0071e3]" />
              <span>Public Drive-In</span>
            </span>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold backdrop-blur-md shadow-md border ${
                isFull
                  ? 'bg-rose-500/90 text-white border-rose-400/30'
                  : isLow
                  ? 'bg-amber-500/90 text-white border-amber-400/30'
                  : 'bg-emerald-600/90 text-white border-emerald-400/30'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>{isFull ? 'FULL' : `${lot.availableSpaces} of ${lot.totalCapacity} bays left`}</span>
            </span>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          <div>
            <h3 id="public-lot-detail-title" className="text-xl font-bold text-[#1d1d1f] dark:text-white tracking-tight">
              {lot.lotName}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-[#0071e3] mt-0.5" />
              <span>{lot.address}</span>
            </p>
          </div>

          {/* Transit Link Banner */}
          {lot.nearestStationName && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-xs">
              <div className="flex items-center gap-2">
                <Train className="w-4 h-4 text-[#0071e3]" />
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {lot.nearestStationName}
                </span>
                {lot.distanceToStation && (
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    (~{lot.distanceToStation}m direct walk)
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-[#0071e3] font-semibold bg-blue-100/60 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                TRANSIT LINKED
              </span>
            </div>
          )}

          {/* Real-time Occupancy Gauge */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/60 space-y-2">
            <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-300 font-medium">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-500" />
                <span>Live IoT Capacity</span>
              </span>
              <span className="font-mono font-semibold">
                {lot.totalCapacity - lot.availableSpaces} occupied ({occupancyPercent}%)
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isFull ? 'bg-[#ff3b30]' : isLow ? 'bg-[#ff9500]' : 'bg-[#34c759]'
                }`}
                style={{ width: `${Math.min(100, occupancyPercent)}%` }}
              />
            </div>
          </div>

          {/* Tariffs & Rules Grid */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/40">
              <span className="text-[10.5px] text-neutral-400 block font-medium">Hourly Tariff</span>
              <span className="text-base font-bold text-neutral-900 dark:text-white font-mono mt-0.5 block">
                RM {lot.hourlyRate.toFixed(2)}
                <span className="text-[11px] font-normal text-neutral-400">/hr</span>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/40">
              <span className="text-[10.5px] text-neutral-400 block font-medium">Daily Maximum</span>
              <span className="text-base font-bold text-neutral-900 dark:text-white font-mono mt-0.5 block">
                {lot.dailyCapRate ? `RM ${lot.dailyCapRate.toFixed(2)}` : 'No Cap'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/40">
              <span className="text-[10.5px] text-neutral-400 block font-medium">Operating Hours</span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200 mt-0.5 block truncate">
                {lot.operatingType === 1 || lot.operatingType === 'Unlimited24Hours'
                  ? '24 Hours Open'
                  : `${lot.openingTime || '07:00'} - ${lot.closingTime || '23:00'}`}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/40">
              <span className="text-[10.5px] text-neutral-400 block font-medium">Free Grace Period</span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200 mt-0.5 block">
                {lot.initialGraceMinutes || 15} mins free entry
              </span>
            </div>
          </div>

          {/* Drive-in Instructions */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Drive-In Automatic Access</span>
            </div>
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
              No reservation required. Camera reads your car plate at the entrance barrier. Pay via ParkJom checkout or QR scan upon exit.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-black/[0.06] dark:border-white/10 bg-neutral-50/70 dark:bg-neutral-900/70 backdrop-blur-md flex flex-wrap gap-2.5">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-11 px-4 rounded-2xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-white font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>Google Maps</span>
          </a>

          <a
            href={wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-11 px-4 rounded-2xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-white font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>Waze</span>
          </a>

          <Link
            to={`/public-pay?lot=${lot.publicParkingLotId}`}
            onClick={onClose}
            className="w-full sm:w-auto sm:flex-1 h-11 px-6 rounded-2xl bg-[#0071e3] hover:bg-[#0077ed] active:scale-95 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <span>Drive-In & Pay Now</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
