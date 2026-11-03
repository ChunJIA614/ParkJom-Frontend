import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from '@/features/auth/context/AuthContext';
import { API_BASE } from '@/services/apiClient';
import {
  NotificationDto,
  NotificationInboxResponse,
  UnreadCountDto,
  NotificationQuery
} from './types';
import {
  fetchInbox,
  fetchUnreadCount,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
  archiveNotification
} from './api';

interface NotificationState {
  items: NotificationDto[];
  unreadCount: number;
  unreadByCategory: Record<string, number>;
  nextCursor: number | null;
  hasMore: boolean;
  isLoading: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  activeToast: NotificationDto | null;
}

type NotificationAction =
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_CONNECTION'; status: NotificationState['connectionStatus'] }
  | { type: 'LOAD_INBOX_SUCCESS'; response: NotificationInboxResponse; isInitial: boolean }
  | { type: 'SET_UNREAD_COUNT'; unread: UnreadCountDto }
  | { type: 'NOTIFICATION_RECEIVED'; notification: NotificationDto }
  | { type: 'MARK_READ_OPTIMISTIC'; ids: number[] }
  | { type: 'MARK_ALL_READ_OPTIMISTIC' }
  | { type: 'DISMISS_TOAST' }
  | { type: 'RESET_STATE' };

function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    case 'SET_CONNECTION':
      return { ...state, connectionStatus: action.status };
    case 'LOAD_INBOX_SUCCESS': {
      const existingIds = new Set(action.isInitial ? [] : state.items.map(i => i.id));
      const newItems = action.response.items.filter(i => !existingIds.has(i.id));
      const combined = action.isInitial ? action.response.items : [...state.items, ...newItems];

      return {
        ...state,
        items: combined,
        nextCursor: action.response.nextCursor ?? null,
        hasMore: action.response.hasMore,
        unreadCount: action.response.totalUnread,
        isLoading: false,
      };
    }
    case 'SET_UNREAD_COUNT':
      return {
        ...state,
        unreadCount: action.unread.total,
        unreadByCategory: action.unread.byCategory || {},
      };
    case 'NOTIFICATION_RECEIVED': {
      const exists = state.items.some(i => i.id === action.notification.id);
      const items = exists ? state.items : [action.notification, ...state.items];
      const isHighPriority = action.notification.priority === 'High' || action.notification.priority === 'Critical';

      return {
        ...state,
        items,
        unreadCount: state.unreadCount + 1,
        activeToast: isHighPriority ? action.notification : state.activeToast,
      };
    }
    case 'MARK_READ_OPTIMISTIC': {
      const idSet = new Set(action.ids);
      const updated = state.items.map(item =>
        idSet.has(item.id) && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item
      );
      const newlyRead = state.items.filter(item => idSet.has(item.id) && !item.readAt).length;

      return {
        ...state,
        items: updated,
        unreadCount: Math.max(0, state.unreadCount - newlyRead),
      };
    }
    case 'MARK_ALL_READ_OPTIMISTIC': {
      const updated = state.items.map(item => ({
        ...item,
        readAt: item.readAt || new Date().toISOString(),
      }));

      return {
        ...state,
        items: updated,
        unreadCount: 0,
        unreadByCategory: {},
      };
    }
    case 'DISMISS_TOAST':
      return { ...state, activeToast: null };
    case 'RESET_STATE':
      return {
        items: [],
        unreadCount: 0,
        unreadByCategory: {},
        nextCursor: null,
        hasMore: false,
        isLoading: false,
        connectionStatus: 'disconnected',
        activeToast: null,
      };
    default:
      return state;
  }
}

interface NotificationContextValue extends NotificationState {
  loadMore: () => Promise<void>;
  markRead: (ids: number[]) => Promise<void>;
  markAllRead: (category?: string) => Promise<void>;
  archive: (id: number) => Promise<void>;
  dismissToast: () => void;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const token = user?.token;

  const [state, dispatch] = useReducer(notificationReducer, {
    items: [],
    unreadCount: 0,
    unreadByCategory: {},
    nextCursor: null,
    hasMore: false,
    isLoading: false,
    connectionStatus: 'disconnected',
    activeToast: null,
  });

  const hubConnectionRef = useRef<signalR.HubConnection | null>(null);

