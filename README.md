# ParkJom Frontend

The web client for **ParkJom**, a smart transit-parking platform for the Klang Valley. It helps commuters reserve parking near LRT/MRT stations, enables owners to manage their parking bays, and gives administrators the tools to operate the platform and connected IoT bollards.

This repository contains the frontend only. The API, authentication service, data persistence, and IoT services are separate ParkJom system components.

## Highlights

- Public landing page with responsive, motion-based UI
- Google OAuth sign-in and persisted client session
- Role-aware routes for **Commuter**, **Owner**, and **Admin** users
- Commuter parking search, booking flow, vehicle management, wallet, and Leaflet map
- Owner property onboarding, availability scheduling, earnings, settings, and support tools
- Admin listing governance, IoT bollard monitoring, financial settlement, enforcement, support, audit, and system configuration
- PWA metadata and service-worker registration

## Tech stack

| Area | Technology |
| --- | --- |
| Framework | React 19 + TypeScript |
| Build tool | Vite 6 |
| Styling | Tailwind CSS 4 |
| Routing | React Router 7 |
| Authentication | Google OAuth (`@react-oauth/google`) |
| Maps | Leaflet + React Leaflet |
| Charts | Recharts |
| Animation | Motion |
| Hosting | Firebase Hosting |

## Prerequisites

- Node.js 20 or later
- npm
- A reachable ParkJom API for authenticated and live-data features

## Get started

```bash
npm install
npm run dev
```

The development server runs at [http://localhost:3000](http://localhost:3000). It proxies `/api` requests to the API target configured in [vite.config.ts](./vite.config.ts).

## Environment configuration

Vite only exposes environment variables prefixed with `VITE_`. For a local API, create `.env.local`:

```env
VITE_API_BASE=http://localhost:5000/api
```

`VITE_API_BASE` is used by the authentication and dashboard API calls. When it is absent in development, the client uses the `/api` proxy. Production configuration is defined in `.env.production`.

The Google OAuth client ID is currently configured in [AppProviders.tsx](./src/app/providers/AppProviders.tsx). Register the deployed and local origins in the matching Google Cloud OAuth client before testing sign-in.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server on port 3000. |
| `npm run lint` | Type-check the project with TypeScript. |
| `npm run build` | Create an optimized production build in `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run gtfs` | Run the GTFS conversion utility. |
| `npm run deploy` | Build and invoke the configured Firebase Hosting deployment workflow. |

## Project structure

```text
src/
├── app/                         # Application composition and route policy
│   ├── providers/               # Router, OAuth, and authentication providers
│   └── routes/                  # Route definitions and role guard
├── features/                    # Product areas; each owns its UI and domain code
│   ├── admin/
│   │   ├── components/          # Admin dashboard views
│   │   ├── data/                # Admin mock/bootstrap data
│   │   ├── pages/               # Route-level admin screens
│   │   └── types.ts
│   ├── auth/
│   │   ├── components/          # Google sign-in UI
│   │   ├── context/             # Authentication state and hook
│   │   └── pages/               # Login screen
│   ├── commuter/
│   │   ├── components/          # Commuter-specific UI such as the map
│   │   ├── data/                # Parking and station data
│   │   ├── pages/               # Dashboard and parking-detail routes
│   │   └── types.ts
│   ├── landing/pages/           # Public marketing page
│   └── owner/
│       ├── components/          # Owner dashboard views and forms
│       ├── data/                # Owner-specific template data
│       ├── pages/               # Route-level owner dashboard
│       └── types.ts
├── shared/                      # Reusable, product-agnostic UI
│   ├── components/              # Shared dashboard components
│   └── ui/                      # UI primitives: nav, transitions, cards, controls
├── styles/                      # Global Tailwind and application CSS
├── types/                       # Global TypeScript declarations
└── main.tsx                     # Vite entry point

public/                          # PWA assets, images, icons, and public rail data
data/                            # Source GTFS/rail datasets
```

## Frontend architecture

The codebase uses a feature-first, component-based structure:

- **Pages** are route-level composition components. They decide which feature components appear on a screen.
- **Feature components** encapsulate UI and state specific to one user role or product capability.
- **Shared components** are reusable across features and must not depend on a role-specific feature.
- **Feature data and types** live alongside the feature that owns them, avoiding a global catch-all data folder.
- **App routes** are the only place that selects feature pages based on URL and authenticated role.

Use the `@/` alias for cross-feature imports. For example:

```ts
import DashboardHeader from '@/shared/components/DashboardHeader';
import { useAuth } from '@/features/auth/context/AuthContext';
```

Prefer a relative import only for files within the same feature, such as a page importing one of its own components.

## Routes and access

| Route | Access | Screen |
| --- | --- | --- |
| `/` | Public / authenticated redirect | Landing page or the signed-in user's dashboard |
| `/login` | Public | Google sign-in |
| `/commuter` | Commuter | Commuter dashboard |
| `/commuter/parking/:id` | Commuter | Parking details |
| `/owner` | Owner | Owner dashboard |
| `/admin` | Admin | Admin dashboard |

The route guard redirects a user who attempts to access another role's dashboard to their own dashboard. The role is determined from the authenticated user data rather than from URL parameters.

## Build and deploy

Create a production build with:

```bash
npm run build
```

This writes static assets to `dist/`. Firebase Hosting settings are in [firebase.json](./firebase.json), and the project ID is in [.firebaserc](./.firebaserc).

The existing `npm run deploy` script builds the app and deploys the `dist/` output to Firebase Hosting:

```bash
npm run deploy
```

If you prefer to deploy manually, build first and then run `firebase deploy --only hosting`.

## Quality checks

Before opening a pull request or deploying:

```bash
npm run lint
npm run build
```

Both commands should finish without errors.

