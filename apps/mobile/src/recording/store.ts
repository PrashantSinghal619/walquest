import type { LocationSample, RecordingSegment, WalkRecording } from '@walquest/domain/recording';

type SqlValue = string | number | null;
export interface SqlConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...values: SqlValue[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...values: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...values: SqlValue[]): Promise<T[]>;
}
export interface RecordingDatabase extends SqlConnection {
  withExclusiveTransactionAsync(task: (db: SqlConnection) => Promise<void>): Promise<void>;
}

type WalkRow = { id: string; status: WalkRecording['status']; started_at: number; ended_at: number | null; fault: string | null };
type SegmentRow = { id: number; started_at: number; reason: RecordingSegment['reason'] };
type SampleRow = { segment_id: number; timestamp: number; lng: number; lat: number; accuracy: number | null; altitude: number | null; speed: number | null };
export type RecordingSnapshot = { walk: WalkRecording; fault: string | null };
export const MAX_SAMPLE_GAP_MS = 30_000;

export async function initializeRecordingDatabase(db: SqlConnection) {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (version && version.user_version > 1) throw new Error('This recording database needs a newer version of Walquest.');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK (status IN ('recording','paused','pending-submission','discarded')),
      started_at INTEGER NOT NULL, ended_at INTEGER, fault TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_recording ON recordings((1)) WHERE status IN ('recording','paused');
    CREATE TABLE IF NOT EXISTS recording_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, walk_id TEXT NOT NULL REFERENCES recordings(id),
      reason TEXT NOT NULL, started_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recording_samples (
      walk_id TEXT NOT NULL REFERENCES recordings(id), segment_id INTEGER NOT NULL REFERENCES recording_segments(id),
      timestamp INTEGER NOT NULL, lng REAL NOT NULL, lat REAL NOT NULL, accuracy REAL, altitude REAL, speed REAL,
      PRIMARY KEY (walk_id, timestamp)
    );
    PRAGMA user_version = 1;
  `);
}

/** Transactions serialize UI commands and background batches. Raw samples commit before the UI reads them. */
export function createRecordingStore(db: RecordingDatabase) {
  async function latest() : Promise<RecordingSnapshot | null> {
    // Read one consistent snapshot even when a headless batch arrives mid-read.
    let snapshot: RecordingSnapshot | null = null;
    await db.withExclusiveTransactionAsync(async tx => {
      const row = await tx.getFirstAsync<WalkRow>('SELECT * FROM recordings ORDER BY started_at DESC, rowid DESC LIMIT 1');
      if (!row) return;
      const segments = await tx.getAllAsync<SegmentRow>('SELECT * FROM recording_segments WHERE walk_id = ? ORDER BY id', row.id);
      const samples = await tx.getAllAsync<SampleRow>('SELECT * FROM recording_samples WHERE walk_id = ? ORDER BY timestamp', row.id);
      snapshot = {
        fault: row.fault,
        walk: {
          schemaVersion: 1, id: row.id, userId: null, serverWalkId: null,
          status: row.status, startedAtMs: row.started_at, endedAtMs: row.ended_at,
          segments: segments.map(segment => ({
            id: String(segment.id), reason: segment.reason, startedAtMs: segment.started_at,
            samples: samples.filter(sample => sample.segment_id === segment.id).map(sample => ({
              timestampMs: sample.timestamp, coordinate: [sample.lng, sample.lat],
              accuracyM: sample.accuracy, altitudeM: sample.altitude, speedMps: sample.speed,
            })),
          })),
        },
      };
    });
    return snapshot;
  }

  async function begin(now: number) {
    await db.withExclusiveTransactionAsync(async tx => {
      const existing = await tx.getFirstAsync('SELECT id FROM recordings WHERE status IN (\'recording\',\'paused\')');
      if (existing) throw new Error('Resume or finish your saved walk first.');
      const row = await tx.getFirstAsync<{ id: string }>(
        "INSERT INTO recordings (id,status,started_at) VALUES (lower(hex(randomblob(16))), 'recording', ?) RETURNING id", now,
      );
      if (!row) throw new Error('Could not save the new walk.');
      await tx.runAsync("INSERT INTO recording_segments (walk_id,reason,started_at) VALUES (?, 'started', ?)", row.id, now);
    });
  }

  async function resume(now: number) {
    await db.withExclusiveTransactionAsync(async tx => {
      const row = await tx.getFirstAsync<{ id: string }>("SELECT id FROM recordings WHERE status = 'paused'");
      if (!row) throw new Error('No paused walk to resume.');
      await tx.runAsync("INSERT INTO recording_segments (walk_id,reason,started_at) VALUES (?, 'resumed', ?)", row.id, now);
      await tx.runAsync("UPDATE recordings SET status = 'recording', fault = NULL WHERE id = ?", row.id);
    });
  }

  async function append(batch: LocationSample[]) {
    await db.withExclusiveTransactionAsync(async tx => {
      const row = await tx.getFirstAsync<WalkRow>("SELECT * FROM recordings WHERE status = 'recording'");
      if (!row) return;
      let segment = await tx.getFirstAsync<SegmentRow>('SELECT * FROM recording_segments WHERE walk_id = ? ORDER BY id DESC LIMIT 1', row.id);
      if (!segment) throw new Error('Saved walk has no recording segment.');
      const last = await tx.getFirstAsync<{ timestamp: number }>('SELECT timestamp FROM recording_samples WHERE walk_id = ? ORDER BY timestamp DESC LIMIT 1', row.id);
      let previous = last?.timestamp ?? null;
      for (const sample of [...batch].sort((a, b) => a.timestampMs - b.timestampMs)) {
        if (!validSample(sample) || sample.timestampMs < segment.started_at || (previous !== null && sample.timestampMs <= previous)) continue;
        if (previous !== null && sample.timestampMs - previous > MAX_SAMPLE_GAP_MS && previous >= segment.started_at) {
          const gap = await tx.getFirstAsync<SegmentRow>(
            "INSERT INTO recording_segments (walk_id,reason,started_at) VALUES (?, 'location-gap', ?) RETURNING id,reason,started_at", row.id, sample.timestampMs,
          );
          if (!gap) throw new Error('Could not save recording gap.');
          segment = gap;
        }
        await tx.runAsync('INSERT INTO recording_samples VALUES (?,?,?,?,?,?,?,?)', row.id, segment.id, sample.timestampMs,
          sample.coordinate[0], sample.coordinate[1], sample.accuracyM, sample.altitudeM, sample.speedMps);
        previous = sample.timestampMs;
      }
    });
  }

  async function pause(fault: string | null = null) {
    await db.runAsync("UPDATE recordings SET status = 'paused', fault = ? WHERE status = 'recording'", fault);
  }
  async function finish(now: number) {
    await db.runAsync("UPDATE recordings SET status = 'pending-submission', ended_at = ? WHERE status IN ('recording','paused')", now);
  }
  async function discard() {
    // This prototype retains no discarded route or coordinates.
    await db.withExclusiveTransactionAsync(async tx => {
      const row = await tx.getFirstAsync<{ id: string }>('SELECT id FROM recordings ORDER BY started_at DESC, rowid DESC LIMIT 1');
      if (!row) return;
      await tx.runAsync('DELETE FROM recording_samples WHERE walk_id = ?', row.id);
      await tx.runAsync('DELETE FROM recording_segments WHERE walk_id = ?', row.id);
      await tx.runAsync('DELETE FROM recordings WHERE id = ?', row.id);
    });
  }
  // Serialize the UI and headless task's separate SQLite transaction connections.
  let pending: Promise<unknown> = Promise.resolve();
  function serialize<A extends unknown[], R>(operation: (...args: A) => Promise<R>) {
    return (...args: A): Promise<R> => {
      const result = pending.then(() => operation(...args));
      pending = result.catch(() => undefined);
      return result;
    };
  }
  return {
    latest: serialize(latest), begin: serialize(begin), resume: serialize(resume),
    append: serialize(append), pause: serialize(pause), finish: serialize(finish), discard: serialize(discard),
  };
}

function validSample(sample: LocationSample) {
  return Number.isFinite(sample.timestampMs) && sample.timestampMs > 0 &&
    sample.coordinate.length === 2 && sample.coordinate.every(Number.isFinite) &&
    Math.abs(sample.coordinate[0]) <= 180 && Math.abs(sample.coordinate[1]) <= 90 &&
    [sample.accuracyM, sample.altitudeM, sample.speedMps].every(value => value === null || Number.isFinite(value));
}
