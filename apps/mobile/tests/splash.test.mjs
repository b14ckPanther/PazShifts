import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function mount(reduced) {
  const timers = [],
    targets = [],
    exports = {};
  let effect,
    hidden = 0,
    done = 0,
    cleared = 0;
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../src/ui/LaunchSplash.tsx', import.meta.url), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }
    ).outputText,
    {
      exports,
      setTimeout: (fn, ms) => {
        timers.push({ fn, ms });
        return 1;
      },
      clearTimeout: () => {
        cleared++;
      },
      require: (name) => {
        if (name === 'react')
          return {
            useState: () => [true, () => {}],
            useEffect: (fn) => {
              effect = fn;
            },
          };
        if (name === 'react-native')
          return { StyleSheet: { create: (s) => s, absoluteFillObject: {} } };
        if (name === 'expo-splash-screen')
          return {
            hideAsync: () => {
              hidden++;
              return Promise.resolve();
            },
          };
        if (name === 'react-native-reanimated')
          return {
            default: { View: 'View', Image: 'Image' },
            useReducedMotion: () => reduced,
            useSharedValue: (value) => ({ value }),
            useAnimatedStyle: (fn) => fn(),
            cancelAnimation: () => {},
            Easing: { inOut: (x) => x, out: (x) => x, cubic: 0 },
            withTiming: (value) => {
              targets.push(value);
              return value;
            },
            withSequence: () => 1,
            withDelay: (_, value) => value,
          };
        if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
        if (name === './theme') return { colors: { yellow: '#FCBC00' } };
        return {};
      },
    }
  );
  const tree = exports.LaunchSplash({
    onDone: () => {
      done++;
    },
  });
  const cleanup = effect();
  return {
    tree,
    timers,
    targets,
    cleanup,
    get hidden() {
      return hidden;
    },
    get done() {
      return done;
    },
    get cleared() {
      return cleared;
    },
  };
}
test('launch releases native cover and completes without a worklet completion callback', () => {
  const s = mount(false);
  assert.equal(s.hidden, 1);
  assert.ok(s.targets.includes(360));
  assert.equal(s.timers[0].ms, 840);
  s.timers[0].fn();
  assert.equal(s.done, 1);
});
test('reduced motion skips the flip and uses a short reveal', () => {
  const s = mount(true);
  assert.equal(s.targets.includes(360), false);
  assert.equal(s.timers[0].ms, 160);
  s.timers[0].fn();
  assert.equal(s.done, 1);
});
test('unmount cancels pending launch completion', () => {
  const s = mount(false);
  s.cleanup();
  assert.equal(s.cleared, 1);
  assert.equal(s.done, 0);
});

test('launch overlay fills its parent without deprecated native style helpers', () => {
  const { tree } = mount(false);
  const style = tree.props.style[0];
  assert.equal(style.position, 'absolute');
  for (const edge of ['top', 'right', 'bottom', 'left']) assert.equal(style[edge], 0);
});
