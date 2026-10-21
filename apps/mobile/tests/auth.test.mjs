import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSecureStorage } from '../src/auth/secure-storage.ts';
import { parseAuthCallback } from '../src/auth/callback.ts';

function setup() {
  const data = new Map();
  let revision = 0;
  const vault = {
    getItemAsync: async key => data.get(key) ?? null,
    setItemAsync: async (key, value) => {
      assert.ok(Buffer.byteLength(value) <= 2048, 'Native storage value is too large');
      // Model the native string boundary to catch split UTF-16 surrogate pairs.
      data.set(key, Buffer.from(value).toString());
    },
    deleteItemAsync: async key => { data.delete(key); },
  };
  return { vault, data, storage: createSecureStorage(vault, () => `revision-${++revision}`) };
}

test('large sessions with non-ASCII metadata survive a fresh storage adapter', async () => {
  const { vault, data, storage } = setup();
  const session = JSON.stringify({ access_token: 'jwt'.repeat(3000), metadata: '🌏ಅ'.repeat(1000) });
  await storage.setItem('session', session);
  assert.equal(await createSecureStorage(vault, () => 'unused').getItem('session'), session);
  assert.ok(data.size > 10);
  assert.ok(!data.get('session').includes('access_token'));
});

test('a failed chunk write keeps the previous session readable and removes partial chunks', async () => {
  const { data, vault, storage } = setup();
  await storage.setItem('session', 'previous session');
  const original = vault.setItemAsync;
  vault.setItemAsync = async (key, value) => {
    if (key.endsWith('revision-2.1')) throw new Error('keychain unavailable');
    await original(key, value);
  };
  await assert.rejects(storage.setItem('session', 'x'.repeat(2000)), /keychain unavailable/);
  assert.equal(await storage.getItem('session'), 'previous session');
  assert.ok([...data.keys()].every(key => !key.includes('revision-2')));
});

test('a failed manifest publication also preserves the previous complete session', async () => {
  const { vault, storage } = setup();
  await storage.setItem('session', 'previous');
  const original = vault.setItemAsync;
  vault.setItemAsync = async (key, value) => {
    if (key === 'session') throw new Error('manifest failed');
    await original(key, value);
  };
  await assert.rejects(storage.setItem('session', 'next'), /manifest failed/);
  assert.equal(await storage.getItem('session'), 'previous');
});

test('concurrent writes serialize and remove stale chunks; sign-out removes the pointer', async () => {
  const { storage, data } = setup();
  await Promise.all([storage.setItem('session', 'a'.repeat(3000)), storage.setItem('session', 'b')]);
  assert.equal(await storage.getItem('session'), 'b');
  assert.equal(data.size, 2);
  await storage.removeItem('session');
  assert.equal(await storage.getItem('session'), null);
  assert.equal(data.size, 0);
});

test('missing chunks and corrupt manifests cannot return a partial token', async () => {
  const { storage, data } = setup();
  await storage.setItem('session', 'a'.repeat(2000));
  data.delete('session.revision-1.1');
  assert.equal(await storage.getItem('session'), null);
  data.set('session', '{broken');
  assert.equal(await storage.getItem('session'), null);
  data.set('session', JSON.stringify({ version: 1, revision: 'valid', count: 1e9 }));
  assert.equal(await storage.getItem('session'), null);
});

test('failed stale-chunk cleanup cannot undo sign-out', async () => {
  const { storage, vault } = setup();
  await storage.setItem('session', 'secret');
  const original = vault.deleteItemAsync;
  vault.deleteItemAsync = async key => {
    if (key !== 'session') throw new Error('cleanup failed');
    await original(key);
  };
  await storage.removeItem('session');
  assert.equal(await storage.getItem('session'), null);
});

test('only the exact application callback with one PKCE code is accepted', () => {
  assert.deepEqual(parseAuthCallback('walquest://auth/callback?code=abc-123'), { code: 'abc-123' });
  for (const url of [
    'https://auth/callback?code=abc', 'walquest://evil/callback?code=abc',
    'walquest://auth/other?code=abc', 'walquest://auth/callback',
    'walquest://auth/callback?code=', 'walquest://auth/callback?code=a&code=b',
    'walquest://auth/callback?code=a#error', 'walquest://auth/callback?error=expired',
    'walquest://auth/callback#access_token=secret', 'invalid',
    'walquest://someone@auth/callback?code=a',
  ]) assert.ok('error' in parseAuthCallback(url), url);
});
