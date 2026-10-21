import { openDatabaseAsync } from 'expo-sqlite';
import { createRecordingStore, initializeRecordingDatabase } from './store';

let store: Promise<ReturnType<typeof createRecordingStore>> | undefined;

export function getRecordingStore() {
  store ??= (async () => {
    const db = await openDatabaseAsync('walquest-recordings.db');
    await initializeRecordingDatabase(db);
    return createRecordingStore(db);
  })().catch(error => {
    store = undefined;
    throw error;
  });
  return store;
}
