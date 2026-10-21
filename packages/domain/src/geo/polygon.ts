import { lineString, polygon, area as turfArea, simplify, kinks } from "@turf/turf";
import type { Feature, Polygon } from "geojson";

// Minimum territory size - roughly a 25m × 25m square around Bengaluru's latitude
const MIN_AREA_M2 = 500;

export type PolygonResult =
  | { ok: true; polygon: Feature<Polygon>; areaM2: number }
  | { ok: false; error: string };

/**
 * Takes a GPS trace as [lng, lat] pairs, simplifies, closes, validates, and
 * returns a GeoJSON Polygon or a user-friendly error.
 *
 * Coordinate order throughout: [longitude, latitude] - GeoJSON/MapLibre/Turf
 * convention, NOT the Geolocation API order.
 */
export function buildPolygon(points: Array<[number, number]>): PolygonResult {
  // Server Action boundary: points arrive as untrusted client JSON. Reject
  // anything that isn't a finite [lng, lat] pair before it reaches turf,
  // which throws opaque errors on malformed input.
  const isValidPoint = (p: unknown): p is [number, number] =>
    Array.isArray(p) &&
    p.length === 2 &&
    typeof p[0] === "number" &&
    typeof p[1] === "number" &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    p[0] >= -180 &&
    p[0] <= 180 &&
    p[1] >= -90 &&
    p[1] <= 90;

  if (!Array.isArray(points) || !points.every(isValidPoint)) {
    return { ok: false, error: "Those coordinates look scrambled - try recording your walk again." };
  }

  if (points.length < 3) {
    return { ok: false, error: "Not so fast! Walk around a bit more before you can stake your claim." };
  }

  // Drop consecutive duplicate points from GPS jitter
  const deduped = points.filter(
    (p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]
  );

  if (deduped.length < 3) {
    return { ok: false, error: "Did you even leave the house? Walk a wider path and try again!" };
  }

  // Simplify: tolerance ~5.5 m at Bengaluru latitude (≈ 12.97° N)
  const line = lineString(deduped);
  const simplified = simplify(line, { tolerance: 0.00005, highQuality: true });
  const coords = simplified.geometry.coordinates as Array<[number, number]>;

  if (coords.length < 3) {
    return { ok: false, error: "Come on mate! You barely stepped outside - go walk a bigger loop to claim territory." };
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
    return { ok: false, error: "We couldn't quite make a shape out of that one - try a rounder, more connected loop." };
  }

  // Reject self-intersecting paths (figure-8 loops etc.)
  if (kinks(poly).features.length > 0) {
    return { ok: false, error: "You crossed your own path! Walk a clean loop - no cutting back across yourself." };
  }

  const areaM2 = turfArea(poly);
  if (areaM2 < MIN_AREA_M2) {
    return {
      ok: false,
      error: "That's barely a doorstep, mate! Walk a proper block-sized loop to claim real ground.",
    };
  }

  return { ok: true, polygon: poly, areaM2 };
}
