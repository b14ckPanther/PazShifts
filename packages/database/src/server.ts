import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@yellowshifts/types';
import { createReadFetch } from './read-fetch';
import { getSupabaseEnv } from './env';

export interface CookieStoreAdapter {
  getAll: () => Array<{ name: string; value: string }>;
  set?: (name: string, value: string, options?: CookieOptions) => void;
  setAll?: (
    cookies: Array<{
      name: string;
      value: string;
      options: CookieOptions;
    }>
  ) => void;
}

/**
 * Creates a Supabase client for Next.js App Router Server Components,
 * Server Actions, and Route Handlers.
 */
export function createServerSupabaseClient(cookieStore: CookieStoreAdapter) {
  const env = getSupabaseEnv();

  return createServerClient<Database>(
    env.url || 'https://placeholder.supabase.co',
    env.anonKey || 'placeholder',
    {
      global: {
        fetch: createReadFetch(new URL(env.url || 'https://placeholder.supabase.co').origin),
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          try {
            if (cookieStore.setAll) {
              cookieStore.setAll(cookiesToSet);
            } else if (cookieStore.set) {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set?.(name, value, options);
              });
            }
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}
