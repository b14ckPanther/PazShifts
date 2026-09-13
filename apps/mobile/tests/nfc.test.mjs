import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function load(file, imports = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText,
    {
      exports,
      require: (n) => {
        if (!(n in imports)) throw Error(n);
        return imports[n];
      },
      Date,
      URL,
      setTimeout,
      clearTimeout,
    }
  );
  return exports;
}
const links = load('../src/nfc/links.ts');
const token = '0123456789abcdef0123456789abcdef';
const url = `https://paz.darb.co.il/nfc/${token}`;
const id = '00000000-0000-4000-8000-000000000001';
test('accepts only explicit HTTPS station tag routes on both retained worker domains', () => {
  for (const host of links.workerHosts)
    assert.equal(links.parseNfcLink(`https://${host}/nfc/${token}`).token, token);
  for (const bad of [
    url.replace('https:', 'http:'),
    url.replace('paz.darb.co.il', 'evil.com'),
    url + '/',
    url + '#x',
    url + '?next=https://evil.com',
    url.replace('/nfc/', '/x/../nfc/'),
    url.replace('/nfc/', '/%2e%2e/nfc/'),
    url.replace('/nfc/', '\\nfc\\'),
    url.replace('https://', 'https://user@'),
    url.replace('paz.darb.co.il', 'paz.darb.co.il:999'),
    url.replace(token, '%2f' + token),
  ])
    assert.equal(links.parseNfcLink(bad), null, bad);
});
test('preserves valid web scan receipt but rejects malformed and duplicate query parameters', () => {
  assert.equal(links.parseNfcLink(url + `?scan=${id}&at=${Date.now()}`).scan, id);
  for (const query of [
    '?scan=bad',
    `?scan=${id}`,
    '?at=123',
    `?scan=${id}&scan=${id}&at=${Date.now()}`,
    '?scan=&at=',
  ]) {
    assert.equal(links.parseNfcLink(url + query), null);
  }
});
function pending() {
  let raw = null;
  const api = load('../src/nfc/pending.ts', {
    './links': links,
    'expo-crypto': { randomUUID: () => id },
    'expo-secure-store': {
      getItemAsync: async () => raw,
      setItemAsync: async (_k, v) => {
        raw = v;
      },
      deleteItemAsync: async () => {
        raw = null;
      },
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
    },
  });
  return {
    api,
    corrupt: (v) => {
      raw = v;
    },
  };
}
test('unresolved submission survives restart/new tag and logout clears it', async () => {
  const { api } = pending();
  assert.equal(await api.receiveNfcLink(url), true);
  const first = await api.readPending();
  await api.savePending({ ...first, userId: 'worker', sent: true, action: 'CLOCK_IN' });
  await api.receiveNfcLink(url.replace(token, 'abcdef0123456789abcdef0123456789'));
  assert.equal((await api.readPending()).token, token);
  assert.equal((await api.readPending()).userId, 'worker');
  await api.clearNfcIntent();
  assert.equal(await api.readPending(), null);
});
test('corrupt or expired persisted intent is never submitted', async () => {
  const { api, corrupt } = pending();
  for (const value of [
    'oops',
    JSON.stringify({ token, scanId: id, at: 0, userId: null }),
    JSON.stringify({ token, scanId: id, at: Date.now(), userId: null, sent: 'yes' }),
  ]) {
    corrupt(value);
    assert.equal(await api.readPending(), null);
  }
});
test('native intent keeps a safe receipt destination and rejects custom NFC schemes', async () => {
  const { api } = pending();
  const redirect = load('../app/+native-intent.tsx', {
    '../src/nfc/pending': api,
  }).redirectSystemPath;
  assert.equal(await redirect({ path: url }), `/attendance?scan=${id}`);
  assert.equal(await redirect({ path: 'yellowshifts://nfc/' + token }), '/attendance?invalid=1');
});
test('foreground scan fixes reject denied, approximate, mocked and stale locations', async () => {
  for (const [mode, code] of [
    ['denied', 'LOCATION_REQUIRED'],
    ['approximate', 'LOCATION_INACCURATE'],
    ['mocked', 'LOCATION_MOCKED'],
    ['stale', 'LOCATION_STALE'],
    ['off', 'LOCATION_UNAVAILABLE'],
    ['valid', null],
  ]) {
    const permission = {
      granted: mode !== 'denied',
      ios: { accuracy: mode === 'approximate' ? 'reduced' : 'full' },
    };
    let fixes = 0;
    const { scanLocation } = load('../src/nfc/location.ts', {
      'react-native': { Platform: { OS: 'ios' } },
      'expo-location': {
        getForegroundPermissionsAsync: async () => permission,
        requestForegroundPermissionsAsync: async () => permission,
        hasServicesEnabledAsync: async () => mode !== 'off',
        Accuracy: { High: 4 },
        getCurrentPositionAsync: async () => {
          fixes++;
          return {
            mocked: mode === 'mocked',
            timestamp: Date.now() - (mode === 'stale' ? 120000 : 0),
            coords: { latitude: 32, longitude: 35, accuracy: 5 },
          };
        },
      },
    });
    if (code) await assert.rejects(scanLocation(), { message: code });
    else assert.equal((await scanLocation()).latitude, 32);
    assert.ok(fixes <= 1);
  }
});
test('association payloads fail closed until real signing identifiers are provided', () => {
  const a = load('../../web/app/.well-known/association.ts');
  assert.equal(a.appleAssociation(undefined), null);
  assert.equal(a.androidAssociation('il.co.darb.yellowshifts', undefined), null);
  const apple = a.appleAssociation('ABCDEFGHIJ.il.co.darb.yellowshifts');
  assert.deepEqual(Array.from(apple.applinks.details[0].paths), ['/nfc/*']);
  assert.equal(
    a.androidAssociation('il.co.darb.yellowshifts', Array(32).fill('AA').join(':'))[0].target
      .package_name,
    'il.co.darb.yellowshifts'
  );
});
test('native data wrapper rejects identity changes before invoking the mutation RPC', async () => {
  const helper = load('../../../packages/database/src/mobile-nfc.ts', { './worker-context': {} });
  let calls = 0;
  const result = await helper.submitNativeNfc(
    {
      auth: { getUser: async () => ({ data: { user: { id: 'other' } }, error: null }) },
      rpc: async () => {
        calls++;
      },
    },
    'worker',
    {},
    {}
  );
  assert.equal(result.code, 'SESSION_EXPIRED');
  assert.equal(calls, 0);
});
test('native mutation passes the frozen expected action and authoritative scan receipt to the existing RPC boundary', async () => {
  const helper = load('../../../packages/database/src/mobile-nfc.ts', { './worker-context': {} });
  let called;
  const result = await helper.submitNativeNfc(
    {
      auth: { getUser: async () => ({ data: { user: { id: 'u' } }, error: null }) },
      rpc: async (name, args) => {
        called = { name, args };
        return { error: null, data: { success: false, code: 'OUTSIDE_STATION' } };
      },
    },
    'u',
    { token, scanId: id, at: Date.now(), action: 'CLOCK_OUT', recordId: 'r' },
    { latitude: 32, longitude: 35, accuracy: 5, timestamp: Date.now() }
  );
  assert.equal(called.name, 'process_native_nfc_scan');
  assert.equal(called.args.p_expected_record, 'r');
  assert.equal(called.args.p_scan_id, id);
  assert.equal(result.code, 'OUTSIDE_STATION');
});
