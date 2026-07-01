import { lineString, polygon, area as turfArea, simplify, kinks } from "@turf/turf";
import type { Feature, Polygon } from "geojson";

// Minimum territory size — roughly a 25m × 25m square around Bengaluru's latitude
const MIN_AREA_M2 = 500;

export type PolygonResult =
  | { ok: true; polygon: Feature<Polygon>; areaM2: number }
  | { ok: false; error: string };

/**
 * Takes a GPS trace as [lng, lat] pairs, simplifies, closes, validates, and
 * returns a GeoJSON Polygon or a user-friendly error.
 *
 * Coordinate order throughout: [longitude, latitude] — GeoJSON/MapLibre/Turf
 * convention, NOT the Geolocation API order.
 */
export function buildPolygon(points: Array<[number, number]>): PolygonResult {
  if (points.length < 3) {
    return { ok: false, error: "Need at least 3 GPS points to form a territory." };
  }

  // Drop consecutive duplicate points from GPS jitter
  const deduped = points.filter(
    (p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]
  );

  if (deduped.length < 3) {
    return { ok: false, error: "GPS points are too close together — walk further first." };
  }

  // Simplify: tolerance ~5.5 m at Bengaluru latitude (≈ 12.97° N)
  const line = lineString(deduped);
  const simplified = simplify(line, { tolerance: 0.00005, highQuality: true });
  const coords = simplified.geometry.coordinates as Array<[number, number]>;

  if (coords.length < 3) {
    return { ok: false, error: "Path simplified to fewer than 3 unique points." };
  }

  // Close the ring so first point === last point
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push(first);
  }

  let poly: Feature<Polygon>;
  try {
    poly = polygon([coords]);
  } catch {
    return { ok: false, error: "Could not form a valid polygon from your path." };
  }

  // Reject self-intersecting paths (figure-8 loops etc.)
  if (kinks(poly).features.length > 0) {
    return { ok: false, error: "Your path crosses itself — try a simpler loop." };
  }

  const areaM2 = turfArea(poly);
  if (areaM2 < MIN_AREA_M2) {
    return {
      ok: false,
      error: `Territory too small (${Math.round(areaM2)} m²) — walk a bigger loop.`,
    };
  }

  return { ok: true, polygon: poly, areaM2 };
}
