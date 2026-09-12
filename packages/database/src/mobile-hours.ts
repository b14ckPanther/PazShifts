import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@yellowshifts/types';
import {
  addDays,
  classifiedEntries,
  dayBoundary,
  localDate,
  validDate,
  weekStart,
  type ReportEntry,
} from '@yellowshifts/reports';
import { getNativeWorkerContext } from './worker-context';
import { getHourPolicies, readOwnReportAttendance } from './hours-query';
export type HoursPeriod =
  { mode: 'week' | 'month'; anchor?: string } | { mode: 'custom'; from: string; to: string };
export class HoursScopeError extends Error {}
export function hoursRange(period: HoursPeriod, today: string, startsOn = 1) {
  if (period.mode === 'custom') {
    if (
      !validDate(period.from) ||
      !validDate(period.to) ||
      period.to < period.from ||
      period.to > today ||
      Date.parse(period.to) - Date.parse(period.from) > 92 * 86400000
    )
      throw Error('Invalid range');
    return { from: period.from, to: period.to };
  }
  const anchor = period.anchor || today;
  if (!validDate(anchor) || anchor > today) throw Error('Invalid period');
  const from = period.mode === 'week' ? weekStart(anchor, startsOn) : anchor.slice(0, 7) + '-01';
  const nextMonth = new Date(from + 'T12:00:00Z');
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  return {
    from,
    to:
      period.mode === 'week' ? addDays(from, 6) : addDays(nextMonth.toISOString().slice(0, 10), -1),
  };
}
export type MobileHours = {
  stationId: string;
  timezone: string;
  from: string;
  to: string;
  today: string;
  generatedAt: string;
  weekStartsOn: number;
  entries: ReportEntry[];
  sessions: Record<string, { start: string; end: string | null }>;
  active: { start: string } | null;
};
/** No user selector: identity comes from Auth, and all reads remain RLS-backed. */
export async function getMobileWorkerHours(
  client: SupabaseClient<Database>,
  stationId: string,
  period: HoursPeriod
): Promise<MobileHours> {
  let context;
  try {
    context = await getNativeWorkerContext(client);
  } catch {
    throw new HoursScopeError('Access unavailable');
  }
  const station = context.stations.find((s) => s.id === stationId);
  if (!station) throw new HoursScopeError('Station unavailable');
  const now = new Date();
  const today = localDate(now, station.timezone);
  const policies = await getHourPolicies(client, stationId);
  const startsOn = policies[0]?.rules.weekStartsOn ?? 1;
  const { from, to } = hoursRange(period, today, startsOn);
  const [records, active] = await Promise.all([
    readOwnReportAttendance(
      client,
      context.userId,
      stationId,
      new Date(dayBoundary(addDays(from, -7), station.timezone)).toISOString(),
      new Date(dayBoundary(addDays(to, 1), station.timezone)).toISOString()
    ),
    client
      .from('attendance_records')
      .select('clock_in_at')
      .eq('user_id', context.userId)
      .eq('station_id', stationId)
      .eq('status', 'ACTIVE')
      .is('clock_out_at', null)
      .maybeSingle(),
  ]);
  if (active.error) throw Error('Active attendance unavailable');
  const generatedAt = new Date();
  const entries = classifiedEntries(
    records,
    from,
    to,
    station.timezone,
    policies,
    generatedAt.getTime()
  );
  const visibleIds = new Set(entries.map((e) => e.id));
  return {
    stationId,
    timezone: station.timezone,
    from,
    to,
    today,
    generatedAt: generatedAt.toISOString(),
    weekStartsOn: startsOn,
    entries,
    sessions: Object.fromEntries(
      records
        .filter((r) => visibleIds.has(r.id))
        .map((r) => [r.id, { start: r.clock_in_at, end: r.clock_out_at }])
    ),
    active: active.data ? { start: active.data.clock_in_at } : null,
  };
}
