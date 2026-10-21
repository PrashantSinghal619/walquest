/**
 * Pure geometry for animating a recorded walk. A track precomputes
 * cumulative distances so the animation can map a time fraction (0..1)
 * to a point that moves at constant ground speed along the path -
 * interpolating by raw point index would speed up through sparse GPS
 * segments and crawl through dense ones.
 *
 * Coordinates are [lng, lat] - GeoJSON order.
 */

export type LngLat = [number, number];

export type ReplayTrack = {
  points: LngLat[];
  /** cumulative[i] = metres walked from the start to points[i] */
  cumulative: number[];
  totalM: number;
};

// Haversine - good to well under a metre at walk scale
function segmentMeters(a: LngLat, b: LngLat): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function buildReplayTrack(points: LngLat[]): ReplayTrack {
  const cumulative: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) total += segmentMeters(points[i - 1], points[i]);
    cumulative.push(total);
  }
  return { points, cumulative, totalM: total };
}

export type ReplayPosition = {
  /** interpolated marker position */
  point: LngLat;
  /** index of the last original point fully passed (for the progress line) */
  lastIndex: number;
};

export function pointAtFraction(track: ReplayTrack, fraction: number): ReplayPosition {
  const { points, cumulative, totalM } = track;
  if (points.length === 0) return { point: [0, 0], lastIndex: -1 };
  if (points.length === 1 || totalM === 0) return { point: points[0], lastIndex: 0 };

  const clamped = Math.min(1, Math.max(0, fraction));
  const target = clamped * totalM;

  // First point at or beyond the target distance
  let i = 1;
  while (i < points.length - 1 && cumulative[i] < target) i++;

  const segStart = cumulative[i - 1];
  const segLen = cumulative[i] - segStart;
  const t = segLen === 0 ? 0 : (target - segStart) / segLen;

  const a = points[i - 1];
  const b = points[i];
  return {
    point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    lastIndex: i - 1,
  };
}
