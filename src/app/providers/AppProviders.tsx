import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { AuthProvider } from '@/features/auth/context/AuthContext';

const GOOGLE_CLIENT_ID = '917128720686-vrm50eevjakijmkftq8dj4qj7itl8d5m.apps.googleusercontent.com';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <BrowserRouter>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AuthProvider>{children}</AuthProvider>
      </GoogleOAuthProvider>
    </BrowserRouter>
  );
}
