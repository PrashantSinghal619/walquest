"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { lineString, length as turfLength } from "@turf/turf";
import { startWalk, discardWalk, completeWalk } from "@/app/actions/walks";
import { formatAreaM2 } from "@/lib/format";
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

  // Background-suspension handling. Browsers freeze pages when the screen
  // locks or the app is backgrounded - watchPosition stops delivering and
  // the recorded route gets a straight-line gap (there is NO web API for
  // background geolocation; a PWA doesn't change that).
  //   1. Wake lock keeps the screen on during a walk so the page never
  //      suspends in the first place.
  //   2. Gap detection: a long silence between fixes means we missed real
  //      route - warn the walker instead of pretending the line is real.
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastFixTimeRef = useRef<number | null>(null);
  const [gapDetected, setGapDetected] = useState(false);
  const GAP_MS = 30_000;

  async function acquireWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      // Denied/unsupported (e.g. low battery mode) - tracking still works
      // while the user keeps the screen on manually.
    }
  }

  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }

  const isTracking = state.phase === "tracking";

  // Hold the wake lock exactly while tracking; release on claim/discard/
  // error/unmount via the effect cleanup.
  useEffect(() => {
    if (!isTracking) return;
    acquireWakeLock();
    return () => releaseWakeLock();
  }, [isTracking]);

  // The OS force-releases the wake lock when the page IS backgrounded
  // anyway (nothing we can do there) - re-acquire it when the user comes
  // back so the rest of the walk is protected.
  useEffect(() => {
    if (!isTracking) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") acquireWakeLock();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isTracking]);

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
        // A long silence between fixes = the page was suspended (screen
        // locked / app backgrounded) and real route was missed - the path
        // will contain a straight-line jump. Surface that honestly.
        if (
          lastFixTimeRef.current !== null &&
          pos.timestamp - lastFixTimeRef.current > GAP_MS
        ) {
          setGapDetected(true);
        }
        lastFixTimeRef.current = pos.timestamp;

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
    setGapDetected(false);
    lastFixTimeRef.current = null;

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
    // can keep walking, claim again, or discard. Reset the fix clock so the
    // known pause (error state, claim attempt) isn't flagged as a gap.
    lastFixTimeRef.current = null;
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
    setGapDetected(false);
    lastFixTimeRef.current = null;
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
            {gapDetected && (
              <p className="max-w-60 text-center text-xs text-amber-600 dark:text-amber-500">
                Your phone dozed off mid-walk - part of this route is a
                straight-line guess. Keep the screen on while walking!
              </p>
            )}
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
                {formatAreaM2(state.areaM2)}
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
