"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { MapSkeleton } from "@/app/(app)/map/_components/map-skeleton";
import { DEMO_LOOP, DEMO_USER, demoTerritories } from "@/lib/demo";

const TerritoryMap = dynamic(() => import("@/app/(app)/map/_components/territory-map"), {
  ssr: false, loading: () => <MapSkeleton />,
});

export function DemoClient() {
  const [stage, setStage] = useState<"ready" | "walking" | "claimed">("ready");
  const [position, setPosition] = useState<[number, number] | null>(null);
  return (
    <main className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">walquest <span className="text-sm font-normal text-muted-foreground">/ public demo</span></span>
        <ThemeToggle />
      </header>
      <section className="shrink-0 border-b px-4 py-3 text-sm" aria-label="About this demo">
        <p>Walk a loop. Claim your ground. Explore Bengaluru with fictional territories.</p>
        <p className="text-muted-foreground">No account or personal details needed. Location is optional: use the map’s location button to find yourself. Your coordinates stay in this page; map tiles load from OpenFreeMap.</p>
      </section>
      <div className="flex min-h-[280px] flex-1 shrink-0">
        <TerritoryMap
          geojson={demoTerritories(stage === "claimed")}
          currentUserId={DEMO_USER}
          walkPoints={stage === "walking" ? DEMO_LOOP : []}
          currentPosition={position}
          onLocateFix={setPosition}
          focusTarget={{ kind: "bounds", bounds: [[77.588, 12.972], [77.600, 12.979]] }}
        />
      </div>
      <section className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t p-4 [&_button]:min-h-11" aria-label="Demo walk controls">
        <div className="text-sm" role="status" aria-live="polite">
          {stage === "ready" && "Try a sample walk — no GPS needed."}
          {stage === "walking" && "Sample loop complete. Claim it to see your territory."}
          {stage === "claimed" && "You claimed 0.11 km²! This simulation is saved only until you reset or leave."}
          <p className="text-xs text-muted-foreground">Demo only. Live accounts, rankings and territory changes are unavailable.</p>
        </div>
        {stage === "ready" && <Button onClick={() => setStage("walking")}>Try a sample walk</Button>}
        {stage === "walking" && <Button onClick={() => setStage("claimed")}>Claim sample territory</Button>}
        {stage !== "ready" && <Button variant="outline" onClick={() => setStage("ready")}>Reset demo</Button>}
      </section>
    </main>
  );
}
