import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@yellowshifts/types';
import { getSupabaseEnv } from './env';

/**
 * Creates a Supabase client for use in browser Client Components.
 */
export function createClient() {
  const env = getSupabaseEnv();

  if (!env.url || !env.anonKey) {
    // Return mock-free unconfigured client or throw controlled error when called
    return createBrowserClient<Database>(
      env.url || 'https://placeholder.supabase.co',
      env.anonKey || 'placeholder'
    );
  }

  return createBrowserClient<Database>(env.url, env.anonKey);
}
