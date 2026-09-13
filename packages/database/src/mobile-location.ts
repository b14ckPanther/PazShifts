import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@yellowshifts/types';
import { getNativeWorkerContext } from './worker-context';
export type ReminderStation = {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
  nextStart: number | null;
  arrivalRelevant: boolean;
};
export type ReminderContext = { stations: ReminderStation[]; activeStation: string | null };
/** Read-only, freshly authorized snapshot. No position/event is sent to the server. */
export async function getWorkerReminderContext(
  client: SupabaseClient<Database>,
  userId: string,
  now = Date.now()
): Promise<ReminderContext> {
  const context = await getNativeWorkerContext(client, userId);
  if (!context.stations.length) return { stations: [], activeStation: null };
  const [stations, assigned, active] = await Promise.all([
    client
      .from('stations')
      .select('id,latitude,longitude,attendance_radius_m')
      .in(
        'id',
        context.stations.map((s) => s.id)
      )
      .eq('is_active', true),
    client
      .from('shift_assignments')
      .select('station_id,scheduled_shifts!inner(start_at,end_at,schedules!inner(status))')
      .in(
        'station_membership_id',
        context.stations.map((s) => s.membershipId)
      )
      .eq('scheduled_shifts.schedules.status', 'PUBLISHED')
      .gt('scheduled_shifts.end_at', new Date(now).toISOString())
      .lt('scheduled_shifts.start_at', new Date(now + 7 * 86400000).toISOString())
      .order('id')
      .limit(501),
    client
      .from('attendance_records')
      .select('station_id')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .maybeSingle(),
  ]);
  if (stations.error || assigned.error || active.error || assigned.data.length > 500)
    throw Error('Reminder context unavailable');
  return {
    activeStation: context.stations.some((s) => s.id === active.data?.station_id)
      ? active.data!.station_id
      : null,
    stations: stations.data.flatMap((s) => {
      if (
        s.latitude === null ||
        s.longitude === null ||
        !Number.isFinite(s.latitude) ||
        !Number.isFinite(s.longitude) ||
        Math.abs(s.latitude) > 90 ||
        Math.abs(s.longitude) > 180 ||
        !Number.isInteger(s.attendance_radius_m) ||
        s.attendance_radius_m < 30 ||
        s.attendance_radius_m > 200
      )
        return [];
      const starts = assigned.data
        .filter((a) => a.station_id === s.id)
        .map((a) => Date.parse((a.scheduled_shifts as unknown as { start_at: string }).start_at))
        .filter(Number.isFinite);
      return [
        {
          id: s.id,
          latitude: s.latitude,
          longitude: s.longitude,
          radius: s.attendance_radius_m,
          nextStart: starts.length ? Math.min(...starts) : null,
          arrivalRelevant: starts.some(
            (start) => start >= now - 30 * 60000 && start <= now + 2 * 3600000
          ),
        },
      ];
    }),
  };
}
