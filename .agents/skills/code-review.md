# walquest — Code Review Checklist

Output format: **BLOCKER**, **WARNING**, or **NOTE** for each finding.

## Coordinate order (most common bug)
- Geolocation API gives `(latitude, longitude)` — a plain number pair
- GeoJSON, MapLibre, and Turf all expect `[longitude, latitude]` arrays
- **Check**: conversion must happen at the GPS input boundary in `active-walk-controls.tsx`, before any points array is built. Raw GeolocationPosition coordinates must not appear anywhere else.

## Auth in Server Actions
Every function in `app/actions/walks.ts` must call `supabase.auth.getUser()` and verify `user` exists **before** any DB operation. A missing auth check silently allows unauthenticated writes through RLS gaps.

## PostGIS geometry — always use RPCs
- Writing territories: `claim_territory()` RPC (ST_GeomFromGeoJSON, atomic conflict resolution) — NOT `.from('territories').insert()` with raw geom
- Reading territories: `get_territories_geojson()` RPC (ST_AsGeoJSON in Postgres) — NOT raw PostgREST geometry serialisation
- Reading leaderboard: `get_leaderboard()` RPC — NOT direct table join (needs `auth.users` access)
- **Check**: any direct `.from('territories').insert()` call is a BLOCKER

## Cache invalidation (Next.js 16)
- After mutations in `completeWalk`: both `revalidatePath('/map')` and `updateTag('leaderboard')` must be called
- New `'use cache'` blocks must have `cacheTag(...)` + `cacheLife(...)` — untagged cache entries can't be purged
- `cacheTag` / `cacheLife` must be called INSIDE the `'use cache'` function, not outside
- `updateTag` is for Server Actions; `revalidateTag` for everything else

## `'use cache'` + Supabase
- Cached functions have no request context — `createClient()` from `lib/supabase/server` will fail
- Public data RPCs: use plain `createClient` from `@supabase/supabase-js` (anon key, SECURITY DEFINER RPC handles auth bypass)
- **Check**: any `await cookies()` or `createClient()` from `lib/supabase/server` inside a `'use cache'` function is a BLOCKER

## TanStack Query consistency
- After Server Actions that change territory state, call `queryClient.invalidateQueries({ queryKey: ['territories'] })`
- Territory query must use `placeholderData: keepPreviousData` — without it, any fetch error clears the map entirely
- `fetchTerritories` must THROW on `!res.ok` — returning empty data on error makes TanStack cache it as a successful empty result, permanently blanking the UI

## API route error handling
- Return non-200 status on failures — `Response.json({ error: 'Generic message' }, { status: 500 })`
- Never return HTTP 200 + empty payload to signal an error (callers can't distinguish from empty-but-valid)
- Never expose raw Postgres/Supabase error messages in the response body — log server-side, return a generic string to callers

## RLS coverage
- Every new table must have RLS enabled and explicit policies
- **Check**: `supabase/*.sql` migrations have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` for each new table
- `spatial_ref_sys` having RLS disabled is expected (PostGIS system table)

## Next.js 16 specifics
- Middleware must be `proxy.ts` with `export function proxy` — not `middleware.ts` / `export default`
- `next/dynamic(..., { ssr: false })` must be in a `'use client'` file
- `cookies()` in layout must NOT be awaited when using the cookie-promise streaming pattern
- Auth redirect logic in `proxy.ts`: protected routes AND auth pages (`/`, `/auth/login`) both have guards — check both when modifying

## Realtime (Phase 5+)
- Supabase Realtime channel must be torn down in the `useEffect` cleanup (`supabase.removeChannel(channel)`)
- `source.setData()` must only be called after map is loaded (`mapReadyRef.current === true`)

## Error messages and copy
- All user-facing error strings use plain, encouraging language — no technical jargon, no em dashes (use `-`)
- GPS error codes (1/2/3) must map to human-readable messages in `active-walk-controls.tsx`
