import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
const { Response, Request, Headers } = globalThis;
const ts = createRequire(import.meta.url)('typescript');
function load(path, mocks, globals = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in mocks, name);
        return mocks[name];
      },
      Response,
      Buffer,
      URL,
      ...globals,
    }
  );
  return exports;
}
function middleware() {
  let authCalls = 0;
  const response = () => ({ kind: 'next', cookies: { getAll: () => [] } });
  const module = load('apps/admin/middleware.ts', {
    'next/server': {
      NextResponse: {
        next: response,
        redirect: (url) => ({ kind: 'redirect', url, cookies: { set() {} } }),
      },
    },
    '@supabase/ssr': {
      createServerClient: () => ({
        auth: {
          getUser: async () => {
            authCalls++;
            return { data: { user: null } };
          },
        },
      }),
    },
    '@yellowshifts/database': {
      isSupabaseConfigured: () => true,
      getSupabaseEnv: () => ({ url: 'fixture', anonKey: 'fixture' }),
    },
  });
  return { run: module.middleware, calls: () => authCalls };
}
function request(path) {
  const url = new URL(path, 'https://admin.example.test');
  url.clone = () => new URL(url);
  return { nextUrl: url, headers: new Headers(), cookies: { getAll: () => [] }, method: 'POST' };
}
test('scheduler reaches bearer-protected route without browser authentication', async () => {
  const m = middleware();
  assert.equal((await m.run(request('/api/internal/notifications'))).kind, 'next');
  assert.equal(m.calls(), 0);
});
for (const path of ['/api/internal/notifications/other', '/api/internal/other', '/stations']) {
  test(`browser protection remains for ${path}`, async () => {
    const m = middleware();
    const result = await m.run(request(path));
    assert.equal(result.kind, 'redirect');
    assert.equal(result.url.pathname, '/login');
    assert.equal(m.calls(), 1);
  });
}
test('dispatcher rejects missing/wrong credentials and dispatches only authorized enabled calls', async () => {
  const env = {
    NOTIFICATIONS_CRON_SECRET: 'fixture-secret',
    NOTIFICATIONS_ENABLED: 'true',
    NEXT_PUBLIC_SUPABASE_URL: 'fixture',
    SUPABASE_SERVICE_ROLE_KEY: 'fixture',
  };
  let dispatches = 0;
  const route = load(
    'apps/admin/app/api/internal/notifications/route.ts',
    {
      'node:crypto': { timingSafeEqual },
      '@supabase/supabase-js': { createClient: () => ({}) },
      '../../lib/notification-delivery': {
        dispatchNotifications: async () => {
          dispatches++;
          return { claimed: 0 };
        },
      },
    },
    { process: { env }, console: { info() {}, error() {} } }
  );
  for (const authorization of ['', 'Bearer wrong', 'Bearer fixture-secrex']) {
    assert.equal(
      (await route.POST(new Request('https://example.test', { headers: { authorization } })))
        .status,
      401
    );
  }
  assert.equal(dispatches, 0);
  const authorized = () =>
    new Request('https://example.test', { headers: { authorization: 'Bearer fixture-secret' } });
  assert.equal((await route.POST(authorized())).status, 200);
  assert.equal(dispatches, 1);
  env.NOTIFICATIONS_ENABLED = 'false';
  assert.deepEqual(await (await route.POST(authorized())).json(), { enabled: false });
  assert.equal(dispatches, 1);
});
