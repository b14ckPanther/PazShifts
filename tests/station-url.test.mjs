import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const ts = createRequire(import.meta.url)('typescript');
const id = '7f0dd990-83d8-4588-b3dd-94bf860cdbaf';
async function run(
  path,
  { method = 'GET', user = true, station = { id, code: 'KURDANI' }, error = null } = {}
) {
  const calls = [];
  class Response {
    constructor(body, options) {
      this.status = options?.status;
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
      safeNextPath: () => '/',
    },
  };
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync('apps/admin/middleware.ts', 'utf8'), {
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
test('legacy station URLs redirect with subroutes, filters and refreshed cookies intact', async () => {
  const { result } = await run('/stations/' + id + '/reports?from=2026-09-07');
  assert.equal(result.kind, 'redirect');
  assert.equal(result.url.pathname, '/stations/KURDANI/reports');
  assert.equal(result.url.search, '?from=2026-09-07');
  assert.equal(result.cookies.getAll()[0].value, 'renewed');
});
test('code URLs rewrite GET and POST to UUID without replaying mutations', async () => {
  for (const method of ['GET', 'POST']) {
    const { result, calls } = await run('/stations/KURDANI/staff', { method });
    assert.equal(result.kind, 'rewrite');
    assert.equal(result.url.pathname, '/stations/' + id + '/staff');
    assert.deepEqual(calls, [['code', 'KURDANI']]);
    assert.equal(result.cookies.getAll()[0].value, 'renewed');
  }
  const { result, calls } = await run('/stations/' + id, { method: 'POST' });
  assert.equal(result.kind, undefined);
  assert.equal(calls.length, 0);
});
test('unauthorized and missing stations are not resolved; errors fail closed', async () => {
  const { result, calls } = await run('/stations/KURDANI', { user: false });
  assert.equal(result.url.pathname, '/login');
  assert.equal(calls.length, 0);
  assert.equal(result.url.searchParams.get('next'), '/stations/KURDANI');
  assert.equal((await run('/stations/KURDANI', { station: null })).result.status, 404);
  assert.equal((await run('/stations/KURDANI', { error: {} })).result.status, 503);
  assert.equal((await run('/stations/new')).calls.length, 0);
});
