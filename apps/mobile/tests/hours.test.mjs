import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function load(path, mocks = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require: (n) => mocks[n] }
  );
  return exports;
}
const reports = load('../../../packages/reports/src/hours-report.ts');
const rates = load('../../../packages/reports/src/rates.ts', { './hours-report': reports });
const shifts = load('../../../packages/reports/src/shift-report.ts', {
  './hours-report': reports,
  './rates': rates,
});
const model = load('../src/hours/model.ts', { '@yellowshifts/reports': reports });
const helper = (
  context = { userId: 'own', stations: [{ id: 'station', timezone: 'Asia/Jerusalem' }] },
  query = {}
) =>
  load('../../../packages/database/src/mobile-hours.ts', {
    '@yellowshifts/reports': { ...reports, ...rates, ...shifts },
    './worker-context': {
      getNativeWorkerContext: async (client) => {
        const {
          data: { user },
        } = await client.auth.getUser();
        if (!user || user.id !== context.userId) throw Error('invalid identity');
        return context;
      },
    },
    './hours-query': query,
  });
const { hoursRange } = helper();
test('period ranges honor policy weekday, month leap boundary and exact custom limit', () => {
  assert.equal(hoursRange({ mode: 'week' }, '2026-09-13', 0).from, '2026-09-13');
  assert.equal(hoursRange({ mode: 'week' }, '2026-09-13', 1).from, '2026-09-07');
  assert.equal(hoursRange({ mode: 'month' }, '2024-02-15').to, '2024-02-29');
  assert.equal(
    hoursRange({ mode: 'custom', from: '2026-06-01', to: '2026-09-01' }, '2026-09-13').to,
    '2026-09-01'
  );
  for (const range of [
    { from: '2026-06-01', to: '2026-09-02' },
    { from: '2026-02-30', to: '2026-03-01' },
    { from: '2026-09-14', to: '2026-09-14' },
    { from: '2026-09-13', to: '2026-09-12' },
  ])
    assert.throws(() => hoursRange({ mode: 'custom', ...range }, '2026-09-13'));
});
test('period movement does not reverse chronology or overflow short months', () => {
  assert.equal(model.movePeriod({ mode: 'month' }, '2026-01-01', 1).anchor, '2026-02-01');
  assert.equal(model.movePeriod({ mode: 'week' }, '2026-09-07', -1).anchor, '2026-08-31');
  assert.equal(model.movePeriod({ mode: 'week' }, '2026-09-07', 1).anchor, '2026-09-14');
});
const record = (id, start, end, extra = {}) => ({
  id,
  user_id: 'own',
  station_membership_id: 'member',
  clock_in_at: start,
  clock_out_at: end,
  status: 'COMPLETED',
  corrected_at: null,
  correction_reason: null,
  ...extra,
});
const policy = [
  {
    id: '1',
    effectiveFrom: '2020-01-01',
    rules: {
      dailyMinutes: Array(7).fill(480),
      weeklyMinutes: 2520,
      firstOvertimeMinutes: 120,
      firstRate: 125,
      secondRate: 150,
      weekStartsOn: 1,
      breakMinutes: 30,
      breakAfterMinutes: 360,
      restDays: [],
      restRate: 150,
      holidays: [],
      holidayRate: 150,
      nightStart: 0,
      nightEnd: 0,
      nightRate: 100,
    },
  },
];
test('presentation aggregates exact shared classification, breaks, corrections and distinct shifts', () => {
  const rows = rates.classifiedEntries(
    [
      record('a', '2026-09-07T04:00Z', '2026-09-07T16:00Z', {
        corrected_at: '2026-09-08T00:00Z',
        correction_reason: 'תיקון כניסה',
      }),
    ],
    '2026-09-07',
    '2026-09-13',
    'Asia/Jerusalem',
    policy,
    Date.parse('2026-09-14T00:00Z')
  );
  const total = model.summarize(rows);
  assert.equal(total.seconds, 12 * 3600);
  assert.equal(total.breaks, 1800);
  assert.equal(total.rates['100'], 8 * 3600);
  assert.equal(total.rates['125'], 2 * 3600);
  assert.equal(total.rates['150'], 1.5 * 3600);
  assert.equal(model.groupDays(rows, 1)[0].entries[0].reason, 'תיקון כניסה');
  assert.equal(total.shifts, 1);
});
test('overnight and multiple segments remain shared-engine days, counted once per shift', () => {
  const rows = rates.classifiedEntries(
    [
      record('a', '2026-09-07T19:00Z', '2026-09-08T03:00Z'),
      record('b', '2026-09-08T10:00Z', '2026-09-08T12:00Z'),
    ],
    '2026-09-07',
    '2026-09-13',
    'Asia/Jerusalem',
    [],
    Date.parse('2026-09-14T00:00Z')
  );
  assert.equal(model.summarize(rows).seconds, 36000);
  assert.equal(model.summarize(rows).shifts, 2);
  assert.equal(model.groupDays(rows, 1).length, 2);
  assert.equal(model.groupDays(rows, 1)[0].entries.length, 2);
});
test('DST elapsed duration, open and flagged exclusions stay authoritative', () => {
  const rows = rates.classifiedEntries(
    [
      record('a', '2026-03-26T22:00Z', '2026-03-27T05:00Z'),
      record('b', '2026-03-28T08:00Z', null, { status: 'ACTIVE' }),
      record('c', '2026-03-27T12:00Z', '2026-03-27T13:00Z', { status: 'FLAGGED' }),
    ],
    '2026-03-23',
    '2026-03-29',
    'Asia/Jerusalem',
    [],
    Date.parse('2026-04-01T00:00Z')
  );
  assert.equal(model.summarize(rows).seconds, 7 * 3600);
  assert.equal(model.summarize(rows).excluded.length, 2);
  assert.equal(model.summarize([]).seconds, 0);
});
const activeQuery = {
  select() {
    return this;
  },
  eq() {
    return this;
  },
  is() {
    return this;
  },
  async maybeSingle() {
    return { data: null, error: null };
  },
};
const client = {
  from: () => activeQuery,
  auth: { getUser: async () => ({ data: { user: { id: 'own' } } }) },
};
test('mobile query derives own identity, authorized station and includes threshold lookback', async () => {
  let call;
  const h = helper(undefined, {
    getHourPolicies: async () => policy,
    readOwnReportAttendance: async (...args) => {
      call = args;
      return [];
    },
  });
  const result = await h.getMobileWorkerHours(client, 'station', {
    mode: 'custom',
    from: '2026-01-12',
    to: '2026-01-18',
  });
  assert.equal(call[1], 'own');
  assert.equal(call[2], 'station');
  assert.equal(call[3], '2026-01-04T22:00:00.000Z');
  assert.equal(result.entries.length, 0);
});
test('unauthorized station, inactive membership and missing identity never read reports', async () => {
  let reads = 0;
  const h = helper(
    { userId: 'own', stations: [] },
    {
      getHourPolicies: async () => {
        reads++;
        return [];
      },
    }
  );
  await assert.rejects(
    h.getMobileWorkerHours(client, 'station', { mode: 'week' }),
    h.HoursScopeError
  );
  await assert.rejects(
    h.getMobileWorkerHours(
      { auth: { getUser: async () => ({ data: { user: null } }) } },
      'station',
      { mode: 'week' }
    ),
    h.HoursScopeError
  );
  assert.equal(reads, 0);
});
test('classification/rule failures do not become a zero-hour report', async () => {
  const h = helper(undefined, {
    getHourPolicies: async () => {
      throw Error('offline');
    },
  });
  await assert.rejects(h.getMobileWorkerHours(client, 'station', { mode: 'week' }), /offline/);
});
test('overnight shift remains one complete record without leaking lookback sessions', async () => {
  const rows = [
    record('visible', '2026-01-12T20:00Z', '2026-01-13T04:00Z'),
    record('lookback', '2026-01-06T08:00Z', '2026-01-06T09:00Z'),
  ];
  const h = helper(undefined, {
    getHourPolicies: async () => [],
    readOwnReportAttendance: async () => rows,
  });
  const result = await h.getMobileWorkerHours(client, 'station', {
    mode: 'custom',
    from: '2026-01-12',
    to: '2026-01-13',
  });
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].end, '2026-01-13T04:00Z');
  assert.equal(result.entries[0].seconds, 8 * 3600);
  assert.equal(result.sessions.visible.end, '2026-01-13T04:00Z');
  assert.equal(result.sessions.lookback, undefined);
});
test('active attendance is read for the selected station even during a historical period', async () => {
  const filters = [];
  const ownClient = {
    ...client,
    from: (table) => ({
      select() {
        assert.equal(table, 'attendance_records');
        return this;
      },
      eq(k, v) {
        filters.push([k, v]);
        return this;
      },
      is() {
        return this;
      },
      async maybeSingle() {
        return { data: { clock_in_at: '2026-09-13T08:00Z' } };
      },
    }),
  };
  const h = helper(undefined, {
    getHourPolicies: async () => [],
    readOwnReportAttendance: async () => [],
  });
  const result = await h.getMobileWorkerHours(ownClient, 'station', {
    mode: 'custom',
    from: '2026-01-12',
    to: '2026-01-18',
  });
  assert.equal(result.active.start, '2026-09-13T08:00Z');
  assert.equal(model.summarize(result.entries).seconds, 0);
  assert.deepEqual(filters, [
    ['user_id', 'own'],
    ['station_id', 'station'],
    ['status', 'ACTIVE'],
  ]);
});
