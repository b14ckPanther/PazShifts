import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function load(file, imports = {}) {
  imports = { '../lib/features': { backgroundLocationEnabled: true }, ...imports };
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
      console,
      __DEV__: false,
      setTimeout,
      clearTimeout,
    }
  );
  return exports;
}
const model = load('../src/location/model.ts');
const station = (id = 's', extra = {}) => ({
  id,
  latitude: 32,
  longitude: 35,
  radius: 50,
  nextStart: Date.now() + 3600000,
  arrivalRelevant: true,
  ...extra,
});
const snapshot = () => ({ stations: [station()], activeStation: null });
const registry = () => ({
  userId: 'a',
  expires: Date.now() + 86400000,
  signature: '',
  stations: ['s'],
  dedupe: {},
});
function runtime(deniedRequest = '') {
  const requested = [];
  let regions = [],
    current = 'a',
    context = snapshot(),
    offline = false,
    fg = true,
    bg = true,
    precise = true,
    notifications = true,
    services = true,
    available = true;
  const store = new Map(),
    sent = [];
  const mock = load('../src/location/runtime.ts', {
    './model': model,
    '../auth/secure-storage': {
      createSecureStorage: (b) => ({
        getItem: b.getItemAsync,
        setItem: b.setItemAsync,
        removeItem: b.deleteItemAsync,
      }),
    },
    'react-native': { Platform: { OS: 'ios' } },
    'expo-location': {
      requestForegroundPermissionsAsync: async () => {
        requested.push('foreground');
        fg = deniedRequest !== 'foreground';
      },
      requestBackgroundPermissionsAsync: async () => {
        requested.push('background');
        bg = deniedRequest !== 'background';
      },
      getForegroundPermissionsAsync: async () => ({
        granted: fg,
        ios: { accuracy: precise ? 'full' : 'reduced' },
      }),
      getBackgroundPermissionsAsync: async () => ({ granted: bg }),
      hasServicesEnabledAsync: async () => services,
      hasStartedGeofencingAsync: async () => regions.length > 0,
      stopGeofencingAsync: async () => {
        regions = [];
      },
      startGeofencingAsync: async (_, r) => {
        regions = r;
      },
    },
    'expo-task-manager': { isAvailableAsync: async () => available },
    'expo-notifications': {
      requestPermissionsAsync: async () => {
        requested.push('notifications');
        notifications = deniedRequest !== 'notifications';
      },
      getPermissionsAsync: async () => ({ granted: notifications }),
      getAllScheduledNotificationsAsync: async () => [],
      getPresentedNotificationsAsync: async () => [],
      scheduleNotificationAsync: async (r) => {
        sent.push(r);
      },
    },
    'expo-secure-store': {
      getItemAsync: async (k) => store.get(k) ?? null,
      setItemAsync: async (k, v) => store.set(k, v),
      deleteItemAsync: async (k) => store.delete(k),
    },
    '../lib/supabase': { supabase: {} },
    '../notifications/device': { prepareNotificationChannel: async () => {} },
    '@yellowshifts/database/public': {
      getWorkerReminderContext: async (_, user) => {
        if (offline || user !== current) throw Error('unavailable');
        return context;
      },
    },
  });
  return {
    ...mock,
    requested,
    sent,
    store,
    regions: () => regions,
    set: (v) => {
      ({
        current = current,
        context = context,
        offline = offline,
        fg = fg,
        bg = bg,
        precise = precise,
        notifications = notifications,
        services = services,
        available = available,
      } = v);
    },
  };
}
for (const [field, reason] of [
  ['fg', 'foreground'],
  ['bg', 'background'],
  ['precise', 'precise'],
  ['notifications', 'notifications'],
  ['services', 'services'],
  ['available', 'unavailable'],
]) {
  test(`permission ${field} disabled stops registration`, async () => {
    const r = runtime();
    await r.savePreferences('a', { arrival: true, exit: true });
    r.set({ [field]: false });
    assert.equal(await r.permissionState(), reason);
    await r.reconcileWorkerGeofences('a', 's');
    assert.equal(r.regions().length, 0);
  });
}
test('opt-in default disabled; settings permission recovery reconciles', async () => {
  const r = runtime();
  await r.reconcileWorkerGeofences('a', 's');
  assert.equal(r.regions().length, 0);
  await r.savePreferences('a', { arrival: true, exit: true });
  r.set({ bg: false });
  await r.reconcileWorkerGeofences('a', 's');
  r.set({ bg: true });
  await r.reconcileWorkerGeofences('a', 's');
  assert.equal(r.regions().length, 1);
});
test('region cap prioritizes active then upcoming; excludes unrelated stations', () => {
  const c = {
    activeStation: 'active',
    stations: [
      station('none', { nextStart: null }),
      ...Array.from({ length: 30 }, (_, i) => station(String(i), { nextStart: i })),
      station('active', { nextStart: null }),
    ],
  };
  const result = model.rankedRegions(c, '29', { arrival: true, exit: true });
  assert.equal(result.length, 20);
  assert.equal(result[0].identifier, 'active');
  assert.equal(result[1].identifier, '0');
  assert(!result.some((r) => r.identifier === 'none'));
});
test('exit-only registers active station, not random current station', () => {
  assert.equal(model.rankedRegions(snapshot(), 's', { arrival: false, exit: true }).length, 0);
});
test('arrival schedules once, survives restart through dedupe store', async () => {
  const r = runtime();
  await r.savePreferences('a', { arrival: true, exit: true });
  await r.reconcileWorkerGeofences('a', 's');
  await r.handleGeofence('s', 'arrival');
  await r.reconcileWorkerGeofences('a', 's');
  await r.handleGeofence('s', 'arrival');
  assert.equal(r.sent.length, 1);
  assert.equal(r.sent[0].content.data.kind, 'location-reminder');
});
test('concurrent duplicate enter is serialized', async () => {
  const r = runtime();
  await r.savePreferences('a', { arrival: true, exit: true });
  await r.reconcileWorkerGeofences('a', 's');
  await Promise.all([r.handleGeofence('s', 'arrival'), r.handleGeofence('s', 'arrival')]);
  assert.equal(r.sent.length, 1);
});
for (const [name, context] of [
  [
    'no scheduled relevance',
    { stations: [station('s', { arrivalRelevant: false })], activeStation: null },
  ],
  ['already active', { stations: [station()], activeStation: 's' }],
  ['removed membership', { stations: [], activeStation: null }],
])
  test(`arrival suppressed: ${name}`, async () => {
    const r = runtime();
    await r.savePreferences('a', { arrival: true, exit: true });
    await r.reconcileWorkerGeofences('a', 's');
    r.set({ context });
    await r.handleGeofence('s', 'arrival');
    assert.equal(r.sent.length, 0);
  });
