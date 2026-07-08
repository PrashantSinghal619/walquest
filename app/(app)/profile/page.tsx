import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
      .select("distance_m")
      .eq("user_id", user.id)
      .eq("status", "completed"),
  ]);

  const territories = territoriesResult.data ?? [];
  const walks = walksResult.data ?? [];

  const totalAreaM2 = territories.reduce((sum, t) => sum + t.area_m2, 0);
  const totalDistanceM = walks.reduce((sum, w) => sum + (w.distance_m ?? 0), 0);
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
        <StatCard
          label="Area claimed"
          value={
            totalAreaM2 >= 1_000_000
              ? `${(totalAreaM2 / 1_000_000).toFixed(2)} km²`
              : `${Math.round(totalAreaM2).toLocaleString()} m²`
          }
        />
        <StatCard label="Walks" value={walks.length.toString()} />
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
                  <span className="font-medium">
                    {t.area_m2 >= 1_000_000
                      ? `${(t.area_m2 / 1_000_000).toFixed(2)} km²`
                      : `${Math.round(t.area_m2).toLocaleString()} m²`}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(t.claimed_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
