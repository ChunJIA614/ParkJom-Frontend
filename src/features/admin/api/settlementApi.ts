import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type {
  AdminWithdrawalItem,
  EscrowSyncResult,
  ReconciliationReport,
  SettlementBatchDetail,
  SettlementBatchSummary,
  SettlementLedgerEntry,
  SettlementSummary,
} from '../types';

export interface PagedSettlementResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SettlementLedgerPage extends PagedSettlementResult<SettlementLedgerEntry> {
  taxRatePercent: number;
  totalGrossVolume: number;
  totalPlatformCommission: number;
  totalTaxAmount: number;
  totalNetCommission: number;
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

const pick = <T = unknown>(obj: Record<string, unknown> | undefined, camel: string, pascal?: string): T | undefined => {
  if (!obj) return undefined;
  if (camel in obj) return obj[camel] as T;
  const p = pascal ?? `${camel[0].toUpperCase()}${camel.slice(1)}`;
  return obj[p] as T | undefined;
};

const normalizeBatchSummary = (raw: Record<string, unknown>): SettlementBatchSummary => ({
  settlementBatchId: asInt(pick(raw, 'settlementBatchId')),
  batchReference: asString(pick(raw, 'batchReference')),
  rail: asString(pick(raw, 'rail'), 'IBG'),
  scheduleWindow: asString(pick(raw, 'scheduleWindow')),
  status: asString(pick(raw, 'status'), 'Generated'),
  itemCount: asInt(pick(raw, 'itemCount')),
  totalAmount: asNumber(pick(raw, 'totalAmount')),
  currency: asString(pick(raw, 'currency'), 'MYR'),
  bnmFormatVersion: asString(pick(raw, 'bnmFormatVersion'), 'BNM-IBG-v2.1'),
  fileChecksum: asString(pick(raw, 'fileChecksum')),
  bankReference: asNullableString(pick(raw, 'bankReference')),
  createdByUserId: pick(raw, 'createdByUserId') == null ? null : asInt(pick(raw, 'createdByUserId')),
  createdByName: asNullableString(pick(raw, 'createdByName')),
  createdAt: asString(pick(raw, 'createdAt')),
  submittedAt: asNullableString(pick(raw, 'submittedAt')),
  clearedAt: asNullableString(pick(raw, 'clearedAt')),
  notes: asNullableString(pick(raw, 'notes')),
});

const normalizeBatchItem = (raw: Record<string, unknown>) => ({
  settlementBatchItemId: asInt(pick(raw, 'settlementBatchItemId')),
  transactionId: asInt(pick(raw, 'transactionId')),
  transactionReference: asString(pick(raw, 'transactionReference')),
  ownerUserId: asInt(pick(raw, 'ownerUserId')),
  ownerName: asString(pick(raw, 'ownerName')),
  ownerEmail: asString(pick(raw, 'ownerEmail')),
  bankName: asString(pick(raw, 'bankName')),
  bankCode: asString(pick(raw, 'bankCode')),
  accountNumber: asString(pick(raw, 'accountNumber')),
  accountHolderName: asString(pick(raw, 'accountHolderName')),
  amount: asNumber(pick(raw, 'amount')),
  status: asString(pick(raw, 'status')),
  clearingReference: asNullableString(pick(raw, 'clearingReference')),
  failureReason: asNullableString(pick(raw, 'failureReason')),
  processedAt: asNullableString(pick(raw, 'processedAt')),
});

const normalizeBatchDetail = (raw: Record<string, unknown>): SettlementBatchDetail => {
  const batchRaw = (pick<Record<string, unknown>>(raw, 'batch') ?? {}) as Record<string, unknown>;
  const itemsRaw = pick<unknown[]>(raw, 'items');
  return {
    batch: normalizeBatchSummary(batchRaw),
    items: Array.isArray(itemsRaw)
      ? itemsRaw.map((item) => normalizeBatchItem(item as Record<string, unknown>))
      : [],
    ibgPreview: asString(pick(raw, 'ibgPreview')),
  };
};

const normalizeWithdrawal = (raw: Record<string, unknown>): AdminWithdrawalItem => ({
  transactionId: asInt(pick(raw, 'transactionId')),
  referenceNumber: asString(pick(raw, 'referenceNumber')),
  walletId: asInt(pick(raw, 'walletId')),
  ownerUserId: asInt(pick(raw, 'ownerUserId')),
  ownerName: asString(pick(raw, 'ownerName')),
  ownerEmail: asString(pick(raw, 'ownerEmail')),
  amount: asNumber(pick(raw, 'amount')),
  status: asString(pick(raw, 'status')),
  bankName: asString(pick(raw, 'bankName')),
  bankCode: asString(pick(raw, 'bankCode')),
  accountNumber: asString(pick(raw, 'accountNumber')),
  accountHolderName: asString(pick(raw, 'accountHolderName')),
  autoWithdraw: Boolean(pick(raw, 'autoWithdraw')),
  batchId: pick(raw, 'batchId') == null ? null : asInt(pick(raw, 'batchId')),
  batchReference: asNullableString(pick(raw, 'batchReference')),
  batchItemStatus: asNullableString(pick(raw, 'batchItemStatus')),
  clearingReference: asNullableString(pick(raw, 'clearingReference')),
  failureReason: asNullableString(pick(raw, 'failureReason')),
  createdAt: asString(pick(raw, 'createdAt')),
  updatedAt: asString(pick(raw, 'updatedAt')),
});

const normalizeLedgerEntry = (raw: Record<string, unknown>): SettlementLedgerEntry => ({
  transactionId: asInt(pick(raw, 'transactionId')),
  referenceNumber: asString(pick(raw, 'referenceNumber')),
  type: asString(pick(raw, 'type')),
  status: asString(pick(raw, 'status')),
  paymentMethod: asString(pick(raw, 'paymentMethod')),
  ledgerAccount: asString(pick(raw, 'ledgerAccount')),
  userId: pick(raw, 'userId') == null ? null : asInt(pick(raw, 'userId')),
  userName: asNullableString(pick(raw, 'userName')),
  userEmail: asNullableString(pick(raw, 'userEmail')),
  bookingId: pick(raw, 'bookingId') == null ? null : asInt(pick(raw, 'bookingId')),
  bookingReference: asNullableString(pick(raw, 'bookingReference')),
  spotLabel: asNullableString(pick(raw, 'spotLabel')),
  amount: asNumber(pick(raw, 'amount')),
  taxRatePercent: asNumber(pick(raw, 'taxRatePercent')),
  taxAmount: asNumber(pick(raw, 'taxAmount')),
  netAmount: asNumber(pick(raw, 'netAmount')),
  createdAt: asString(pick(raw, 'createdAt')),
});

const parseFileNameFromHeader = (headerValue: string | null, fallback: string): string => {
  if (!headerValue) return fallback;
  const utf8Match = /filename\*=UTF-8''([^;\r\n]+)/i.exec(headerValue);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].trim());
  const plainMatch = /filename="?([^";\r\n]+)"?/i.exec(headerValue);
  return plainMatch?.[1]?.trim() || fallback;
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

