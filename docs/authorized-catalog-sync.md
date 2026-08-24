# Authorized Car Catalog Sync

This note defines a server-side boundary for importing a car make/model catalog
from an approved upstream source. It is intentionally not a scraper
implementation and must not be used to bypass access controls, anti-bot checks,
or an upstream site's terms.

## Boundary

The browser client reads only ParkJom's catalog API. A scheduled backend worker
may read an upstream feed or endpoint only when ParkJom has permission to do
so. Upstream credentials, cookies, proxy settings, browser sessions, and
provider-specific URLs remain server-side.

```text
authorized upstream -> sync worker -> validation/normalization -> catalog store
                                                         -> ParkJom catalog API -> frontend
```

The worker should use a low request rate, obey any contractually applicable
limits, record the source and sync timestamp, and stop with an alert when the
upstream contract or response shape changes.

## Normalized records

Persist stable upstream identifiers where available. Names are display values.
The current frontend adapter intentionally submits the existing vehicle API's
brand/model strings; IDs can be added later without exposing upstream IDs to
the vehicle record API.

```ts
type CarBrand = {
  id: string;
  name: string;
  source: string;
  sourceUpdatedAt?: string; // ISO-8601
  active: boolean;
};

type CarModel = {
  id: string;
  brandId: string;
  name: string;
  source: string;
  sourceUpdatedAt?: string; // ISO-8601
  active: boolean;
};
```

The normalizer must reject records missing an ID, name, or parent brand; trim
whitespace; preserve the upstream ID as a string; deduplicate by `(source,id)`;
and quarantine malformed or orphaned records instead of publishing them.

## Catalog API

Expose a small read-only API owned by ParkJom. The current frontend adapter
accepts this compact response shape:

```text
GET /api/vehicle/catalog
200 { "data": [{ "brand": "Toyota", "models": ["Camry", "Vios"] }], "updatedAt": "<ISO-8601>" }
```

If the backend needs independently cacheable brand/model records, it may use
the normalized form below instead:

```text
GET /api/car-brands
200 { "data": CarBrand[], "syncedAt": "<ISO-8601>" }

GET /api/car-models?brandId=<brand-id>
200 { "data": CarModel[], "syncedAt": "<ISO-8601>" }
```

Responses should be cacheable. The frontend disables the model selector until
a brand is selected, clears a model when its brand changes, and falls back to a
local catalog when `/api/vehicle/catalog` is unavailable. Do not call the
upstream host from the browser.

## Sync and failure policy

- Keep the last known-good snapshot and publish a new snapshot atomically.
- Validate counts and referential integrity before promotion; alert on an
  unexpected large drop or schema change.
- Use bounded retries with backoff, then retain the last good snapshot.
- Log request status, duration, record counts, and error class, but never log
  tokens, cookies, phone numbers, or raw upstream responses containing personal
  data.
- Review the upstream terms, robots policy, commercial-use permission, and
  applicable privacy obligations before enabling production sync.

## Acceptance criteria

The sync is ready only when the upstream owner has authorized the access method,
the worker can be disabled without breaking the frontend, and the frontend can
serve a complete last-known-good catalog during an upstream outage.
