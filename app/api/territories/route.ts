import { createClient } from "@/lib/supabase/server";

// Returns all claimed territories as a GeoJSON FeatureCollection.
// Used by TerritoryMap on mount and after each successful claim.
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_territories_geojson");

  if (error) {
    console.error("get_territories_geojson error:", error.message);
    return Response.json({ type: "FeatureCollection", features: [] });
  }

  return Response.json(data ?? { type: "FeatureCollection", features: [] });
}
