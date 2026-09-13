import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
const jsx = (type, props) => ({ type, props });
function load(path, rtl) {
  const exports = {};
  const native = {
    I18nManager: { isRTL: rtl },
    View: 'View',
    Pressable: 'Pressable',
    Text: 'Text',
    Platform: { OS: 'ios' },
    StyleSheet: { create: (s) => s, flatten: (s) => s },
    PanResponder: { create: (handlers) => ({ panHandlers: handlers }) },
  };
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    {
      exports,
      require: (n) => {
        if (n === 'react') return { useMemo: (fn) => fn() };
        if (n === 'react-native') return native;
        if (n === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (n === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
        if (n.endsWith('theme')) return { colors: {}, fonts: {} };
        if (n === '@yellowshifts/reports') return { addDays: () => '' };
        if (n === './model') return { dateLabel: () => '' };
        if (n === '../ui') return { Label: 'Label', Button: 'Button' };
        return {};
      },
    }
  );
  return exports;
}
for (const rtl of [false, true]) {
  test(`Hebrew screen and text remain RTL with native isRTL=${rtl}; English stays LTR`, () => {
    const ui = load('../src/ui/index.tsx', rtl);
    assert.equal(ui.Screen({ children: 'login' }).props.style.direction, 'rtl');
    assert.equal(ui.Label({}).props.style[0].writingDirection, 'rtl');
    assert.equal(ui.Label({ english: true }).props.style[0].writingDirection, 'ltr');
    assert.equal(ui.Label({ english: true }).props.style[0].textAlign, 'auto');
  });
  test(`week buttons and swipe keep chronological meaning with native isRTL=${rtl}`, () => {
    const { WeekPicker } = load('../src/week/Patterns.tsx', rtl),
      changes = [];
    const tree = WeekPicker({
      week: '2026-09-14',
      change: (n) => changes.push(n),
      today: () => {},
    });
    assert.equal(tree.props.style.direction, 'rtl');
    const row = tree.props.children[0];
    row.props.children[0].props.onPress();
    row.props.children[2].props.onPress();
    tree.props.onPanResponderRelease(null, { dx: 90 });
    tree.props.onPanResponderRelease(null, { dx: -90 });
    assert.deepEqual(changes, [-1, 1, 1, -1]);
    assert.equal(row.props.children[0].props.children.props.children, '›');
    assert.equal(row.props.children[2].props.children.props.children, '‹');
  });
}
