import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
const tick = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
function mount() {
  const slots = [],
    effects = [],
    requests = [],
    timers = new Set();
  let index = 0,
    dirty = true,
    value;
  const context = { userId: 'worker', stations: [{ id: 'a' }, { id: 'b' }] };
  const exports = {};
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState(initial) {
      const i = index++;
      slots[i] ??= { value: initial };
      return [
        slots[i].value,
        (next) => {
          slots[i].value = typeof next === 'function' ? next(slots[i].value) : next;
          dirty = true;
        },
      ];
    },
    useRef(initial) {
      const i = index++;
      slots[i] ??= { current: initial };
      return slots[i];
    },
    useEffect(fn, deps) {
      const i = index++;
      const old = slots[i];
      if (!old || deps.some((v, n) => v !== old.deps[n])) {
        effects.push(() => {
          old?.cleanup?.();
          slots[i] = { deps, cleanup: fn() };
        });
      }
    },
  };
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../src/home/WorkerProvider.tsx', import.meta.url), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }
    ).outputText,
    {
      exports,
      setInterval: (fn) => {
        timers.add(fn);
        return fn;
      },
      clearInterval: (fn) => timers.delete(fn),
      require(name) {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx: (_type, props) => props };
        if (name === 'react-native') return { AppState: { currentState: 'active' } };
        if (name === '../lib/supabase') return { supabase: {} };
        if (name === '../nfc/events') return { onAttendanceChanged: () => () => {} };
        if (name === './model')
          return {
            selectStation: (allowed, selected) =>
              allowed.find((s) => s.id === selected)?.id ?? allowed[0]?.id ?? null,
          };
        if (name === '@yellowshifts/database/public')
          return {
            getMobileHome: (_client, _user, station) =>
              new Promise((resolve, reject) => requests.push({ station, resolve, reject })),
          };
        throw Error(name);
      },
    }
  );
  function render() {
    while (dirty) {
      dirty = false;
      index = 0;
      value = exports.WorkerProvider({ context, children: null }).value;
      while (effects.length) effects.shift()();
    }
  }
  render();
  return {
    requests,
    get value() {
      render();
      return value;
    },
    async flush() {
      await tick();
      render();
    },
    close() {
      slots.forEach((s) => s?.cleanup?.());
    },
    timers,
  };
}
test('switching stations rejects a late previous response and arbitrary selection', async () => {
  const app = mount();
  app.value.select('b');
  assert.equal(app.value.station.id, 'b');
  app.requests[1].resolve({ stationId: 'b' });
  await app.flush();
  app.requests[0].resolve({ stationId: 'a' });
  await app.flush();
  assert.equal(app.value.data.stationId, 'b');
  app.value.select('unknown');
  assert.equal(app.value.station.id, 'b');
  app.value.select('b');
  assert.equal(app.value.data.stationId, 'b');
  assert.equal(app.requests.length, 2);
  app.close();
  assert.equal(app.timers.size, 0);
});
test('refresh failure clears previously displayed private data and exposes retry state', async () => {
  const app = mount();
  app.requests[0].resolve({ stationId: 'a' });
  await app.flush();
  app.value.refresh();
  assert.equal(app.value.data.stationId, 'a');
  app.requests[1].reject(Error('revoked'));
  await app.flush();
  assert.equal(app.value.data, null);
  assert.equal(app.value.error, true);
  app.close();
});