for (const [active, count] of [
  ['s', 1],
  ['other', 0],
  [null, 0],
])
  test(`exit authoritative active=${active}`, async () => {
    const r = runtime();
    await r.savePreferences('a', { arrival: true, exit: true });
    await r.reconcileWorkerGeofences('a', 's');
    r.set({ context: { stations: [station()], activeStation: active } });
    await r.handleGeofence('s', 'exit');
    assert.equal(r.sent.length, count);
  });
test('offline exit skips even after previous ACTIVE read', async () => {
  const r = runtime();
  r.set({ context: { stations: [station()], activeStation: 's' } });
  await r.savePreferences('a', { arrival: true, exit: true });
  await r.reconcileWorkerGeofences('a', 's');
  r.set({ offline: true });
  await r.handleGeofence('s', 'exit');
  assert.equal(r.sent.length, 0);
});
test('expired lease stops native monitoring', async () => {
  const r = runtime();
  await r.savePreferences('a', { arrival: true, exit: true });
  await r.reconcileWorkerGeofences('a', 's');
  const value = JSON.parse(r.store.get('location.registry.v1'));
  value.expires = 0;
  r.store.set('location.registry.v1', JSON.stringify(value));
  await r.handleGeofence('s', 'exit');
  assert.equal(r.regions().length, 0);
  assert.equal(r.sent.length, 0);
});
test('logout clears regions and registry; other account has no consent', async () => {
  const r = runtime();
  await r.savePreferences('a', { arrival: true, exit: true });
  await r.reconcileWorkerGeofences('a', 's');
  await r.clearLocationReminders();
  assert.equal(r.regions().length, 0);
  assert(!r.store.has('location.registry.v1'));
  r.set({ current: 'b' });
  await r.reconcileWorkerGeofences('b', 's');
  assert.equal(r.regions().length, 0);
  await r.handleGeofence('s', 'arrival');
  assert.equal(r.sent.length, 0);
});
test('stale background metadata cannot authorize another account', async () => {
  const r = runtime();
  await r.savePreferences('a', { arrival: true, exit: true });
  await r.reconcileWorkerGeofences('a', 's');
  r.set({ current: 'b' });
  await r.handleGeofence('s', 'arrival');
  assert.equal(r.sent.length, 0);
});
test('membership removal reconciles away OS regions', async () => {
  const r = runtime();
  await r.savePreferences('a', { arrival: true, exit: true });
  await r.reconcileWorkerGeofences('a', 's');
  r.set({ context: { stations: [], activeStation: null } });
  await r.reconcileWorkerGeofences('a', 's');
  assert.equal(r.regions().length, 0);
});
test('dedupe bounded and future timestamps fail closed', () => {
  const s = registry();
  s.dedupe['arrival:s'] = Date.now() + 1e6;
  assert.equal(
    model.shouldRemind(
      snapshot(),
      s,
      'a',
      's',
      'arrival',
      { arrival: true, exit: true },
      Date.now()
    ),
    false
  );
  s.dedupe['arrival:s'] = Date.now() - model.DEDUPE_MS - 1;
  assert.equal(
    model.shouldRemind(
      snapshot(),
      s,
      'a',
      's',
      'arrival',
      { arrival: true, exit: true },
      Date.now()
    ),
    true
  );
});
function reader({
  membership = true,
  coordinate = 32,
  stationActive = true,
  user = 'a',
  fail = false,
} = {}) {
  const queries = [];
  const modules = {
    './worker-context': {
      getNativeWorkerContext: async (_, expected) => {
        if (expected !== user) throw Error('other user');
        return { stations: membership ? [{ id: 's', membershipId: 'm' }] : [] };
      },
    },
  };
  const api = load('../../../packages/database/src/mobile-location.ts', modules);
  const client = {
    from(table) {
      const query = { table, filters: [] };
      queries.push(query);
      const builder = new Proxy(
        {},
        {
          get: (_, key) =>
            key === 'then'
              ? (resolve) =>
                  resolve({
                    error: fail ? {} : null,
                    data:
                      table === 'stations'
                        ? stationActive
                          ? [
                              {
                                id: 's',
                                latitude: coordinate,
                                longitude: 35,
                                attendance_radius_m: 50,
                              },
                            ]
                          : []
                        : table === 'shift_assignments'
                          ? [
                              {
                                station_id: 's',
                                scheduled_shifts: {
                                  start_at: new Date(Date.now() + 3600000).toISOString(),
                                },
                              },
                            ]
                          : null,
                  })
              : (...args) => {
                  query.filters.push([key, ...args]);
                  return builder;
                },
        }
      );
      return builder;
    },
  };
  return { read: () => api.getWorkerReminderContext(client, 'a'), queries };
}
test('mobile-safe reader scopes assignments to authenticated memberships and published schedules', async () => {
  const r = reader();
  const c = await r.read();
  assert.equal(c.stations.length, 1);
  const q = r.queries.find((q) => q.table === 'shift_assignments');
  assert(
    q.filters.some((f) => f[0] === 'in' && f[1] === 'station_membership_id' && f[2][0] === 'm')
  );
  assert(
    q.filters.some(
      (f) => f[0] === 'eq' && f[1] === 'scheduled_shifts.schedules.status' && f[2] === 'PUBLISHED'
    )
  );
  assert(q.filters.some((f) => f[0] === 'limit' && f[1] === 501));
});
for (const [name, options] of [
  ['inactive membership', { membership: false }],
  ['disabled station', { stationActive: false }],
  ['missing coordinates', { coordinate: null }],
  ['invalid coordinates', { coordinate: 999 }],
])
  test(`reader excludes ${name}`, async () => {
    assert.equal((await reader(options).read()).stations.length, 0);
  });
