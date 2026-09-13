import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, AttendanceRecord } from '@yellowshifts/types';
import { addDays, localDate, weekStart, dayBoundary, buildEntries } from '@yellowshifts/reports';
import { getNativeWorkerContext } from './worker-context';
export type MobileShift = { id: string; start_at: string; end_at: string; shift_date: string };
export type MobileHome = {
  stationId: string;
  timezone: string;
  today: string;
  week: string;
  nextWeek: string;
  fetchedAt: number;
  shifts: MobileShift[];
  active: { clock_in_at: string; station_id: string; scheduled_shift_id: string | null } | null;
  activeStation: string | null;
  activeTimezone: string;
  availabilitySubmitted: boolean;
  confirmedSeconds: number;
  reviewCount: number;
  completedToday: boolean;
  completedTodaySeconds: number;
};
/** Bounded, read-only worker presentation. Fresh access checks precede every read. */
export async function getMobileHome(
  client: SupabaseClient<Database>,
  userId: string,
  stationId: string,
  now = Date.now()
): Promise<MobileHome> {
  const context = await getNativeWorkerContext(client, userId);
  const station = context.stations.find((s) => s.id === stationId);
  if (!station) throw new Error('Station access unavailable');
  const timezone = station.timezone,
    today = localDate(new Date(now), timezone),
    week = weekStart(today, 0),
    nextWeek = addDays(week, 7);
  const start = new Date(dayBoundary(week, timezone)).toISOString(),
    end = new Date(dayBoundary(nextWeek, timezone)).toISOString();
  const [assigned, active, availability, attendance] = await Promise.all([
    client
      .from('shift_assignments')
      .select('scheduled_shifts!inner(id,start_at,end_at,shift_date,schedules!inner(status))')
      .eq('station_id', stationId)
      .eq('station_membership_id', station.membershipId)
      .eq('scheduled_shifts.schedules.status', 'PUBLISHED')
      .gte('scheduled_shifts.start_at', start)
      .lt(
        'scheduled_shifts.start_at',
        new Date(dayBoundary(addDays(today, 28), timezone)).toISOString()
      )
      .order('id')
      .limit(301),
    client
      .from('attendance_records')
      .select('clock_in_at,station_id,scheduled_shift_id')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .maybeSingle(),
    client
      .from('availability_weeks')
      .select('submitted_at,availability_entries(date)')
      .eq('station_id', stationId)
      .eq('station_membership_id', station.membershipId)
      .eq('week_start_date', nextWeek)
      .maybeSingle(),
    client
      .from('attendance_records')
      .select('*')
      .eq('user_id', userId)
      .eq('station_id', stationId)
      .lt('clock_in_at', end)
      .or(`clock_out_at.gt.${start},clock_out_at.is.null`)
      .order('clock_in_at')
      .order('id')
      .limit(301),
  ]);
  if (
    assigned.error ||
    active.error ||
    availability.error ||
    attendance.error ||
    assigned.data.length > 300 ||
    attendance.data.length > 300
  )
    throw new Error('Home data unavailable');
  const shifts = assigned.data
    .map((row) => row.scheduled_shifts as unknown as MobileShift)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  const entries = buildEntries(
    attendance.data as AttendanceRecord[],
    week,
    addDays(nextWeek, -1),
    timezone,
    now
  );
  const complete = entries.filter((e) => e.status === 'הושלמה');
  return {
    stationId,
    timezone,
    today,
    week,
    nextWeek,
    fetchedAt: now,
    shifts,
    active: active.data,
    activeStation: context.stations.find((s) => s.id === active.data?.station_id)?.name ?? null,
    activeTimezone:
      context.stations.find((s) => s.id === active.data?.station_id)?.timezone ?? timezone,
    availabilitySubmitted: Boolean(
      availability.data?.submitted_at &&
      Array.from({ length: 7 }, (_, i) => addDays(nextWeek, i)).every((date) =>
        availability.data?.availability_entries.some((entry) => entry.date === date)
      )
    ),
    confirmedSeconds: complete.reduce((sum, e) => sum + e.seconds, 0),
    reviewCount: new Set(entries.filter((e) => e.status !== 'הושלמה').map((e) => e.id)).size,
    completedToday: complete.some((e) => e.date === today),
    completedTodaySeconds: complete
      .filter((e) => e.date === today)
      .reduce((sum, e) => sum + e.seconds, 0),
  };
}
