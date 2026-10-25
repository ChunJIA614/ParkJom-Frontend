# ParkJom — Full-Stack Module Completion Review

**Reviewed:** 25 October 2026
**Scope:** `ParkJom-Frontend` (React 19 + Vite + Capacitor) **and** `ParkJomV2` (ASP.NET Core, 172 `.cs` files)
**Method:** Route-attribute extraction from all 34 backend controllers, model/DbSet inventory, grep for every feature domain, cross-referenced against every frontend API call site.

**Verified build state:** frontend `tsc --noEmit` → **0 errors**. Backend `dotnet build` → **0 errors, 0 warnings**.

This document supersedes the earlier frontend-only review. The previous version described missing *endpoints*; this version confirms what the backend actually contains.

---

## Scoreboard

| | Count |
|---|---|
| ✅ Complete — UI + backend wired end to end | **26** |
| 🟡 Partial — screen exists, data or behaviour missing | **5** |
| ❌ Not started — UI shell only, or no UI at all | **6** |

**37 functional areas. 70% complete.**

> **Tier 1 shipped on 25 Oct 2026** — see the implementation log at the end. Owner earnings are now live, the overview knows which bays are booked today, and the commuter barrier release is a real backend command.

The distribution is lopsided, and the backend confirms it:

- **Commuter** — finished apart from notifications, cross-device journey resume, and QR decoding.
- **Owner** — money is now readable end to end. Withdrawals remain the one missing write path.
- **Admin** — a prototype. 5 of 10 screens render and do nothing. **None of their endpoints exist.**
- **Support** — the only module with a complete backend (controllers, services, workers, SignalR hub).

---

## ❌ Not started (6) — verified missing on BOTH sides

For each: what the frontend has, what the backend has, and the exact endpoint that must be built.

### 1. Notifications — cross-cutting, nothing exists anywhere

| Layer | State |
|---|---|
| Frontend | `CommuterDashboard.tsx:439` — `useState<AppNotification[]>([])`, comment *"TODO: fetch from backend"*. Owner side uses a `localStorage` store. Both bells permanently empty. |
| Backend | **No `Notification` model.** `ApplicationDbContext.cs:38` has it commented out: `//public DbSet<Notification> Notifications => Set<Notification>();`. No controller, no hub. |
| API module | No `notificationApi.ts` exists. |

Only `SupportNotificationAttempt` exists — that is on-call paging telemetry for the support module, not user notifications.

*Blocks:* booking confirmations, payment receipts, overstay warnings, gate events, ticket replies. Most user-visible gap in the product.

**Requires:** `Notification` entity + migration, `GET /api/notifications`, `PUT /api/notifications/{id}/read`, `PUT /api/notifications/read-all`, plus `@capacitor/push-notifications` for native.

---

### 2. Admin — Platform Overview KPIs

| Layer | State |
|---|---|
| Frontend | `admin/data/mockData.ts` seeds all 7 stats to `0`; no code path ever assigns them. `onlineBollardsRate` divides by an always-empty `bollards` array → renders **`NaN%`**. |
| Backend | No admin dashboard/stats controller. Grep for `AdminDashboard` / `admin/stats` / `admin/dashboard` across all `.cs` → **zero hits**. |

**Requires:** `GET /api/admin/dashboard` returning `totalRevenue`, `platformCommission`, `activeBookings`, `totalUsers`, `openDisputesCount`, `pendingListingsCount`, `activeOverstaysCount`, `onlineBollardsRate`.

*All source data exists* — `Bookings`, `Users`, `Transactions`, `PlatformWallet`, `SupportTickets`, `ParkingVerificationRequests`, `IoTDevices`. This is a read-only aggregation query, no new tables.

---

### 3. Admin — IoT Health Monitor (Smart Bollards)

