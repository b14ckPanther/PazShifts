import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function device({ granted = true, device = true, stored = null, platform = 'ios' } = {}) {
  let current = 'a',
    token = 'ExpoPushToken[one]',
    storage = stored;
  const calls = [];
  const tokenRequests = [];
  const exports = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../src/notifications/device.ts', import.meta.url), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }
    ).outputText,
    {
      exports,
      setTimeout,
      clearTimeout,
      require(name) {
        switch (name) {
          case 'expo-crypto':
            return { randomUUID: () => '00000000-0000-4000-8000-000000000001' };
          case '@yellowshifts/database/public':
            return {
              registerWorkerDevice: async (_, args) => {
                calls.push({ ...args, user: current });
              },
            };
          case 'expo-secure-store':
            return {
              getItemAsync: async () => storage,
              setItemAsync: async (_, s) => {
                storage = s;
              },
            };
          case 'expo-notifications':
            return {
              getPermissionsAsync: async () => ({ granted }),
              getExpoPushTokenAsync: async (options) => {
                tokenRequests.push(options);
                return { data: token };
              },
              dismissAllNotificationsAsync: async () => {},
              setNotificationChannelAsync: async () => {},
              AndroidImportance: { DEFAULT: 3 },
            };
          case 'expo-device':
            return { isDevice: device };
          case 'expo-constants':
            return { easConfig: { projectId: 'fixture' }, expoConfig: { version: '1' } };
          case 'react-native':
            return { Platform: { OS: platform } };
          case '../lib/supabase':
            return {
              supabase: {
                auth: { getUser: async () => ({ data: { user: { id: current } }, error: null }) },
              },
            };
            throw Error(name);
        }
      },
    }
  );
  return {
    ...exports,
    calls,
    tokenRequests,
    setUser(v) {
      current = v;
    },
    setToken(v) {
      token = v;
    },
  };
}
test('device startup/rotation reuse installation proof', async () => {
  const d = device();
  await d.synchronizeDevice('a');
  d.setToken('ExpoPushToken[two]');
  await d.synchronizeDevice('a');
  assert.equal(d.calls.length, 2);
  assert.equal(d.calls[0].p_installation, d.calls[1].p_installation);
  assert.equal(d.calls[0].p_secret, d.calls[1].p_secret);
  assert.equal(d.calls[1].p_token, 'ExpoPushToken[two]');
});
test('permission denied never requests a push token; detaches registration', async () => {
  const d = device({ granted: false });
  await d.synchronizeDevice('a');
  assert.equal(d.calls[0].p_token, null);
});
test('logout detaches before subsequent account registration', async () => {
  const d = device();
  await d.synchronizeDevice('a');
  await d.synchronizeDevice('a', true);
  d.setUser('b');
  await d.synchronizeDevice('b');
  assert.deepEqual(
    d.calls.map((c) => c.p_token),
    ['ExpoPushToken[one]', null, 'ExpoPushToken[one]']
  );
  assert.equal(d.calls[2].user, 'b');
});
test('old account cannot register under current session', async () => {
  const d = device();
  d.setUser('b');
  await assert.rejects(d.synchronizeDevice('a'));
  assert.equal(d.calls.length, 0);
});
test('simulator never asks Expo for a production token', async () => {
  const d = device({ device: false });
  await d.synchronizeDevice('a');
  assert.equal(d.calls[0].p_token, null);
});
test('malformed secure installation does not rotate silently', async () => {
  const d = device({ stored: '{}' });
  await assert.rejects(d.synchronizeDevice('a'));
  assert.equal(d.calls.length, 0);
});

function helper({ station = 'station', current = 'a', published = true, assigned = true } = {}) {
  const out = {},
    calls = [];
  runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL('../../../packages/database/src/mobile-notifications.ts', import.meta.url),
        'utf8'
      ),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } }
    ).outputText,
    {
      exports: out,
      require(name) {
        if (name === './worker-context')
          return {
            getNativeWorkerContext: async (_, expected) => {
              if (current !== expected) throw Error('Session');
              return { userId: current, stations: [{ id: 'station', membershipId: 'member' }] };
            },
          };
        if (name === '@yellowshifts/reports') return { validDate: (v) => v === '2026-09-14' };
        throw Error(name);
      },
    }
  );
  const db = {
    from(table) {
      const q = {
        select() {
          return q;
        },
        eq(k, v) {
          calls.push([table, k, v]);
          return q;
        },
        single: async () => ({
          data: {
            station_id: station,
            type: 'SHIFT_REMINDER',
            data: {
              day: '2026-09-14',
              scheduleId: '00000000-0000-4000-8000-000000000001',
              shiftId: '00000000-0000-4000-8000-000000000002',
            },
          },
          error: null,
        }),
        maybeSingle: async () => ({
          data: (table === 'schedules' ? published : assigned) ? { id: 'ok' } : null,
          error: null,
        }),
      };
      return q;
    },
  };
  return { out, db, calls };
}
const notice = '00000000-0000-4000-8000-000000000003';
test('notification deep link resolves authenticated membership and current assigned shift', async () => {
  const h = helper();
  const target = await h.out.workerNotificationTarget(h.db, notice, 'a');
  assert.equal(target.day, '2026-09-14');
  assert.equal(target.stationId, 'station');
  assert.ok(h.calls.some((c) => c[1] === 'station_membership_id' && c[2] === 'member'));
});
for (const [name, options] of [
  ['other account', { current: 'b' }],
  ['unauthorized station', { station: 'foreign' }],
  ['unpublished schedule', { published: false }],
  ['removed assignment', { assigned: false }],
])
  test(`notification tap rejects ${name}`, async () => {
    const h = helper(options);
    await assert.rejects(h.out.workerNotificationTarget(h.db, notice, 'a'));
  });

test('notification channel preparation resolves before permission prompt', async () => {
  const d = device({ platform: 'android' });
  await d.prepareNotificationChannel();
});

test('rotation uses the supplied native token instead of requesting native registration again', async () => {
  const d = device();
  const native = { type: 'ios', data: 'native-fixture' };
  await d.synchronizeDevice('a', false, native);
  assert.equal(d.tokenRequests.length, 1);
  assert.equal(d.tokenRequests[0].devicePushToken, native);
  assert.equal(d.calls.length, 1);
});
