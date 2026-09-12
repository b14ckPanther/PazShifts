// Isolated CPU benchmark. No database/network/production records.
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function load(p, mocks = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(p, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require: (n) => mocks[n] }
  );
  return exports;
}
const report = load('../../../packages/reports/src/hours-report.ts');
const rates = load('../../../packages/reports/src/rates.ts', { './hours-report': report });
const model = load('../src/hours/model.ts', { '@yellowshifts/reports': report });
for (const days of [7, 31, 93]) {
  const from = '2026-01-01',
    to = report.addDays(from, days - 1),
    records = [];
  for (let i = -7; i < days; i++) {
    const date = report.addDays(from, i);
    records.push({
      id: String(i),
      user_id: 'fixture',
      station_membership_id: 'fixture',
      status: 'COMPLETED',
      clock_in_at: date + 'T05:00Z',
      clock_out_at: date + 'T17:00Z',
    });
  }
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
  const engine = [],
    presentation = [];
  for (let i = 0; i < 105; i++) {
    let start = performance.now();
    const entries = rates.classifiedEntries(
      records,
      from,
      to,
      'Asia/Jerusalem',
      policy,
      Date.parse('2027-01-01')
    );
    let split = performance.now();
    model.groupDays(entries, 1);
    model.summarize(entries);
    if (i >= 5) {
      engine.push(split - start);
      presentation.push(performance.now() - split);
    }
  }
  const stats = (a) => {
    a.sort((x, y) => x - y);
    return { p50: a[49].toFixed(2), p95: a[94].toFixed(2) };
  };
  console.log(
    JSON.stringify({
      days,
      records: records.length,
      samples: 100,
      concurrency: 1,
      engineMs: stats(engine),
      presentationMs: stats(presentation),
    })
  );
}
