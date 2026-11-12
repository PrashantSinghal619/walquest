# Public web demo

The `/demo` route is a standalone, unauthenticated web experience. It reuses
the web map renderer with bundled fictional territories and a sample-loop
claim simulation. Claims live only in React state and reset on reload.
It never creates a Supabase session, subscribes to Realtime, loads production
territories, invokes walk actions, registers a service worker, or saves location.
Location is requested only by the map's explicit locate button. Map tiles are
loaded from OpenFreeMap; locating changes the viewport and therefore tile requests.

Existing `/map`, `/leaderboard`, and `/profile` routes remain protected.
The web `/api/territories` endpoint now requires a verified user. Existing server
actions retain their user and ownership guards. Mobile source, shared domain
code, database schema, and database permissions are unchanged.

This is isolation of the web demo, not a database-wide privacy migration.
Existing Supabase SQL grants public territory/event reads and anonymous RPC
execution, including email-derived display names. The demo never calls these
RPCs or includes a Supabase client. Changing those shared database permissions
requires a separate compatibility review of authenticated web and mobile clients.

## Validation

- `npx vitest run tests --exclude '.local/**'`: 75 tests passed.
- `npm run build`: passed; `/demo` prerendered statically.
- Browser: map tiles and sample territories render; sample walk, claim, reset
  work without sign-in or a location prompt.
- Responsive browser checks: 320×568, 390×844, 568×320, 768×1024,
  1024×768, and 1440×900. No horizontal overflow or map/footer overlap.
  The map keeps a 280px minimum height and short screens scroll vertically.
  Demo action buttons have a 44px minimum height. Phone claim flow checked.
  These are viewport checks in the desktop browser, not physical-device or
  Safari/iOS tests.
- Web TypeScript checks exclude `.local` and `apps/mobile`; deployment uploads
  exclude those directories and local environment files through `.vercelignore`.

## Deployment

The checkout is linked to Vercel project `walquest` through `.vercel/project.json`.
The deployment check failed with: "The specified token is not valid. Use
`vercel login` to generate a new token." No deployment or public demo URL was
verified during this change.

From the repository root:

1. Run `vercel login` and authenticate with an account that has deployment access
   to the linked `walquest` project. Alternatively supply a valid Vercel token
   through the deployment environment; do not commit or paste credentials into docs.
2. Run `vercel whoami` to verify the login.
3. Run `npx vercel --prod --yes`. Existing production Supabase environment
   variables must remain configured for the authenticated app.
4. Use the actual production address printed by Vercel with `/demo` appended.
   Confirm it opens in a signed-out/private browser without a Vercel login gate.
5. Verify `/api/territories` returns 401 signed out and `/profile` redirects to
   sign-in. Try the sample walk, claim and reset; no location prompt should appear
   until the locate button is pressed.

Rollback: redeploy the preceding Vercel production version. No database changes
or data cleanup are required.
