import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@yellowshifts/types';
import { getSupabaseEnv, isSupabaseConfigured, safeNextPath } from '@yellowshifts/database';

declare global {
  var __paz_station_cache: Map<string, { id: string; code: string; timestamp: number }> | undefined;
}

const stationCache: Map<string, { id: string; code: string; timestamp: number }> =
  typeof globalThis !== 'undefined' && globalThis.__paz_station_cache
    ? globalThis.__paz_station_cache
    : typeof globalThis !== 'undefined'
      ? (globalThis.__paz_station_cache = new Map())
      : new Map();

function getTime(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export async function middleware(request: NextRequest) {
  const tStart = getTime();
  let cookieParseMs = 0;
  let sessionFastPath = false;
  let authNetworkCall = false;
  let authDurationMs = 0;
  let stationLookupMs = 0;
  let stationCacheHit = false;
  let fallbackReason = '';

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pathname = request.nextUrl.pathname;

  if (
    [
      // This exact server endpoint authenticates its scheduler bearer token in the route.
      '/api/internal/notifications',
      // Public lead intake validates and rate-limits on the server.
      '/api/station-interest',
      '/auth/logout',
    ].includes(pathname)
  ) {
    return response;
  }

  // If Supabase environment variables are missing, bypass to let the user view setup guidance
  if (!isSupabaseConfigured()) {
    return response;
  }

  const env = getSupabaseEnv();
  const isLoginPage = pathname.startsWith('/login');

  // Fast-path: Check for presence and validity of Supabase auth tokens in cookies
  const tCookie0 = getTime();
  const allCookies = request.cookies.getAll();
  const authChunks = allCookies
    .filter((c) => /-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => {
      const idxA = a.name.match(/\.(\d+)$/)?.[1];
      const idxB = b.name.match(/\.(\d+)$/)?.[1];
      return (idxA !== undefined ? parseInt(idxA, 10) : -1) - (idxB !== undefined ? parseInt(idxB, 10) : -1);
    });

  let cachedUser: { id: string; email?: string | null } | null = null;
  let needsRefresh = false;

  if (authChunks.length > 0) {
    try {
      let rawVal = authChunks.map((c) => c.value).join('');
      if (rawVal.includes('%')) {
        try {
          rawVal = decodeURIComponent(rawVal);
        } catch {
          // ignore decode error and proceed
        }
      }
      let jsonStr = rawVal;
      if (rawVal.startsWith('base64-')) {
        const b64 = rawVal.slice(7);
        try {
          jsonStr = Buffer.from(b64, 'base64url').toString('utf8');
        } catch {
          jsonStr = Buffer.from(b64, 'base64').toString('utf8');
        }
      }
      const session = JSON.parse(jsonStr);
      if (session?.access_token && session?.user) {
        const now = Math.floor(Date.now() / 1000);
        if (session.expires_at && session.expires_at <= now + 60) {
          needsRefresh = true;
          fallbackReason = 'expired-session';
        } else {
          cachedUser = session.user;
          sessionFastPath = true;
        }
      } else {
        needsRefresh = true;
        fallbackReason = 'missing-token-or-user';
      }
    } catch (err) {
      needsRefresh = true;
      fallbackReason = 'malformed-cookie: ' + (err instanceof Error ? err.message : String(err));
    }
  } else {
    fallbackReason = 'no-auth-cookies';
  }
  cookieParseMs = getTime() - tCookie0;

  let user = cachedUser;
  let supabase: ReturnType<typeof createServerClient<Database>> | null = null;

  // If token is missing, expired, or needs refresh, initialize Supabase client and refresh session
  if (!user || needsRefresh) {
    authNetworkCall = true;
    const tAuth0 = getTime();
    supabase = createServerClient<Database>(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user: refreshedUser },
    } = await supabase.auth.getUser();
    authDurationMs = getTime() - tAuth0;
    user = refreshedUser;
  }

  // Unauthenticated users attempting to access admin routes
  if (!user && !isLoginPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    const nextPath = request.nextUrl.pathname + request.nextUrl.search;
    if (nextPath && nextPath !== '/') {
      redirectUrl.searchParams.set('next', nextPath);
    }
    const redirected = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    logProxyStats();
    return redirected;
  }

  // Authenticated users attempting to access login page
  if (user && isLoginPage) {
    const nextPath = safeNextPath(request.nextUrl.searchParams.get('next'));
    const redirectUrl = new URL(nextPath, request.nextUrl.origin);
    const redirected = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    logProxyStats();
    return redirected;
  }

  // Handle station URLs:
  // Internal pages/actions continue receiving UUIDs.
  // Legacy UUID URLs 307-redirect to canonical codes.
  const stationPath = pathname.match(/^\/stations\/([^/]+)(.*)$/);
  if (user && stationPath?.[1] && stationPath[1] !== 'new') {
    let reference: string;
    try {
      reference = decodeURIComponent(stationPath[1]);
    } catch {
      return new NextResponse('Invalid station URL', { status: 400 });
    }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference);

    if (!isUuid || request.method === 'GET' || request.method === 'HEAD') {
      let station: { id: string; code: string };
      const cached = stationCache.get(reference);

      if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
        stationCacheHit = true;
        station = { id: cached.id, code: cached.code };
      } else {
        stationCacheHit = false;
        const tLookup0 = getTime();
        if (!supabase) {
          supabase = createServerClient<Database>(env.url, env.anonKey, {
            cookies: {
              getAll() {
                return request.cookies.getAll();
              },
              setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                response = NextResponse.next({
                  request: {
                    headers: request.headers,
                  },
                });
                cookiesToSet.forEach(({ name, value, options }) =>
                  response.cookies.set(name, value, options)
                );
              },
            },
          });
        }
        const { data: dbStation, error } = await supabase
          .from('stations')
          .select('id, code')
          .eq(isUuid ? 'id' : 'code', reference)
          .returns<{ id: string; code: string }[]>()
          .maybeSingle();

        stationLookupMs = getTime() - tLookup0;

        if (error || !dbStation) {
          const failed = new NextResponse(error ? 'Unable to load station' : 'Station not found', {
            status: error ? 503 : 404,
          });
          response.cookies.getAll().forEach((cookie) => failed.cookies.set(cookie));
          logProxyStats();
          return failed;
        }

        const typedStation = dbStation as unknown as { id: string; code: string };
        station = typedStation;
        stationCache.set(station.code, { id: station.id, code: station.code, timestamp: Date.now() });
        stationCache.set(station.id, { id: station.id, code: station.code, timestamp: Date.now() });
      }

      const safeCode =
        station.code !== 'new' &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(station.code);

      if (isUuid && safeCode) {
        const canonical = request.nextUrl.clone();
        canonical.pathname = '/stations/' + encodeURIComponent(station.code) + stationPath[2];
        const redirected = NextResponse.redirect(canonical, 307);
        response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
        logProxyStats();
        return redirected;
      }

      if (!isUuid) {
        const internal = request.nextUrl.clone();
        internal.pathname = '/stations/' + station.id + stationPath[2];
        const rewritten = NextResponse.rewrite(internal, { request: { headers: request.headers } });
        response.cookies.getAll().forEach((cookie) => rewritten.cookies.set(cookie));
        logProxyStats();
        return rewritten;
      }
    }
  }

  logProxyStats();
  return response;

  function logProxyStats() {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      const totalMs = (getTime() - tStart).toFixed(1);
      if (sessionFastPath && !authNetworkCall) {
        console.info(`[proxy]
cookieParse=${cookieParseMs.toFixed(1)}ms
sessionFastPath=true
authNetworkCall=false
stationCacheHit=${stationCacheHit}
total=${totalMs}ms`);
      } else {
        console.info(`[proxy]
sessionFastPath=false
reason=${fallbackReason || 'no-session'}
auth.getUser=${authDurationMs.toFixed(1)}ms
stationLookup=${stationLookupMs.toFixed(1)}ms
total=${totalMs}ms`);
      }
    }
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|ico)$).*)',
  ],
};
