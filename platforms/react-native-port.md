# walquest — React Native port strategy (Android + iOS)

Status: M1 implementation prepared; native/device acceptance is pending. EAS cloud builds are the selected build workflow
(21 October 2026). Follow [the build budget and milestone plan](./mobile-build-plan.md)
for batching, acceptance criteria, and time estimates. This document captures the porting strategy and
the store/account setup so either can be picked up independently. The two
tracks are deliberately separate: Track 2 is calendar-gated (reviews, waiting
periods) and must start first; Track 1 is effort-gated.

**Primary motivation:** background location. Browsers freeze pages when the
screen locks, so the web app cannot record a pocket-locked walk (see the
"No background geolocation on the web" note in `.agents/AGENTS.md`). Only a
native app with OS background-location permission fixes this.

---

## Track 1 — The port

### Shared backend

Keep Supabase as the shared backend. Before mobile claiming, resolve the
authorization, direct-write, atomic-completion and concurrency findings in
`docs/project-handoff.md`. Mobile needs the full completion contract, including
walk persistence, notifications and web cache refresh; calling the existing
claim RPC alone does not provide that contract.

- Supabase project: auth, Postgres + PostGIS, Realtime — unchanged
- Existing data and RPCs are the starting point; verified corrective migrations will be needed
- The web app keeps running against the same database; web + native coexist

### What ports as-is (pure TypeScript)

- `lib/geo/polygon.ts`, `lib/geo/focus.ts`, `lib/geo/replay.ts`, `lib/format.ts`
- TanStack Query patterns; supabase-js (uses a SecureStore auth adapter + URL polyfill in RN)
- Extract these into a shared package (monorepo) so web and native don't drift

### What gets rebuilt

| Piece | Web today | React Native |
|---|---|---|
| UI framework | Next.js RSC + Server Actions | Expo + Expo Router; shared authenticated completion contract replaces web-only Server Actions |
| Styling | Tailwind 4 / shadcn | NativeWind + RN primitives — every screen re-laid-out |
| Map | MapLibre GL JS | `@maplibre/maplibre-react-native` — same OpenFreeMap style URL, different component API. Requires an EAS dev build (native module - Expo Go won't run it) |
| Auth | Magic link -> HTTP callback | Deep link (`walquest://auth`) via expo-linking, or switch to email OTP codes (better UX on a phone) |
| Push | web-push + VAPID (`lib/push.ts`, `push_subscriptions` table) | Expo Notifications (or FCM/APNs directly); server sender reworked; table stores Expo push tokens instead of endpoints |
| Offline tiles / SW / PWA / wake lock | Hand-built (sw.js, manifest, Wake Lock API) | Free or trivial natively (map SDK caches tiles; `expo-keep-awake`; mostly moot once background tracking exists) |

### The prize: background location

`expo-location` background updates + Android foreground service. Real work
beyond the API call:

- Battery-sane update tuning (distance filter, accuracy profile)
- Resuming an in-progress walk after the OS kills the app
- Permission UX for Android "Allow all the time" / iOS "Always"
  (two-step prompts; both OSes require in-app justification first)

### Relative sizing

- Map + walk recording (HUD, popups, ownership layers, locate, replay): ~40%
- Screens (profile, leaderboard, walk history): ~25%
- Background location + edge cases: ~15%
- Auth deep-linking: ~10%
- Push rework: ~10%

### Recommended stack

Expo (managed) + Expo Router + `@maplibre/maplibre-react-native` +
supabase-js + TanStack Query + NativeWind. EAS Build for CI builds and
store submission.

---

## Track 2 — Accounts and publishing (start day 1; calendar-gated)

### Apple — $99/year

- Individual enrollment: 1-3 days. Organization: requires a D-U-N-S number — allow 1-2 weeks
- TestFlight external testing needs a lightweight review (~1 day); App Store review typically 1-3 days per submission
- Background location gets extra scrutiny: `NSLocation*UsageDescription` purpose strings, obvious in-app justification, sometimes a demo video for the reviewer
- Privacy policy URL + App Privacy nutrition labels mandatory
- Magic link / email OTP auth is fine — Sign in with Apple is only mandated when offering third-party social logins

### Google — $25 one-time

- Identity verification: a few days
- **Personal accounts: closed test with 12 testers for 14 consecutive days is required before production access.** Two weeks of wall-clock time — recruit testers on day 1
- `ACCESS_BACKGROUND_LOCATION` requires a declaration form + video showing the in-app prominent disclosure; review can add days to weeks
- Data safety form + privacy policy required

### Shared prep (cheap, do early)

- Privacy policy page — walquest collects precise location; say so plainly
- Store listing copy, screenshots, feature graphic (Play), content ratings

---

## Sequencing

1. **Day 1, in parallel:** enroll both accounts, request D-U-N-S if publishing
   as an org, write the privacy policy, recruit the 12 Play testers
2. Scaffold Expo + auth + shared-lib extraction, then the map/walk core first
   (proves the riskiest part: native MapLibre + GPS)
3. Ship to TestFlight + Play closed testing as soon as the walk loop works;
   the Play 14-day clock and background-location reviews run while the
   remaining screens and push get finished
4. Keep the web app live throughout — same backend, zero-install funnel

---

## Alternative considered: Capacitor wrapper

Wrapping the existing Next.js UI in Capacitor + a background-geolocation
plugin reaches both stores with roughly a quarter of the effort, at the cost
of a webview feel and keeping the web map's constraints. Right call if the
only goal is pocket-locked tracking shipped fast; React Native is the right
call for native map performance and a long-term mobile product. Track 2 is
identical either way.
