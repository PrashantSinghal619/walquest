import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createRecordingStore, initializeRecordingDatabase } from '../src/recording/store.ts';
import { summarizeRecording } from '../src/recording/summary.ts';

function connection(raw) {
  return {
    execAsync: async sql => { raw.exec(sql); },
    runAsync: async (sql, ...values) => raw.prepare(sql).run(...values),
    getFirstAsync: async (sql, ...values) => raw.prepare(sql).get(...values) ?? null,
    getAllAsync: async (sql, ...values) => raw.prepare(sql).all(...values),
    withExclusiveTransactionAsync: async task => {
      raw.exec('BEGIN IMMEDIATE');
      try { await task(connection(raw)); raw.exec('COMMIT'); }
      catch (error) { raw.exec('ROLLBACK'); throw error; }
    },
  };
}
async function setup(t, filename = ':memory:') {
  const raw = new DatabaseSync(filename);
  t.after(() => raw.close());
  const db = connection(raw);
  await initializeRecordingDatabase(db);
  return { raw, db, store: createRecordingStore(db) };
}
const sample = (timestampMs, lng = 77.59, lat = 12.97) => ({
  timestampMs, coordinate: [lng, lat], accuracyM: 8, altitudeM: null, speedMps: 1.2,
});

test('committed raw samples survive closing and reopening the on-disk database', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'walquest-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'recording.db');
  const raw = new DatabaseSync(file);
  const db = connection(raw);
  await initializeRecordingDatabase(db);
  const store = createRecordingStore(db);
  await store.begin(1_000);
  await store.append([sample(2_000), sample(7_000, 77.5901)]);
  const before = await store.latest();
  raw.close();
  const reopened = new DatabaseSync(file);
  try {
    const reopenedDb = connection(reopened);
    await initializeRecordingDatabase(reopenedDb);
    assert.deepEqual(await createRecordingStore(reopenedDb).latest(), before);
  } finally { reopened.close(); }
});

test('duplicate, stale, invalid and pre-segment samples cannot inflate the route', async t => {
  const { store } = await setup(t);
  await store.begin(1_000);
  await store.append([sample(9_000), sample(2_000), sample(2_000), sample(500), sample(5_000, NaN), sample(6_000, 181)]);
  await store.append([sample(3_000), sample(9_000), sample(10_000)]);
  assert.deepEqual((await store.latest()).walk.segments[0].samples.map(s => s.timestampMs), [2_000, 9_000, 10_000]);
});

test('pausing ignores callbacks, resuming starts a separate line and excludes missing distance', async t => {
  const { store } = await setup(t);
  await store.begin(1_000);
  await store.append([sample(2_000), sample(7_000, 77.5901)]);
  await store.pause();
  await store.append([sample(8_000, 78)]);
  await store.resume(20_000);
  await store.append([sample(15_000, 78), sample(21_000, 78), sample(26_000, 78.0001)]);
  const { walk } = await store.latest();
  assert.equal(walk.segments.length, 2);
  assert.deepEqual(walk.segments.map(s => s.samples.length), [2, 2]);
  const summary = summarizeRecording(walk);
  assert.equal(summary.route.features.length, 2);
  assert.ok(summary.distanceM > 20 && summary.distanceM < 25);
});

test('a gap longer than 30 seconds is represented without a connecting line', async t => {
  const { store } = await setup(t);
  await store.begin(1_000);
  await store.append([sample(2_000), sample(7_000, 77.5901), sample(40_000, 78), sample(45_000, 78.0001)]);
  const { walk } = await store.latest();
  assert.equal(walk.segments[1].reason, 'location-gap');
  const summary = summarizeRecording(walk);
  assert.equal(summary.gaps, 1);
  assert.equal(summary.route.features.length, 2);
  assert.ok(summary.distanceM < 25);
});

test('a batch failure rolls back all samples rather than leaving a partial saved route', async t => {
  const { raw, store } = await setup(t);
  await store.begin(1_000);
  raw.exec("CREATE TRIGGER fail_sample BEFORE INSERT ON recording_samples WHEN NEW.timestamp = 7000 BEGIN SELECT RAISE(ABORT, 'disk write failed'); END");
  await assert.rejects(store.append([sample(2_000), sample(7_000)]), /disk write failed/);
  assert.equal(summarizeRecording((await store.latest()).walk).samples, 0);
  raw.exec('DROP TRIGGER fail_sample');
  await store.append([sample(2_000)]);
  assert.equal(summarizeRecording((await store.latest()).walk).samples, 1);
});

test('concurrent starts serialize and permit exactly one unfinished walk', async t => {
  const { store } = await setup(t);
  const results = await Promise.allSettled([store.begin(1_000), store.begin(2_000)]);
  assert.deepEqual(results.map(r => r.status), ['fulfilled', 'rejected']);
  assert.equal((await store.latest()).walk.startedAtMs, 1_000);
});

test('background batches and pause serialize, and finished walks reject late callbacks', async t => {
  const { store } = await setup(t);
  await store.begin(1_000);
  await Promise.all([store.append([sample(2_000)]), store.pause('Interrupted')]);
  assert.equal((await store.latest()).fault, 'Interrupted');
  await store.finish(10_000);
  await store.append([sample(11_000)]);
  const saved = await store.latest();
  assert.equal(saved.walk.status, 'pending-submission');
  assert.equal(saved.walk.endedAtMs, 10_000);
  assert.equal(summarizeRecording(saved.walk).samples, 1);
});

test('deleting a saved walk removes samples and segments without removing other walks', async t => {
  const { raw, store } = await setup(t);
  await store.begin(1_000);
  await store.append([sample(2_000)]);
  await store.finish(3_000);
  await store.begin(4_000);
  await store.append([sample(5_000)]);
  await store.discard();
  assert.equal((await store.latest()).walk.startedAtMs, 1_000);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM recording_samples').get().n, 1);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM recording_segments').get().n, 1);
});

test('an unknown newer schema is rejected without overwriting its version', async t => {
  const { raw, db } = await setup(t);
  raw.exec('PRAGMA user_version = 2');
  await assert.rejects(initializeRecordingDatabase(db), /newer version/);
  assert.equal(raw.prepare('PRAGMA user_version').get().user_version, 2);
});
