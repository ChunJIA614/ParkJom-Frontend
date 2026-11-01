import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  CloudRain,
  Sun,
  Train,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  getSpotCongestionForecast,
  buildFallbackCongestionForecast,
  type ParkingForecastResponse,
  type FallbackForecastParams,
} from '../api/predictionApi';

interface AiCongestionForecastCardProps {
  parkingSpotId: number | string;
  stationName?: string;
  routeName?: string;
  stopId?: string;
  targetName?: string;
  walkDistanceMeters?: number;
  dailyRate?: number;
  totalBays?: number;
  availableBays?: number;
}

export const AiCongestionForecastCard: React.FC<AiCongestionForecastCardProps> = ({
  parkingSpotId,
  stationName,
  routeName,
  stopId,
  targetName,
  walkDistanceMeters,
  dailyRate,
  totalBays,
  availableBays,
}) => {
  const fallbackParams: FallbackForecastParams = {
    parkingSpotId,
    stationName,
    routeName,
    stopId,
    targetName,
    walkDistanceMeters,
    dailyRate,
    totalBays,
    availableBays,
  };

  const [forecast, setForecast] = useState<ParkingForecastResponse>(() =>
    buildFallbackCongestionForecast(fallbackParams)
  );
  const [selectedHorizonIdx, setSelectedHorizonIdx] = useState<number>(1); // default +30m
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getSpotCongestionForecast(parkingSpotId, fallbackParams).then((data) => {
      if (active && data) {
        setForecast(data);
      }
    });
    return () => {
      active = false;
    };
  }, [parkingSpotId, stationName, walkDistanceMeters, dailyRate]);

  const activeHorizon =
    forecast.horizons[selectedHorizonIdx] ??
    forecast.horizons[0] ?? {
      horizonLabel: '+30m',
      offsetMinutes: 30,
      targetTime: '08:00 AM',
      predictedOccupancyPercent: forecast.predictedOccupancyPercent,
      probabilityFull: forecast.probabilityFull,
      riskLevel: forecast.riskLevel,
    };

  const inspectedCurvePoint =
    hoveredHour !== null
      ? forecast.hourlyCurve.find((p) => p.hour === hoveredHour)
      : forecast.hourlyCurve.find((p) => p.isCurrentHour) ?? forecast.hourlyCurve[2];

  const getRiskBadgeClasses = (risk: string) => {
    switch (risk) {
      case 'Critical':
      case 'High':
        return 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 border-rose-500/20';
      case 'Moderate':
        return 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border-amber-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-500/20';
    }
  };

  const getBarColorClasses = (risk: string, isPeak: boolean, isHovered: boolean) => {
    if (isHovered) return 'bg-[#007AFF] dark:bg-[#0A84FF]';
    if (risk === 'Critical' || risk === 'High') return 'bg-rose-500/85 dark:bg-rose-500/80';
    if (risk === 'Moderate' || isPeak) return 'bg-amber-500/80 dark:bg-amber-500/75';
    return 'bg-emerald-500/75 dark:bg-emerald-500/70';
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141417] p-4 sm:p-5 shadow-sm transition-all">
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-[#1C1C21] border border-slate-800 dark:border-white/10 flex items-center justify-center text-white shrink-0">
            <Sparkles className="w-4 h-4 text-[#0A84FF]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                AI Congestion &amp; Availability Forecast
              </h4>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getRiskBadgeClasses(
                  activeHorizon.riskLevel
                )}`}
              >
                {activeHorizon.riskLevel === 'Critical' || activeHorizon.riskLevel === 'High' ? (
                  <AlertTriangle className="w-3 h-3" />
                ) : (
                  <CheckCircle2 className="w-3 h-3" />
                )}
                {activeHorizon.riskLevel} Congestion Risk
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Train className="w-3 h-3 text-slate-400" />
                {forecast.transit.stationName} ({forecast.transit.frequencyMinutes}m headway)
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                {forecast.weather.isRaining || forecast.weather.rainProbability >= 50 ? (
                  <CloudRain className="w-3 h-3 text-sky-400" />
                ) : (
                  <Sun className="w-3 h-3 text-amber-400" />
                )}
                {forecast.weather.temperatureC.toFixed(1)}°C · {forecast.weather.condition}
              </span>
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Arrive Before
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-end gap-1">
            <Clock className="w-3.5 h-3.5 text-[#007AFF] dark:text-[#0A84FF]" />
            {forecast.recommendedArriveBefore}
          </div>
        </div>
      </div>

      {/* Headline AI Recommendation Banner */}
      <div className="mt-3.5 rounded-xl bg-slate-50 dark:bg-[#18181C] border border-slate-200/70 dark:border-white/10 px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        {forecast.recommendation}
      </div>

      {/* Multi-Horizon Selector Pills (+15m, +30m, +60m, 08:00 AM Peak) */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Forecast Horizon
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Target: <strong className="text-slate-800 dark:text-slate-200">{activeHorizon.targetTime}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {forecast.horizons.map((h, idx) => {
            const isSelected = idx === selectedHorizonIdx;
            return (
              <button
                key={h.horizonLabel}
                type="button"
                onClick={() => setSelectedHorizonIdx(idx)}
                className={`text-left rounded-xl p-2.5 border transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-[#1F1F26] dark:text-white dark:border-white/25 shadow-sm'
                    : 'bg-slate-50/70 dark:bg-[#18181C] text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] opacity-80">
                  <span className="font-semibold">{h.horizonLabel}</span>
                  <span>{h.targetTime}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-base font-bold tracking-tight">
                    {h.predictedOccupancyPercent}%
                  </span>
                  <span className="text-[10px] opacity-75">
                    P(Full) {Math.round(h.probabilityFull * 100)}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hourly Occupancy & Congestion Curve (06:00 - 22:00) */}
      <div className="mt-4 rounded-xl bg-slate-50/70 dark:bg-[#18181C] border border-slate-200/70 dark:border-white/10 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Hourly Park-and-Ride Demand Curve (06:00 – 22:00)
            </span>
          </div>
          {inspectedCurvePoint && (
            <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
              <span className="font-bold text-slate-900 dark:text-white">
                {inspectedCurvePoint.timeLabel}
              </span>
              : {inspectedCurvePoint.predictedOccupancyPercent}% est. occupancy ·{' '}
              {Math.round(inspectedCurvePoint.probabilityFull * 100)}% full prob
            </div>
          )}
        </div>

        <div className="h-24 flex items-end gap-1 pt-2">
          {forecast.hourlyCurve.map((pt) => {
            const isHovered = hoveredHour === pt.hour;
            const heightPct = Math.max(12, Math.min(100, pt.predictedOccupancyPercent));
            return (
              <div
                key={pt.hour}
                onMouseEnter={() => setHoveredHour(pt.hour)}
                onMouseLeave={() => setHoveredHour(null)}
                className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
              >
                <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {pt.predictedOccupancyPercent}%
                </div>
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`w-full rounded-t-md transition-all ${getBarColorClasses(
                    pt.riskLevel,
                    pt.isPeakWindow,
                    isHovered
                  )} ${pt.isCurrentHour ? 'ring-1 ring-slate-900 dark:ring-white' : ''}`}
                />
                <span
                  className={`mt-1 text-[9px] ${
                    pt.hour % 3 === 0 || pt.isCurrentHour
                      ? 'text-slate-600 dark:text-slate-400 font-medium'
                      : 'text-transparent sm:text-slate-400/60 dark:sm:text-slate-500/60'
                  }`}
                >
                  {pt.hour}h
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Factors Influencing Availability */}
      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
          Key Factors Influencing Availability
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {forecast.riskFactors.map((factor, idx) => (
            <div
              key={idx}
              className="rounded-xl bg-slate-50/70 dark:bg-[#18181C] border border-slate-200/70 dark:border-white/10 px-3 py-2 flex items-start justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {factor.label}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                  {factor.description}
                </p>
              </div>
              <span
                className={`shrink-0 inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                  factor.direction === 'up'
                    ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                    : factor.direction === 'down'
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                      : 'text-slate-500 dark:text-slate-400 bg-slate-500/10'
                }`}
              >
                {factor.direction === 'up' ? (
                  <TrendingUp className="w-3 h-3" />
                ) : factor.direction === 'down' ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                {factor.impact}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
