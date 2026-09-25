import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@yellowshifts/types';
import { getSupabaseEnv, isSupabaseConfigured, safeNextPath } from '@yellowshifts/database';

declare global {
  var __paz_station_cache: Map<string, { id: string; code: string; timestamp: number }> | undefined;
}

const stationCache =
  globalThis.__paz_station_cache ||
  (globalThis.__paz_station_cache = new Map<
    string,
    { id: string; code: string; timestamp: number }
  >());

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (
    [
      '/.well-known/apple-app-site-association',
      '/.well-known/assetlinks.json',
      '/privacy/yellowshifts',
      '/support/yellowshifts',
      '/fonts/Heebo-Regular.ttf',
      '/fonts/Heebo-OFL.txt',
    ].includes(request.nextUrl.pathname)
  )
    return response;

  // The physical tag keeps its bare URL. Each fresh navigation gets a stable receipt URL.
  // Refresh/back/retries keep that ID, so they cannot toggle attendance again.
  const isNfc = /^\/nfc\/[^/]+$/.test(request.nextUrl.pathname);
  const isPrefetch =
    request.headers.has('next-router-prefetch') || request.headers.get('purpose') === 'prefetch';
  if (
    request.method === 'GET' &&
    isNfc &&
    !isPrefetch &&
    !request.headers.has('rsc') &&
    !request.nextUrl.searchParams.has('scan')
  ) {
    const destination = request.nextUrl.clone();
    destination.searchParams.set('scan', crypto.randomUUID());
    destination.searchParams.set('at', String(Date.now()));
    const redirectResponse = NextResponse.redirect(destination, 307);
    redirectResponse.headers.set('Cache-Control', 'no-store');
    return redirectResponse;
  }

  // If Supabase environment variables are missing, bypass to let the user view setup guidance
  if (!isSupabaseConfigured()) {
    return response;
  }

  const env = getSupabaseEnv();

  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

  // Fast-path: Check for presence and validity of Supabase auth tokens in cookies
  const allCookies = request.cookies.getAll();
  const authChunks = allCookies
    .filter((c) => /-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => {
      const idxA = a.name.match(/\.(\d+)$/)?.[1];
      const idxB = b.name.match(/\.(\d+)$/)?.[1];
      return (
        (idxA !== undefined ? parseInt(idxA, 10) : -1) -
        (idxB !== undefined ? parseInt(idxB, 10) : -1)
      );
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
        } else {
          cachedUser = session.user;
        }
      } else {
        needsRefresh = true;
      }
    } catch {
      needsRefresh = true;
    }
  }

  let user = cachedUser;
  let supabase: ReturnType<typeof createServerClient<Database>> | null = null;

  if (!user || needsRefresh) {
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
    user = refreshedUser;
  }

  // Unauthenticated users attempting to access operational routes
  if (!user && !isLoginPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    const nextPath = request.nextUrl.pathname + request.nextUrl.search;
    if (nextPath && nextPath !== '/') {
      redirectUrl.searchParams.set('next', nextPath);
    }
    const redirected = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    redirected.headers.set('Cache-Control', 'no-store');
    return redirected;
  }

  // Authenticated users attempting to access login page
  if (user && isLoginPage) {
    const nextPath = safeNextPath(request.nextUrl.searchParams.get('next'));
    const redirectUrl = new URL(nextPath, request.nextUrl.origin);
    const redirected = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    redirected.headers.set('Cache-Control', 'no-store');
    return redirected;
  }

  // Public station-code paths; internal pages/actions still receive UUIDs.
  const friendly = request.nextUrl.pathname.match(
    /^\/stations\/([^/]+)(?:\/(home|hours|availability))?\/?$/
  );
  const legacy = ['/', '/home', '/hours', '/availability'].includes(request.nextUrl.pathname);
  const reference =
    friendly?.[1] || (legacy ? request.nextUrl.searchParams.get('stationId') : null);
  if (user && reference) {
    let value: string;
    try {
      value = friendly ? decodeURIComponent(reference) : reference;
    } catch {
      return new NextResponse('Invalid station URL', { status: 400 });
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    // Legacy POSTs keep their action target. Friendly POSTs rewrite, never redirect.
    if (friendly || request.method === 'GET' || request.method === 'HEAD') {
      let station: { id: string; code: string };
      const cached = stationCache.get(value);
      if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
        station = { id: cached.id, code: cached.code };
      } else {
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
          .eq(uuid ? 'id' : 'code', value)
          .returns<{ id: string; code: string }[]>()
          .maybeSingle();

        if (error || !dbStation) {
          const failed = new NextResponse(error ? 'Unable to load station' : 'Station not found', {
            status: error ? 503 : 404,
          });
          response.cookies.getAll().forEach((cookie) => failed.cookies.set(cookie));
          return failed;
        }

        station = dbStation;
        stationCache.set(station.code, {
          id: station.id,
          code: station.code,
          timestamp: Date.now(),
        });
        stationCache.set(station.id, { id: station.id, code: station.code, timestamp: Date.now() });
      }

      const destination = request.nextUrl.clone();
      let routed: NextResponse;
      if (friendly) {
        destination.pathname = friendly[2] ? '/' + friendly[2] : '/';
        destination.searchParams.set('stationId', station.id);
        routed = NextResponse.rewrite(destination, { request: { headers: request.headers } });
      } else {
        destination.pathname =
          '/stations/' +
          encodeURIComponent(station.code) +
          (request.nextUrl.pathname === '/' ? '' : request.nextUrl.pathname);
        destination.searchParams.delete('stationId');
        routed = NextResponse.redirect(destination, 307);
      }
      response.cookies.getAll().forEach((cookie) => routed.cookies.set(cookie));
      routed.headers.set('Cache-Control', 'no-store');
      return routed;
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|ico)$).*)',
  ],
};
