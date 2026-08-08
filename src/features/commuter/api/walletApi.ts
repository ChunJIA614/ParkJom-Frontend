import { apiRequest, authorizationHeaders } from '@/services/apiClient';

export function createWalletTopUp(
  token: string,
  amount: number,
  description?: string,
): Promise<Response> {
  return apiRequest('/wallet/topup', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      amount,
      ...(description ? { description } : {}),
    }),
  });
}
