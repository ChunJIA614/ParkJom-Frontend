# ParkJom Frontend — API Integration & Feature Completeness Audit

> **Status update (25 Oct 2026, later same day):** Tier 1 of this audit has been implemented — owner earnings wired (`OwnerWalletPanel`), owner dashboard bookings shared, commuter barrier release moved onto `POST /api/support/gate-unlock` with a real GPS check, and the four empty backend controllers plus the dead `ParkJomV2.Web` project reference removed. Sections 2.1, 2.2, 2.4, 3.4 and 4 below describe the **pre-fix** state and are retained as evidence. See the implementation log in `PROJECT-STATUS.md` for what changed.

**Date:** 25 October 2026
**Scope:** `src/` (whole system — Admin, Owner, Commuter, Support, Auth, Profile, Services)
**Method:** Static trace of every `apiRequest()` call site, every API module import, and every component data source. `npx tsc --noEmit` passes clean, so all findings below are *silent* runtime gaps — they compile fine and fail at the product level.

---

## Executive summary

| Module | Backend-wired | Gaps |
|---|---|---|
| Auth | ✅ Full | — |
| Profile | ✅ Full | — |
| Admin — Users, Vehicles, Listing Governance, Audit | ✅ Full | — |
| Admin — Overview KPIs, IoT, Settlement, Overstay, System Config | ❌ **None** | 5 screens |
| Owner — Parking, Availability, Images, Reviews, Bookings | ✅ Full | — |
| Owner — Wallet, Bank, Dashboard bookings | ❌ **None** | 3 features |
| Commuter — Search, Book, Pay, Review, Favorites, **Vehicles** | ✅ Full | — |
| Commuter — Notifications, Active journey, Bollard unlock | ❌ **None** | 3 features |
| Support (all roles) | ✅ Full | — |
| Transit / GTFS / Routing | ✅ Full | — |

**Headline:** 11 functional areas are UI-only. The Admin role is the worst affected — **5 of its 10 screens have zero backend connection** and fake every action with `setTimeout`. `owner/api/earningsApi.ts` was written but is imported nowhere. (The orphaned `commuter/api/vehicleApi.ts` has since been wired up — see §3.1.)

---

## 1. CRITICAL — Admin screens with no backend at all

### 1.1 Platform Overview KPIs — always zero
**File:** `src/features/admin/pages/AdminDashboard.tsx:73`, `src/features/admin/data/mockData.ts:4-13`

`stats` is seeded from `initialStats`, which is a literal object of zeros. Grepping the whole codebase for the field names proves nothing ever assigns them:

- `totalRevenue` — never set
- `platformCommission` — only recomputed locally by the System Config slider
- `activeBookings` — never set
- `totalUsers` — never set
- `openDisputesCount` — never set

`onlineBollardsRate` is recalculated as `online / bollards.length` inside `addActivityLog`. Because `bollards` is always `[]`, this evaluates to **`NaN`** and renders as `NaN%` on the overview.

**Missing endpoint:** `GET /admin/dashboard` (or `/admin/stats`). Nothing resembling it exists in the codebase.

---

### 1.2 Smart Bollards / IoT Health Monitor — fully simulated
**Files:** `AdminDashboard.tsx:74`, `src/features/admin/components/IotHealthMonitor.tsx`

- `bollards` starts as `[]` and is **never fetched**. The device grid, Online/Offline/Alert filter counts, battery levels and RSSI values are all permanently empty.
- Raise / lower barrier → `setTimeout` only (`:37`, `:41`)
- Reboot device → `setTimeout`, and line 58 literally comments *"Refill empty battery on mock reboot diagnostic"*
- Diagnostic sweep → `setTimeout` that writes `randomSignalNoise` into state (`:312`)

**Missing endpoints:** `GET /admin/iot/bollards`, `POST /admin/iot/bollards/{id}/command`, `POST /admin/iot/bollards/{id}/reboot`.

---

### 1.3 Settlement / Finance — fully simulated
**Files:** `AdminDashboard.tsx:89-90`, `src/features/admin/components/FinanceSettlement.tsx`

- `payouts` and `transactions` both start `[]` and are never fetched. Both tables render empty forever.
- "Process payout" → `setTimeout(400ms)` then mutates local state (`:50`)
- **CSV export is fake.** Line 214 shows the toast *"Financial audit spreadsheet exported successfully (MOCK Excel Sheet downloaded)"* — no Blob, no anchor, no file is ever created.

**Missing endpoints:** `GET /admin/payouts`, `GET /admin/transactions`, `POST /admin/payouts/{id}/process`, `GET /admin/settlement/export`.

