import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './app/App';
import { AppProviders } from './app/providers/AppProviders';
import './app/styles/index.css';

const localWebHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const isLocalWebHost = import.meta.env.DEV || localWebHosts.has(window.location.hostname);
    if (import.meta.env.PROD && !isLocalWebHost) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.log('SW registration skipped:', error);
      });
      return;
    }

    // Do not let a previously installed production worker serve stale local code.
    void navigator.serviceWorker.getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      })
      .catch((error) => {
        console.log('Local SW cleanup skipped:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
