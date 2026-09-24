import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function load(path, mocks = {}, extra = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in mocks, name);
        return mocks[name];
      },
      ...extra,
    }
  );
  return exports;
}
const contract = load('../../../packages/database/src/station-interest.ts');
const valid = {
  full_name: 'בדיקת מערכת',
  phone: '+972 50-1234567',
  station_name_or_number: 'תחנת בדיקה',
  city: 'חיפה',
  email: '',
  role: '',
  notes: '',
};
test('required fields, length bounds, mobile normalization, email and role validation', () => {
  assert.equal(contract.validateStationInterest(valid).value.phone, '0501234567');
  for (const key of ['full_name', 'phone', 'station_name_or_number', 'city'])
    assert.ok(contract.validateStationInterest({ ...valid, [key]: '' }).errors[key]);
  for (const [key, value] of [
    ['email', 'bad'],
    ['role', 'administrator'],
    ['notes', 'a'.repeat(1001)],
    ['full_name', 'a\u202eb'],
  ])
    assert.ok(contract.validateStationInterest({ ...valid, [key]: value }).errors[key]);
});
function mount(send) {
  let cursor = 0,
    tree;
  const slots = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial };
      return [
        slots[index].value,
        (next) => {
          slots[index].value = typeof next === 'function' ? next(slots[index].value) : next;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      slots[index] ??= { current: initial };
      return slots[index];
    },
    useEffect() {},
  };
  const jsx = (type, props) => ({ type, props });
  const transition = {
    duration() {
      return this;
    },
    delay() {
      return this;
    },
    reduceMotion() {
      return this;
    },
  };
  const native = Object.fromEntries(
    ['Modal', 'View', 'Pressable', 'ScrollView', 'KeyboardAvoidingView'].map((k) => [k, k])
  );
  const mocks = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      ...native,
      Platform: { OS: 'ios' },
      Keyboard: { dismiss() {} },
      AccessibilityInfo: { announceForAccessibility() {}, setAccessibilityFocus() {} },
      findNodeHandle: () => null,
      Linking: {},
      StyleSheet: { create: (v) => v, absoluteFill: {} },
    },
    'react-native-reanimated': {
      default: { View: 'AnimatedView' },
      useSharedValue: (v) => react.useRef(v),
      useReducedMotion: () => false,
      useAnimatedStyle: () => ({}),
      withSpring: (v) => v,
      withTiming: (v, _, done) => {
        done?.(true);
        return v;
      },
      runOnJS: (fn) => fn,
      FadeInDown: transition,
      ReduceMotion: { System: 0 },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'expo-haptics': {
      selectionAsync: async () => {},
      notificationAsync: async () => {},
      NotificationFeedbackType: { Success: 1 },
    },
    'expo-crypto': { randomUUID: () => '00000000-0000-4000-8000-000000000024' },
    'expo-constants': { default: { expoConfig: { version: '1.0.0' } } },
    '@yellowshifts/database/public': contract,
    '../ui': Object.fromEntries(['Button', 'Field', 'Label', 'Message'].map((k) => [k, k])),
    '../ui/theme': { colors: {}, fonts: {} },
    './api': { sendStationInterest: send },
  };
  for (const name of [
    'arrow-left',
    'building',
    'calendar-days',
    'clock-3',
    'users',
    'check',
    'plus',
    'x',
  ])
    mocks['lucide-react-native/icons/' + name] = { default: name };
  const Component = load('../src/acquisition/StationInterest.tsx', mocks, {
    setTimeout,
    clearTimeout,
  }).StationInterestEntry;
  const render = () => {
    cursor = 0;
    tree = Component({ send });
    return tree;
  };
  const all = (node) =>
    !node
      ? []
      : Array.isArray(node)
        ? node.flatMap((n) => all(n))
        : typeof node === 'object'
          ? [node, ...all(node.props?.children ?? null)]
          : [];
  const find = (type, predicate = () => true) =>
    all(tree).find((n) => n.type === type && predicate(n.props));
  render();
  return {
    render,
    find,
    all: () => all(tree),
    open: () => {
      find('Pressable', (p) => p.accessibilityHint)?.props.onPress();
      render();
    },
    fill: () => {
      for (const [key, label] of Object.entries({
        full_name: 'שם מלא',
        phone: 'טלפון נייד',
        station_name_or_number: 'שם התחנה או מספר התחנה',
        city: 'עיר / יישוב',
      })) {
        find('Field', (p) => p.label === label).props.onChangeText(valid[key]);
        render();
      }
    },
    submit: () => find('Button', (p) => p.title === 'בואו נדבר על התחנה שלכם').props.onPress(),
  };
}
test('secondary CTA intentionally opens/closes RTL sheet without submission', () => {
  let calls = 0;
  const m = mount(async () => {
    calls++;
  });
  assert.equal(m.find('Modal').props.visible, false);
  m.open();
  assert.equal(m.find('Modal').props.visible, true);
  assert.ok(m.find('KeyboardAvoidingView'));
  assert.equal(
    m.find('Pressable', (p) => p.accessibilityHint).props.style({ pressed: false })[0].direction,
    'rtl'
  );
  m.find('Modal').props.onRequestClose();
  m.render();
  assert.equal(m.find('Modal').props.visible, false);
  assert.equal(calls, 0);
});
test('inline errors prevent empty submission', () => {
  let calls = 0;
  const m = mount(async () => {
    calls++;
  });
  m.open();
  m.submit();
  m.render();
  assert.equal(calls, 0);
  assert.ok(
    m.all().filter((n) => n.type === 'Label' && n.props.accessibilityLiveRegion === 'polite')
      .length >= 4
  );
});
test('duplicate-submit guard, busy dismissal, persistent success and reset', async () => {
  let resolve,
    calls = 0;
  const m = mount(() => {
    calls++;
    return new Promise((r) => {
      resolve = r;
    });
  });
  m.open();
  m.fill();
  const submit = m.submit;
  m.submit();
  submit();
  m.render();
  assert.equal(calls, 1);
  assert.equal(m.find('Button', (p) => p.busy).props.busy, true);
  m.find('Modal').props.onRequestClose();
  m.render();
  assert.equal(m.find('Modal').props.visible, true);
  resolve();
  await new Promise((r) => setImmediate(r));
  m.render();
  assert.ok(m.find('Button', (p) => p.title === 'סגור'));
  assert.equal(m.find('Modal').props.visible, true);
  m.find('Button', (p) => p.title === 'סגור').props.onPress();
  m.render();
  m.open();
  assert.equal(m.find('Field', (p) => p.label === 'שם מלא').props.value, '');
});
test('server failure preserves fields and permits retry', async () => {
  const m = mount(async () => {
    throw Error('offline');
  });
  m.open();
  m.fill();
  m.submit();
  await new Promise((r) => setImmediate(r));
  m.render();
  assert.ok(m.find('Message'));
  assert.equal(m.find('Field', (p) => p.label === 'שם מלא').props.value, valid.full_name);
  assert.ok(m.find('Button', (p) => p.title === 'בואו נדבר על התחנה שלכם'));
});
test('login retains worker primary action; acquisition has no automatic open or native capability changes', () => {
  const source = readFileSync(new URL('../app/(auth)/login.tsx', import.meta.url), 'utf8');
  assert.ok(source.indexOf('<StationInterestEntry') > source.indexOf('</Surface>'));
  assert.match(source, /supabase.auth.signInWithPassword/);
});

test('mobile transport sends only the lead contract and accepts explicit acknowledgement', async () => {
  const { sendStationInterest } = load(
    '../src/acquisition/api.ts',
    {},
    { AbortController, setTimeout, clearTimeout }
  );
  let sent;
  await sendStationInterest(valid, 'request', 'ios', '1.0.0', async (url, options) => {
    sent = JSON.parse(options.body);
    assert.equal(url, 'https://admin.paz.darb.co.il/api/station-interest');
    assert.equal(options.headers.Authorization, undefined);
    return { ok: true, json: async () => ({ accepted: true }) };
  });
  assert.equal(sent.platform, 'ios');
  assert.equal(sent.request_id, 'request');
});
test('mobile transport handles rate limits and rejects an ambiguous success response', async () => {
  const { sendStationInterest } = load(
    '../src/acquisition/api.ts',
    {},
    { AbortController, setTimeout, clearTimeout }
  );
  await assert.rejects(
    sendStationInterest(valid, 'request', 'ios', '1.0.0', async () => ({ status: 429 })),
    /שעה/
  );
  await assert.rejects(
    sendStationInterest(valid, 'request', 'ios', '1.0.0', async () => ({
      ok: true,
      json: async () => ({}),
    })),
    /לא אושרה/
  );
});
