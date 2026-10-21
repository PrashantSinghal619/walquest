import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getRecordingStore } from './database';
import { LOCATION_TASK } from './task';

export async function ensureRecordingPermissions() {
  if (!(await TaskManager.isAvailableAsync())) throw new Error('Install the Walquest development build to record walks.');
  if (!(await Location.hasServicesEnabledAsync())) throw new Error('Turn on location services, then try again.');
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!hasPreciseLocation(foreground)) throw new Error('Allow precise location in Settings to record your walk.');
  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) throw new Error('Allow background location in Settings to record while your phone is locked.');
}

async function start(resume: boolean) {
  await ensureRecordingPermissions();
  // Clear a previously registered task before starting a new segment or walk.
  await stopNativeRecording();
  const store = await getRecordingStore();
  if (resume) await store.resume(Date.now());
  else await store.begin(Date.now());
  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 5,
      timeInterval: 5_000,
      deferredUpdatesInterval: 0,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Walquest is recording your walk',
        notificationBody: 'Location is saved while your screen is locked. Open Walquest to pause or finish.',
        killServiceOnDestroy: true,
      },
    });
  } catch (error) {
    await store.pause('Recording could not start. Check location permissions and try resuming.');
    throw error;
  }
}

async function stopNativeRecording() {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
}

async function pause() {
  const store = await getRecordingStore();
  await store.pause();
  await stopNativeRecording();
}

async function finish() {
  const store = await getRecordingStore();
  await store.finish(Date.now());
  await stopNativeRecording();
}

async function discard() {
  await pause();
  await (await getRecordingStore()).discard();
}

/** Reopening never silently invents continuity when native recording has stopped. */
async function reconcile() {
  const store = await getRecordingStore();
  const saved = await store.latest();
  if (saved?.walk.status !== 'recording') {
    await stopNativeRecording();
    return;
  }
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  const services = await Location.hasServicesEnabledAsync();
  if (!hasPreciseLocation(foreground) || !background.granted || !running || !services) {
    await store.pause('Recording was interrupted. Saved points are kept. Resume to start a new route segment.');
    await stopNativeRecording();
  }
}

function hasPreciseLocation(permission: Location.LocationPermissionResponse) {
  return permission.granted && permission.android?.accuracy !== 'coarse' &&
    permission.android?.accuracy !== 'none' && permission.ios?.accuracy !== 'reduced';
}

// Account sign-out and the walk controls share the same command queue. In
// particular, a pending start must finish before sign-out stops the native task.
let pendingCommand: Promise<unknown> = Promise.resolve();
function serialize<A extends unknown[], R>(operation: (...args: A) => Promise<R>) {
  return (...args: A): Promise<R> => {
    const result = pendingCommand.then(() => operation(...args));
    pendingCommand = result.catch(() => undefined);
    return result;
  };
}
export const startRecorder = serialize(start);
export const pauseRecorder = serialize(pause);
export const finishRecorder = serialize(finish);
export const discardRecording = serialize(discard);
export const reconcileRecorder = serialize(reconcile);
