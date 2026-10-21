# walquest

Walk it. Claim it. Defend it. A real-time territory-conquest walking game for Bengaluru.

Walk a loop through your neighbourhood, close it into a polygon, and claim that ground as yours. Anyone who walks an overlapping loop clips your territory — walk again to take it back. Live at **[walquest.vercel.app](https://walquest.vercel.app)**.

Built as a hands-on vehicle for learning Next.js App Router internals: React Server Components, `cacheComponents`, streaming with Suspense, and instant navigation validation.

## How it works

1. Sign in with a magic link (Supabase Auth, PKCE)
2. Open the map — it focuses on your territories and current location
3. Start a walk; GPS traces your path live on the map
4. Close your loop and claim — the server validates the polygon (Turf.js) and resolves conflicts atomically in PostGIS
5. Overlapping rival territories get clipped; your own overlapping claims merge into one
6. Every claim updates all open maps in real time and reshuffles the leaderboard

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (`cacheComponents: true`), React 19, TypeScript strict |
| UI | Tailwind 4, shadcn/ui, MapLibre GL JS + OpenFreeMap tiles |
| Backend | Supabase — Postgres + PostGIS, Auth, Realtime |
| Geometry | @turf/turf (client/server validation), PostGIS RPCs (conflict resolution) |
| Data | TanStack Query v5 (polling + Realtime invalidation) |
| Tests | Vitest |

## Setup

1. **Install**: `npm install`

2. **Supabase**: create a project, then run the migrations in order in Dashboard → SQL Editor:
   `supabase/001_schema.sql` → `002_phase5.sql` → `003_leaderboard.sql` → `004_hardening.sql` → `005_popups.sql` → `006_walk_distance.sql` → `007_push.sql`

3. **Env vars**: create `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
   NEXT_PUBLIC_SITE_URL=http://localhost:3000

   # Push notifications (optional - the app runs fine without these)
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<from: npx web-push generate-vapid-keys>
   VAPID_PRIVATE_KEY=<same command>
   VAPID_SUBJECT=mailto:<your email>
   SUPABASE_SERVICE_ROLE_KEY=<Supabase Dashboard -> Settings -> API>
   ```
   Note: Supabase renamed the anon key — the env var is `PUBLISHABLE_KEY`, not `ANON_KEY`. The service-role key is only used server-side to look up push subscriptions of players whose territory was clipped; without it (or the VAPID vars), notifications silently no-op.

4. **Auth redirect**: in Supabase Dashboard → Authentication → URL Configuration, add `http://localhost:3000/auth/callback` (and your production URL) to the redirect allowlist.

5. **Run**: `npm run dev` — GPS requires HTTPS or localhost; test walk recording on a phone via your LAN IP only if you proxy TLS, otherwise use localhost.

## Testing

```bash
npm test            # run all suites once
npm run test:watch  # watch mode
```

Covers polygon validation, auth middleware, API error handling, Server Action guards, camera focus logic, and display formatting. See `.agents/skills/testing-strategy.md` for the full strategy and what deliberately isn't unit-tested (MapLibre rendering, live GPS, Realtime).

## CI & Code Review

Continuous Integration and automated code reviews are configured with GitHub Actions and GitHub Copilot:

- **Automated Tests (`.github/workflows/ci.yml`)**: Runs Vitest test suites on pushes and PRs against `master` and `develop`.
- **GitHub Copilot Code Review (`.github/copilot-instructions.md`)**: Custom repository instructions that guide Copilot during PR code reviews to adhere to Next.js 16 App Router conventions (`cacheComponents: true`), PostGIS coordinate order (`[lng, lat]`), and Server Action security patterns. Copilot can be assigned as a reviewer on any PR or enabled for automatic reviews in repository settings.

## Deployment

No git remote is configured — deploy straight from the working tree:

```bash
npx vercel --prod
```

The project link lives in `.vercel/project.json`; env vars are set in the Vercel dashboard.

## Project documentation

Deeper docs live in [`.agents/`](.agents/) (also loaded as agent context):

- [`AGENTS.md`](.agents/AGENTS.md) — architecture patterns, database schema and RPC contracts, migration status, operational gotchas, roadmap
- [`CLAUDE.md`](.agents/CLAUDE.md) — Next.js 16 specifics and project conventions
- [`skills/`](.agents/skills/) — code-review checklist and testing strategy

## Known behaviours (by design)

- Claims below 500 m² are rejected — walk a proper block
- A claim that splits a rival's territory keeps only the largest surviving piece
- Your own overlapping claims merge into one territory (no double-counted area)
- The leaderboard shows the part of your email before the `@`
