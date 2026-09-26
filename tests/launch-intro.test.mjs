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
    readFileSync(new URL('../packages/ui/src/components/launch-intro.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }
  ).outputText,
  { exports }
);
const { LAUNCH_INTRO_SCRIPT } = exports;
const css = [
  '../packages/ui/src/styles/launch-intro.css',
  '../packages/ui/src/styles/brand-reveal.css',
]
  .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
  .join('\n');
function launch(url, store, { storageThrows = false } = {}) {
  const attrs = {};
  const sessionStorage = {
    getItem: (key) => {
      if (storageThrows) throw Error('blocked');
      return store.get(key) ?? null;
    },
    setItem: (key, value) => store.set(key, value),
  };
  const documentElement = { setAttribute: (name, value) => (attrs[name] = value) };
  const { pathname, search } = new URL(url, 'https://app.test');
  runInNewContext(LAUNCH_INTRO_SCRIPT, {
    location: { pathname, search },
    URLSearchParams,
    sessionStorage,
    document: { documentElement },
  });
  return attrs['data-launch-intro'] === 'skip' ? 'skip' : 'play';
}
test('intro plays once per launch session, not on reloads or later pages', () => {
  const session = new Map();
  assert.equal(launch('/home', session), 'play');
  assert.equal(launch('/home', session), 'skip');
  assert.equal(launch('/hours', session), 'skip');
  assert.equal(launch('/home', new Map()), 'play');
});
test('NFC attendance links never wait behind the intro', () => {
  const session = new Map();
  assert.equal(launch('/nfc/token', session), 'skip');
  assert.equal(launch('/login?next=%2Fnfc%2Ftoken%3Fscan%3D1', session), 'skip');
  assert.equal(launch('/home', session), 'play');
});
test('blocked storage still paints the app normally', () => {
  assert.equal(launch('/home', new Map(), { storageThrows: true }), 'play');
});
test('launch reveal stays within 900-1200ms and reduced motion only fades', () => {
  const duration = Number(css.match(/--reveal-duration:\s*(\d+)ms/)[1]);
  assert.ok(duration >= 900 && duration <= 1200);
  const reduced = css.slice(css.indexOf('prefers-reduced-motion'));
  assert.match(reduced, /\.launch-intro \*\s*{\s*animation: none !important;/);
  assert.match(css, /\.brand-reveal \*\s*{\s*animation: none !important;/);
  const fade = reduced.slice(reduced.indexOf('@keyframes launch-intro-fade')).split('\n}\n')[0];
  assert.doesNotMatch(fade, /transform/);
});
