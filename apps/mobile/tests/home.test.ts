import test from 'node:test';
import assert from 'node:assert/strict';
import { heroState, selectStation, onboardingDone, tabs } from '../src/home/model.ts';
import type { MobileHome } from '@yellowshifts/database/public';
const now = Date.parse('2026-09-13T08:00:00Z');
const shift = (start: string, end: string, date = '2026-09-13') => ({
  id: start,
  start_at: start,
  end_at: end,
  shift_date: date,
});
const data = (values: Partial<MobileHome> = {}) =>
  ({
    today: '2026-09-13',
    shifts: [],
    active: null,
    completedToday: false,
    ...values,
  }) as MobileHome;
test('active attendance outranks scheduled and completed states', () => {
  assert.equal(
    heroState(
      data({
        active: { clock_in_at: '2026-09-13T07:00Z', station_id: 'other', scheduled_shift_id: null },
        completedToday: true,
      }),
      now
    ).kind,
    'active'
  );
});
test('scheduled time alone never claims attendance; soon, today and future are distinct', () => {
  for (const [start, date, expected] of [
    ['2026-09-13T08:30Z', '2026-09-13', 'soon'],
    ['2026-09-13T07:00Z', '2026-09-13', 'soon'],
    ['2026-09-13T12:00Z', '2026-09-13', 'today'],
    ['2026-09-14T12:00Z', '2026-09-14', 'upcoming'],
  ])
    assert.equal(
      heroState(data({ shifts: [shift(start, '2026-09-14T16:00Z', date)] }), now).kind,
      expected
    );
});
test('ended shifts are skipped; completion and empty states remain honest', () => {
  const ended = shift('2026-09-13T01:00Z', '2026-09-13T07:00Z');
  assert.equal(heroState(data({ shifts: [ended] }), now).kind, 'empty');
  assert.equal(heroState(data({ shifts: [ended], completedToday: true }), now).kind, 'completed');
});
test('station selection survives valid updates and rejects revoked or arbitrary IDs', () => {
  const stations = [{ id: 'a' }, { id: 'b' }];
  assert.equal(selectStation(stations, 'b'), 'b');
  assert.equal(selectStation(stations, 'untrusted'), 'a');
  assert.equal(selectStation([{ id: 'a' }], 'b'), 'a');
  assert.equal(selectStation([], 'b'), null);
});
test('only persisted completion suppresses onboarding; five stable Hebrew destinations', () => {
  assert.equal(onboardingDone('complete'), true);
  for (const value of [null, '', 'false', 'corrupt']) assert.equal(onboardingDone(value), false);
  assert.deepEqual(
    tabs.map((t) => t.name),
    ['index', 'schedule', 'availability', 'hours', 'profile']
  );
  assert.equal(new Set(tabs.map((t) => t.label)).size, 5);
});
