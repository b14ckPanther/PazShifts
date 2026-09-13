import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
const compile = (p) =>
  ts.transpileModule(readFileSync(new URL(p, import.meta.url), 'utf8'), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
function load(p, mocks) {
  const exports = {};
  runInNewContext(compile(p), { exports, require: (n) => mocks[n] });
  return exports;
}
const reports = load('../../../packages/reports/src/hours-report.ts', {}),
  model = load('../src/week/model.ts', { '@yellowshifts/reports': reports });
function mount() {
  let index = 0,
    dirty = true,
    tree,
    guard,
    buttons,
    fail = false;
  const slots = [],
    effects = [];
  let saves = 0;
  const worker = {
    station: { id: 's', timezone: 'Asia/Jerusalem' },
    context: { userId: 'u' },
    setGuard: (g) => {
      guard = g;
    },
    refresh: () => {},
  };
  const react = {
    useRef(v) {
      const i = index++;
      return (slots[i] ??= { current: v });
    },
    useState(v) {
      const i = index++;
      slots[i] ??= { value: typeof v === 'function' ? v() : v };
      return [
        slots[i].value,
        (n) => {
          slots[i].value = typeof n === 'function' ? n(slots[i].value) : n;
          dirty = true;
        },
      ];
    },
    useCallback(fn, deps) {
      const i = index++;
      const old = slots[i];
      if (!old || deps.some((v, j) => v !== old.deps[j])) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = index++;
      const old = slots[i];
      if (!old || deps.some((v, j) => v !== old.deps[j]))
        effects.push(() => {
          old?.cleanup?.();
          slots[i] = { deps, cleanup: fn() };
        });
    },
  };
  const nav = { addListener: () => () => {}, dispatch: () => {} };
  const animation = { duration: () => animation, reduceMotion: () => animation };
  const api = {
    availability: async () => null,
    save: async (_c, _u, _s, week, entries) => {
      saves++;
      if (fail) throw Error('offline');
      return {
        week: { id: 'w', notes: null, weekStartDate: week, submittedAt: new Date().toISOString() },
        entries: entries.map((e) => ({ ...e, id: e.date })),
      };
    },
  };
  const m = load('../src/week/Availability.tsx', {
    react: react,
    'react/jsx-runtime': {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    'react-native': {
      View: 'View',
      Pressable: 'Pressable',
      Alert: {
        alert: (_a, _b, b) => {
          buttons = b;
        },
      },
      Platform: { OS: 'ios' },
      AccessibilityInfo: { announceForAccessibility: () => {} },
    },
    'expo-router': {
      useLocalSearchParams: () => ({}),
      useNavigation: () => nav,
      useFocusEffect: (fn) => react.useEffect(fn, [fn]),
    },
    '@react-native-community/datetimepicker': {},
    'react-native-reanimated': {
      default: { View: 'Animated' },
      FadeIn: animation,
      ReduceMotion: { System: 'system' },
    },
    'expo-haptics': {
      notificationAsync: async () => {},
      NotificationFeedbackType: { Success: 'success' },
    },
    '@yellowshifts/reports': reports,
    '@yellowshifts/database/public': load(
      '../../../packages/database/src/availability-status.ts',
      {}
    ),
    './Api': { useWeekApi: () => api },
    '../ui': {
      Screen: 'Screen',
      Label: 'Label',
      Button: 'Button',
      Message: 'Message',
      Skeleton: 'Skeleton',
    },
    '../ui/theme': { colors: {} },
    '../home/Patterns': { AppHeader: 'AppHeader' },
    '../home/WorkerProvider': { useWorker: () => worker },
    '../lib/supabase': { supabase: {} },
    './Patterns': { WeekPicker: 'WeekPicker', Sheet: 'Sheet', selection: () => {} },
    './model': model,
  });
  const render = () => {
    let count = 0;
    while (dirty) {
      if (count++ > 30) throw Error('render loop');
      dirty = false;
      index = 0;
      tree = m.default();
      while (effects.length) effects.shift()();
    }
    return tree;
  };
  const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
    render();
  };
  render();
  return {
    render,
    flush,
    guard: (fn) => guard(fn),
    get buttons() {
      return buttons;
    },
    get saves() {
      return saves;
    },
    fail: () => {
      fail = true;
    },
    recover: () => {
      fail = false;
    },
  };
}
function nodes(v) {
  if (!v || typeof v !== 'object') return [];
  if (Array.isArray(v)) return v.flatMap(nodes);
  return [v, ...nodes(v.props?.children), ...nodes(v.props?.footer)];
}
test('failed save retains draft; retry confirms saved state from server', async () => {
  const app = mount();
  await app.flush();
  const unavailable = nodes(app.render()).find((n) =>
    n.props?.accessibilityLabel?.endsWith(', לא זמין')
  );
  unavailable.props.onPress();
  app.render();
  app.fail();
  nodes(app.render())
    .find((n) => n.props?.title === 'שליחת הזמינות')
    .props.onPress();
  await app.flush();
  assert.equal(app.saves, 1);
  assert.ok(nodes(app.render()).some((n) => n.type === 'Message'));
  assert.equal(
    nodes(app.render()).find((n) => n.props?.accessibilityLabel?.endsWith(', לא זמין')).props
      .accessibilityState.checked,
    true
  );
  app.recover();
  nodes(app.render())
    .find((n) => n.props?.title === 'שליחת הזמינות')
    .props.onPress();
  await app.flush();
  assert.equal(app.saves, 2);
  assert.equal(
    nodes(app.render()).find((n) => n.props?.title === 'שמירת השינויים').props.disabled,
    true
  );
});
test('dirty week/tab change offers cancel, save or discard; clean navigation is immediate', async () => {
  const app = mount();
  await app.flush();
  let moved = 0;
  app.guard(() => moved++);
  assert.equal(moved, 1);
  nodes(app.render())
    .find((n) => n.props?.accessibilityLabel?.endsWith(', לא זמין'))
    .props.onPress();
  app.render();
  app.guard(() => moved++);
  assert.equal(moved, 1);
  assert.equal(app.buttons[0].style, 'cancel');
  app.buttons.find((b) => b.text === 'יציאה ללא שמירה').onPress();
  assert.equal(moved, 2);
});
