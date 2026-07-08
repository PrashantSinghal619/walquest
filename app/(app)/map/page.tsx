import { MapClient } from "./_components/map-client";

export const unstable_instant = { prefetch: "static" };

// Static Server Component shell - renders instantly with no data fetching.
// MapLibre (~400KB gzipped) is excluded from this server bundle entirely:
// MapClient is a Client Component that lazy-loads TerritoryMap with ssr:false,
// so MapLibre only downloads when the user navigates to /map.
export default function MapPage() {
  return <MapClient />;
}
