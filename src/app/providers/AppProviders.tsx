import { GoogleOAuthProvider } from '@react-oauth/google';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { BrowserRouter } from 'react-router-dom';
import { useEffect, type PropsWithChildren } from 'react';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { GOOGLE_WEB_CLIENT_ID } from '@/features/auth/googleAuth';

function NativeUrlListener() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let disposed = false;

    const openAppUrl = ({ url: rawUrl }: { url: string }) => {
      try {
        const url = new URL(rawUrl);
        if (url.protocol !== 'parkjom:') return;

        const path = `/${url.hostname}${url.pathname}`.replace(/\/{2,}/g, '/');
        window.history.pushState({}, '', `${path || '/'}${url.search}${url.hash}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
        void Browser.close().catch(() => undefined);
      } catch {
        // Ignore malformed external URLs rather than navigating the app unexpectedly.
      }
    };

    let removeUrlListener: (() => Promise<void>) | undefined;
    void CapacitorApp.addListener('appUrlOpen', openAppUrl).then((listener) => {
      if (disposed) {
        void listener.remove();
        return;
      }
      removeUrlListener = () => listener.remove();
    });
    void CapacitorApp.getLaunchUrl().then((launch) => {
      if (!disposed && launch) openAppUrl(launch);
    });

    return () => {
      disposed = true;
      void removeUrlListener?.();
    };
  }, []);

  return null;
}

export function AppProviders({ children }: PropsWithChildren) {
  const auth = <AuthProvider>{children}</AuthProvider>;

  return (
    <BrowserRouter>
      <NativeUrlListener />
      {Capacitor.isNativePlatform()
        ? auth
        : <GoogleOAuthProvider clientId={GOOGLE_WEB_CLIENT_ID}>{auth}</GoogleOAuthProvider>}
    </BrowserRouter>
  );
}
