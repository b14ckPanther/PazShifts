import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
const stationId = '7f0dd990-83d8-4588-b3dd-94bf860cdbaf';
const stationCode = 'KIRYAT-ATA';

// Helper to compile and run middleware in VM
function createMiddlewareHarness({ cookies = [], dbStation = { id: stationId, code: stationCode } } = {}) {
  let redirectedUrl = null;
  let rewrittenUrl = null;
  let status = 200;

  class MockResponse {
    constructor(body, options) {
      this.status = options?.status ?? 200;
      this.headers = new Headers();
      this.cookies = {
        getAll: () => [],
        set: () => {}
      };
    }
    static next(options) {
      const r = new MockResponse();
      r.headers = options?.request?.headers ?? new Headers();
      return r;
    }
    static redirect(url, redirectStatus = 307) {
      const r = new MockResponse(null, { status: redirectStatus });
      redirectedUrl = url;
      return r;
    }
    static rewrite(url, options) {
      const r = new MockResponse();
      rewrittenUrl = url;
      r.headers = options?.request?.headers ?? new Headers();
      return r;
    }
  }

  const query = {
    select: () => query,
    eq: () => query,
    returns: () => query,
    maybeSingle: async () => ({ data: dbStation, error: null })
  };

  const deps = {
    'next/server': { NextResponse: MockResponse },
    '@supabase/ssr': {
      createServerClient: () => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: new Error('Invalid token') })
        },
        from: () => query
      })
    },
    '@yellowshifts/database': {
      isSupabaseConfigured: () => true,
      getSupabaseEnv: () => ({ url: 'https://test.supabase.co', anonKey: 'anon-key' }),
      safeNextPath: (p) => p || '/'
    }
  };

  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync('apps/admin/middleware.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText,
    {
      exports,
      require: (name) => deps[name],
      URL,
      Buffer,
      Headers,
      performance,
      decodeURIComponent,
      encodeURIComponent
    }
  );

  return {
    run: async (path, method = 'GET') => {
      redirectedUrl = null;
      rewrittenUrl = null;
      const url = new URL('https://admin.test' + path);
      url.clone = () => new URL(url);
      const res = await exports.middleware({
        nextUrl: url,
        method,
        headers: new Headers(),
        cookies: {
          getAll: () => cookies,
          set: () => {}
        }
      });
      return { res, redirectedUrl, rewrittenUrl };
    }
  };
}

// ---------------------------------------------------------------------------
// 1. Middleware Auth & Routing Tests
// ---------------------------------------------------------------------------

test('1. Unauthenticated request to protected route redirects to /login', async () => {
  const h = createMiddlewareHarness({ cookies: [] });
  const { res, redirectedUrl } = await h.run('/stations/' + stationCode);
  assert.equal(res.status, 307);
  assert.equal(redirectedUrl.pathname, '/login');
  assert.equal(redirectedUrl.searchParams.get('next'), '/stations/' + stationCode);
});

test('2. Expired auth cookie in middleware triggers refresh / unauthenticated redirect', async () => {
  const expiredSession = {
    access_token: 'expired_jwt',
    user: { id: 'user-1' },
    expires_at: Math.floor(Date.now() / 1000) - 300 // expired 5 mins ago
  };
  const cookieVal = 'base64-' + Buffer.from(JSON.stringify(expiredSession)).toString('base64');
  const h = createMiddlewareHarness({
    cookies: [{ name: 'sb-test-auth-token', value: cookieVal }]
  });
  const { res, redirectedUrl } = await h.run('/stations/' + stationCode);
  // Supabase getUser returns null in mock, so it must redirect to /login
  assert.equal(res.status, 307);
  assert.equal(redirectedUrl.pathname, '/login');
});

test('3. Canonical station code URL rewrites internally to UUID without 307 redirect', async () => {
  const validSession = {
    access_token: 'active_jwt',
    user: { id: 'user-1' },
    expires_at: Math.floor(Date.now() / 1000) + 3600
  };
  const cookieVal = 'base64-' + Buffer.from(JSON.stringify(validSession)).toString('base64');
  const h = createMiddlewareHarness({
    cookies: [{ name: 'sb-test-auth-token', value: cookieVal }]
  });
  const { res, redirectedUrl, rewrittenUrl } = await h.run('/stations/' + stationCode + '/schedules');
  assert.equal(redirectedUrl, null, 'Canonical code URL must NOT trigger an external redirect');
  assert.ok(rewrittenUrl, 'Canonical code URL must be rewritten internally');
  assert.equal(rewrittenUrl.pathname, '/stations/' + stationId + '/schedules');
});

