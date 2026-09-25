import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function mount({ reduced = false, path = '/', wait = true } = {}) {
  let visible = false,
    pending = false;
  const timers = new Map(),
    events = new Map(),
    cleanups = [];
  let id = 0;
  class Form {
    matches() {
      return true;
    }
  }
  const exports = {};
  const window = {
    location: { pathname: path },
    matchMedia: () => ({ matches: reduced }),
    setTimeout: (fn, delay) => {
      timers.set(++id, { fn, delay });
      return id;
    },
    clearTimeout: (key) => timers.delete(key),
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: (name) => events.delete(name),
  };
  const document = {
    querySelector: () => (pending ? {} : null),
    addEventListener: window.addEventListener,
    removeEventListener: window.removeEventListener,
  };
  runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL('../packages/ui/src/components/BrandSplash.tsx', import.meta.url),
        'utf8'
      ),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
      }
    ).outputText,
    {
      exports,
      window,
      document,
      HTMLFormElement: Form,
      FormData: class {
        get() {
          return '';
        }
      },
      require: (name) => {
        if (name === 'react')
          return {
            useState: () => [
              visible,
              (value) => {
                visible = value;
              },
            ],
            useRef: (value) => ({ current: value }),
            useCallback: (fn) => fn,
            useEffect: (fn) => cleanups.push(fn()),
          };
        if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
        if (name === './Brand') return { BrandLogo: () => null };
        throw Error(name);
      },
    }
  );
  exports.BrandSplash({ waitForContent: wait });
  return {
    visible: () => visible,
    pending: (value) => {
      pending = value;
    },
    tick() {
      const [key, timer] = timers.entries().next().value;
      timers.delete(key);
      timer.fn();
      return timer.delay;
    },
    submit: () => events.get('submit')({ target: new Form() }),
    cleanup: () => cleanups.forEach((fn) => fn?.()),
    count: () => timers.size,
  };
}
test('minimum splash duration, then wait for actual navigation or login readiness', () => {
  const ui = mount();
  assert.equal(ui.visible(), true);
  ui.pending(true);
  assert.equal(ui.tick(), 1800);
  assert.equal(ui.visible(), true);
  assert.equal(ui.tick(), 100);
  ui.pending(false);
  ui.tick();
  assert.equal(ui.visible(), false);
});
test('login starts splash again; failed action clears busy and exposes the form', () => {
  const ui = mount();
  ui.tick();
  ui.submit();
  ui.pending(true);
  ui.tick();
  assert.equal(ui.visible(), true);
  ui.pending(false);
  ui.tick();
  assert.equal(ui.visible(), false);
});
test('reduced motion retains worker loading feedback; NFC remains excluded', () => {
  assert.equal(mount({ reduced: true }).visible(), true);
  assert.equal(mount({ reduced: true, wait: false }).visible(), false);
  assert.equal(mount({ path: '/nfc/example' }).visible(), false);
});
test('unmount cancels readiness polling', () => {
  const ui = mount();
  ui.pending(true);
  ui.tick();
  ui.cleanup();
  assert.equal(ui.count(), 0);
});
