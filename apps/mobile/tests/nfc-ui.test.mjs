import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function mount({
  active = null,
  failure = false,
  receipt = null,
  owner = 'u',
  phase = 'ready',
} = {}) {
  let i = 0,
    dirty = true,
    tree;
  const slots = [],
    effects = [],
    calls = [];
  let pending = {
    token: '0123456789abcdef',
    scanId: '00000000-0000-4000-8000-000000000001',
    at: Date.now(),
    userId: owner,
  };
  const react = {
    createContext: () => ({}),
    useContext: () => api,
    useRef(v) {
      const n = i++;
      slots[n] ??= { current: v };
      return slots[n];
    },
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
  const station = { id: 's', name: 'תחנת בדיקה', timezone: 'Asia/Jerusalem' };
  const api = {
    read: async () => pending,
    save: async (v) => {
      pending = v;
    },
    clear: async () => {
      pending = null;
    },
    context: async () => ({ station, active, leftOpenHours: 12, receipt }),
    location: async () => ({}),
    submit: async (_c, _u, request) => {
      calls.push(request);
      if (failure === 'session') return { success: false, code: 'SESSION_EXPIRED' };
      if (failure) throw Error('NETWORK_ERROR');
      return {
        success: true,
        action: request.action,
        record: { clock_in_at: new Date().toISOString(), status: 'ACTIVE' },
      };
    },
  };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  const mocks = {
    react: react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Linking: {} },
    'expo-router': {
      Redirect: 'Redirect',
      router: { replace: () => {} },
      useLocalSearchParams: () => ({}),
    },
    'expo-haptics': { NotificationFeedbackType: { Success: 1 }, notificationAsync: async () => {} },
    '@yellowshifts/database/public': {},
    '../src/auth/SessionProvider': {
      useSession: () => ({ state: { phase, context: phase === 'ready' ? { userId: 'u' } : null } }),
    },
    '../src/lib/supabase': { supabase: {} },
    '../src/nfc/pending': {},
    '../src/nfc/location': {},
    '../src/nfc/errors': { nfcErrors: { NETWORK_ERROR: 'network', SESSION_EXPIRED: 'session' } },
    '../src/ui': Object.fromEntries(
      ['Screen', 'Label', 'Surface', 'Button', 'Message', 'Skeleton'].map((n) => [n, n])
    ),
    '../src/ui/theme': { colors: {} },
    '../src/nfc/events': { attendanceChanged: () => {} },
    '../src/location/runtime': { reconcileWorkerGeofences: async () => {} },
  };
  runInNewContext(
    ts.transpileModule(readFileSync(new URL('../app/attendance.tsx', import.meta.url), 'utf8'), {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: (n) => (n.startsWith('lucide-') ? { default: 'Icon' } : mocks[n]),
      Date,
      Intl,
    }
  );
  function render() {
    let runs = 0;
    while (dirty) {
      assert.ok(runs++ < 30);
      dirty = false;
      i = 0;
      tree = exports.default();
      while (effects.length) effects.shift()();
    }
    return tree;
  }
  async function flush() {
    for (let n = 0; n < 20; n++) await Promise.resolve();
    return render();
  }
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    return [node, ...[node.props?.children].flat().flatMap(nodes)];
  }
  render();
  return {
    flush,
    calls,
    pending: () => pending,
    button: (label) => nodes(tree).find((n) => n.type === 'Button' && n.props.title === label),
    tree: () => tree,
  };
}
test('loading a tag never mutates attendance; explicit confirmation uses one frozen intent', async () => {
  const ui = mount();
  await ui.flush();
  assert.equal(ui.calls.length, 0);
  const confirm = ui.button('אישור כניסה');
  assert.ok(confirm);
  confirm.props.onPress();
  confirm.props.onPress();
  await ui.flush();
  assert.equal(ui.calls.length, 1);
  assert.equal(ui.calls[0].action, 'CLOCK_IN');
  assert.equal(ui.pending().sent, true);
});
test('failed response preserves receipt and retry uses the same action and scan ID', async () => {
  const ui = mount({ failure: true });
  await ui.flush();
  ui.button('אישור כניסה').props.onPress();
  await ui.flush();
  ui.button('ניסיון חוזר לאותה סריקה').props.onPress();
  await ui.flush();
  assert.equal(ui.calls.length, 2);
  assert.deepEqual(ui.calls[0], ui.calls[1]);
  assert.ok(ui.pending().sent);
});
test('receipt recovery does not resubmit a confirmed operation', async () => {
  const ui = mount({
    receipt: {
      success: true,
      action: 'CLOCK_IN',
      record: { clock_in_at: new Date().toISOString(), status: 'ACTIVE' },
    },
  });
  await ui.flush();
  assert.equal(ui.calls.length, 0);
  assert.ok(ui.button('למסך שלי'));
});
test('checkout freezes the authoritative active record ID', async () => {
  const ui = mount({
    active: { id: 'record', station_id: 's', clock_in_at: new Date().toISOString() },
  });
  await ui.flush();
  ui.button('אישור יציאה').props.onPress();
  await ui.flush();
  assert.equal(ui.calls[0].recordId, 'record');
  assert.equal(ui.calls[0].action, 'CLOCK_OUT');
});
test('different station or different pending account cannot confirm', async () => {
  for (const options of [
    { active: { id: 'r', station_id: 'other', clock_in_at: new Date().toISOString() } },
    { owner: 'other' },
  ]) {
    const ui = mount(options);
    await ui.flush();
    assert.equal(ui.button('אישור כניסה'), undefined);
    assert.equal(ui.button('אישור יציאה'), undefined);
    assert.equal(ui.calls.length, 0);
  }
});
test('signed-out entry retains only a safe internal login destination', () => {
  const ui = mount({ phase: 'signedOut' });
  assert.equal(ui.tree().props.href, '/login?next=attendance');
});

test('expired server session offers explicit reauthentication without another attendance write', async () => {
  const ui = mount({ failure: 'session' });
  await ui.flush();
  ui.button('אישור כניסה').props.onPress();
  await ui.flush();
  assert.ok(ui.button('התחברות מחדש'));
  assert.equal(ui.calls.length, 1);
});
