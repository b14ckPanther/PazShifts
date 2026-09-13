import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function load(file) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../packages/database/src/' + file, import.meta.url), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } }
    ).outputText,
    { exports, require: () => ({}) }
  );
  return exports;
}
const { getWeekStartDate } = load('schedules.ts'),
  { getAvailabilityWeekStart } = load('availability.ts');
for (const [date, expected] of [
  ['2026-09-13', '2026-09-13'],
  ['2026-09-14', '2026-09-13'],
  ['2026-09-19', '2026-09-13'],
  ['2026-09-20', '2026-09-20'],
  ['2027-01-01', '2026-12-27'],
  ['2026-03-27', '2026-03-22'],
]) {
  test(`schedule and availability agree on Sunday for ${date}`, () => {
    assert.equal(getWeekStartDate(date), expected);
    assert.equal(getAvailabilityWeekStart(date), expected);
  });
}
test('migrated partial availability never claims full submission', () => {
  const { isAvailabilitySubmitted } = load('availability-status.ts');
  const saved = {
    week: { weekStartDate: '2026-09-13', submittedAt: '2026-09-01' },
    entries: Array.from({ length: 7 }, (_, i) => ({ date: `2026-09-${13 + i}` })),
  };
  assert.equal(isAvailabilitySubmitted(saved), true);
  assert.equal(isAvailabilitySubmitted({ ...saved, entries: saved.entries.slice(1) }), false);
  assert.equal(
    isAvailabilitySubmitted({ ...saved, entries: [...saved.entries.slice(1), saved.entries[1]] }),
    false
  );
  assert.equal(isAvailabilitySubmitted(null), false);
});
