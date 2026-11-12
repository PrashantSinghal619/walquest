Architecture summary — walquest
Stack: Next.js 16 (Cache Components enabled) + React 19 + TS strict + Tailwind 4 + shadcn/ui + TanStack Query + MapLibre GL JS + Turf.js + Supabase (Postgres/PostGIS/Auth/Realtime).

Map choice: MapLibre GL JS over OpenFreeMap (OSM-based vector tiles, free, no API key) — rejected MapMyIndia (signup/billing friction, license restricts caching), rejected Leaflet+raster (degrades when redrawing many live-updating competing polygons; MapLibre's WebGL GeoJSONSource.setData() handles that cheaply).

Real-time (≤1 min SLA): Supabase Realtime (Postgres change feed over WebSocket, sub-second in practice) as primary, with TanStack Query refetchInterval polling (~45s) as a resilience fallback if the socket drops — layered so you build the simple polling version first, then add push.

Data layer: Supabase Postgres + PostGIS (not Prisma — Prisma has no real PostGIS support, so you'd lose its main benefit on exactly the tables that matter). Tables: users, walks (raw GPS trace), territories (PostGIS polygon, GIST-indexed), territory_events (the Realtime trigger + leaderboard feed). Conflict rule for v1: new claim ST_Difference-clips any overlapping existing polygon; if remainder is empty, old owner loses it.

5s critical-paint SLA: Landing page is pure 'use cache', zero map dependency. The /map route's header/skeleton paints in the static shell; MapLibre itself is next/dynamic(..., {ssr:false}) behind a fixed-size skeleton (no CLS), loading after first paint. unstable_instant is applied to landing/map/leaderboard once Suspense boundaries are correctly scoped, used as a build-time guardrail.
