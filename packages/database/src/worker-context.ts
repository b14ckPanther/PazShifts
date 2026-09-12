import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@yellowshifts/types';
export type WorkerContext = {
  fullName: string;
  stations: { id: string; name: string; code: string }[];
};
/** Presentation only. Every operation still relies on the user's token and database RLS. */
export async function getNativeWorkerContext(
  client: SupabaseClient<Database>,
  expectedUserId: string
): Promise<WorkerContext> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user || user.id !== expectedUserId) throw new Error('Session unavailable');
  const [profile, memberships] = await Promise.all([
    client.from('profiles').select('full_name,is_active').eq('id', user.id).single(),
    client
      .from('station_memberships')
      .select('stations(id,name,code,is_active)')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE'),
  ]);
  if (profile.error || memberships.error || !profile.data?.is_active)
    throw new Error('Worker context unavailable');
  return {
    fullName: profile.data.full_name,
    stations: memberships.data.flatMap((row) => {
      const station = row.stations as unknown as {
        id: string;
        name: string;
        code: string;
        is_active: boolean;
      } | null;
      return station?.is_active ? [{ id: station.id, name: station.name, code: station.code }] : [];
    }),
  };
}