export async function getSettlementSummary(token: string): Promise<SettlementSummary> {
  const response = await apiRequest('/admin/settlement/summary', {
    method: 'GET',
    headers: authorizationHeaders(token),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load settlement summary.'));
  }

  const body = await response.json().catch(() => null) as { data?: Record<string, unknown>; message?: string } | null;
  if (!body?.data) {
    throw new Error(body?.message || 'Settlement summary response contained no data.');
  }
  const raw = body.data;
  const latestBatchRaw = pick<Record<string, unknown> | null>(raw, 'latestBatch');

  return {
    commissionRate: asNumber(pick(raw, 'commissionRate')),
    taxRatePercent: asNumber(pick(raw, 'taxRatePercent'), 8),
    platformWalletBalance: asNumber(pick(raw, 'platformWalletBalance')),
    platformTotalRevenue: asNumber(pick(raw, 'platformTotalRevenue')),
    platformTotalRefunded: asNumber(pick(raw, 'platformTotalRefunded')),
    totalOwnerAvailable: asNumber(pick(raw, 'totalOwnerAvailable')),
    totalEscrowOnHold: asNumber(pick(raw, 'totalEscrowOnHold')),
    unreleasedCompletedBookingsCount: asInt(pick(raw, 'unreleasedCompletedBookingsCount')),
    unreleasedCompletedBookingsAmount: asNumber(pick(raw, 'unreleasedCompletedBookingsAmount')),
    pendingWithdrawalsCount: asInt(pick(raw, 'pendingWithdrawalsCount')),
    pendingWithdrawalsAmount: asNumber(pick(raw, 'pendingWithdrawalsAmount')),
    clearedWithdrawalsCount: asInt(pick(raw, 'clearedWithdrawalsCount')),
    clearedWithdrawalsAmount: asNumber(pick(raw, 'clearedWithdrawalsAmount')),
    eligibleAutoWithdrawOwnersCount: asInt(pick(raw, 'eligibleAutoWithdrawOwnersCount')),
    eligibleAutoWithdrawAmount: asNumber(pick(raw, 'eligibleAutoWithdrawAmount')),
    totalGrossCommissions: asNumber(pick(raw, 'totalGrossCommissions')),
    totalCommissionTaxSst: asNumber(pick(raw, 'totalCommissionTaxSst')),
    totalOverstayPenaltiesCollected: asNumber(pick(raw, 'totalOverstayPenaltiesCollected')),
    totalStripeTopUps: asNumber(pick(raw, 'totalStripeTopUps')),
    ibgScheduleLabel: asString(pick(raw, 'ibgScheduleLabel'), 'Twice Weekly (Tue & Fri, 14:00 MYT)'),
    nextScheduledIbgCutoffUtc: asString(pick(raw, 'nextScheduledIbgCutoffUtc')),
    latestBatch: latestBatchRaw ? normalizeBatchSummary(latestBatchRaw) : null,
    reconciliationHealth: asString(pick(raw, 'reconciliationHealth'), 'Matched'),
    generatedAtUtc: asString(pick(raw, 'generatedAtUtc')),
  };
}

export async function getSettlementWithdrawals(
  token: string,
  params: { status?: string; search?: string; page?: number; pageSize?: number } = {},
): Promise<PagedSettlementResult<AdminWithdrawalItem>> {
  const qs = buildQueryString(params);
  const response = await apiRequest(`/admin/settlement/withdrawals${qs}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load owner withdrawals.'));
  }

  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  const rows = (pick<unknown[]>(body ?? undefined, 'data') ?? []) as Record<string, unknown>[];
  return {
    items: rows.map(normalizeWithdrawal),
    totalCount: asInt(pick(body ?? undefined, 'totalCount'), rows.length),
    page: asInt(pick(body ?? undefined, 'page'), params.page ?? 1),
    pageSize: asInt(pick(body ?? undefined, 'pageSize'), params.pageSize ?? 20),
    totalPages: asInt(pick(body ?? undefined, 'totalPages'), 1),
  };
}

export async function submitWithdrawalDecision(
  token: string,
  transactionId: number,
  payload: { approve: boolean; bankReference?: string; reason?: string },
): Promise<{ message: string; item: AdminWithdrawalItem }> {
  const response = await apiRequest(`/admin/settlement/withdrawals/${transactionId}/decision`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(payload),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to process withdrawal decision.'));
  }

  const body = await response.json().catch(() => null) as { message?: string; data?: Record<string, unknown> } | null;
  if (!body?.data) {
    throw new Error(body?.message || 'Withdrawal decision returned no data.');
  }
  return {
    message: body.message || 'Withdrawal updated.',
    item: normalizeWithdrawal(body.data),
  };
}

export async function getSettlementBatches(
  token: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<PagedSettlementResult<SettlementBatchSummary>> {
  const qs = buildQueryString(params);
  const response = await apiRequest(`/admin/settlement/batches${qs}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load settlement batches.'));
  }

  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  const rows = (pick<unknown[]>(body ?? undefined, 'data') ?? []) as Record<string, unknown>[];
  return {
    items: rows.map(normalizeBatchSummary),
    totalCount: asInt(pick(body ?? undefined, 'totalCount'), rows.length),
    page: asInt(pick(body ?? undefined, 'page'), params.page ?? 1),
    pageSize: asInt(pick(body ?? undefined, 'pageSize'), params.pageSize ?? 20),
    totalPages: asInt(pick(body ?? undefined, 'totalPages'), 1),
  };
}

export async function getSettlementBatchDetail(
  token: string,
  batchId: number,
): Promise<SettlementBatchDetail> {
  const response = await apiRequest(`/admin/settlement/batches/${batchId}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Unable to load batch #${batchId}.`));
  }

  const body = await response.json().catch(() => null) as { data?: Record<string, unknown>; message?: string } | null;
  if (!body?.data) {
    throw new Error(body?.message || 'Batch detail response contained no data.');
  }
  return normalizeBatchDetail(body.data);
}

