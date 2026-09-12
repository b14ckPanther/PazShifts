// Differential regression check against a supplied pre-optimization Git revision.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
const ref = process.argv[2];
if (!ref) throw Error('Pass the pre-optimization Git revision');
function helpers(revision) {
  const load = (name, mocks = {}) => {
    const exports = {},
      path = `packages/reports/src/${name}.ts`;
    const source = revision
      ? execFileSync('git', ['show', `${revision}:${path}`], { encoding: 'utf8' })
      : readFileSync(path, 'utf8');
    runInNewContext(
      ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      { exports, require: (n) => mocks[n] }
    );
    return exports;
  };
  const h = load('hours-report');
  return load('rates', { './hours-report': h });
}
const before = helpers(ref),
  after = helpers();
let scenarios = 0;
for (const timezone of ['UTC', 'Asia/Jerusalem', 'America/New_York'])
  for (const from of ['2026-03-06', '2026-03-26', '2026-10-23', '2026-10-30'])
    for (const nightRate of [100, 175])
      for (const breakMinutes of [0, 30]) {
        const records = [];
        for (let i = 0; i < 16; i++) {
          const start = Date.parse(from + 'T18:31:07.123Z') + i * 86400000;
          records.push({
            id: `r${i}`,
            user_id: 'u',
            station_membership_id: 'm',
            clock_in_at: new Date(start).toISOString(),
            clock_out_at: i === 15 ? null : new Date(start + 11.5 * 3600000).toISOString(),
            status: i === 15 ? 'ACTIVE' : i === 14 ? 'FLAGGED' : 'COMPLETED',
            clock_in_source: 'NFC',
            clock_out_source: 'NFC',
          });
        }
        const policies = [
          {
            id: '1',
            effectiveFrom: '2020-01-01',
            rules: {
              dailyMinutes: [480, 420, 480, 480, 480, 480, 480],
              firstOvertimeMinutes: 120,
              firstRate: 125,
              secondRate: 150,
              weeklyMinutes: 2520,
              weekStartsOn: 1,
              breakMinutes,
              breakAfterMinutes: 360,
              nightStart: 1320,
              nightEnd: 360,
              nightRate,
              restDays: [6],
              restRate: 150,
              holidays: [from],
              holidayRate: 200,
            },
          },
        ];
        const to = new Date(Date.parse(from) + 16 * 86400000).toISOString().slice(0, 10);
        // Floating-point addition order can differ; compare all durations to microsecond precision.
        const normalize = (result) =>
          JSON.parse(
            JSON.stringify(result, (_, v) =>
              typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v
            )
          );
        assert.deepEqual(
          normalize(
            after.classifiedEntries(records, from, to, timezone, policies, Date.parse('2027-01-01'))
          ),
          normalize(
            before.classifiedEntries(
              records,
              from,
              to,
              timezone,
              policies,
              Date.parse('2027-01-01')
            )
          )
        );
        scenarios++;
      }
console.log(
  `PASS: ${scenarios} differential report scenarios (DST, overnight, subsecond, daily/weekly premiums, breaks, open/flagged records)`
);
