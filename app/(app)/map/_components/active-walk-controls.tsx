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
  | {
      phase: "success";
      areaM2: number;
      clippedCount: number;
      lostCount: number;
      mergedCount: number;
    }
  // walkId is kept on errors so the walk can be resumed or explicitly
  // discarded - otherwise the row is orphaned as 'in_progress' forever.
  | { phase: "error"; message: string; walkId: string | null };

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

  function toError(message: string) {
    // Preserve the walkId from whatever phase we were in so the user can
    // resume or discard - never silently orphan an in_progress walk.
    setState((prev) => ({
      phase: "error",
      message,
      walkId:
        prev.phase === "tracking" || prev.phase === "claiming"
          ? prev.walkId
          : prev.phase === "error"
            ? prev.walkId
            : null,
    }));
  }

  function startGps() {
    if (!("geolocation" in navigator)) {
      toError("No GPS here! Pull this up on your phone to start tracking your walk.");
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
        const gpsMessages: Record<number, string> = {
          1: "We can't see you! Allow location access in your settings, then give it another go.",
          2: "Satellites lost you! Head somewhere open - away from walls and under the sky.",
          3: "Satellites are being shy. Step outside somewhere open and try again.",
        };
        toError(gpsMessages[err.code] ?? "GPS went quiet on us. Give it a moment and try again.");
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
      setState({ phase: "error", message: result.error, walkId: null });
      return;
    }

    setState({ phase: "tracking", walkId: result.walkId });
    startGps();
  }

  function handleResume(walkId: string) {
    // Back to tracking with the same walk and accumulated points - the user
    // can keep walking, claim again, or discard.
    setState({ phase: "tracking", walkId });
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
        setState({ phase: "error", message: result.error, walkId });
        return;
      }

      setState({
        phase: "success",
        areaM2: result.areaM2,
        clippedCount: result.clippedCount,
        lostCount: result.lostCount,
        mergedCount: result.mergedCount,
      });
      onClaimSuccess();

      // Reset to idle after 3 s
      setTimeout(() => {
        setState({ phase: "idle" });
        setPoints([]);
        onPositionUpdate(null);
      }, 3000);
    });
  }

  async function handleDiscard(walkId: string) {
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
          <p className="text-sm text-muted-foreground">Locking you in…</p>
        )}

        {state.phase === "tracking" && (
          <>
            <p className="text-xs text-muted-foreground tabular-nums">
              {points.length} points · {distanceKm.toFixed(2)} km
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
                onClick={() => handleDiscard(state.walkId)}
                aria-label="Discard walk"
              >
                ✕
              </Button>
            </div>
          </>
        )}

        {(state.phase === "claiming" || isPending) && (
          <p className="text-sm text-muted-foreground">Planting your flag…</p>
        )}

        {state.phase === "success" && (
          <div className="flex flex-col items-center gap-0.5">
            <p className="text-sm font-medium text-foreground">
              ✓ Territory claimed!{" "}
              <span className="text-muted-foreground font-normal">
                {(state.areaM2 / 1_000_000).toFixed(4)} km²
              </span>
            </p>
            {(state.clippedCount > 0 || state.lostCount > 0 || state.mergedCount > 0) && (
              <p className="text-xs text-muted-foreground">
                {[
                  state.clippedCount > 0 && `clipped ${state.clippedCount}`,
                  state.lostCount > 0 && `erased ${state.lostCount}`,
                  state.mergedCount > 0 && `merged ${state.mergedCount} of yours`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        )}

        {state.phase === "error" && (
          <>
            <p className="text-sm text-destructive text-center">{state.message}</p>
            {state.walkId ? (
              // The walk still exists server-side - let the user carry on or
              // explicitly discard, never silently orphan it.
              <div className="flex gap-2 w-full">
                <Button onClick={() => handleResume(state.walkId!)} className="flex-1">
                  Keep Walking
                </Button>
                <Button variant="outline" onClick={() => handleDiscard(state.walkId!)}>
                  Discard
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setState({ phase: "idle" })} className="w-full">
                Try Again
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
