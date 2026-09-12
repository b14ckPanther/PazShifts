import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const ts = createRequire(import.meta.url)('typescript');
const exports = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../packages/reports/src/export-name.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText,
  { exports, TextEncoder }
);
const { hoursExportName } = exports;
const report = { station: 'פז כורדני', from: '2026-09-07', to: '2026-09-13' };
test('Hebrew report names distinguish team, worker and export type', () => {
  assert.equal(
    hoursExportName(report, 'daily'),
    'סיכום יומי - פז כורדני - כל הצוות - 07-09-2026_13-09-2026'
  );
  assert.match(
    hoursExportName(report, 'pdf', 'ישראל ישראלי'),
    /^דוח שעות - פז כורדני - ישראל ישראלי/
  );
  assert.notEqual(hoursExportName(report, 'weekly'), hoursExportName(report, 'detail'));
});
test('Names remain safe and bounded, with no invisible direction controls', () => {
  const name = hoursExportName(
    { ...report, station: '../תחנה/\u202e:*?' },
    'pdf',
    'שם'.repeat(100)
  );
  assert.doesNotMatch(name, /[/:*?\u202e]/);
  assert.ok(new TextEncoder().encode(name + '.pdf').length < 255);
  assert.match(hoursExportName({ ...report, station: '...' }, 'detail', ''), /תחנה - עובד/);
});
