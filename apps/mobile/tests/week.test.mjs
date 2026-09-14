import { scheduleInstant } from './schedule-instant-loader.mjs';
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
  assert.equal(model.stationWeek('Asia/Jerusalem', new Date('2026-09-12T20:59Z')), '2026-09-06');
  assert.equal(model.stationWeek('Asia/Jerusalem', new Date('2026-09-12T21:01Z')), '2026-09-13');
  assert.equal(model.stationWeek('Asia/Jerusalem', new Date('2026-09-13T20:59Z')), '2026-09-13');
  assert.equal(model.stationWeek('Asia/Jerusalem', new Date('2026-09-13T21:01Z')), '2026-09-13');
  assert.equal(model.stationWeek('Asia/Jerusalem', new Date('2026-03-27T02:00Z')), '2026-03-22');
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
        assert.equal(args.p_week, '2026-09-13');
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
    './schedule-instant': scheduleInstant,
    './worker-context': {
      getNativeWorkerContext: async () => ({
        stations: allowed ? [{ id: 's', membershipId: 'm', timezone: 'Asia/Jerusalem' }] : [],
      }),
    },
    './availability': load('../../../packages/database/src/availability.ts'),
  });
  const shift = {
    id: 'shift',
    shift_date: '2026-09-18',
    start_at: '2026-09-18T14:00Z',
    end_at: '2026-09-18T22:00Z',
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
  const result = await helper.getMobileWorkerSchedule(client, 'u', 's', '2026-09-13');
  assert.equal(result.shifts.length, 1);
  assert.equal(result.shifts[0].start, '2026-09-18T11:00:00.000Z');
  assert.equal(result.shifts[0].end, '2026-09-18T19:00:00.000Z');
  assert.equal(result.shifts[0].coworkers[0].name, 'בדיקה');
  assert.ok(filters.some((f) => f[2] === 'status' && f[3] === 'PUBLISHED'));
  allowed = false;
  const before = filters.length;
  await assert.rejects(helper.getMobileWorkerSchedule(client, 'u', 's', '2026-09-13'));
  assert.equal(filters.length, before);
});

test('native time formatting pads hours and respects station DST', () => {
  const { nativeTime } = load('../src/home/Hero.tsx');
  assert.equal(nativeTime('2026-09-07T04:00:00Z', 'Asia/Jerusalem'), '07:00');
  assert.equal(nativeTime('2026-03-26T23:30:00Z', 'Asia/Jerusalem'), '01:30');
  assert.equal(nativeTime('2026-03-27T00:30:00Z', 'Asia/Jerusalem'), '03:30');
});

test('Schedule selects the Sunday week, keeps Saturday overnight on its start date, and sorts instants', async () => {
  const filters = [];
  const helper = load('../../../packages/database/src/mobile-week.ts', {
    './schedule-instant': scheduleInstant,
    './worker-context': {
      getNativeWorkerContext: async () => ({
        stations: [{ id: 's', membershipId: 'm', timezone: 'America/New_York' }],
      }),
    },
    './availability': load('../../../packages/database/src/availability.ts'),
  });
  const row = (id, day, start, endDay, end, schedule_id = 'week') => ({
    id,
    station_id: 's',
    schedule_id,
    shift_date: day,
    start_at: `${day}T${start}:00Z`,
    end_at: `${endDay}T${end}:00Z`,
    shift_assignments: [{ station_membership_id: 'm' }],
  });
  const rows = [
    row('sat', '2026-09-19', '22:00', '2026-09-20', '06:00'),
    row('sun', '2026-09-13', '00:30', '2026-09-13', '08:00'),
    row('next', '2026-09-20', '06:00', '2026-09-20', '14:00', 'next-week'),
  ];
  const client = {
    from(table) {
      const eqs = [];
      const q = {
        select() {
          return q;
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        eq(k, v) {
          eqs.push([k, v]);
          filters.push([table, k, v]);
          return q;
        },
        async maybeSingle() {
          return {
            data: eqs.some(([k, v]) => k === 'week_start_date' && v === '2026-09-13')
              ? { id: 'week' }
              : null,
            error: null,
          };
        },
        then(resolve) {
          return Promise.resolve({
            data: rows.filter((r) => eqs.every(([k, v]) => r[k] === v)),
            error: null,
          }).then(resolve);
        },
      };
      return q;
    },
  };
  const result = await helper.getMobileWorkerSchedule(client, 'u', 's', '2026-09-18');
  assert.equal(result.shifts.map((s) => s.id).join(','), 'sun,sat');
  assert.equal(result.shifts[0].start, '2026-09-13T04:30:00.000Z');
  assert.equal(result.shifts[1].date, '2026-09-19');
  assert.equal(result.shifts[1].end, '2026-09-20T10:00:00.000Z');
  assert.ok(
    filters.some(([t, k, v]) => t === 'schedules' && k === 'week_start_date' && v === '2026-09-13')
  );
  assert.ok(
    filters.some(([t, k, v]) => t === 'scheduled_shifts' && k === 'schedule_id' && v === 'week')
  );
  const empty = await helper.getMobileWorkerSchedule(client, 'u', 's', '2026-09-20');
  assert.equal(empty.published, false);
  assert.equal(empty.shifts.length, 0);
});