| Layer | State |
|---|---|
| Frontend | `bollards` starts `[]`, never fetched. Raise/lower/reboot = `setTimeout` + local state (3 occurrences). Line 58 comments *"Refill empty battery on mock reboot diagnostic"*. |
| Backend | **Schema exists, API does not.** `IoTDevice` (Esp32Serial, FirmwareVersion, DeviceStatus, LastHeartbeatAt, IsAssigned), `IoTStatusLog`, `DeviceStatus` enum all defined and migrated. `IoTStatusLog` is referenced **only** by the model and DbContext — no service reads or writes it. |

`IoTDevice` is touched only for read-only display inside access logs and support context (`bollardId` references) — never for device management.

**Requires:** `GET /api/admin/iot/devices`, `POST /api/admin/iot/devices/{id}/command`, `POST /api/admin/iot/devices/{id}/reboot`, plus a heartbeat ingest endpoint for the ESP32 firmware.

> **Schema gap:** the frontend mock shows battery % and RSSI per device. `IoTDevice` has neither field. Either add `BatteryLevel` / `Rssi` columns or drop those columns from the UI.

---

### 4. Admin — Financial Settlement

| Layer | State |
|---|---|
| Frontend | `payouts` and `transactions` start `[]`, never fetched. "Process payout" = 400 ms `setTimeout`. **CSV export is fake** — toasts *"MOCK Excel Sheet downloaded"*, writes no file. |
| Backend | No admin payout/settlement controller. `Transaction`, `PlatformWallet`, `Payment` models all exist and are actively written by the booking flow — but nothing exposes them to admin. |

**Requires:** `GET /api/admin/payouts`, `GET /api/admin/transactions`, `POST /api/admin/payouts/{id}/process`, `GET /api/admin/settlement/export` (real `FileStreamResult` CSV).

---

### 5. Admin — Overstay Enforcement

| Layer | State |
|---|---|
| Frontend | `overstays` starts `[]`, never fetched. Warn/penalise/resolve = **8 `setTimeout` calls**, all local state. |
| Backend | `Booking.OverstayHours` and `Booking.OverstayPenaltyAmount` exist. **Nothing ever writes them** — grep for assignments returns only two DTO-mapping lines that *read* the fields. `TransactionType.OverstayPenalty` exists in the enum but is never issued. No detection worker. |

This is a dead schema: the columns and enum value were provisioned, then the feature was never built.

