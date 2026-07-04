# walquest — Project Context

## What this is
Real-time territory-conquest walking tracker for Bengaluru. Users walk a loop, close it into a polygon, claim the territory. Others can clip it by walking overlapping loops. Built as a hands-on vehicle for learning Next.js SSR and React Server Components.

## Tech stack
- **Next.js 16.2.9** with `cacheComponents: true` (inverts default — everything dynamic unless explicitly `'use cache'`)
- **React 19 canary**, TypeScript strict, Tailwind 4, shadcn/ui
- **Supabase** — Postgres + PostGIS + Auth (magic link, PKCE flow) + Realtime
- **MapLibre GL JS** + OpenFreeMap tiles (no API key, liberty style)
- **@turf/turf 7.3.5** — polygon building server-side (simplify, kinks, area)
- **TanStack Query v5** — client polling + Realtime cache invalidation
- **Vitest** — unit and integration tests (`npm test`)

## Deployment
Live at **https://walquest.vercel.app**. Env vars set in Vercel dashboard. Any push to `master` auto-deploys.

## Supabase setup
Credentials live in `.env.local` (gitignored). Key env var name is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not ANON_KEY — Supabase renamed it).

SQL migrations — run in order in Supabase Dashboard -> SQL Editor:
| File | Status | What it does |
|------|--------|-------------|
| `supabase/001_schema.sql` | Run | Tables, RLS, triggers, `get_territories_geojson()` |
| `supabase/002_phase5.sql` | Run | `claim_territory()` RPC + Realtime on `territory_events` |
| `supabase/003_leaderboard.sql` | Run | `get_leaderboard()` RPC |

## Database
Tables: `users` (`id`, `username`, `display_name`, `created_at` — no email), `walks`, `territories` (PostGIS geometry), `territory_events`

`public.users` has NO email column. Email lives in `auth.users` — only accessible via SECURITY DEFINER RPCs.

Trigger: `on_auth_user_created` -> auto-inserts `id` into `public.users`
`spatial_ref_sys` having RLS disabled is **expected** — PostGIS system table.

RPCs:
- `claim_territory(p_owner_id, p_walk_id, p_geom_json, p_area_m2)` -> JSON `{territory_id, clipped_count, lost_count}` — atomic conflict resolution via ST_Intersects + ST_Difference; clips other owners' territories; skips your own
- `get_territories_geojson()` -> JSON FeatureCollection — all territories, public read
- `get_leaderboard()` -> table rows — top 20 by total area, reads email from `auth.users` via SECURITY DEFINER

## Git phase tags
```
phase-3  MapLibre client island + OpenFreeMap tiles
phase-4  Walk recording + territory claiming (Server Actions + PostGIS)
phase-5  Conflict resolution + Realtime + .agents/ framework
phase-6  Leaderboard with cacheTag/updateTag
```

## Key architecture patterns

### Caching
- **`cacheComponents: true`**: all components dynamic by default; opt-in with `'use cache'`
- **`cacheTag` + `updateTag`**: `cacheTag('leaderboard')` inside `'use cache'` function; `updateTag('leaderboard')` in Server Actions for read-your-own-writes
- **`'use cache'` + Supabase**: cached functions have no request context, so cannot use cookie-based `createClient()` from `lib/supabase/server`. Use plain `createClient` from `@supabase/supabase-js` for public data RPCs.

### Auth
- **Cookie-promise pattern**: `app/(app)/layout.tsx` calls `cookies()` WITHOUT await, passes Promise to `<UserMenu>` inside `<Suspense>` — nav chrome renders static, user session streams in
- **Signed-in redirect**: `proxy.ts` redirects `/` and `/auth/login` to `/map` when user is authenticated
- **`proxy.ts`** (not `middleware.ts`): Next.js 16 renamed it; exported function is `proxy`, not `default`

### Data flow
- **Territory GeoJSON**: fetched via `/api/territories` -> `get_territories_geojson()` RPC; owned by TanStack Query with `placeholderData: keepPreviousData` so map never goes blank on transient errors
- **Territory insert**: via `claim_territory()` RPC — Supabase JS `.from().insert()` can't call PostGIS functions inline
- **Realtime**: Supabase channel on `territory_events` INSERT -> `queryClient.invalidateQueries` -> refetches territories -> `source.setData()` repaints map
- **Coordinate order**: Geolocation API -> `(lat, lng)`. GeoJSON/MapLibre/Turf -> `[lng, lat]`. Convert at GPS input boundary in `active-walk-controls.tsx`

