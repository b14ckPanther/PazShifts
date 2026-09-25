import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { URL } from 'node:url';
const ts = createRequire(import.meta.url)('typescript');
const exports = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../apps/web/app/home/home-view.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }
  ).outputText,
  { exports }
);
const { elapsedClock, nextHomeShift } = exports;
test('elapsed timer crosses midnight and 24 hours without wrapping or negative time', () => {
  const start = '2026-09-20T19:00:00Z';
  assert.equal(elapsedClock(start, Date.parse('2026-09-21T03:05:07Z')).label, '08:05:07');
  assert.equal(elapsedClock(start, Date.parse('2026-09-21T21:00:00Z')).label, '26:00:00');
  assert.equal(elapsedClock(start, 0).label, '00:00:00');
  assert.equal(elapsedClock('invalid', 0).label, '00:00:00');
});
test('next shift excludes current attendance and past shifts, sorts real instants', () => {
  const now = Date.parse('2026-09-20T12:00:00Z');
  const data = {
    active: { scheduled_shift_id: 'active' },
    shifts: [
      { id: 'later', start_at: '2026-09-21T12:00:00Z' },
      { id: 'past', start_at: '2026-09-20T11:00:00Z' },
      { id: 'active', start_at: '2026-09-20T12:30:00Z' },
      { id: 'next', start_at: '2026-09-20T13:00:00Z' },
    ],
  };
  assert.equal(nextHomeShift(data, now).id, 'next');
  assert.equal(nextHomeShift({ ...data, shifts: [] }, now), null);
});
