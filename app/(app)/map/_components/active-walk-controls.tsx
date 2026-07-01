"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { lineString, length as turfLength } from "@turf/turf";
import { startWalk, discardWalk, completeWalk } from "@/app/actions/walks";
import { Button } from "@/components/ui/button";

interface ActiveWalkControlsProps {
  onPointsUpdate: (points: Array<[number, number]>) => void;
  onPositionUpdate: (position: [number, number] | null) => void;
  onClaimSuccess: () => void;
}

type WalkState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "tracking"; walkId: string }
  | { phase: "claiming"; walkId: string }
  | { phase: "success"; areaM2: number }
  | { phase: "error"; message: string };

export function ActiveWalkControls({
  onPointsUpdate,
  onPositionUpdate,
  onClaimSuccess,
}: ActiveWalkControlsProps) {
  const [state, setState] = useState<WalkState>({ phase: "idle" });
  const [points, setPoints] = useState<Array<[number, number]>>([]);
  const watchIdRef = useRef<number | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sync points up to parent (for map path rendering) whenever they change
  useEffect(() => {
    onPointsUpdate(points);
  }, [points, onPointsUpdate]);

  // Stop GPS watch on unmount
  useEffect(() => {
    return () => stopGps();
  }, []);

  function stopGps() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  function startGps() {
    if (!("geolocation" in navigator)) {
      setState({ phase: "error", message: "GPS not available on this device." });
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        // Geolocation API: latitude, longitude → convert to GeoJSON: [lng, lat]
        const point: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setPoints((prev) => [...prev, point]);
        onPositionUpdate(point);
      },
      (err) => {
        setState({ phase: "error", message: `GPS error: ${err.message}` });
        stopGps();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function handleStart() {
    setState({ phase: "starting" });
    setPoints([]);
    onPointsUpdate([]);

    const result = await startWalk();
    if (!result.ok) {
      setState({ phase: "error", message: result.error });
      return;
    }

    setState({ phase: "tracking", walkId: result.walkId });
    startGps();
  }

  async function handleClaim() {
    if (state.phase !== "tracking") return;
    const { walkId } = state;
    setState({ phase: "claiming", walkId });
    stopGps();

    startTransition(async () => {
      const result = await completeWalk(walkId, points);
      if (!result.ok) {
        setState({ phase: "error", message: result.error });
        return;
      }

      setState({ phase: "success", areaM2: result.areaM2 });
      onClaimSuccess();

      // Reset to idle after 3 s
      setTimeout(() => {
        setState({ phase: "idle" });
        setPoints([]);
        onPositionUpdate(null);
      }, 3000);
    });
  }

  async function handleDiscard() {
    if (state.phase !== "tracking") return;
    const { walkId } = state;
    stopGps();
    setPoints([]);
    onPointsUpdate([]);
    onPositionUpdate(null);
    setState({ phase: "idle" });
    await discardWalk(walkId);
  }

  const distanceKm =
    points.length >= 2
      ? turfLength(lineString(points), { units: "kilometers" })
      : 0;

  return (
    // Floating HUD at the bottom-centre of the map
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
      <div className="rounded-xl border border-border/60 bg-background/90 backdrop-blur-sm px-5 py-3 shadow-lg flex flex-col items-center gap-2 min-w-56">
        {state.phase === "idle" && (
          <Button onClick={handleStart} className="w-full">
            Start Walk
          </Button>
        )}

        {state.phase === "starting" && (
          <p className="text-sm text-muted-foreground">Starting…</p>
        )}

        {state.phase === "tracking" && (
          <>
            <p className="text-xs text-muted-foreground tabular-nums">
              {points.length} pts · {distanceKm.toFixed(2)} km
            </p>
            <div className="flex gap-2 w-full">
              <Button
                onClick={handleClaim}
                className="flex-1"
                disabled={points.length < 3}
              >
                Claim Territory
              </Button>
              <Button
                variant="outline"
                onClick={handleDiscard}
                aria-label="Discard walk"
              >
                ✕
              </Button>
            </div>
          </>
        )}

        {(state.phase === "claiming" || isPending) && (
          <p className="text-sm text-muted-foreground">Claiming…</p>
        )}

        {state.phase === "success" && (
          <p className="text-sm font-medium text-foreground">
            ✓ Territory claimed!{" "}
            <span className="text-muted-foreground font-normal">
              {(state.areaM2 / 1_000_000).toFixed(4)} km²
            </span>
          </p>
        )}

        {state.phase === "error" && (
          <>
            <p className="text-sm text-destructive text-center">{state.message}</p>
            <Button variant="outline" onClick={() => setState({ phase: "idle" })} className="w-full">
              Try Again
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
