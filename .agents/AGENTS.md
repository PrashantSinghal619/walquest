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
Live at **https://walquest.vercel.app**. Env vars set in Vercel dashboard. NO git remote is configured — deploy with `npx vercel --prod` (project linked via `.vercel/project.json`).

## Supabase setup
Credentials live in `.env.local` (gitignored). Key env var name is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not ANON_KEY — Supabase renamed it).

SQL migrations — run in order in Supabase Dashboard -> SQL Editor:
| File | Status | What it does |
|------|--------|-------------|
| `supabase/001_schema.sql` | Run | Tables, RLS, triggers, `get_territories_geojson()` |
| `supabase/002_phase5.sql` | Run | `claim_territory()` RPC + Realtime on `territory_events` |
| `supabase/003_leaderboard.sql` | Run | `get_leaderboard()` RPC |
| `supabase/004_hardening.sql` | Run | Drops unguarded `insert_territory()`; `claim_territory()` recomputes area server-side, validates walk ownership, merges own overlapping territories |
| `supabase/005_popups.sql` | Run | Adds `owner_name` (email prefix via `auth.users`) to `get_territories_geojson()` properties for map popups |

## Database
Tables: `users` (`id`, `username`, `display_name`, `created_at` — no email), `walks`, `territories` (PostGIS geometry), `territory_events`

`public.users` has NO email column. Email lives in `auth.users` — only accessible via SECURITY DEFINER RPCs.

Trigger: `on_auth_user_created` -> auto-inserts `id` into `public.users`
`spatial_ref_sys` having RLS disabled is **expected** — PostGIS system table.

RPCs:
- `claim_territory(p_owner_id, p_walk_id, p_geom_json, p_area_m2)` -> JSON `{territory_id, clipped_count, lost_count, merged_count, area_m2}` — atomic conflict resolution via ST_Intersects + ST_Difference; clips other owners' territories; MERGES (ST_Union) your own overlapping ones. `p_area_m2` is ignored (area recomputed server-side from geometry), walk must be caller-owned and `in_progress`, min 500 m² enforced in SQL
- ~~`insert_territory()`~~ — dropped in 004 (was SECURITY DEFINER with no auth check — anyone could insert territories for any owner)
- `get_territories_geojson()` -> JSON FeatureCollection — all territories, public read; after 005 properties include `owner_name` (email prefix, LEFT JOIN `auth.users`)
- `get_leaderboard()` -> table rows — top 20 by total area, reads email from `auth.users` via SECURITY DEFINER

## Git phase tags
```
phase-3  MapLibre client island + OpenFreeMap tiles
phase-4  Walk recording + territory claiming (Server Actions + PostGIS)
phase-5  Conflict resolution + Realtime + .agents/ framework
phase-6  Leaderboard with cacheTag/updateTag
phase-7  Instant navigation audit (unstable_instant)
```

## Key architecture patterns

### Caching
- **`cacheComponents: true`**: all components dynamic by default; opt-in with `'use cache'`
- **`cacheTag` + `updateTag`**: `cacheTag('leaderboard')` inside `'use cache'` function; `updateTag('leaderboard')` in Server Actions for read-your-own-writes
- **`'use cache'` + Supabase**: cached functions have no request context, so cannot use cookie-based `createClient()` from `lib/supabase/server`. Use plain `createClient` from `@supabase/supabase-js` for public data RPCs.

### Instant navigation (`unstable_instant`)
- **`app/(app)/layout.tsx`**: `export const unstable_instant = false` — reads cookies, too dynamic for first-entry validation; exempts the layout while still allowing sibling-navigation checks
- **`app/(app)/map/page.tsx`**: `export const unstable_instant = { prefetch: 'static' }` — synchronous shell, no server data, passes cleanly
- **`app/(app)/leaderboard/page.tsx`**: `export const unstable_instant = { prefetch: 'static' }` — `fetchLeaderboard` is `'use cache'`; `loading.tsx` provides Suspense fallback for cold cache
- **DevTools**: `instantNavigationDevToolsToggle: true` in `next.config.ts` enables the "Instant Navs" panel in Next.js DevTools

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
| `tests/walks-actions.test.ts` | Server Actions (mocked Supabase): auth guards, ownership scoping, double-claim rejection, invalid/malformed polygon rejection, RPC failure handling, cache invalidation, server-area preference |
| `tests/focus.test.ts` | `computeFocusTarget`: combined bounds, territory-only, fix-only, rival territories ignored, multi-territory span, non-Polygon safety |
| `tests/format.test.ts` | `formatAreaM2` (m²/km² threshold, grouping), `formatClaimDate` (en-IN, garbage input) |

