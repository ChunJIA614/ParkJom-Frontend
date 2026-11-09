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

## Troubleshoot Android Google sign-in

`[16] Account reauth failed` is raised by Google's native sign-in flow before ParkJom receives an ID token or calls `/api/auth/google`. It can result from Android OAuth registration or Google account/consent restrictions; the message alone does not identify which one.

1. Open [Google Auth Platform — Clients](https://console.cloud.google.com/auth/clients) in the project containing the existing web client `917128720686-vrm50eevjakijmkftq8dj4qj7itl8d5m.apps.googleusercontent.com`.
2. Check for an OAuth client of type **Android** with package **`com.parkjom.app`** and SHA-1 **`EC:D5:47:DE:2E:1A:21:F7:C9:54:03:DF:1F:1F:57:BE:3D:38:A2:74`**. This fingerprint was verified from the delivered debug APK. Create the client if it is missing, or correct a mismatch. Keep the existing web client ID in the app.
3. Under **Audience**, check whether access is restricted to an organization or to test users. If the project is in Testing, include the Google account used on the phone.
4. If registration and audience settings match, check whether the affected account has disabled Sign in with Google for ParkJom or has supervised-account restrictions. Try another permitted Google account to distinguish an account-specific failure.

The plugin already clears its Credential Manager selection state and retries this error once. The app does not add another retry loop. Full provider diagnostics remain in developer logs; app users receive a short error message.

Registration changes may take time to propagate. If the error persists, connect the affected phone with USB debugging enabled and inspect `adb logcat -s GoogleProvider` while reproducing sign-in. Compare the logged package, certificate SHA-1, and web client with the Cloud client settings. Do not share ID tokens or account credentials.

See [Google's client-authentication requirements](https://developers.google.com/android/guides/client-auth) and [the plugin's required Cloud setup](https://capgo.app/docs/plugins/social-login/google/android/#required-google-cloud-setup).

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

