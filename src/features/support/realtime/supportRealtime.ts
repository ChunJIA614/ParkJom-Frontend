import { API_BASE } from '@/services/apiClient';
import { SUPPORT_API } from '../api/supportApiConfig';
import type { SupportConnectionState, SupportRealtimeEvent } from '../types';

const LOCAL_EVENT = 'parkjom:support-realtime';
const CHANNEL_NAME = 'parkjom-support';

const activeSockets = new Set<WebSocket>();
const subscribedTickets = new Set<string>();

function resolveDefaultWebSocketUrl(): string {
  const configured = import.meta.env.VITE_SUPPORT_WS_URL?.trim();
  if (configured) return configured;

  if (/^https?:\/\//i.test(API_BASE)) {
    const wsOrigin = API_BASE.replace(/^http/i, 'ws').replace(/\/api\/?$/, '');
    return `${wsOrigin}${SUPPORT_API.REALTIME.WEBSOCKET}`;
  }

  if (typeof window !== 'undefined' && window.location?.host) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${SUPPORT_API.REALTIME.WEBSOCKET}`;
  }

  return '';
}

export function publishLocalSupportEvent(event: SupportRealtimeEvent) {
  window.dispatchEvent(new CustomEvent<SupportRealtimeEvent>(LOCAL_EVENT, { detail: event }));
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(event);
    channel.close();
  }
}

export function joinTicketRealtime(ticketId: string | number) {
  const key = String(ticketId);
  subscribedTickets.add(key);
  const numericOrRaw = /^\d+$/.test(key) ? Number(key) : key;
  activeSockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ action: 'JoinTicket', ticketId: numericOrRaw }));
      } catch {
        // Ignore transient send error
      }
    }
  });
}

export function leaveTicketRealtime(ticketId: string | number) {
  const key = String(ticketId);
  subscribedTickets.delete(key);
  const numericOrRaw = /^\d+$/.test(key) ? Number(key) : key;
  activeSockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ action: 'LeaveTicket', ticketId: numericOrRaw }));
      } catch {
        // Ignore transient send error
      }
    }
  });
}

interface SupportRealtimeOptions {
  token: string;
  onEvent: (event: SupportRealtimeEvent) => void;
  onStateChange?: (state: SupportConnectionState) => void;
}

export function connectSupportRealtime({ token, onEvent, onStateChange }: SupportRealtimeOptions) {
  const websocketUrl = resolveDefaultWebSocketUrl();
  let disposed = false;
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let heartbeatTimer: number | null = null;
  let reconnectAttempt = 0;

  const handleLocalEvent = (event: Event) => {
    onEvent((event as CustomEvent<SupportRealtimeEvent>).detail);
  };
  window.addEventListener(LOCAL_EVENT, handleLocalEvent);

  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  if (channel) channel.onmessage = (event: MessageEvent<SupportRealtimeEvent>) => onEvent(event.data);

  if (!websocketUrl || !token) {
    onStateChange?.('fallback');
    return () => {
      disposed = true;
      window.removeEventListener(LOCAL_EVENT, handleLocalEvent);
      channel?.close();
    };
  }

  const clearSocketTimers = () => {
    if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
    if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
    reconnectTimer = null;
    heartbeatTimer = null;
  };

  const connect = () => {
    if (disposed) return;
    onStateChange?.('connecting');
    const separator = websocketUrl.includes('?') ? '&' : '?';
    try {
      socket = new WebSocket(`${websocketUrl}${separator}access_token=${encodeURIComponent(token)}`);
    } catch {
      onStateChange?.('fallback');
      return;
    }

    socket.onopen = () => {
      reconnectAttempt = 0;
      if (socket) activeSockets.add(socket);
      onStateChange?.('live');

      subscribedTickets.forEach((key) => {
        const numericOrRaw = /^\d+$/.test(key) ? Number(key) : key;
        if (socket?.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ action: 'JoinTicket', ticketId: numericOrRaw }));
          } catch {
            // Ignore
          }
        }
      });

      heartbeatTimer = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }));
      }, 25_000);
    };
    socket.onmessage = (message) => {
      try {
        const raw = JSON.parse(String(message.data)) as any;
        const eventType = raw?.eventType || raw?.type || raw?.target;
        if (!eventType || eventType === 'ping' || eventType === 'pong') return;

        const payload = raw?.data ?? raw?.payload ?? raw;
        const normalizedEvent: SupportRealtimeEvent = {
          type: eventType,
          eventType,
          ticketId: raw?.ticketId ?? payload?.ticketId ?? payload?.ticket?.ticketId,
          incidentId: raw?.incidentId ?? payload?.incidentId ?? payload?.incident?.incidentId,
          disputeId: raw?.disputeId ?? payload?.disputeId ?? payload?.dispute?.disputeId,
          bookingId: raw?.bookingId ?? payload?.bookingId ?? null,
          occurredAt: raw?.occurredAt || raw?.timestamp || new Date().toISOString(),
          payload,
        };
        onEvent(normalizedEvent);
      } catch {
        // Ignore malformed realtime frames; the next REST refresh remains authoritative.
      }
    };
    socket.onerror = () => onStateChange?.('offline');
    socket.onclose = () => {
      if (socket) activeSockets.delete(socket);
      if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      if (disposed) return;
      onStateChange?.('fallback');
      const delay = Math.min(15_000, 1_000 * 2 ** reconnectAttempt++);
      reconnectTimer = window.setTimeout(connect, delay);
    };
  };

  connect();
  return () => {
    disposed = true;
    clearSocketTimers();
    if (socket) {
      activeSockets.delete(socket);
      socket.close();
    }
    window.removeEventListener(LOCAL_EVENT, handleLocalEvent);
    channel?.close();
  };
}
