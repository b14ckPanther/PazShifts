import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const ts = createRequire(import.meta.url)('typescript');
function load(path, mocks = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      fileName: path,
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { exports, require: (n) => mocks[n] }
  );
  return exports;
}
const helpers = load('../packages/reports/src/hours-report.ts');
const record = (overrides = {}) => ({
  id: 'r',
  user_id: 'u',
  station_membership_id: 'm',
  clock_in_at: '2026-09-07T20:00:00Z',
  clock_out_at: '2026-09-08T02:00:00Z',
  status: 'COMPLETED',
  clock_in_source: 'NFC',
  clock_out_source: 'NFC',
  ...overrides,
});
test('overnight attendance splits at station midnight and clips to selected period', () => {
  const rows = helpers.buildEntries(
    [record()],
    '2026-09-07',
    '2026-09-08',
    'Asia/Jerusalem',
    Date.parse('2026-10-01')
  );
  assert.deepEqual(
    Array.from(rows, (e) => [e.date, e.seconds]),
    [
      ['2026-09-07', 3600],
      ['2026-09-08', 18000],
    ]
  );
  assert.equal(
    helpers.buildEntries(
      [record()],
      '2026-09-08',
      '2026-09-08',
      'Asia/Jerusalem',
      Date.parse('2026-10-01')
    )[0].seconds,
    18000
  );
});
test('DST uses elapsed time, not wall clock subtraction', () => {
  const a = helpers.dayBoundary('2026-03-27', 'Asia/Jerusalem');
  const b = helpers.dayBoundary('2026-03-28', 'Asia/Jerusalem');
  assert.equal(b - a, 23 * 3600000);
  const c = helpers.dayBoundary('2026-10-25', 'Asia/Jerusalem');
  const d = helpers.dayBoundary('2026-10-26', 'Asia/Jerusalem');
  assert.equal(d - c, 25 * 3600000);
});
test('open, flagged, future and overlapping records never inflate totals', () => {
  for (const change of [
    { status: 'ACTIVE', clock_out_at: null },
    { status: 'FLAGGED' },
    { clock_out_at: '2027-01-01T00:00:00Z' },
  ])
    assert.equal(
      helpers.buildEntries(
        [record(change)],
        '2026-09-07',
        '2026-09-08',
        'Asia/Jerusalem',
        Date.parse('2026-10-01')
      )[0].seconds,
      0
    );
  const rows = helpers.buildEntries(
    [record(), record({ id: 'r2' })],
    '2026-09-07',
    '2026-09-08',
    'Asia/Jerusalem',
    Date.parse('2026-10-01')
  );
  assert.equal(
    rows.reduce((s, e) => s + e.seconds, 0),
    0
  );
});
test('CSV is Excel UTF-8, escapes formulas/quotes and keeps only PDF-level detail', () => {
  const report = {
    station: 'תחנה',
    timezone: 'Asia/Jerusalem',
    from: '2026-09-07',
    to: '2026-09-07',
    people: [{ id: 'one', name: '=SUM(A1)', code: '"code"' }],
    entries: [],
  };
  const csv = helpers.reportCsv(report);
  assert(csv.startsWith('\ufeff'));
  assert.deepEqual(csv.slice(1).split('\r\n'), [
    '"תאריך","יום","כניסה","יציאה","שעות","100%","125%","150%","הערה"',
    '"סה״כ","","","","0.00","","","",""',
  ]);
  const team = {
    ...report,
    people: [...report.people, { id: 'two', name: 'לוי "הקטן"', code: '' }],
    entries: helpers.buildEntries(
      [
        record({ station_membership_id: 'one' }),
        record({
          id: 'r2',
          user_id: 'v',
          station_membership_id: 'two',
          status: 'ACTIVE',
          clock_out_at: null,
        }),
      ],
      '2026-09-07',
      '2026-09-08',
      'Asia/Jerusalem',
      Date.parse('2026-10-01')
    ),
    to: '2026-09-08',
  };
  const detail = helpers.reportCsv(team).slice(1).split('\r\n');
  assert.deepEqual(detail, [
    '"עובד","תאריך","יום","כניסה","יציאה","שעות","100%","125%","150%","הערה"',
    '"\'=SUM(A1)","07/09/2026","ב׳","23:00","00:00","1.00","1.00","","",""',
    '"\'=SUM(A1)","08/09/2026","ג׳","00:00","05:00","5.00","5.00","","",""',
    '"\'=SUM(A1)","סה״כ","","","","6.00","6.00","","",""',
    '"לוי ""הקטן""","07/09/2026","ב׳","23:00","—","—","","","","משמרת פתוחה · לא נספרה"',
    '"לוי ""הקטן""","סה״כ","","","","0.00","","","",""',
  ]);
  assert(!/code|one|two|Asia|NFC|T\d\d:/.test(detail.join()));
  assert.deepEqual(helpers.summaryCsv(team).slice(1).split('\r\n'), [
    '"עובד","תאריך","יום","שעות","100%","125%","150%"',
    '"\'=SUM(A1)","07/09/2026","ב׳","1.00","1.00","",""',
    '"\'=SUM(A1)","08/09/2026","ג׳","5.00","5.00","",""',
    '"\'=SUM(A1)","סה״כ","","6.00","6.00","",""',
    '"לוי ""הקטן""","07/09/2026","ב׳","0.00","","",""',
    '"לוי ""הקטן""","סה״כ","","0.00","","",""',
  ]);
});
test('report pagination fetches all rows past Supabase default 1000 and scopes every query', async () => {
  const { readReportAttendance } = load('../packages/database/src/hours-query.ts');
  const ranges = [];
  const client = {
    from(table) {
      assert.equal(table, 'attendance_records');
      const q = {
        select() {
          return q;
        },
        eq(k, v) {
          assert.equal(k, 'station_id');
          assert.equal(v, 'station');
          return q;
        },
        lt() {
          return q;
        },
        or() {
          return q;
        },
        order() {
          return q;
        },
        range(a, b) {
          ranges.push([a, b]);
          return Promise.resolve({
            data: Array.from({ length: a === 0 ? 1000 : 3 }, () => record()),
            error: null,
          });
        },
      };
      return q;
    },
  };
  assert.equal((await readReportAttendance(client, 'station', 'start', 'end')).length, 1003);
  assert.deepEqual(ranges, [
    [0, 999],
    [1000, 1999],
  ]);
});
test('report route denies workers and shift managers before any data access', async () => {
  const source = '../apps/admin/app/stations/[id]/reports/page.tsx';
  for (const role of ['WORKER', 'SHIFT_MANAGER']) {
    const { default: page } = load(source, {
      'react/jsx-runtime': {},
      'next/navigation': {
        redirect() {
          throw new Error('redirect');
        },
        notFound() {},
      },
      '@yellowshifts/database': {
        getStationById() {
          assert.fail('unauthorized read');
        },
      },
      '@/app/lib/server-context': {
        getServerContext: async () => ({
          supabase: {},
          context: {
            isPlatformAdmin: false,
            memberships: [{ station: { id: 's' }, membership: { role, status: 'ACTIVE' } }],
          },
        }),
      },
      '@/app/lib/hours-report': helpers,
      '@/app/lib/report-query': {},
      './HoursReportClient': {},
    });
    await assert.rejects(
      () => page({ params: Promise.resolve({ id: 's' }), searchParams: Promise.resolve({}) }),
      /redirect/
    );
  }
});
test('weekly totals keep corrections, distinct memberships and partial weeks consistent', () => {
  const entries = helpers.buildEntries(
    [
      record({
        clock_out_at: '2026-09-08T03:00:00Z',
        clock_out_source: 'MANUAL_ADMIN',
        correction_reason: 'תיקון',
      }),
    ],
    '2026-09-08',
    '2026-09-08',
    'Asia/Jerusalem',
    Date.parse('2026-10-01')
  );
  assert.equal(entries[0].seconds, 21600);
  assert.equal(entries[0].source, 'תיקון / דיווח ידני');
  assert.equal(entries[0].reason, 'תיקון');
  const report = {
    station: 'תחנה',
    timezone: 'Asia/Jerusalem',
    from: '2026-09-08',
    to: '2026-09-08',
    people: [
      { id: 'm', name: 'כהן', code: '' },
      { id: 'm2', name: 'כהן', code: '' },
    ],
    entries,
  };
  assert.deepEqual(helpers.weeklyCsv(report).slice(1).split('\r\n'), [
    '"עובד","שבוע","ימי עבודה","משמרות","שעות","100%","125%","150%"',
    '"כהן","06/09–12/09","1","1","6.00","6.00","",""',
    '"כהן","סה״כ","1","1","6.00","6.00","",""',
  ]);
});
test('station report authorization accepts own active admin/platform and denies other station/inactive', async () => {
  for (const [platform, role, status, station, allowed] of [
    [false, 'ADMIN', 'ACTIVE', 's', true],
    [true, 'WORKER', 'INACTIVE', 'elsewhere', true],
    [false, 'ADMIN', 'INACTIVE', 's', false],
    [false, 'ADMIN', 'ACTIVE', 'elsewhere', false],
  ]) {
    const { default: page } = load('../apps/admin/app/stations/[id]/reports/page.tsx', {
      'react/jsx-runtime': {},
      'next/navigation': {
        redirect() {
          throw new Error('denied');
        },
        notFound() {},
      },
      '@yellowshifts/database': {
        getStationById() {
          throw new Error('allowed');
        },
      },
      '@/app/lib/server-context': {
        getServerContext: async () => ({
          supabase: {},
          context: {
            isPlatformAdmin: platform,
            memberships: [{ station: { id: station }, membership: { role, status } }],
          },
        }),
      },
      '@/app/lib/hours-report': helpers,
      '@/app/lib/report-query': {},
      './HoursReportClient': {},
    });
    await assert.rejects(
      () => page({ params: Promise.resolve({ id: 's' }), searchParams: Promise.resolve({}) }),
      allowed ? /allowed/ : /denied/
    );
  }
});
