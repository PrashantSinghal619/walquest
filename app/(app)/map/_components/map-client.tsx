"use client";

// This file exists to hold the dynamic() call with ssr:false (required by
// Next.js 16 - ssr:false is only valid inside a Client Component).
//
// It also owns:
//   • Territory data via TanStack Query (polling + Realtime invalidation)
//   • Walk state shared between TerritoryMap and ActiveWalkControls

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapSkeleton } from "./map-skeleton";
import { ActiveWalkControls } from "./active-walk-controls";
import { createClient } from "@/lib/supabase/client";

const TerritoryMap = dynamic(() => import("./territory-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

async function fetchTerritories(): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch("/api/territories", { cache: "no-store" });
  if (!res.ok) return EMPTY_FC;
  return res.json();
}

export function MapClient() {
  const [walkPoints, setWalkPoints] = useState<Array<[number, number]>>([]);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);

  const queryClient = useQueryClient();

  // Territories with 45-second polling fallback
  const { data: geojson = EMPTY_FC } = useQuery({
    queryKey: ["territories"],
    queryFn: fetchTerritories,
    refetchInterval: 45_000,
  });

  // Realtime: any territory_events INSERT → invalidate territories query
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("territory-events-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "territory_events" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["territories"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleClaimSuccess = useCallback(() => {
    setWalkPoints([]);
    setCurrentPosition(null);
    // Immediately refetch - don't wait for Realtime or the polling interval
    queryClient.invalidateQueries({ queryKey: ["territories"] });
  }, [queryClient]);

  return (
    <div className="relative flex-1 flex w-full">
      <TerritoryMap
        walkPoints={walkPoints}
        currentPosition={currentPosition}
        geojson={geojson}
      />
      <ActiveWalkControls
        onPointsUpdate={setWalkPoints}
        onPositionUpdate={setCurrentPosition}
        onClaimSuccess={handleClaimSuccess}
      />
    </div>
  );
}
