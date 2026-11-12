import { buildReplayTrack } from '@walquest/domain/geo/replay';
import type { WalkRecording } from '@walquest/domain/recording';
import type { FeatureCollection, LineString } from 'geojson';

// A planning assumption, not a measured stride or a pedometer reading.
export const ASSUMED_STEP_LENGTH_M = 0.75;

export function summarizeRecording(walk: WalkRecording | undefined) {
  const segments = walk?.segments ?? [];
  const samples = segments.flatMap(segment => segment.samples);
  // Distance and rendering both preserve gaps. Never flatten before measuring.
  const distanceM = segments.reduce((total, segment) => total + buildReplayTrack(segment.samples.map(s => s.coordinate)).totalM, 0);
  const route: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: segments.filter(segment => segment.samples.length > 1).map(segment => ({
      type: 'Feature', id: segment.id, properties: {},
      geometry: { type: 'LineString', coordinates: segment.samples.map(sample => sample.coordinate) },
    })),
  };
  const last = samples.at(-1);
  const estimatedSteps = Math.round(distanceM / ASSUMED_STEP_LENGTH_M);
  return { route, distanceM, estimatedSteps, samples: samples.length, last, gaps: segments.filter(s => s.reason === 'location-gap').length };
}
