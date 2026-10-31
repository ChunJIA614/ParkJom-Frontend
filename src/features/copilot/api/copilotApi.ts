import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type { CopilotCard, CopilotChatResponse, CopilotHistoryTurn } from '../types';

const KNOWN_CARD_TYPES = new Set(['parking', 'departures', 'bookingProposal']);

export async function sendCopilotMessage(
  token: string,
  history: CopilotHistoryTurn[],
  message: string,
  coords?: { lat: number; lng: number } | null,
  signal?: AbortSignal,
): Promise<CopilotChatResponse> {
  const response = await apiRequest('/copilot/chat', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      history: history.slice(-10).map((turn) => ({
        role: turn.role,
        text: turn.text.slice(0, 4000),
        context: turn.context ? turn.context.slice(0, 4000) : null,
      })),
      message,
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
    context: payload.context ?? null,
    cards: Array.isArray(payload.cards)
      ? payload.cards.filter((card): card is CopilotCard =>
        Boolean(card && KNOWN_CARD_TYPES.has((card as CopilotCard).type) && (card as CopilotCard).data))
      : [],
    toolsUsed: Array.isArray(payload.toolsUsed) ? payload.toolsUsed : [],
  };
}
