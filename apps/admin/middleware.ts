import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@yellowshifts/types';
import { getSupabaseEnv, isSupabaseConfigured, safeNextPath } from '@yellowshifts/database';

const stationCache = new Map<string, { id: string; code: string; timestamp: number }>();

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (
    [
      // This exact server endpoint authenticates its scheduler bearer token in the route.
      '/api/internal/notifications',
      // Public lead intake validates and rate-limits on the server.
      '/api/station-interest',
      '/auth/logout',
      '/manifest.webmanifest',
      '/sw.js',
      '/offline.html',
      '/fonts/Heebo-Regular.ttf',
      '/fonts/Heebo-OFL.txt',
    ].includes(request.nextUrl.pathname)
  )
    return response;

  // If Supabase environment variables are missing, bypass to let the user view setup guidance
  if (!isSupabaseConfigured()) {
    return response;
  }

  const env = getSupabaseEnv();

  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

  // Fast-path: Check for presence and validity of Supabase auth tokens in cookies
  const allCookies = request.cookies.getAll();
  const authChunks = allCookies
    .filter((c) => c.name.includes('-auth-token'))
    .sort((a, b) => a.name.localeCompare(b.name));

  let cachedUser: { id: string; email?: string | null } | null = null;
  let needsRefresh = false;

  if (authChunks.length > 0) {
    try {
      const rawVal = authChunks.map((c) => c.value).join('');
      let jsonStr = rawVal;
      if (rawVal.startsWith('base64-')) {
        jsonStr = Buffer.from(rawVal.slice(7), 'base64').toString('utf8');
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

  // If token is missing, expired, or needs refresh, initialize Supabase client and refresh session
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
    return redirected;
  }

  // Authenticated users attempting to access login page
  if (user && isLoginPage) {
    const nextPath = safeNextPath(request.nextUrl.searchParams.get('next'));
    const redirectUrl = new URL(nextPath, request.nextUrl.origin);
    const redirected = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    return redirected;
  }

  // Resolve readable station URLs with RLS-scoped client or lightweight in-memory cache.
  // Internal pages/actions continue receiving UUIDs; no permission logic changes.
  const stationPath = request.nextUrl.pathname.match(/^\/stations\/([^/]+)(.*)$/);
  if (user && stationPath?.[1] && stationPath[1] !== 'new') {
    let reference: string;
    try {
      reference = decodeURIComponent(stationPath[1]);
    } catch {
      return new NextResponse('Invalid station URL', { status: 400 });
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference);
    // Leave legacy mutation URLs intact. Never redirect/replay a POST.
    if (!uuid || request.method === 'GET' || request.method === 'HEAD') {
      let station: { id: string; code: string };
      const cached = stationCache.get(reference);
      if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
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
          .eq(uuid ? 'id' : 'code', reference)
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
        stationCache.set(station.code, { id: station.id, code: station.code, timestamp: Date.now() });
        stationCache.set(station.id, { id: station.id, code: station.code, timestamp: Date.now() });
      }

      // Reserved/UUID-shaped codes retain the legacy URL to avoid ambiguous routes.
      const safeCode =
        station.code !== 'new' &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(station.code);
      if (uuid && safeCode) {
        const canonical = request.nextUrl.clone();
        canonical.pathname = '/stations/' + encodeURIComponent(station.code) + stationPath[2];
        const redirected = NextResponse.redirect(canonical, 307);
        response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
        return redirected;
      }
      if (!uuid) {
        const internal = request.nextUrl.clone();
        internal.pathname = '/stations/' + station.id + stationPath[2];
        const rewritten = NextResponse.rewrite(internal, { request: { headers: request.headers } });
        response.cookies.getAll().forEach((cookie) => rewritten.cookies.set(cookie));
        return rewritten;
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
