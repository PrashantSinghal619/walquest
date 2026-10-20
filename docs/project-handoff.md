# Project handoff — 16 October 2026

## Scope and evidence

Reviewed the shared agent notes, Claude instructions/hooks, architecture summary in `.local`, mobile strategy, schema migrations, walk actions and GPS state machine, geometry helpers, map/data flow, authentication, leaderboard, profile/replay, push and service worker implementation. Repository baseline: `b49b85b`. No application code or live infrastructure was changed during this assessment.

Local validation: 8 test files / 72 tests passed. ESLint reports 9 errors and 3 warnings, in map components, install prompt, push toggle and theme toggle (React hook/ref rules and unused suppressions). No production build, authenticated browser walkthrough, real-device walk or live database verification was performed. Passing mocked tests does not establish SQL correctness.

## Product rules implemented today

1. Email magic-link authentication uses Supabase with a web PKCE callback. A signup trigger creates the public user record. Map, leaderboard and profile pages require login; territory and leaderboard database reads are public. Display names currently use the email prefix, not the public profile's display_name field.
2. Start Walk creates a server-side `in_progress` walk. The browser then collects high-accuracy GPS positions in React memory, converting to `[longitude, latitude]`. There is no durable incremental route storage or resume after reload/navigation. Multiple unfinished walks are not prohibited.
3. Recording progresses through idle, starting, tracking, claiming, success and error. GPS/claim errors retain the walk ID and accumulated points for Keep Walking or Discard while the component remains alive. Discard marks the database row discarded; it does not save the recorded path.
4. Claim is a manual button. At least three points enable it. The server validates finite coordinate pairs and coordinate bounds, removes consecutive exact duplicates, simplifies the trace with tolerance 0.00005 degrees, connects the endpoint to the start, rejects self-intersections and rejects area below 500 square metres. There is no endpoint-distance check: completing a physical loop is not actually enforced.
5. PostGIS checks polygon validity and recomputes area using geography; client-supplied area is ignored. Existing rival ground is subtracted by the incoming polygon. A surviving piece under 500 square metres is deleted. If subtraction creates several pieces, only the largest is retained; discarded fragments count as lost area.
6. Own claims with genuine area overlap merge into one polygon. Mere edge/corner contact stays separate. The returned area is the entire merged territory; the claimed event records net newly gained area after subtracting absorbed owned area. Rival counts count territory records, not necessarily distinct players.
7. After the claim RPC, a separate update stores the raw route, distance along that route, completion status and end time. Duration is elapsed start-to-end time, including pauses. Distance does not include the artificial closing edge unless it was actually in the trace.
8. The leaderboard is the top 20 owners by current total territory area. It is not cumulative lifetime area or walking distance. There are no seasons, teams, expiry, daily limits or geographic leaderboard partitions. Bengaluru is the default camera/copy, not an enforced claim boundary.
9. Profile shows current holdings, completed-walk count, completed distance and the latest ten walks. Historical claim outcomes come from events. Replay is constant-distance interpolation over the stored route, not original timing: per-fix timestamps are not stored.
10. Territory events invalidate clients' map queries through Supabase Realtime; polling every 45 seconds is the fallback. The web leaderboard is separately cached and invalidated by the web claim action; it does not subscribe to the map's Realtime channel.
11. Territory-loss web push aggregates loss per affected owner. It depends on the subscriptions migration and server-side VAPID/service-role configuration. Notification failure does not fail a claim.
12. The PWA caches previously fetched OpenFreeMap tiles, glyphs, sprites and styles, bounded to 2,500 entries. It does not provide durable offline recording/synchronization or offline app startup. Wake lock and a warning for gaps over 30 seconds mitigate foreground recording; gaps do not prevent claims.

## Architecture and reuse

The project is a single Next.js application, not yet a monorepo or mobile app. Package declarations specify Next 16.2.9 and React 19.2.4 (the context note calling React a canary is stale). Supabase supplies Auth, Postgres/PostGIS and Realtime. MapLibre GL JS renders OpenFreeMap tiles. Turf builds claim polygons, and TanStack Query manages territory fetching.

The business logic spans three places: browser recording state in `app/(app)/map/_components/active-walk-controls.tsx`, server orchestration in `app/actions/walks.ts`, and authoritative geometry/conflict mutation in `supabase/004_hardening.sql`. Reusing only `lib/geo` would miss important business behavior.

| Piece | Mobile implication |
| --- | --- |
| Supabase data, user identities, PostGIS geometry, Realtime | Keep the shared infrastructure, after verifying and repairing backend invariants. |
| `lib/geo/polygon.ts`, `focus.ts`, `replay.ts`, `lib/format.ts` | Good shared TypeScript package candidates; preserve tests. Client validation remains advisory. |
| Branding, colours, content, screen flows | Reusable design decisions. |
| HTML/Tailwind/shadcn components, DOM map controls and popups | Not directly reusable React Native components; rebuild using native primitives. |
| Server Actions, cookies, SSR and Next cache invalidation | Web-specific; expose a deliberate authenticated completion contract for mobile. |
| Browser GPS, wake lock, service worker, web push | Replace/adapt with native recording, durable storage and notification support. |

