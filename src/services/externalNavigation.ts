import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

const LOCAL_WEB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLocalWebHost(): boolean {
  return !Capacitor.isNativePlatform()
    && typeof window !== 'undefined'
    && (import.meta.env.DEV || LOCAL_WEB_HOSTS.has(window.location.hostname));
}

/** Reserve a popup from the click event so browsers do not block checkout later. */
export function reserveExternalWindow(): Window | null {
  if (!isLocalWebHost()) return null;

  try {
    const externalWindow = window.open('about:blank', '_blank');
    if (externalWindow) {
      try {
        externalWindow.opener = null;
      } catch {
        // Some embedded browsers expose a read-only opener property.
      }
    }
    return externalWindow;
  } catch {
    return null;
  }
}

export function closeExternalWindow(externalWindow: Window | null | undefined): void {
  try {
    if (externalWindow && !externalWindow.closed) externalWindow.close();
  } catch {
    // The checkout window may already have been released by the browser.
  }
}

export async function openExternalUrl(url: string, reservedWindow?: Window | null): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
    return;
  }

  if (isLocalWebHost()) {
    if (!reservedWindow || reservedWindow.closed) {
      throw new Error('Allow pop-ups to open secure checkout while testing locally.');
    }

    reservedWindow.location.href = url;
    try {
      reservedWindow.focus();
    } catch {
      // Focusing is best-effort after cross-origin navigation.
    }
    return;
  }

  window.location.assign(url);
}