  const loadInitialData = useCallback(async (activeToken: string) => {
    try {
      dispatch({ type: 'SET_LOADING', isLoading: true });
      const [inbox, unread] = await Promise.all([
        fetchInbox(activeToken, { limit: 20 }),
        fetchUnreadCount(activeToken),
      ]);

      dispatch({ type: 'LOAD_INBOX_SUCCESS', response: inbox, isInitial: true });
      dispatch({ type: 'SET_UNREAD_COUNT', unread });
    } catch (err) {
      console.warn('Failed to load initial notifications:', err);
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, []);

  useEffect(() => {
    if (!token) {
      if (hubConnectionRef.current) {
        hubConnectionRef.current.stop();
        hubConnectionRef.current = null;
      }
      dispatch({ type: 'RESET_STATE' });
      return;
    }

    loadInitialData(token);

    // Resolve Hub URL cleanly whether in dev proxy or direct azure API
    const baseOrigin = API_BASE.replace(/\/api\/?$/, '');
    const hubUrl = `${baseOrigin}/hubs/notifications`;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    hubConnectionRef.current = connection;

    connection.on('notification.created', (notification: NotificationDto) => {
      dispatch({ type: 'NOTIFICATION_RECEIVED', notification });
    });

    connection.on('notification.read', (payload: { ids?: number[]; all?: boolean; unreadCount: UnreadCountDto }) => {
      if (payload.all) {
        dispatch({ type: 'MARK_ALL_READ_OPTIMISTIC' });
      } else if (payload.ids) {
        dispatch({ type: 'MARK_READ_OPTIMISTIC', ids: payload.ids });
      }
      if (payload.unreadCount) {
        dispatch({ type: 'SET_UNREAD_COUNT', unread: payload.unreadCount });
      }
    });

    connection.on('notification.unreadCount', (unread: UnreadCountDto) => {
      dispatch({ type: 'SET_UNREAD_COUNT', unread });
    });

    connection.onreconnecting(() => dispatch({ type: 'SET_CONNECTION', status: 'connecting' }));
    connection.onreconnected(() => {
      dispatch({ type: 'SET_CONNECTION', status: 'connected' });
      loadInitialData(token);
    });
    connection.onclose(() => dispatch({ type: 'SET_CONNECTION', status: 'disconnected' }));

    connection
      .start()
      .then(() => dispatch({ type: 'SET_CONNECTION', status: 'connected' }))
      .catch((err) => {
        console.warn('NotificationHub start failed (will retry):', err);
        dispatch({ type: 'SET_CONNECTION', status: 'disconnected' });
      });

    return () => {
      connection.stop();
      hubConnectionRef.current = null;
    };
  }, [token, loadInitialData]);

  const loadMore = useCallback(async () => {
    if (!token || !state.hasMore || state.isLoading || !state.nextCursor) return;

    try {
      dispatch({ type: 'SET_LOADING', isLoading: true });
      const response = await fetchInbox(token, {
        cursor: state.nextCursor,
        limit: 20,
      });
      dispatch({ type: 'LOAD_INBOX_SUCCESS', response, isInitial: false });
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, [token, state.hasMore, state.isLoading, state.nextCursor]);

  const markRead = useCallback(async (ids: number[]) => {
    if (!token || ids.length === 0) return;
    dispatch({ type: 'MARK_READ_OPTIMISTIC', ids });
    try {
      await markNotificationsAsRead(token, ids);
    } catch (err) {
      console.warn('Failed to mark notifications read:', err);
      if (token) {
        const unread = await fetchUnreadCount(token);
        dispatch({ type: 'SET_UNREAD_COUNT', unread });
      }
    }
  }, [token]);

  const markAllRead = useCallback(async (category?: string) => {
    if (!token) return;
    dispatch({ type: 'MARK_ALL_READ_OPTIMISTIC' });
    try {
      await markAllNotificationsAsRead(token, category);
    } catch (err) {
      console.warn('Failed to mark all read:', err);
    }
  }, [token]);

  const archive = useCallback(async (id: number) => {
    if (!token) return;
    await archiveNotification(token, id);
    const unread = await fetchUnreadCount(token);
    dispatch({ type: 'SET_UNREAD_COUNT', unread });
  }, [token]);

  const dismissToast = useCallback(() => {
    dispatch({ type: 'DISMISS_TOAST' });
  }, []);

  const refresh = useCallback(async () => {
    if (token) {
      await loadInitialData(token);
    }
  }, [token, loadInitialData]);

  return (
    <NotificationContext.Provider
      value={{
        ...state,
        loadMore,
        markRead,
        markAllRead,
        archive,
        dismissToast,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
