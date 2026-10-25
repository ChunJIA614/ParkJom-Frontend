import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationDto,
} from '@/services/notificationApi';

/**
 * Shared notification inbox state for the commuter, owner, and admin bells.
 *
 * The bell is a read of server truth: nothing is invented locally. When an
 * action on the server is expected to emit a notification, callers call
 * `refresh()` afterwards rather than pushing a synthetic item into the list.
 */
export interface UseNotificationsResult {
  notifications: NotificationDto[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<boolean>;
  markRead: (notificationId: number) => Promise<void>;
}

export function useNotifications(token: string | null | undefined, pageSize = 30): UseNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a slow response from a previous token overwriting a newer one.
  const requestIdRef = useRef(0);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const refresh = useCallback(async () => {
    const activeToken = tokenRef.current;
    if (!activeToken) {
      setNotifications([]);
      setUnreadCount(0);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const result = await getNotifications(activeToken, { pageSize });
      if (requestId !== requestIdRef.current) return;
      setNotifications(result.data);
      setUnreadCount(result.unreadCount);
      setError(null);
    } catch (refreshError) {
      if (requestId !== requestIdRef.current) return;
      setError(refreshError instanceof Error
        ? refreshError.message
        : 'Unable to load notifications.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    void refresh();
  }, [refresh, token]);

  const markAllRead = useCallback(async () => {
    const activeToken = tokenRef.current;
    if (!activeToken) return false;

    const previous = notifications;
    // Optimistic: the badge should clear immediately. Rolled back on failure.
    setNotifications((current) => current.map((item) => ({
      ...item,
      isRead: true,
      readAt: item.readAt ?? new Date().toISOString(),
    })));
    setUnreadCount(0);

    try {
      const result = await markAllNotificationsRead(activeToken);
      setUnreadCount(result.unreadCount);
      setError(null);
      return true;
    } catch (markError) {
      setNotifications(previous);
      setUnreadCount(previous.filter((item) => !item.isRead).length);
      setError(markError instanceof Error
        ? markError.message
        : 'Unable to mark all notifications as read.');
      return false;
    }
  }, [notifications]);

  const markRead = useCallback(async (notificationId: number) => {
    const activeToken = tokenRef.current;
    if (!activeToken) return;

    const target = notifications.find((item) => item.notificationId === notificationId);
    if (!target || target.isRead) return;

    setNotifications((current) => current.map((item) => item.notificationId === notificationId
      ? { ...item, isRead: true, readAt: new Date().toISOString() }
      : item));
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      const result = await markNotificationRead(activeToken, notificationId);
      setUnreadCount(result.unreadCount);
    } catch {
      // Re-sync instead of guessing which item to revert.
      void refresh();
    }
  }, [notifications, refresh]);

  return { notifications, unreadCount, loading, error, refresh, markAllRead, markRead };
}

/**
 * "Just now" / "12 min ago" / "3 hr ago" / "Yesterday" / "12 Mar 2026".
 * Falls back to an empty string when the server timestamp is unparseable, so
 * the UI never prints "Invalid Date".
 */
export function formatNotificationTime(createdAt: string): string {
  if (!createdAt) return '';
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return '';

  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 0) return 'Just now';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
