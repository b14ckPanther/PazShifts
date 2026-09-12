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
const reports = load('../../../packages/reports/src/hours-report.ts');
const model = load('../src/week/model.ts', { '@yellowshifts/reports': reports });
test('station-local Sunday and Monday, DST boundaries and week shifts', () => {
  assert.equal(model.stationWeek('Asia/Jerusalem', new Date('2026-09-13T20:59Z')), '2026-09-07');
  assert.equal(model.stationWeek('Asia/Jerusalem', new Date('2026-09-13T21:01Z')), '2026-09-14');
  assert.equal(model.stationWeek('Asia/Jerusalem', new Date('2026-03-27T02:00Z')), '2026-03-23');
  assert.equal(model.shiftDay('2026-09-07', '2026-09-13', 1).day, '2026-09-20');
  assert.equal(model.shiftDay('2026-09-07', '2026-09-13', -1).week, '2026-08-31');
  assert.equal(model.validDay('2026-02-30'), false);
});
test('draft state is normalized without pretending an absent submission is saved', () => {
  const initial = model.draftFor('2026-09-07', null);
  assert.equal(initial.length, 7);
  const edited = initial.map((e, i) => (i ? e : { ...e, availabilityType: 'ALL_DAY_UNAVAILABLE' }));
  assert.notEqual(model.fingerprint(initial), model.fingerprint(edited));
  const overnight = initial.map((e, i) =>
    i ? e : { ...e, availabilityType: 'TIME_WINDOW', startTime: '22:00', endTime: '06:00' }
  );
  assert.equal(model.validDraft(overnight), true);
  overnight[0].endTime = '22:00';
  assert.equal(model.validDraft(overnight), false);
  overnight[0].endTime = '25:00';
  assert.equal(model.validDraft(overnight), false);
});
test('shared availability saving uses exactly one RPC and no destructive REST writes', async () => {
  const helper = load('../../../packages/database/src/availability.ts');
  let calls = 0;
  const result = await helper.saveWeeklyAvailability(
    {
      rpc: async (name, args) => {
        calls++;
        assert.equal(name, 'submit_worker_availability');
        assert.equal(args.p_week, '2026-09-07');
        return {
          data: { week: { id: 'w', week_start_date: args.p_week }, entries: [] },
          error: null,
        };
      },
    },
    { stationId: 's', stationMembershipId: 'm', weekStartDate: '2026-09-13', entries: [] }
  );
  assert.equal(calls, 1);
  assert.equal(result.week.id, 'w');
  await assert.rejects(
    helper.saveWeeklyAvailability(
      { rpc: async () => ({ data: null, error: Error('offline') }) },
      { stationId: 's', stationMembershipId: 'm', weekStartDate: '2026-09-07', entries: [] }
    )
  );
});
test('schedule authorizes before query, explicitly published, and shows only own assignments with coworkers', async () => {
  let allowed = true;
  const filters = [];
  const helper = load('../../../packages/database/src/mobile-week.ts', {
    './worker-context': {
      getNativeWorkerContext: async () => ({
        stations: allowed ? [{ id: 's', membershipId: 'm' }] : [],
      }),
    },
    './availability': { getAvailabilityWeekStart: (d) => d },
  });
  const shift = {
    id: 'shift',
    shift_date: '2026-09-07',
    start_at: '2026-09-07T19:00Z',
    end_at: '2026-09-08T03:00Z',
    notes: 'note',
    shift_templates: { name: 'לילה' },
    shift_assignments: [
      { station_membership_id: 'm' },
      {
        station_membership_id: 'coworker',
        station_memberships: {
          id: 'coworker',
          role: 'WORKER',
          profiles: { id: 'u2', full_name: 'בדיקה' },
        },
      },
    ],
  };
  const client = {
    from(table) {
      const query = {};
      for (const method of ['select', 'eq', 'order', 'limit'])
        query[method] = (...args) => {
          filters.push([table, method, ...args]);
          return query;
        };
      query.maybeSingle = async () => ({ data: { id: 'schedule' }, error: null });
      query.then = (resolve) =>
        Promise.resolve({
          data: [shift, { ...shift, id: 'other', shift_assignments: [] }],
          error: null,
        }).then(resolve);
      return query;
    },
  };
  const result = await helper.getMobileWorkerSchedule(client, 'u', 's', '2026-09-07');
  assert.equal(result.shifts.length, 1);
  assert.equal(result.shifts[0].coworkers[0].name, 'בדיקה');
  assert.ok(filters.some((f) => f[2] === 'status' && f[3] === 'PUBLISHED'));
  allowed = false;
  const before = filters.length;
  await assert.rejects(helper.getMobileWorkerSchedule(client, 'u', 's', '2026-09-07'));
  assert.equal(filters.length, before);
});

test('native time formatting pads hours and respects station DST', () => {
  const { nativeTime } = load('../src/home/Hero.tsx');
  assert.equal(nativeTime('2026-09-07T04:00:00Z', 'Asia/Jerusalem'), '07:00');
  assert.equal(nativeTime('2026-03-26T23:30:00Z', 'Asia/Jerusalem'), '01:30');
  assert.equal(nativeTime('2026-03-27T00:30:00Z', 'Asia/Jerusalem'), '03:30');
});
