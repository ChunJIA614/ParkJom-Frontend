# ParkJom Frontend

ParkJom is the frontend for a smart transit-parking platform in the Klang Valley. It supports commuters looking for parking near rail stations, parking owners managing bays and availability, and administrators operating the platform.

This repository is frontend-only. The API, auth backend, data persistence, and IoT services are separate system components.

## What Is In Here

- Public landing page with a cinematic hero and role-based entry points
- Google OAuth sign-in and persisted client session state
- Role-aware routing for Commuter, Owner, and Admin users
- Commuter search, parking detail, journey state, wallet, vehicles, and map browsing
- Owner onboarding, availability scheduling, support, settings, and parking management views
- Admin governance, settlement, IoT health, enforcement, support, audit, and configuration views
- PWA metadata, service worker, and Firebase Hosting deployment
- Android and iOS builds through Capacitor, using the same web application code

## Stack

| Area | Technology |
| --- | --- |
| Framework | React 19 + TypeScript |
| Build tool | Vite 6 |
| Styling | Tailwind CSS 4 |
| Routing | React Router 7 |
| Animation | Motion |
| Maps | Leaflet + React Leaflet |
| Charts | Recharts |
| Authentication | Google OAuth (`@react-oauth/google`) |
| Mobile wrapper | Capacitor 8 |
| Hosting | Firebase Hosting |

## App Flow

The app boots from [index.html](./index.html), loads [src/main.tsx](./src/main.tsx), wraps the tree in providers from [src/app/providers/AppProviders.tsx](./src/app/providers/AppProviders.tsx), and resolves routes in [src/app/routes/AppRoutes.tsx](./src/app/routes/AppRoutes.tsx).

Route access is role-aware:

| Route | Access | Screen |
| --- | --- | --- |
| `/` | Public | Landing page, or dashboard redirect when signed in |
| `/login` | Public | Google sign-in |
| `/commuter` | Commuter | Commuter dashboard |
| `/commuter/parking/:id` | Commuter | Parking detail |
| `/owner` | Owner | Owner dashboard |
| `/admin` | Admin | Admin dashboard |

When a signed-in user visits the wrong role route, the app redirects to the correct dashboard.

## Local Setup

```bash
npm install
npm run dev
```

The dev server runs on port 3000. It proxies `/api` requests to the target configured in [vite.config.ts](./vite.config.ts).

## Configuration

Use Vite environment variables with the `VITE_` prefix.

```env
VITE_API_BASE=http://localhost:5276/api
VITE_API_PROXY_TARGET=http://localhost:5276
```

Notes:

- `VITE_API_BASE` overrides the API base URL used by feature code.
- If `VITE_API_BASE` is absent, the app falls back to the local `/api` proxy in development.
- `VITE_API_PROXY_TARGET` controls the Vite dev-server proxy target. If it is not set, the default target is the local API at `http://localhost:5276`.
- `VITE_GOOGLE_WEB_CLIENT_ID` is the web OAuth client ID and the server audience used by Android sign-in.
- `VITE_GOOGLE_IOS_CLIENT_ID` must be set before iOS Google sign-in can work.
- Client state is persisted in `localStorage` for auth and some dashboard/session views.

## Mobile Apps

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

### Build an Android installer

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

### Finish the iOS app on a Mac

The iOS source project is `ios/App/App.xcodeproj`. Windows can sync its web assets and plugin references, but cannot compile or sign an iPhone installer.

1. Create a Google OAuth client of type **iOS**, using bundle ID `com.parkjom.app`, in the same Google Cloud project as the existing web client.
2. Set `VITE_GOOGLE_IOS_CLIENT_ID` in `.env.production` to that client ID. Add its reversed client ID as another URL scheme in `ios/App/App/Info.plist`, preserving the existing `parkjom` scheme. For example, `123-example.apps.googleusercontent.com` becomes `com.googleusercontent.apps.123-example`.
3. On the Mac, run `npm ci`, then `npm run mobile:ios` from the repository root.
4. In Xcode, select the **App** target, choose your Apple development team under **Signing & Capabilities**, then run on an iPhone or simulator.
5. To distribute through TestFlight or the App Store, archive the app in Xcode and upload it using your Apple Developer account.

iOS Google sign-in remains unavailable until steps 1 and 2 are completed. The repository does not contain an Apple signing identity or a configured development team.

Native configuration still required:

- Android Google sign-in: create an Android OAuth client in the same Google Cloud project as `VITE_GOOGLE_WEB_CLIENT_ID`, using package `com.parkjom.app` and the SHA-1 certificate for each build key. Run `gradlew signingReport` inside `android/` to read the local certificate; release and Play App Signing certificates must be registered separately.
- iOS Google sign-in: create an iOS OAuth client for bundle ID `com.parkjom.app`, set `VITE_GOOGLE_IOS_CLIENT_ID`, and add its reversed client ID as a URL scheme in `ios/App/App/Info.plist`.
- App Store distribution: Apple may require Sign in with Apple when Google sign-in is offered. This also needs backend token validation and is not enabled yet.
- Native wallet checkout: the top-up request sends `returnTarget: "native"`; the API bridge redirects successful and cancelled Stripe sessions to `parkjom://commuter?tab=wallet&topup=success&session_id=...` or `parkjom://commuter?tab=wallet&topup=cancelled`. Web checkout uses the configured Firebase `/commuter` return URL instead.
- Wallet recovery: the Wallet view reads `GET /api/wallet` and verifies saved Stripe sessions with `GET /api/wallet/topup/status?sessionId=...`. Only an authenticated, owner-matched session that Stripe reports as open can be resumed; completed or expired sessions are reconciled instead of reopening a terminal Checkout page.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server on port 3000. |
| `npm run preview` | Preview the production build locally. |
| `npm run build` | Create a production build in `dist/`. |
| `npm run lint` | Type-check the project with TypeScript. |
| `npm run mobile:sync` | Build the web app and copy it into Android and iOS projects. |
| `npm run mobile:android` | Sync and open the Android project in Android Studio. |
| `npm run mobile:ios` | Sync and open the iOS project in Xcode. |
| `npm run deploy` | Build and deploy the site to Firebase Hosting. |

## Deploy

Firebase Hosting is configured for SPA routing in [firebase.json](./firebase.json). The default Firebase project is `united-perigee-400000`, defined in [.firebaserc](./.firebaserc).

### GitHub

Commit and push changes to the main branch:

```bash
git add README.md
git commit -m "Update README"
git push origin main
```

### Firebase

Deploy the production build to Firebase Hosting with:

```bash
npm run deploy
```

That command builds the app and publishes the `dist/` output to Firebase Hosting. If you want a manual deploy, run `npm run build` first and then `firebase deploy --only hosting`.

## Project Layout

```text
src/
├── app/                 # App composition, providers, and routing
├── features/             # Feature-specific screens, components, and data
│   ├── admin/
│   ├── auth/
│   ├── commuter/
│   ├── landing/
│   └── owner/
├── components/           # Reusable UI, layout, and common components
│   ├── ui/
│   ├── layout/
│   └── common/
├── services/             # Shared API and external-service clients
├── app/styles/           # Global styles and theme tokens
├── types/                # Global TypeScript declarations
└── main.tsx              # Vite entry point

public/                   # PWA assets, icons, images, service worker, and rail data
.github/skills/           # Project-local Codex/Copilot architecture skill
```

## Build Check

Before publishing changes, run:

```bash
npm run lint
npm run build
```

Both commands should finish without errors.
