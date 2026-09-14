import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
const exports = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL('../../../packages/database/src/schedule-instant.ts', import.meta.url),
      'utf8'
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText,
  { exports }
);
export const scheduleInstant = exports;
