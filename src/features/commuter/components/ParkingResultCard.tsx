import { Accessibility, Building2, CheckCircle2, Heart, MapPin, ShieldCheck, Star, TrainFront, Zap } from 'lucide-react';
import ParkingPhoto from './ParkingPhoto';
import { formatShortAddress, formatShortSpotName } from '../lib/formatUtils';
import { getEffectiveDailyRate } from '../lib/browseFilters';
import type { ParkingSpot } from '../types';

interface ParkingResultCardProps {
  spot: ParkingSpot;
  isSaved: boolean;
  favoritePending: boolean;
  ratingData?: { averageRating: number; totalCount: number };
  userDistanceKm: number | null;
  onOpen: () => void;
  onToggleFavorite: () => void;
}

export default function ParkingResultCard({
  spot, isSaved, favoritePending, ratingData, userDistanceKm, onOpen, onToggleFavorite,
}: ParkingResultCardProps) {
  const effectiveDaily = getEffectiveDailyRate(spot);
  const shortTitle = spot.propertyName || formatShortSpotName(spot.name);

  return (
    <article className="parking-result workspace-panel">
      <button
        type="button"
        className="parking-result__open"
        aria-label={`View parking at ${shortTitle}`}
        onClick={onOpen}
      />
      <div className="parking-result__photo">
        <ParkingPhoto key={spot.primaryImageUrl} src={spot.primaryImageUrl} />
        {/* Top-left subtle type badge */}
        <div className="absolute top-3 left-3 pointer-events-none">
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/75 text-white px-2.5 py-1 text-sm font-semibold">
            <CheckCircle2 size={11} className="text-emerald-400" />
            <span>{spot.type === 'Condo Bay' ? 'Condo Bay' : 'Private Bay'}</span>
          </span>
        </div>

        {/* Top-right Heart button */}
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={isSaved}
          disabled={favoritePending}
          aria-label={isSaved ? 'Remove from favorites' : 'Save to favorites'}
          className="absolute top-3 right-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/35 hover:bg-black/55 text-white backdrop-blur-md border border-white/20 transition-all hover:scale-105 active:scale-90 cursor-pointer"
        >
          <Heart
            size={16}
            strokeWidth={2}
            className={
              isSaved ? 'text-rose-500 fill-rose-500' : 'text-white fill-none'
            }
          />
        </button>

        {/* Bottom-left frosted amenity pills (Hidmo overlay style) */}
        <div className="commuter-browse__amenities absolute bottom-2.5 left-3 flex flex-wrap items-center gap-1.5 pointer-events-none">
          {spot.hasEvCharging && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 text-white px-2.5 py-0.5 text-[10px] font-bold backdrop-blur-md">
              <Zap size={10} /> EV Ready
            </span>
          )}
          {spot.isCovered && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 text-white px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-md">
              <Building2 size={10} /> Covered
            </span>
          )}
          {spot.hasCctv && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 text-white px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-md">
              <ShieldCheck size={10} /> CCTV
            </span>
          )}
        </div>

        {/* Bottom-right rating pill */}
        <div className="absolute bottom-2.5 right-3 pointer-events-none">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/65 text-white px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md">
            <Star
              size={11}
              className={
                ratingData && ratingData.averageRating > 0
                  ? 'text-[#FF9500] fill-[#FF9500]'
                  : 'text-white/75'
              }
            />
            <span>
              {ratingData && ratingData.totalCount > 0 && ratingData.averageRating > 0
                ? `${ratingData.averageRating.toFixed(1)} (${ratingData.totalCount})`
                : 'New'}
            </span>
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="commuter-browse__card-body p-4 flex-1 flex flex-col justify-between space-y-2.5">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2.5">
            <h3 className="text-[15px] font-bold leading-snug text-[#111111] dark:text-white group-hover:text-[#007AFF] transition-colors line-clamp-1">
              {shortTitle}
            </h3>
            <div className="text-right shrink-0">
              <span className="text-[15px] font-extrabold text-[#111111] dark:text-white whitespace-nowrap">
                RM {effectiveDaily !== null ? effectiveDaily.toFixed(2) : '—'}
                <span className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1AA]">
                  /day
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[12px] text-[#6E6E73] dark:text-[#A1A1AA] min-w-0">
              <MapPin size={13} className="text-[#007AFF] dark:text-[#0A84FF] shrink-0" />
              <span className="truncate">
                {spot.stationName
                  ? `Near ${spot.stationName}`
                  : formatShortAddress(spot.address)}
              </span>
            </div>
            {spot.monthlyRate > 0 && (
              <span className="text-[11px] font-semibold text-[#007AFF] dark:text-[#3894FF] shrink-0">
                RM {spot.monthlyRate.toFixed(0)}/mo
              </span>
            )}
          </div>
        </div>

        {/* Compact Hidmo-style spec chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-[#3A3A3C] dark:text-[#D4D4D8]">
            <TrainFront size={11} className="text-[#007AFF]" />
            {spot.timeToStationInMinutes > 0
              ? `${Math.round(spot.timeToStationInMinutes)} min walk`
              : 'Walking time unavailable'}
          </span>

          {userDistanceKm !== null && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-[#3A3A3C] dark:text-[#D4D4D8]">
              {userDistanceKm < 1
                ? `${Math.max(1, Math.round(userDistanceKm * 1000))}m away`
                : `${userDistanceKm.toFixed(1)}km away`}
            </span>
          )}

          {spot.isHandicapAccessible && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-[#3A3A3C] dark:text-[#D4D4D8]">
              <Accessibility size={11} className="text-[#007AFF]" /> Accessible
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
