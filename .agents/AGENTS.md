# walquest — Project Context

## What this is
Real-time territory-conquest walking tracker for Bengaluru. Users walk a loop, close it into a polygon, claim the territory. Others can clip it by walking overlapping loops. Built as a hands-on vehicle for learning Next.js SSR and React Server Components.

## Tech stack
- **Next.js 16.2.9** with `cacheComponents: true` (inverts default — everything dynamic unless explicitly `'use cache'`)
- **React 19 canary**, TypeScript strict, Tailwind 4, shadcn/ui
- **Supabase** — Postgres + PostGIS + Auth (magic link, PKCE flow) + Realtime (Phase 5)
- **MapLibre GL JS** + OpenFreeMap tiles (no API key, liberty style)
- **@turf/turf 7.3.5** — polygon building server-side (simplify, kinks, area)
- **TanStack Query** — client polling + future Realtime cache patching

## Supabase setup
Credentials live in `.env.local` (gitignored). Key env var name is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not ANON_KEY — Supabase renamed it). Run `supabase/001_schema.sql` in the SQL Editor to bootstrap the database.

## Database
Tables: `users`, `walks`, `territories` (PostGIS geometry), `territory_events`
RPCs:
- `insert_territory(p_owner_id, p_walk_id, p_geom_json, p_area_m2)` → UUID
- `get_territories_geojson()` → JSON FeatureCollection

Trigger: `on_auth_user_created` → auto-inserts row into `public.users`
`spatial_ref_sys` having RLS disabled is **expected** — PostGIS system table, not user data.

## Git phase tags
```
phase-3  MapLibre client island + OpenFreeMap tiles
phase-4  Walk recording + territory claiming (Server Actions + PostGIS)
```

## Key architecture patterns
- **`cacheComponents: true`**: data fetching excluded from prerenders by default; opt-in with `'use cache'`
- **Cookie-promise pattern**: `app/(app)/layout.tsx` calls `cookies()` WITHOUT await, passes `Promise` to `<UserMenu>` inside `<Suspense>` — nav chrome renders as static shell, user session streams in
- **`ssr: false` constraint**: `next/dynamic(..., { ssr: false })` must live in a `'use client'` file. `map-client.tsx` is a thin wrapper for this reason alone
- **ResizeObserver on MapLibre container**: MapLibre reads dimensions at init; ResizeObserver calls `map.resize()` when container size changes (layout settling after init)
- **Coordinate order**: Geolocation API → `(lat, lng)`. GeoJSON/MapLibre/Turf → `[lng, lat]`. Convert at the GPS input boundary in `active-walk-controls.tsx`
- **Territory GeoJSON reads**: via `get_territories_geojson()` RPC (ST_AsGeoJSON in Postgres) — don't rely on PostgREST geometry serialisation directly
- **Territory insert**: via `insert_territory()` RPC (ST_GeomFromGeoJSON) — Supabase JS `.from().insert()` can't call PostGIS functions inline
- **`proxy.ts`** (not `middleware.ts`): Next.js 16 renamed it; exported function is `proxy`, not `default`

## Critical paths (review carefully before committing)
| File | Role |
|------|------|
| `app/actions/walks.ts` | Server Actions: startWalk / completeWalk / discardWalk |
| `lib/geo/polygon.ts` | Turf pipeline: simplify → close ring → kinks check → area check |
| `proxy.ts` | Auth middleware protecting /map /leaderboard /profile |
| `lib/supabase/server.ts` | createServerClient with cookie handlers |
| `lib/supabase/client.ts` | createBrowserClient |
| `app/(app)/map/_components/` | GPS state machine, MapLibre init, walk recording UI |

## Roadmap
### Phase 5 — Conflict resolution + Realtime
- `ST_Intersects` + `ST_Difference` PostGIS transaction in `completeWalk` (currently first-claim-only)
- Supabase Realtime subscription on `territory_events` INSERTs → patch TanStack Query cache → `GeoJSONSource.setData()` repaints map
- TanStack Query `refetchInterval: 45000` as polling fallback

### Phase 6 — Leaderboard caching
- `cacheTag('leaderboard')` on leaderboard fetch
- `updateTag('leaderboard')` called from `completeWalk` after territory insert
- `app/(app)/leaderboard/page.tsx` + `LeaderboardTable` component

### Phase 7 — Performance audit
- Apply `unstable_instant` to `/map` and `/leaderboard`
- Fix any Suspense errors it surfaces
- Lighthouse / Next DevTools verification

## File map
```
proxy.ts                              Next.js 16 middleware (protects /map /leaderboard /profile)
lib/supabase/server.ts               createServerClient with cookie handlers
lib/supabase/client.ts               createBrowserClient
lib/geo/polygon.ts                   turf: simplify → close ring → kinks check → area check
app/actions/walks.ts                 startWalk / completeWalk / discardWalk Server Actions
app/api/territories/route.ts         GET → get_territories_geojson() RPC
app/(app)/layout.tsx                 cookie-promise pattern, nav chrome static shell
app/(app)/map/page.tsx               static Server Component, renders <MapClient />
app/(app)/map/_components/
  map-client.tsx                     'use client': owns walk state, dynamic-imports TerritoryMap
  territory-map.tsx                  MapLibre init, territory fill layer, live walk-path line
  active-walk-controls.tsx           GPS watchPosition, state machine, calls Server Actions
  map-skeleton.tsx                   CLS-safe placeholder matching map dimensions
supabase/001_schema.sql              Full DB migration (run in Supabase SQL Editor)
```
