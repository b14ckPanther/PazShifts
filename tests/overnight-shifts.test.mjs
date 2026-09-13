import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function load(file, mocks = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL('../packages/' + file, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require: (n) => mocks[n] }
  );
  return exports;
}
const h = load('reports/src/hours-report.ts'),
  rates = load('reports/src/rates.ts', { './hours-report': h });
const { shiftReportEntries } = load('reports/src/shift-report.ts', {
  './hours-report': h,
  './rates': rates,
});
const record = (overrides = {}) => ({
  id: 'night',
  user_id: 'worker',
  station_membership_id: 'member',
  station_id: 'curdani',
  clock_in_at: '2026-09-12T19:00:00Z',
  clock_out_at: '2026-09-13T06:00:00Z',
  status: 'COMPLETED',
  clock_in_source: 'NFC',
  clock_out_source: 'MANUAL_ADMIN',
  corrected_at: '2026-09-13T11:00:00Z',
  correction_reason: 'Corrected checkout',
  ...overrides,
});
const now = Date.parse('2026-11-01T12:00:00Z');
const report = (rows, from = '2026-09-12', to = from, policies = []) =>
  shiftReportEntries(rows, from, to, 'Asia/Jerusalem', policies, now);
test('22:00–09:00 is one 11-hour corrected shift attributed entirely to Saturday', () => {
  const entries = report([record()]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].seconds, 39600);
  assert.equal(entries[0].date, '2026-09-12');
  assert.equal(entries[0].start, record().clock_in_at);
  assert.equal(entries[0].end, record().clock_out_at);
  assert.equal(entries[0].reason, 'Corrected checkout');
  assert.equal(report([record()], '2026-09-13').length, 0);
  assert.equal(report([record()], '2026-09-12', '2026-09-13').length, 1);
});
test('22:00–06:00 stays eight hours across month boundary, without duplicate next-day totals', () => {
  const r = record({ clock_in_at: '2026-08-31T19:00:00Z', clock_out_at: '2026-09-01T03:00:00Z' });
  assert.equal(report([r], '2026-08-31')[0].seconds, 28800);
  assert.equal(report([r], '2026-09-01').length, 0);
});
test('DST overnight uses real elapsed duration rather than subtracting displayed clock times', () => {
  const r = record({ clock_in_at: '2026-10-24T19:00:00Z', clock_out_at: '2026-10-25T04:00:00Z' });
  assert.equal(report([r], '2026-10-24')[0].seconds, 9 * 3600);
});
test('grouping preserves rate classification, policies and exactly one break deduction', () => {
  const rules = {
    dailyMinutes: Array(7).fill(480),
    firstOvertimeMinutes: 120,
    firstRate: 125,
    secondRate: 150,
    weeklyMinutes: 2520,
    weekStartsOn: 0,
    breakMinutes: 30,
    breakAfterMinutes: 360,
    nightStart: 1320,
    nightEnd: 360,
    nightRate: 125,
    restDays: [6],
    restRate: 150,
    holidays: [],
    holidayRate: 150,
  };
  const policies = [
    { id: 'a', effectiveFrom: '2026-01-01', createdAt: '2026-01-01', rules },
    { id: 'b', effectiveFrom: '2026-09-13', createdAt: '2026-01-01', rules },
  ];
  const split = rates.classifiedEntries(
    [record()],
    '2026-09-12',
    '2026-09-13',
    'Asia/Jerusalem',
    policies,
    now
  );
  const whole = report([record()], '2026-09-12', '2026-09-12', policies);
  assert.deepEqual({ ...h.rateTotals(whole) }, { ...h.rateTotals(split) });
  assert.equal(whole[0].breakSeconds, 1800);
  assert.equal(whole[0].seconds, 39600);
  assert.equal(whole[0].policyId, 'a;b');
});
test('open, flagged, future-ended and overlapping records remain excluded', () => {
  for (const change of [
    { status: 'ACTIVE', clock_out_at: null },
    { status: 'FLAGGED' },
    { clock_out_at: '2027-01-01T00:00Z' },
  ])
    assert.equal(report([record(change)])[0].seconds, 0);
  const rows = report([
    record(),
    record({ id: 'overlap', clock_in_at: '2026-09-13T05:00Z', clock_out_at: '2026-09-13T08:00Z' }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].seconds, 0);
  assert.match(rows[0].status, /חפיפה/);
});
test('two distinct shifts on a start date remain two records', () => {
  const entries = report([
    record(),
    record({ id: 'day', clock_in_at: '2026-09-12T04:00Z', clock_out_at: '2026-09-12T12:00Z' }),
  ]);
  assert.equal(entries.length, 2);
  assert.equal(
    entries.reduce((n, e) => n + e.seconds, 0),
    19 * 3600
  );
});
test('report query extends context past midnight while keeping user and station filters', async () => {
  const seen = [];
  const { readOwnReportAttendance } = load('database/src/hours-query.ts');
  const client = {
    from() {
      const calls = [];
      const q = {
        eq: (...a) => {
          calls.push(a);
          return q;
        },
        select: () => q,
        lt: (...a) => {
          calls.push(a);
          return q;
        },
        or: () => q,
        order: () => q,
        range: async () => {
          seen.push(calls);
          return { data: [record()], error: null };
        },
      };
      return q;
    },
  };
  await readOwnReportAttendance(
    client,
    'worker',
    'curdani',
    '2026-09-11T21:00Z',
    '2026-09-12T21:00Z'
  );
  assert.equal(seen.length, 2);
  for (const calls of seen) {
    assert.ok(calls.some((a) => a[0] === 'user_id' && a[1] === 'worker'));
    assert.ok(calls.some((a) => a[0] === 'station_id' && a[1] === 'curdani'));
  }
  assert.ok(seen[1].some((a) => a[0] === 'clock_in_at' && a[1] === '2026-09-13T06:00:00.000Z'));
});
test('Home keeps selected-station totals scoped and exposes latest closed shift from another authorized station', async () => {
  const calls = [];
  const stations = [
    { id: 'ata', membershipId: 'a', name: 'Ata', timezone: 'Asia/Jerusalem' },
    { id: 'curdani', membershipId: 'c', name: 'Curdani', timezone: 'Asia/Jerusalem' },
  ];
  const { getMobileHome } = load('database/src/mobile-home.ts', {
    '@yellowshifts/reports': { ...h, shiftReportEntries },
    './worker-context': { getNativeWorkerContext: async () => ({ stations }) },
    './hours-query': {
      readOwnReportAttendance: async (_c, user, station) => {
        assert.equal(user, 'worker');
        assert.equal(station, 'ata');
        return [];
      },
    },
  });
  const client = {
    from(table) {
      const filters = [];
      const q = {
        select: () => q,
        eq: (...a) => {
          filters.push(a);
          return q;
        },
        in: (...a) => {
          filters.push(a);
          return q;
        },
        gte: () => q,
        lte: () => q,
        lt: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: () => q,
        then: (resolve) => {
          calls.push({ table, filters });
          return Promise.resolve(
            resolve({
              data:
                table === 'shift_assignments'
                  ? []
                  : table === 'availability_weeks'
                    ? null
                    : filters.some((a) => a[1] === 'COMPLETED')
                      ? record()
                      : null,
              error: null,
            })
          );
        },
      };
      return q;
    },
  };
  const data = await getMobileHome(client, 'worker', 'ata', Date.parse('2026-09-13T14:00Z'));
  assert.equal(data.confirmedSeconds, 0);
  assert.equal(data.latestClosed.seconds, 39600);
  assert.equal(data.latestClosed.date, '2026-09-12');
  assert.equal(data.latestClosed.stationId, 'curdani');
  assert.equal(data.latestClosed.corrected, true);
  const recent = calls.find((c) => c.filters.some((a) => a[1] === 'COMPLETED'));
  assert.ok(recent.filters.some((a) => a[0] === 'user_id' && a[1] === 'worker'));
  assert.deepEqual(Array.from(recent.filters.find((a) => a[0] === 'station_id')[1]), [
    'ata',
    'curdani',
  ]);
});
