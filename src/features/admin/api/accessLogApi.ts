import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type { AccessLogResponse } from '../types';

export interface AccessLogListOptions {
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getAccessLogs(
  token: string,
  options: AccessLogListOptions = {},
): Promise<AccessLogResponse> {
  const params = new URLSearchParams();
  if (options.search?.trim()) params.set('search', options.search.trim());
  if (options.page && options.page > 0) params.set('page', String(Math.floor(options.page)));
  if (options.pageSize && options.pageSize > 0) params.set('pageSize', String(Math.floor(options.pageSize)));

  const query = params.toString();
  const response = await apiRequest(`/accesslog${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load access logs.'));
  }

  const payload = await response.json().catch(() => null) as AccessLogResponse | null;
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error('The access-log service returned an unreadable response.');
  }
  if (!payload.success) {
    throw new Error(payload.message || 'Unable to load access logs.');
  }

  return payload;
}
