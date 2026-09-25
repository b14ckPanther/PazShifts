import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const ts = createRequire(import.meta.url)('typescript');
const redirectHelpers = {};
runInNewContext(
  ts.transpileModule(readFileSync('packages/database/src/redirects.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: redirectHelpers }
);
const id = '7f0dd990-83d8-4588-b3dd-94bf860cdbaf';
async function run(
  path,
  { method = 'GET', user = true, station = { id, code: 'KURDANI' }, error = null } = {}
) {
  const calls = [];
  class Response {
    constructor(body, options) {
      this.status = options?.status;
      this.headers = new Headers();
      this.values = [];
      this.cookies = {
        set: (...args) =>
          this.values.push(args.length === 1 ? args[0] : { name: args[0], value: args[1] }),
        getAll: () => this.values,
      };
    }
    static next() {
      return new Response();
    }
    static redirect(url) {
      const r = new Response();
      r.kind = 'redirect';
      r.url = url;
      return r;
    }
    static rewrite(url, options) {
      const r = new Response();
      r.kind = 'rewrite';
      r.url = url;
      r.headers = options.request.headers;
      return r;
    }
  }
  const query = {
    select: () => query,
    eq: (key, value) => {
      calls.push([key, value]);
      return query;
    },
    returns: () => query,
    maybeSingle: async () => ({ data: station, error }),
  };
  const mocks = {
    'next/server': { NextResponse: Response },
    '@supabase/ssr': {
      createServerClient: (url, key, options) => ({
        auth: {
          getUser: async () => {
            options.cookies.setAll([{ name: 'session', value: 'renewed', options: {} }]);
            return { data: { user: user ? { id: 'fixture' } : null } };
          },
        },
        from: () => query,
      }),
    },
    '@yellowshifts/database': {
      isSupabaseConfigured: () => true,
      getSupabaseEnv: () => ({ url: 'fixture', anonKey: 'fixture' }),
      safeNextPath: redirectHelpers.safeNextPath,
    },
  };
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync('apps/web/middleware.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require: (name) => mocks[name], URL, decodeURIComponent, encodeURIComponent }
  );
  const url = new URL('https://admin.test' + path);
  url.clone = () => new URL(url);
  const result = await exports.middleware({
    nextUrl: url,
    method,
    headers: new Headers(),
    cookies: { getAll: () => [], set: () => {} },
  });
  return { result, calls };
}
test('worker legacy links preserve filters and canonicalize to station-code paths', async () => {
  const { result } = await run('/hours?stationId=' + id + '&from=2026-09-07');
  assert.equal(result.kind, 'redirect');
  assert.equal(result.url.pathname, '/stations/KURDANI/hours');
  assert.equal(result.url.search, '?from=2026-09-07');
  assert.equal(result.cookies.getAll()[0].value, 'renewed');
});
test('worker code URLs resolve every tab, preserving the UUID for reads and actions', async () => {
  for (const suffix of ['', '/home', '/hours', '/availability']) {
    for (const method of ['GET', 'POST']) {
      const { result, calls } = await run('/stations/KURDANI' + suffix + '?week=2026-09-07', {
        method,
      });
      assert.equal(result.kind, 'rewrite');
      assert.equal(result.url.pathname, suffix || '/');
      assert.equal(result.url.searchParams.get('stationId'), id);
      assert.equal(result.url.searchParams.get('week'), '2026-09-07');
      assert.deepEqual(calls, [['code', 'KURDANI']]);
      assert.equal(result.cookies.getAll()[0].value, 'renewed');
    }
  }
});
test('worker login return, denial, and legacy POST behavior are preserved', async () => {
  const { result, calls } = await run('/stations/KURDANI/hours', { user: false });
  assert.equal(result.url.pathname, '/login');
  assert.equal(result.url.searchParams.get('next'), '/stations/KURDANI/hours');
  assert.equal(calls.length, 0);
  assert.equal((await run('/stations/KURDANI', { station: null })).result.status, 404);
  assert.equal((await run('/stations/KURDANI', { error: {} })).result.status, 503);
  assert.equal((await run('/hours?stationId=' + id, { method: 'POST' })).calls.length, 0);
});

test('worker entry defaults to overview while explicit return destinations survive', async () => {
  assert.equal((await run('/login')).result.url.pathname, '/home');
  assert.equal(
    (await run('/login?next=/stations/KURDANI/hours')).result.url.pathname,
    '/stations/KURDANI/hours'
  );
});
