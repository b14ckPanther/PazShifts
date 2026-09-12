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
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require: (n) => mocks[n] }
  );
  return exports;
}
const h = load('../packages/reports/src/hours-report.ts');
const r = load('../packages/reports/src/rates.ts', { './hours-report': h });
const rules = {
  dailyMinutes: [480, 480, 480, 480, 480, 480, 480],
  firstOvertimeMinutes: 120,
  firstRate: 125,
  secondRate: 150,
  weeklyMinutes: null,
  weekStartsOn: 1,
  breakMinutes: 0,
  breakAfterMinutes: 360,
  nightStart: 1320,
  nightEnd: 360,
  nightRate: 100,
  restDays: [],
  restRate: 150,
  holidays: [],
  holidayRate: 150,
};
const policy = (changes = {}, id = '1', effectiveFrom = '2026-09-07') => ({
  id,
  effectiveFrom,
  createdAt: '2026-09-01',
  rules: { ...rules, ...changes },
});
const record = (date = '2026-09-07', hours = 12, id = 'r') => ({
  id,
  user_id: 'u',
  station_membership_id: 'm',
  clock_in_at: date + 'T06:00:00Z',
  clock_out_at: new Date(Date.parse(date + 'T06:00:00Z') + hours * 3600000).toISOString(),
  status: 'COMPLETED',
  clock_in_source: 'NFC',
  clock_out_source: 'NFC',
});
const classify = (records, policies = [policy()], from = '2026-09-07', to = '2026-09-13') =>
  r.classifiedEntries(records, from, to, 'UTC', policies, Date.parse('2027-01-01'));
const totals = (entries) => JSON.parse(JSON.stringify(h.rateTotals(entries)));
test('daily bands classify 8 regular, 2 at 125%, remaining at 150% without adding attendance time', () => {
  const entries = classify([record()]);
  assert.deepEqual(totals(entries), { 100: 28800, 125: 7200, 150: 7200 });
  assert.equal(entries[0].seconds, 43200);
});
test('weekly limit uses earlier days even for a one-day export and never counts daily OT twice', () => {
  const records = [record('2026-09-07', 7), record('2026-09-08', 7, 'r2')];
  assert.deepEqual(
    totals(classify(records, [policy({ weeklyMinutes: 600 })], '2026-09-08', '2026-09-08')),
    { 100: 10800, 125: 7200, 150: 7200 }
  );
  const entries = classify(
    [record('2026-09-07', 12), record('2026-09-08', 4, 'r2')],
    [policy({ weeklyMinutes: 600 })]
  );
  assert.deepEqual(totals(entries), { 100: 36000, 125: 14400, 150: 7200 });
});
test('break deduction is once per shift and removed from payable classification, not attendance', () => {
  const entries = classify([record('2026-09-07', 9)], [policy({ breakMinutes: 30 })]);
  assert.equal(entries[0].breakSeconds, 1800);
  assert.equal(entries[0].seconds, 32400);
  assert.deepEqual(totals(entries), { 100: 28800, 125: 1800 });
});
test('night/rest/holiday premium uses highest applicable rate and does not stack', () => {
  const rec = {
    ...record('2026-09-12', 2),
    clock_in_at: '2026-09-12T00:00:00Z',
    clock_out_at: '2026-09-12T02:00:00Z',
  };
  assert.deepEqual(
    totals(
      classify(
        [rec],
        [
          policy({
            nightRate: 175,
            restDays: [6],
            restRate: 150,
            holidays: ['2026-09-12'],
            holidayRate: 200,
          }),
        ]
      )
    ),
    { 200: 7200 }
  );
});
test('versions and unknown periods are explicit; future replacement does not alter older dates', () => {
  const policies = [policy(), policy({ dailyMinutes: Array(7).fill(360) }, '2', '2026-09-14')];
  assert.deepEqual(totals(classify([record('2026-09-07', 8)], policies)), { 100: 28800 });
  assert.deepEqual(
    totals(classify([record('2026-09-14', 8)], policies, '2026-09-14', '2026-09-14')),
    { 100: 21600, 125: 7200 }
  );
  assert.deepEqual(totals(classify([record()], [])), { unclassified: 43200 });
});
test('overnight shifts share one break and configured Sunday weeks appear in CSV', () => {
  const rec = {
    ...record(),
    clock_in_at: '2026-09-07T20:00:00Z',
    clock_out_at: '2026-09-08T06:00:00Z',
  };
  const entries = classify([rec], [policy({ breakMinutes: 30 })]);
  assert.equal(
    entries.reduce((s, e) => s + e.breakSeconds, 0),
    1800
  );
  assert.equal(
    Object.values(totals(entries)).reduce((s, v) => s + v, 0),
    34200
  );
  const report = {
    station: 'תחנה',
    timezone: 'UTC',
    from: '2026-09-07',
    to: '2026-09-08',
    people: [{ id: 'm', name: 'כהן', code: '' }],
    entries,
    rateWeekStartsOn: 0,
  };
  const csv = h.weeklyCsv(report);
  assert(csv.includes('2026-09-06'));
  assert(csv.includes('125% HH:mm:ss'));
  assert(csv.includes('00:30:00'));
});
test('zero thresholds terminate and flagged records receive no paid classification', () => {
  assert.deepEqual(
    totals(
      classify(
        [record('2026-09-07', 1)],
        [policy({ dailyMinutes: Array(7).fill(0), firstOvertimeMinutes: 0 })]
      )
    ),
    { 150: 3600 }
  );
  assert.deepEqual(totals(classify([{ ...record(), status: 'FLAGGED' }])), {});
});
test('DST night premiums use actual elapsed hours and millisecond boundaries terminate', () => {
  const rec = {
    ...record(),
    clock_in_at: '2026-03-26T21:00:00Z',
    clock_out_at: '2026-03-27T05:00:00Z',
  };
  const entries = r.classifiedEntries(
    [rec],
    '2026-03-26',
    '2026-03-27',
    'Asia/Jerusalem',
    [policy({ nightRate: 175 }, '1', '2026-03-23')],
    Date.parse('2027-01-01')
  );
  assert.deepEqual(totals(entries), { 100: 7200, 175: 21600 });
  const precise = {
    ...record(),
    clock_in_at: '2026-09-07T06:00:00.123Z',
    clock_out_at: '2026-09-07T18:00:00.123Z',
  };
  assert.equal(
    Object.values(totals(classify([precise]))).reduce((s, v) => s + v, 0),
    43200
  );
});
