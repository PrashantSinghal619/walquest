# walquest — Code Review Checklist

## Coordinate order (most common bug)
- Geolocation API gives `(latitude, longitude)` — a plain number pair
- GeoJSON, MapLibre, and Turf all expect `[longitude, latitude]` arrays
- **Check**: conversion must happen at the GPS input boundary in `active-walk-controls.tsx`, before any `positions` array is built. Nowhere else should raw GeolocationPosition coordinates appear.

## Auth in Server Actions
Every function in `app/actions/walks.ts` must call `supabase.auth.getUser()` and verify `user` exists **before** any DB operation. A missing auth check silently allows unauthenticated writes through RLS gaps during development.

## PostGIS geometry — always use RPCs
- Reading territories: `get_territories_geojson()` RPC (ST_AsGeoJSON in Postgres) — not raw PostgREST serialisation
- Writing territories: `insert_territory()` RPC (ST_GeomFromGeoJSON) — not `.from('territories').insert()` with a raw geom
- **Check**: any direct `.from('territories')` write call is a red flag

## Cache invalidation (Next.js 16 `cacheComponents: true`)
- With `cacheComponents: true`, components opt IN to caching with `'use cache'`
- After any mutation (completeWalk, etc.) call `updateTag(...)` for affected cache tags
- **Check**: new `'use cache'` blocks must have a `cacheTag(...)` call so they can be purged

## TanStack Query consistency
- After Server Actions that change territory state, the client must invalidate `/api/territories`
- **Check**: `queryClient.invalidateQueries({ queryKey: ['territories'] })` (or equivalent) is called after completeWalk success

## RLS coverage
- Every new table must have Row Level Security enabled and explicit policies
- **Check**: `supabase/001_schema.sql` has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` statements for each new table

## Next.js 16 specifics
- Middleware file must be `proxy.ts` (not `middleware.ts`) with a named `export function proxy`
- `next/dynamic(..., { ssr: false })` must be called from a `'use client'` file — a Server Component calling it will throw
- `cookies()` in a Server Component should NOT be awaited when using the promise-passing pattern in `app/(app)/layout.tsx`

## Phase 5 additions (Realtime + conflict resolution)
When reviewing Phase 5 code:
- `ST_Intersects` + `ST_Difference` must run inside a single Postgres transaction (one RPC)
- Supabase Realtime channel must be torn down in the cleanup function of the `useEffect` that opens it
- `GeoJSONSource.setData()` must only be called after the source is confirmed loaded (`map.isSourceLoaded(...)`)
