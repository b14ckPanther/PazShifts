import type { TypedSupabaseClient } from '@yellowshifts/database';
import type { AttendanceRecord } from '@yellowshifts/types';

/** Paginate explicitly: Supabase's default response limit must not truncate accounting exports. */
export async function readReportAttendance(
  supabase: TypedSupabaseClient,
  stationId: string,
  start: string,
  end: string
): Promise<AttendanceRecord[]> {
  const result: AttendanceRecord[] = [];
  for (let offset = 0; offset <= 50000; offset += 1000) {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('station_id', stationId)
      .lt('clock_in_at', end)
      .or(`clock_out_at.gt.${start},clock_out_at.is.null`)
      .order('clock_in_at')
      .order('id')
      .range(offset, offset + 999);
    if (error) throw new Error('לא ניתן לטעון את דוח השעות. נסו שוב.');
    result.push(...((data || []) as AttendanceRecord[]));
    if (result.length > 50000) throw new Error('הדוח גדול מדי. יש לבחור תקופה קצרה יותר.');
    if (!data || data.length < 1000) return result;
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
