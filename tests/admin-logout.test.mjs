import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const ts = createRequire(import.meta.url)('typescript');
function load(signOut) {
  const exports = {};
  const source = readFileSync(
    new URL('../apps/admin/app/auth/logout/route.ts', import.meta.url),
    'utf8'
  );
  class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status;
      this.headers = new Headers(init.headers);
    }
    static redirect(url, status) {
      return new Response(null, { status, headers: { Location: String(url) } });
    }
  }
  const mocks = {
    'next/headers': { cookies: async () => ({}) },
    'next/server': { NextResponse: Response },
    '@yellowshifts/database': { createServerSupabaseClient: () => ({ auth: { signOut } }) },
  };
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require: (n) => mocks[n], URL }
  );
  return exports.POST;
}
const request = (origin = 'https://admin.example.com') => ({
  headers: new Headers({ origin }),
  nextUrl: new URL('https://admin.example.com/auth/logout'),
  url: 'https://admin.example.com/auth/logout',
});
test('logout signs out only this session and issues a fresh 303 login navigation', async () => {
  let calls = 0;
  const post = load(async (options) => {
    calls++;
    assert.equal(options.scope, 'local');
    return { error: null };
  });
  const response = await post(request());
  assert.equal(calls, 1);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), 'https://admin.example.com/login');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('cross-origin logout is rejected before touching the session', async () => {
  const response = await load(() => assert.fail('signout'))(request('https://other.example'));
  assert.equal(response.status, 403);
});
test('failed logout gives a retry instead of falsely reporting success or throwing into RSC', async () => {
  const response = await load(async () => {
    throw Error('secret server details');
  })(request());
  assert.equal(response.status, 503);
  assert(!response.body.includes('secret'));
  assert(response.body.includes('נסו שוב'));
});
