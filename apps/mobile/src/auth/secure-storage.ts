/** Supabase storage backed entirely by SecureStore; no token goes into SQLite. */
export interface SecureKeyValue {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}
type Manifest = { version: 1; revision: string; count: number };
const CHUNK_SIZE = 500; // At most 2,000 UTF-8 bytes; never split a surrogate pair.
const MAX_CHUNKS = 256;

function manifest(value: string | null): Manifest | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || !parsed) return null;
    if (!('version' in parsed) || parsed.version !== 1 || !('revision' in parsed) ||
      typeof parsed.revision !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(parsed.revision) ||
      !('count' in parsed) || typeof parsed.count !== 'number' || !Number.isInteger(parsed.count) ||
      parsed.count < 1 || parsed.count > MAX_CHUNKS) return null;
    return { version: 1, revision: parsed.revision, count: parsed.count };
  } catch { return null; }
}

export function createSecureStorage(vault: SecureKeyValue, revision: () => string) {
  const chunkKey = (key: string, saved: Manifest, index: number) => `${key}.${saved.revision}.${index}`;
  async function cleanup(key: string, saved: Manifest | null) {
    if (saved) await Promise.allSettled(Array.from({ length: saved.count }, (_, index) => vault.deleteItemAsync(chunkKey(key, saved, index))));
  }
  // Supabase can access the session and PKCE verifier concurrently. Publish each
  // immutable revision only once all its chunks are durably written.
  let pending: Promise<unknown> = Promise.resolve();
  function serialize<A extends unknown[], R>(operation: (...args: A) => Promise<R>) {
    return (...args: A): Promise<R> => {
      const result = pending.then(() => operation(...args));
      pending = result.catch(() => undefined);
      return result;
    };
  }
  return {
    getItem: serialize(async (key: string) => {
      const saved = manifest(await vault.getItemAsync(key));
      if (!saved) return null;
      const chunks = await Promise.all(Array.from({ length: saved.count }, (_, index) => vault.getItemAsync(chunkKey(key, saved, index))));
      return chunks.some(value => value === null) ? null : chunks.join('');
    }),
    setItem: serialize(async (key: string, value: string) => {
      const characters = Array.from(value);
      const count = Math.max(1, Math.ceil(characters.length / CHUNK_SIZE));
      if (count > MAX_CHUNKS) throw new Error('Session exceeds secure storage capacity.');
      const old = manifest(await vault.getItemAsync(key));
      const saved: Manifest = { version: 1, revision: revision(), count };
      if (old?.revision === saved.revision) throw new Error('Secure storage revision must be unique.');
      try {
        for (let index = 0; index < count; index++) {
          await vault.setItemAsync(chunkKey(key, saved, index), characters.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE).join(''));
        }
        await vault.setItemAsync(key, JSON.stringify(saved));
      } catch (failure) {
        await cleanup(key, saved);
        throw failure;
      }
      await cleanup(key, old);
    }),
    removeItem: serialize(async (key: string) => {
      const old = manifest(await vault.getItemAsync(key));
      // Remove the pointer first so a failed cleanup cannot restore a signed-out session.
      await vault.deleteItemAsync(key);
      await cleanup(key, old);
    }),
  };
}
