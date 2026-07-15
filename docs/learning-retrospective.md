# walquest — Learning Retrospective

The original motive for this project: learn Next.js fundamentals — SSR, React
Server Components, Server Actions, backend RPC design — and develop a playbook
for making AI-assisted development produce a production-grade app. This
document is the retrospective on what was actually learned.

---

## 1. Tech concepts (hands-on, with scars)

### React Server Components & SSR

- **The inverted mental model**: with `cacheComponents: true`, everything is
  dynamic unless opted in with `'use cache'` — the opposite of classic SSG
  thinking. Caching became a per-function decision (`fetchLeaderboard`), not
  a per-page one.
- **Static shell + streaming**: every page renders instant synchronous JSX
  while dynamic data suspends behind `<Suspense>`. The cookie-promise pattern
  in `app/(app)/layout.tsx` is the purest example — call `cookies()` WITHOUT
  awaiting, pass the Promise into a suspended child, and the nav chrome never
  blocks on the session.
- **Server/client boundary discipline**: `ssr: false` requires a
  `'use client'` file (`map-client.tsx` exists solely for this); Server
  Components pass plain props to client islands (`UserMenu` ->
  `UserMenuDropdown`); `NEXT_PUBLIC_` env vars are inlined at build time
  (adding one requires a redeploy).
- **`unstable_instant`** taught the deepest lesson: navigations enter at
  EVERY shared layout boundary, so a Suspense boundary that saves a page load
  can be invisible to a sibling navigation. Dynamic segments need
  `prefetch: 'runtime'` + `samples`.

### Server Actions + backend RPC

- Every action follows the same skeleton: auth guard BEFORE any DB touch ->
  validate untrusted input -> scoped query (`user_id`, never just `walkId`)
  -> RPC -> cache invalidation (`updateTag` for read-your-own-writes).
- **Push complexity into the database when atomicity matters**:
  `claim_territory()` does intersection, clipping, deletion, merging, and
  event logging in one transaction. The JS layer just calls it.
- **Never trust the client, even your own**: the security audit found
  `p_area_m2` trusted from the caller and an unguarded SECURITY DEFINER RPC.
  Rule burned in: SECURITY DEFINER functions verify `auth.uid()` and
  recompute derived values from source data.
