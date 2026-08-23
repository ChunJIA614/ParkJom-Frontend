import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
    return;
  }

  window.location.assign(url);
}
