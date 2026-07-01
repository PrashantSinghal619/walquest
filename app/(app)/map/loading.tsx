import { MapSkeleton } from "./_components/map-skeleton";

// Next.js shows this file while the page is streaming in (route-level Suspense).
// The header is already rendered by the parent (app)/layout, so only the
// main content area needs a placeholder.
export default function MapLoading() {
  return <MapSkeleton />;
}
