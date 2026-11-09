# ParkJom Frontend

ParkJom is the frontend for a smart transit-parking platform in the Klang Valley. It supports commuters looking for parking near rail stations, parking owners managing bays and availability, and administrators operating the platform.

This repository is frontend-only. The API, auth backend, data persistence, and IoT services are separate system components.

## What Is In Here

- Public landing page with a cinematic hero and role-based entry points
- Google OAuth sign-in and persisted client session state
- Role-aware routing for Commuter, Owner, Property Management, and Admin users
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
| `/` | Public | Login page, or dashboard redirect for guests and signed-in users |
| `/login` | Public | Google sign-in |
| `/home`, `/landing` | Public | Landing page |
| `/commuter` | Guest or Commuter | Commuter dashboard |
| `/commuter/parking/:id` | Guest or Commuter | Parking detail |
| `/owner` | Owner | Owner dashboard |
| `/management` | Property Management | Property management dashboard |
| `/admin` | Admin | Admin dashboard |

When a signed-in user visits the wrong role route, the app redirects to the correct dashboard.

## Local Setup

Use Node.js 22 or newer.

```bash
npm ci
npm run dev
```

The dev server runs on port 3000. It proxies `/api` requests to the target configured in [vite.config.ts](./vite.config.ts).

## Configuration

Use Vite environment variables with the `VITE_` prefix.

For a new local setup, copy [.env.example](./.env.example) to `.env.local` and fill in the values you need. Production client defaults live in `.env.production`.

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

Android and iOS projects live in `android/` and `ios/`. See [the mobile build guide](./docs/mobile.md) for Capacitor sync, Android installers, Google sign-in, and iOS signing.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server on port 3000. |
| `npm run preview` | Preview the production build locally. |
| `npm run build` | Create a production build in `dist/`. |
| `npm run typecheck` | Type-check the project with TypeScript. |
| `npm run lint` | Compatibility alias for `typecheck`. |
| `npm test` | Run parking-coordinate, vehicle-storage, and native sign-in regression checks. |
| `npm run check` | Run type checking, regression checks, and the production build. |
| `npm run mobile:sync` | Build the web app and copy it into Android and iOS projects. |
| `npm run mobile:android` | Sync and open the Android project in Android Studio. |
| `npm run mobile:ios` | Sync and open the iOS project in Xcode. |
| `npm run deploy` | Build and deploy the site to Firebase Hosting. |

## Deploy

Firebase Hosting is configured for SPA routing in [firebase.json](./firebase.json). The default Firebase project is `united-perigee-400000`, defined in [.firebaserc](./.firebaserc).

### GitHub checks

Open a pull request with your changes. The frontend workflow installs the locked dependencies and runs `npm run check`. It also checks pushes to `main`; publishing remains a separate step.

### Firebase

Deploy the production build to Firebase Hosting with:

```bash
npm run deploy
```

That command builds the app and publishes the `dist/` output to Firebase Hosting. If you want a manual deploy, run `npm run build` first and then `firebase deploy --only hosting`.

## Project Layout

```text
src/
  app/                    # App shell, routes, providers, styles, and theme
  features/               # Feature-owned pages, components, APIs, and state
  components/             # Shared UI, layouts, and common components
  hooks/                  # Shared React hooks
  lib/                    # Shared utilities
  services/               # Shared API clients and integrations
  types/                  # Global TypeScript declarations
  main.tsx                # Application entry point
public/                   # Static files served at fixed URLs
android/                  # Android source project
ios/                      # iOS source project
tests/                    # Automated data regression checks
scripts/                  # Asset maintenance and native build helpers
  archive/                # Historical, manual browser diagnostics
docs/                     # Build guides and historical reference material
.github/workflows/        # Frontend continuous integration
```

See [project organization](./docs/project-structure.md) for file placement and cleanup decisions.

## Build Check

Before publishing changes, run:

```bash
npm run check
```

All checks should finish without errors. The frontend CI workflow runs the same checks for pull requests and pushes to `main`.
