import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  CheckCircle2,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Zap,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import type { SpotPricingRecommendation } from '../api/dynamicPricingApi';

interface AiPricingAdvisorCardProps {
  recommendation: SpotPricingRecommendation;
  variant?: 'detailed' | 'compact';
  onApplyRates?: (dailyRate: number, monthlyRate: number) => void;
  onOpenSetup?: () => void;
  isApplying?: boolean;
  appliedNotice?: string | null;
}

export default function AiPricingAdvisorCard({
  recommendation,
  variant = 'detailed',
  onApplyRates,
  onOpenSetup,
  isApplying = false,
  appliedNotice = null,
}: AiPricingAdvisorCardProps) {
  const [showCurve, setShowCurve] = useState(variant === 'detailed');

  const strategyColor =
    recommendation.strategyTag === 'Boost Occupancy'
      ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-blue-300'
      : recommendation.strategyTag === 'Event Surge Opportunity' ||
        recommendation.strategyTag === 'Capture Peak Demand'
      ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300';

  if (variant === 'compact') {
    return (
      <div className="mt-3 rounded-xl border border-blue-200/80 dark:border-white/10 bg-[#f8faff] dark:bg-black p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
            <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            AI Pricing Suggestion
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${strategyColor}`}>
            {recommendation.strategyTag}
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-200">
          {recommendation.headlineSuggestion}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            <span>
              Optimal: <strong className="text-slate-900 dark:text-white">RM {recommendation.recommendedDailyRateRm.toFixed(2)}/day</strong>
            </span>
            <span>·</span>
            <span>
              Off-Peak (11am–4pm): <strong className="text-slate-900 dark:text-white">RM {recommendation.recommendedOffPeakHourlyRm.toFixed(2)}/hr</strong>
            </span>
          </div>

          {onApplyRates ? (
            <button
              type="button"
              disabled={isApplying}
              onClick={() =>
                onApplyRates(
                  recommendation.recommendedDailyRateRm,
                  recommendation.recommendedMonthlyRateRm,
                )
              }
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-2.5 py-1 text-[10px] font-bold text-white transition cursor-pointer disabled:opacity-50"
            >
              <Zap className="h-3 w-3" />
              {isApplying
                ? 'Applying…'
                : `Apply RM ${recommendation.recommendedDailyRateRm.toFixed(2)}/day`}
            </button>
          ) : onOpenSetup ? (
            <button
              type="button"
              onClick={onOpenSetup}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-2.5 py-1 text-[10px] font-bold text-white transition cursor-pointer"
            >
              <Zap className="h-3 w-3" />
              Adjust Rates
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const maxCurveRevenue = Math.max(
    1,
    ...recommendation.revenueCurve.map((c) => c.projectedMonthlyNetRevenueRm),
  );

  return (
    <div className="rounded-2xl border border-blue-200/90 dark:border-white/10 bg-[#f8faff] dark:bg-black p-4 sm:p-5 space-y-4 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-slate-950 dark:text-white">
                AI Dynamic Pricing &amp; Elasticity Advisor
              </h4>
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${strategyColor}`}>
                {recommendation.strategyTag}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Calibrated for {recommendation.stationName} · {Math.round(recommendation.distanceToStationKm * 1000)}m walk ({recommendation.timeToStationMinutes} min)
            </p>
          </div>
        </div>

        {onApplyRates && (
          <button
            type="button"
            disabled={isApplying}
            onClick={() =>
              onApplyRates(
                recommendation.recommendedDailyRateRm,
                recommendation.recommendedMonthlyRateRm,
              )
            }
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50 self-start sm:self-auto"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>
              {isApplying
                ? 'Applying…'
                : `Apply Optimal (RM ${recommendation.recommendedDailyRateRm.toFixed(2)}/d · RM ${recommendation.recommendedMonthlyRateRm.toFixed(0)}/mo)`}
            </span>
          </button>
        )}
      </div>

      {/* Headline Quote Box */}
      <div className="rounded-xl border border-blue-200/70 dark:border-white/10 bg-white dark:bg-[#141417] p-3.5">
        <p className="text-xs sm:text-[13px] font-semibold leading-relaxed text-slate-900 dark:text-white">
          “{recommendation.headlineSuggestion}”
        </p>
        {appliedNotice && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {appliedNotice}
          </p>
        )}
      </div>

      {/* 3 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141417] p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            AI Optimal Rates
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
              RM {recommendation.recommendedDailyRateRm.toFixed(2)}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              / day · RM {recommendation.recommendedMonthlyRateRm.toFixed(0)}/mo
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            Off-peak (11 AM – 4 PM): <strong>RM {recommendation.recommendedOffPeakHourlyRm.toFixed(2)}/hr</strong>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141417] p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Projected Bay Occupancy
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
              {recommendation.projectedOccupancyOptimalPercent}%
            </span>
            <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              <ArrowUpRight className="h-3 w-3" />+{Math.max(12, recommendation.occupancyDeltaPercent)}% uplift
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            Station median rate: <strong>RM {recommendation.stationMarketMedianDailyRm.toFixed(2)}/day</strong>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141417] p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Projected Net Revenue
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-slate-900 dark:text-white">
              RM {recommendation.projectedMonthlyNetRevenueRm.toFixed(0)}
              <span className="text-xs font-semibold text-slate-500">/mo</span>
            </span>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              (+RM {recommendation.extraMonthlyRevenueRm.toFixed(0)}/mo)
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            Net after platform fee · ε = {recommendation.priceElasticity.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Expandable Price Elasticity & Revenue Curve */}
      <div>
        <button
          type="button"
          onClick={() => setShowCurve((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>
            {showCurve
              ? 'Hide Price Elasticity & Revenue Simulation Curve'
              : 'Show Price Elasticity & Revenue Simulation Curve'}
          </span>
          {showCurve ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showCurve && (
          <div className="mt-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141417] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Simulated Monthly Net Revenue vs. Daily Rate (RM 4 – RM 18)
              </span>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-600" /> AI Optimal Rate
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Current Input Rate
                </span>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1 items-end h-28 pt-4 px-1">
              {recommendation.revenueCurve.map((pt) => {
                const heightPct = Math.max(
                  12,
                  Math.round((pt.projectedMonthlyNetRevenueRm / maxCurveRevenue) * 100),
                );
                const barClass = pt.isRecommended
                  ? 'bg-blue-600 dark:bg-blue-500'
                  : pt.isCurrent
                  ? 'bg-amber-500'
                  : 'bg-slate-200 dark:bg-white/15 hover:bg-blue-300';

                return (
                  <div
                    key={pt.dailyRateRm}
                    className="flex flex-col items-center justify-end h-full group relative"
                    title={`RM ${pt.dailyRateRm}/day → ${pt.projectedOccupancyPercent}% occupancy · RM ${pt.projectedMonthlyNetRevenueRm.toFixed(0)}/month`}
                  >
                    <span className="mb-1 text-[8px] font-mono font-bold text-slate-500 dark:text-slate-400">
                      {pt.projectedOccupancyPercent}%
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-all ${barClass}`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span
                      className={`mt-1 text-[9px] font-mono ${
                        pt.isRecommended
                          ? 'font-extrabold text-blue-600 dark:text-blue-400'
                          : pt.isCurrent
                          ? 'font-bold text-amber-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {pt.dailyRateRm}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Factors List */}
            <div className="border-t border-slate-100 dark:border-white/10 pt-2.5 space-y-1">
              {recommendation.factors.map((factor, idx) => (
                <p
                  key={idx}
                  className="flex items-start gap-1.5 text-[10px] text-slate-600 dark:text-slate-300"
                >
                  <TrendingUp className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <span>{factor}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
