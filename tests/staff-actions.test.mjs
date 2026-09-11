import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(path, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(source, {
    exports,
    FormData,
    console,
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}
const { canManageMember } = load('../packages/database/src/member-permissions.ts');

function harness({
  platform = false,
  actorRole = 'ADMIN',
  actorStatus = 'ACTIVE',
  targetRole = 'WORKER',
  self = false,
  mutationError = false,
} = {}) {
  const writes = [];
  const context = {
    user: { id: 'actor', email: 'actor@example.com' },
    isPlatformAdmin: platform,
    memberships: [
      { station: { id: 'station' }, membership: { role: actorRole, status: actorStatus } },
    ],
  };
  const mutation = async (...args) => {
    writes.push(args);
    if (mutationError) throw new Error('secret internal database constraint name');
    return { id: 'station' };
  };
  const actions = load('../apps/admin/app/actions/stations.ts', {
    'next/headers': { cookies: async () => ({}) },
    'next/cache': { revalidatePath() {} },
    '@yellowshifts/database': {
      createServerSupabaseClient: () => ({}),
      getAuthenticatedUserContext: async () => context,
      canManageMember,
      getStationMemberById: async (_client, stationId) =>
        stationId === 'station'
          ? {
              membership: { userId: self ? 'actor' : 'target', role: targetRole, status: 'ACTIVE' },
            }
          : null,
      createStation: mutation,
      updateStation: mutation,
      toggleStationStatus: mutation,
      assignStationMember: mutation,
      removeStationMember: mutation,
      updateStationMemberRole: mutation,
      updateStationMemberStatus: mutation,
      createAdminClient: () => ({
        auth: {
          admin: {
            createUser: async () => ({
              data: { user: null },
              error: { message: 'already exists' },
            }),
            updateUserById: () => {
              throw new Error('Must never reset an existing account');
            },
          },
        },
      }),
    },
  });
  return { actions, writes };
}

test('station admin can promote and demote subordinate staff', async () => {
  for (const [targetRole, requested] of [
    ['WORKER', 'SHIFT_MANAGER'],
    ['SHIFT_MANAGER', 'WORKER'],
  ]) {
    const { actions, writes } = harness({ targetRole });
    assert.equal(
      (await actions.updateMemberRoleAction('station', 'member', requested)).success,
      true
    );
    assert.equal(writes.length, 1);
  }
});

test('protected accounts, self, inactive admins, workers and cross-station actions cannot mutate', async () => {
  for (const options of [
    { targetRole: 'ADMIN' },
    { self: true },
    { actorStatus: 'INACTIVE' },
    { actorRole: 'WORKER' },
  ]) {
    const { actions, writes } = harness(options);
    for (const stationId of ['station', 'other-station']) {
      assert.equal(
        (await actions.updateMemberRoleAction(stationId, 'member', 'WORKER')).success,
        false
      );
      assert.equal(
        (await actions.updateMemberStatusAction(stationId, 'member', 'INACTIVE')).success,
        false
      );
      assert.equal((await actions.removeStationMemberAction(stationId, 'member')).success, false);
    }
    assert.equal(writes.length, 0);
  }
});

test('only super admins may appoint station admins or create/edit stations', async () => {
  const { actions, writes } = harness();
  assert.equal(
    (
      await actions.assignStationMemberAction({
        stationId: 'station',
        userId: 'target',
        role: 'ADMIN',
      })
    ).success,
    false
  );
  assert.equal((await actions.updateMemberRoleAction('station', 'member', 'ADMIN')).success, false);
  assert.equal(
    (await actions.createStationAction({ code: 'NEW', name: 'New station' })).success,
    false
  );
  assert.equal((await actions.updateStationAction('station', { name: 'Changed' })).success, false);
  assert.equal(writes.length, 0);
  const superAdmin = harness({ platform: true, targetRole: 'ADMIN' });
  assert.equal(
    (await superAdmin.actions.updateMemberRoleAction('station', 'member', 'WORKER')).success,
    true
  );
  assert.equal(
    (
      await superAdmin.actions.assignStationMemberAction({
        stationId: 'station',
        userId: 'target',
        role: 'ADMIN',
      })
    ).success,
    true
  );
});

test('new-account flow rejects existing users without resetting credentials or assigning membership', async () => {
  const { actions, writes } = harness();
  const result = await actions.assignStationMemberAction({
    stationId: 'station',
    role: 'WORKER',
    createNewUser: true,
    userEmail: 'existing@example.com',
    fullName: 'Existing Person',
    password: 'fixture-password',
  });
  assert.equal(result.success, false);
  assert.equal(writes.length, 0);
});

test('database errors are not returned as technical messages to users', async () => {
  const { actions } = harness({ mutationError: true });
  const result = await actions.removeStationMemberAction('station', 'member');
  assert.equal(result.success, false);
  assert.ok(!result.error.includes('constraint'));
  assert.ok(!result.error.includes('secret'));
});

test('ending access updates status without deleting historical membership', async () => {
  const { removeStationMember } = load('../packages/database/src/stations.ts');
  const writes = [];
  const query = {
    update(value) {
      writes.push(value);
      return this;
    },
    eq() {
      return this;
    },
    select() {
      return this;
    },
    single: async () => ({
      data: {
        id: 'member',
        station_id: 'station',
        user_id: 'worker',
        role: 'WORKER',
        status: 'INACTIVE',
      },
      error: null,
    }),
  };
  await removeStationMember({ from: () => query }, 'member', 'station');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].status, 'INACTIVE');
});

test('assigning a user inserts membership, never overwrites a protected existing role', async () => {
  const { assignStationMember } = load('../packages/database/src/stations.ts');
  const query = {
    insert() {
      return this;
    },
    select() {
      return this;
    },
    single: async () => ({ data: null, error: { code: '23505', message: 'duplicate membership' } }),
  };
  await assert.rejects(() =>
    assignStationMember(
      { from: () => query },
      { stationId: 'station', userId: 'existing-admin', role: 'WORKER' }
    )
  );
});
