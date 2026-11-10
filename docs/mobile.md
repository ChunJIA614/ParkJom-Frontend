# Mobile Apps

The mobile apps are thin Capacitor wrappers around the existing PWA. Feature screens remain in `src/`; native projects live in `android/` and `ios/`.

The current application ID is `com.parkjom.app`. Confirm this ID before publishing because changing it after release creates a separate store application.

The Android build requires Android Studio and JDK 21. The iOS build requires macOS and Xcode. iOS dependencies, signing, and simulator/device testing cannot be completed on Windows.

After installing dependencies, sync the web build into the native projects:

```bash
npm install
npm run mobile:sync
```

Open a native project with `npm run mobile:android` or `npm run mobile:ios`. Run `npm run mobile:sync` again after web-code changes.

The sync hook also keeps iOS Swift package paths portable between Windows and macOS and checks that each local plugin package exists.

## Build an Android installer

In PowerShell, from the repository root:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npm run mobile:sync
Set-Location android
.\gradlew.bat :app:assembleDebug :app:lintDebug
```

Adjust `JAVA_HOME` if Java 21 is installed elsewhere. The installable test APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to an Android phone to install it, or use `adb install -r app/build/outputs/apk/debug/app-debug.apk` from `android/` with a phone or emulator connected. This build uses the development signing certificate; store distribution needs a release signing key.

For Google sign-in on this development machine, register an Android OAuth client in the web client's Google Cloud project with package `com.parkjom.app` and SHA-1 `EC:D5:47:DE:2E:1A:21:F7:C9:54:03:DF:1F:1F:57:BE:3D:38:A2:74`. Other machines and release keys have different fingerprints; read them with `gradlew signingReport`.

## Google sign-in

### Web origin errors

For web sign-in, Google must also allow the exact origin (scheme, hostname, and port) on the **Web application** client. ParkJom uses `https://localhost:3000` for development and `https://united-perigee-400000.web.app` for hosting. Add those in **Authorized JavaScript origins**, without a trailing path. Keep any other origins that are still in use. An `origin_mismatch` happens before the API receives a token; changing API CORS settings cannot repair it. See [Google's origin configuration](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