---

### 1.4 Overstay Enforcement — fully simulated
**Files:** `AdminDashboard.tsx:91`, `src/features/admin/components/OverstayEnforcement.tsx`

- `overstays` starts `[]`, never fetched.
- Warn / penalise / resolve → **8 `setTimeout` calls**, all local `setState`. No penalty is ever recorded server-side, no notice reaches the commuter.

**Missing endpoints:** `GET /admin/overstays`, `POST /admin/overstays/{id}/warn|penalize|resolve`.

---

### 1.5 System Configuration — nothing persists
**File:** `src/features/admin/components/SystemConfiguration.tsx:28-55`

- `handleUpdateConfig` wraps a `setTimeout(400ms)` around `setSystemConfig` — a fake latency spinner around a local setter.
- `handleResetDefaults` does the same.
- **No endpoint, no persistence.** Values reset to `15 / 15` on every page refresh.
- This is not cosmetic: `commissionRate` is read by FinanceSettlement and `gracePeriodMinutes` by OverstayEnforcement, so two other screens depend on a value that can never be saved.

**Missing endpoints:** `GET /admin/system-config`, `PUT /admin/system-config`.

---

### 1.6 Dead prop
`DashboardHome.tsx:18` declares `setStats` in its props interface but never calls it. `AdminDashboard` passes it anyway.

---

## 2. CRITICAL — Owner module gaps

### 2.1 Wallet balance — hardcoded, and the API is orphaned
**Files:** `src/features/owner/pages/OwnerDashboard.tsx:121-122`, `src/features/owner/api/earningsApi.ts`

```ts
// 1. Wallet Balance (RM) — TODO: fetch from backend
const [walletBalance, setWalletBalance] = useState(0);
```

`earningsApi.ts` implements `getOwnerEarningsSummary()` (`GET /owner/earnings/summary`) and `getOwnerEarningsTransactions()` (`GET /owner/earnings/transactions`). **Neither function is imported anywhere in the app.** The endpoints exist on the backend and the client code is finished — it is simply never called.

### 2.2 Withdraw flow — unreachable dead code
`handleWithdrawFunds` (`:205-232`) fabricates a `WITHDRAWAL` booking row and a notification in local state. There is no `POST /owner/withdrawals`. Additionally the trigger is unreachable: `DashboardHome` no longer renders `walletBalance` / `onWithdraw` (they survive only in the props interface), so a user cannot even reach this flow.

### 2.3 Bank beneficiary — hardcoded placeholders
**Files:** `OwnerDashboard.tsx:135-136`, `src/features/owner/components/SettingsPanel.tsx:34-41`

```ts
const [activeBank, setActiveBank] = useState({ name: '-', accNo: '-', holder: '-' });
```

`SettingsPanel` collects bank name / account number / beneficiary and calls `onSaveBank`, which only updates local state and shows a success dialog. No `GET`/`PUT /owner/payout-account`. The values are lost on refresh, and since payouts (1.3) are also unbuilt, there is no downstream consumer yet.

### 2.4 Dashboard "recent bookings" / "booked today" — always empty
**File:** `OwnerDashboard.tsx:129-130`

`bookings` starts `[]`; the only two `setBookings` calls are inside the two fake handlers from 2.2 and the fake `handleResolveDispute`. Consequence: `DashboardHome.scheduleStatus()` (`:141-160`) can never match a booking, so the **"Booked now / Booked today"** badge on every bay card never appears, and bays are always presented as available.

Note the data *is* available: `OwnerBookingHistory.tsx` fetches correctly via `getOwnerAllSpotsBookingHistory()`. It just isn't shared with the dashboard.

### 2.5 Dead file
`src/features/owner/components/SupportTickets.tsx` is never rendered — `OwnerDashboard.tsx:520` renders `SupportWorkspace` instead.

---

## 3. CRITICAL — Commuter module gaps

### 3.1 Vehicles — local storage, seeded with a fake car — ✅ FIXED
**Files:** `src/features/commuter/lib/vehicleStorage.ts:18-45`, `src/features/commuter/api/vehicleApi.ts`

This is the most damaging finding. `loadCachedVehicles()` returns a **hardcoded dummy vehicle** whenever the cache is empty, missing, or unparseable:

```ts
return [{ vehicleId: 1, plate: 'WXY 8899', brand: 'Perodua',
          model: 'Myvi', color: 'White', active: true }];
```

That object appears three separate times in the file (empty cache, empty array, exception fallback). A brand-new user therefore sees a Perodua Myvi they do not own.

