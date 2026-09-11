import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function harness(role = 'SHIFT_MANAGER', status = 'ACTIVE', platform = false) {
  const writes = [];
  const deps = {
    'next/headers': { cookies: async () => ({}) },
    'next/cache': { revalidatePath() {} },
    '@yellowshifts/database': {
      createServerSupabaseClient: () => ({}),
      getAuthenticatedUserContext: async () => ({
        user: { id: 'actor' },
        isPlatformAdmin: platform,
        memberships: [{ station: { id: 'station' }, membership: { role, status } }],
      }),
      updateScheduleStatus: async (...args) => writes.push(args),
      revertScheduleToDraft: async (...args) => writes.push(args),
      rotateStationNfcToken: async () => {
        writes.push('rotate');
        return { success: true };
      },
      adminCorrectAttendance: async () => {
        writes.push('correct');
        return { success: true };
      },
    },
  };
  const load = (path) => {
    const exports = {};
    runInNewContext(
      ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      { exports, FormData, require: (n) => deps[n] }
    );
    return exports;
  };
  return {
    schedules: load('../apps/admin/app/actions/schedules.ts'),
    attendance: load('../apps/admin/app/actions/attendance.ts'),
    writes,
  };
}
test('active shift managers publish and reopen their station schedules, but cannot archive', async () => {
  const h = harness();
  assert.equal(
    (await h.schedules.updateScheduleStatusAction('station', 'schedule', 'PUBLISHED')).success,
    true
  );
  assert.equal(
    (await h.schedules.revertScheduleToDraftAction('station', 'schedule')).success,
    true
  );
  assert.equal(
    (await h.schedules.updateScheduleStatusAction('station', 'schedule', 'ARCHIVED')).success,
    false
  );
  assert.equal(h.writes.length, 2);
});
test('worker, inactive and other-station scheduling is denied', async () => {
  for (const [role, status, station] of [
    ['WORKER', 'ACTIVE', 'station'],
    ['SHIFT_MANAGER', 'SUSPENDED', 'station'],
    ['SHIFT_MANAGER', 'ACTIVE', 'other'],
  ]) {
    const h = harness(role, status);
    assert.equal(
      (await h.schedules.updateScheduleStatusAction(station, 'schedule', 'PUBLISHED')).success,
      false
    );
    assert.equal(h.writes.length, 0);
  }
});
test('attendance administration is denied to shift managers and suspended station admins', async () => {
  for (const [role, status] of [
    ['SHIFT_MANAGER', 'ACTIVE'],
    ['ADMIN', 'SUSPENDED'],
  ]) {
    const h = harness(role, status);
    assert.equal((await h.attendance.rotateNfcTokenAction('station')).success, false);
    assert.equal(
      (await h.attendance.adminCorrectAttendanceAction({ stationId: 'station' })).success,
      false
    );
    assert.equal(h.writes.length, 0);
  }
});
test('station and platform admins retain publishing and archiving control', async () => {
  for (const [role, platform] of [
    ['ADMIN', false],
    ['WORKER', true],
  ]) {
    const h = harness(role, 'ACTIVE', platform);
    assert.equal(
      (await h.schedules.updateScheduleStatusAction('station', 'schedule', 'ARCHIVED')).success,
      true
    );
  }
});
