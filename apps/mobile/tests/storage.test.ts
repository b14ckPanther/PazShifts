import test from 'node:test';
import assert from 'node:assert/strict';
import { createSecureStorage } from '../src/auth/secure-storage.ts';
import { safeReturnPath } from '../src/auth/return-path.ts';
function fixture() {
  const values = new Map<string, string>();
  let fail = '';
  const backend = {
    getItemAsync: async (k: string) => values.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => {
      if (k === fail) throw Error('disk failure');
      assert.ok(Buffer.byteLength(v) <= 2048);
      values.set(k, v);
    },
    deleteItemAsync: async (k: string) => {
      values.delete(k);
    },
  };
  return {
    values,
    storage: createSecureStorage(backend),
    fail: (key: string) => {
      fail = key;
    },
  };
}
test('large Unicode session survives restoration and rotation', async () => {
  const f = fixture(),
    value = 'אבג😀'.repeat(2200);
  await f.storage.setItem('session', value);
  assert.equal(await f.storage.getItem('session'), value);
  await f.storage.setItem('session', 'new token');
  assert.equal(await f.storage.getItem('session'), 'new token');
  assert.equal([...f.values.keys()].filter((k) => k.includes('.0.')).length, 0);
});
test('failed fill keeps previous complete session and reports failure', async () => {
  const f = fixture();
  await f.storage.setItem('session', 'old');
  f.fail('ys-v1.session.1.1');
  await assert.rejects(f.storage.setItem('session', 'x'.repeat(1000)));
  assert.equal(await f.storage.getItem('session'), 'old');
  await f.storage.removeItem('session');
  assert.equal(f.values.size, 0);
});
test('concurrent refresh then logout cannot resurrect session', async () => {
  const f = fixture();
  await Promise.all([
    f.storage.setItem('session', 'first'),
    f.storage.setItem('session', 'second'),
    f.storage.removeItem('session'),
  ]);
  assert.equal(await f.storage.getItem('session'), null);
  assert.equal(f.values.size, 0);
});
test('corrupt and incomplete sessions fail closed; removal recovers', async () => {
  const f = fixture();
  f.values.set('ys-v1.session', '{"slot":0,"count":999}');
  await assert.rejects(f.storage.getItem('session'));
  await f.storage.removeItem('session');
  await f.storage.setItem('session', 'ok');
  f.values.delete('ys-v1.session.0.0');
  await assert.rejects(f.storage.getItem('session'));
});
test('oversized payload and unsafe storage keys rejected', async () => {
  const f = fixture();
  await assert.rejects(f.storage.setItem('../session', 'x'));
  await assert.rejects(f.storage.setItem('session', 'x'.repeat(100000)));
  assert.equal(f.values.size, 0);
});
test('deep links never redirect outside implemented native routes', () => {
  for (const path of [
    'https://evil.test',
    '//evil.test',
    '/nfc/token',
    '/login',
    'javascript:alert(1)',
    undefined,
  ])
    assert.equal(safeReturnPath(path), '/');
});