Meanwhile `commuter/api/vehicleApi.ts` implements `getMyVehicles`, `addVehicle`, `modifyVehicle`, `deleteVehicle` and is **imported by nothing**. The file header states this is deliberate: *"Manages commuter vehicle data locally … without making unnecessary network requests to /api/vehicle/my-vehicle."*

Add / edit / delete all write to `localStorage` only (`CommuterDashboard.tsx:491`). **Risk:** `confirmBooking` sends the locally-stored `vehicleId` (often the fake `1`) to the backend, which has no such vehicle — booking confirmation can fail or attach the wrong vehicle.

> **RESOLVED.** `vehicleStorage.ts` is now a pure read-through cache: no fabricated entries, a `v2` cache key that orphans (and actively purges) the poisoned legacy cache, and `[]` for every empty/corrupt case. `CommuterDashboard` and `ParkingDetail` now call `getMyVehicles` / `addVehicle` / `modifyVehicle` / `deleteVehicle`; the `vehicleId: Date.now()` placeholder and the `vehicleId ?? 1` coercion are gone, as is the `'VGV 8899'` fallback plate. Verified by `scripts/check-vehicle-storage.mjs` (13 assertions).

### 3.2 Notifications — always empty
**File:** `CommuterDashboard.tsx:412-413`

```ts
// Notifications — TODO: fetch from backend
const [notifications, setNotifications] = useState<AppNotification[]>([]);
```

The bell badge and drawer are populated only by local actions in the same session (bollard lowered, withdrawal, etc.). **There is no notifications endpoint anywhere in the codebase** — no `/notifications`, no `/commuter/notifications`. Notifications vanish on reload. The owner side has the same problem via a `localStorage`-backed store.

### 3.3 Active journey / session — device-local only
**File:** `CommuterDashboard.tsx:394-396`

```ts
// Active Reservation / Session — TODO: fetch from backend
const [activeBooking, setActiveBooking] = useState<Booking | null>(initialJourney?.booking ?? null);
```

The active booking is restored from `lib/journeySession.ts` (localStorage). There is no `GET /commuter/bookings/active`. If a commuter books on web and opens the app on mobile, the journey strip is empty and they cannot unlock their bay. `/commuter/bookings/my-bookings` exists and could serve this, but is only used for history.

### 3.4 IoT bollard unlock + GPS verification — pure simulation
**File:** `CommuterDashboard.tsx:1716-1770`

- `handleUnlockBollard` checks `gpsVerified`, then runs `setTimeout(2000)` and flips local state. **No command is sent to any barrier.**
- `triggerGPSCheck` is commented *"Simulated GPS Verification toggle"* — `setTimeout(1500)` then sets `'verified'` unconditionally. It never reads a real coordinate, so the "you must arrive near the bay" rule is not enforced.
- `handleLockBollard` is the same `setTimeout` pattern.
- QR scanner (`startQRScanner`, `:1769`) opens `getUserMedia`, but **never decodes the frame** and never validates against a booking. On camera failure it logs *"falling back to mock scanner beam simulation"*.

The real endpoint exists — `POST /api/support/gate-unlock` (`supportApiConfig.ts:11`) — but it is only wired inside `UserSupportDashboard` (emergency self-rescue), not the primary journey flow.

### 3.5 Parking detail map — coordinates unavailable — ✅ FRONTEND READY
**Files:** `src/features/commuter/pages/ParkingDetail.tsx:143-152`, `src/features/commuter/types.ts:142-158`

`PublicParkingSpotDetail` contains no `latitude` / `longitude`. The mapper therefore hardcoded:

```ts
latitude: 0, longitude: 0, lat: 0, lng: 0, lon: 0,
stationName: '', distanceToStation: 0, timeToStationInMinutes: 0,
```

Consequence: the detail page cannot place a pin, cannot compute distance, and cannot draw the walking route (0,0 is in the Atlantic). Also `station: 'Transit Area'` and `type: 'Condo Bay'` are invented literals, not API values. **Requires a backend contract change**, not just frontend work.

> **FRONTEND SIDE DONE — one backend field still required.** `latitude` / `longitude` / `stationName` / `distanceToStationMeters` / `timeToStationInMinutes` are now optional fields on the contract, and `getPublicParkingSpot()` normalises them from camelCase, PascalCase, and `lat`/`lng`/`lon` aliases (including numeric strings). `0,0`, out-of-range, and missing values all resolve to `null`, so the page no longer plots a pin in the Gulf of Guinea: route and distance affordances are skipped and a "no location data" notice is shown instead. **The backend must still return the two fields** for the map to appear. Verified by `scripts/check-parking-coordinates.mjs` (17 assertions).

