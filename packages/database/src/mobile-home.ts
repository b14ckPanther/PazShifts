import { scheduledWallTimeToInstant } from './schedule-instant';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, AttendanceRecord } from '@yellowshifts/types';
import {
  addDays,
  localDate,
  weekStart,
  dayBoundary,
  shiftReportEntries,
} from '@yellowshifts/reports';
import { readOwnReportAttendance } from './hours-query';
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
  latestClosed?: {
    stationId: string;
    stationName: string;
    timezone: string;
    date: string;
    start: string;
    end: string;
    seconds: number;
    corrected: boolean;
  } | null;
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
  const [assigned, active, availability, attendance, recent] = await Promise.all([
    client
      .from('shift_assignments')
      .select('scheduled_shifts!inner(id,start_at,end_at,shift_date,schedules!inner(status))')
      .eq('station_id', stationId)
      .eq('station_membership_id', station.membershipId)
      .eq('scheduled_shifts.schedules.status', 'PUBLISHED')
      // Include Saturday overnight shifts that are still running on Sunday.
      .gte('scheduled_shifts.shift_date', addDays(week, -1))
      .lt('scheduled_shifts.shift_date', addDays(today, 28))
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
    readOwnReportAttendance(client, userId, stationId, start, end).then((data) => ({
      data,
      error: null,
    })),
    client
      .from('attendance_records')
      .select('*')
      .eq('user_id', userId)
      .in(
        'station_id',
        context.stations.map((s) => s.id)
      )
      .eq('status', 'COMPLETED')
      .gte('clock_out_at', new Date(now - 14 * 86400000).toISOString())
      .lte('clock_out_at', new Date(now).toISOString())
      .order('clock_out_at', { ascending: false })
      .order('id')
      .limit(1)
      .maybeSingle(),
  ]);
  if (
    assigned.error ||
    active.error ||
    availability.error ||
    attendance.error ||
    recent.error ||
    assigned.data.length > 300 ||
    attendance.data.length > 300
  )
    throw new Error('Home data unavailable');
  const shifts = assigned.data
    .map((row) => {
      const shift = row.scheduled_shifts as unknown as MobileShift;
      return {
        ...shift,
        start_at: scheduledWallTimeToInstant(shift.start_at, timezone),
        end_at: scheduledWallTimeToInstant(shift.end_at, timezone),
      };
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at) || a.id.localeCompare(b.id));
  const entries = shiftReportEntries(
    attendance.data as AttendanceRecord[],
    week,
    addDays(nextWeek, -1),
    timezone,
    undefined,
    now
  );
  const complete = entries.filter((e) => e.status === 'הושלמה');
  const last = recent.data as AttendanceRecord | null;
  const lastStation = context.stations.find((s) => s.id === last?.station_id);
  const lastDate =
    last && lastStation ? localDate(new Date(last.clock_in_at), lastStation.timezone) : null;
  const lastEntry =
    last && lastStation && lastDate
      ? shiftReportEntries([last], lastDate, lastDate, lastStation.timezone, undefined, now)[0]
      : null;
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
    latestClosed:
      last && lastStation && lastEntry && lastEntry.status === 'הושלמה' && last.clock_out_at
        ? {
            stationId: lastStation.id,
            stationName: lastStation.name,
            timezone: lastStation.timezone,
            date: lastEntry.date,
            start: last.clock_in_at,
            end: last.clock_out_at,
            seconds: lastEntry.seconds,
            corrected: Boolean(last.corrected_at),
          }
        : null,
    confirmedSeconds: complete.reduce((sum, e) => sum + e.seconds, 0),
    reviewCount: new Set(entries.filter((e) => e.status !== 'הושלמה').map((e) => e.id)).size,
    completedToday: complete.some((e) => e.date === today),
    completedTodaySeconds: complete
      .filter((e) => e.date === today)
      .reduce((sum, e) => sum + e.seconds, 0),
  };
}
