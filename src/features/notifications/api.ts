import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import {
  NotificationDto,
  NotificationInboxResponse,
  NotificationPreferencesResponse,
  NotificationQuery,
  PushSubscriptionRequest,
  UnreadCountDto,
  UpdatePreferenceItem,
  AdminBroadcastRequest,
  DeliveryStatusRecord,
} from './types';

export async function fetchInbox(
  token: string,
  query: NotificationQuery = {}
): Promise<NotificationInboxResponse> {
  const params = new URLSearchParams();
  if (query.cursor) params.append('cursor', query.cursor.toString());
  if (query.limit) params.append('limit', query.limit.toString());
  if (query.status) params.append('status', query.status);
  if (query.category) params.append('category', query.category);

  const qs = params.toString();
  const response = await apiRequest(`/notifications${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load notifications.'));
  }

  return response.json();
}

export async function fetchUnreadCounts(token: string): Promise<UnreadCountDto> {
  const response = await apiRequest('/notifications/unread-count', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load unread count.'));
  }

  return response.json();
}

export const fetchUnreadCount = fetchUnreadCounts;

export async function markNotificationsAsRead(
  token: string,
  ids: number[]
): Promise<{ success: boolean; markedCount: number }> {
  const response = await apiRequest('/notifications/read', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to mark notification as read.'));
  }

  return response.json();
}

export async function markNotificationAsRead(
  token: string,
  notificationId: number
): Promise<{ success: boolean }> {
  return markNotificationsAsRead(token, [notificationId]);
}

export async function markAllNotificationsAsRead(
  token: string,
  category?: string
): Promise<{ success: boolean; count: number }> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  const response = await apiRequest(`/notifications/read-all${qs}`, {
    method: 'POST',
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to mark all notifications as read.'));
  }

  return response.json();
}

export async function archiveNotification(
  token: string,
  notificationId: number
): Promise<{ success: boolean }> {
  const response = await apiRequest(`/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to archive notification.'));
  }

  return response.json();
}

export async function fetchNotificationPreferences(
  token: string
): Promise<NotificationPreferencesResponse> {
  const response = await apiRequest('/notifications/preferences', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load preferences.'));
  }

  return response.json();
}

export async function updateNotificationPreferences(
  token: string,
  preferences: UpdatePreferenceItem[]
): Promise<{ success: boolean }> {
  const response = await apiRequest('/notifications/preferences', {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({ preferences }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to update preferences.'));
  }

  return response.json();
}

export async function fetchVapidPublicKey(token: string): Promise<{ publicKey: string }> {
  const response = await apiRequest('/notifications/push/vapid-public-key', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load VAPID key.'));
  }

  return response.json();
}

export async function registerPushSubscription(
  token: string,
  sub: PushSubscriptionRequest
): Promise<{ success: boolean }> {
  const response = await apiRequest('/notifications/push/subscriptions', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(sub),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to register push subscription.'));
  }

  return response.json();
}

export async function unregisterPushSubscription(
  token: string,
  endpoint: string
): Promise<{ success: boolean }> {
  const response = await apiRequest(
    `/notifications/push/subscriptions?endpoint=${encodeURIComponent(endpoint)}`,
    {
      method: 'DELETE',
      headers: authorizationHeaders(token),
    }
  );

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to remove push subscription.'));
  }

  return response.json();
}

export async function sendAdminBroadcast(
  token: string,
  request: AdminBroadcastRequest
): Promise<{ success: boolean; recipientCount: number; message: string }> {
  const response = await apiRequest('/admin/notifications/broadcast', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to dispatch broadcast.'));
  }

  return response.json();
}

export async function fetchAdminDeliveries(
  token: string,
  status?: string,
  limit: number = 50
): Promise<DeliveryStatusRecord[]> {
  const qs = new URLSearchParams();
  if (status) qs.append('status', status);
  if (limit) qs.append('limit', limit.toString());

  const response = await apiRequest(`/admin/notifications/deliveries?${qs.toString()}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch delivery audit logs.'));
  }

  return response.json();
}
