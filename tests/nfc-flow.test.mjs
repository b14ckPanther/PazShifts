import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(path, dependencies = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(source, {
    exports,
    console,
    crypto: webcrypto,
    URL,
    Date,
    ...globals,
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}
function request(path, method = 'GET', headers = {}) {
  const url = new URL(path, 'https://worker.example.com');
  url.clone = () => new URL(url);
  return {
    nextUrl: url,
    method,
    headers: new Headers(headers),
    cookies: { getAll: () => [], set() {} },
  };
}
function middlewareHarness(user = null, configured = true) {
  const response = () => ({ cookies: { getAll: () => [], set() {} }, headers: new Headers() });
  return load('../apps/web/middleware.ts', {
    'next/server': {
      NextResponse: {
        next: () => ({ ...response(), kind: 'next' }),
        redirect: (url) => ({ ...response(), kind: 'redirect', url: String(url) }),
      },
    },
    '@supabase/ssr': {
      createServerClient: () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
    },
    '@yellowshifts/database': {
      isSupabaseConfigured: () => configured,
      getSupabaseEnv: () => ({ url: 'fixture', anonKey: 'fixture' }),
      safeNextPath: (value) => value || '/',
    },
  }).middleware;
}

test('bare tag gets unique receipt URL; login preserves it; refreshed receipt keeps it', async () => {
  const middleware = middlewareHarness();
  const first = await middleware(request('/nfc/token'));
  const second = await middleware(request('/nfc/token'));
  assert.equal(first.kind, 'redirect');
  const firstUrl = new URL(first.url);
  assert.notEqual(firstUrl.searchParams.get('scan'), new URL(second.url).searchParams.get('scan'));
  assert.ok(firstUrl.searchParams.get('at'));
  assert.equal(first.headers.get('Cache-Control'), 'no-store');
  const login = await middleware(request(first.url));
  assert.equal(new URL(login.url).pathname, '/login');
  assert.equal(new URL(login.url).searchParams.get('next'), firstUrl.pathname + firstUrl.search);
  const authenticated = middlewareHarness({ id: 'worker' });
  assert.equal((await authenticated(request(first.url))).kind, 'next');
});

test('prefetch, RSC and HEAD do not issue a scan receipt', async () => {
  const middleware = middlewareHarness({ id: 'worker' });
  for (const req of [
    request('/nfc/token', 'HEAD'),
    request('/nfc/token', 'GET', { purpose: 'prefetch' }),
    request('/nfc/token', 'GET', { 'next-router-prefetch': '1' }),
    request('/nfc/token', 'GET', { rsc: '1' }),
  ]) {
    assert.equal((await middleware(req)).kind, 'next');
  }
});

test('scan action requires session and forwards the same id on retries; no manual clock-out action', async () => {
  const calls = [];
  let user = null;
  const module = load('../apps/web/app/actions/attendance.ts', {
    'next/headers': { cookies: async () => ({}) },
    'next/cache': { revalidatePath() {} },
    '@yellowshifts/database': {
      createServerSupabaseClient: () => ({
        auth: { getUser: async () => ({ data: { user } }) },
        rpc: async (...args) => {
          calls.push(args);
          return { data: { success: false, code: 'NO_MEMBERSHIP' }, error: null };
        },
      }),
    },
  });
  assert.equal(module.clockOutAction, undefined);
  assert.equal(module.clockInAction, undefined);
  const id = webcrypto.randomUUID();
  assert.equal(
    (await module.processNfcScanAction('token', id, Date.now())).code,
    'SESSION_EXPIRED'
  );
  assert.equal(calls.length, 0);
  user = { id: 'worker' };
  await module.processNfcScanAction('token', id, Date.now());
  await module.processNfcScanAction('token', id, Date.now());
  assert.equal(calls[0][0], 'process_nfc_scan');
  assert.equal(calls[0][1].p_scan_id, calls[1][1].p_scan_id);
  assert.equal(
    (await module.processNfcScanAction('token', 'invalid', Date.now())).code,
    'INVALID_SCAN'
  );
  assert.equal(calls.length, 2);
});

test('service worker never caches or replays attendance writes or authenticated pages', async () => {
  const handlers = {};
  const cached = [];
  let response;
  runInNewContext(readFileSync(new URL('../apps/web/public/sw.js', import.meta.url), 'utf8'), {
    self: {
      addEventListener: (name, handler) => {
        handlers[name] = handler;
      },
      location: { origin: 'https://worker.example.com' },
    },
    URL,
    Response,
    fetch: async () => new Response('live'),
    caches: {
      open: async () => ({ add: async (path) => cached.push(path) }),
      match: async () => new Response('offline'),
    },
  });
  await new Promise((resolve) => handlers.install({ waitUntil: resolve }));
  assert.deepEqual(cached, ['/offline.html']);
  handlers.fetch({
    request: { method: 'POST', mode: 'navigate', url: 'https://worker.example.com/nfc/token' },
    respondWith: () => assert.fail('Must not intercept writes'),
  });
  handlers.fetch({
    request: { method: 'GET', mode: 'navigate', url: 'https://worker.example.com/login' },
    respondWith: (value) => {
      response = value;
    },
  });
  assert.equal(await (await response).text(), 'live');
  assert.deepEqual(cached, ['/offline.html']);
});