The existing plan favors Expo/React Native and lists Capacitor as an alternative. It is a proposal, not an implemented decision. Its effort percentages and store timelines are estimates, not verified commitments. A native client calling the existing claim RPC directly would omit walk finalization, web cache invalidation and push dispatch currently performed by the Server Action.

Expo supports background location with platform configuration and permissions, but explicitly documents termination limits. Native tracking must not promise uninterrupted operation after force termination. See [Expo Location documentation](https://docs.expo.dev/versions/latest/sdk/location/), checked during this assessment. Persist samples locally, preserve timestamps/accuracy, detect missing segments and reconcile on restart. Prove locked-screen tracking on actual target phones before reproducing every screen.

## Backend findings to resolve before reuse

These findings follow from the checked-in SQL/actions. Live behavior may differ if dashboard changes were made without migrations.

- **Deletion/event reference conflict:** `004_hardening.sql` deletes a fully consumed territory and then inserts a lost event referencing its deleted ID. `001_schema.sql` defines an immediate foreign key for that field. `ON DELETE SET NULL` fixes existing references, not a newly inserted reference to an absent row. The checked-in combination should roll back that claim branch. Verify in an isolated PostGIS database.
- **Claim completion is not atomic or retry-safe:** the RPC does not mark the walk completed or lock its walk row. The subsequent application update is separate and its error is ignored. Retries or concurrent requests can reuse an unfinished walk. Rival row locks also do not serialize simultaneous claims into previously empty overlapping ground. Completion, conflict mutation and an idempotent result need a coordinated transaction/concurrency design.
- **Direct writes bypass game rules:** schema policies allow users to insert/update their own territories and insert their own events; area and geometry rules are not enforced on those paths. Walk status is also user-updatable. The hardened RPC is therefore not the only way to mutate game state under the checked-in policies.
- **Anonymous RPC guard is not null-safe:** `IF auth.uid() <> p_owner_id` does not reject a null identity. No explicit execute revocation is present in these migrations. Effective live grants need verification; use an explicit authenticated/null-safe check and controlled grants.
- **A valid polygon does not prove walking:** closure proximity, speed, GPS accuracy, implausible jumps, route gaps, trace size limits and anti-spoofing are not enforced. Claims accept client coordinates and the RPC accepts a client polygon. The plan's statement that SQL validates everything is too strong.
- **Ignored persistence errors:** discard can report success despite an update failure; completion can report success with an unsaved path/status. These matter particularly under mobile connectivity interruptions.

Before adding competitive mobile users, validate these cases against a separate database, including full loss, split territory, self-merge, anonymous/direct writes, duplicate completion, failed finalization and concurrent overlapping claims.

## Operational handoff

- Git remote **does** exist: `git@github.com:PrashantSinghal619/walquest.git`. README and agent notes saying no remote are stale. Remote existence does not establish push permissions or automatic deployment configuration.
- `.env.local` and `.vercel/project.json` exist. Credential validity, deployed environment settings and current deployment revision were not verified. Do not copy credentials into chat or documents.
- Notes say migrations 001–005 ran and 006 (distance backfill) and 007 (push subscriptions) did not. Treat this as reported history until the live schema is inspected. Do not rerun all migrations blindly; some create policies without idempotent guards.
- `.claude/settings.json` contains a Claude-specific pre-commit agent hook. Its review/testing intention should be retained, but that configuration alone does not establish equivalent automation in another tool. Shared review/testing guidance lives under `.agents/skills/`.
- `.local/Architecture summary — walquest.md` was already untracked and was left untouched. It adds the rationale for MapLibre/PostGIS and the intended map-refresh and initial-paint targets.

## Input still needed from the owner

No full Claude transcript is required. Provide only decisions, bugs or work not represented in this checkout; a short handoff summary is sufficient. Specifically:

1. Confirm whether React Native/Expo is chosen, or whether preserving existing UI code through a wrapper remains a priority; identify Android/iOS launch priority and available test phones.
2. Identify any manual Supabase changes and whether 006/007 were subsequently run. Arrange dashboard/CLI access when deployment verification is needed; supply access securely, not pasted secrets. A separate development/test database is needed for destructive claim scenarios.
3. Confirm intended rules for physical closure distance, missing GPS segments, allowable travel speed and whether losing all but the largest surviving fragment is desirable. These are product choices, not facts inferable from code.
4. Confirm whether existing live users/data must be preserved and which app-store/build accounts already exist. Account enrollment, identity verification and real-device permission prompts require owner participation when mobile delivery begins; no enrollment is required merely to complete this handoff.

Suggested execution order: reconcile deployed schema and rules, repair/test claim integrity, extract shared logic, prove durable native background recording and authentication, then port screens/replay and cross-platform notifications. Keep the web app working against the same backend throughout.
