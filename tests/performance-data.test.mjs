import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const ts = createRequire(import.meta.url)('typescript');
function load(path, globals = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    { exports, ...globals }
  );
  return exports;
}
test('exceptions scope assignments in database and start independent reads together; DB errors propagate', async () => {
  const { getStationExceptionsForDate } = load('packages/database/src/exceptions.ts');
  const calls = [];
  const started = [];
  let release;
  const gate = new Promise((r) => (release = r));
  let fail = false;
  const client = {
    from(table) {
      const q = {};
      for (const method of ['select', 'eq', 'or', 'lte', 'order', 'maybeSingle'])
        q[method] = (...args) => {
          calls.push([table, method, ...args]);
          return q;
        };
      q.then = (resolve, reject) => {
        started.push(table);
        return gate
          .then(() => ({
            data: table === 'stations' ? {} : [],
            error: fail && table === 'shift_assignments' ? {} : null,
          }))
          .then(resolve, reject);
      };
      return q;
    },
  };
  const promise = getStationExceptionsForDate(client, 'station-A', '2026-09-07');
  await new Promise((r) => setImmediate(r));
  assert.equal(started.length, 3);
  for (const [key, value] of [
    ['station_id', 'station-A'],
    ['scheduled_shifts.shift_date', '2026-09-07'],
    ['scheduled_shifts.schedules.status', 'PUBLISHED'],
    ['station_memberships.status', 'ACTIVE'],
  ])
    assert(
      calls.some(
        (c) => c[0] === 'shift_assignments' && c[1] === 'eq' && c[2] === key && c[3] === value
      )
    );
  release();
  await promise;
  fail = true;
  await assert.rejects(getStationExceptionsForDate(client, 'station-A', '2026-09-07'));
});
test('worker availability embeds entries in one membership/week-scoped read and sorts dates', async () => {
  const { getWorkerWeeklyAvailability } = load('packages/database/src/availability.ts');
  const calls = [];
  let reads = 0;
  const q = {};
  for (const method of ['select', 'eq', 'maybeSingle'])
    q[method] = (...args) => {
      calls.push([method, ...args]);
      return q;
    };
  q.then = (resolve) =>
    Promise.resolve({
      data: { id: 'week', availability_entries: [{ date: '2026-09-09' }, { date: '2026-09-07' }] },
      error: null,
    }).then(resolve);
  const result = await getWorkerWeeklyAvailability(
    {
      from: () => {
        reads++;
        return q;
      },
    },
    'own-member',
    '2026-09-09'
  );
  assert.equal(reads, 1);
  assert(calls.some((c) => c[0] === 'select' && c[1].includes('availability_entries')));
  assert(calls.some((c) => c[1] === 'station_membership_id' && c[2] === 'own-member'));
  assert(calls.some((c) => c[1] === 'week_start_date' && c[2] === '2026-09-06'));
  assert.equal(result.entries[0].date, '2026-09-07');
});
test('elapsed labels share one timer and release listeners when unmounted; hidden tabs do not tick', () => {
  let subscribe;
  let timerCount = 0;
  let clearCount = 0;
  let tick;
  let notifications = 0;
  const events = new Map();
  const document = {
    visibilityState: 'visible',
    addEventListener: (key, fn) => events.set(key, fn),
    removeEventListener: (key) => events.delete(key),
  };
  const { ElapsedDuration } = load('apps/admin/app/components/ElapsedDuration.tsx', {
    require: (n) =>
      n === 'react'
        ? {
            useSyncExternalStore: (s) => {
              subscribe = s;
              return 0;
            },
          }
        : { jsx: () => null },
    document,
    setInterval: (fn) => {
      timerCount++;
      tick = fn;
      return 1;
    },
    clearInterval: () => clearCount++,
  });
  ElapsedDuration({ start: '2026-09-01' });
  const a = subscribe(() => notifications++),
    b = subscribe(() => notifications++);
  assert.equal(timerCount, 1);
  notifications = 0;
  tick();
  assert.equal(notifications, 2);
  document.visibilityState = 'hidden';
  tick();
  assert.equal(notifications, 2);
  a();
  assert.equal(clearCount, 0);
  b();
  assert.equal(clearCount, 1);
  assert.equal(events.size, 0);
});

test('collapsed worker details do not render tables, selected worker remains immediately expanded', () => {
  const require = createRequire(new URL('../apps/admin/package.json', import.meta.url));
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const h = load('packages/reports/src/hours-report.ts');
  let tableRenders = 0;
  const { PersonHours } = load('apps/admin/app/stations/[id]/reports/PersonHours.tsx', {
    require: (n) =>
      n === '@yellowshifts/ui'
        ? {
            RateBreakdown: () => null,
            HoursTable: () => {
              tableRenders++;
              return React.createElement('table');
            },
          }
        : n === '@yellowshifts/reports'
          ? h
          : require(n),
  });
  const props = { report: { entries: [{ seconds: 3600 }] }, person: { name: 'עובד', code: 'EMP' } };
  const closed = renderToStaticMarkup(
    React.createElement(PersonHours, { ...props, initiallyOpen: false })
  );
  assert.equal(tableRenders, 0);
  assert.match(closed, /01:00:00/);
  renderToStaticMarkup(React.createElement(PersonHours, { ...props, initiallyOpen: true }));
  assert.equal(tableRenders, 1);
});
