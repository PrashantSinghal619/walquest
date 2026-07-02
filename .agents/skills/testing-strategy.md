# walquest — Testing Strategy

## Guiding principle
GPS cannot be simulated in unit tests. Focus integration-test effort on the business logic (polygon math, territory claims) and use E2E only for the authenticated walk flow.

## Test layers

### Unit — `lib/geo/polygon.ts`
Pure functions; no DB or GPS needed. Cover with Vitest:
- Valid loop → polygon with expected area
- Loop with kinks (self-intersection) → `{ error: 'kinks' }`
- Degenerate loop (< 3 points, or < min area) → `{ error: ... }`
- Coordinate order: input is `[lng, lat]` arrays (GeoJSON); verify output geometry is valid GeoJSON

### Integration — `app/actions/walks.ts`
Run against a real Supabase test project (never mock PostGIS):
- `startWalk`: inserts walk row, returns UUID
- `completeWalk`: happy path → territory row exists with correct owner + geom
- `completeWalk`: invalid polygon → no territory row, walk marked failed
- `discardWalk`: walk row deleted, no territory created
- All actions: unauthenticated call → `{ error: 'unauthorized' }` (verify auth guard runs before DB)

### Integration — `proxy.ts`
- Unauthenticated request to `/map` → 302 to `/auth/login`
- Unauthenticated request to `/leaderboard` → 302
- Authenticated request → passes through (200)
- Public paths (`/`, `/auth/*`) → no redirect

### Component — `app/(app)/map/_components/`
- `active-walk-controls.tsx`: state machine transitions (idle → recording → submitting → idle)
  - Mock `navigator.geolocation.watchPosition` to inject coordinates
  - Verify coordinate conversion: raw `GeolocationPosition` (lat, lng) → `[lng, lat]` before Turf
- `territory-map.tsx`: MapLibre init is side-effectful; test only the data-transform logic (GeoJSON source updates), not rendering

### E2E — critical user flow (Playwright)
1. Load `/` → click "Get started" → `/auth/login`
2. Submit magic link email → verify success state shown
3. (Manual step) Click magic link → redirected to `/map`
4. MapLibre map renders, territory polygons visible
5. Start walk → GPS points accumulate → complete walk → territory claimed toast appears

## Database test isolation
Use a separate Supabase project for tests (different `SUPABASE_URL`). Wrap each integration test in a transaction and roll back after, or truncate `walks` + `territories` + `territory_events` tables in `afterEach`.

## What NOT to test
- MapLibre rendering (canvas-based, requires browser)
- Supabase Realtime (Phase 5 — test in isolation when implemented)
- OpenFreeMap tile loading (external service, not our code)
