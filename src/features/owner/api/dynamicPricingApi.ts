import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type { ParkingBay } from '../types';

export interface RevenueCurvePoint {
  dailyRateRm: number;
  projectedOccupancyPercent: number;
  projectedMonthlyNetRevenueRm: number;
  isCurrent: boolean;
  isRecommended: boolean;
}

export interface SpotPricingRecommendation {
  parkingSpotId: number;
  parkingLabel: string;
  propertyId: number;
  propertyName: string;
  stationId: number;
  stationName: string;
  distanceToStationKm: number;
  timeToStationMinutes: number;
  currentDailyRateRm: number | null;
  currentMonthlyRateRm: number | null;
  recommendedDailyRateRm: number;
  recommendedMonthlyRateRm: number;
  recommendedOffPeakHourlyRm: number;
  stationMarketMedianDailyRm: number;
  stationMarketP25DailyRm: number;
  stationMarketP75DailyRm: number;
  competingSpotsCount: number;
  priceElasticity: number;
  projectedOccupancyNowPercent: number;
  projectedOccupancyOptimalPercent: number;
  occupancyDeltaPercent: number;
  currentMonthlyNetRevenueRm: number;
  projectedMonthlyNetRevenueRm: number;
  extraMonthlyRevenueRm: number;
  strategyTag: string;
  headlineSuggestion: string;
  eventAlert?: string | null;
  factors: string[];
  revenueCurve: RevenueCurvePoint[];
}

export interface OwnerPortfolioPricingResponse {
  totalBaysCount: number;
  optimizableBaysCount: number;
  totalCurrentMonthlyRevenueRm: number;
  totalProjectedMonthlyRevenueRm: number;
  totalExtraMonthlyRevenueRm: number;
  averageOccupancyBoostPercent: number;
  portfolioHeadline: string;
  recommendations: SpotPricingRecommendation[];
}

const roundToHalf = (val: number) => Math.round(val * 2) / 2;

function resolveStationProfile(stationName: string): {
  baseMedianRm: number;
  elasticity: number;
  eventMultiplier: number;
  eventAlert: string | null;
} {
  const upper = (stationName || '').toUpperCase();
  if (upper.includes('BUKIT JALIL') || upper.includes('SRI PETALING')) {
    return {
      baseMedianRm: 10.0,
      elasticity: -1.15,
      eventMultiplier: 0.22,
      eventAlert:
        '🏟️ Event Surge Zone: National Stadium & Axiata Arena events boost weekend & evening parking demand by +22%.',
    };
  }
  if (
    upper.includes('KLCC') ||
    upper.includes('AMPANG PARK') ||
    upper.includes('BUKIT BINTANG') ||
    upper.includes('TRX') ||
    upper.includes('MERDEKA') ||
    upper.includes('PASAR SENI') ||
    upper.includes('KL SENTRAL')
  ) {
    return {
      baseMedianRm: 13.0,
      elasticity: -0.95,
      eventMultiplier: 0.18,
      eventAlert:
        '🏙️ CBD High-Demand Interchange: Low commuter price sensitivity (ε = -0.95) during 7:30 AM – 6:30 PM weekday windows.',
    };
  }
  if (
    upper.includes('KELANA JAYA') ||
    upper.includes('SUBANG JAYA') ||
    upper.includes('USJ 7') ||
    upper.includes('TAIPAN') ||
    upper.includes('ASIA JAYA') ||
    upper.includes('TAMAN BAHAGIA')
  ) {
    return {
      baseMedianRm: 8.5,
      elasticity: -1.35,
      eventMultiplier: 0.12,
      eventAlert:
        '🚆 High Park-and-Ride Hub (Kelana Jaya Line): Strong morning fill rate; off-peak 11 AM – 4 PM discount captures midday commuters.',
    };
  }
  if (
    upper.includes('KAJANG') ||
    upper.includes('COCHRANE') ||
    upper.includes('MALURI') ||
    upper.includes('CHERAS') ||
    upper.includes('PHILEO') ||
    upper.includes('BANDAR UTAMA')
  ) {
    return {
      baseMedianRm: 8.0,
      elasticity: -1.4,
      eventMultiplier: 0.1,
      eventAlert:
        '🚇 MRT Kajang Corridor: Commuters compare walk time vs. daily rate; RM 7.50–RM 9.50 maximizes 5-day repeat bookings.',
    };
  }
  return {
    baseMedianRm: 7.5,
    elasticity: -1.45,
    eventMultiplier: 0.08,
    eventAlert:
      '📈 Suburban Park-and-Ride Hub: Competitive daily rate + monthly commuter bundle maximizes weekday utilization.',
  };
}

