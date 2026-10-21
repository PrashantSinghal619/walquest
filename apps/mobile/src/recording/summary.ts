import { buildReplayTrack } from '@walquest/domain/geo/replay';
import type { WalkRecording } from '@walquest/domain/recording';
import type { FeatureCollection, LineString } from 'geojson';

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
  return { route, distanceM, samples: samples.length, last, gaps: segments.filter(s => s.reason === 'location-gap').length };
}
