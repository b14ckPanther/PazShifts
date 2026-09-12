import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@yellowshifts/types';
import { getSupabaseEnv, isSupabaseConfigured, safeNextPath } from '@yellowshifts/database';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (['/fonts/Heebo-Regular.ttf', '/fonts/Heebo-OFL.txt'].includes(request.nextUrl.pathname))
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

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
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
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

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

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
