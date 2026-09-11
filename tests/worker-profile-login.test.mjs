import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const ts = createRequire(import.meta.url)('typescript');
function load(path, deps = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      FormData,
      require: (n) => {
        assert(n in deps, n);
        return deps[n];
      },
    }
  );
  return exports;
}
const identifiers = load('../packages/database/src/login-identifier.ts');
const permissions = load('../packages/database/src/member-permissions.ts');

test('phone/email identifiers normalize without modifying passwords or guessing foreign countries', () => {
  for (const input of ['050-1234567', '+972 50 123 4567', '00972501234567'])
    assert.equal(identifiers.normalizePhone(input), '+972501234567');
  assert.equal(identifiers.normalizePhone('4155551234'), null);
  assert.equal(identifiers.normalizePhone('hello'), null);
  assert.equal(
    identifiers.passwordCredentials(' NAME@EXAMPLE.COM ', ' space ').email,
    'name@example.com'
  );
  assert.equal(identifiers.passwordCredentials('0501234567', ' space ').password, ' space ');
});
for (const app of ['web', 'admin'])
  test(`${app} login calls password auth for either identifier and preserves NFC next`, async () => {
    const calls = [];
    const redirect = [];
    const action = load(`../apps/${app}/app/actions/auth.ts`, {
      'next/headers': { cookies: async () => ({}) },
      'next/navigation': { redirect: (p) => redirect.push(p) },
      '@yellowshifts/database': {
        ...identifiers,
        safeNextPath: (p) => p,
        createServerSupabaseClient: () => ({
          auth: {
            signInWithPassword: async (c) => {
              calls.push(c);
              return { error: null };
            },
          },
        }),
      },
    }).loginAction;
    for (const identifier of ['0501234567', 'worker@example.com']) {
      const form = new FormData();
      form.set('identifier', identifier);
      form.set('password', 'secret-password');
      form.set('next', '/nfc/token?scan=receipt');
      await action(null, form);
    }
    assert.equal(calls[0].phone, '+972501234567');
    assert.equal(calls[1].email, 'worker@example.com');
    assert.equal(redirect[0], '/nfc/token?scan=receipt');
  });
function harness({
  platform = false,
  role = 'ADMIN',
  status = 'ACTIVE',
  self = false,
  targetRole = 'WORKER',
  targetPlatform = false,
  otherAdmin = false,
  authError = false,
  codeError = false,
} = {}) {
  const writes = [];
  const result = (data, error = null) => ({
    select() {
      return this;
    },
    eq() {
      return this;
    },
    single: async () => ({ data, error }),
    then(resolve) {
      return Promise.resolve({ data, error }).then(resolve);
    },
  });
  const supabase = {
    from: () => ({
      update: (data) => {
        writes.push(['membership', data]);
        return result({ id: 'member' }, codeError ? {} : null);
      },
    }),
  };
  const admin = {
    from: (table) =>
      result(
        (table === 'platform_admins' ? targetPlatform : otherAdmin) ? [{ id: 'protected' }] : []
      ),
    auth: {
      admin: {
        updateUserById: async (id, data) => {
          writes.push(['auth', id, data]);
          return { error: authError ? {} : null };
        },
      },
    },
  };
  const action = load('../apps/admin/app/actions/stations.ts', {
    'next/headers': { cookies: async () => ({}) },
    'next/cache': { revalidatePath() {} },
    '@yellowshifts/database': {
      ...identifiers,
      ...permissions,
      createServerSupabaseClient: () => supabase,
      createAdminClient: () => admin,
      getAuthenticatedUserContext: async () => ({
        user: { id: 'actor' },
        isPlatformAdmin: platform,
        memberships: [{ station: { id: 'station' }, membership: { role, status } }],
      }),
      getStationMemberById: async (_s, station) =>
        station === 'station'
          ? {
              profile: { id: self ? 'actor' : 'target' },
              membership: { id: 'member', userId: self ? 'actor' : 'target', role: targetRole },
            }
          : null,
    },
  }).updateWorkerProfileAction;
  const form = new FormData();
  Object.entries({
    fullName: 'Test Worker',
    email: 'WORKER@example.com',
    phone: '0501234567',
    employeeCode: 'W-1',
    password: '',
  }).forEach(([k, v]) => form.set(k, v));
  return { action, writes, form };
}
test('profile changes deny worker, suspended, self, admin elsewhere, platform target and cross-station access', async () => {
  for (const options of [
    { role: 'WORKER' },
    { status: 'SUSPENDED' },
    { self: true },
    { targetRole: 'ADMIN' },
    { otherAdmin: true },
    { targetPlatform: true },
  ]) {
    const h = harness(options);
    assert.equal((await h.action('station', 'member', h.form)).success, false);
    assert.equal(h.writes.length, 0);
  }
  const h = harness();
  assert.equal((await h.action('other', 'member', h.form)).success, false);
  assert.equal(h.writes.length, 0);
});
test('authorized edits normalize identifiers, leave blank passwords unchanged, and update employee code', async () => {
  for (const options of [{}, { platform: true, otherAdmin: true, targetRole: 'ADMIN' }]) {
    const h = harness(options);
    assert.equal((await h.action('station', 'member', h.form)).success, true);
    assert.equal(h.writes[0][2].phone, '+972501234567');
    assert.equal(h.writes[0][2].email, 'worker@example.com');
    assert.equal(h.writes[0][2].password, undefined);
    assert.equal(h.writes[1][1].employee_code, 'W-1');
  }
});
test('invalid data and duplicate credentials fail without false success; partial code failure is explicit', async () => {
  let h = harness();
  h.form.set('phone', 'invalid');
  assert.equal((await h.action('station', 'member', h.form)).success, false);
  assert.equal(h.writes.length, 0);
  h = harness({ authError: true });
  assert.equal((await h.action('station', 'member', h.form)).success, false);
  assert.equal(h.writes.length, 1);
  h = harness({ codeError: true });
  const r = await h.action('station', 'member', h.form);
  assert.equal(r.success, false);
  assert.match(r.error, /פרטי החשבון נשמרו/);
});

for (const app of ['web', 'admin']) {
  test(`${app} login enforces the selected method and explains disabled phone auth`, async () => {
    let calls = 0;
    const action = load(`../apps/${app}/app/actions/auth.ts`, {
      'next/headers': { cookies: async () => ({}) },
      'next/navigation': { redirect: () => assert.fail('Must not redirect on failure') },
      '@yellowshifts/database': {
        ...identifiers,
        safeNextPath: (p) => p,
        createServerSupabaseClient: () => ({
          auth: {
            signInWithPassword: async () => {
              calls++;
              return { error: { code: 'phone_provider_disabled', status: 400 } };
            },
          },
        }),
      },
    }).loginAction;
    const form = new FormData();
    form.set('method', 'phone');
    form.set('identifier', 'worker@example.com');
    form.set('password', 'unchanged-password');
    assert.equal((await action(null, form)).success, false);
    assert.equal(calls, 0);
    form.set('identifier', '0501234567');
    assert.match((await action(null, form)).error, /אפשר להתחבר באימייל/);
    assert.equal(calls, 1);
  });
}
