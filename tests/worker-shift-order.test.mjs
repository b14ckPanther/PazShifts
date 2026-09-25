import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function load(path, dependencies = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    { exports, require: (name) => dependencies[name] }
  );
  return exports;
}
const instant = load('packages/database/src/schedule-instant.ts');
const { orderWorkerShifts } = load('apps/web/app/components/shift-order.ts', {
  '@yellowshifts/database/src/schedule-instant': instant,
});
const shift = (id, startAt, endAt) => ({ id, startAt, endAt });
test('ongoing overnight and upcoming precede past shifts using Jerusalem station time', () => {
  const data = [
    shift('past', '2026-09-20T14:00:00Z', '2026-09-20T22:00:00Z'),
    shift('next', '2026-09-21T06:00:00Z', '2026-09-21T14:00:00Z'),
    shift('overnight', '2026-09-20T22:00:00Z', '2026-09-21T06:00:00Z'),
  ];
  const ordered = orderWorkerShifts(data, 'Asia/Jerusalem', Date.parse('2026-09-21T02:00:00Z'));
  assert.equal(ordered.map((x) => x.shift.id).join(','), 'overnight,next,past');
  assert.equal(ordered[0].past, false);
  assert.equal(
    orderWorkerShifts([data[2]], 'Asia/Jerusalem', Date.parse('2026-09-21T03:00:00Z'))[0].past,
    true
  );
  assert.equal(data[0].id, 'past');
});
test('historical weeks show recent past first; future shifts stay chronological', () => {
  const data = [
    shift('a', '2026-09-20T06:00:00Z', '2026-09-20T14:00:00Z'),
    shift('b', '2026-09-21T06:00:00Z', '2026-09-21T14:00:00Z'),
  ];
  assert.equal(
    orderWorkerShifts(data, 'UTC', Date.parse('2026-10-01Z'))
      .map((x) => x.shift.id)
      .join(','),
    'b,a'
  );
  assert.equal(
    orderWorkerShifts(data, 'UTC', Date.parse('2026-09-01Z'))
      .map((x) => x.shift.id)
      .join(','),
    'a,b'
  );
});
test('winter offset and DST overnight ending use the station timezone', () => {
  const data = [shift('night', '2026-10-24T22:00:00Z', '2026-10-25T06:00:00Z')];
  assert.equal(
    orderWorkerShifts(data, 'Asia/Jerusalem', Date.parse('2026-10-25T03:30:00Z'))[0].past,
    false
  );
  assert.equal(
    orderWorkerShifts(data, 'Asia/Jerusalem', Date.parse('2026-10-25T04:00:00Z'))[0].past,
    true
  );
});
