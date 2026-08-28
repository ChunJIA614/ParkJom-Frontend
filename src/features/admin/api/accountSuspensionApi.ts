import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';

export interface SuspendedAccount {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  accountStatus: string;
  userType?: number;
  lockedParkingSpotCount?: number;
  updatedAt: string;
}

export interface SuspendAccountResponse {
  code: number;
  success: boolean;
  message: string;
  data: SuspendedAccount;
}

export interface GetSuspendedAccountsResponse {
  code: number;
  success: boolean;
  message: string;
  data: SuspendedAccount[];
}

type SuspendAccountWireResponse = Partial<SuspendAccountResponse> & {
  Code?: number;
  Success?: boolean;
  Message?: string;
  Data?: SuspendedAccount;
};

type SuspendedAccountsWireResponse = Partial<GetSuspendedAccountsResponse> & {
  Code?: number;
  Success?: boolean;
  Message?: string;
  Data?: SuspendedAccount[];
};

export async function getSuspendedAccounts(token: string): Promise<GetSuspendedAccountsResponse> {
  const response = await apiRequest('/admin/account-suspensions', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load suspended accounts.'));
  }

  const payload = await response.json().catch(() => null) as SuspendedAccountsWireResponse | null;
  const data = payload?.data ?? payload?.Data;
  if (!payload || !Array.isArray(data)) {
    throw new Error('The account service returned an unreadable suspension list.');
  }

  const result: GetSuspendedAccountsResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
    data,
  };

  if (!result.success) throw new Error(result.message || 'Unable to load suspended accounts.');
  if (result.data.some((account) => !account.userId || !account.email || !account.accountStatus)) {
    throw new Error('The suspension list contained incomplete account details.');
  }

  return result;
}

export async function suspendAccount(token: string, email: string): Promise<SuspendAccountResponse> {
  const response = await apiRequest('/admin/account-suspensions/suspend', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({ email: email.trim() }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to suspend this account.'));
  }

  const payload = await response.json().catch(() => null) as SuspendAccountWireResponse | null;
  if (!payload) throw new Error('The account service returned an unreadable response.');

  const result: SuspendAccountResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
    data: (payload.data ?? payload.Data) as SuspendedAccount,
  };

  if (!result.success) throw new Error(result.message || 'Unable to suspend this account.');
  if (!result.data || !result.data.userId || !result.data.email || !result.data.accountStatus) {
    throw new Error('The account was suspended, but the response was missing its account details.');
  }

  return result;
}

export async function reintegrateAccount(token: string, email: string): Promise<SuspendAccountResponse> {
  const response = await apiRequest('/admin/account-suspensions/reintegrate', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({ email: email.trim() }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to reintegrate this account.'));
  }

  const payload = await response.json().catch(() => null) as SuspendAccountWireResponse | null;
  if (!payload) throw new Error('The account service returned an unreadable response.');

  const result: SuspendAccountResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
    data: (payload.data ?? payload.Data) as SuspendedAccount,
  };

  if (!result.success) throw new Error(result.message || 'Unable to reintegrate this account.');
  if (!result.data || !result.data.userId || !result.data.email || !result.data.accountStatus) {
    throw new Error('The account was reintegrated, but the response was missing its account details.');
  }
  if (result.data.accountStatus.trim().toLowerCase() !== 'active') {
    throw new Error(`The account service returned an unexpected status: ${result.data.accountStatus}.`);
  }

  return result;
}