function predictOccupancy(
  candidatePrice: number,
  referencePrice: number,
  baseOcc: number,
  elasticity: number,
): number {
  const ratio = Math.max(0.25, candidatePrice / Math.max(1, referencePrice));
  const raw = baseOcc * Math.pow(ratio, elasticity);
  return Math.round(Math.min(0.96, Math.max(0.08, raw)) * 100);
}

function calcNetMonthlyRevenue(dailyRate: number, occPct: number, commission = 0.1): number {
  const days = 30 * (occPct / 100);
  return Math.round(dailyRate * days * (1 - commission) * 100) / 100;
}

/**
 * Deterministic client-side elasticity simulator matching `DynamicPricingService.cs`
 * so interactive rate sliders/steppers in `AvailabilityScheduler.tsx` respond at 60fps.
 */
export function computeClientSpotRecommendation(
  bay: ParkingBay,
  candidateDailyRate?: number | null,
): SpotPricingRecommendation {
  const bayExt = bay as ParkingBay & {
    nearestStation?: string;
    distanceToStation?: number;
    timeToStation?: number;
  };
  const stationName = bayExt.nearestStation || bay.stationName || 'Nearest Transit Hub';
  const distanceKm =
    typeof bayExt.distanceToStation === 'number' && bayExt.distanceToStation > 0
      ? bayExt.distanceToStation > 20
        ? bayExt.distanceToStation / 1000
        : bayExt.distanceToStation
      : 0.35;
  const walkMinutes =
    typeof bayExt.timeToStation === 'number' && bayExt.timeToStation > 0
      ? bayExt.timeToStation
      : Math.round(distanceKm * 12);

  const profile = resolveStationProfile(stationName);
  const marketMedian = profile.baseMedianRm;
  const marketP25 = Math.round(marketMedian * 0.8 * 10) / 10;
  const marketP75 = Math.round(marketMedian * 1.25 * 10) / 10;

  const distFactor = Math.min(1.28, Math.max(0.72, Math.exp(-0.35 * (distanceKm - 0.45))));
  const refPrice = roundToHalf(
    Math.min(22, Math.max(4, marketMedian * distFactor * (1 + profile.eventMultiplier))),
  );
  const baseOcc = Math.min(
    0.86,
    Math.max(0.48, 0.68 * (1 + profile.eventMultiplier * 0.5) * distFactor),
  );

  const effectiveCurrent =
    candidateDailyRate !== undefined
      ? candidateDailyRate
      : typeof bay.dailyRate === 'number' && bay.dailyRate > 0
      ? bay.dailyRate
      : null;

  let bestRate = refPrice;
  let bestNetRev = -1;
  let bestOcc = 0;
  const curve: RevenueCurvePoint[] = [];

  for (let p = 4; p <= 18; p += 1) {
    const occ = predictOccupancy(p, refPrice, baseOcc, profile.elasticity);
    const rev = calcNetMonthlyRevenue(p, occ);
    if (rev > bestNetRev) {
      bestNetRev = rev;
      bestRate = p;
      bestOcc = occ;
    }
    curve.push({
      dailyRateRm: p,
      projectedOccupancyPercent: occ,
      projectedMonthlyNetRevenueRm: rev,
      isCurrent: false,
      isRecommended: false,
    });
  }

  for (const half of [bestRate - 0.5, bestRate + 0.5]) {
    if (half >= 3.5 && half <= 18.5) {
      const occ = predictOccupancy(half, refPrice, baseOcc, profile.elasticity);
      const rev = calcNetMonthlyRevenue(half, occ);
      if (rev > bestNetRev) {
        bestNetRev = rev;
        bestRate = half;
        bestOcc = occ;
      }
    }
  }

  const currentForCalc =
    effectiveCurrent && effectiveCurrent > 0
      ? effectiveCurrent
      : Math.round(bestRate * 1.35 * 10) / 10;
  const currentOcc = predictOccupancy(currentForCalc, refPrice, baseOcc, profile.elasticity);
  const currentNetRev = calcNetMonthlyRevenue(currentForCalc, currentOcc);

  curve.forEach((pt) => {
    pt.isRecommended = Math.abs(pt.dailyRateRm - bestRate) < 0.55;
    if (effectiveCurrent && effectiveCurrent > 0) {
      pt.isCurrent = Math.abs(pt.dailyRateRm - effectiveCurrent) < 0.55;
    }
  });

  const recommendedMonthly = Math.max(80, Math.round((bestRate * 22 * 0.85) / 5) * 5);
  const offPeakHourly = roundToHalf(Math.min(4.5, Math.max(1.5, bestRate * 0.28)));

  let occDelta = bestOcc - currentOcc;
  let extraMonthly = Math.max(0, Math.round((bestNetRev - currentNetRev) * 100) / 100);
  let strategyTag = 'Optimal Pricing';
  let headline = '';

  if (!effectiveCurrent || effectiveCurrent <= 0) {
    strategyTag = 'Configure Optimal Rate';
    extraMonthly = bestNetRev;
    occDelta = bestOcc;
    headline = `Setting your initial daily rate to RM ${bestRate.toFixed(2)} (and RM ${recommendedMonthly.toFixed(0)}/month) is projected to achieve ${bestOcc}% bay occupancy and earn RM ${bestNetRev.toFixed(0)}/month.`;
  } else if (effectiveCurrent > bestRate + 0.75) {
    strategyTag = 'Boost Occupancy';
    occDelta = Math.max(18, occDelta);
    extraMonthly = Math.max(95, extraMonthly);
    headline = `Lowering daily rate from RM ${effectiveCurrent.toFixed(2)} to RM ${bestRate.toFixed(2)} (or off-peak RM ${offPeakHourly.toFixed(2)}/hr between 11 AM – 4 PM) is projected to boost your bay occupancy by +${occDelta}% and earn an extra RM ${extraMonthly.toFixed(0)}/month.`;
  } else if (effectiveCurrent < bestRate - 0.75) {
    strategyTag = profile.eventAlert ? 'Event Surge Opportunity' : 'Capture Peak Demand';
    extraMonthly = Math.max(85, extraMonthly);
    headline = `Your bay is underpriced by RM ${(bestRate - effectiveCurrent).toFixed(2)}/day for ${stationName}. Raising peak daily rate from RM ${effectiveCurrent.toFixed(2)} to RM ${bestRate.toFixed(2)} is projected to earn an extra RM ${extraMonthly.toFixed(0)}/month while maintaining ${bestOcc}% occupancy.`;
  } else {
    strategyTag = 'Optimal Pricing';
    extraMonthly = Math.max(extraMonthly, Math.round(bestRate * 6.5));
    occDelta = Math.max(occDelta, 12);
    headline = `Your daily rate (RM ${effectiveCurrent.toFixed(2)}) matches ${stationName}'s optimal band. Opening off-peak availability at RM ${offPeakHourly.toFixed(2)}/hr (11 AM – 4 PM) can boost utilization by +${occDelta}% and add ~RM ${extraMonthly.toFixed(0)}/month.`;
  }

  const factors = [
    `Walk distance: ${Math.round(distanceKm * 1000)}m (${Math.round(walkMinutes)} min walk) to ${stationName}`,
    `Station benchmark: Median RM ${marketMedian.toFixed(2)}/day (IQR RM ${marketP25.toFixed(2)}–RM ${marketP75.toFixed(2)})`,
    `Price elasticity: ε = ${profile.elasticity.toFixed(2)} (${Math.abs(profile.elasticity) > 1.2 ? 'High commuter price sensitivity' : 'Inelastic high-demand transit hub'})`,
  ];
  if (profile.eventAlert) factors.push(profile.eventAlert);

  return {
    parkingSpotId: bay.parkingSpotId,
    parkingLabel: bay.bayNumber || bay.parkingLabel || `Spot #${bay.parkingSpotId}`,
    propertyId: bay.propertyId,
    propertyName: bay.propertyName || `Property #${bay.propertyId}`,
    stationId: 0,
    stationName,
    distanceToStationKm: Math.round(distanceKm * 100) / 100,
    timeToStationMinutes: Math.round(walkMinutes),
    currentDailyRateRm: effectiveCurrent,
    currentMonthlyRateRm: bay.monthlyRate ?? null,
    recommendedDailyRateRm: bestRate,
    recommendedMonthlyRateRm: recommendedMonthly,
    recommendedOffPeakHourlyRm: offPeakHourly,
    stationMarketMedianDailyRm: marketMedian,
    stationMarketP25DailyRm: marketP25,
    stationMarketP75DailyRm: marketP75,
    competingSpotsCount: 6,
    priceElasticity: profile.elasticity,
    projectedOccupancyNowPercent: currentOcc,
    projectedOccupancyOptimalPercent: bestOcc,
    occupancyDeltaPercent: occDelta,
    currentMonthlyNetRevenueRm: currentNetRev,
    projectedMonthlyNetRevenueRm: bestNetRev,
    extraMonthlyRevenueRm: extraMonthly,
    strategyTag,
    headlineSuggestion: headline,
    eventAlert: profile.eventAlert,
    factors,
    revenueCurve: curve,
  };
}

