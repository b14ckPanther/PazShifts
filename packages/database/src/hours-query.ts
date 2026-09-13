import type { HourPolicy } from '@yellowshifts/reports';
import type { TypedSupabaseClient } from './auth';
import type { AttendanceRecord } from '@yellowshifts/types';

/** Paginate explicitly: Supabase's default response limit must not truncate accounting exports. */
async function readAttendance(
  supabase: TypedSupabaseClient,
  stationId: string,
  start: string,
  end: string,
  userId?: string,
  includeShiftEnd = true
): Promise<AttendanceRecord[]> {
  const result: AttendanceRecord[] = [];
  for (let offset = 0; offset <= 50000; offset += 1000) {
    let query = supabase
      .from('attendance_records')
      .select('*')
      .eq('station_id', stationId)
      .lt('clock_in_at', end)
      .or(`clock_out_at.gt.${start},clock_out_at.is.null`);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query
      .order('clock_in_at')
      .order('id')
      .range(offset, offset + 999);
    if (error) throw new Error('לא ניתן לטעון את דוח השעות. נסו שוב.');
    result.push(...((data || []) as AttendanceRecord[]));
    if (result.length > 50000) throw new Error('הדוח גדול מדי. יש לבחור תקופה קצרה יותר.');
    if (!data || data.length < 1000) {
      // Read overlap context through full completed shifts crossing the requested end.
      // This preserves overlap exclusion even when a conflicting record starts next day.
      const latestEnd = result.reduce((latest, record) => {
        const finish = record.clock_out_at ? Date.parse(record.clock_out_at) : NaN;
        return record.status === 'COMPLETED' && finish <= Date.now() && finish > latest
          ? finish
          : latest;
      }, Date.parse(end));
      if (includeShiftEnd && latestEnd > Date.parse(end))
        return readAttendance(
          supabase,
          stationId,
          start,
          new Date(latestEnd).toISOString(),
          userId,
          false
        );
      return result;
    }
  }
  throw new Error('יש לבחור תקופה קצרה יותר.');
}

export async function readReportPeople(supabase: TypedSupabaseClient, stationId: string) {
  const people: { id: string; name: string; code: string }[] = [];
  for (let offset = 0; offset <= 50000; offset += 1000) {
    const { data, error } = await supabase
      .from('station_memberships')
      .select('id, employee_code, profiles(full_name)')
      .eq('station_id', stationId)
      .order('id')
      .range(offset, offset + 999);
    if (error) throw new Error('לא ניתן לטעון את צוות התחנה.');
    for (const row of data || []) {
      const profile = row.profiles as unknown as { full_name: string } | null;
      people.push({
        id: row.id,
        name: profile?.full_name || 'עובד היסטורי',
        code: row.employee_code || '',
      });
    }
    if (people.length > 50000) throw new Error('הדוח גדול מדי.');
    if (!data || data.length < 1000) return people;
  }
  throw new Error('הדוח גדול מדי.');
}

export function readReportAttendance(
  supabase: TypedSupabaseClient,
  stationId: string,
  start: string,
  end: string
) {
  return readAttendance(supabase, stationId, start, end);
}
export function readOwnReportAttendance(
  supabase: TypedSupabaseClient,
  userId: string,
  stationId: string,
  start: string,
  end: string
) {
  if (!userId) throw new Error('Authentication required');
  return readAttendance(supabase, stationId, start, end, userId);
}

export async function getHourPolicies(supabase: TypedSupabaseClient, stationId: string) {
  const { data, error } = await supabase.rpc('get_station_hour_rules', { p_station_id: stationId });
  if (error) throw new Error('לא ניתן לטעון את כללי השעות. ודאו שמיגרציית הכללים הוחלה.');
  return (data || []) as unknown as HourPolicy[];
}
