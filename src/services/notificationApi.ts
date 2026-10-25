import { apiRequest, authorizationHeaders, readApiError } from './apiClient';

/**
 * Notification inbox — GET/PUT/DELETE /api/notifications
 *
 * The backend stores one row per user. Every call is scoped server-side to the
 * authenticated account, so this module never sends a user id.
 */

/** Type strings the backend writes. Anything else is treated as "system". */
export type NotificationType = 'booking' | 'payment' | 'system' | 'alert' | 'dispute' | 'support';

export interface NotificationDto {
  notificationId: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  bookingId: number | null;
  actionUrl: string | null;
  createdAt: string;
}

export interface NotificationListResult {
  data: NotificationDto[];
  totalCount: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface NotificationWireItem {
  notificationId?: number;
  type?: string;
  title?: string;
  message?: string;
  isRead?: boolean;
  readAt?: string | null;
  bookingId?: number | null;
  actionUrl?: string | null;
  createdAt?: string;
}

interface NotificationListWireResponse {
  code?: number;
  success?: boolean;
  message?: string;
  data?: NotificationWireItem[];
  totalCount?: number;
  unreadCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

interface NotificationMutationWireResponse {
  code?: number;
  success?: boolean;
  message?: string;
  affected?: number;
  unreadCount?: number;
}

const normalizeNotification = (value: NotificationWireItem): NotificationDto | null => {
  const notificationId = value.notificationId;
  if (typeof notificationId !== 'number' || !Number.isFinite(notificationId)) return null;

  const title = (value.title ?? '').trim();
  const message = (value.message ?? '').trim();
  if (!title || !message) return null;

  return {
    notificationId,
    type: (value.type ?? 'system').toLowerCase(),
    title,
    message,
    isRead: value.isRead === true,
    readAt: value.readAt ?? null,
    bookingId: typeof value.bookingId === 'number' ? value.bookingId : null,
    actionUrl: value.actionUrl ?? null,
    createdAt: value.createdAt ?? '',
  };
};

export async function getNotifications(
  token: string,
  options?: { unreadOnly?: boolean; page?: number; pageSize?: number },
): Promise<NotificationListResult> {
  const params = new URLSearchParams();
  if (options?.unreadOnly) params.set('unreadOnly', 'true');
  if (options?.page) params.set('page', String(options.page));
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  const query = params.toString();

  const response = await apiRequest(`/notifications${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load notifications.'));
  }

  const payload = await response.json().catch(() => null) as NotificationListWireResponse | null;
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error('The notification service returned an unreadable list.');
  }

  const data = payload.data
    .map(normalizeNotification)
    .filter((item): item is NotificationDto => item !== null);

  return {
    data,
    totalCount: typeof payload.totalCount === 'number' ? payload.totalCount : data.length,
    unreadCount: typeof payload.unreadCount === 'number'
      ? payload.unreadCount
      : data.filter((item) => !item.isRead).length,
    page: payload.page ?? 1,
    pageSize: payload.pageSize ?? data.length,
    totalPages: payload.totalPages ?? 1,
  };
}

export async function getUnreadNotificationCount(token: string): Promise<number> {
  const response = await apiRequest('/notifications/unread-count', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load the unread notification count.'));
  }

  const payload = await response.json().catch(() => null) as { unreadCount?: number } | null;
  return typeof payload?.unreadCount === 'number' ? payload.unreadCount : 0;
}

export interface NotificationMutationResult {
  success: boolean;
  message: string;
  affected: number;
  unreadCount: number;
}

async function readMutation(
  response: Response,
  fallback: string,
): Promise<NotificationMutationResult> {
  if (!response.ok) {
    throw new Error(await readApiError(response, fallback));
  }

  const payload = await response.json().catch(() => null) as NotificationMutationWireResponse | null;
  if (payload?.success === false) {
    throw new Error(payload.message || fallback);
  }

  return {
    success: true,
    message: payload?.message ?? fallback,
    affected: payload?.affected ?? 0,
    unreadCount: payload?.unreadCount ?? 0,
  };
}

export async function markNotificationRead(
  token: string,
  notificationId: number,
): Promise<NotificationMutationResult> {
  const response = await apiRequest(`/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: authorizationHeaders(token),
  });
  return readMutation(response, 'Unable to mark the notification as read.');
}

export async function markAllNotificationsRead(token: string): Promise<NotificationMutationResult> {
  const response = await apiRequest('/notifications/read-all', {
    method: 'PUT',
    headers: authorizationHeaders(token),
  });
  return readMutation(response, 'Unable to mark all notifications as read.');
}

export async function deleteNotification(
  token: string,
  notificationId: number,
): Promise<NotificationMutationResult> {
  const response = await apiRequest(`/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: authorizationHeaders(token),
  });
  return readMutation(response, 'Unable to delete the notification.');
}
