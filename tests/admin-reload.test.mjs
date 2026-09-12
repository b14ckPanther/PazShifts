import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const ts = createRequire(import.meta.url)('typescript');
function load(path, mocks = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (n) => mocks[n],
      URL,
      Request,
      TypeError,
      DOMException,
      setTimeout: (fn) => setTimeout(fn, 0),
    }
  );
  return exports;
}
const { createReadFetch } = load('packages/database/src/read-fetch.ts');
test('transient database GET retries once, preserving request options, then returns fresh result', async () => {
  let calls = 0;
  const options = { headers: { authorization: 'fixture' } };
  const f = createReadFetch('https://fixture.test', async (input, init) => {
    assert.equal(init, options);
    return new Response(++calls === 1 ? 'unavailable' : 'ok', { status: calls === 1 ? 503 : 200 });
  });
  assert.equal(await (await f('https://fixture.test/rest/v1/stations', options)).text(), 'ok');
  assert.equal(calls, 2);
});
test('auth, mutations, RPCs and non-transient errors are never retried; persistent failures remain visible', async () => {
  for (const [path, method, status, expected] of [
    ['/auth/v1/token', 'POST', 503, 1],
    ['/rest/v1/rpc/process_nfc_scan', 'GET', 503, 1],
    ['/rest/v1/rpc/process_nfc_scan', 'POST', 503, 1],
    ['/rest/v1/stations', 'PATCH', 503, 1],
    ['/rest/v1/stations', 'GET', 403, 1],
    ['/rest/v1/stations', 'GET', 500, 1],
    ['/rest/v1/stations', 'GET', 503, 2],
  ]) {
    let calls = 0;
    const f = createReadFetch('https://fixture.test', async () => {
      calls++;
      return new Response('', { status });
    });
    assert.equal((await f('https://fixture.test' + path, { method })).status, status);
    assert.equal(calls, expected);
  }
  let calls = 0;
  const f = createReadFetch('https://fixture.test', async () => {
    calls++;
    throw new TypeError('network');
  });
  await assert.rejects(f('https://fixture.test/rest/v1/stations'));
  assert.equal(calls, 2);
});
test('cancelled reads are not retried', async () => {
  const controller = new AbortController();
  let calls = 0;
  const f = createReadFetch('https://fixture.test', async () => {
    calls++;
    controller.abort();
    throw new TypeError('network');
  });
  await assert.rejects(f('https://fixture.test/rest/v1/stations', { signal: controller.signal }));
  assert.equal(calls, 1);
});
test('both admin redirect paths preserve refreshed cookies', async () => {
  const response = () => {
    const values = [];
    return {
      cookies: {
        set: (...v) => values.push(v.length === 1 ? v[0] : { name: v[0], value: v[1] }),
        getAll: () => values,
      },
    };
  };
  for (const user of [null, { id: 'fixture' }]) {
    const mocks = {
      'next/server': { NextResponse: { next: response, redirect: response } },
      '@supabase/ssr': {
        createServerClient: (a, b, options) => ({
          auth: {
            getUser: async () => {
              options.cookies.setAll([
                { name: 'session-fixture', value: 'refreshed', options: { httpOnly: true } },
              ]);
              return { data: { user } };
            },
          },
        }),
      },
      '@yellowshifts/database': {
        getSupabaseEnv: () => ({ url: 'https://fixture.test', anonKey: 'fixture' }),
        isSupabaseConfigured: () => true,
        safeNextPath: () => '/',
      },
    };
    const { middleware } = load('apps/admin/middleware.ts', mocks);
    const url = new URL(user ? 'https://admin.test/login' : 'https://admin.test/stations');
    url.clone = () => new URL(url);
    const result = await middleware({
      nextUrl: url,
      headers: new Headers(),
      cookies: { getAll: () => [], set: () => {} },
    });
    assert.equal(result.cookies.getAll()[0].value, 'refreshed');
  }
});
