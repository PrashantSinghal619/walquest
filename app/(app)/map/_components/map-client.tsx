"use client";

// This file exists solely to hold the dynamic() call with ssr:false.
// Per Next.js 16 docs, ssr:false is only valid inside a Client Component —
// using it in a Server Component throws a build error.
// The map/page.tsx Server Component imports <MapClient /> which loads
// TerritoryMap lazily on the client only, keeping MapLibre (~400KB) out
// of every other route's bundle.

import dynamic from "next/dynamic";
import { MapSkeleton } from "./map-skeleton";

const TerritoryMap = dynamic(() => import("./territory-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export function MapClient() {
  return <TerritoryMap />;
}