- RLS as the default posture; the service-role key as the deliberate, narrow
  exception (reading push-victims' subscriptions server-side).

### Client data flow

- TanStack Query + Supabase Realtime invalidation + 45 s polling fallback.
- The 200-with-empty-body antipattern: throw on `!res.ok` +
  `placeholderData: keepPreviousData`, or the UI caches emptiness as truth.

## 2. System-design thinking that emerged

- **One source of truth, many presentations**: the territories table feeds
  the map GeoJSON, leaderboard, profile, popups, and events. Divergence
  between them was always a presentation bug, never a data bug (the
  "territory on leaderboard but not on map" RCA).
- **Design for graceful degradation**: push no-ops without env vars; service
  worker failures fall back to plain fetch; GPS focus proceeds without a fix.
  Features fail sideways, never downward into the core loop.
- **Separate deadlines for separate concerns**: camera focus (2.5 s budget)
  vs GPS dot (no deadline, keep trying) — conflating them was the bug.
- **Calendar-gated vs effort-gated tracks** (RN port plan): store reviews and
  the Play 14-day closed test can't be compressed by working harder, so they
  start first.

## 3. The debugging method that worked

Five real incidents, one repeatable playbook:

1. **Verify hop-by-hop with real data, not theory** — the missing-territory
   RCA curled the RPCs directly: table -> RPC -> deployed API -> client,
   finding every hop healthy, which PROVED the issue was perceptual
   (same-colour adjacency).
2. **Reproduce before fixing** — the blank map got a temporary
   unauthenticated route + DOM measurement: `mapContainer: h=0,
   position: relative` was proof, not hypothesis.
3. **Suspect your own last change first** — the blank map came from the
   ownership-colouring restructure one commit earlier.
4. **When one symptom has two candidate causes, fix the proven one and
   harden the other** (layout fix + best-effort SW caching, one commit).
5. **Generalize every failure** — the maplibre-gl.css cascade trap shipped
   TWICE because the first fix wasn't generalized. Now a standing rule
   (.agents/CLAUDE.md): symptom -> root cause -> class-level rule, recorded
   in AGENTS.md in the same commit as the fix.

Incidents covered: territory data "disappearing" (200-on-error antipattern),
blank map (CSS cascade), intermittent GPS dot (deadline conflation),
leaderboard/map divergence (uniform colouring), background-lock route gaps
(web platform limit).

## 4. Signature tradeoffs

| Decision | Chose | Cost accepted |
|---|---|---|
| Error handling in map data | Throw + keep stale data | Briefly stale > blank |
| Walk splitting | Keep largest piece only | Fragments vanish (Polygon column, simpler) |
| Self-overlap | Merge (ST_Union) | More SQL complexity > inflated leaderboard |
| Offline scope | Tiles only, never app assets | No full offline > stale-chunk hell |
| Background tracking | Wake lock + honest gap warning | Screen-on battery > silent fake routes |
| Own vs rival colours | Two-tone, session-relative | Terracotta doubles as walk-path colour |
| Popup names | Email prefix via SECURITY DEFINER | No display-name system yet |

## 5. Timeline: estimated vs actual

Traditional solo build (mid-level dev, 8 h/day, 5-day weeks):

| Stream | Est. days |
|---|---|
| Scaffold, auth (magic link + middleware), landing | 3–4 |
| Map island, GPS recording, polygon pipeline, claim flow | 6–8 |
| Conflict resolution SQL, Realtime, leaderboard + caching | 4–5 |
| Profile, history, replay, popups, responsive/copy polish | 6–7 |
| Security audit + test suite (72 tests) | 4–5 |
| PWA, push (VAPID/SW), offline tiles, wake lock | 5–6 |
| Incident debugging + RCA (5 real incidents) | 3–4 |
| Docs, README, port strategy | 2 |
| **Total** | **33–41 days ≈ 7–8 weeks** |

**Actual: ~2 calendar weeks of intermittent AI-assisted sessions** — roughly
25–35 focused hours, ≈ 4–5 workdays of seat time. A 6–8× throughput
multiplier, with honest caveats: real-walk field testing was the
irreplaceable human verification loop, and the multiplier held BECAUSE of
the playbook below, not despite it.

### The AI-assisted development playbook

- **Versioned knowledge base** (`.agents/AGENTS.md`, `.agents/CLAUDE.md`)
  recompiled every phase — sessions never start cold.
- **Pre-commit hooks** forcing review/testing skills on critical paths —
  they caught three real blockers before commit (TanStack error handling,
  leaked DB error message, unmount race).
- **Tests before claims** on business logic; deploy-and-verify every
  increment; small commits with real messages.
- **Generalize failures** into the knowledge base, same commit as the fix.
- **Human stays the decision-maker** on gameplay tradeoffs (merge vs clip,
  orphan handling, "what is substantial area") while delegating
  implementation and diagnosis.

## 6. Skill-focus weighted matrix

| Skill area | Weight | Evidence |
|---|---|---|
| Next.js App Router: RSC, Suspense, streaming, caching, instant nav | 20% | cacheTag/updateTag, cookie-promise, unstable_instant across 6 routes |
| Database & backend: PostGIS, SQL RPCs, RLS, atomicity, security | 18% | 7 migrations, claim_territory evolution, 004 hardening |
| Interactive client: MapLibre, GPS state machines, geometry UX | 15% | territory-map, walk controls, focus/locate/replay |
| Server Actions & API design: guards, validation, error contracts | 12% | walks/push actions, territories route |
| Debugging & RCA methodology | 10% | 5 incidents, hop-by-hop verification, empirical repro |
| Platform capabilities: PWA, web push, service workers, wake lock | 10% | Phases 11, 13, 14 + their limits |
| Testing strategy: unit/integration, mocking boundaries | 8% | 72 tests, thenable Supabase mocks, what-not-to-test |
| AI-assisted development playbook | 7% | .agents/ system, hooks, skills, failure-generalization rule |

The weights say something real: this project was ~50% "full-stack
correctness" (Next.js + DB + actions) and ~50% everything production demands
around it — which is exactly the gap between tutorial knowledge and a
production-grade app.
