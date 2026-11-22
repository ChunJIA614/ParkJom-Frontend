import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type { SystemConfig } from '../types';

/**
 * GET/PUT /api/admin/system-config
 *
 * The commission rate used to be a compile-time constant (10%) while this screen
 * displayed 15%, so the operator could never tell what was actually charged.
 * The rate now lives in the database and is snapshotted onto each booking quote,
 * which means changing it here only affects future quotes.
 */

interface SystemConfigWire {
  commissionRate?: number;
  gracePeriodMinutes?: number;
  overstayPenaltyMultiplier?: number;
  overstayMaxDailyPenalty?: number;
  hardwareExitLockEnabled?: boolean;
  taxRatePercent?: number;
  updatedAt?: string;
  updatedByUserId?: number | null;
  updatedByName?: string | null;
}

interface SystemConfigWireResponse {
  code?: number;
  success?: boolean;
  message?: string;
  data?: SystemConfigWire;
}

const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const normalize = (wire: SystemConfigWire | undefined): SystemConfig => ({
  commissionRate: toNumber(wire?.commissionRate, 0),
  gracePeriodMinutes: Math.round(toNumber(wire?.gracePeriodMinutes, 0)),
  overstayPenaltyMultiplier: wire?.overstayPenaltyMultiplier !== undefined
    ? toNumber(wire.overstayPenaltyMultiplier, 1.5)
    : undefined,
  overstayMaxDailyPenalty: wire?.overstayMaxDailyPenalty !== undefined
    ? toNumber(wire.overstayMaxDailyPenalty, 30)
    : undefined,
  hardwareExitLockEnabled: typeof wire?.hardwareExitLockEnabled === 'boolean'
    ? wire.hardwareExitLockEnabled
    : undefined,
  taxRatePercent: wire?.taxRatePercent !== undefined
    ? toNumber(wire.taxRatePercent, 8)
    : undefined,
  updatedAt: wire?.updatedAt ?? '',
  updatedByUserId: typeof wire?.updatedByUserId === 'number' ? wire.updatedByUserId : null,
  updatedByName: wire?.updatedByName?.trim() || null,
});

export async function getSystemConfig(token: string): Promise<SystemConfig> {
  const response = await apiRequest('/admin/system-config', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load the system configuration.'));
  }

  const payload = await response.json().catch(() => null) as SystemConfigWireResponse | null;
  if (!payload?.data) {
    throw new Error(payload?.message || 'The configuration service returned no data.');
  }

  return normalize(payload.data);
}

export interface UpdateSystemConfigPayload {
  commissionRate?: number;
  gracePeriodMinutes?: number;
  overstayPenaltyMultiplier?: number;
  overstayMaxDailyPenalty?: number;
  hardwareExitLockEnabled?: boolean;
  taxRatePercent?: number;
}

export async function updateSystemConfig(
  token: string,
  payload: UpdateSystemConfigPayload,
): Promise<SystemConfig> {
  if (
    payload.commissionRate === undefined
    && payload.gracePeriodMinutes === undefined
    && payload.overstayPenaltyMultiplier === undefined
    && payload.overstayMaxDailyPenalty === undefined
    && payload.hardwareExitLockEnabled === undefined
    && payload.taxRatePercent === undefined
  ) {
    throw new Error('Nothing to update.');
  }

  const response = await apiRequest('/admin/system-config', {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      ...(payload.commissionRate !== undefined ? { commissionRate: payload.commissionRate } : {}),
      ...(payload.gracePeriodMinutes !== undefined ? { gracePeriodMinutes: payload.gracePeriodMinutes } : {}),
      ...(payload.overstayPenaltyMultiplier !== undefined
        ? { overstayPenaltyMultiplier: payload.overstayPenaltyMultiplier }
        : {}),
      ...(payload.overstayMaxDailyPenalty !== undefined
        ? { overstayMaxDailyPenalty: payload.overstayMaxDailyPenalty }
        : {}),
      ...(payload.hardwareExitLockEnabled !== undefined
        ? { hardwareExitLockEnabled: payload.hardwareExitLockEnabled }
        : {}),
      ...(payload.taxRatePercent !== undefined ? { taxRatePercent: payload.taxRatePercent } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to save the system configuration.'));
  }

  const body = await response.json().catch(() => null) as SystemConfigWireResponse | null;
  if (body?.success === false) {
    throw new Error(body.message || 'Unable to save the system configuration.');
  }
  if (!body?.data) {
    throw new Error('The configuration was saved but the server returned no confirmation.');
  }

  return normalize(body.data);
}