## Known operational notes
- **Stale `.next` cache**: if routes return 404 unexpectedly (especially after major config changes), `rm -rf .next` and restart the dev server. Turbopack can generate a corrupted `routes.d.ts` that makes it lose track of compiled routes.
- **Territory disappearance**: most likely cause is conflict resolution — `claim_territory()` clips or deletes territories belonging to other owners via `ST_Intersects + ST_Difference`. A user on a different device/account walking an overlapping loop will erase your territory. Check Supabase Dashboard -> Table Editor -> territories to confirm.
- **Walk splitting**: when a claim cuts an opponent's territory in two, only the LARGEST surviving piece is kept (`ST_Dump ... LIMIT 1` — `geom` column is `Polygon`, not `MultiPolygon`). Smaller fragments are silently dropped; their area is included in the `clipped` event delta.
- **Error-state walks**: `active-walk-controls.tsx` keeps the `walkId` on claim/GPS errors so the user can Keep Walking (resume) or Discard. Walks orphaned as `in_progress` before this fix may still exist in the table.

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
### Phase 10 — Walk history (next)
- List of completed walks with distance, duration, and territory outcome (claimed/clipped/lost)
- Reuse `walks` + `territory_events` tables; no new SQL needed
- Could live as a tab on the Profile page or its own `/walks` route

### Phase 11 — PWA / install prompt
- `manifest.json` + service worker so the app installs on Android home screen
- Relevant since the whole point is outdoor phone use
- `next-pwa` or manual approach via `app/manifest.ts`

## File map
```
next.config.ts                              cacheComponents: true, instantNavigationDevToolsToggle: true
proxy.ts                                    Next.js 16 middleware (auth guard + signed-in redirects)
lib/supabase/server.ts                      createServerClient with cookie handlers
lib/supabase/client.ts                      createBrowserClient
lib/geo/polygon.ts                          turf: simplify -> close ring -> kinks check -> area check
lib/geo/focus.ts                            computeFocusTarget: initial camera bbox (own territories + GPS fix)
lib/format.ts                               formatAreaM2 / formatClaimDate (en-IN, shared by popup + profile)
app/actions/walks.ts                        startWalk / completeWalk / discardWalk Server Actions
app/api/territories/route.ts                GET -> get_territories_geojson() RPC (500 on error)
app/(app)/layout.tsx                        cookie-promise pattern, nav chrome static shell; unstable_instant = false
app/(app)/_components/user-menu.tsx         Server Component: reads session, passes name/email to dropdown
app/(app)/_components/user-menu-dropdown.tsx 'use client': User icon button -> profile link + sign out (radix dropdown)
components/ui/dropdown-menu.tsx             shadcn-style wrapper over radix-ui DropdownMenu
app/(app)/map/page.tsx                      static Server Component shell; unstable_instant = { prefetch: 'static' }
app/(app)/map/_components/
  map-client.tsx                            'use client': walk state, TanStack Query, Realtime sub
  territory-map.tsx                         MapLibre init, fill layer, walk-path line, click popup, initial focus
  active-walk-controls.tsx                  GPS watchPosition, state machine, calls Server Actions
  map-skeleton.tsx                          CLS-safe placeholder matching map dimensions
app/(app)/leaderboard/page.tsx              Cached leaderboard (cacheTag + cacheLife); unstable_instant = { prefetch: 'static' }
app/(app)/leaderboard/loading.tsx           Pulse skeleton for cold cache (Suspense fallback)
app/(app)/leaderboard/_components/
  leaderboard-table.tsx                     Rank medals, walker name, territory count, km²
app/auth/login/page.tsx                     Magic link form; flash messages in Suspense (searchParams dynamic)
app/auth/callback/route.ts                  PKCE code exchange; redirects to /map or error message
app/auth/actions.ts                         signIn / signOut Server Actions
supabase/001_schema.sql                     Tables, RLS, trigger, helper RPCs
supabase/002_phase5.sql                     claim_territory() + Realtime setup
supabase/003_leaderboard.sql                get_leaderboard() RPC
supabase/004_hardening.sql                  drop insert_territory; hardened claim_territory (server area, walk check, self-merge)
supabase/005_popups.sql                     get_territories_geojson + owner_name for popups
tests/polygon.test.ts                       buildPolygon unit tests (incl. malformed-payload rejection)
tests/focus.test.ts                         computeFocusTarget unit tests
tests/format.test.ts                        formatAreaM2 / formatClaimDate unit tests
tests/proxy.test.ts                         middleware redirect unit tests
tests/territories-api.test.ts              API route + fetchTerritories error handling tests
tests/walks-actions.test.ts                 Server Action guards, claim flow, cache invalidation (mocked Supabase)
vitest.config.ts                            Vitest config (node env, @ alias)
```
