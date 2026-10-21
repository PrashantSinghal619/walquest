# GitHub Copilot Instructions for Walquest

Walquest is a real-time territory-conquest walking game for Bengaluru built on Next.js 16, React 19, Supabase (Postgres + PostGIS + Auth + Realtime), and MapLibre GL JS.

When reviewing pull requests and suggesting code changes, strictly adhere to the following principles:

## Mobile client scope

- `apps/mobile` uses Expo SDK 58, React Native and Expo Router. Apply the Next.js, browser CSS and service worker rules below to the web client.
- Shared pure geometry and formatting live in `packages/domain`; the web `lib` paths forward to that source.
- Preserve raw GPS timestamps and interruption segments. Distance and map lines exclude missing intervals.
- Background tasks register at module scope and save samples to SQLite before updating the UI. Native delivery needs physical-device evidence.
- Mobile auth uses Supabase PKCE magic links and SecureStore. Client builds contain public publishable keys only; service-role keys remain server-side.

## 1. Next.js 16 & React Server Components Architecture
- **Dynamic by Default (`cacheComponents: true`)**: All components and routes are dynamic by default. Do not use legacy Next.js caching assumptions. Caching is opt-in via explicit `'use cache'` directives.
- **Cache Tags**: Use `cacheTag(...)` inside `'use cache'` functions and `updateTag(...)` inside Server Actions for read-your-own-writes consistency.
- **Client Components (`'use client'`)**: Only use `'use client'` when state, event handlers, or browser APIs (like MapLibre or Geolocation) are required. Keep client islands leaf-level and minimal.
- **Dynamic Imports with `ssr: false`**: Next.js requires `dynamic(..., { ssr: false })` to reside in a `'use client'` module (e.g., `map-client.tsx`).

## 2. Geometry & Geospatial Coordinates
- **Coordinate Ordering**:
  - Browser Geolocation API returns `(latitude, longitude)`.
  - GeoJSON, MapLibre GL JS, and Turf.js use `[longitude, latitude]`.
  - Always verify coordinate ordering across GPS boundaries and transformations.
- **Polygon Validity**:
  - Closed loops must be simplified, checked for self-intersections (no kinks), and meet the minimum 500 m² territory claim area.
  - Geometry operations in PostGIS must preserve polygon validity.

## 3. Backend & Security (Supabase / Server Actions)
- **Authentication & Ownership**: All Server Actions (e.g. `startWalk`, `completeWalk`, `discardWalk` in `app/actions/`) must strictly verify the caller's authenticated session and ownership before performing database queries or RPC calls.
- **User Data Isolation**:
  - `public.users` table contains `id`, `username`, `display_name`, `created_at` (no email).
  - Email addresses live in `auth.users` and must only be accessed through `SECURITY DEFINER` RPCs or authenticated server contexts.
- **RPC Contracts**: Atomic conflict resolution happens in the PostGIS RPC `claim_territory()`, which clips rival polygons and merges self-overlapping polygons server-side.

## 4. Frontend & Service Worker Resilience
- **Non-Load-Bearing Service Worker**: `public/sw.js` cache operations must be best-effort. If offline caching or IndexedDB fails, the app must gracefully fall back to network without breaking UI rendering or navigation.
- **Map Container Sizing**: Never apply CSS `position: absolute` directly to the MapLibre container element; use flex layout to prevent height collapse.
