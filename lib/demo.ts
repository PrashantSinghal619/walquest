// Fictional walks around Bengaluru. Never load production user data here.
export const DEMO_USER = "demo-you";
export const DEMO_LOOP: Array<[number, number]> = [
  [77.590, 12.974], [77.593, 12.974], [77.593, 12.977],
  [77.590, 12.977], [77.590, 12.974],
];

function territory(id: string, owner: string, name: string, ring: Array<[number, number]>): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: "Feature", geometry: { type: "Polygon", coordinates: [ring] },
    properties: { id, owner_id: owner, owner_name: name, area_m2: 108_000, claimed_at: "2026-01-01T08:00:00Z" },
  };
}

export function demoTerritories(claimed: boolean): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      territory("sample-rival", "demo-rival", "Sample walker", [
        [77.595, 12.974], [77.598, 12.974], [77.598, 12.977],
        [77.595, 12.977], [77.595, 12.974],
      ]),
      ...(claimed ? [territory("sample-yours", DEMO_USER, "Demo explorer", DEMO_LOOP)] : []),
    ],
  };
}
