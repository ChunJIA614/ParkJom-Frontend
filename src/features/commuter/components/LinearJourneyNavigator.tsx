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
        className={`bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl px-4 py-2.5 flex items-center justify-between gap-3 text-slate-800 ${className}`}
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
            <div className="text-xs font-bold text-slate-900 truncate">
              {isDriveTab
                ? `Drive to ${formatShortSpotName(drivingRoute.destination.name)}`
                : `To ${formatShortSpotName(activeItinerary?.targetStationName || 'Station')}`}
            </div>
            <div className="text-[11px] text-blue-700 font-semibold flex items-center gap-1.5">
              <span>
                {isDriveTab
                  ? drivingRoute.durationText
                  : `~${activeItinerary?.totalDurationMinutes || 0} min`}
              </span>
              <span>·</span>
              <span className="text-slate-500">
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
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition flex items-center gap-1"
            >
              <span>Steps</span>
              <ChevronUp size={13} />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
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
      className={`linear-journey-navigator bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden flex flex-col text-slate-800 max-h-full ${className}`}
    >
      {/* ── Top Header: Navigation Corridor & Back Trigger ── */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/90">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50/90 hover:bg-blue-100/90 rounded-xl transition border border-blue-200/60"
            >
              <ArrowLeft size={13} />
              <span>Back to Explorer</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Navigation size={13} />
              </div>
              <span className="text-xs font-bold text-slate-900">
                Route Guide
              </span>
            </div>
          )}

          <div className="flex items-center gap-1">
            {onToggleMinimize && (
              <button
                type="button"
                onClick={onToggleMinimize}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
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
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                aria-label="Close directions"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* ── Two-Phase Commuter Journey Tabs (Drive to Bay vs Bay to Train Station) ── */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              onChangeJourneyTab('drive');
              onFocusDrivingRoute?.();
            }}
            className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              journeyTab === 'drive'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
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
            className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              journeyTab === 'transit'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
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
              <div className="space-y-2 text-xs bg-slate-50/80 rounded-xl p-3 border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0 ring-2 ring-blue-100" />
                  <span className="font-semibold text-slate-800 truncate">
                    {drivingRoute.origin.name || 'Your Current Location'}
                  </span>
                </div>
                <div className="pl-1 border-l-2 border-dashed border-slate-300 ml-1 py-0.5" />
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span className="w-4 h-4 rounded bg-emerald-600 text-white font-mono text-[10px] flex items-center justify-center font-bold shrink-0">
                    P
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-bold">{formatShortSpotName(drivingRoute.destination.name, 30)}</div>
                    {drivingRoute.destination.address && (
                      <div className="text-[10px] text-slate-500 font-normal truncate">
                        {formatShortAddress(drivingRoute.destination.address, 42)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Driving ETA & Distance Metric */}
              <div className="flex items-center justify-between p-2.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="text-base font-extrabold text-blue-950 leading-tight">
                      {drivingRoute.durationText}
                    </div>
                    <div className="text-[11px] text-blue-700 font-medium">
                      {drivingRoute.distanceText} driving distance
                    </div>
                  </div>
                </div>

                {onFocusDrivingRoute && (
                  <button
                    type="button"
                    onClick={onFocusDrivingRoute}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-blue-200 text-blue-700 rounded-lg shadow-xs hover:bg-blue-100/50 transition"
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
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 font-bold text-xs shadow-2xs transition"
                >
                  <Navigation size={13} className="text-cyan-600" />
                  <span>Open in Waze</span>
                  <ExternalLink size={11} className="text-slate-400" />
                </a>

                <a
                  href={drivingRoute.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 font-bold text-xs shadow-2xs transition"
                >
                  <Navigation size={13} className="text-blue-600" />
                  <span>Google Maps</span>
                  <ExternalLink size={11} className="text-slate-400" />
                </a>
              </div>

              {/* Turn-by-Turn Driving Steps */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Turn-by-turn driving steps ({drivingRoute.steps.length})
                </div>

                <div className="space-y-1.5">
                  {drivingRoute.steps.map((st, sIdx) => (
                    <div
                      key={`drive-step-${sIdx}`}
                      className="p-2 bg-white rounded-xl border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-800 shadow-2xs"
                    >
                      <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {sIdx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 leading-snug">
                          {st.instruction}
                        </div>
                        {st.streetName && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {st.streetName}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-semibold shrink-0">
                        {st.distanceMeters >= 1000
                          ? `${(st.distanceMeters / 1000).toFixed(1)} km`
                          : `${st.distanceMeters} m`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Arrival at Parking Gate Confirmation */}
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs font-semibold text-emerald-950">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">
                    ✓
                  </div>
                  <div>
                    <div className="font-bold">Park at Reserved Bay</div>
                    <div className="text-[10px] text-emerald-700 font-normal">
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
                  className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded-lg transition"
                >
                  Next: Train Route ➔
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500 text-xs space-y-2">
              <Car className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">Calculating driving route...</p>
              <p className="text-[11px] text-slate-400">
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
          <div className="px-3 pt-2.5 pb-2 bg-slate-50/70 border-b border-slate-100">
            <div className="space-y-1.5 text-xs bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0 ring-2 ring-blue-100" />
                <span className="truncate font-medium text-slate-800" title={plan.origin.exitName}>
                  {plan.origin.exitName}
                </span>
              </div>
              <div className="pl-1 border-l-2 border-dashed border-slate-200 ml-1 py-0.5" />
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Train className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate" title={activeItinerary.targetStationEntranceName}>
                  {activeItinerary.targetStationName}
                </span>
                <span className="ml-auto text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  {activeItinerary.targetStationEntranceName}
                </span>
              </div>
            </div>
          </div>

          {/* Preference Chips (Google Maps filters) */}
          {onChangePreference && (
            <div className="px-3 py-1.5 border-b border-slate-100 bg-white flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Preference:
              </span>
              <button
                type="button"
                onClick={() => onChangePreference('balanced')}
                className={`py-0.5 px-2 rounded-lg text-xs font-semibold transition border ${
                  preference === 'balanced'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Recommended
              </button>
              <button
                type="button"
                onClick={() => onChangePreference('less_walk')}
                className={`py-0.5 px-2 rounded-lg text-xs font-semibold transition border flex items-center gap-1 ${
                  preference === 'less_walk'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Footprints size={11} />
                <span>Less Walk</span>
              </button>
              <button
                type="button"
                onClick={() => onChangePreference('fastest')}
                className={`py-0.5 px-2 rounded-lg text-xs font-semibold transition border flex items-center gap-1 ${
                  preference === 'fastest'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Zap size={11} />
                <span>Fastest</span>
              </button>
            </div>
          )}

          {/* Route Choice Cards (If > 1 option) */}
          {plan.allItineraries.length > 1 && onSelectItinerary && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/60 grid grid-cols-2 gap-1.5 text-xs">
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
                    className={`p-2 rounded-xl text-left border transition-all relative ${
                      isSelected
                        ? 'bg-blue-50/90 border-blue-400 text-blue-950 shadow-xs ring-1 ring-blue-300'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {it.isRecommended && (
                      <span className="absolute -top-1.5 right-2 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider shadow-xs">
                        Best
                      </span>
                    )}
                    <div className="flex items-center gap-1 font-bold text-xs text-slate-900">
                      {it.type === 'transit_feeder' ? (
                        <Bus size={13} className="text-emerald-600" />
                      ) : (
                        <Footprints size={13} className="text-blue-600" />
                      )}
                      <span className="truncate">{it.title}</span>
                    </div>
                    <div className="text-[11px] font-bold text-slate-900 mt-0.5">
                      ~{it.totalDurationMinutes} min
                    </div>
                    <div className="text-[9px] text-slate-500">
                      {it.totalWalkDistanceMeters}m walk
                    </div>
                    {it.savingsSummary && (
                      <div className="text-[9px] text-emerald-700 font-bold mt-0.5 truncate">
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
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                <div>
                  <div className="font-bold text-slate-900 text-[11px]">Start: Parking Bay Exit</div>
                  <div className="text-[10px] text-slate-500">{plan.origin.exitName}</div>
                </div>
              </div>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
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
                      ? 'bg-blue-50/40 border-blue-500 shadow-sm'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
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
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
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
                        <h4 className="font-bold text-xs text-slate-900 truncate">
                          {leg.title}
                        </h4>
                        <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                          ~{leg.durationMinutes} min ({leg.distanceMeters}m)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                        {leg.summary}
                      </p>

                      {/* Transit Feeder Bus Details */}
                      {leg.transitDetails && (
                        <div className="mt-2 p-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200/90 text-[11px] space-y-1.5 overflow-hidden min-w-0">
                          {/* Route Badge & Line Header */}
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-md font-mono text-[10px] font-bold shrink-0 shadow-2xs">
                                {leg.transitDetails.routeShortName}
                              </span>
                              <span className="truncate font-bold text-emerald-950 text-xs min-w-0">
                                Feeder to {activeItinerary.targetStationName || 'Station'}
                              </span>
                            </div>
                            <span className="text-[10px] text-emerald-800 font-bold bg-emerald-200/70 px-2 py-0.5 rounded-full shrink-0">
                              {leg.transitDetails.numStops} stop{leg.transitDetails.numStops === 1 ? '' : 's'}
                            </span>
                          </div>

                          {/* Boarding ➔ Alighting Corridor */}
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800 min-w-0 overflow-hidden bg-white/80 px-2 py-1.5 rounded-lg border border-emerald-200/70">
                            <span className="truncate min-w-0 flex-1 text-slate-900 font-bold text-[10.5px]" title={leg.transitDetails.boardingStopName}>
                              {leg.transitDetails.boardingStopName}
                            </span>
                            <span className="text-emerald-600 font-bold shrink-0 px-0.5">➔</span>
                            <span className="truncate min-w-0 flex-1 text-right text-slate-900 font-bold text-[10.5px]" title={leg.transitDetails.alightingStopName}>
                              {leg.transitDetails.alightingStopName}
                            </span>
                          </div>

                          {/* Live vs Scheduled Vehicle */}
                          {leg.transitDetails.liveVehicle ? (
                            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-emerald-200/60 text-emerald-800 min-w-0 overflow-hidden">
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
                            <div className="text-[10px] text-slate-500 pt-0.5 truncate min-w-0">
                              Scheduled Rapid KL Feeder Bus
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>

                  {isExpanded && leg.steps.length > 0 && (
                    <div className="px-3 pb-2.5 pt-1 border-t border-slate-100 bg-slate-50/50 space-y-1 text-[11px]">
                      {leg.steps.map((st, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-2 text-slate-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                          <span className="flex-1 leading-tight">{st.instruction}</span>
                          {st.distanceMeters > 0 && (
                            <span className="text-[10px] text-slate-400 shrink-0">
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
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs font-semibold text-emerald-950">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Train size={12} />
                </div>
                <div>
                  <div className="font-bold">{activeItinerary.targetStationName}</div>
                  <div className="text-[10px] text-emerald-700 font-normal">
                    {activeItinerary.targetStationEntranceName} · Rail Platform Entrance
                  </div>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                Arrival
              </span>
            </div>
          </div>

          {/* Stepper Navigation Actions */}
          <div className="p-2.5 border-t border-slate-100 bg-white flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => onFocusLeg?.(null)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition"
            >
              Overview
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={currentStep <= 0}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold transition disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                disabled={currentStep >= activeItinerary.legs.length - 1}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center gap-1 shadow-xs disabled:opacity-40"
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
