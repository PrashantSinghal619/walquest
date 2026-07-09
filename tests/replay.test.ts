import { describe, it, expect } from "vitest";
import { buildReplayTrack, pointAtFraction, type LngLat } from "../lib/geo/replay";

// A straight west-to-east line near Bengaluru's latitude with UNEVEN point
// spacing: 3 points, second segment is 3x the first. Constant-speed replay
// must account for that, not interpolate by index.
const UNEVEN: LngLat[] = [
  [77.59, 12.97],
  [77.6, 12.97], // ~1.08 km
  [77.63, 12.97], // ~3.25 km further
];

describe("buildReplayTrack", () => {
  it("computes cumulative distances in metres", () => {
    const track = buildReplayTrack(UNEVEN);
    expect(track.cumulative[0]).toBe(0);
    // ~1.08 km at lat 12.97 (1 deg lng ~ 108.5 km)
    expect(track.cumulative[1]).toBeGreaterThan(1000);
    expect(track.cumulative[1]).toBeLessThan(1200);
    expect(track.totalM).toBeCloseTo(track.cumulative[1] * 4, -2); // 1x + 3x segments
  });

  it("handles degenerate inputs", () => {
    expect(buildReplayTrack([]).totalM).toBe(0);
    expect(buildReplayTrack([[77.59, 12.97]]).totalM).toBe(0);
    // identical points - zero-length path
    expect(buildReplayTrack([[77.59, 12.97], [77.59, 12.97]]).totalM).toBe(0);
  });
});

describe("pointAtFraction", () => {
  const track = buildReplayTrack(UNEVEN);

  it("returns the start at fraction 0 and the end at fraction 1", () => {
    expect(pointAtFraction(track, 0).point).toEqual([77.59, 12.97]);
    const end = pointAtFraction(track, 1);
    expect(end.point[0]).toBeCloseTo(77.63, 10);
    expect(end.lastIndex).toBe(1);
  });

  it("moves at constant ground speed, not per-index", () => {
    // Half the TOTAL distance (~2.17 km) lands inside the long second
    // segment - per-index interpolation would still be in the first.
    const mid = pointAtFraction(track, 0.5);
    expect(mid.lastIndex).toBe(1);
    expect(mid.point[0]).toBeCloseTo(77.61, 3); // halfway along 77.59->77.63
  });

  it("clamps out-of-range fractions", () => {
    expect(pointAtFraction(track, -0.5).point).toEqual([77.59, 12.97]);
    expect(pointAtFraction(track, 1.5).point[0]).toBeCloseTo(77.63, 10);
  });

  it("is safe on degenerate tracks", () => {
    expect(pointAtFraction(buildReplayTrack([]), 0.5).lastIndex).toBe(-1);
    const single = buildReplayTrack([[77.59, 12.97]]);
    expect(pointAtFraction(single, 0.7).point).toEqual([77.59, 12.97]);
  });
});
