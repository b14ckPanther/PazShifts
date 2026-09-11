import { createClient } from '@supabase/supabase-js';
import type { Database } from '@yellowshifts/types';
import { getSupabaseEnv } from './env';

/**
 * Creates an elevated Supabase client with the service_role key.
 * Strictly forbidden in client-side code; only for secure server-side operations.
 */
export function createAdminClient() {
  const env = getSupabaseEnv();

  if (!env.serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to create an admin client.');
  }

  return createClient<Database>(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
