import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function mount(start, featured = true) {
  const exports = {},
    effects = [],
    intervals = new Set();
  let changed,
    removed = false,
    updates = 0;
  const app = {
    currentState: 'active',
    addEventListener: (_, fn) => {
      changed = fn;
      return {
        remove: () => {
          removed = true;
        },
      };
    },
  };
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../src/home/ShiftClock.tsx', import.meta.url), 'utf8'),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
      }
    ).outputText,
    {
      exports,
      Date,
      setInterval: (fn) => {
        intervals.add(fn);
        return fn;
      },
      clearInterval: (id) => intervals.delete(id),
      require: (name) => {
        if (name === 'react')
          return {
            useState: (v) => [
              v,
              () => {
                updates++;
              },
            ],
            useEffect: (fn) => effects.push(fn),
          };
        if (name === 'react-native') return { AppState: app, View: 'View' };
        if (name === 'react/jsx-runtime')
          return {
            jsx: (type, props) => ({ type, props }),
            jsxs: (type, props) => ({ type, props }),
          };
        if (name === '@yellowshifts/reports')
          return {
            duration: (s) =>
              [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
                .map((v) => String(v).padStart(2, '0'))
                .join(':'),
          };
        if (name === '../ui') return { Label: 'Label' };
        if (name === '../ui/theme') return { colors: {} };
        return {};
      },
    }
  );
  const tree = exports.Elapsed({ start, featured });
  const cleanup = effects[0]();
  return {
    tree,
    intervals,
    cleanup,
    get updates() {
      return updates;
    },
    get removed() {
      return removed;
    },
    state(v) {
      app.currentState = v;
      changed(v);
    },
  };
}
test('featured clock keeps hour/minute/second order explicit on RTL hosts', () => {
  const s = mount(new Date(Date.now() - 86399000).toISOString());
  const row = s.tree.props.children.props.children[0];
  assert.equal(row.props.style.direction, 'ltr');
  assert.deepEqual(
    Array.from(row.props.children, (v) => v.props.label),
    ['שעות', 'דקות', 'שניות']
  );
  assert.equal(s.tree.props.accessibilityLiveRegion, 'none');
  s.cleanup();
});
test('clock stops background interval and immediately refreshes on resume', () => {
  const s = mount(new Date().toISOString());
  assert.equal(s.intervals.size, 1);
  s.state('background');
  assert.equal(s.intervals.size, 0);
  const before = s.updates;
  s.state('active');
  assert.equal(s.updates, before + 1);
  assert.equal(s.intervals.size, 1);
  s.cleanup();
  assert.equal(s.intervals.size, 0);
  assert.equal(s.removed, true);
});
test('compact Hours clock preserves elapsed durations beyond 24 hours', () => {
  const s = mount(new Date(Date.now() - 90061000).toISOString(), false);
  assert.equal(s.tree.props.children, '25:01:01');
  s.cleanup();
});
test('future clock-in never displays negative elapsed time', () => {
  const s = mount(new Date(Date.now() + 60000).toISOString(), false);
  assert.equal(s.tree.props.children, '00:00:00');
  s.cleanup();
});
