// Production React server rendering of the actual report component with isolated fixtures.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { performance } from 'node:perf_hooks';
const require = createRequire(new URL('../../apps/admin/package.json', import.meta.url));
const ts = require('typescript'),
  React = require('react'),
  { renderToString } = require('react-dom/server');
const ref = process.argv[2];
function load(path, mocks = {}) {
  const exports = {};
  const source = ref
    ? execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' })
    : readFileSync(path, 'utf8');
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    { exports, require: (n) => (n.endsWith('.css') ? {} : mocks[n] || require(n)) }
  );
  return exports;
}
const h = load('packages/reports/src/hours-report.ts');
const rates = load('packages/ui/src/components/RateBreakdown.tsx', { '@yellowshifts/reports': h });
const table = load('packages/ui/src/components/HoursTable.tsx', {
  '@yellowshifts/reports': h,
  './RateBreakdown': rates,
});
const mocks = {
  '@yellowshifts/ui': { ...rates, ...table },
  '@/app/lib/hours-report': h,
  'next/navigation': { useRouter: () => ({}) },
  '@/app/components/NavigationLink': {
    NavigationLink: ({ children, ...props }) => React.createElement('a', props, children),
  },
};
if (!ref)
  mocks['./PersonHours'] = load('apps/admin/app/stations/[id]/reports/PersonHours.tsx', {
    '@yellowshifts/ui': { ...rates, ...table },
    '@yellowshifts/reports': h,
  });
const { HoursReportClient } = load(
  'apps/admin/app/stations/[id]/reports/HoursReportClient.tsx',
  mocks
);
const people = Array.from({ length: 100 }, (_, i) => ({
  id: `m${i}`,
  name: `עובד ${i}`,
  code: `EMP${i}`,
}));
const entries = people.flatMap((p) =>
  Array.from({ length: 30 }, (_, d) => ({
    id: `${p.id}-${d}`,
    personId: p.id,
    date: `2026-09-${String(d + 1).padStart(2, '0')}`,
    start: `2026-09-${String(d + 1).padStart(2, '0')}T06:00:00Z`,
    end: `2026-09-${String(d + 1).padStart(2, '0')}T14:00:00Z`,
    seconds: 28800,
    status: 'הושלמה',
    reason: '',
    source: 'NFC',
    correctedAt: null,
    rateSeconds: { 100: 28800 },
  }))
);
const report = {
  station: 'Synthetic',
  timezone: 'Asia/Jerusalem',
  from: '2026-09-01',
  to: '2026-09-30',
  generatedAt: '2026-10-01',
  people,
  entries,
};
const samples = [];
let html;
for (let i = 0; i < 21; i++) {
  const start = performance.now();
  html = renderToString(
    React.createElement(HoursReportClient, { report, stationId: 'fixture', today: '2026-09-30' })
  );
  if (i) samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
console.log(
  JSON.stringify({
    ref: ref || 'working-tree',
    samples: 20,
    concurrency: 1,
    people: 100,
    entries: 3000,
    p50Ms: samples[9],
    p95Ms: samples[18],
    htmlBytes: Buffer.byteLength(html),
    tables: (html.match(/<table/g) || []).length,
  })
);
