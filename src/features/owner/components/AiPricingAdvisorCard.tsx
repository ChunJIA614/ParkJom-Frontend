import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  TrendingUp,
  CheckCircle2,
  BarChart3,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import type { SpotPricingRecommendation } from '../api/dynamicPricingApi';

interface AiPricingAdvisorCardProps {
  recommendation: SpotPricingRecommendation;
  onApplyRates?: (dailyRate: number, monthlyRate: number) => void;
  isApplying?: boolean;
  appliedNotice?: string | null;
}

export default function AiPricingAdvisorCard({
  recommendation,
  onApplyRates,
  isApplying = false,
  appliedNotice = null,
}: AiPricingAdvisorCardProps) {
  const [showCurve, setShowCurve] = useState(false);
  const [open, setOpen] = useState(false);

  const maxCurveRevenue = Math.max(
    1,
    ...recommendation.revenueCurve.map((c) => c.projectedMonthlyNetRevenueRm),
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) setShowCurve(false);
      }}
    >
      <Dialog.Trigger className="workspace-button workspace-button--secondary ml-auto shrink-0">
        <TrendingUp className="size-4 text-blue-600 dark:text-blue-300" aria-hidden="true" />
        Suggested pricing
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[1350] bg-slate-950/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[1360] max-h-[min(80dvh,42rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#141417] sm:p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--parkjom-action-soft)] text-primary" aria-hidden="true">
              <TrendingUp className="size-4" />
            </span>
            <Dialog.Title className="min-w-0 flex-1 text-sm font-semibold text-slate-900 dark:text-white">Suggested pricing</Dialog.Title>
            <Dialog.Close aria-label="Close pricing suggestion" className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl bg-muted p-3.5">
              <Dialog.Description className="text-sm leading-relaxed">
                {recommendation.headlineSuggestion}
              </Dialog.Description>
              {appliedNotice && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {appliedNotice}
                </p>
              )}
            </div>

            <dl className="divide-y divide-border">
              <div className="space-y-1 py-3">
                <dt className="text-sm text-muted-foreground">Suggested rates</dt>
                <dd className="font-semibold tabular-nums">
                  RM {recommendation.recommendedDailyRateRm.toFixed(2)} / day
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    RM {recommendation.recommendedMonthlyRateRm.toFixed(0)} / month
                  </span>
                </dd>
                <dd className="text-sm text-muted-foreground">Off-peak: RM {recommendation.recommendedOffPeakHourlyRm.toFixed(2)} / hr</dd>
              </div>
              <div className="space-y-1 py-3">
                <dt className="text-sm text-muted-foreground">Estimated occupancy</dt>
                <dd className="font-semibold tabular-nums">
                  {recommendation.projectedOccupancyOptimalPercent}%
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {recommendation.occupancyDeltaPercent > 0 ? '+' : ''}{recommendation.occupancyDeltaPercent} percentage points
                  </span>
                </dd>
                <dd className="text-sm text-muted-foreground">Station median: RM {recommendation.stationMarketMedianDailyRm.toFixed(2)} / day</dd>
              </div>
              <div className="space-y-1 py-3">
                <dt className="text-sm text-muted-foreground">Estimated net earnings after fees</dt>
                <dd className="font-semibold tabular-nums">
                  RM {recommendation.projectedMonthlyNetRevenueRm.toFixed(0)} / month
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {recommendation.extraMonthlyRevenueRm >= 0 ? '+' : '−'}RM {Math.abs(recommendation.extraMonthlyRevenueRm).toFixed(0)} / month
                  </span>
                </dd>
              </div>
            </dl>

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
                  className="workspace-button workspace-button--primary"
                >
                  {isApplying ? 'Applying…' : 'Use suggested rates'}
                </Dialog.Close>
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
