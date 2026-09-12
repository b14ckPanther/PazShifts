import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function setup({ allowed = true, failed = false, overflow = false } = {}) {
  const calls = [],
    exports = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL('../../../packages/database/src/mobile-home.ts', import.meta.url),
        'utf8'
      ),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } }
    ).outputText,
    {
      exports,
      require(name) {
        if (name === './worker-context')
          return {
            getNativeWorkerContext: async () => ({
              stations: allowed
                ? [{ id: 'a', membershipId: 'member-a', timezone: 'Asia/Jerusalem', name: 'תחנה' }]
                : [],
            }),
          };
        if (name === '@yellowshifts/reports')
          return {
            localDate: () => '2026-09-13',
            weekStart: () => '2026-09-07',
            addDays: (d, days) =>
              new Date(Date.parse(d) + days * 86400000).toISOString().slice(0, 10),
            dayBoundary: (d) => Date.parse(d),
            buildEntries: () => [
              { id: '1', status: 'הושלמה', seconds: 3600, date: '2026-09-13' },
              { id: '2', status: 'פתוחה', seconds: 9999, date: '2026-09-13' },
            ],
          };
        throw Error(name);
      },
    }
  );
  const client = {
    from(table) {
      const filters = [];
      calls.push({ table, filters });
      const query = {};
      for (const method of ['select', 'eq', 'gte', 'lt', 'or', 'order', 'limit'])
        query[method] = (...args) => {
          filters.push([method, ...args]);
          return query;
        };
      query.maybeSingle = () => {
        query.single = true;
        return query;
      };
      query.then = (resolve) =>
        Promise.resolve({
          data: query.single ? null : overflow ? Array(301).fill({}) : [],
          error: failed ? Error('db') : null,
        }).then(resolve);
      return query;
    },
  };
  return {
    calls,
    read: () => exports.getMobileHome(client, 'worker-a', 'a', Date.parse('2026-09-13T09:00Z')),
  };
}
test('unauthorized station is rejected before any home query', async () => {
  const s = setup({ allowed: false });
  await assert.rejects(s.read());
  assert.equal(s.calls.length, 0);
});
test('published assignments and own attendance are bounded and scoped; open hours excluded', async () => {
  const s = setup();
  const result = await s.read();
  assert.equal(result.confirmedSeconds, 3600);
  assert.equal(result.reviewCount, 1);
  assert.equal(result.availabilitySubmitted, false);
  const assignments = s.calls[0].filters;
  assert.ok(assignments.some((f) => f[1] === 'station_membership_id' && f[2] === 'member-a'));
  assert.ok(
    assignments.some((f) => f[1] === 'scheduled_shifts.schedules.status' && f[2] === 'PUBLISHED')
  );
  for (const call of s.calls.filter((c) => c.table === 'attendance_records'))
    assert.ok(call.filters.some((f) => f[1] === 'user_id' && f[2] === 'worker-a'));
  assert.ok(s.calls[3].filters.some((f) => f[1] === 'station_id' && f[2] === 'a'));
  assert.ok(s.calls[3].filters.some((f) => f[0] === 'limit' && f[1] === 301));
});
test('query failures and oversized results cannot become partial or misleading summaries', async () => {
  await assert.rejects(setup({ failed: true }).read());
  await assert.rejects(setup({ overflow: true }).read());
});
