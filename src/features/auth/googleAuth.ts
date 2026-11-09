import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

export const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID
  || '917128720686-vrm50eevjakijmkftq8dj4qj7itl8d5m.apps.googleusercontent.com';

const GOOGLE_IOS_CLIENT_ID = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID;
let nativeGoogleInitialized = false;

export async function signInWithNativeGoogle(): Promise<string> {
  const platform = Capacitor.getPlatform();
  if (platform === 'web') throw new Error('Native Google sign-in is unavailable in the browser.');
  if (platform === 'ios' && !GOOGLE_IOS_CLIENT_ID) {
    throw new Error('Google sign-in is not available on iPhone yet. Please browse as a guest.');
  }

  try {
    if (!nativeGoogleInitialized) {
      await SocialLogin.initialize({
        google: {
          webClientId: GOOGLE_WEB_CLIENT_ID,
          ...(platform === 'ios' ? {
            iOSClientId: GOOGLE_IOS_CLIENT_ID,
            iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
          } : {}),
          mode: 'online',
        },
      });
      nativeGoogleInitialized = true;
    }

    const { result } = await SocialLogin.login({
      provider: 'google',
      options: { scopes: ['email', 'profile'] },
    });
    const idToken = 'idToken' in result ? result.idToken : null;
    if (!idToken) throw new Error('Google did not return an identity token.');
    return idToken;
  } catch (error) {
    if (isGoogleLoginCancellation(error)) throw error;

    // Keep provider diagnostics in logs; they are not instructions for app users.
    console.error('Native Google sign-in failed:', error);
    const detail = typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : String(error);
    const message = /network|offline|failed to fetch/i.test(detail)
      ? 'Unable to reach Google. Check your internet connection and try again.'
      : /account reauth failed|\[16\]/i.test(detail)
        ? 'Google could not verify your sign-in. Try another Google account or browse as a guest.'
        : 'Google sign-in is unavailable right now. Please try again later or browse as a guest.';
    throw new Error(message, { cause: error });
  }
}

export function isGoogleLoginCancellation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'USER_CANCELLED';
}