Production hosting currently retains the legacy `917128720686` client to match the deployed API. Page-design releases keep that configuration. The migration to `681911813064` is pending [backend PR #64](https://github.com/junkerino1/ParkJomV2/pull/64); publish the frontend client change only after the matching API configuration is deployed.

### Client alignment and Android troubleshooting

The pending client configuration and local API use `681911813064-uk2mmra0532rp7gcmq3frfj5h37siq5d.apps.googleusercontent.com`. The API's `GoogleOAuth:ClientId` (or the Azure setting `GoogleOAuth__ClientId`) must accept the same ID as the published frontend. A deployed environment setting overrides `appsettings.json`. Keep ID-token signature and audience validation enabled.

`[28444] Developer console is not set up correctly` indicates that Google rejected this installed application's OAuth setup. Confirm the Android package and certificate below in the same project as the web client. The Android client ID is not the value used for `VITE_GOOGLE_WEB_CLIENT_ID`.

`[16] Account reauth failed` is raised by Google's native sign-in flow before ParkJom receives an ID token or calls `/api/auth/google`. It can result from Android OAuth registration or Google account/consent restrictions; the message alone does not identify which one.

1. Open [Google Auth Platform — Clients](https://console.cloud.google.com/auth/clients) in the project containing the existing web client `681911813064-uk2mmra0532rp7gcmq3frfj5h37siq5d.apps.googleusercontent.com`.
2. Check for an OAuth client of type **Android** with package **`com.parkjom.app`** and SHA-1 **`EC:D5:47:DE:2E:1A:21:F7:C9:54:03:DF:1F:1F:57:BE:3D:38:A2:74`**. This fingerprint was verified from the delivered debug APK. Create the client if it is missing, or correct a mismatch. Keep the existing web client ID in the app.
3. Under **Audience**, check whether access is restricted to an organization or to test users. If the project is in Testing, include the Google account used on the phone.
4. If registration and audience settings match, check whether the affected account has disabled Sign in with Google for ParkJom or has supervised-account restrictions. Try another permitted Google account to distinguish an account-specific failure.

The plugin already clears its Credential Manager selection state and retries this error once. The app does not add another retry loop. Full provider diagnostics remain in developer logs; app users receive a short error message.

Registration changes may take time to propagate. If the error persists, connect the affected phone with USB debugging enabled and inspect `adb logcat -s GoogleProvider` while reproducing sign-in. Compare the logged package, certificate SHA-1, and web client with the Cloud client settings. Do not share ID tokens or account credentials.

See [Google's client-authentication requirements](https://developers.google.com/android/guides/client-auth) and [the plugin's required Cloud setup](https://capgo.app/docs/plugins/social-login/google/android/#required-google-cloud-setup).

## Device safe areas

Capacitor SystemBars handles Android window insets. Shared `--parkjom-safe-*` variables consume its injected values and fall back to the browser/iOS `env()` values. The sidebar header and footer, dashboard header, welcome screen, and edge controls use these shared values. This also handles insets that change on rotation. See [Capacitor SystemBars](https://capacitorjs.com/docs/apis/system-bars).

## Verify the login experience

The login background keeps five equal-sized top-down cars beside the desktop form and three across the mobile background. Cars cruise on their own and steer their headlights toward nearby pointer/touch input. The form stays stationary; reduced-motion settings disable the movement. `npm test` checks car counts, cruising, steering, headlights, and fixed body dimensions without requiring a browser.

`npm run check` runs type checks, regression checks, and the production build. For browser checks, start a local dev server at `https://localhost:4187`, then run `npm run test:ui`. Set `PARKJOM_TEST_BASE_URL` for another local address and `PARKJOM_TEST_BROWSER` for a different browser executable. The browser checks use mock API responses and a test account, and verify magnetic motion, reduced motion, native safe-area spacing, a single welcome screen during a slow route download, and recovery from a failed download. They do not sign into a real Google account.

## Finish the iOS app on a Mac

The iOS source project is `ios/App/App.xcodeproj`. Windows can sync its web assets and plugin references, but cannot compile or sign an iPhone installer.

1. Create a Google OAuth client of type **iOS**, using bundle ID `com.parkjom.app`, in the same Google Cloud project as the existing web client.
2. Set `VITE_GOOGLE_IOS_CLIENT_ID` in `.env.production` to that client ID. Add its reversed client ID as another URL scheme in `ios/App/App/Info.plist`, preserving the existing `parkjom` scheme. For example, `123-example.apps.googleusercontent.com` becomes `com.googleusercontent.apps.123-example`.
3. On the Mac, run `npm ci`, then `npm run mobile:ios` from the repository root.
4. In Xcode, select the **App** target, choose your Apple development team under **Signing & Capabilities**, then run on an iPhone or simulator.
5. To distribute through TestFlight or the App Store, archive the app in Xcode and upload it using your Apple Developer account.

iOS Google sign-in remains unavailable until steps 1 and 2 are completed. The repository does not contain an Apple signing identity or a configured development team.

## Native integrations and distribution

- App Store distribution: Apple may require Sign in with Apple when Google sign-in is offered. This also needs backend token validation and is not enabled yet.
- Native wallet checkout: the top-up request sends `returnTarget: "native"`; the API bridge redirects successful and cancelled Stripe sessions to `parkjom://commuter?tab=wallet&topup=success&session_id=...` or `parkjom://commuter?tab=wallet&topup=cancelled`. Web checkout uses the configured Firebase `/commuter` return URL instead.
- Wallet recovery: the Wallet view reads `GET /api/wallet` and verifies saved Stripe sessions with `GET /api/wallet/topup/status?sessionId=...`. Only an authenticated, owner-matched session that Stripe reports as open can be resumed; completed or expired sessions are reconciled instead of reopening a terminal Checkout page.

