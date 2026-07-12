import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  formatAreaM2,
  formatClaimDate,
  formatDistanceM,
  formatDuration,
} from "@/lib/format";
import { PushToggle } from "@/components/push-toggle";

export const unstable_instant = { prefetch: "static" };

export default function ProfilePage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your Profile</h1>
        <p className="text-sm text-muted-foreground">
          Stats, territories, and your place in Bengaluru.
        </p>
      </div>
      {/* Client-only, no server data - lives outside the Suspense content */}
      <PushToggle />
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

async function ProfileContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [territoriesResult, walksResult] = await Promise.all([
    supabase
      .from("territories")
      .select("id, area_m2, claimed_at")
      .eq("owner_id", user.id)
      .order("claimed_at", { ascending: false }),
    supabase
      .from("walks")
      .select("id, status, started_at, ended_at, distance_m")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false }),
  ]);

  const territories = territoriesResult.data ?? [];
  const allWalks = walksResult.data ?? [];
  const completedWalks = allWalks.filter((w) => w.status === "completed");
  const recentWalks = allWalks.slice(0, 10);

  // Outcomes for the history list: what each walk's claim did
  const { data: eventsData } = recentWalks.length
    ? await supabase
        .from("territory_events")
        .select("walk_id, type, area_delta_m2")
        .in("walk_id", recentWalks.map((w) => w.id))
        .eq("actor_id", user.id)
    : { data: [] };
  const eventsByWalk = new Map<string, Array<{ type: string; area_delta_m2: number }>>();
  for (const e of eventsData ?? []) {
    if (!e.walk_id) continue;
    const list = eventsByWalk.get(e.walk_id) ?? [];
    list.push(e);
    eventsByWalk.set(e.walk_id, list);
  }

  const totalAreaM2 = territories.reduce((sum, t) => sum + t.area_m2, 0);
  const totalDistanceM = completedWalks.reduce((sum, w) => sum + (w.distance_m ?? 0), 0);
  const displayName = user.email?.split("@")[0] ?? "Walker";

  return (
    <div className="space-y-8">
      {/* Identity */}
      <div>
        <p className="text-xl font-medium">{displayName}</p>
        <p className="text-sm text-muted-foreground">
          Walking since{" "}
          {new Date(user.created_at).toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Territories"
          value={territories.length.toString()}
        />
        <StatCard label="Area claimed" value={formatAreaM2(totalAreaM2)} />
        <StatCard label="Walks" value={completedWalks.length.toString()} />
        <StatCard
          label="Distance"
          value={
            totalDistanceM >= 1000
              ? `${(totalDistanceM / 1000).toFixed(1)} km`
              : `${Math.round(totalDistanceM)} m`
          }
        />
      </div>

      {/* Territory list */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Your territories
        </h2>
        {territories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No territories yet - get out there and start walking!
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {territories.map((t, i) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="text-muted-foreground">
                  Territory {i + 1}
                </span>
                <div className="flex items-center gap-4 text-right">
                  <span className="font-medium">{formatAreaM2(t.area_m2)}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatClaimDate(t.claimed_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Walk history */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Recent walks
        </h2>
        {recentWalks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No walks yet - your history starts with your first loop!
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {recentWalks.map((w) => (
              <Link
                key={w.id}
                href={`/profile/walks/${w.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0">
                  <p className="font-medium">{formatClaimDate(w.started_at)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(w.started_at, w.ended_at)}
                    {w.distance_m != null && ` · ${formatDistanceM(w.distance_m)}`}
                  </p>
                </div>
                <WalkOutcome
                  status={w.status}
                  events={eventsByWalk.get(w.id) ?? []}
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WalkOutcome({
  status,
  events,
}: {
  status: string;
  events: Array<{ type: string; area_delta_m2: number }>;
}) {
  if (status === "discarded") {
    return <span className="text-xs text-muted-foreground shrink-0">discarded</span>;
  }
  if (status === "in_progress") {
    return <span className="text-xs text-amber-600 dark:text-amber-500 shrink-0">in progress</span>;
  }

  const claimed = events.find((e) => e.type === "claimed");
  const rivalsHit = events.filter((e) => e.type === "clipped" || e.type === "lost").length;

  return (
    <div className="text-right shrink-0">
      <p className="text-xs font-medium">
        {claimed ? `claimed ${formatAreaM2(claimed.area_delta_m2)}` : "completed"}
      </p>
      {rivalsHit > 0 && (
        <p className="text-xs text-muted-foreground">
          clipped {rivalsHit} rival{rivalsHit > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-5 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-6 w-32 rounded bg-muted" />
        <div className="h-4 w-48 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card px-4 py-5 space-y-2">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-7 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="rounded-lg border divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between px-4 py-3">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-4 w-24 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
