import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { useAuth } from '@/features/auth/context/AuthContext';
import { sendCopilotMessage } from '../api/copilotApi';
import { sanitizeCopilotCard, sanitizeCopilotInput } from '../lib/copilotGuards';
import type { CopilotCard, CopilotChatMessage } from '../types';

const STORAGE_PREFIX = 'parkjom_copilot_chat_';
const MAX_STORED_MESSAGES = 30;

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Best-effort one-shot location; never blocks the chat for long. */
async function getCurrentCoords(): Promise<{ lat: number; lng: number } | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 5000, maximumAge: 120_000 });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }
    if (!navigator.geolocation) return null;
    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 120_000 },
      );
    });
  } catch {
    return null;
  }
}

export function useCopilotChat() {
  const { user } = useAuth();
  const storageKey = user ? `${STORAGE_PREFIX}${user.userId}` : null;
  const [messages, setMessages] = useState<CopilotChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Restore the per-user transcript (session only, so stale bay lists don't linger forever).
  useEffect(() => {
    if (!storageKey) { setMessages([]); return; }
    try {
      const saved = sessionStorage.getItem(storageKey);
      const parsed = saved ? (JSON.parse(saved) as unknown) : [];
      if (!Array.isArray(parsed)) {
        setMessages([]);
        return;
      }
      const restored = parsed.flatMap((entry): CopilotChatMessage[] => {
        if (!entry || typeof entry !== 'object') return [];
        const item = entry as Partial<CopilotChatMessage>;
        if (item.isError || (item.role !== 'user' && item.role !== 'model') || typeof item.text !== 'string') {
          return [];
        }
        const text = sanitizeCopilotInput(item.text, 4000);
        if (!text) return [];
        const cards = Array.isArray(item.cards)
          ? item.cards.map(sanitizeCopilotCard).filter((card): card is CopilotCard => card !== null)
          : undefined;
        return [{
          id: typeof item.id === 'string' && item.id ? item.id : newId(),
          role: item.role,
          text,
          context: item.role === 'model' && typeof item.context === 'string' ? item.context : null,
          cards,
        }];
      });
      setMessages(restored);
    } catch {
      setMessages([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const clean = messages.filter((m) => !m.isError).slice(-MAX_STORED_MESSAGES);
      sessionStorage.setItem(storageKey, JSON.stringify(clean));
    } catch { /* storage full or disabled */ }
  }, [messages, storageKey]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async (text: string) => {
    const trimmed = sanitizeCopilotInput(text, 1000);
    if (!trimmed || !user?.token || isSending) return;

    const userMessage: CopilotChatMessage = { id: newId(), role: 'user', text: trimmed };
    const history = messages
      .filter((m) => !m.isError)
      .map((m) => ({
        role: m.role,
        text: m.text,
        context: m.role === 'model' ? (m.context ?? null) : null,
      }));

    setMessages((current) => [...current, userMessage]);
    setIsSending(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      coordsRef.current ??= await getCurrentCoords();
      const result = await sendCopilotMessage(user.token, history, trimmed, coordsRef.current, controller.signal);
      if (controller.signal.aborted) return;
      setMessages((current) => [...current, {
        id: newId(),
        role: 'model',
        text: result.reply,
        context: result.context,
        cards: result.cards,
      }]);
    } catch (error) {
      if (controller.signal.aborted) return;
      setMessages((current) => [...current, {
        id: newId(),
        role: 'model',
        text: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        isError: true,
      }]);
    } finally {
      if (!controller.signal.aborted) setIsSending(false);
    }
  }, [isSending, messages, user?.token]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setIsSending(false);
    setMessages([]);
  }, []);

  return { messages, isSending, send, reset, isSignedIn: Boolean(user?.token) };
}
