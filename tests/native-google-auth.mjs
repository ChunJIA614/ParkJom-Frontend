import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

// Exercise the real native sign-in boundary without using a Google account.
const source = readFileSync('src/features/auth/googleAuth.ts', 'utf8')
  .replace("import { Capacitor } from '@capacitor/core';", 'const Capacitor = globalThis.__parkjomGoogleTest.capacitor;')
  .replace("import { SocialLogin } from '@capgo/capacitor-social-login';", 'const SocialLogin = globalThis.__parkjomGoogleTest.socialLogin;');
const { code } = transformSync(source, {
  loader: 'ts', format: 'esm', target: 'es2022',
  define: {
    'import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID': JSON.stringify('test-web.apps.googleusercontent.com'),
    'import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID': 'undefined',
  },
});
let fixtureId = 0;
async function fixture(overrides = {}) {
  const calls = { initialize: [], login: [] };
  globalThis.__parkjomGoogleTest = {
    capacitor: { getPlatform: () => overrides.platform ?? 'android' },
    socialLogin: {
      initialize: async (options) => {
        calls.initialize.push(options);
        if (overrides.initializeError) throw overrides.initializeError;
      },
      login: async (options) => {
        calls.login.push(options);
        if (overrides.loginError) throw overrides.loginError;
        return { result: { idToken: overrides.missingToken ? null : 'test-id-token' } };
      },
    },
  };
  const auth = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${++fixtureId}`);
  return { ...auth, calls };
}

const diagnostics = [];
const originalConsoleError = console.error;
console.error = (...args) => diagnostics.push(args);
try {
  const success = await fixture();
  assert.equal(await success.signInWithNativeGoogle(), 'test-id-token');
  assert.equal(await success.signInWithNativeGoogle(), 'test-id-token');
  assert.equal(success.calls.initialize.length, 1);
  assert.equal(success.calls.initialize[0].google.webClientId, 'test-web.apps.googleusercontent.com');

  const rawReauth = new Error('Google Sign-In failed: [16] Account reauth failed. See Logcat tag GoogleProvider for signingSha1 and webClientId.');
  const reauth = await fixture({ loginError: rawReauth });
  await assert.rejects(reauth.signInWithNativeGoogle(), (error) => {
    assert.match(error.message, /could not verify your sign-in/);
    assert.doesNotMatch(error.message, /Logcat|signingSha1|webClientId|\[16\]/);
    assert.equal(error.cause, rawReauth);
    return true;
  });
  assert.equal(reauth.calls.login.length, 1, 'The app must not add another retry loop around the plugin');
  assert.ok(diagnostics.some((entry) => entry[1] === rawReauth));

  const cancellation = { code: 'USER_CANCELLED', message: 'User cancelled' };
  const cancelled = await fixture({ loginError: cancellation });
  const diagnosticCount = diagnostics.length;
  await assert.rejects(cancelled.signInWithNativeGoogle(), (error) => error === cancellation);
  assert.ok(cancelled.isGoogleLoginCancellation(cancellation));
  assert.equal(diagnostics.length, diagnosticCount);

  const configuration = await fixture({ loginError: { message: '[28444] Developer console is not set up correctly' } });
  await assert.rejects(configuration.signInWithNativeGoogle(), /Google sign-in is unavailable right now/);
  const network = await fixture({ loginError: new Error('Network error') });
  await assert.rejects(network.signInWithNativeGoogle(), /Check your internet connection/);
  const initialize = await fixture({ initializeError: new Error('Client ID is not set') });
  await assert.rejects(initialize.signInWithNativeGoogle(), /Google sign-in is unavailable right now/);
  assert.equal(initialize.calls.login.length, 0);
  const missingToken = await fixture({ missingToken: true });
  await assert.rejects(missingToken.signInWithNativeGoogle(), /Google sign-in is unavailable right now/);
  const ios = await fixture({ platform: 'ios' });
  await assert.rejects(ios.signInWithNativeGoogle(), /not available on iPhone yet/);
  console.log('Native Google auth: token flow, initialization, cancellation, reauth, configuration, network, and missing-token checks passed.');
} finally {
  console.error = originalConsoleError;
  delete globalThis.__parkjomGoogleTest;
}