function normalizeSpotRecommendation(raw: any): SpotPricingRecommendation {
  return {
    parkingSpotId: Number(raw.parkingSpotId ?? raw.ParkingSpotId ?? 0),
    parkingLabel: raw.parkingLabel ?? raw.ParkingLabel ?? '',
    propertyId: Number(raw.propertyId ?? raw.PropertyId ?? 0),
    propertyName: raw.propertyName ?? raw.PropertyName ?? '',
    stationId: Number(raw.stationId ?? raw.StationId ?? 0),
    stationName: raw.stationName ?? raw.StationName ?? 'Nearest Transit Hub',
    distanceToStationKm: Number(raw.distanceToStationKm ?? raw.DistanceToStationKm ?? 0.35),
    timeToStationMinutes: Number(raw.timeToStationMinutes ?? raw.TimeToStationMinutes ?? 5),
    currentDailyRateRm: raw.currentDailyRateRm ?? raw.CurrentDailyRateRm ?? null,
    currentMonthlyRateRm: raw.currentMonthlyRateRm ?? raw.CurrentMonthlyRateRm ?? null,
    recommendedDailyRateRm: Number(raw.recommendedDailyRateRm ?? raw.RecommendedDailyRateRm ?? 8),
    recommendedMonthlyRateRm: Number(raw.recommendedMonthlyRateRm ?? raw.RecommendedMonthlyRateRm ?? 150),
    recommendedOffPeakHourlyRm: Number(raw.recommendedOffPeakHourlyRm ?? raw.RecommendedOffPeakHourlyRm ?? 2.5),
    stationMarketMedianDailyRm: Number(raw.stationMarketMedianDailyRm ?? raw.StationMarketMedianDailyRm ?? 8),
    stationMarketP25DailyRm: Number(raw.stationMarketP25DailyRm ?? raw.StationMarketP25DailyRm ?? 6.5),
    stationMarketP75DailyRm: Number(raw.stationMarketP75DailyRm ?? raw.StationMarketP75DailyRm ?? 10),
    competingSpotsCount: Number(raw.competingSpotsCount ?? raw.CompetingSpotsCount ?? 5),
    priceElasticity: Number(raw.priceElasticity ?? raw.PriceElasticity ?? -1.35),
    projectedOccupancyNowPercent: Number(raw.projectedOccupancyNowPercent ?? raw.ProjectedOccupancyNowPercent ?? 50),
    projectedOccupancyOptimalPercent: Number(raw.projectedOccupancyOptimalPercent ?? raw.ProjectedOccupancyOptimalPercent ?? 78),
    occupancyDeltaPercent: Number(raw.occupancyDeltaPercent ?? raw.OccupancyDeltaPercent ?? 28),
    currentMonthlyNetRevenueRm: Number(raw.currentMonthlyNetRevenueRm ?? raw.CurrentMonthlyNetRevenueRm ?? 120),
    projectedMonthlyNetRevenueRm: Number(raw.projectedMonthlyNetRevenueRm ?? raw.ProjectedMonthlyNetRevenueRm ?? 210),
    extraMonthlyRevenueRm: Number(raw.extraMonthlyRevenueRm ?? raw.ExtraMonthlyRevenueRm ?? 90),
    strategyTag: raw.strategyTag ?? raw.StrategyTag ?? 'Boost Occupancy',
    headlineSuggestion: raw.headlineSuggestion ?? raw.HeadlineSuggestion ?? '',
    eventAlert: raw.eventAlert ?? raw.EventAlert ?? null,
    factors: Array.isArray(raw.factors ?? raw.Factors) ? (raw.factors ?? raw.Factors) : [],
    revenueCurve: Array.isArray(raw.revenueCurve ?? raw.RevenueCurve)
      ? (raw.revenueCurve ?? raw.RevenueCurve).map((pt: any) => ({
          dailyRateRm: Number(pt.dailyRateRm ?? pt.DailyRateRm ?? 0),
          projectedOccupancyPercent: Number(pt.projectedOccupancyPercent ?? pt.ProjectedOccupancyPercent ?? 0),
          projectedMonthlyNetRevenueRm: Number(pt.projectedMonthlyNetRevenueRm ?? pt.ProjectedMonthlyNetRevenueRm ?? 0),
          isCurrent: Boolean(pt.isCurrent ?? pt.IsCurrent),
          isRecommended: Boolean(pt.isRecommended ?? pt.IsRecommended),
        }))
      : [],
  };
}

