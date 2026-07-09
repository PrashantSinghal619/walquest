"use client";

// Exists to hold the dynamic() call with ssr:false - only valid inside a
// Client Component (same reason map-client.tsx exists for the main map).
import dynamic from "next/dynamic";
import type { LngLat } from "@/lib/geo/replay";

const WalkReplayMap = dynamic(() => import("./walk-replay-map"), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full animate-pulse rounded-lg border bg-muted" aria-hidden />
  ),
});

export function WalkReplay({ path }: { path: LngLat[] }) {
  if (path.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border">
        <p className="text-sm text-muted-foreground">
          No route was recorded for this walk.
        </p>
      </div>
    );
  }
  return <WalkReplayMap path={path} />;
}
