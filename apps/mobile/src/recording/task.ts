import * as TaskManager from 'expo-task-manager';
import { stopLocationUpdatesAsync, type LocationObject } from 'expo-location';
import { getRecordingStore } from './database';

export const LOCATION_TASK = 'walquest.walk-location.v1';

// Loaded by the root layout in both interactive and headless launches.
TaskManager.defineTask<{ locations: LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  const store = await getRecordingStore().catch(async failure => {
    await stopLocationUpdatesAsync(LOCATION_TASK).catch(() => undefined);
    throw failure;
  });
  if (error) {
    try {
      await store.pause('Location recording stopped. Your saved route is safe; check permissions and resume.');
    } finally { await stopLocationUpdatesAsync(LOCATION_TASK).catch(() => undefined); }
    return;
  }
  if (!data) return;
  try {
    await store.append(data.locations.map(location => ({
      timestampMs: location.timestamp,
      coordinate: [location.coords.longitude, location.coords.latitude],
      accuracyM: location.coords.accuracy,
      altitudeM: location.coords.altitude,
      speedMps: location.coords.speed,
    })));
  } catch {
    try {
      await store.pause('Could not save location samples. Recording is paused; check device storage before resuming.');
    } finally { await stopLocationUpdatesAsync(LOCATION_TASK).catch(() => undefined); }
  }
});