test('4. Legacy UUID station URL 307-redirects to canonical station code', async () => {
  const validSession = {
    access_token: 'active_jwt',
    user: { id: 'user-1' },
    expires_at: Math.floor(Date.now() / 1000) + 3600
  };
  const cookieVal = 'base64-' + Buffer.from(JSON.stringify(validSession)).toString('base64');
  const h = createMiddlewareHarness({
    cookies: [{ name: 'sb-test-auth-token', value: cookieVal }]
  });
  const { res, redirectedUrl } = await h.run('/stations/' + stationId + '/schedules');
  assert.equal(res.status, 307);
  assert.ok(redirectedUrl);
  assert.equal(redirectedUrl.pathname, '/stations/' + stationCode + '/schedules');
});

// ---------------------------------------------------------------------------
// 2. Server Authorization & Action Scope Tests
// ---------------------------------------------------------------------------

function createServerActionHarness({
  user = { id: 'user-1' },
  isPlatformAdmin = false,
  memberships = []
} = {}) {
  const deps = {
    'next/headers': { cookies: async () => ({}) },
    'next/cache': { revalidatePath() {} },
    '@yellowshifts/database': {
      createServerSupabaseClient: () => ({}),
      getAuthenticatedUserContext: async () => {
        if (!user) return null;
        return {
          user,
          isPlatformAdmin,
          memberships: memberships.map(m => ({
            station: { id: m.stationId, code: m.stationCode ?? 'STA' },
            membership: { role: m.role, status: m.status ?? 'ACTIVE' }
          }))
        };
      },
      updateScheduleStatus: async () => ({ success: true }),
      assignStationMember: async () => ({ success: true }),
      canManageMember: (callerRole, targetRole) => callerRole === 'ADMIN' && targetRole !== 'ADMIN'
    }
  };

  const load = (path) => {
    const exports = {};
    runInNewContext(
      ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
      }).outputText,
      { exports, FormData, require: (n) => deps[n] }
    );
    return exports;
  };

  return {
    schedules: load('../apps/admin/app/actions/schedules.ts'),
    stations: load('../apps/admin/app/actions/stations.ts')
  };
}

test('5. Forged session (null server context) rejects server actions', async () => {
  const h = createServerActionHarness({ user: null });
  const res = await h.schedules.updateScheduleStatusAction(stationId, 'sched-1', 'PUBLISHED');
  assert.equal(res.success, false);
  assert.match(res.error, /התחברות/);
});

test('6. Non-member of station is rejected from station schedule actions', async () => {
  const h = createServerActionHarness({
    user: { id: 'user-1' },
    isPlatformAdmin: false,
    memberships: [{ stationId: 'different-station-id', role: 'ADMIN' }]
  });
  const res = await h.schedules.updateScheduleStatusAction(stationId, 'sched-1', 'PUBLISHED');
  assert.equal(res.success, false);
  assert.match(res.error, /אינך חבר פעיל בתחנה/);
});

test('7. Shift manager can publish schedule but cannot perform station admin actions', async () => {
  const h = createServerActionHarness({
    user: { id: 'user-1' },
    isPlatformAdmin: false,
    memberships: [{ stationId, role: 'SHIFT_MANAGER' }]
  });

  // Shift manager can publish schedule
  const schedRes = await h.schedules.updateScheduleStatusAction(stationId, 'sched-1', 'PUBLISHED');
  assert.equal(schedRes.success, true);

  // Shift manager cannot assign members (requires ADMIN)
  const memberRes = await h.stations.assignStationMemberAction(null, {
    stationId,
    userId: 'target-user',
    role: 'WORKER'
  });
  assert.equal(memberRes.success, false);
});

test('8. Station Admin has authority to manage station members', async () => {
  const h = createServerActionHarness({
    user: { id: 'user-1' },
    isPlatformAdmin: false,
    memberships: [{ stationId, role: 'ADMIN' }]
  });
  const memberRes = await h.stations.assignStationMemberAction(null, {
    stationId,
    userId: 'target-user',
    role: 'WORKER'
  });
  assert.equal(memberRes.success, true);
});

test('9. Platform Admin has global authority across any station', async () => {
  const h = createServerActionHarness({
    user: { id: 'platform-super' },
    isPlatformAdmin: true,
    memberships: [] // No direct station membership needed for Platform Admin
  });
  const schedRes = await h.schedules.updateScheduleStatusAction(stationId, 'sched-1', 'PUBLISHED');
  assert.equal(schedRes.success, true);

  const memberRes = await h.stations.assignStationMemberAction(null, {
    stationId,
    userId: 'target-user',
    role: 'ADMIN'
  });
  assert.equal(memberRes.success, true);
});
