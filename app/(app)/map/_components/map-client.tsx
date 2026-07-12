"use client";

// This file exists to hold the dynamic() call with ssr:false (required by
// Next.js 16 - ssr:false is only valid inside a Client Component).
//
// It also owns:
//   • Territory data via TanStack Query (polling + Realtime invalidation)
//   • Walk state shared between TerritoryMap and ActiveWalkControls

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { MapSkeleton } from "./map-skeleton";
import { ActiveWalkControls } from "./active-walk-controls";
import { createClient } from "@/lib/supabase/client";
import { computeFocusTarget, type FocusTarget } from "@/lib/geo/focus";

const TerritoryMap = dynamic(() => import("./territory-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

async function fetchTerritories(): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch("/api/territories", { cache: "no-store" });
  if (!res.ok) throw new Error(`territories fetch failed: ${res.status}`);
  return res.json();
}

export function MapClient() {
  const [walkPoints, setWalkPoints] = useState<Array<[number, number]>>([]);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);

  const queryClient = useQueryClient();

  // Territories with 45-second polling fallback
  const { data: geojson = EMPTY_FC, isSuccess: territoriesLoaded } = useQuery({
    queryKey: ["territories"],
    queryFn: fetchTerritories,
    refetchInterval: 45_000,
    placeholderData: keepPreviousData,
  });

  // ── Initial focus: my territories + my current location ────────────────────
  // Three inputs race on load: the session (who am I), the territories fetch,
  // and a GPS fix. GPS is the slow one, so it gets a hard 2.5 s timeout - the
  // map must settle on its target within ~3 s even when GPS is denied or slow.

  // Register the service worker on map load - it owns the offline tile
  // cache (and push display, though subscribing happens on the profile).
  // Registration is idempotent; failures just mean no offline tiles.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Who is signed in (read from the local session - no network round-trip)
  const [auth, setAuth] = useState<{ userId: string | null } | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(({ data }) => setAuth({ userId: data.session?.user.id ?? null }));
  }, []);

  // GPS fix on load. Two separate concerns with different deadlines:
  //   - the CAMERA FOCUS decision must settle fast (own 2.5 s timer below),
  //     with or without a fix - the map cannot wait on slow GPS
  //   - the GPS DOT has no deadline: a watch keeps trying until the first
  //     fix lands (cold GPS or a slow permission prompt regularly take
  //     >2.5 s), then unsubscribes. A one-shot bounded attempt here used
  //     to leave the dot missing for the whole session when GPS was slow.
  const [initialFix, setInitialFix] = useState<[number, number] | null>(null);
  const [gpsSettled, setGpsSettled] = useState(false);
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGpsSettled(true);
      return;
    }

    // Focus budget: proceed without a fix after 2.5 s. Deliberately our own
    // timer - on iOS Safari/Firefox the geolocation `timeout` clock also
    // runs while the permission prompt is open, so it can't be trusted to
    // mean "no fix available".
    const focusDeadline = setTimeout(() => setGpsSettled(true), 2500);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setInitialFix(fix);
        setCurrentPosition(fix); // show the GPS dot whenever the fix arrives
        setGpsSettled(true);
        clearTimeout(focusDeadline);
        // First fix is all we need while idle - walks run their own watch
        navigator.geolocation.clearWatch(watchId);
      },
      (err) => {
        // Denied is final - stop waiting. TIMEOUT / POSITION_UNAVAILABLE
        // are transient: the watch stays alive and may still deliver.
        if (err.code === 1) {
          setGpsSettled(true);
          clearTimeout(focusDeadline);
          navigator.geolocation.clearWatch(watchId);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 }
    );

    return () => {
      clearTimeout(focusDeadline);
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Once all three inputs settle, compute the focus exactly once. Later
  // refetches and walk updates must not yank the camera around.
  const didFocusRef = useRef(false);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  useEffect(() => {
    if (didFocusRef.current || !gpsSettled || !territoriesLoaded || auth === null) return;
    didFocusRef.current = true;
    setFocusTarget(computeFocusTarget(geojson, auth.userId, initialFix));
  }, [gpsSettled, territoriesLoaded, auth, geojson, initialFix]);

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
        focusTarget={focusTarget}
        currentUserId={auth?.userId ?? null}
        onLocateFix={setCurrentPosition}
      />
      <ActiveWalkControls
        onPointsUpdate={setWalkPoints}
        onPositionUpdate={setCurrentPosition}
        onClaimSuccess={handleClaimSuccess}
      />
    </div>
  );
}
