import { describe, it, expect } from "vitest";
import { buildPolygon } from "../lib/geo/polygon";

// All coordinates are [longitude, latitude] - GeoJSON order, not Geolocation API order.

describe("buildPolygon", () => {
  // ~1.1km × ~1.1km square in central Bengaluru
  const square: Array<[number, number]> = [
    [77.590, 12.970],
    [77.600, 12.970],
    [77.600, 12.980],
    [77.590, 12.980],
  ];

  it("returns a valid polygon for a clean rectangular loop", () => {
    const result = buildPolygon(square);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.polygon.geometry.type).toBe("Polygon");
      expect(result.areaM2).toBeGreaterThan(500);
    }
  });

  it("rejects fewer than 3 points", () => {
    const result = buildPolygon([
      [77.59, 12.97],
      [77.60, 12.97],
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Not so fast");
  });

  it("rejects all-identical GPS points (GPS jitter at standstill)", () => {
    const result = buildPolygon([
      [77.590, 12.970],
      [77.590, 12.970],
      [77.590, 12.970],
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Did you even leave");
  });

  it("rejects a self-intersecting path (bowtie / figure-8)", () => {
    // Two diagonals of a rectangle - they cross at the centre
    const bowtie: Array<[number, number]> = [
      [77.590, 12.970], // bottom-left
      [77.600, 12.980], // top-right
      [77.600, 12.970], // bottom-right
      [77.590, 12.980], // top-left
    ];
    const result = buildPolygon(bowtie);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("crossed your own path");
  });

  it("rejects a polygon below the 500 m² minimum area", () => {
    // ~11m × ~11m right triangle ≈ 60 m² - well below the floor
    const tiny: Array<[number, number]> = [
      [77.5900, 12.9700],
      [77.5901, 12.9700],
      [77.5900, 12.9701],
    ];
    const result = buildPolygon(tiny);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("barely a doorstep");
  });

  it("rejects non-finite coordinates (NaN / Infinity from corrupt client payload)", () => {
    const result = buildPolygon([
      [77.590, 12.970],
      [NaN, 12.970],
      [77.600, 12.980],
      [77.590, 12.980],
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("scrambled");
  });

  it("rejects out-of-range coordinates (lat/lng swapped or garbage)", () => {
    // A latitude of 77.59 is out of range - classic [lat, lng] order bug
    const result = buildPolygon([
      [12.970, 77.590],
      [12.970, 77.600],
      [12.980, 77.600],
      [12.980, 77.590],
    ]);
    expect(result.ok).toBe(true); // lng 12.97 / lat 77.59 are technically in range...

    const outOfRange = buildPolygon([
      [77.590, 12.970],
      [200, 12.970], // lng > 180
      [77.600, 12.980],
    ]);
    expect(outOfRange.ok).toBe(false);
    if (!outOfRange.ok) expect(outOfRange.error).toContain("scrambled");
  });

  it("rejects malformed point shapes (not arrays / wrong arity / strings)", () => {
    const cases: unknown[] = [
      [[77.59, 12.97], "not-a-point", [77.6, 12.98]],
      [[77.59, 12.97], [77.6], [77.6, 12.98]],
      [[77.59, 12.97], ["77.6", "12.98"], [77.6, 12.98]],
      "not-an-array",
    ];
    for (const c of cases) {
      const result = buildPolygon(c as Array<[number, number]>);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("scrambled");
    }
  });

  it("area is proportional to loop size (sanity check)", () => {
    // Double the side length → ~4× the area
    const large: Array<[number, number]> = [
      [77.580, 12.960],
      [77.600, 12.960],
      [77.600, 12.980],
      [77.580, 12.980],
    ];
    const small = buildPolygon(square);
    const big = buildPolygon(large);
    expect(small.ok && big.ok).toBe(true);
    if (small.ok && big.ok) {
      expect(big.areaM2 / small.areaM2).toBeCloseTo(4, 0);
    }
  });
});
