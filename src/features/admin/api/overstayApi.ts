import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type {
  OverstayCaseDto,
  OverstayReleaseResult,
  OverstayScanResult,
  OverstaySummary,
  SystemConfig,
} from '../types';

export interface OverstayCasePage {
  items: OverstayCaseDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const asInt = (value: unknown, fallback = 0): number => Math.round(asNumber(value, fallback));

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : value === null || value === undefined ? fallback : String(value);

const asNullableString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNullableInt = (value: unknown): number | null =>
  value === null || value === undefined ? null : asInt(value);

const pick = <T = unknown>(obj: Record<string, unknown> | undefined, camel: string, pascal?: string): T | undefined => {
  if (!obj) return undefined;
  if (camel in obj) return obj[camel] as T;
  const p = pascal ?? `${camel[0].toUpperCase()}${camel.slice(1)}`;
  return obj[p] as T | undefined;
};

const buildQueryString = (params: Record<string, string | number | boolean | undefined | null>) => {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
};

const normalizeCase = (raw: Record<string, unknown>): OverstayCaseDto => ({
  overstayCaseId: asInt(pick(raw, 'overstayCaseId')),
  caseReference: asString(pick(raw, 'caseReference')),
  bookingId: asInt(pick(raw, 'bookingId')),
  bookingReference: asString(pick(raw, 'bookingReference')),
  renterId: asInt(pick(raw, 'renterId')),
  renterName: asString(pick(raw, 'renterName')),
  renterEmail: asString(pick(raw, 'renterEmail')),
  renterPhone: asNullableString(pick(raw, 'renterPhone')),
  vehiclePlate: asString(pick(raw, 'vehiclePlate'), '—'),
  parkingSpotId: asInt(pick(raw, 'parkingSpotId')),
  spotLabel: asString(pick(raw, 'spotLabel')),
  propertyName: asString(pick(raw, 'propertyName')),
  ioTDeviceId: asNullableInt(pick(raw, 'ioTDeviceId')),
  esp32Serial: asNullableString(pick(raw, 'esp32Serial')),
  deviceStatus: asNullableString(pick(raw, 'deviceStatus')),
  windowDate: asString(pick(raw, 'windowDate')),
  scheduledEndAtUtc: asString(pick(raw, 'scheduledEndAtUtc')),
  graceEndsAtUtc: asString(pick(raw, 'graceEndsAtUtc')),
  detectedAtUtc: asString(pick(raw, 'detectedAtUtc')),
  departedAtUtc: asNullableString(pick(raw, 'departedAtUtc')),
  overstayMinutes: asInt(pick(raw, 'overstayMinutes')),
  billableHours: asInt(pick(raw, 'billableHours')),
  baseHourlyRate: asNumber(pick(raw, 'baseHourlyRate')),
  penaltyMultiplier: asNumber(pick(raw, 'penaltyMultiplier'), 1.5),
  hourlyPenaltyTariff: asNumber(pick(raw, 'hourlyPenaltyTariff')),
  calculatedPenaltyAmount: asNumber(pick(raw, 'calculatedPenaltyAmount')),
  debitedAmount: asNumber(pick(raw, 'debitedAmount')),
  waivedAmount: asNumber(pick(raw, 'waivedAmount')),
  remainingDueAmount: asNumber(pick(raw, 'remainingDueAmount')),
  status: asString(pick(raw, 'status'), 'Detected'),
  paymentStatus: asString(pick(raw, 'paymentStatus'), 'Unbilled'),
  pushWarningSentAtUtc: asNullableString(pick(raw, 'pushWarningSentAtUtc')),
  smsWarningSentAtUtc: asNullableString(pick(raw, 'smsWarningSentAtUtc')),
  smsProviderRef: asNullableString(pick(raw, 'smsProviderRef')),
  smsDeliveryStatus: asNullableString(pick(raw, 'smsDeliveryStatus')),
  ledgerDebitedAtUtc: asNullableString(pick(raw, 'ledgerDebitedAtUtc')),
  penaltyTransactionId: asNullableInt(pick(raw, 'penaltyTransactionId')),
  hardwareLockActive: Boolean(pick(raw, 'hardwareLockActive')),
  hardwareLockEngagedAtUtc: asNullableString(pick(raw, 'hardwareLockEngagedAtUtc')),
  hardwareLockReleasedAtUtc: asNullableString(pick(raw, 'hardwareLockReleasedAtUtc')),
  hardwareLockReleasedByUserId: asNullableInt(pick(raw, 'hardwareLockReleasedByUserId')),
  disputeInvestigationId: asNullableInt(pick(raw, 'disputeInvestigationId')),
  resolutionNotes: asNullableString(pick(raw, 'resolutionNotes')),
  resolvedByUserId: asNullableInt(pick(raw, 'resolvedByUserId')),
  resolvedAtUtc: asNullableString(pick(raw, 'resolvedAtUtc')),
  updatedAt: asString(pick(raw, 'updatedAt')),
});

export async function getOverstaySummary(token: string): Promise<OverstaySummary> {
  const response = await apiRequest('/admin/overstays/summary', {
    method: 'GET',
    headers: authorizationHeaders(token),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load overstay summary.'));
  }

  const body = await response.json().catch(() => null) as { data?: Record<string, unknown>; message?: string } | null;
  if (!body?.data) {
    throw new Error(body?.message || 'Overstay summary returned no data.');
  }

  const raw = body.data;
  const workerRaw = (pick<Record<string, unknown>>(raw, 'workerStatus') ?? {}) as Record<string, unknown>;

  return {
    gracePeriodMinutes: asInt(pick(raw, 'gracePeriodMinutes'), 15),
    penaltyMultiplier: asNumber(pick(raw, 'penaltyMultiplier'), 1.5),
    maxDailyPenalty: asNumber(pick(raw, 'maxDailyPenalty'), 30),
    hardwareExitLockEnabled: Boolean(pick(raw, 'hardwareExitLockEnabled') ?? true),
    activeOverstaysCount: asInt(pick(raw, 'activeOverstaysCount')),
    warningsSentCount: asInt(pick(raw, 'warningsSentCount')),
    paymentDueCount: asInt(pick(raw, 'paymentDueCount')),
    disputedCount: asInt(pick(raw, 'disputedCount')),
    hardwareLockedCount: asInt(pick(raw, 'hardwareLockedCount')),
    waivedOrResolvedCount: asInt(pick(raw, 'waivedOrResolvedCount')),
    totalCalculatedPenalties: asNumber(pick(raw, 'totalCalculatedPenalties')),
    totalCollectedPenalties: asNumber(pick(raw, 'totalCollectedPenalties')),
    totalOutstandingPenalties: asNumber(pick(raw, 'totalOutstandingPenalties')),
    totalWaivedPenalties: asNumber(pick(raw, 'totalWaivedPenalties')),
    workerStatus: {
      enabled: Boolean(pick(workerRaw, 'enabled') ?? true),
      isRunning: Boolean(pick(workerRaw, 'isRunning')),
      intervalSeconds: asInt(pick(workerRaw, 'intervalSeconds'), 60),
      startedAtUtc: asNullableString(pick(workerRaw, 'startedAtUtc')),
      lastScanStartedAtUtc: asNullableString(pick(workerRaw, 'lastScanStartedAtUtc')),
      lastScanCompletedAtUtc: asNullableString(pick(workerRaw, 'lastScanCompletedAtUtc')),
      lastScanDetectedCount: asInt(pick(workerRaw, 'lastScanDetectedCount')),
      lastScanWarningsSent: asInt(pick(workerRaw, 'lastScanWarningsSent')),
      lastScanPenaltiesDebited: asInt(pick(workerRaw, 'lastScanPenaltiesDebited')),
      totalScansCompleted: asInt(pick(workerRaw, 'totalScansCompleted')),
      lastError: asNullableString(pick(workerRaw, 'lastError')),
    },
    generatedAtUtc: asString(pick(raw, 'generatedAtUtc')),
  };
}

export async function getOverstayCases(
  token: string,
  params: {
    status?: string;
    paymentStatus?: string;
    hardwareLocked?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<OverstayCasePage> {
  const qs = buildQueryString(params);
  const response = await apiRequest(`/admin/overstays${qs}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load overstay cases.'));
  }

  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  const rows = (pick<unknown[]>(body ?? undefined, 'data') ?? []) as Record<string, unknown>[];
  return {
    items: rows.map(normalizeCase),
    totalCount: asInt(pick(body ?? undefined, 'totalCount'), rows.length),
    page: asInt(pick(body ?? undefined, 'page'), params.page ?? 1),
    pageSize: asInt(pick(body ?? undefined, 'pageSize'), params.pageSize ?? 20),
    totalPages: asInt(pick(body ?? undefined, 'totalPages'), 1),
  };
}

export async function triggerOverstayScan(
  token: string,
): Promise<{ message: string; result: OverstayScanResult }> {
  const response = await apiRequest('/admin/overstays/scan', {
    method: 'POST',
    headers: authorizationHeaders(token),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to run overstay scan.'));
  }

  const body = await response.json().catch(() => null) as { message?: string; data?: Record<string, unknown> } | null;
  const raw = body?.data ?? {};
  return {
    message: body?.message || 'Overstay scan complete.',
    result: {
      activeBookingsScanned: asInt(pick(raw, 'activeBookingsScanned')),
      casesDetectedOrUpdated: asInt(pick(raw, 'casesDetectedOrUpdated')),
      warningsDispatched: asInt(pick(raw, 'warningsDispatched')),
      penaltiesDebited: asInt(pick(raw, 'penaltiesDebited')),
      casesAutoResolved: asInt(pick(raw, 'casesAutoResolved')),
      scannedAtUtc: asString(pick(raw, 'scannedAtUtc')),
    },
  };
}

export async function dispatchOverstayWarning(
  token: string,
  caseId: number,
  forceResend = true,
): Promise<{ message: string; item: OverstayCaseDto }> {
  const response = await apiRequest(`/admin/overstays/${caseId}/warn`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({ forceResend }),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to dispatch overstay warning.'));
  }

  const body = await response.json().catch(() => null) as { message?: string; data?: Record<string, unknown> } | null;
  if (!body?.data) {
    throw new Error(body?.message || 'Warning dispatch returned no data.');
  }
  return {
    message: body.message || 'Warning dispatched.',
    item: normalizeCase(body.data),
  };
}

export async function chargeOverstayPenalty(
  token: string,
  caseId: number,
): Promise<{ message: string; item: OverstayCaseDto }> {
  const response = await apiRequest(`/admin/overstays/${caseId}/charge`, {
    method: 'POST',
    headers: authorizationHeaders(token),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to charge overstay penalty.'));
  }

  const body = await response.json().catch(() => null) as { message?: string; data?: Record<string, unknown> } | null;
  if (!body?.data) {
    throw new Error(body?.message || 'Penalty debit returned no data.');
  }
  return {
    message: body.message || 'Penalty processed.',
    item: normalizeCase(body.data),
  };
}

export async function waiveOverstayPenalty(
  token: string,
  caseId: number,
  payload: { waiverAmount?: number; reason: string },
): Promise<{ message: string; item: OverstayCaseDto }> {
  const response = await apiRequest(`/admin/overstays/${caseId}/waive`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(payload),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to waive overstay penalty.'));
  }

  const body = await response.json().catch(() => null) as { message?: string; data?: Record<string, unknown> } | null;
  if (!body?.data) {
    throw new Error(body?.message || 'Penalty waiver returned no data.');
  }
  return {
    message: body.message || 'Penalty waived.',
    item: normalizeCase(body.data),
  };
}

export async function reviewOverstayDispute(
  token: string,
  caseId: number,
  payload: { action: 'flag' | 'uphold' | 'partial_waive' | 'waive'; waiverAmount?: number; notes: string },
): Promise<{ message: string; item: OverstayCaseDto }> {
  const response = await apiRequest(`/admin/overstays/${caseId}/dispute`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(payload),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to submit dispute review.'));
  }

  const body = await response.json().catch(() => null) as { message?: string; data?: Record<string, unknown> } | null;
  if (!body?.data) {
    throw new Error(body?.message || 'Dispute review returned no data.');
  }
  return {
    message: body.message || 'Dispute review saved.',
    item: normalizeCase(body.data),
  };
}

export async function releaseOverstayHardwareLock(
  token: string,
  caseId: number,
  payload: { reason: string; triggerBollardUnlock?: boolean; markResolved?: boolean },
): Promise<{ message: string; result: OverstayReleaseResult }> {
  const response = await apiRequest(`/admin/overstays/${caseId}/release`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(payload),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to execute security release.'));
  }

  const body = await response.json().catch(() => null) as { message?: string; data?: Record<string, unknown> } | null;
  const raw = body?.data ?? {};
  const caseRaw = (pick<Record<string, unknown>>(raw, 'case') ?? {}) as Record<string, unknown>;
  return {
    message: body?.message || 'Security release applied.',
    result: {
      case: normalizeCase(caseRaw),
      bollardUnlockAttempted: Boolean(pick(raw, 'bollardUnlockAttempted')),
      bollardUnlockSucceeded: Boolean(pick(raw, 'bollardUnlockSucceeded')),
      bollardOutcome: asNullableString(pick(raw, 'bollardOutcome')),
    },
  };
}

export async function updateOverstayPolicy(
  token: string,
  payload: {
    gracePeriodMinutes?: number;
    overstayPenaltyMultiplier?: number;
    overstayMaxDailyPenalty?: number;
    hardwareExitLockEnabled?: boolean;
  },
): Promise<{ message: string; config: SystemConfig }> {
  const response = await apiRequest('/admin/overstays/policy', {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(payload),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to update overstay policy.'));
  }

  const body = await response.json().catch(() => null) as { message?: string; data?: Record<string, unknown> } | null;
  const raw = body?.data ?? {};
  return {
    message: body?.message || 'Overstay policy updated.',
    config: {
      commissionRate: asNumber(pick(raw, 'commissionRate'), 10),
      gracePeriodMinutes: asInt(pick(raw, 'gracePeriodMinutes'), 15),
      overstayPenaltyMultiplier: asNumber(pick(raw, 'overstayPenaltyMultiplier'), 1.5),
      overstayMaxDailyPenalty: asNumber(pick(raw, 'overstayMaxDailyPenalty'), 30),
      hardwareExitLockEnabled: Boolean(pick(raw, 'hardwareExitLockEnabled') ?? true),
      taxRatePercent: asNumber(pick(raw, 'taxRatePercent'), 8),
      updatedAt: asString(pick(raw, 'updatedAt')),
      updatedByUserId: asNullableInt(pick(raw, 'updatedByUserId')),
      updatedByName: asNullableString(pick(raw, 'updatedByName')),
    },
  };
}
