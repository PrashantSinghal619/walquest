"use server";

import { revalidatePath, updateTag } from "next/cache";
import { lineString, length as turfLength } from "@turf/turf";
import { createClient } from "@/lib/supabase/server";
import { buildPolygon } from "@/lib/geo/polygon";
import { notifyTerritoryLoss } from "@/lib/push";

export type StartWalkResult =
  | { ok: true; walkId: string }
  | { ok: false; error: string };

export type CompleteWalkResult =
  | {
      ok: true;
      territoryId: string;
      areaM2: number;
      clippedCount: number;
      lostCount: number;
      mergedCount: number;
    }
  | { ok: false; error: string };

export async function startWalk(): Promise<StartWalkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated." };

  // Upsert the user row (the trigger handles new sign-ups, but existing users
  // who signed up before the trigger was added need this path).
  await supabase
    .from("users")
    .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  const { data, error } = await supabase
    .from("walks")
    .insert({ user_id: user.id, status: "in_progress" })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "Failed to start walk." };
  return { ok: true, walkId: data.id };
}

export async function discardWalk(walkId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  await supabase
    .from("walks")
    .update({ status: "discarded", ended_at: new Date().toISOString() })
    .eq("id", walkId)
    .eq("user_id", user.id);

  return { ok: true };
}

/**
 * Closes and validates the GPS trace, inserts a territory via PostGIS, and
 * marks the walk completed.
 *
 * points: array of [longitude, latitude] - GeoJSON order, NOT Geolocation API
 * order. The client must convert before calling.
 */
export async function completeWalk(
  walkId: string,
  points: Array<[number, number]>
): Promise<CompleteWalkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // Ownership check - never trust the client for authz
  const { data: walk } = await supabase
    .from("walks")
    .select("id, status")
    .eq("id", walkId)
    .eq("user_id", user.id)
    .single();

  if (!walk || walk.status !== "in_progress") {
    return { ok: false, error: "Walk not found or already finished." };
  }

  // Server-side polygon building and validation (turf runs on the server here)
  const result = buildPolygon(points);
  if (!result.ok) return { ok: false, error: result.error };

  const { polygon, areaM2 } = result;

  // Atomic conflict resolution + insert via PostGIS RPC.
  // claim_territory handles ST_Intersects + ST_Difference + territory_events
  // in a single transaction so no partial state is possible.
  const { data: claimResult, error: claimError } = await supabase.rpc(
    "claim_territory",
    {
      p_owner_id: user.id,
      p_walk_id: walkId,
      p_geom_json: JSON.stringify(polygon.geometry),
      p_area_m2: areaM2,
    }
  );

  if (claimError || !claimResult) {
    return { ok: false, error: "Failed to save territory. Try again." };
  }

  const {
    territory_id: territoryId,
    clipped_count: clippedCount,
    lost_count: lostCount,
    merged_count: mergedCount = 0,
    area_m2: serverAreaM2,
  } = claimResult as {
    territory_id: string;
    clipped_count: number;
    lost_count: number;
    merged_count?: number;
    area_m2?: number;
  };

  // Walked distance along the recorded trace (raw points, not the
  // simplified polygon) - feeds the profile stats and walk history
  const distanceM =
    points.length >= 2
      ? turfLength(lineString(points), { units: "kilometers" }) * 1000
      : 0;

  // Persist path + mark complete
  await supabase
    .from("walks")
    .update({
      status: "completed",
      ended_at: new Date().toISOString(),
      path: points,
      distance_m: distanceM,
    })
    .eq("id", walkId);

  revalidatePath("/map");
  updateTag("leaderboard");

  // Push-notify the owners this claim clipped or erased. Per-owner losses
  // come from the events the RPC just wrote. Never let notification
  // problems fail a successful claim.
  if (clippedCount + lostCount > 0) {
    try {
      const { data: lossEvents } = await supabase
        .from("territory_events")
        .select("affected_owner_id, area_delta_m2")
        .eq("walk_id", walkId)
        .in("type", ["clipped", "lost"]);

      const actorName = user.email?.split("@")[0] ?? "A rival walker";
      await notifyTerritoryLoss(
        actorName,
        (lossEvents ?? [])
          .filter((e) => e.affected_owner_id)
          .map((e) => ({
            ownerId: e.affected_owner_id as string,
            areaLostM2: Math.abs(e.area_delta_m2 ?? 0),
          }))
      );
    } catch (err) {
      console.error("territory-loss notification failed:", err);
    }
  }

  // Prefer the server-computed area: after a self-overlap merge the RPC's
  // number is the true territory size, not the raw walked loop's.
  return {
    ok: true,
    territoryId,
    areaM2: serverAreaM2 ?? areaM2,
    clippedCount,
    lostCount,
    mergedCount,
  };
}
