import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerSupabaseClient, getAuthenticatedUserContext } from '@yellowshifts/database';

// React cache is scoped to one server render, never shared across users or requests.
// Actions continue doing their own fresh authorization checks.
export const getServerContext = cache(async () => {
  const supabase = createServerSupabaseClient(await cookies());
  return { supabase, context: await getAuthenticatedUserContext(supabase) };
});