### Map
- **`ssr: false` constraint**: `next/dynamic(..., { ssr: false })` must live in a `'use client'` file. `map-client.tsx` is a thin wrapper for this reason alone
- **ResizeObserver**: MapLibre reads dimensions at init; ResizeObserver calls `map.resize()` when container size changes

## Testing
Vitest is set up (`vitest.config.ts`). Run with `npm test` (or `npm run test:watch` for watch mode).

| Test file | What's covered |
|-----------|----------------|
| `tests/polygon.test.ts` | `buildPolygon`: valid loop, too few points, GPS jitter dedup, self-intersecting path, sub-500m² area, area proportionality |
| `tests/proxy.test.ts` | Middleware: unauthenticated pass-through and protected-route redirects; authenticated redirects from auth pages |
| `tests/territories-api.test.ts` | `/api/territories` route: success, RPC error (500, generic message), null fallback; `fetchTerritories` throws on non-200 |

## Critical paths (review carefully before committing)
| File | Role |
|------|------|
| `app/actions/walks.ts` | Server Actions: startWalk / completeWalk / discardWalk; calls `claim_territory` RPC and `updateTag('leaderboard')` |
| `lib/geo/polygon.ts` | Turf pipeline: simplify -> close ring -> kinks check -> area check |
| `proxy.ts` | Auth middleware protecting /map /leaderboard /profile; redirects signed-in users from / and /auth/login |
| `app/api/territories/route.ts` | GET territories; returns 500 (not 200 + empty) on RPC error |
| `lib/supabase/server.ts` | createServerClient with cookie handlers |
| `lib/supabase/client.ts` | createBrowserClient |
| `app/(app)/map/_components/` | GPS state machine, MapLibre init, walk recording UI |
| `app/(app)/leaderboard/page.tsx` | Cached leaderboard with cacheTag('leaderboard') |

## Roadmap
### Phase 7 — Performance audit (next)
- Apply `unstable_instant` to `/map` and `/leaderboard`
- Fix any Suspense errors it surfaces
- Lighthouse / Next DevTools verification

## File map
```
proxy.ts                                    Next.js 16 middleware (auth guard + signed-in redirects)
lib/supabase/server.ts                      createServerClient with cookie handlers
lib/supabase/client.ts                      createBrowserClient
lib/geo/polygon.ts                          turf: simplify -> close ring -> kinks check -> area check
app/actions/walks.ts                        startWalk / completeWalk / discardWalk Server Actions
app/api/territories/route.ts                GET -> get_territories_geojson() RPC (500 on error)
app/(app)/layout.tsx                        cookie-promise pattern, nav chrome static shell
app/(app)/map/page.tsx                      static Server Component, renders <MapClient />
app/(app)/map/_components/
  map-client.tsx                            'use client': walk state, TanStack Query, Realtime sub
  territory-map.tsx                         MapLibre init, territory fill layer, live walk-path line
  active-walk-controls.tsx                  GPS watchPosition, state machine, calls Server Actions
  map-skeleton.tsx                          CLS-safe placeholder matching map dimensions
app/(app)/leaderboard/page.tsx              Cached leaderboard (cacheTag + cacheLife)
app/(app)/leaderboard/loading.tsx           Pulse skeleton for cold cache
app/(app)/leaderboard/_components/
  leaderboard-table.tsx                     Rank medals, walker name, territory count, km²
supabase/001_schema.sql                     Tables, RLS, trigger, helper RPCs
supabase/002_phase5.sql                     claim_territory() + Realtime setup
supabase/003_leaderboard.sql                get_leaderboard() RPC
tests/polygon.test.ts                       buildPolygon unit tests
tests/proxy.test.ts                         middleware redirect unit tests
tests/territories-api.test.ts              API route + fetchTerritories error handling tests
vitest.config.ts                            Vitest config (node env, @ alias)
```
