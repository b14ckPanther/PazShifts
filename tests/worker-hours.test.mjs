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
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    { exports, require: (n) => mocks[n] }
  );
  return exports;
}
const helpers = load('../packages/reports/src/hours-report.ts');
Object.assign(helpers, load('../packages/reports/src/rates.ts', { './hours-report': helpers }));
Object.assign(
  helpers,
  load('../packages/reports/src/shift-report.ts', { './hours-report': helpers, './rates': helpers })
);
test('worker attendance applies the authenticated user and station filter to every page', async () => {
  const { readOwnReportAttendance } = load('../packages/database/src/hours-query.ts');
  let calls = 0;
  const filters = [];
  const client = {
    from() {
      calls++;
      const query = {
        select() {
          return query;
        },
        eq(k, v) {
          filters.push([k, v]);
          return query;
        },
        lt() {
          return query;
        },
        or() {
          return query;
        },
        order() {
          return query;
        },
        range() {
          return Promise.resolve({
            data: calls === 1 ? Array.from({ length: 1000 }, () => ({})) : [],
            error: null,
          });
        },
      };
      return query;
    },
  };
  assert.equal(
    (await readOwnReportAttendance(client, 'signed-in-user', 'station', 'start', 'end')).length,
    1000
  );
  assert.deepEqual(filters, [
    ['station_id', 'station'],
    ['user_id', 'signed-in-user'],
    ['station_id', 'station'],
    ['user_id', 'signed-in-user'],
  ]);
  assert.throws(
    () => readOwnReportAttendance(client, '', 'station', 'start', 'end'),
    /Authentication/
  );
});
test('worker page ignores URL user IDs and rejects another station before reading attendance', async () => {
  let reads = [];
  const context = {
    user: { id: 'signed-in-user' },
    profile: { fullName: 'ישראל כהן' },
    memberships: [
      {
        station: { id: 'own', name: 'תחנה', timezone: 'Asia/Jerusalem' },
        membership: { id: 'membership', employeeCode: 'W1' },
      },
    ],
  };
  const mocks = {
    'react/jsx-runtime': {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    'next/navigation': {
      redirect() {
        throw Error('redirect');
      },
    },
    '@/app/lib/server-context': { getServerContext: async () => ({ supabase: {}, context }) },
    '@yellowshifts/database': {
      getHourPolicies: async () => [],
      readOwnReportAttendance: async (...args) => {
        reads.push(args);
        return [];
      },
    },
    '@yellowshifts/reports': helpers,
    './WorkerHoursClient': { WorkerHoursClient: 'worker-client' },
  };
  const page = load('../apps/web/app/hours/page.tsx', mocks).default;
  const result = await page({
    searchParams: Promise.resolve({
      stationId: 'own',
      userId: 'someone-else',
      from: '2026-09-07',
      to: '2026-09-13',
    }),
  });
  assert.equal(reads[0][1], 'signed-in-user');
  assert.equal(result.props.report.people[0].id, 'membership');
  reads = [];
  await page({ searchParams: Promise.resolve({ stationId: 'other' }) });
  assert.equal(reads.length, 0);
  mocks['@/app/lib/server-context'].getServerContext = async () => ({
    supabase: {},
    context: null,
  });
  await assert.rejects(() => page({ searchParams: Promise.resolve({}) }), /redirect/);
});
