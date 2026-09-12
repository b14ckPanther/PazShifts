// Isolated synthetic benchmark. Never connects to Supabase or loads environment files.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
const ts = createRequire(import.meta.url)('typescript');
const ref = process.argv[2];
function load(name, mocks = {}) {
  const path = `packages/reports/src/${name}.ts`;
  const source = ref
    ? execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' })
    : readFileSync(path, 'utf8');
  const exports = {};
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require: (n) => mocks[n] }
  );
  return exports;
}
const h = load('hours-report');
const r = load('rates', { './hours-report': h });
const records = [];
for (let worker = 0; worker < 100; worker++)
  for (let day = 0; day < 30; day++) {
    const start = Date.parse('2026-09-01T06:00:00Z') + day * 86400000;
    records.push({
      id: `${worker}-${day}`,
      user_id: `u${worker}`,
      station_membership_id: `m${worker}`,
      clock_in_at: new Date(start).toISOString(),
      clock_out_at: new Date(start + 10 * 3600000).toISOString(),
      status: 'COMPLETED',
      clock_in_source: 'NFC',
      clock_out_source: 'NFC',
    });
  }
const policies = [
  {
    id: '1',
    effectiveFrom: '2026-08-01',
    createdAt: '2026-08-01',
    rules: {
      dailyMinutes: Array(7).fill(480),
      firstOvertimeMinutes: 120,
      firstRate: 125,
      secondRate: 150,
      weeklyMinutes: 2520,
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
    },
  },
];
const run = () =>
  r.classifiedEntries(
    records,
    '2026-09-01',
    '2026-09-30',
    'Asia/Jerusalem',
    policies,
    Date.parse('2026-10-01')
  );
const coldStart = performance.now();
const result = run();
const coldMs = performance.now() - coldStart;
const samples = [];
for (let i = 0; i < 20; i++) {
  const start = performance.now();
  run();
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      ref: ref || 'working-tree',
      node: process.version,
      records: records.length,
      days: 30,
      workers: 100,
      concurrency: 1,
      samples: 20,
      coldMs,
      p50Ms: samples[9],
      p95Ms: samples[18],
      rows: result.length,
      bytes: Buffer.byteLength(JSON.stringify(result)),
      sha256: createHash('sha256').update(JSON.stringify(result)).digest('hex'),
    },
    null,
    2
  )
);