**Requires:** a background worker to detect `EndTime < now AND status == Active` and compute hours/penalty, `GET /api/admin/overstays`, `POST /api/admin/overstays/{id}/warn|penalize|resolve`, and a commuter notice (depends on module #1).

---

### 6. Admin — System Configuration

| Layer | State |
|---|---|
| Frontend | Commission rate + grace period in local state behind a fake 400 ms save. Resets to **15 / 15** on refresh. Two other screens read these values. |
| Backend | **No config table, no endpoint.** `Models/Constants/PlatformConstants.cs` hardcodes `CommissionRate = 10m` as a `const`. |

**⚠️ Live business-logic mismatch:** the admin UI shows and edits **15%**, the backend charges **10%** on every booking. Settlement and overstay logic rest on a value that can never be changed and does not match what the operator sees.

**Requires:** `SystemConfiguration` table + migration, seed 10%, `GET`/`PUT /api/admin/system-config`, and refactor `PlatformConstants.CommissionRate` call sites to read from the table.

---

## 🟡 Partial (5)

### 1. Commuter — Active journey & IoT access
Journey strip, countdown, parking pass and stage machine all work. **Barrier release is now real** (see log): `handleUnlockBollard` calls `POST /api/support/gate-unlock` and only advances the journey on an accepted command. Remaining gaps:
- QR scanner opens the camera but **never decodes a frame**
- Active booking restored from `localStorage` only — cannot resume on a second device
- `handleLockBollard` still runs a local `setTimeout` rather than dispatching an `Exit` command

There is no `GET /api/commuter/bookings/active`.

### 2. Owner — Wallet withdrawals & payout account
The **read side is complete** (balance, held, paid, gross, paginated transaction feed). What remains is the write side:
- Withdraw button is present but disabled — no `POST /api/owner/withdrawals` exists
- Bank beneficiary is still `{ name: '-', accNo: '-', holder: '-' }`; saving shows a toast and persists nothing. No `GET`/`PUT /api/owner/payout-account`.

### 3. Owner — Settings (bank + notification toggles)
`onSaveBank` shows a success dialog and persists nothing. Three toggles (email alerts, WhatsApp alerts, auto-withdraw) are local state. No endpoint on either side.

### 4. Parking detail — map and distance
Frontend is ready: `latitude`/`longitude` normalised from camelCase, PascalCase and `lat`/`lng`/`lon` aliases; `0,0` and out-of-range resolve to `null` so no bogus pin is plotted.
**Backend must return the fields.** `ParkingSpotDetailDTO` (`DTOs/SearchDTO.cs:104-121`) has **no** `latitude`, `longitude`, `stationName`, `distanceToStationMeters` or `timeToStationInMinutes`. The columns exist on `Property`; the detail projection just doesn't include them.

### 5. Mobile (Capacitor)
Android + iOS projects present, `cap sync` scripts exist, social login / geolocation / HTTP plugins configured. `@capacitor/push-notifications` is **not installed** — a native build can never receive a push, compounding module #1.

---

## Backend-specific findings

### Four empty controller files — ✅ removed
`PaymentController.cs`, `RefundController.cs`, `WalletTransactionController.cs` and `WalletWithdrawalController.cs` were all 0 bytes with zero references. All four were deleted; the backend compiles clean (0 errors, 0 warnings).

Payment and wallet-history are served elsewhere (`BookingCheckoutController`, `WalletController`). **Refunds and withdrawals still have no entry point** — `TransactionType.Refund` exists and is written by the cancellation path, but there is no refund *request* API, and `TransactionType.Withdrawal` is only read for the `PaidEarnings` sum.

### A dead duplicate project — ✅ removed from the solution
`ParkJomV2.sln` referenced two projects:
- `ParkJomV2/ParkJomV2.csproj` — the real API (172 files)
- `src/ParkJomV2.Web/ParkJomV2.Web.csproj` — **5 files**: a second `Program.cs`, a second `AuthController`, a second `JwtHelper`, one DTO, one `UserStoreService`

The second reference is gone; `dotnet sln list` now reports one project. **The `src/ParkJomV2.Web` folder still exists on disk** — delete it when you are ready, it is no longer part of the build.

### Dead schema inventory
| Entity / field | Status |
|---|---|
| `IoTStatusLog` | Defined, migrated, never read or written |
| `Booking.OverstayHours` / `OverstayPenaltyAmount` | Read into DTOs, never assigned |
| `TransactionType.OverstayPenalty` | In enum, never issued |
| `TransactionType.Withdrawal` | In enum, only read for `PaidEarnings` sum |
| `PlatformWallet` | Written by booking flow, never exposed to admin |
| `Notification` DbSet | Commented out at `ApplicationDbContext.cs:38` |

---

## ✅ Complete (26) — do not re-work

| Area | Backend route |
|---|---|
| Auth | `api/auth/google`, `complete-profile` |
| Profile & account | `api/user/profile` (GET/PUT/picture/deactivate), `api/user/me` |
| Landing page | Static by design |
| Commuter discovery | `api/parking/search`, `nearby`, `filter`; `api/gtfs/stops/{id}/nearby-parking` |
| Commuter booking | `api/public/parking/{id}/booking-availability`, `booking-quotes`; `api/commuter/bookings/confirm`, `cancel` |
| Commuter wallet | `api/wallet/history`, `topup`, `topup/history`, `topup/status`, `topup/success`, `topup/cancel`; `api/stripe/webhook` |
| Commuter reviews | `api/reviews` (POST/GET/PUT/DELETE + `parking/{id}`) |
| Commuter favorites | `api/favorites` (GET, POST, update) |
| Commuter vehicles | `api/vehicle` (add, modify, delete, my-vehicle, all) |
| Owner property registration | `api/property/create-property`, `{id}`, `stations` |
| Owner availability | `api/owner/parking/{id}/availability-rules`, `availability-calendar` |
| Owner parking media | `api/owner/parking/{id}/images` (POST/PUT/DELETE), `publish`, `unpublish`, `configuration` |
| Owner booking history | `api/owner/parking/{id}/bookings`, `api/parking/bookings` |
| Owner review replies | `api/reviews/{id}/owner-reply` |
| Owner earnings wallet | `api/owner/earnings/summary`, `transactions` — **wired 25 Oct** (`OwnerWalletPanel`) |
| Owner overview bay status | `api/owner/parking/{id}/bookings` — **wired 25 Oct**, drives "Booked now / Booked today" |
| Admin user governance | `api/admin/users` (GET/PUT) |
| Admin listing governance | `api/parking/verification-requests` (+ decision), `api/admin/account-suspensions` |
| Admin vehicle registry | `api/vehicle/all` |
| Admin review moderation | `api/reviews/admin`, `api/reviews/admin/parking/{id}/{reviewId}` |
| Admin system audit | `api/accesslog` |
| Support — commuter/owner | `api/support/*` (templates, tickets, messages, close/reopen, attachments, gate-unlock, context) |
| Support — admin | `api/admin/support/*` (dashboard, audit, tickets, incidents, disputes, on-call) |
| Support — realtime | `SupportHub` (SignalR) + `IncidentEscalationWorker` |
| Transit — static + realtime | `api/gtfs/*`, `api/gtfs/realtime/*` |
| Routing | OSRM via `OsrmService`, multimodal journey planning |
| PWA | Manifest + service worker |

---

## Backend work required — consolidated endpoint list

| # | Endpoint(s) | Unblocks | Effort |
|---|---|---|---|
| 1 | `GET /api/notifications` + read/read-all | Both bells, push | **L** — new entity + migration |
| 2 | `GET /api/admin/dashboard` | 7 KPI cards | **S** — read-only aggregation |
| 3 | `GET /api/admin/system-config`, `PUT` | Config + 2 dependents | **M** — table + refactor const |
| 4 | `latitude`/`longitude`/`stationName` on `ParkingSpotDetailDTO` | Detail map + distance | **XS** — one projection |
| 5 | `GET /api/admin/iot/devices` + command/reboot + heartbeat | IoT screen, real unlock | **L** — device channel |
| 6 | `GET /api/admin/payouts`, `transactions`, `POST .../process`, `export` | Settlement | **M** |
| 7 | `GET /api/admin/overstays` + warn/penalize/resolve | Enforcement | **L** — needs detection worker |
| 8 | `GET /api/commuter/bookings/active` | Cross-device resume | **S** |
| 9 | `POST /api/owner/withdrawals` | Withdraw flow | **M** — money movement |
| 10 | `GET`/`PUT /api/owner/payout-account` | Bank beneficiary | **S** |

Items 1–4 are the highest value per unit of work. Item 3 carries a correctness bug today (15% shown vs 10% charged).

> Real bollard unlock no longer needs a new endpoint — `POST /api/support/gate-unlock` was already complete and is now the primary journey path. The admin IoT command channel (#5) is still needed for the *operator* side.

---

## Critical path

**Tier 1 — ✅ shipped 25 Oct 2026**
1. ~~Wire `earningsApi` into an owner wallet view~~ — done, `OwnerWalletPanel`
2. ~~Share `getOwnerAllSpotsBookingHistory` with the owner dashboard~~ — done
3. ~~Point `handleUnlockBollard` at the existing `gate-unlock` endpoint; make `triggerGPSCheck` real~~ — done
4. ~~Delete the 4 dead files + remove `src/ParkJomV2.Web` from the solution~~ — done

**Tier 2 — one backend sprint**
5. `GET /api/admin/dashboard` — makes the admin landing screen usable
6. `GET`/`PUT /api/admin/system-config` — unblocks 2 screens, fixes the 10-vs-15% bug
7. `latitude`/`longitude` on parking detail — one field
8. Notifications — highest user-visible impact

**Tier 3 — the real admin build-out**
9. IoT device management + command channel — also enables operator-side barrier control
10. Settlement — payouts, transactions, real export
11. Overstay enforcement — detection worker + records
12. Owner payout account + withdrawals

---

## Implementation log — Tier 1, 25 Oct 2026

**Verification:** `npx tsc --noEmit` → 0 errors · `npx vite build` → success · `dotnet build -t:CoreCompile` → 0 errors, 0 warnings · `dotnet sln list` → 1 project.

| # | Change | Files |
|---|---|---|
| 1 | New owner wallet screen: available / on-hold / paid-out / gross cards, paginated transaction feed with type filter, retry + empty states. Withdraw button renders **disabled** — no endpoint exists, so nothing pretends to succeed. | `features/owner/components/OwnerWalletPanel.tsx` *(new)*, `OwnerDashboard.tsx`, `Sidebar.tsx` |
| 2 | Owner overview now loads real bookings and maps them onto the bay matcher. Stays spanning today carry today's key so the whole stay locks the bay; cancelled and expired bookings are dropped so they cannot show a spot as booked. | `OwnerDashboard.tsx`, `DashboardHome.tsx` |
| 3 | Barrier release calls `POST /api/support/gate-unlock` and only advances the journey on an accepted command. GPS verification reads a real device fix and compares it with the bay coordinates (150 m, widened by reported accuracy); unknown bay coordinates are reported as such instead of being treated as success. | `CommuterDashboard.tsx`, `features/commuter/lib/geofence.ts` *(new)*, `services/deviceCapabilities.ts` |
| 4 | Deleted 4 empty controllers; removed the dead `ParkJomV2.Web` project reference. | `ParkJomV2/Controllers/*`, `ParkJomV2.sln` |

**Removed as part of the work** (fake state that reported success):
- `handleWithdrawFunds` — fabricated a `WITHDRAWAL` row and a success notification with no API call
- `handleResolveDispute` — credited a hardcoded RM 3.60 penalty to local state
- `walletBalance = useState(0)` — replaced by the earnings summary
- `DashboardHome` props `walletBalance`, `onWithdraw`, `onResolveDispute`, `activeBank`

**Behaviour to know about:** the GPS check is a client-side UX guard only. The authoritative access decision is made server-side by `SelfUnlockGateAsync` (booking ownership, status, ±1h/2h access window, device online, 2-minute rate limit, access-log + audit writes). If the bay has no coordinates on file the client says so and still lets the server decide.

---

## Honest read

**Commuter** is a finished product apart from notifications and cross-device resume. **Owner** can now see its money and its bookings truthfully; only the withdrawal write path is missing. **Admin** is still a prototype: 5 of 10 screens render correctly and do nothing, and every button on them reports success without doing anything.

Three things deserve to be named as risks:

1. **The commission mismatch.** The admin console displays 15%; the backend charges 10%. Anyone reconciling settlement against that screen is working from a number that is wrong on both counts — not saved, and not the rate in use.

2. **A console that lies.** `NaN%`, permanently-zero revenue, and a "spreadsheet exported" toast that writes no file are worse than empty screens, because they invite decisions on data that was never loaded. If a demo or stakeholder review is coming, those five screens should be wired or explicitly labelled unavailable.

3. **Barrier release depends on data you do not yet collect.** The unlock path is now real, but `SelfUnlockGateAsync` refuses when `ParkingSpot.IoTDevice` is missing or offline. Until devices are registered and heartbeating, every commuter unlock will correctly return "device offline". Register devices before demoing the journey end to end.
