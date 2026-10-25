import React, { useState } from 'react';
import {
  Bus,
  Car,
  Footprints,
  Train,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Zap,
  CheckCircle2,
  Navigation,
  ExternalLink,
} from 'lucide-react';
import {
  CommuterPreference,
  MultimodalPlanResult,
} from '@/services/multimodalRoutingService';
import { DrivingRouteResult } from '@/services/drivingRouteService';
import { formatShortSpotName, formatShortAddress } from '../lib/formatUtils';

interface LinearJourneyNavigatorProps {
  plan?: MultimodalPlanResult | null;
  drivingRoute?: DrivingRouteResult | null;
  activeItineraryId?: string;
  onSelectItinerary?: (id: string) => void;
  focusedLegIndex?: number | null;
  onFocusLeg?: (legIndex: number | null) => void;
  preference?: CommuterPreference;
  onChangePreference?: (pref: CommuterPreference) => void;
  journeyTab: 'drive' | 'transit';
  onChangeJourneyTab: (tab: 'drive' | 'transit') => void;
  onClose?: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  onFocusDrivingRoute?: () => void;
  onFocusTransitRoute?: () => void;
  className?: string;
}

export default function LinearJourneyNavigator({
  plan,
  drivingRoute,
  activeItineraryId,
  onSelectItinerary,
  focusedLegIndex = null,
  onFocusLeg,
  preference = 'balanced',
  onChangePreference,
  journeyTab,
  onChangeJourneyTab,
  onClose,
  isMinimized = false,
  onToggleMinimize,
  onFocusDrivingRoute,
  onFocusTransitRoute,
  className = '',
}: LinearJourneyNavigatorProps) {
  const [expandedLegIndex, setExpandedLegIndex] = useState<number | null>(0);

  const activeItinerary = plan
    ? plan.allItineraries.find((it) => it.id === activeItineraryId) ||
      plan.recommendedItinerary
    : null;

  const currentStep = focusedLegIndex !== null ? focusedLegIndex : 0;

  const handleNextStep = () => {
    if (activeItinerary && currentStep < activeItinerary.legs.length - 1) {
      const next = currentStep + 1;
      onFocusLeg?.(next);
      setExpandedLegIndex(next);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      onFocusLeg?.(prev);
      setExpandedLegIndex(prev);
    }
  };

  // If minimized, display a sleek Google Maps route pill
  if (isMinimized) {
    const isDriveTab = journeyTab === 'drive' && drivingRoute;
    return (
      <div
        data-map-control
        className={`bg-white/98 dark:bg-[#141417]/95 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-white/10 shadow-xl px-4 py-2.5 flex items-center justify-between gap-3 text-slate-800 dark:text-white ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            {isDriveTab ? (
              <Car size={16} />
            ) : activeItinerary?.type === 'transit_feeder' ? (
              <Bus size={16} />
            ) : (
              <Footprints size={16} />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {isDriveTab
                ? `Drive to ${formatShortSpotName(drivingRoute.destination.name)}`
                : `To ${formatShortSpotName(activeItinerary?.targetStationName || 'Station')}`}
            </div>
            <div className="text-[11px] text-blue-700 dark:text-[#3894FF] font-semibold flex items-center gap-1.5">
              <span>
                {isDriveTab
                  ? drivingRoute.durationText
                  : `~${activeItinerary?.totalDurationMinutes || 0} min`}
              </span>
              <span>·</span>
              <span className="text-slate-500 dark:text-[#A1A1AA]">
                {isDriveTab
                  ? drivingRoute.distanceText
                  : `${activeItinerary?.totalWalkDistanceMeters || 0}m walk`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-white/10 text-blue-700 dark:text-[#3894FF] hover:bg-blue-100 dark:hover:bg-white/15 transition flex items-center gap-1 cursor-pointer"
            >
              <span>Steps</span>
              <ChevronUp size={13} />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 dark:text-[#A1A1AA] hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#202025] transition cursor-pointer"
              aria-label="Close directions"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      data-map-control
      className={`linear-journey-navigator bg-white/98 dark:bg-[#141417]/95 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-white/10 shadow-xl overflow-hidden flex flex-col text-slate-800 dark:text-white max-h-full ${className}`}
    >
      {/* ── Top Header: Navigation Corridor & Back Trigger ── */}
      <div className="p-3 border-b border-slate-100 dark:border-white/10 bg-slate-50/90 dark:bg-[#18181C]">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-[#3894FF] hover:text-blue-700 dark:hover:text-white bg-blue-50/90 dark:bg-white/10 hover:bg-blue-100/90 dark:hover:bg-white/15 rounded-xl transition border border-blue-200/60 dark:border-white/10 cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to Explorer</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Navigation size={13} />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Route Guide
              </span>
            </div>
          )}

          <div className="flex items-center gap-1">
            {onToggleMinimize && (
              <button
                type="button"
                onClick={onToggleMinimize}
                className="p-1.5 rounded-xl text-slate-400 dark:text-[#A1A1AA] hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#202025] transition cursor-pointer"
                title="Minimize directions"
                aria-label="Minimize directions"
              >
                <ChevronDown size={15} />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 dark:text-[#A1A1AA] hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#202025] transition cursor-pointer"
                aria-label="Close directions"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* ── Two-Phase Commuter Journey Tabs (Drive to Bay vs Bay to Train Station) ── */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 dark:bg-[#101013] border border-transparent dark:border-white/10 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              onChangeJourneyTab('drive');
              onFocusDrivingRoute?.();
            }}
            className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              journeyTab === 'drive'
                ? 'bg-white dark:bg-[#242429] text-blue-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Car size={13} />
            <span className="truncate">
              1. Drive to Bay {drivingRoute ? `(${drivingRoute.durationText})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onChangeJourneyTab('transit');
              onFocusTransitRoute?.();
            }}
            className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              journeyTab === 'transit'
                ? 'bg-white dark:bg-[#242429] text-emerald-800 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Train size={13} />
            <span className="truncate">
              2. Bay to Train {activeItinerary ? `(~${activeItinerary.totalDurationMinutes}m)` : ''}
            </span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PHASE 1: 🚗 DRIVE FROM CURRENT LOCATION TO PARKING BAY
         ══════════════════════════════════════════════════════════════ */}
      {journeyTab === 'drive' && (
        <div className="flex-1 flex flex-col min-h-0">
          {drivingRoute ? (
            <div className="p-3.5 space-y-3 overflow-y-auto no-scrollbar max-h-[380px]">
              {/* Origin ➔ Parking Bay Destination Corridor */}
              <div className="space-y-2 text-xs bg-slate-50/80 dark:bg-[#18181C] rounded-xl p-3 border border-slate-200/80 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0 ring-2 ring-blue-100" />
                  <span className="font-semibold text-slate-800 dark:text-white truncate">
                    {drivingRoute.origin.name || 'Your Current Location'}
                  </span>
                </div>
                <div className="pl-1 border-l-2 border-dashed border-slate-300 dark:border-white/20 ml-1 py-0.5" />
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <span className="w-4 h-4 rounded bg-emerald-600 text-white font-mono text-[10px] flex items-center justify-center font-bold shrink-0">
                    P
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-bold">{formatShortSpotName(drivingRoute.destination.name, 30)}</div>
                    {drivingRoute.destination.address && (
                      <div className="text-[10px] text-slate-500 dark:text-[#A1A1AA] font-normal truncate">
                        {formatShortAddress(drivingRoute.destination.address, 42)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Driving ETA & Distance Metric */}
              <div className="flex items-center justify-between p-2.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-blue-600 dark:text-[#3894FF]" />
                  <div>
                    <div className="text-base font-extrabold text-blue-950 dark:text-blue-200 leading-tight">
                      {drivingRoute.durationText}
                    </div>
                    <div className="text-[11px] text-blue-700 dark:text-[#3894FF] font-medium">
                      {drivingRoute.distanceText} driving distance
                    </div>
                  </div>
                </div>

                {onFocusDrivingRoute && (
                  <button
                    type="button"
                    onClick={onFocusDrivingRoute}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white dark:bg-[#242429] border border-blue-200 dark:border-white/14 text-blue-700 dark:text-white rounded-lg shadow-xs hover:bg-blue-100/50 dark:hover:bg-[#2C2C32] transition cursor-pointer"
                  >
                    Fit Map View
                  </button>
                )}
              </div>

              {/* Quick 1-Click External GPS Launchers (Google Maps & Waze) */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={drivingRoute.wazeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-[#18181C] hover:bg-slate-200 dark:hover:bg-[#202025] text-slate-800 dark:text-white border border-slate-200/80 dark:border-white/10 font-bold text-xs shadow-2xs transition"
                >
                  <Navigation size={13} className="text-cyan-600" />
                  <span>Open in Waze</span>
                  <ExternalLink size={11} className="text-slate-400 dark:text-[#A1A1AA]" />
                </a>

                <a
                  href={drivingRoute.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-[#18181C] hover:bg-slate-200 dark:hover:bg-[#202025] text-slate-800 dark:text-white border border-slate-200/80 dark:border-white/10 font-bold text-xs shadow-2xs transition"
                >
                  <Navigation size={13} className="text-blue-600" />
                  <span>Google Maps</span>
                  <ExternalLink size={11} className="text-slate-400 dark:text-[#A1A1AA]" />
                </a>
              </div>

              {/* Turn-by-Turn Driving Steps */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-bold text-slate-400 dark:text-[#71717A] uppercase tracking-wider px-1">
                  Turn-by-turn driving steps ({drivingRoute.steps.length})
                </div>

                <div className="space-y-1.5">
                  {drivingRoute.steps.map((st, sIdx) => (
                    <div
                      key={`drive-step-${sIdx}`}
                      className="p-2 bg-white dark:bg-[#18181C] rounded-xl border border-slate-200/80 dark:border-white/10 flex items-start gap-2.5 text-xs text-slate-800 dark:text-white shadow-2xs"
                    >
                      <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {sIdx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white leading-snug">
                          {st.instruction}
                        </div>
                        {st.streetName && (
                          <div className="text-[10px] text-slate-500 dark:text-[#A1A1AA] font-mono mt-0.5">
                            {st.streetName}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-[#A1A1AA] font-semibold shrink-0">
                        {st.distanceMeters >= 1000
                          ? `${(st.distanceMeters / 1000).toFixed(1)} km`
                          : `${st.distanceMeters} m`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Arrival at Parking Gate Confirmation */}
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between text-xs font-semibold text-emerald-950 dark:text-emerald-200">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">
                    ✓
                  </div>
                  <div>
                    <div className="font-bold">Park at Reserved Bay</div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-normal">
                      Use in-app Pass to lift barrier / park vehicle
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onChangeJourneyTab('transit');
                    onFocusTransitRoute?.();
                  }}
                  className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded-lg transition cursor-pointer"
                >
                  Next: Train Route ➔
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500 dark:text-[#A1A1AA] text-xs space-y-2">
              <Car className="w-8 h-8 text-slate-300 dark:text-[#71717A] mx-auto" />
              <p className="font-semibold text-slate-700 dark:text-white">Calculating driving route...</p>
              <p className="text-[11px] text-slate-400 dark:text-[#71717A]">
                Determining road network from your current location to the parking spot.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          PHASE 2: 🚶/🚌 PARKING BAY TO LRT/MRT STATION
         ══════════════════════════════════════════════════════════════ */}
      {journeyTab === 'transit' && activeItinerary && plan && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Origin (Passable Bay Exit) ➔ Station Entrance Header */}
          <div className="px-3 pt-2.5 pb-2 bg-slate-50/70 dark:bg-[#18181C] border-b border-slate-100 dark:border-white/10">
            <div className="space-y-1.5 text-xs bg-white dark:bg-[#141417] rounded-xl p-2.5 border border-slate-200/80 dark:border-white/10 shadow-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-[#E4E4E7]">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0 ring-2 ring-blue-100" />
                <span className="truncate font-medium text-slate-800 dark:text-white" title={plan.origin.exitName}>
                  {plan.origin.exitName}
                </span>
              </div>
              <div className="pl-1 border-l-2 border-dashed border-slate-200 dark:border-white/20 ml-1 py-0.5" />
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <Train className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate" title={activeItinerary.targetStationEntranceName}>
                  {activeItinerary.targetStationName}
                </span>
                <span className="ml-auto text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800/50">
                  {activeItinerary.targetStationEntranceName}
                </span>
              </div>
            </div>
          </div>

          {/* Preference Chips (Google Maps filters) */}
          {onChangePreference && (
            <div className="px-3 py-1.5 border-b border-slate-100 dark:border-white/10 bg-white dark:bg-[#141417] flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-[#71717A] uppercase tracking-wider mr-1">
                Preference:
              </span>
              <button
                type="button"
                onClick={() => onChangePreference('balanced')}
                className={`py-0.5 px-2 rounded-lg text-xs font-semibold transition border cursor-pointer ${
                  preference === 'balanced'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-[#18181C] text-slate-600 dark:text-[#A1A1AA] border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-[#202025]'
                }`}
              >
                Recommended
              </button>
              <button
                type="button"
                onClick={() => onChangePreference('less_walk')}
                className={`py-0.5 px-2 rounded-lg text-xs font-semibold transition border flex items-center gap-1 cursor-pointer ${
                  preference === 'less_walk'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-[#18181C] text-slate-600 dark:text-[#A1A1AA] border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-[#202025]'
                }`}
              >
                <Footprints size={11} />
                <span>Less Walk</span>
              </button>
              <button
                type="button"
                onClick={() => onChangePreference('fastest')}
                className={`py-0.5 px-2 rounded-lg text-xs font-semibold transition border flex items-center gap-1 cursor-pointer ${
                  preference === 'fastest'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-[#18181C] text-slate-600 dark:text-[#A1A1AA] border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-[#202025]'
                }`}
              >
                <Zap size={11} />
                <span>Fastest</span>
              </button>
            </div>
          )}

          {/* Route Choice Cards (If > 1 option) */}
          {plan.allItineraries.length > 1 && onSelectItinerary && (
            <div className="p-2 border-b border-slate-100 dark:border-white/10 bg-slate-50/60 dark:bg-[#18181C] grid grid-cols-2 gap-1.5 text-xs">
              {plan.allItineraries.map((it) => {
                const isSelected = it.id === activeItinerary.id;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      onSelectItinerary(it.id);
                      onFocusLeg?.(null);
                    }}
                    className={`p-2 rounded-xl text-left border transition-all relative cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/90 dark:bg-[#1E2430] border-blue-400 dark:border-[#0071E3] text-blue-950 dark:text-white shadow-xs ring-1 ring-blue-300 dark:ring-[#0071E3]/30'
                        : 'bg-white dark:bg-[#141417] border-slate-200 dark:border-white/10 text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-50 dark:hover:bg-[#202025]'
                    }`}
                  >
                    {it.isRecommended && (
                      <span className="absolute -top-1.5 right-2 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider shadow-xs">
                        Best
                      </span>
                    )}
                    <div className="flex items-center gap-1 font-bold text-xs text-slate-900 dark:text-white">
                      {it.type === 'transit_feeder' ? (
                        <Bus size={13} className="text-emerald-600" />
                      ) : (
                        <Footprints size={13} className="text-blue-600" />
                      )}
                      <span className="truncate">{it.title}</span>
                    </div>
                    <div className="text-[11px] font-bold text-slate-900 dark:text-white mt-0.5">
                      ~{it.totalDurationMinutes} min
                    </div>
                    <div className="text-[9px] text-slate-500 dark:text-[#A1A1AA]">
                      {it.totalWalkDistanceMeters}m walk
                    </div>
                    {it.savingsSummary && (
                      <div className="text-[9px] text-emerald-700 dark:text-emerald-400 font-bold mt-0.5 truncate">
                        ✓ {it.savingsSummary}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step-by-Step Directions */}
          <div className="p-3 overflow-y-auto no-scrollbar space-y-2 max-h-[300px]">
            {/* Origin Node */}
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#18181C] border border-slate-200/70 dark:border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white text-[11px]">Start: Parking Bay Exit</div>
                  <div className="text-[10px] text-slate-500 dark:text-[#A1A1AA]">{plan.origin.exitName}</div>
                </div>
              </div>
              <span className="text-[10px] bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full">
                Depart
              </span>
            </div>

            {activeItinerary.legs.map((leg, idx) => {
              const isFocused = focusedLegIndex === idx;
              const isExpanded = expandedLegIndex === idx;
              const isCompleted = focusedLegIndex !== null && idx < focusedLegIndex;

              return (
                <div
                  key={`leg-${idx}`}
                  className={`rounded-xl border transition-all ${
                    isFocused
                      ? 'bg-blue-50/40 dark:bg-[#1E2430] border-blue-500 dark:border-[#0071E3] shadow-sm'
                      : 'bg-white dark:bg-[#18181C] border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <div
                    onClick={() => {
                      onFocusLeg?.(idx);
                      setExpandedLegIndex(isExpanded ? null : idx);
                    }}
                    className="p-2.5 flex items-start gap-2.5 cursor-pointer"
                  >
                    <div className="flex flex-col items-center mt-0.5 shrink-0">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                          isCompleted
                            ? 'bg-emerald-500 text-white'
                            : isFocused
                            ? 'bg-blue-600 text-white shadow-xs'
                            : leg.mode === 'BUS'
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-[#E4E4E7] border border-slate-200 dark:border-white/10'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 size={13} />
                        ) : leg.mode === 'BUS' ? (
                          <Bus size={12} />
                        ) : (
                          idx + 1
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {leg.title}
                        </h4>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-[#A1A1AA] shrink-0">
                          ~{leg.durationMinutes} min ({leg.distanceMeters}m)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-[#A1A1AA] mt-0.5 leading-snug">
                        {leg.summary}
                      </p>

                      {/* Transit Feeder Bus Details */}
                      {leg.transitDetails && (
                        <div className="mt-2 p-2.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/50 text-[11px] space-y-1.5 overflow-hidden min-w-0">
                          {/* Route Badge & Line Header */}
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-md font-mono text-[10px] font-bold shrink-0 shadow-2xs">
                                {leg.transitDetails.routeShortName}
                              </span>
                              <span className="truncate font-bold text-emerald-950 dark:text-emerald-200 text-xs min-w-0">
                                Feeder to {activeItinerary.targetStationName || 'Station'}
                              </span>
                            </div>
                            <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-200/70 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full shrink-0">
                              {leg.transitDetails.numStops} stop{leg.transitDetails.numStops === 1 ? '' : 's'}
                            </span>
                          </div>

                          {/* Boarding ➔ Alighting Corridor */}
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800 dark:text-white min-w-0 overflow-hidden bg-white/80 dark:bg-[#141417] px-2 py-1.5 rounded-lg border border-emerald-200/70 dark:border-emerald-800/50">
                            <span className="truncate min-w-0 flex-1 text-slate-900 dark:text-white font-bold text-[10.5px]" title={leg.transitDetails.boardingStopName}>
                              {leg.transitDetails.boardingStopName}
                            </span>
                            <span className="text-emerald-600 font-bold shrink-0 px-0.5">➔</span>
                            <span className="truncate min-w-0 flex-1 text-right text-slate-900 dark:text-white font-bold text-[10.5px]" title={leg.transitDetails.alightingStopName}>
                              {leg.transitDetails.alightingStopName}
                            </span>
                          </div>

                          {/* Live vs Scheduled Vehicle */}
                          {leg.transitDetails.liveVehicle ? (
                            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-emerald-200/60 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-1 font-medium truncate min-w-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                <span className="truncate">Plate {leg.transitDetails.liveVehicle.licensePlate}</span>
                                <span className="shrink-0">({leg.transitDetails.liveVehicle.speedKmh} km/h)</span>
                              </div>
                              <strong className="font-bold shrink-0 ml-1">
                                ~{leg.transitDetails.liveVehicle.etaMinutes} min away
                              </strong>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500 dark:text-[#A1A1AA] pt-0.5 truncate min-w-0">
                              Scheduled Rapid KL Feeder Bus
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 dark:text-[#71717A] transition-transform shrink-0 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>

                  {isExpanded && leg.steps.length > 0 && (
                    <div className="px-3 pb-2.5 pt-1 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-[#141417]/50 space-y-1 text-[11px]">
                      {leg.steps.map((st, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-2 text-slate-700 dark:text-[#E4E4E7]">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-[#71717A] mt-1.5 shrink-0" />
                          <span className="flex-1 leading-tight">{st.instruction}</span>
                          {st.distanceMeters > 0 && (
                            <span className="text-[10px] text-slate-400 dark:text-[#71717A] shrink-0">
                              {st.distanceMeters}m
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Destination Arrival Pin */}
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between text-xs font-semibold text-emerald-950 dark:text-emerald-200">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Train size={12} />
                </div>
                <div>
                  <div className="font-bold">{activeItinerary.targetStationName}</div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-normal">
                    {activeItinerary.targetStationEntranceName} · Rail Platform Entrance
                  </div>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded-full font-bold">
                Arrival
              </span>
            </div>
          </div>

          {/* Stepper Navigation Actions */}
          <div className="p-2.5 border-t border-slate-100 dark:border-white/10 bg-white dark:bg-[#141417] flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => onFocusLeg?.(null)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/14 text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-50 dark:hover:bg-[#202025] font-semibold transition cursor-pointer"
            >
              Overview
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={currentStep <= 0}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/14 text-slate-700 dark:text-[#E4E4E7] hover:bg-slate-50 dark:hover:bg-[#202025] font-semibold transition disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                disabled={currentStep >= activeItinerary.legs.length - 1}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center gap-1 shadow-xs disabled:opacity-40 cursor-pointer"
              >
                <span>Next Step</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
