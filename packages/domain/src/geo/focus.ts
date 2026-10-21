import type { FeatureCollection } from "geojson";

export type FocusTarget =
  | { kind: "bounds"; bounds: [[number, number], [number, number]] }
  | { kind: "center"; center: [number, number] };

/**
 * Computes where the map should focus when it first loads: the combined
 * bounding box of the signed-in user's territories and their current GPS
 * fix. Returns null when there is nothing to focus on (no owned
 * territories and no fix) so the caller keeps the city default.
 *
 * All coordinates are [lng, lat] - GeoJSON order.
 */
export function computeFocusTarget(
  geojson: FeatureCollection,
  userId: string | null,
  currentFix: [number, number] | null
): FocusTarget | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let hasAny = false;

  const extend = (lng: number, lat: number) => {
    hasAny = true;
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  };

  if (userId) {
    for (const feature of geojson.features) {
      if (feature.properties?.owner_id !== userId) continue;
      if (feature.geometry.type !== "Polygon") continue;
      for (const ring of feature.geometry.coordinates) {
        for (const pos of ring) extend(pos[0], pos[1]);
      }
    }
  }

  if (currentFix) extend(currentFix[0], currentFix[1]);

  if (!hasAny) return null;

  // A single point (GPS fix only) has a degenerate bbox - centre on it
  if (minLng === maxLng && minLat === maxLat) {
    return { kind: "center", center: [minLng, minLat] };
  }

  return {
    kind: "bounds",
    bounds: [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
  };
}
