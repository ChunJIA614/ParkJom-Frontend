import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type {
  OwnerEarningsSummary,
  OwnerEarningsTransactionsResponse,
} from '../types';

export async function getOwnerEarningsSummary(
  token: string,
  month?: string,
  signal?: AbortSignal,
): Promise<OwnerEarningsSummary> {
  const query = new URLSearchParams();
  if (month) query.set('month', month);
  const qStr = query.toString();

  const response = await apiRequest(`/owner/earnings/summary${qStr ? `?${qStr}` : ''}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load owner earnings summary.'));
  }

  const payload = (await response.json().catch(() => null)) as OwnerEarningsSummary | null;
  if (!payload || !payload.success) {
    throw new Error(payload?.message || 'Unable to load owner earnings summary.');
  }

  return payload;
}

export interface OwnerEarningsTransactionsParams {
  month?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}

export async function getOwnerEarningsTransactions(
  token: string,
  params: OwnerEarningsTransactionsParams = {},
  signal?: AbortSignal,
): Promise<OwnerEarningsTransactionsResponse> {
  const query = new URLSearchParams();
  if (params.month) query.set('month', params.month);
  if (params.type) query.set('type', params.type);
  if (params.page != null) query.set('page', String(params.page));
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize));
  const qStr = query.toString();

  const response = await apiRequest(`/owner/earnings/transactions${qStr ? `?${qStr}` : ''}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load owner earnings transactions.'));
  }

  const payload = (await response.json().catch(() => null)) as OwnerEarningsTransactionsResponse | null;
  if (!payload || !payload.success) {
    throw new Error(payload?.message || 'Unable to load owner earnings transactions.');
  }

  return payload;
}
