import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
const tabs = ['index', 'schedule', 'availability', 'hours', 'profile'].map((name, i) => ({
  name,
  label: ['בית', 'משמרות', 'זמינות', 'שעות', 'פרופיל'][i],
}));
function moduleAt(path, mocks = {}, initial = []) {
  let cursor = 0;
  const state = [...initial],
    exports = {};
  const animation = { duration: () => animation, reduceMotion: () => animation };
  const jsx = (type, props) => ({ type, props });
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    {
      exports,
      require(name) {
        if (name in mocks) return mocks[name];
        if (name === 'react')
          return {
            useEffect: () => {},
            useState: (value) => {
              const i = cursor++;
              if (!(i in state)) state[i] = value;
              return [
                state[i],
                (next) => {
                  state[i] = next;
                },
              ];
            },
          };
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (name === 'react-native')
          return {
            View: 'View',
            Image: 'Image',
            Pressable: 'Pressable',
            Modal: 'Modal',
            ScrollView: 'ScrollView',
          };
        if (name === 'react-native-reanimated')
          return {
            default: { View: 'Animated' },
            FadeIn: animation,
            ReduceMotion: { System: 'system' },
            useReducedMotion: () => true,
          };
        if (name === 'react-native-safe-area-context')
          return { useSafeAreaInsets: () => ({ bottom: 34 }) };
        if (name.endsWith('/ui'))
          return {
            Screen: 'Screen',
            Button: 'Button',
            Label: 'Label',
            Message: 'Message',
            Skeleton: 'Skeleton',
          };
        if (name.endsWith('/theme')) return { colors: {} };
        if (name.endsWith('/model'))
          return {
            tabs,
            onboardingKey: 'ys.onboarding.v1',
            onboardingDone: (value) => value === 'complete',
          };
        if (name.includes('lucide') || name.endsWith('.png')) return {};
        throw Error(name);
      },
    }
  );
  return {
    exports,
    render(fn) {
      cursor = 0;
      return fn();
    },
    state,
  };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => find(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...find(tree.props?.children, predicate)];
}
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
test('onboarding completion persists before entering Home; write failure stays retryable', async () => {
  const saved = new Map();
  let completed = 0,
    fail = true;
  const m = moduleAt('../src/home/Onboarding.tsx', {
    'expo-secure-store': {
      setItemAsync: async (key, value) => {
        if (fail) throw Error('storage');
        saved.set(key, value);
      },
    },
  });
  const render = () => m.render(() => m.exports.Onboarding({ done: () => completed++ }));
  const skip = () => find(render(), (n) => n.props?.title === 'ישר לחשבון שלי')[0].props.onPress();
  skip();
  await settle();
  assert.equal(completed, 0);
  assert.equal(saved.size, 0);
  assert.equal(find(render(), (n) => n.type === 'Message').length, 1);
  fail = false;
  skip();
  await settle();
  assert.equal(saved.get('ys.onboarding.v1'), 'complete');
  assert.equal(completed, 1);
});
test('tab semantics, selected state, haptic navigation and cancelled presses', () => {
  const visited = [];
  let haptics = 0,
    prevent = false;
  const m = moduleAt('../src/home/TabBar.tsx', {
    'expo-haptics': { selectionAsync: async () => haptics++ },
  });
  const tree = m.exports.TabBar({
    state: { index: 0, routes: tabs.map((t) => ({ name: t.name, key: t.name })) },
    navigation: {
      emit: () => ({ defaultPrevented: prevent }),
      navigate: (name) => visited.push(name),
    },
  });
  const controls = find(tree, (n) => n.props?.accessibilityRole === 'tab');
  assert.equal(controls.length, 5);
  assert.equal(controls[0].props.accessibilityState.selected, true);
  controls[0].props.onPress();
  assert.equal(visited.length, 0);
  controls[3].props.onPress();
  assert.deepEqual(visited, ['hours']);
  assert.equal(haptics, 1);
  prevent = true;
  controls[2].props.onPress();
  assert.equal(visited.length, 1);
  for (const button of controls) assert.ok(button.props.accessibilityLabel);
});
test('authenticated shell guards signed-out, pending and failed sessions before tabs', () => {
  for (const [phase, expected] of [
    ['signedOut', 'Redirect'],
    ['loading', 'Screen'],
    ['error', 'Screen'],
    ['ready', 'WorkerProvider'],
  ]) {
    const m = moduleAt(
      '../app/(app)/_layout.tsx',
      {
        'expo-router': {
          Redirect: 'Redirect',
          Tabs: Object.assign(() => {}, { Screen: 'TabScreen' }),
        },
        'expo-secure-store': {},
        '../../src/auth/SessionProvider': {
          useSession: () => ({
            state: { phase, context: { userId: 'a' } },
            retry() {},
            logout() {},
          }),
        },
        '../../src/home/WorkerProvider': { WorkerProvider: 'WorkerProvider' },
        '../../src/home/Onboarding': { Onboarding: 'Onboarding' },
        '../../src/home/TabBar': { TabBar: 'TabBar' },
      },
      [true, false]
    );
    assert.equal(m.exports.default().type, expected);
  }
});
test('one station has no picker; multiple stations expose a labeled native sheet', () => {
  for (const count of [1, 2]) {
    const m = moduleAt('../src/home/Patterns.tsx', {
      './WorkerProvider': {
        useWorker: () => ({
          context: {
            fullName: 'בדיקה',
            stations: Array.from({ length: count }, (_, i) => ({
              id: String(i),
              name: 'תחנה',
              role: 'WORKER',
            })),
          },
          station: { id: '0', name: 'תחנה' },
          select() {},
        }),
      },
      'expo-haptics': {},
    });
    const tree = m.exports.AppHeader();
    assert.equal(
      find(tree, (n) => n.props?.accessibilityLabel?.startsWith('החלפת תחנה')).length,
      count > 1 ? 1 : 0
    );
    assert.equal(find(tree, (n) => n.props?.accessibilityRole === 'radio').length, count);
    assert.equal(find(tree, (n) => n.props?.accessibilityViewIsModal).length, 1);
  }
});

test('Home shows the availability action only when submission is missing', () => {
  for (const submitted of [true, false]) {
    const m = moduleAt('../app/(app)/index.tsx', {
      'expo-router': { useRouter: () => ({ navigate() {} }) },
      '@yellowshifts/reports': { duration: () => '00:00:00', addDays: () => '2026-09-14' },
      '../../src/home/WorkerProvider': {
        useWorker: () => ({
          context: { fullName: 'בדיקה' },
          data: {
            shifts: [],
            week: '2026-09-07',
            confirmedSeconds: 0,
            availabilitySubmitted: submitted,
            reviewCount: 0,
          },
        }),
      },
      '../../src/home/Patterns': {
        AppHeader: 'AppHeader',
        DataState: 'DataState',
        RefreshStamp: 'RefreshStamp',
        WebAction: 'WebAction',
      },
      '../../src/home/Hero': { Hero: 'Hero' },
    });
    const tree = m.exports.default();
    assert.equal(find(tree, (n) => n.type === 'WebAction').length, submitted ? 0 : 1);
  }
});
