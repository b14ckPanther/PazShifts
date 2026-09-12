import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
const tick = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
function mount({
  session = { user: { id: 'a' } },
  context = async (_c, id) => ({ fullName: id, stations: [] }),
  signOut = async () => ({ error: null }),
} = {}) {
  let state,
    authEvent,
    appEvent,
    cleanup,
    unsubscribed = false,
    removed = false,
    starts = 0,
    stops = 0;
  const timers = [];
  const auth = {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: (callback) => {
      authEvent = callback;
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              unsubscribed = true;
            },
          },
        },
      };
    },
    startAutoRefresh: () => {
      starts++;
    },
    stopAutoRefresh: () => {
      stops++;
    },
    signOut,
  };
  const exports = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../src/auth/SessionProvider.tsx', import.meta.url), 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }
    ).outputText,
    {
      exports,
      setTimeout: (fn) => {
        timers.push(fn);
      },
      require: (name) => {
        if (name === 'react')
          return {
            createContext: () => ({ Provider: 'provider' }),
            useCallback: (fn) => fn,
            useRef: (value) => ({ current: value }),
            useState: (value) => {
              state = value;
              return [
                value,
                (next) => {
                  state = typeof next === 'function' ? next(state) : next;
                },
              ];
            },
            useEffect: (fn) => {
              timers.push(() => {
                cleanup = fn();
              });
            },
          };
        if (name === 'react/jsx-runtime') return { jsx: (_type, props) => props };
        if (name === 'react-native')
          return {
            AppState: {
              currentState: 'active',
              addEventListener: (_event, fn) => {
                appEvent = fn;
                return {
                  remove: () => {
                    removed = true;
                  },
                };
              },
            },
          };
        if (name === '../lib/supabase') return { supabase: { auth } };
        if (name === '@yellowshifts/database/public') return { getNativeWorkerContext: context };
        throw Error(name);
      },
    }
  );
  const actions = exports.SessionProvider({ children: null }).value;
  return {
    actions,
    get state() {
      return state;
    },
    async flush() {
      while (timers.length) timers.shift()();
      await tick();
    },
    emit: (event, value) => authEvent(event, value),
    app: (value) => appEvent(value),
    close: () => cleanup(),
    metrics: () => ({ unsubscribed, removed, starts, stops }),
  };
}
test('restoration validates context; foreground refresh and listeners clean up', async () => {
  const app = mount();
  await app.flush();
  assert.equal(app.state.phase, 'ready');
  assert.equal(app.state.context.fullName, 'a');
  app.app('background');
  app.app('active');
  await app.flush();
  app.close();
  assert.deepEqual(app.metrics(), { unsubscribed: true, removed: true, starts: 2, stops: 2 });
});
test('slow previous account response cannot overwrite newly signed-in account', async () => {
  let finish;
  const app = mount({
    context: async (_c, id) =>
      id === 'a'
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : { fullName: 'b', stations: [] },
  });
  await app.flush();
  app.emit('SIGNED_IN', { user: { id: 'b' } });
  await app.flush();
  assert.equal(app.state.context.fullName, 'b');
  finish({ fullName: 'a', stations: [] });
  await tick();
  assert.equal(app.state.context.fullName, 'b');
});
test('sign-out event clears context and ignores an older in-flight read', async () => {
  let finish;
  const app = mount({
    context: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  await app.flush();
  app.emit('SIGNED_OUT', null);
  await app.flush();
  finish({ fullName: 'a', stations: [] });
  await tick();
  assert.equal(app.state.phase, 'signedOut');
  assert.equal(app.state.context, null);
});
test('failed logout stays explicit and clears private presentation data', async () => {
  const app = mount({
    signOut: async (options) => {
      assert.equal(options.scope, 'local');
      return { error: Error('offline') };
    },
  });
  await app.flush();
  await app.actions.logout();
  assert.equal(app.state.phase, 'error');
  assert.equal(app.state.context, null);
});

test('same-account foreground verification preserves the mounted app until checked, then clears revoked access', async () => {
  let calls = 0,
    reject;
  const app = mount({
    context: async () =>
      ++calls === 1
        ? { userId: 'a', fullName: 'a', stations: [] }
        : new Promise((_resolve, fail) => {
            reject = fail;
          }),
  });
  await app.flush();
  app.app('active');
  await app.flush();
  assert.equal(app.state.phase, 'ready');
  reject(Error('revoked'));
  await tick();
  assert.equal(app.state.phase, 'error');
  assert.equal(app.state.context, null);
});
