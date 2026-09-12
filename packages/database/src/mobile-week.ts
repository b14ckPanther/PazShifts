import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  SaveAvailabilityEntryInput,
  WeeklyAvailabilityWithEntries,
} from '@yellowshifts/types';
import { getNativeWorkerContext } from './worker-context';
import {
  getWorkerWeeklyAvailability,
  saveWeeklyAvailability,
  getAvailabilityWeekStart,
} from './availability';
export type NativeShift = {
  id: string;
  date: string;
  start: string;
  end: string;
  name: string;
  notes: string | null;
  coworkers: { id: string; name: string; role: string }[];
};
export type NativeSchedule = { published: boolean; shifts: NativeShift[] };
async function scope(client: SupabaseClient<Database>, user: string, station: string) {
  const context = await getNativeWorkerContext(client, user);
  const membership = context.stations.find((s) => s.id === station);
  if (!membership) throw Error('Station unavailable');
  return membership;
}
export async function getMobileWorkerSchedule(
  client: SupabaseClient<Database>,
  user: string,
  station: string,
  week: string
): Promise<NativeSchedule> {
  const member = await scope(client, user, station);
  const { data: schedule, error } = await client
    .from('schedules')
    .select('id')
    .eq('station_id', station)
    .eq('week_start_date', getAvailabilityWeekStart(week))
    .eq('status', 'PUBLISHED')
    .maybeSingle();
  if (error) throw Error('Schedule unavailable');
  if (!schedule) return { published: false, shifts: [] };
  const { data, error: shiftError } = await client
    .from('scheduled_shifts')
    .select(
      'id,shift_date,start_at,end_at,notes,shift_templates(name),shift_assignments(station_membership_id,station_memberships(id,role,profiles(id,full_name)))'
    )
    .eq('station_id', station)
    .eq('schedule_id', schedule.id)
    .order('start_at')
    .order('id')
    .limit(301);
  if (shiftError || data.length > 300) throw Error('Schedule unavailable');
  return {
    published: true,
    shifts: data
      .filter((s) =>
        s.shift_assignments.some((a) => a.station_membership_id === member.membershipId)
      )
      .map((s) => ({
        id: s.id,
        date: s.shift_date,
        start: s.start_at,
        end: s.end_at,
        notes: s.notes,
        name: s.shift_templates?.name ?? 'משמרת',
        coworkers: s.shift_assignments
          .filter((a) => a.station_membership_id !== member.membershipId)
          .flatMap((a) => {
            const m = a.station_memberships;
            const p = m?.profiles;
            return p ? [{ id: m.id, name: p.full_name, role: m.role }] : [];
          }),
      })),
  };
}
export async function getMobileAvailabilityWeek(
  client: SupabaseClient<Database>,
  user: string,
  station: string,
  week: string
) {
  const member = await scope(client, user, station);
  return getWorkerWeeklyAvailability(client, member.membershipId, week);
}
export async function saveMobileAvailability(
  client: SupabaseClient<Database>,
  user: string,
  station: string,
  week: string,
  entries: SaveAvailabilityEntryInput[],
  notes: string | null
): Promise<WeeklyAvailabilityWithEntries> {
  const member = await scope(client, user, station);
  return saveWeeklyAvailability(client, {
    stationId: station,
    stationMembershipId: member.membershipId,
    weekStartDate: week,
    entries,
    notes,
  });
}
