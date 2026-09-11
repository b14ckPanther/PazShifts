import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@yellowshifts/types';
import { getSupabaseEnv, isSupabaseConfigured } from '@yellowshifts/database';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

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

  // Unauthenticated users attempting to access admin routes
  if (!user && !isLoginPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    const nextPath = request.nextUrl.pathname + request.nextUrl.search;
    if (nextPath && nextPath !== '/') {
      redirectUrl.searchParams.set('next', nextPath);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // Authenticated users attempting to access login page
  if (user && isLoginPage) {
    const rawNext = request.nextUrl.searchParams.get('next');
    const isSafeNext =
      rawNext &&
      rawNext.startsWith('/') &&
      !rawNext.startsWith('//') &&
      !rawNext.startsWith('/\\') &&
      !rawNext.includes(':');

    const redirectUrl = request.nextUrl.clone();
    if (isSafeNext) {
      const [pathname, search] = rawNext.split('?');
      redirectUrl.pathname = pathname || '/';
      redirectUrl.search = search ? `?${search}` : '';
    } else {
      redirectUrl.pathname = '/';
      redirectUrl.search = '';
    }
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