test('reader rejects another authenticated user', async () => {
  await assert.rejects(reader({ user: 'b' }).read());
});
test('database failure never produces an authoritative empty snapshot', async () => {
  await assert.rejects(reader({ fail: true }).read());
});
test('notification permission revoked stops already registered geofences', async () => {
  const r = runtime();
  await r.savePreferences('a', { arrival: true, exit: true });
  await r.reconcileWorkerGeofences('a', 's');
  r.set({ notifications: false });
  await r.handleGeofence('s', 'arrival');
  assert.equal(r.regions().length, 0);
  assert.equal(r.sent.length, 0);
});

test('first enable requests progressively and confirms before background', async () => {
  const r = runtime();
  r.set({ notifications: false, fg: false, bg: false });
  assert.equal(
    await r.requestReminderPermissions(async () => {
      r.requested.push('explanation');
      return true;
    }),
    'ready'
  );
  assert.deepEqual(r.requested, ['notifications', 'foreground', 'explanation', 'background']);
});
for (const denied of ['notifications', 'foreground', 'background'])
  test(`enable stops after ${denied} denial`, async () => {
    const r = runtime(denied);
    r.set({ notifications: false, fg: false, bg: false });
    assert.equal(await r.requestReminderPermissions(async () => true), denied);
    assert.equal(r.requested.at(-1), denied);
  });
test('approximate permission does not ask for background escalation', async () => {
  const r = runtime();
  r.set({ precise: false, bg: false });
  assert.equal(
    await r.requestReminderPermissions(async () => {
      throw Error('should not ask');
    }),
    'precise'
  );
  assert.equal(r.requested.length, 0);
});
test('not now on background explanation does not prompt OS', async () => {
  const r = runtime();
  r.set({ bg: false });
  assert.equal(await r.requestReminderPermissions(async () => false), 'background');
  assert.equal(r.requested.length, 0);
});

test('changed station geometry cannot use a stale OS region', async () => {
  const r = runtime();
  await r.savePreferences('a', { arrival: true, exit: true });
  await r.reconcileWorkerGeofences('a', 's');
  r.set({ context: { stations: [station('s', { latitude: 33 })], activeStation: null } });
  await r.handleGeofence('s', 'arrival');
  assert.equal(r.sent.length, 0);
  assert.equal(r.regions().length, 0);
});

test('damaged local registry still allows native monitoring cleanup', async () => {
  const r = runtime();
  await r.savePreferences('a', { arrival: true, exit: true });
  await r.reconcileWorkerGeofences('a', 's');
  r.store.get = () => {
    throw Error('damaged');
  };
  await r.clearLocationReminders();
  assert.equal(r.regions().length, 0);
});
