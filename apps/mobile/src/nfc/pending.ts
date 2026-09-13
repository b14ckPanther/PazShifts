import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { parseNfcLink, tokenPattern, scanPattern } from './links';
export type PendingScan = {
  token: string;
  scanId: string;
  at: number;
  userId: string | null;
  action?: 'CLOCK_IN' | 'CLOCK_OUT';
  recordId?: string | null;
  sent?: boolean;
  completed?: boolean;
};
const key = 'ys.native.nfc.v1';
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>) {
  const p = chain.then(fn, fn);
  chain = p.catch(() => {});
  return p;
}
export async function readPending(): Promise<PendingScan | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as PendingScan;
    if (
      !tokenPattern.test(v.token) ||
      !scanPattern.test(v.scanId) ||
      !Number.isFinite(v.at) ||
      v.at > Date.now() + 30000 ||
      v.at < Date.now() - 86400000 ||
      (v.userId !== null && typeof v.userId !== 'string') ||
      (v.action !== undefined && !['CLOCK_IN', 'CLOCK_OUT'].includes(v.action)) ||
      (v.recordId !== undefined && v.recordId !== null && typeof v.recordId !== 'string') ||
      (v.sent !== undefined && typeof v.sent !== 'boolean') ||
      (v.completed !== undefined && typeof v.completed !== 'boolean')
    )
      return null;
    return v;
  } catch {
    return null;
  }
}
function writePending(value: PendingScan) {
  return SecureStore.setItemAsync(key, JSON.stringify(value), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
export function savePending(value: PendingScan) {
  return serial(() => writePending(value));
}
export function clearNfcIntent() {
  return serial(() => SecureStore.deleteItemAsync(key));
}
export async function receiveNfcLink(url: string) {
  const parsed = parseNfcLink(url);
  if (!parsed) return false;
  return serial(async () => {
    const existing = await readPending();
    // An unresolved submission is recovered, never replaced by a new operation on another tap.
    if (existing?.sent && !existing.completed) return true;
    await writePending({
      token: parsed.token,
      scanId: parsed.scan ?? Crypto.randomUUID(),
      at: parsed.at ?? Date.now(),
      userId: null,
    });
    return true;
  });
}
