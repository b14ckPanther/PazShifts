import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@yellowshifts/types';
import { getSupabaseEnv } from './env';

export interface MiddlewareRequestAdapter {
  cookies: {
    getAll: () => Array<{ name: string; value: string }>;
    set: (name: string, value: string, options: CookieOptions) => void;
  };
}

export interface MiddlewareResponseAdapter {
  cookies: {
    set: (name: string, value: string, options: CookieOptions) => void;
  };
}

/**
 * Updates user session and propagates cookies through Next.js Middleware.
 */
export function createMiddlewareClient(
  request: MiddlewareRequestAdapter,
  response: MiddlewareResponseAdapter
) {
  const env = getSupabaseEnv();

  return createServerClient<Database>(
    env.url || 'https://placeholder.supabase.co',
    env.anonKey || 'placeholder',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value, options);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );
}
