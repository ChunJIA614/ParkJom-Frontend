const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const DEFAULT_API_BASE = 'https://parkjom-api-gbgcbycbcjghczgu.malaysiawest-01.azurewebsites.net/api';

const isLocalDevelopment = typeof window !== 'undefined'
  && LOCAL_HOSTS.has(window.location.hostname);

/** Resolve the backend once so feature APIs do not duplicate environment logic. */
export const API_BASE = import.meta.env.VITE_API_BASE
  || (isLocalDevelopment ? '/api' : DEFAULT_API_BASE);

export function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return fetch(`${API_BASE}${normalizedPath}`, init);
}

export async function readApiError(response: Response, fallback: string): Promise<string> {
  const responseText = await response.text().catch(() => '');
  let backendMessage = '';

  if (responseText) {
    try {
      const parsed = JSON.parse(responseText) as { message?: string; error?: string; title?: string };
      backendMessage = parsed.message || parsed.error || parsed.title || '';
    } catch {
      backendMessage = responseText.trim();
    }
  }

  const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
  return backendMessage || `${fallback} (HTTP ${status})`;
}

export function authorizationHeaders(
  token: string,
  contentType?: string,
  accept = 'application/json',
): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    ...(contentType ? { 'Content-Type': contentType } : {}),
    'Accept-Language': 'en-US,en;q=0.9',
    Accept: accept,
  };
}
