import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function mount() {
  let cursor = 0,
    dirty = true,
    tree,
    fail = false;
  const slots = [],
    effects = [],
    calls = [];
  const rows = [
    {
      id: 'n',
      type: 'SCHEDULE_PUBLISHED',
      title: 'סידור העבודה פורסם',
      body: 'מוכן לצפייה',
      created_at: '2026-09-13T12:00Z',
      read_at: null,
    },
  ];
  const api = {
    read: async () => {
      if (fail) throw Error('offline');
      return [...rows];
    },
    mark: async () => {
      calls.push('mark');
      rows.forEach((r) => (r.read_at = 'now'));
    },
  };
  const n = {
    enabled: true,
    refresh: async () => calls.push('refresh'),
    open: async (id, reveal) => {
      calls.push(id);
      reveal?.();
    },
  };
  const react = {
    createContext: () => ({}),
    useContext: () => api,
    useState(v) {
      const i = cursor++;
      slots[i] ??= { value: v };
      return [
        slots[i].value,
        (next) => {
          slots[i].value = typeof next === 'function' ? next(slots[i].value) : next;
          dirty = true;
        },
      ];
    },
    useCallback(fn, deps) {
      const i = cursor++,
        old = slots[i];
      if (!old || deps.some((d, j) => d !== old.deps[j])) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++,
        old = slots[i];
      if (!old || deps.some((d, j) => d !== old.deps[j]))
        effects.push(() => {
          old?.cleanup?.();
          slots[i] = { deps, cleanup: fn() };
        });
    },
  };
  const out = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL('../app/inbox.tsx', import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    {
      exports: out,
      require(name) {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime')
          return {
            jsx: (type, props) => ({ type, props }),
            jsxs: (type, props) => ({ type, props }),
          };
        if (name === 'react-native')
          return { View: 'View', Pressable: 'Pressable', RefreshControl: 'RefreshControl' };
        if (name === 'expo-router')
          return {
            router: { navigate: (v) => calls.push(v), replace: (v) => calls.push(v) },
            useFocusEffect: (fn) => react.useEffect(fn, [fn]),
          };
        if (name.startsWith('lucide-react-native/')) return { default: 'Icon' };
        if (name === '@yellowshifts/database/public') return {};
        if (name.endsWith('/SessionProvider')) return {};
        if (name.endsWith('/Provider')) return { useWorkerNotifications: () => n };
        if (name.endsWith('/notifications/UI')) return { NotificationSettings: 'Settings' };
        if (name.endsWith('/supabase')) return { supabase: {} };
        if (name.endsWith('/theme')) return { colors: {} };
        if (name.endsWith('/ui'))
          return Object.fromEntries(
            ['Screen', 'Label', 'Surface', 'Button', 'Message', 'Skeleton'].map((v) => [v, v])
          );
        throw Error(name);
      },
    }
  );
  const flatten = (node) =>
    !node || typeof node !== 'object'
      ? []
      : [node, ...[node.props?.children].flat(Infinity).flatMap(flatten)];
  return {
    calls,
    rows,
    setFail: (v) => {
      fail = v;
    },
    async flush() {
      for (let i = 0; i < 15; i++) {
        if (dirty) {
          cursor = 0;
          dirty = false;
          tree = out.Inbox();
          while (effects.length) effects.shift()();
        }
        await Promise.resolve();
      }
    },
    nodes: () => flatten(tree),
    press(title) {
      const button = flatten(tree).find((n) => n.props.title === title);
      assert.ok(button, title);
      button.props.onPress();
    },
    refresh() {
      tree.props.refreshControl.props.onRefresh();
    },
  };
}
test('inbox loads unread row, opens validated destination and marks all read', async () => {
  const app = mount();
  await app.flush();
  const row = app.nodes().find((n) => n.type === 'Pressable');
  assert.match(row.props.accessibilityLabel, /חדש/);
  row.props.onPress();
  await app.flush();
  assert.ok(app.calls.includes('n'));
  app.press('סימון הכול כנקרא');
  await app.flush();
  assert.ok(app.calls.includes('mark'));
  assert.match(app.nodes().find((n) => n.type === 'Pressable').props.accessibilityLabel, /נקרא/);
});
test('empty inbox explains the absence of updates', async () => {
  const app = mount();
  app.rows.length = 0;
  await app.flush();
  assert.ok(app.nodes().some((n) => n.props.children === 'הכול שקט כאן'));
});
test('refresh failure retains previous inbox and offers retry', async () => {
  const app = mount();
  await app.flush();
  app.setFail(true);
  app.refresh();
  await app.flush();
  assert.ok(app.nodes().some((n) => n.type === 'Pressable'));
  assert.ok(app.nodes().some((n) => n.props.title === 'ניסיון נוסף'));
  app.setFail(false);
  app.press('ניסיון נוסף');
  await app.flush();
  assert.ok(!app.nodes().some((n) => n.props.title === 'ניסיון נוסף'));
});

function bridge(initialStation = true) {
  const calls = [],
    target = { stationId: 'station', day: '2026-09-14' },
    ref = { current: null };
  let pending;
  const worker = {
    context: { stations: initialStation ? [{ id: 'station' }] : [] },
    openStation: (id, action) => {
      calls.push(id);
      pending = action;
    },
  };
  const out = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../src/notifications/UI.tsx', import.meta.url), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }
    ).outputText,
    {
      exports: out,
      require(name) {
        if (name === 'react') return { useEffect: (fn) => fn(), useRef: () => ref };
        if (name === './Provider')
          return {
            useWorkerNotifications: () => ({ target, consume: () => calls.push('consume') }),
          };
        if (name.endsWith('/WorkerProvider')) return { useWorker: () => worker };
        if (name.endsWith('/SessionProvider'))
          return { useSession: () => ({ retry: () => calls.push('retry') }) };
        if (name === 'expo-router') return { router: { navigate: (to) => calls.push(to) } };
        return {};
      },
    }
  );
  return { calls, worker, render: () => out.NotificationBridge(), confirm: () => pending() };
}
test('notification navigation uses the worker unsaved-change guard before changing route', () => {
  const b = bridge();
  b.render();
  assert.deepEqual(b.calls, ['consume', 'station']);
  b.confirm();
  assert.equal(b.calls[2].pathname, '/schedule');
  assert.equal(b.calls[2].params.day, '2026-09-14');
});
test('newly granted station refreshes shell context before navigation', () => {
  const b = bridge(false);
  b.render();
  assert.deepEqual(b.calls, ['retry']);
  b.worker.context = { stations: [{ id: 'station' }] };
  b.render();
  assert.deepEqual(b.calls, ['retry', 'consume', 'station']);
});
