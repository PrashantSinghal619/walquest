"use client";

// This file exists to hold the dynamic() call with ssr:false (required by
// Next.js 16 — ssr:false is only valid inside a Client Component).
//
// It also owns the walk state that must flow between two sibling components:
//   • TerritoryMap  — renders GPS path + territory polygons on MapLibre
//   • ActiveWalkControls — GPS watching + Server Action calls
// Lifting state here keeps both components pure (no shared store needed).

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import { MapSkeleton } from "./map-skeleton";
import { ActiveWalkControls } from "./active-walk-controls";

const TerritoryMap = dynamic(() => import("./territory-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export function MapClient() {
  const [walkPoints, setWalkPoints] = useState<Array<[number, number]>>([]);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  // Incrementing this tells TerritoryMap to re-fetch /api/territories
  const [territoriesVersion, setTerritoriesVersion] = useState(0);

  const handleClaimSuccess = useCallback(() => {
    setWalkPoints([]);
    setCurrentPosition(null);
    setTerritoriesVersion((v) => v + 1);
  }, []);

  return (
    <div className="relative flex-1 flex w-full">
      <TerritoryMap
        walkPoints={walkPoints}
        currentPosition={currentPosition}
        territoriesVersion={territoriesVersion}
      />
      <ActiveWalkControls
        onPointsUpdate={setWalkPoints}
        onPositionUpdate={setCurrentPosition}
        onClaimSuccess={handleClaimSuccess}
      />
    </div>
  );
}
