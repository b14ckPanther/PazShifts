import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function load(p, mocks = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(p, import.meta.url), 'utf8'), {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { exports, require: (n) => mocks[n] }
  );
  return exports;
}
const reports = load('../../../packages/reports/src/hours-report.ts');
const model = load('../src/hours/model.ts', { '@yellowshifts/reports': reports });
function mount(params = {}) {
  let i = 0,
    dirty = true,
    tree,
    fail = false,
    scope = false,
    deferred = null;
  const slots = [],
    effects = [];
  const react = {
    createContext: () => ({}),
    useContext: () => api,
    useState(v) {
      const n = i++;
      slots[n] ??= { value: v };
      return [
        slots[n].value,
        (next) => {
          slots[n].value = typeof next === 'function' ? next(slots[n].value) : next;
          dirty = true;
        },
      ];
    },
    useCallback(fn, deps) {
      const n = i++,
        old = slots[n];
      if (!old || deps.some((v, j) => v !== old.deps[j])) slots[n] = { fn, deps };
      return slots[n].fn;
    },
    useMemo(fn) {
      return fn();
    },
    useEffect(fn, deps) {
      const n = i++,
        old = slots[n];
      if (!old || deps.some((v, j) => v !== old.deps[j]))
        effects.push(() => {
          old?.cleanup?.();
          slots[n] = { deps, cleanup: fn() };
        });
    },
  };
  class ScopeError extends Error {}
  const api = async (_c, station, period) => {
    if (deferred)
      await new Promise((resolve) => {
        deferred.resolve = resolve;
      });
    if (fail) throw scope ? new ScopeError() : Error('offline');
    return {
      stationId: station,
      timezone: 'Asia/Jerusalem',
      from: period.anchor || '2026-09-07',
      to: '2026-09-13',
      today: '2026-09-13',
      generatedAt: '2026-09-13T00:00Z',
      weekStartsOn: 1,
      active: null,
      entries: [],
    };
  };
  const worker = {
    station: { id: 'a', name: 'A', timezone: 'Asia/Jerusalem' },
    context: { userId: 'u' },
  };
  const anim = { duration: () => anim, reduceMotion: () => anim };
  const mod = load('../src/hours/Hours.tsx', {
    react,
    'react/jsx-runtime': {
      jsx: (type, props, key) => ({ type, props, key }),
      jsxs: (type, props, key) => ({ type, props, key }),
    },
    'react-native': {
      View: 'View',
      Pressable: 'Pressable',
      RefreshControl: 'RefreshControl',
      Platform: { OS: 'ios' },
      I18nManager: { isRTL: true },
    },
    'expo-router': {
      useLocalSearchParams: () => params,
      useFocusEffect: (fn) => react.useEffect(fn, [fn]),
    },
    'react-native-reanimated': {
      default: { View: 'Animated' },
      FadeIn: anim,
      ReduceMotion: { System: 0 },
    },
    '@yellowshifts/reports': reports,
    '@yellowshifts/database/public': { getMobileWorkerHours: api, HoursScopeError: ScopeError },
    '../home/WorkerProvider': { useWorker: () => worker },
    '../home/Hero': { Elapsed: 'Elapsed', nativeTime: () => '12:00' },
    '../lib/supabase': { supabase: {} },
    '../ui': Object.fromEntries(
      ['Screen', 'Label', 'Surface', 'Button', 'Skeleton', 'Message'].map((n) => [n, n])
    ),
    '../ui/theme': { colors: {} },
    '../week/Patterns': { Sheet: 'Sheet', selection: () => {} },
    '../week/model': { dateLabel: (d) => d, validDay: reports.validDate },
    './model': model,
  });
  const render = () => {
    let runs = 0;
    while (dirty) {
      if (runs++ > 30) throw Error('loop');
      dirty = false;
      i = 0;
      const root = mod.default();
      tree = root.type(root.props);
      while (effects.length) effects.shift()();
    }
    return tree;
  };
  const flush = async () => {
    for (let n = 0; n < 15; n++) await Promise.resolve();
    return render();
  };
  render();
  return {
    render,
    flush,
    worker,
    root: () => mod.default(),
    refresh: () => {
      tree.props.refreshControl.props.onRefresh();
      render();
    },
    fail: (v, auth = false) => {
      fail = v;
      scope = auth;
    },
    hold: () => {
      deferred = {};
    },
    release: () => {
      deferred.resolve();
      deferred = null;
    },
  };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
test('refresh pending retains same report; network failure is non-destructive; access failure clears it', async () => {
  const h = mount();
  await h.flush();
  assert.ok(nodes(h.render()).some((n) => n.props?.children === 'שעות נוכחות שהושלמו'));
  h.hold();
  h.refresh();
  assert.equal(h.render().props.refreshControl.props.refreshing, true);
  h.release();
  await h.flush();
  h.fail(true);
  h.refresh();
  await h.flush();
  assert.ok(
    nodes(h.render()).some((n) =>
      String(n.props?.children).includes('מוצגים הנתונים מהטעינה האחרונה')
    )
  );
  h.fail(true, true);
  h.refresh();
  await h.flush();
  assert.equal(
    nodes(h.render()).some((n) => n.props?.children === 'שעות נוכחות שהושלמו'),
    false
  );
});
test('period change hides previous period immediately and station/account changes remount private state', async () => {
  const h = mount();
  await h.flush();
  h.hold();
  const button = nodes(h.render()).find(
    (n) => n.type === 'Pressable' && n.props.children?.props?.children === 'שבוע קודם'
  );
  button.props.onPress();
  h.render();
  assert.equal(
    nodes(h.render()).some((n) => n.props?.children === 'שעות נוכחות שהושלמו'),
    false
  );
  h.release();
  await h.flush();
  assert.equal(h.root().key, 'u:a');
  h.worker.station.id = 'b';
  assert.equal(h.root().key, 'u:b');
  h.worker.context.userId = 'other';
  assert.equal(h.root().key, 'other:b');
});

test('completed-shift Home destination opens the exact check-in date', async () => {
  const h = mount({ day: '2026-09-12' });
  await h.flush();
  assert.equal(
    JSON.stringify(h.root().props.initialPeriod),
    JSON.stringify({ mode: 'custom', from: '2026-09-12', to: '2026-09-12' })
  );
  assert.ok(h.root().key.endsWith(':2026-09-12'));
});