export async function generateSettlementBatch(
  token: string,
  payload: {
    rail?: string;
    transactionIds?: number[];
    includeAutoWithdrawOwners?: boolean;
    scheduleWindow?: string;
    notes?: string;
  },
): Promise<{ message: string; detail: SettlementBatchDetail }> {
  const response = await apiRequest('/admin/settlement/batches/generate', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(payload),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to generate settlement batch.'));
  }

  const body = await response.json().catch(() => null) as { message?: string; data?: Record<string, unknown> } | null;
  if (!body?.data) {
    throw new Error(body?.message || 'Batch generation returned no data.');
  }
  return {
    message: body.message || 'Settlement batch generated.',
    detail: normalizeBatchDetail(body.data),
  };
}

export async function submitSettlementBatch(
  token: string,
  batchId: number,
): Promise<{ message: string; detail: SettlementBatchDetail }> {
  const response = await apiRequest(`/admin/settlement/batches/${batchId}/submit`, {
    method: 'POST',
    headers: authorizationHeaders(token),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to submit settlement batch.'));
  }

  const body = await response.json().catch(() => null) as { message?: string; data?: Record<string, unknown> } | null;
  if (!body?.data) {
    throw new Error(body?.message || 'Batch submission returned no data.');
  }
  return {
    message: body.message || 'Settlement batch submitted.',
    detail: normalizeBatchDetail(body.data),
  };
}

export async function clearSettlementBatch(
  token: string,
  batchId: number,
  payload: {
    bankReference?: string;
    items?: Array<{
      settlementBatchItemId?: number;
      transactionId?: number;
      status: string;
      clearingReference?: string;
      failureReason?: string;
    }>;
  } = {},
): Promise<{ message: string; detail: SettlementBatchDetail }> {
  const response = await apiRequest(`/admin/settlement/batches/${batchId}/clear`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(payload),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to synchronize bank clearing status.'));
  }

  const body = await response.json().catch(() => null) as { message?: string; data?: Record<string, unknown> } | null;
  if (!body?.data) {
    throw new Error(body?.message || 'Clearing synchronization returned no data.');
  }
  return {
    message: body.message || 'Bank clearing synchronized.',
    detail: normalizeBatchDetail(body.data),
  };
}

export async function downloadBatchIbgFile(
  token: string,
  batchId: number,
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiRequest(`/admin/settlement/batches/${batchId}/ibg-file`, {
    method: 'GET',
    headers: authorizationHeaders(token, undefined, 'text/plain,*/*'),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to download BNM IBG file.'));
  }

  return {
    blob: await response.blob(),
    filename: parseFileNameFromHeader(
      response.headers.get('content-disposition'),
      `parkjom-batch-${batchId}-bnm.ibg.txt`,
    ),
  };
}

export async function getSettlementLedger(
  token: string,
  params: {
    from?: string;
    to?: string;
    type?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<SettlementLedgerPage> {
  const qs = buildQueryString(params);
  const response = await apiRequest(`/admin/settlement/ledger${qs}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load financial journal.'));
  }

  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  const rows = (pick<unknown[]>(body ?? undefined, 'data') ?? []) as Record<string, unknown>[];
  return {
    items: rows.map(normalizeLedgerEntry),
    taxRatePercent: asNumber(pick(body ?? undefined, 'taxRatePercent'), 8),
    totalGrossVolume: asNumber(pick(body ?? undefined, 'totalGrossVolume')),
    totalPlatformCommission: asNumber(pick(body ?? undefined, 'totalPlatformCommission')),
    totalTaxAmount: asNumber(pick(body ?? undefined, 'totalTaxAmount')),
    totalNetCommission: asNumber(pick(body ?? undefined, 'totalNetCommission')),
    totalCount: asInt(pick(body ?? undefined, 'totalCount'), rows.length),
    page: asInt(pick(body ?? undefined, 'page'), params.page ?? 1),
    pageSize: asInt(pick(body ?? undefined, 'pageSize'), params.pageSize ?? 25),
    totalPages: asInt(pick(body ?? undefined, 'totalPages'), 1),
  };
}

export async function downloadSettlementExport(
  token: string,
  params: {
    format: 'csv' | 'xlsx';
    from?: string;
    to?: string;
    type?: string;
    status?: string;
    search?: string;
  },
): Promise<{ blob: Blob; filename: string }> {
  const qs = buildQueryString(params);
  const accept = params.format === 'xlsx'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'text/csv';

  const response = await apiRequest(`/admin/settlement/export${qs}`, {
    method: 'GET',
    headers: authorizationHeaders(token, undefined, accept),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Unable to export ${params.format.toUpperCase()} ledger.`));
  }

  return {
    blob: await response.blob(),
    filename: parseFileNameFromHeader(
      response.headers.get('content-disposition'),
      `parkjom-settlement-journal.${params.format}`,
    ),
  };
}

export async function syncEscrowLedger(
  token: string,
): Promise<{ message: string; result: EscrowSyncResult }> {
  const response = await apiRequest('/admin/settlement/escrow/sync', {
    method: 'POST',
    headers: authorizationHeaders(token),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to synchronize escrow ledger.'));
  }

  const body = await response.json().catch(() => null) as { message?: string; data?: Record<string, unknown> } | null;
  const raw = body?.data ?? {};
  return {
    message: body?.message || 'Escrow synchronized.',
    result: {
      releasedBookingsCount: asInt(pick(raw, 'releasedBookingsCount')),
      releasedAmount: asNumber(pick(raw, 'releasedAmount')),
      skippedOrAlreadySettledCount: asInt(pick(raw, 'skippedOrAlreadySettledCount')),
      flaggedMismatchCount: asInt(pick(raw, 'flaggedMismatchCount')),
      syncedAtUtc: asString(pick(raw, 'syncedAtUtc')),
    },
  };
}

export async function getReconciliationReport(
  token: string,
  params: { from?: string; to?: string } = {},
): Promise<ReconciliationReport> {
  const qs = buildQueryString(params);
  const response = await apiRequest(`/admin/settlement/reconciliation${qs}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to generate reconciliation report.'));
  }

  const body = await response.json().catch(() => null) as { data?: Record<string, unknown>; message?: string } | null;
  if (!body?.data) {
    throw new Error(body?.message || 'Reconciliation returned no data.');
  }

  const raw = body.data;
  const sectionsRaw = (pick<unknown[]>(raw, 'sections') ?? []) as Record<string, unknown>[];
  const rowsRaw = (pick<unknown[]>(raw, 'exceptionsAndRecentReceipts') ?? []) as Record<string, unknown>[];

  return {
    overallStatus: asString(pick(raw, 'overallStatus'), 'Matched'),
    fromUtc: asNullableString(pick(raw, 'fromUtc')),
    toUtc: asNullableString(pick(raw, 'toUtc')),
    stripeCompletedPaymentsCount: asInt(pick(raw, 'stripeCompletedPaymentsCount')),
    stripeCompletedPaymentsTotal: asNumber(pick(raw, 'stripeCompletedPaymentsTotal')),
    stripeTopUpTransactionsCount: asInt(pick(raw, 'stripeTopUpTransactionsCount')),
    stripeTopUpTransactionsTotal: asNumber(pick(raw, 'stripeTopUpTransactionsTotal')),
    publicParkingStripeCount: asInt(pick(raw, 'publicParkingStripeCount')),
    publicParkingStripeTotal: asNumber(pick(raw, 'publicParkingStripeTotal')),
    bookingSplitExceptionsCount: asInt(pick(raw, 'bookingSplitExceptionsCount')),
    platformWalletRecordedBalance: asNumber(pick(raw, 'platformWalletRecordedBalance')),
    platformWalletExpectedBalance: asNumber(pick(raw, 'platformWalletExpectedBalance')),
    totalOwnerHeldEscrow: asNumber(pick(raw, 'totalOwnerHeldEscrow')),
    totalOwnerAvailable: asNumber(pick(raw, 'totalOwnerAvailable')),
    totalClearedWithdrawals: asNumber(pick(raw, 'totalClearedWithdrawals')),
    totalPendingWithdrawals: asNumber(pick(raw, 'totalPendingWithdrawals')),
    sections: sectionsRaw.map((s) => ({
      key: asString(pick(s, 'key')),
      title: asString(pick(s, 'title')),
      expectedAmount: asNumber(pick(s, 'expectedAmount')),
      recordedAmount: asNumber(pick(s, 'recordedAmount')),
      varianceAmount: asNumber(pick(s, 'varianceAmount')),
      status: asString(pick(s, 'status'), 'Matched'),
      notes: asString(pick(s, 'notes')),
    })),
    exceptionsAndRecentReceipts: rowsRaw.map((r) => ({
      source: asString(pick(r, 'source')),
      reference: asString(pick(r, 'reference')),
      userEmail: asString(pick(r, 'userEmail')),
      stripeOrBookingAmount: asNumber(pick(r, 'stripeOrBookingAmount')),
      ledgerAmount: asNumber(pick(r, 'ledgerAmount')),
      variance: asNumber(pick(r, 'variance')),
      matchStatus: asString(pick(r, 'matchStatus'), 'Matched'),
      detail: asString(pick(r, 'detail')),
      timestampUtc: asString(pick(r, 'timestampUtc')),
    })),
    generatedAtUtc: asString(pick(raw, 'generatedAtUtc')),
  };
}