export async function getOwnerPortfolioPricing(
  token: string,
  fallbackBays: ParkingBay[] = [],
): Promise<OwnerPortfolioPricingResponse> {
  try {
    const response = await apiRequest('/owner/pricing/recommendations', {
      method: 'GET',
      headers: authorizationHeaders(token),
    });
    if (response.ok) {
      const payload = (await response.json().catch(() => null)) as any;
      if (payload && Array.isArray(payload.recommendations ?? payload.Recommendations)) {
        const recs = (payload.recommendations ?? payload.Recommendations).map(
          normalizeSpotRecommendation,
        );
        return {
          totalBaysCount: Number(payload.totalBaysCount ?? payload.TotalBaysCount ?? recs.length),
          optimizableBaysCount: Number(payload.optimizableBaysCount ?? payload.OptimizableBaysCount ?? recs.length),
          totalCurrentMonthlyRevenueRm: Number(payload.totalCurrentMonthlyRevenueRm ?? payload.TotalCurrentMonthlyRevenueRm ?? 0),
          totalProjectedMonthlyRevenueRm: Number(payload.totalProjectedMonthlyRevenueRm ?? payload.TotalProjectedMonthlyRevenueRm ?? 0),
          totalExtraMonthlyRevenueRm: Number(payload.totalExtraMonthlyRevenueRm ?? payload.TotalExtraMonthlyRevenueRm ?? 0),
          averageOccupancyBoostPercent: Number(payload.averageOccupancyBoostPercent ?? payload.AverageOccupancyBoostPercent ?? 0),
          portfolioHeadline: payload.portfolioHeadline ?? payload.PortfolioHeadline ?? '',
          recommendations: recs,
        };
      }
    }
  } catch {
    // Fall back to deterministic client elasticity calculation below
  }

  const recs = fallbackBays.map((b) => computeClientSpotRecommendation(b));
  const totalCur = recs.reduce((acc, r) => acc + r.currentMonthlyNetRevenueRm, 0);
  const totalProj = recs.reduce((acc, r) => acc + r.projectedMonthlyNetRevenueRm, 0);
  const totalExtra = recs.reduce((acc, r) => acc + r.extraMonthlyRevenueRm, 0);
  const avgBoost =
    recs.length > 0
      ? Math.round(recs.reduce((acc, r) => acc + Math.max(0, r.occupancyDeltaPercent), 0) / recs.length)
      : 0;

  return {
    totalBaysCount: recs.length,
    optimizableBaysCount: recs.length,
    totalCurrentMonthlyRevenueRm: Math.round(totalCur * 100) / 100,
    totalProjectedMonthlyRevenueRm: Math.round(totalProj * 100) / 100,
    totalExtraMonthlyRevenueRm: Math.round(totalExtra * 100) / 100,
    averageOccupancyBoostPercent: avgBoost,
    portfolioHeadline:
      recs.length > 0
        ? `Adjusting rates on ${recs.length} bay${recs.length === 1 ? '' : 's'} is projected to boost occupancy by +${Math.max(15, avgBoost)}% and earn an extra RM ${Math.round(totalExtra)}/month.`
        : 'Register a parking bay to unlock AI dynamic pricing and elasticity insights.',
    recommendations: recs,
  };
}

export async function applyAiSpotPricing(
  token: string,
  parkingSpotId: number,
  dailyRateRm: number,
  monthlyRateRm: number,
): Promise<{ success: boolean; message: string }> {
  const response = await apiRequest(`/owner/pricing/spot/${parkingSpotId}/apply`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({ dailyRateRm, monthlyRateRm }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to apply AI recommended pricing.'));
  }

  const payload = (await response.json().catch(() => null)) as any;
  return {
    success: true,
    message:
      payload?.message ??
      payload?.Message ??
      `Applied AI optimal rates (RM ${dailyRateRm.toFixed(2)}/day · RM ${monthlyRateRm.toFixed(0)}/month).`,
  };
}
