# walquest — Testing Strategy

## Current infrastructure
Vitest is set up and running. `npm test` runs all tests; `npm run test:watch` for watch mode.

Existing test files:
- `tests/polygon.test.ts` — `buildPolygon` unit tests (6 tests)
- `tests/proxy.test.ts` — middleware redirect logic (10 tests)
- `tests/territories-api.test.ts` — `/api/territories` route + `fetchTerritories` error handling (6 tests)

## Guiding principle
GPS cannot be simulated in unit tests. Focus integration-test effort on business logic (polygon math, territory claims) and use E2E only for the authenticated walk flow.

## Test layers

### Unit — `lib/geo/polygon.ts`
Already covered. Add new cases when error messages or validation thresholds change.
- Valid loop -> polygon with expected area
- Loop with kinks (self-intersection) -> error
- Degenerate loop (< 3 points, all-identical, too small) -> error
- Coordinate order: input is `[lng, lat]` arrays (GeoJSON); output geometry is valid GeoJSON

### Unit/Integration — `proxy.ts`
Already covered. Cases: unauthenticated on protected routes, authenticated on auth pages, authenticated on protected routes.
- Mock `@supabase/ssr` createServerClient; stub env vars with `vi.stubEnv`
- Use real `NextRequest` from `next/server`

### Integration — `app/api/territories/route.ts`
Already covered. Cases: RPC success, RPC error (500 + generic message, no raw DB leak), null data fallback.
- Mock `@/lib/supabase/server` createClient
- Assert HTTP status and response body shape

### `fetchTerritories` error handling
Already covered. Assert that non-200 responses throw (so TanStack Query classifies as error, not empty success).

### Integration — `app/actions/walks.ts`
Not yet written. Run against a real Supabase test project (never mock PostGIS):
- `startWalk`: inserts walk row, returns UUID
- `completeWalk`: happy path -> territory row exists with correct owner + geom + `territory_events` row
- `completeWalk`: conflict resolution -> other owner's territory clipped/deleted correctly
- `completeWalk`: invalid polygon -> no territory row, appropriate error returned
- `discardWalk`: walk marked discarded, no territory created
- All actions: unauthenticated call -> `{ error }` (verify auth guard runs before DB)
- `updateTag('leaderboard')` called after successful claim (spy on next/cache)

### Component — `app/(app)/map/_components/`
Not yet written. Requires `@testing-library/react` (not yet installed).
- `active-walk-controls.tsx`: state machine transitions (idle -> recording -> claiming -> success/error)
  - Mock `navigator.geolocation.watchPosition` to inject coordinates
  - Verify coordinate conversion: raw GeolocationPosition (lat, lng) -> [lng, lat] before Turf
- `territory-map.tsx`: test only data-transform logic (GeoJSON source updates), not MapLibre rendering

### E2E — critical user flow (Playwright, not yet set up)
1. Load `/` -> click "Get started" -> `/auth/login`
2. Submit magic link email -> "Magic link incoming!" banner shown
3. (Manual step) Click magic link -> redirected to `/map`
4. MapLibre map renders, territory polygons visible
5. Start walk -> GPS points accumulate -> complete walk -> "Territory claimed!" shown
6. Leaderboard shows updated rank after claim

## Database test isolation
Use a separate Supabase project for integration tests (different `SUPABASE_URL`). Wrap each test in a transaction and roll back, or truncate `walks` + `territories` + `territory_events` in `afterEach`.

## What NOT to test
- MapLibre rendering (canvas-based, requires browser)
- Supabase Realtime (test in isolation separately)
- OpenFreeMap tile loading (external service)
- TanStack Query internals (`keepPreviousData` is library-tested)
