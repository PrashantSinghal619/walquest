import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  formatAreaM2,
  formatClaimDate,
  formatDistanceM,
  formatDuration,
} from "@/lib/format";
import type { LngLat } from "@/lib/geo/replay";
import { WalkReplay } from "./_components/walk-replay";

// Dynamic segment: static-prefetch validation has no id to simulate with,
// so provide a runtime sample. The value is arbitrary - validation only
// checks the caching structure, and all data access is inside Suspense.
export const unstable_instant = {
  prefetch: "runtime",
  samples: [{ params: { id: "00000000-0000-0000-0000-000000000000" } }],
};

// params is a dynamic Promise - it is resolved inside the Suspense child so
// the page shell (heading, back link, skeleton) stays a static instant shell.
export default function WalkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Walk replay</h1>
        <Link
          href="/profile"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to profile
        </Link>
      </div>
      <Suspense fallback={<WalkDetailSkeleton />}>
        <WalkDetail params={params} />
      </Suspense>
    </div>
  );
}

async function WalkDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Scoped to the caller - other users' walk ids (or garbage ids) 404
  const { data: walk } = await supabase
    .from("walks")
    .select("id, status, started_at, ended_at, distance_m, path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!walk) notFound();

  const { data: events } = await supabase
    .from("territory_events")
    .select("type, area_delta_m2")
    .eq("walk_id", walk.id)
    .eq("actor_id", user.id);
  const claimed = events?.find((e) => e.type === "claimed");
  const rivalsHit =
    events?.filter((e) => e.type === "clipped" || e.type === "lost").length ?? 0;

  // path is untrusted JSONB - keep only well-formed [lng, lat] pairs
  const path = (Array.isArray(walk.path) ? walk.path : []).filter(
    (p): p is LngLat =>
      Array.isArray(p) && p.length === 2 &&
      typeof p[0] === "number" && typeof p[1] === "number"
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-lg font-medium">{formatClaimDate(walk.started_at)}</p>
        <p className="text-sm text-muted-foreground">
          {walk.status === "completed" && claimed
            ? `Claimed ${formatAreaM2(claimed.area_delta_m2)}${
                rivalsHit > 0
                  ? ` · clipped ${rivalsHit} rival${rivalsHit > 1 ? "s" : ""}`
                  : ""
              }`
            : walk.status === "discarded"
              ? "Discarded - no territory claimed"
              : walk.status === "in_progress"
                ? "Still in progress"
                : "Completed"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Duration" value={formatDuration(walk.started_at, walk.ended_at)} />
        <Stat
          label="Distance"
          value={walk.distance_m != null ? formatDistanceM(walk.distance_m) : "—"}
        />
        <Stat label="GPS points" value={path.length.toString()} />
      </div>

      <WalkReplay path={path} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-lg border bg-card px-4 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function WalkDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-6 w-36 rounded bg-muted" />
        <div className="h-4 w-56 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-lg border bg-card px-4 py-4">
            <div className="h-3 w-14 rounded bg-muted" />
            <div className="h-6 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="h-96 w-full rounded-lg border bg-muted" />
    </div>
  );
}
