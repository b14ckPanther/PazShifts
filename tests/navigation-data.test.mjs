import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const ts = createRequire(import.meta.url)('typescript');
function load(path) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports }
  );
  return exports;
}
test('authenticated context starts its three independent reads together', async () => {
  const { getAuthenticatedUserContext } = load('../packages/database/src/auth.ts');
  const started = [];
  let release;
  const gate = new Promise((r) => (release = r));
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user' } }, error: null }) },
    from(table) {
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        maybeSingle() {
          return q;
        },
        then(resolve, reject) {
          started.push(table);
          return gate
            .then(() => ({ data: table === 'station_memberships' ? [] : null }))
            .then(resolve, reject);
        },
      };
      return q;
    },
  };
  const result = getAuthenticatedUserContext(client);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(started.sort(), ['platform_admins', 'profiles', 'station_memberships']);
  release();
  assert.equal((await result).user.id, 'user');
  const denied = await getAuthenticatedUserContext({
    auth: { getUser: async () => ({ data: { user: null }, error: {} }) },
    from() {
      assert.fail('No profile reads without authentication');
    },
  });
  assert.equal(denied, null);
});
test('weekly schedule uses one read and retains date/time ordering and assignment mapping', async () => {
  const { getWeeklySchedule } = load('../packages/database/src/schedules.ts');
  let reads = 0;
  const shift = (id, day, start) => ({
    id,
    shift_date: day,
    start_at: start,
    shift_assignments: [],
    shift_templates: { name: 'בוקר' },
  });
  const data = {
    id: 'week',
    station_id: 'station',
    week_start_date: '2026-09-07',
    status: 'PUBLISHED',
    scheduled_shifts: [
      shift('later', '2026-09-08', '2026-09-08T10:00:00Z'),
      shift('early', '2026-09-07', '2026-09-07T06:00:00Z'),
    ],
  };
  const client = {
    from(table) {
      reads++;
      assert.equal(table, 'schedules');
      const q = {
        select(value) {
          assert(value.includes('scheduled_shifts'));
          return q;
        },
        eq() {
          return q;
        },
        single: async () => ({ data, error: null }),
      };
      return q;
    },
  };
  const result = await getWeeklySchedule(client, 'station', '2026-09-07');
  assert.equal(reads, 1);
  assert.deepEqual(
    Array.from(result.shifts, (s) => s.id),
    ['early', 'later']
  );
  assert.equal(result.status, 'PUBLISHED');
});
