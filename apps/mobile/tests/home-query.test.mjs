import { scheduleInstant } from './schedule-instant-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function moduleExports(path) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    { exports }
  );
  return exports;
}
const reportDates = moduleExports('../../../packages/reports/src/hours-report.ts');
const { heroState } = moduleExports('../src/home/model.ts');
function setup({
  allowed = true,
  failed = false,
  overflow = false,
  shifts = [],
  timezone = 'Asia/Jerusalem',
  now = '2026-09-13T09:00Z',
} = {}) {
  const calls = [],
    exports = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL('../../../packages/database/src/mobile-home.ts', import.meta.url),
        'utf8'
      ),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } }
    ).outputText,
    {
      exports,
      require(name) {
        if (name === './schedule-instant') return scheduleInstant;
        if (name === './worker-context')
          return {
            getNativeWorkerContext: async () => ({
              stations: allowed
                ? [{ id: 'a', membershipId: 'member-a', timezone, name: 'תחנה' }]
                : [],
            }),
          };
        if (name === './hours-query')
          return {
            readOwnReportAttendance: async (client, user, station, start, end) => {
              const response = await client
                .from('attendance_records')
                .select('*')
                .eq('user_id', user)
                .eq('station_id', station)
                .lt('clock_in_at', end)
                .or(`clock_out_at.gt.${start},clock_out_at.is.null`)
                .range(0, 999);
              if (response.error) throw response.error;
              return response.data;
            },
          };
        if (name === '@yellowshifts/reports')
          return {
            ...reportDates,
            shiftReportEntries: () => [
              { id: '1', status: 'הושלמה', seconds: 3600, date: '2026-09-13' },
              { id: '2', status: 'פתוחה', seconds: 9999, date: '2026-09-13' },
            ],
          };
        throw Error(name);
      },
    }
  );
  const client = {
    from(table) {
      const filters = [];
      calls.push({ table, filters });
      const query = {};
      for (const method of [
        'select',
        'eq',
        'gte',
        'lt',
        'or',
        'order',
        'limit',
        'range',
        'in',
        'lte',
      ])
        query[method] = (...args) => {
          filters.push([method, ...args]);
          return query;
        };
      query.maybeSingle = () => {
        query.single = true;
        return query;
      };
      query.then = (resolve) =>
        Promise.resolve({
          data: query.single
            ? null
            : overflow
              ? Array(301).fill({})
              : table === 'shift_assignments'
                ? shifts
                    .filter((shift) =>
                      filters.every(
                        ([method, field, value]) =>
                          field !== 'scheduled_shifts.shift_date' ||
                          (method === 'gte'
                            ? shift.shift_date >= value
                            : method === 'lt'
                              ? shift.shift_date < value
                              : true)
                      )
                    )
                    .map((scheduled_shifts) => ({ scheduled_shifts }))
                : [],
          error: failed ? Error('db') : null,
        }).then(resolve);
      return query;
    },
  };
  return {
    calls,
    read: () => exports.getMobileHome(client, 'worker-a', 'a', Date.parse(now)),
  };
}
test('unauthorized station is rejected before any home query', async () => {
  const s = setup({ allowed: false });
  await assert.rejects(s.read());
  assert.equal(s.calls.length, 0);
});
test('published assignments and own attendance are bounded and scoped; open hours excluded', async () => {
  const s = setup();
  const result = await s.read();
  assert.equal(result.confirmedSeconds, 3600);
  assert.equal(result.reviewCount, 1);
  assert.equal(result.availabilitySubmitted, false);
  const assignments = s.calls[0].filters;
  assert.ok(assignments.some((f) => f[1] === 'station_membership_id' && f[2] === 'member-a'));
  assert.ok(
    assignments.some((f) => f[1] === 'scheduled_shifts.schedules.status' && f[2] === 'PUBLISHED')
  );
  for (const call of s.calls.filter((c) => c.table === 'attendance_records'))
    assert.ok(call.filters.some((f) => f[1] === 'user_id' && f[2] === 'worker-a'));
  assert.ok(s.calls[3].filters.some((f) => f[1] === 'station_id' && f[2] === 'a'));
  assert.ok(s.calls[3].filters.some((f) => f[0] === 'range' && f[1] === 0 && f[2] === 999));
});
test('query failures and oversized results cannot become partial or misleading summaries', async () => {
  await assert.rejects(setup({ failed: true }).read());
  await assert.rejects(setup({ overflow: true }).read());
});

