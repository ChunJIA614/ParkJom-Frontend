import type { BookingAvailabilityResponse } from '@/features/commuter/api/bookingApi';
import {
  findNearestAvailableDate,
  getDatesBetween,
  isValidIsoDateKey,
  validateBookingDateRange,
} from '@/features/commuter/lib/bookingDateValidation';
import type {
  CopilotBookingProposalCardData,
  CopilotCard,
  CopilotDeparturesCardData,
  CopilotParkingCardData,
  CopilotPublicParkingCardData,
} from '../types';

const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(CONTROL_CHARS_REGEX, '').trim();
  return cleaned || null;
}

function asSafeString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.replace(CONTROL_CHARS_REGEX, '').trim();
}

export function sanitizeSafeImageUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

export function sanitizeCopilotInput(text: string, maxLength = 1000): string {
  if (typeof text !== 'string') return '';
  return text.replace(CONTROL_CHARS_REGEX, '').trim().slice(0, maxLength);
}

function sanitizeParkingCard(raw: Record<string, unknown>): CopilotParkingCardData | null {
  if (!isPositiveInteger(raw.parkingSpotId)) return null;
  const parkingLabel = asNonEmptyString(raw.parkingLabel);
  const propertyName = asNonEmptyString(raw.propertyName);
  const stationName = asSafeString(raw.stationName);
  if (!parkingLabel || !propertyName) return null;

  const dailyRate = raw.dailyRate == null
    ? null
    : (isNonNegativeFinite(raw.dailyRate) ? raw.dailyRate : null);
  const monthlyRate = raw.monthlyRate == null
    ? null
    : (isNonNegativeFinite(raw.monthlyRate) ? raw.monthlyRate : null);
  if (raw.dailyRate != null && dailyRate === null) return null;
  if (raw.monthlyRate != null && monthlyRate === null) return null;

  const walkingTimeMinutes = isNonNegativeFinite(raw.walkingTimeMinutes) ? raw.walkingTimeMinutes : 0;
  const distanceToStationMeters = isNonNegativeFinite(raw.distanceToStationMeters) ? raw.distanceToStationMeters : 0;

  const nextDateRaw = asSafeString(raw.nextAvailableDate);

  return {
    parkingSpotId: raw.parkingSpotId,
    parkingLabel,
    propertyName,
    address: asSafeString(raw.address),
    distanceToStationMeters,
    walkingTimeMinutes,
    dailyRate,
    monthlyRate,
    availabilityStatus: asSafeString(raw.availabilityStatus, 'Available'),
    hasSmartBollard: Boolean(raw.hasSmartBollard),
    stationName,
    stopId: asSafeString(raw.stopId),
    lineName: raw.lineName == null ? null : asSafeString(raw.lineName),
    primaryImageUrl: sanitizeSafeImageUrl(raw.primaryImageUrl),
    isCovered: typeof raw.isCovered === 'boolean' ? raw.isCovered : undefined,
    hasEvCharging: typeof raw.hasEvCharging === 'boolean' ? raw.hasEvCharging : undefined,
    hasCctv: typeof raw.hasCctv === 'boolean' ? raw.hasCctv : undefined,
    isHandicapAccessible: typeof raw.isHandicapAccessible === 'boolean' ? raw.isHandicapAccessible : undefined,
    availableOnRequestedDate:
      typeof raw.availableOnRequestedDate === 'boolean' ? raw.availableOnRequestedDate : null,
    nextAvailableDate: isValidIsoDateKey(nextDateRaw) ? nextDateRaw : null,
    predictedOccupancyPercent: isNonNegativeFinite(raw.predictedOccupancyPercent)
      ? Math.min(100, raw.predictedOccupancyPercent)
      : null,
    probabilityFull: isNonNegativeFinite(raw.probabilityFull) ? raw.probabilityFull : null,
    riskLevel: raw.riskLevel == null ? null : asSafeString(raw.riskLevel),
    recommendedArriveBefore: raw.recommendedArriveBefore == null
      ? null
      : asSafeString(raw.recommendedArriveBefore),
  };
}

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function sanitizePublicParkingCard(raw: Record<string, unknown>): CopilotPublicParkingCardData | null {
  if (!isPositiveInteger(raw.publicParkingLotId)) return null;
  const lotName = asNonEmptyString(raw.lotName);
  if (!lotName) return null;

  if (!isNonNegativeFinite(raw.totalCapacity) || !isNonNegativeFinite(raw.availableSpaces)) return null;
  if (!isNonNegativeFinite(raw.hourlyRate)) return null;

  const dailyCapRate = raw.dailyCapRate == null
    ? null
    : (isNonNegativeFinite(raw.dailyCapRate) ? raw.dailyCapRate : null);
  const flatRatePerEntry = raw.flatRatePerEntry == null
    ? null
    : (isNonNegativeFinite(raw.flatRatePerEntry) ? raw.flatRatePerEntry : null);
  if (raw.dailyCapRate != null && dailyCapRate === null) return null;
  if (raw.flatRatePerEntry != null && flatRatePerEntry === null) return null;

  const latitude = isFiniteInRange(raw.latitude, -90, 90) ? raw.latitude : 0;
  const longitude = isFiniteInRange(raw.longitude, -180, 180) ? raw.longitude : 0;

  return {
    publicParkingLotId: raw.publicParkingLotId,
    lotName,
    address: asSafeString(raw.address),
    latitude,
    longitude,
    distanceMeters: isNonNegativeFinite(raw.distanceMeters) ? raw.distanceMeters : 0,
    walkingTimeMinutes: isNonNegativeFinite(raw.walkingTimeMinutes) ? raw.walkingTimeMinutes : 0,
    availableSpaces: Math.min(raw.availableSpaces, raw.totalCapacity),
    totalCapacity: raw.totalCapacity,
    isCurrentlyOpen: Boolean(raw.isCurrentlyOpen),
    openingTime: raw.openingTime == null ? null : asSafeString(raw.openingTime),
    closingTime: raw.closingTime == null ? null : asSafeString(raw.closingTime),
    hourlyRate: raw.hourlyRate,
    dailyCapRate,
    flatRatePerEntry,
    nearestStationName: asSafeString(raw.nearestStationName),
    facilityPhotoUrl: sanitizeSafeImageUrl(raw.facilityPhotoUrl),
  };
}

