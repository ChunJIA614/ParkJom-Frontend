import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type { WalletSummary, WalletTopUpResponse, WalletTopUpState, WalletTopUpStatus } from '../types';

type WalletTopUpWireResponse = Partial<WalletTopUpResponse> & {
  Code?: number;
  Success?: boolean;
  Message?: string;
  PaymentId?: number;
  SessionId?: string;
  CheckoutUrl?: string;
};

const normalizeTopUpResponse = (payload: WalletTopUpWireResponse): WalletTopUpResponse => ({
  code: payload.code ?? payload.Code ?? 0,
  success: payload.success ?? payload.Success ?? false,
  message: payload.message ?? payload.Message ?? '',
  paymentId: payload.paymentId ?? payload.PaymentId ?? 0,
  sessionId: payload.sessionId ?? payload.SessionId ?? '',
  checkoutUrl: payload.checkoutUrl ?? payload.CheckoutUrl ?? '',
});

type WalletSummaryWireResponse = Partial<WalletSummary> & {
  Code?: number;
  Success?: boolean;
  Message?: string;
  WalletId?: number;
  Balance?: number;
  OnHold?: number;
  Currency?: string;
  Status?: string;
  UpdatedAt?: string;
};

type WalletTopUpStatusWireResponse = Partial<WalletTopUpStatus> & {
  Code?: number;
  Success?: boolean;
  Message?: string;
  PaymentId?: number;
  SessionId?: string;
  Amount?: number;
  Currency?: string;
  State?: WalletTopUpState;
  PaymentStatus?: string;
  CheckoutStatus?: string;
  StripePaymentStatus?: string;
  IsCredited?: boolean;
  CanContinue?: boolean;
  CheckoutUrl?: string | null;
  ExpiresAt?: string | null;
  WalletBalance?: number;
  WalletUpdatedAt?: string;
};

const normalizeWalletSummary = (payload: WalletSummaryWireResponse): WalletSummary => ({
  code: payload.code ?? payload.Code ?? 0,
  success: payload.success ?? payload.Success ?? false,
  message: payload.message ?? payload.Message ?? '',
  walletId: payload.walletId ?? payload.WalletId ?? 0,
  balance: payload.balance ?? payload.Balance ?? 0,
  onHold: payload.onHold ?? payload.OnHold ?? 0,
  currency: payload.currency ?? payload.Currency ?? 'MYR',
  status: payload.status ?? payload.Status ?? '',
  updatedAt: payload.updatedAt ?? payload.UpdatedAt ?? '',
});

const normalizeTopUpStatus = (payload: WalletTopUpStatusWireResponse): WalletTopUpStatus => ({
  code: payload.code ?? payload.Code ?? 0,
  success: payload.success ?? payload.Success ?? false,
  message: payload.message ?? payload.Message ?? '',
  paymentId: payload.paymentId ?? payload.PaymentId ?? 0,
  sessionId: payload.sessionId ?? payload.SessionId ?? '',
  amount: payload.amount ?? payload.Amount ?? 0,
  currency: payload.currency ?? payload.Currency ?? 'MYR',
  state: payload.state ?? payload.State ?? 'unavailable',
  paymentStatus: payload.paymentStatus ?? payload.PaymentStatus ?? '',
  checkoutStatus: payload.checkoutStatus ?? payload.CheckoutStatus ?? '',
  stripePaymentStatus: payload.stripePaymentStatus ?? payload.StripePaymentStatus ?? '',
  isCredited: payload.isCredited ?? payload.IsCredited ?? false,
  canContinue: payload.canContinue ?? payload.CanContinue ?? false,
  checkoutUrl: payload.checkoutUrl ?? payload.CheckoutUrl ?? null,
  expiresAt: payload.expiresAt ?? payload.ExpiresAt ?? null,
  walletBalance: payload.walletBalance ?? payload.WalletBalance ?? 0,
  walletUpdatedAt: payload.walletUpdatedAt ?? payload.WalletUpdatedAt ?? '',
});

export async function getWalletSummary(token: string): Promise<WalletSummary> {
  const response = await apiRequest('/wallet', {
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load your wallet balance.'));
  }

  const payload = await response.json().catch(() => null) as WalletSummaryWireResponse | null;
  if (!payload) throw new Error('The wallet service returned an unreadable response.');

  const rawBalance = payload.balance ?? payload.Balance;
  if (typeof rawBalance !== 'number' || !Number.isFinite(rawBalance)) {
    throw new Error('The wallet response did not include a valid balance.');
  }

  const result = normalizeWalletSummary(payload);
  if (!result.success) {
    throw new Error(result.message || 'Unable to load your wallet balance.');
  }

  return result;
}

export async function getWalletTopUpStatus(token: string, sessionId: string): Promise<WalletTopUpStatus> {
  const response = await apiRequest(`/wallet/topup/status?sessionId=${encodeURIComponent(sessionId)}`, {
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to check this checkout session.'));
  }

  const payload = await response.json().catch(() => null) as WalletTopUpStatusWireResponse | null;
  if (!payload) throw new Error('The wallet service returned an unreadable checkout status.');

  const rawState = payload.state ?? payload.State;
  const rawAmount = payload.amount ?? payload.Amount;
  const rawWalletBalance = payload.walletBalance ?? payload.WalletBalance;
  const validStates: WalletTopUpState[] = [
    'open',
    'processing',
    'completed',
    'expired',
    'cancelled',
    'failed',
    'unavailable',
  ];
  if (!rawState || !validStates.includes(rawState)) {
    throw new Error('The wallet service returned an unknown checkout state.');
  }
  if (typeof rawAmount !== 'number' || !Number.isFinite(rawAmount)
    || typeof rawWalletBalance !== 'number' || !Number.isFinite(rawWalletBalance)) {
    throw new Error('The checkout status did not include valid wallet amounts.');
  }

  const result = normalizeTopUpStatus(payload);
  if (!result.success || !result.paymentId || !result.sessionId) {
    throw new Error(result.message || 'Unable to check this checkout session.');
  }

  return result;
}

export async function createWalletTopUp(
  token: string,
  amount: number,
  description?: string,
  returnTarget: 'web' | 'native' = 'web',
): Promise<WalletTopUpResponse> {
  const response = await apiRequest('/wallet/topup', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      amount,
      returnTarget,
      ...(description ? { description } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to create a wallet top-up session.'));
  }

  const payload = await response.json().catch(() => null) as WalletTopUpWireResponse | null;
  if (!payload) {
    throw new Error('The wallet service returned an unreadable response.');
  }

  const result = normalizeTopUpResponse(payload);
  if (!result.success) {
    throw new Error(result.message || 'Unable to create a wallet top-up session.');
  }

  if (!result.paymentId || !result.sessionId || !result.checkoutUrl) {
    throw new Error('The top-up response was missing its payment or checkout details.');
  }

  return result;
}