test('Home converts published wall clocks before countdown and next-shift selection', async () => {
  const s = setup({
    shifts: [
      {
        id: 'friday',
        shift_date: '2026-09-18',
        start_at: '2026-09-18T14:00:00Z',
        end_at: '2026-09-18T22:00:00Z',
      },
      {
        id: 'saturday',
        shift_date: '2026-09-19',
        start_at: '2026-09-19T06:00:00Z',
        end_at: '2026-09-19T14:00:00Z',
      },
    ],
  });
  const result = await s.read();
  assert.equal(result.shifts[0].start_at, '2026-09-18T11:00:00.000Z');
  assert.equal(result.shifts[0].end_at, '2026-09-18T19:00:00.000Z');
  assert.equal(result.shifts[1].start_at, '2026-09-19T03:00:00.000Z');
  assert.equal(result.shifts[1].end_at, '2026-09-19T11:00:00.000Z');
  assert.ok(
    s.calls[0].filters.some((f) => f[0] === 'gte' && f[1] === 'scheduled_shifts.shift_date')
  );
});

const scheduled = (id, day, start, endDay, end) => ({
  id,
  shift_date: day,
  start_at: `${day}T${start}:00Z`,
  end_at: `${endDay}T${end}:00Z`,
});
test('Home includes Saturday overnight at local Sunday boundary without using UTC week bounds', async () => {
  const s = setup({
    now: '2026-09-12T21:30Z',
    shifts: [
      scheduled('night', '2026-09-12', '22:00', '2026-09-13', '06:00'),
      scheduled('next', '2026-09-13', '14:00', '2026-09-13', '22:00'),
      scheduled('too-old', '2026-09-11', '22:00', '2026-09-12', '06:00'),
      scheduled('outside', '2026-10-11', '06:00', '2026-10-11', '14:00'),
    ],
  });
  const result = await s.read();
  assert.equal(result.today, '2026-09-13');
  assert.equal(result.week, '2026-09-13');
  assert.equal(result.shifts.map((s) => s.id).join(','), 'night,next');
  assert.equal(heroState(result, Date.parse('2026-09-12T21:30Z')).shift.id, 'night');
  assert.equal(heroState(result, Date.parse('2026-09-13T03:00Z')).shift.id, 'next');
  assert.equal(
    result.shifts.filter((s) => s.shift_date >= result.week && s.shift_date < '2026-09-20').length,
    1
  );
  assert.ok(
    s.calls[0].filters.some(
      (f) => f[0] === 'gte' && f[1] === 'scheduled_shifts.shift_date' && f[2] === '2026-09-12'
    )
  );
  assert.ok(
    s.calls[0].filters.some(
      (f) => f[0] === 'lt' && f[1] === 'scheduled_shifts.shift_date' && f[2] === '2026-10-11'
    )
  );
});
test('Home sorts normalized instants, resolves ties and selects next shift at the corrected boundary', async () => {
  const s = setup({
    now: '2026-09-18T10:30Z',
    shifts: [
      scheduled('later', '2026-09-19', '06:00', '2026-09-19', '14:00'),
      scheduled('b', '2026-09-18', '14:00', '2026-09-18', '22:00'),
      scheduled('a', '2026-09-18', '14:00', '2026-09-18', '22:00'),
    ],
  });
  const result = await s.read();
  assert.equal(result.shifts.map((s) => s.id).join(','), 'a,b,later');
  assert.equal(heroState(result, Date.parse('2026-09-18T10:30Z')).kind, 'soon');
  assert.equal(heroState(result, Date.parse('2026-09-18T19:00Z')).shift.id, 'later');
});
test('Home derives dates and clocks from the selected station timezone', async () => {
  const s = setup({
    timezone: 'America/New_York',
    now: '2026-09-13T02:00Z',
    shifts: [scheduled('night', '2026-09-12', '22:00', '2026-09-13', '06:00')],
  });
  const result = await s.read();
  assert.equal(result.today, '2026-09-12');
  assert.equal(result.week, '2026-09-06');
  assert.equal(result.shifts[0].start_at, '2026-09-13T02:00:00.000Z');
});
