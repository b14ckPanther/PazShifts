export interface SecureBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}
const LIMIT = 128;
const CHUNK = 384; // At most 2048 UTF-8 bytes, including non-ASCII profile metadata.
/** Two bounded slots: publish the manifest only after the full next value is durable. */
export function createSecureStorage(backend: SecureBackend) {
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const result = queue.then(work, work);
    queue = result.catch(() => {});
    return result;
  }
  function key(value: string) {
    if (!/^[a-zA-Z0-9._-]+$/.test(value)) throw new Error('Invalid storage key');
    return `ys-v1.${value}`;
  }
  async function manifest(k: string): Promise<{ slot: number; count: number } | null> {
    const raw = await backend.getItemAsync(k);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      ![0, 1].includes(value.slot) ||
      !Number.isInteger(value.count) ||
      value.count < 1 ||
      value.count > LIMIT
    )
      throw new Error('Invalid secure session');
    return value;
  }
  return {
    getItem: (name: string) =>
      serial(async () => {
        const k = key(name),
          m = await manifest(k);
        if (!m) return null;
        let value = '';
        for (let i = 0; i < m.count; i++) {
          const chunk = await backend.getItemAsync(`${k}.${m.slot}.${i}`);
          if (chunk === null) throw new Error('Incomplete secure session');
          value += chunk;
        }
        return value;
      }),
    setItem: (name: string, value: string) =>
      serial(async () => {
        const k = key(name),
          characters = Array.from(value),
          count = Math.max(1, Math.ceil(characters.length / CHUNK));
        if (count > LIMIT) throw new Error('Session exceeds secure storage capacity');
        const old = await manifest(k),
          slot = old ? 1 - old.slot : 0;
        for (let i = 0; i < count; i++)
          await backend.setItemAsync(
            `${k}.${slot}.${i}`,
            characters.slice(i * CHUNK, (i + 1) * CHUNK).join('')
          );
        await backend.setItemAsync(k, JSON.stringify({ slot, count }));
        // Previous tokens should not linger after a successful rotation.
        if (old)
          for (let i = 0; i < old.count; i++)
            await backend.deleteItemAsync(`${k}.${old.slot}.${i}`);
      }),
    removeItem: (name: string) =>
      serial(async () => {
        const k = key(name);
        await backend.deleteItemAsync(k); // Revoke the readable value before removing any orphaned chunks.
        for (let slot = 0; slot < 2; slot++)
          for (let i = 0; i < LIMIT; i++) await backend.deleteItemAsync(`${k}.${slot}.${i}`);
      }),
  };
}
