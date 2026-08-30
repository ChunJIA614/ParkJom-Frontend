import type { SupportConnectionState, SupportRealtimeEvent } from '../types';

const LOCAL_EVENT = 'parkjom:support-realtime';
const CHANNEL_NAME = 'parkjom-support';

export function publishLocalSupportEvent(event: SupportRealtimeEvent) {
  window.dispatchEvent(new CustomEvent<SupportRealtimeEvent>(LOCAL_EVENT, { detail: event }));
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(event);
    channel.close();
  }
}

interface SupportRealtimeOptions {
  token: string;
  onEvent: (event: SupportRealtimeEvent) => void;
  onStateChange: (state: SupportConnectionState) => void;
}

export function connectSupportRealtime({ token, onEvent, onStateChange }: SupportRealtimeOptions) {
  const websocketUrl = import.meta.env.VITE_SUPPORT_WS_URL?.trim();
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

  if (!websocketUrl) {
    onStateChange('fallback');
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
    onStateChange('connecting');
    const separator = websocketUrl.includes('?') ? '&' : '?';
    socket = new WebSocket(`${websocketUrl}${separator}access_token=${encodeURIComponent(token)}`);

    socket.onopen = () => {
      reconnectAttempt = 0;
      onStateChange('live');
      heartbeatTimer = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }));
      }, 25_000);
    };
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(String(message.data)) as SupportRealtimeEvent;
        if (event?.type && event.ticketId) onEvent(event);
      } catch {
        // Ignore malformed realtime frames; the next REST refresh remains authoritative.
      }
    };
    socket.onerror = () => onStateChange('offline');
    socket.onclose = () => {
      if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      if (disposed) return;
      onStateChange('fallback');
      const delay = Math.min(15_000, 1_000 * 2 ** reconnectAttempt++);
      reconnectTimer = window.setTimeout(connect, delay);
    };
  };

  connect();
  return () => {
    disposed = true;
    clearSocketTimers();
    socket?.close();
    window.removeEventListener(LOCAL_EVENT, handleLocalEvent);
    channel?.close();
  };
}
