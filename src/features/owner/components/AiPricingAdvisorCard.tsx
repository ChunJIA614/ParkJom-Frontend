import React, { useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
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
  LoaderCircle,
  X,
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
  const [showCurve, setShowCurve] = useState(false);
  const [disclosure, setDisclosure] = useState<'closed' | 'loading' | 'open'>('closed');

  useEffect(() => {
    if (disclosure !== 'loading') return;
    const timer = window.setTimeout(() => setDisclosure('open'), 500);
    return () => window.clearTimeout(timer);
  }, [disclosure]);

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
    <Dialog.Root
      open={disclosure !== 'closed'}
      onOpenChange={(open) => {
        setDisclosure(open ? 'loading' : 'closed');
        if (!open) setShowCurve(false);
      }}
    >
      <Dialog.Trigger className="ml-auto inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:hover:bg-white/10">
        <Sparkles className="size-4 text-blue-600 dark:text-blue-300" aria-hidden="true" />
        AI suggested pricing
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate-950/35" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[60] max-h-[min(80dvh,42rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#141417] sm:p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-100 to-sky-50 text-indigo-700 dark:border-indigo-300/20 dark:from-indigo-400/20 dark:to-sky-400/10 dark:text-indigo-200" aria-hidden="true">
              <Sparkles className="size-4" />
            </span>
            <Dialog.Title className="min-w-0 flex-1 text-sm font-semibold text-slate-900 dark:text-white">AI suggested pricing</Dialog.Title>
            <Dialog.Close aria-label="Close pricing suggestion" className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          {disclosure === 'loading' ? (
            <div role="status" className="flex min-h-28 items-center justify-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <LoaderCircle className="size-4 text-blue-600 motion-safe:animate-spin dark:text-blue-300" aria-hidden="true" />
              Loading suggestion…
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-blue-200/70 dark:border-white/10 bg-white dark:bg-[#141417] p-3.5">
                <Dialog.Description className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 sm:text-[13px]">
                  {recommendation.headlineSuggestion}
                </Dialog.Description>
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
                    Suggested rates
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
                    Off-peak: <strong>RM {recommendation.recommendedOffPeakHourlyRm.toFixed(2)}/hr</strong>
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141417] p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Estimated occupancy
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
                    Estimated net earnings
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
                    After platform fees
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
                      ? 'Hide rate comparison'
                      : 'Compare daily rates'}
                  </span>
                  {showCurve ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {showCurve && (
                  <div className="mt-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141417] p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Estimated monthly earnings by daily rate
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-blue-600" /> Suggested rate
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-amber-500" /> Current rate
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
                      {recommendation.factors.length > 0 && (
                        <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">What the AI considered</p>
                      )}
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
              {onApplyRates && (
                <div className="flex justify-end">
                  <Dialog.Close
                    disabled={isApplying}
                    onClick={() => onApplyRates(recommendation.recommendedDailyRateRm, recommendation.recommendedMonthlyRateRm)}
                    className="inline-flex min-h-9 items-center rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isApplying ? 'Applying…' : 'Use suggested rates'}
                  </Dialog.Close>
                </div>
              )}
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
