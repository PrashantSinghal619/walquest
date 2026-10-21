/** Persist raw sensor evidence; coordinates always use GeoJSON [longitude, latitude]. */
export type LocationSample = {
  timestampMs: number;
  coordinate: [number, number];
  accuracyM: number | null;
  altitudeM: number | null;
  speedMps: number | null;
};

/** A new segment starts after an interruption; never bridge it with an invented route. */
export type RecordingSegment = {
  id: string;
  reason: "started" | "resumed" | "permission-restored" | "app-restarted" | "location-gap";
  startedAtMs: number;
  samples: LocationSample[];
};

/** Local ID exists before a network walk can be created. Server ownership is checked separately. */
export type WalkRecording = {
  schemaVersion: 1;
  id: string;
  userId: string | null;
  serverWalkId: string | null;
  status: "recording" | "paused" | "pending-submission" | "completed" | "discarded";
  startedAtMs: number;
  endedAtMs: number | null;
  segments: RecordingSegment[];
};