function sanitizeDeparturesCard(raw: Record<string, unknown>): CopilotDeparturesCardData | null {
  const stopId = asNonEmptyString(raw.stopId);
  const stationName = asNonEmptyString(raw.stationName);
  if (!stopId || !stationName) return null;

  const rawDepartures = Array.isArray(raw.departures) ? raw.departures : [];
  const departures = rawDepartures.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    const direction = asNonEmptyString(item.direction);
    const next = asSafeString(item.next);
    if (!direction || !isNonNegativeFinite(item.minutesUntil)) return [];
    return [{
      direction,
      next,
      minutesUntil: item.minutesUntil,
      following: Array.isArray(item.following)
        ? item.following.map((v) => asSafeString(v)).filter(Boolean)
        : [],
    }];
  });

  return {
    stopId,
    stationName,
    lineName: asSafeString(raw.lineName),
    currentTime: asSafeString(raw.currentTime),
    isOperating: Boolean(raw.isOperating),
    serviceStatus: asSafeString(raw.serviceStatus),
    isPeakHour: Boolean(raw.isPeakHour),
    frequencyMinutes: isNonNegativeFinite(raw.frequencyMinutes) ? raw.frequencyMinutes : 0,
    firstTrain: asSafeString(raw.firstTrain),
    lastTrain: asSafeString(raw.lastTrain),
    departures,
  };
}

function sanitizeBookingProposalCard(
  raw: Record<string, unknown>,
): CopilotBookingProposalCardData | null {
  if (!isPositiveInteger(raw.parkingSpotId)) return null;
  const parkingLabel = asNonEmptyString(raw.parkingLabel);
  const propertyName = asNonEmptyString(raw.propertyName);
  const startDate = asNonEmptyString(raw.startDate);
  const endDate = asNonEmptyString(raw.endDate);
  if (!parkingLabel || !propertyName || !startDate || !endDate) return null;
  if (!isValidIsoDateKey(startDate) || !isValidIsoDateKey(endDate) || endDate < startDate) return null;

  const spannedDays = getDatesBetween(startDate, endDate).length;
  if (spannedDays <= 0 || spannedDays > 31) return null;

  if (!isPositiveInteger(raw.days) || raw.days > 31) return null;
  const dailyRate = raw.dailyRate == null
    ? null
    : (isNonNegativeFinite(raw.dailyRate) ? raw.dailyRate : null);
  const estimatedSubtotal = raw.estimatedSubtotal == null
    ? null
    : (isNonNegativeFinite(raw.estimatedSubtotal) ? raw.estimatedSubtotal : null);
  if (raw.dailyRate != null && dailyRate === null) return null;
  if (raw.estimatedSubtotal != null && estimatedSubtotal === null) return null;

  return {
    parkingSpotId: raw.parkingSpotId,
    parkingLabel,
    propertyName,
    address: asSafeString(raw.address),
    startDate,
    endDate,
    days: raw.days,
    dailyRate,
    estimatedSubtotal,
  };
}

export function sanitizeCopilotCard(card: unknown): CopilotCard | null {
  if (!card || typeof card !== 'object') return null;
  const candidate = card as { type?: unknown; data?: unknown };
  if (!candidate.data || typeof candidate.data !== 'object' || Array.isArray(candidate.data)) {
    return null;
  }
  const dataRecord = candidate.data as Record<string, unknown>;

  switch (candidate.type) {
    case 'parking': {
      const data = sanitizeParkingCard(dataRecord);
      return data ? { type: 'parking', data } : null;
    }
    case 'publicParking': {
      const data = sanitizePublicParkingCard(dataRecord);
      return data ? { type: 'publicParking', data } : null;
    }
    case 'departures': {
      const data = sanitizeDeparturesCard(dataRecord);
      return data ? { type: 'departures', data } : null;
    }
    case 'bookingProposal': {
      const data = sanitizeBookingProposalCard(dataRecord);
      return data ? { type: 'bookingProposal', data } : null;
    }
    default:
      return null;
  }
}

export interface ProposalAvailabilityVerdict {
  status: 'available' | 'unavailable';
  reason: string | null;
  nextAvailableDate: string | null;
}

export function evaluateProposalAvailability(
  proposal: Pick<CopilotBookingProposalCardData, 'startDate' | 'endDate'>,
  availabilityByMonth: Record<string, BookingAvailabilityResponse>,
): ProposalAvailabilityVerdict {
  const minimumBookingDate = Object.values(availabilityByMonth)
    .map((availability) => availability.minimumBookingDate)
    .filter(Boolean)
    .sort()[0] ?? '';

  const validation = validateBookingDateRange({
    startDate: proposal.startDate,
    endDate: proposal.endDate,
    availabilityByMonth,
    minimumBookingDate,
  });

  if (validation.isValid) {
    return { status: 'available', reason: null, nextAvailableDate: null };
  }

  return {
    status: 'unavailable',
    reason: validation.error || 'Suggested dates are unavailable.',
    nextAvailableDate: findNearestAvailableDate(
      availabilityByMonth,
      proposal.startDate,
      minimumBookingDate,
    ),
  };
}
