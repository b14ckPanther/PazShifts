import { cache } from 'react';
import { cookies } from 'next/headers';
import {
  createServerSupabaseClient,
  getAuthenticatedUserContext,
  getStationById,
} from '@yellowshifts/database';
import type { Station } from '@yellowshifts/types';

// React cache is scoped to one server render, never shared across users or requests.
// Actions continue doing their own fresh authorization checks.
export const getServerContext = cache(async () => {
  const supabase = createServerSupabaseClient(await cookies());
  return { supabase, context: await getAuthenticatedUserContext(supabase) };
});

export const getCachedStation = cache(async (stationIdOrCode: string): Promise<Station | null> => {
  const { supabase, context } = await getServerContext();
  if (context) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      stationIdOrCode
    );
    const memberStation = context.memberships.find((m) =>
      isUuid
        ? m.station.id === stationIdOrCode
        : m.station.code.toUpperCase() === stationIdOrCode.toUpperCase()
    );
    if (memberStation && memberStation.station.latitude !== undefined) {
      return memberStation.station;
    }
  }
  return getStationById(supabase, stationIdOrCode);
});
