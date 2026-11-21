import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import { sanitizeCopilotCard, sanitizeCopilotInput } from '../lib/copilotGuards';
import type { CopilotCard, CopilotChatResponse, CopilotHistoryTurn } from '../types';

export async function sendCopilotMessage(
  token: string,
  history: CopilotHistoryTurn[],
  message: string,
  coords?: { lat: number; lng: number } | null,
  signal?: AbortSignal,
): Promise<CopilotChatResponse> {
  const cleanMessage = sanitizeCopilotInput(message, 1000);
  if (!cleanMessage) {
    throw new Error('Please enter a message for ParkJom Copilot.');
  }

  const response = await apiRequest('/copilot/chat', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      history: history.slice(-10).map((turn) => ({
        role: turn.role === 'model' ? 'model' : 'user',
        text: sanitizeCopilotInput(turn.text, 4000),
        context: turn.role === 'model' && turn.context
          ? sanitizeCopilotInput(turn.context, 4000)
          : null,
      })),
      message: cleanMessage,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    }),
    signal,
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error('You are sending messages too quickly. Please wait a moment.');
    throw new Error(await readApiError(response, 'ParkJom Copilot is unavailable right now.'));
  }

  const payload = (await response.json().catch(() => null)) as Partial<CopilotChatResponse> | null;
  if (!payload || typeof payload.reply !== 'string') {
    throw new Error('ParkJom Copilot returned an unreadable response.');
  }

  return {
    code: payload.code ?? response.status,
    success: payload.success ?? true,
    message: payload.message ?? '',
    reply: payload.reply,
    context: typeof payload.context === 'string' ? payload.context : null,
    cards: Array.isArray(payload.cards)
      ? payload.cards
        .map(sanitizeCopilotCard)
        .filter((card): card is CopilotCard => card !== null)
      : [],
    toolsUsed: Array.isArray(payload.toolsUsed)
      ? payload.toolsUsed.filter((tool): tool is string => typeof tool === 'string')
      : [],
  };
}
