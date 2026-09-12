'use server';
import type { TypedSupabaseClient } from '@yellowshifts/database';
import { getServerContext } from '../lib/server-context';
import { revalidatePath } from 'next/cache';
export async function saveStationLocation(
  stationId: string,
  latitude: number,
  longitude: number,
  radius: number
) {
  const { supabase, context } = await getServerContext();
  if (!context) return { success: false };
  const { error } = await (supabase as TypedSupabaseClient).rpc('set_station_location', {
    p_station_id: stationId,
    p_latitude: latitude,
    p_longitude: longitude,
    p_radius: radius,
  });
  if (error) return { success: false };
  revalidatePath('/stations/[id]', 'layout');
  return { success: true };
}
