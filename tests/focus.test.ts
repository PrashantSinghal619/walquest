import { describe, it, expect } from "vitest";
import { computeFocusTarget } from "../lib/geo/focus";
import type { FeatureCollection } from "geojson";

const ME = "dc0c1c86-1711-4b0f-a801-7746fb0a97f9";
const RIVAL = "99999999-9999-9999-9999-999999999999";

function territory(ownerId: string, ring: Array<[number, number]>): GeoJSON.Feature {
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [ring] },
    properties: { owner_id: ownerId, area_m2: 1000 },
  };
}

function fc(...features: GeoJSON.Feature[]): FeatureCollection {
  return { type: "FeatureCollection", features };
}

// My territory: a small square near Marathahalli
const MY_RING: Array<[number, number]> = [
  [77.72, 12.934],
  [77.722, 12.934],
  [77.722, 12.939],
  [77.72, 12.939],
  [77.72, 12.934],
];

// A rival territory across the city - must never influence my focus
const RIVAL_RING: Array<[number, number]> = [
  [77.5, 12.9],
  [77.51, 12.9],
  [77.51, 12.91],
  [77.5, 12.91],
  [77.5, 12.9],
];

describe("computeFocusTarget", () => {
  it("returns bounds covering my territory and my current fix", () => {
    const fix: [number, number] = [77.71, 12.93]; // south-west of the territory
    const result = computeFocusTarget(fc(territory(ME, MY_RING)), ME, fix);
    expect(result).toEqual({
      kind: "bounds",
      bounds: [
        [77.71, 12.93], // fix extends the box south-west
        [77.722, 12.939],
      ],
    });
  });

  it("returns my territory bounds when GPS is unavailable", () => {
    const result = computeFocusTarget(fc(territory(ME, MY_RING)), ME, null);
    expect(result).toEqual({
      kind: "bounds",
      bounds: [
        [77.72, 12.934],
        [77.722, 12.939],
      ],
    });
  });

  it("centres on the GPS fix when I own no territories", () => {
    const result = computeFocusTarget(fc(territory(RIVAL, RIVAL_RING)), ME, [77.6, 12.95]);
    expect(result).toEqual({ kind: "center", center: [77.6, 12.95] });
  });

  it("ignores other users' territories entirely", () => {
    const result = computeFocusTarget(
      fc(territory(RIVAL, RIVAL_RING), territory(ME, MY_RING)),
      ME,
      null
    );
    expect(result).toEqual({
      kind: "bounds",
      bounds: [
        [77.72, 12.934],
        [77.722, 12.939],
      ],
    });
  });

  it("spans multiple owned territories", () => {
    const second: Array<[number, number]> = [
      [77.73, 12.95],
      [77.735, 12.95],
      [77.735, 12.955],
      [77.73, 12.955],
      [77.73, 12.95],
    ];
    const result = computeFocusTarget(
      fc(territory(ME, MY_RING), territory(ME, second)),
      ME,
      null
    );
    expect(result).toEqual({
      kind: "bounds",
      bounds: [
        [77.72, 12.934],
        [77.735, 12.955],
      ],
    });
  });

  it("returns null when there is nothing to focus on (keep city default)", () => {
    expect(computeFocusTarget(fc(), ME, null)).toBeNull();
    expect(computeFocusTarget(fc(territory(RIVAL, RIVAL_RING)), ME, null)).toBeNull();
    expect(computeFocusTarget(fc(territory(ME, MY_RING)), null, null)).toBeNull();
  });

  it("skips non-Polygon geometries without crashing", () => {
    const point: GeoJSON.Feature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [77.7, 12.9] },
      properties: { owner_id: ME },
    };
    expect(computeFocusTarget(fc(point), ME, null)).toBeNull();
  });
});