---

## 4. Dead code inventory

| File | Status |
|---|---|
| `src/features/admin/components/SupportDispute.tsx` | Never rendered. Contains `mockBollardId = "BLD-SS15-01"` and a fabricated bypass-command chat log. |
| `src/features/owner/components/SupportTickets.tsx` | Never rendered (superseded by `SupportWorkspace`). |
| `src/features/owner/api/earningsApi.ts` | 2 finished endpoints, 0 call sites. |
| ~~`src/features/commuter/api/vehicleApi.ts`~~ | ✅ Now wired (was 4 endpoints / 0 call sites). |
| `src/features/admin/data/mockData.ts` | Now only empty-array / zero seeds, but still the source of the "always zero" KPIs. |
| `src/features/commuter/lib/vehicleStorage.ts` | ✅ Reduced to a read-through cache with no fabricated data. |

---

## 5. What IS correctly wired (do not re-work)

- **Auth** — Google sign-in, profile completion, JWT refresh on profile update.
- **Profile** — get/update profile, picture upload/remove, deactivate, admin user CRUD.
- **Admin** — Users (`profileApi`), Vehicles (`vehicleApi`), Listing Governance (`verificationApi` + `accountSuspensionApi`), System Audit (`accessLogApi`), Review Moderation (`reviewApi`). These 5 screens are real.
- **Owner** — parking registration, availability rules + calendar, image upload/delete, publication toggle, review replies, booking history (per-spot fan-out with dedupe).
- **Commuter** — nearby search, station search, availability calendar, quote, confirm, cancel, wallet summary / top-up / Stripe return handling / history, reviews, favorites (API + localStorage cache — a correct pattern, contrast with vehicles), and **vehicle CRUD** (as of this audit's fix).
- **Support** — tickets, incidents, disputes, on-call, evidence upload, WebSocket realtime, emergency gate unlock. Most complete module in the app.
- **Transit** — GTFS static + realtime, GeoJSON, multimodal routing, OSRM walking/driving, with local fallback.

---

## 6. Recommended backend work (new endpoints required)

| # | Endpoint | Unblocks |
|---|---|---|
| 1 | `GET /admin/dashboard` | 5 KPI cards + commission widget |
| 2 | `GET /admin/iot/bollards` + `POST .../command` + `.../reboot` | IoT screen (all of it) |
| 3 | `GET /admin/payouts`, `GET /admin/transactions`, `POST /admin/payouts/{id}/process` | Settlement screen |
| 4 | `GET /admin/overstays` + warn/penalize/resolve | Enforcement screen |
| 5 | `GET` / `PUT /admin/system-config` | System Config + 2 dependent screens |
| 6 | `GET /notifications` (+ read/read-all) | Both notification bells |
| 7 | `GET /commuter/bookings/active` | Cross-device journey resume |
| 8 | `POST /commuter/bookings/{id}/gate-command` | Real bollard unlock |
| 9 | `GET` / `PUT /owner/payout-account` | Bank beneficiary |
| 10 | `latitude`/`longitude`/`stationName` on `PublicParkingSpotDetail` | Detail-page map + distance — **frontend already accepts these fields; only the backend response is missing** |
| 11 | `POST /owner/withdrawals` | Withdraw flow |

Items 1–5 are the blockers for the Admin role being usable at all.

---

## 7. Suggested fix order (frontend-only wins first)

1. ~~**Wire `earningsApi` → OwnerDashboard wallet** (code exists; ~1 hour).~~ — outstanding.
2. ~~**Replace `vehicleStorage` with `commuter/api/vehicleApi`** and delete the three hardcoded Myvi fallbacks~~ — **DONE.**
3. **Share `getOwnerAllSpotsBookingHistory` with the owner dashboard** so `bookings` is populated (code exists).
4. **Move `handleUnlockBollard` onto the existing `gate-unlock` endpoint** and make `triggerGPSCheck` use `deviceCapabilities.watchDeviceLocation`.
5. **Delete the 4 dead files** to stop them being mistaken for working features.
6. Then start on the 11 missing endpoints above.

### Regression checks added

```bash
node scripts/check-vehicle-storage.mjs       # 13 assertions — cache safety, no fabricated vehicles
node scripts/check-parking-coordinates.mjs   # 17 assertions — coordinate normalisation
```

Both run without a browser or backend: they transpile the module with esbuild and stub `localStorage` / the HTTP layer.
