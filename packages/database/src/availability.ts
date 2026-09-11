/**
-- ============================================================================
-- YellowShifts Database: availability.ts
-- Description: Simplified station-scoped worker availability queries, mutations,
--              and independent matching engine.
-- ============================================================================
*/

import type {
  AvailabilityWeek,
  AvailabilityEntry,
  WeeklyAvailabilityWithEntries,
  SaveWeeklyAvailabilityInput,
  AvailabilityMatchResult,
  Database,
} from '@yellowshifts/types';
import type { TypedSupabaseClient } from './auth';

function normalizeTimeString(timeStr: string): string {
  const trimmed = timeStr.trim();
  if (trimmed.length === 5) {
    return `${trimmed}:00`;
  }
  return trimmed.slice(0, 8);
}

function mapAvailabilityWeekRow(
  row: Database['public']['Tables']['availability_weeks']['Row']
): AvailabilityWeek {
  return {
    id: row.id,
    stationId: row.station_id,
    stationMembershipId: row.station_membership_id,
    weekStartDate: row.week_start_date,
    notes: row.notes,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  };
}

function mapAvailabilityEntryRow(
  row: Database['public']['Tables']['availability_entries']['Row']
): AvailabilityEntry {
  return {
    id: row.id,
    availabilityWeekId: row.availability_week_id,
    date: row.date,
    availabilityType: row.availability_type,
    startTime: row.start_time,
    endTime: row.end_time,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Ensures a date is normalized to Monday (ISO week start).
 */
export function getAvailabilityWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDay(); // 0: Sun, 1: Mon, ...
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetches one worker's submitted availability for a specific week and station membership.
 */
export async function getWorkerWeeklyAvailability(
  supabase: TypedSupabaseClient,
  stationMembershipId: string,
  weekStartDate: string
): Promise<WeeklyAvailabilityWithEntries | null> {
  const normWeekStart = getAvailabilityWeekStart(weekStartDate);

  const { data: week, error: weekErr } = await supabase
    .from('availability_weeks')
    .select('*')
    .eq('station_membership_id', stationMembershipId)
    .eq('week_start_date', normWeekStart)
    .maybeSingle();

  if (weekErr) {
    throw new Error(`שגיאה בטעינת שבוע זמינות עובד: ${weekErr.message}`);
  }

  if (!week) return null;

  const { data: entries, error: entriesErr } = await supabase
    .from('availability_entries')
    .select('*')
    .eq('availability_week_id', week.id)
    .order('date', { ascending: true });

  if (entriesErr) {
    throw new Error(`שגיאה בטעינת רשומות זמינות: ${entriesErr.message}`);
  }

  return {
    week: mapAvailabilityWeekRow(week),
    entries: (entries ?? []).map(mapAvailabilityEntryRow),
  };
}

/**
 * Fetches all worker availability submissions for a station in a given week.
 * Used by Station Admins and Shift Managers in scheduling workflows.
 * Returns a Map of stationMembershipId -> WeeklyAvailabilityWithEntries.
 */
export async function getStationWeeklyAvailability(
  supabase: TypedSupabaseClient,
  stationId: string,
  weekStartDate: string
): Promise<Map<string, WeeklyAvailabilityWithEntries>> {
  const normWeekStart = getAvailabilityWeekStart(weekStartDate);

  const { data: weeks, error: weeksErr } = await supabase
    .from('availability_weeks')
    .select('*')
    .eq('station_id', stationId)
    .eq('week_start_date', normWeekStart);

  if (weeksErr) {
    throw new Error(`שגיאה בטעינת זמינות שבועית לתחנה: ${weeksErr.message}`);
  }

  const result = new Map<string, WeeklyAvailabilityWithEntries>();
  if (!weeks || weeks.length === 0) {
    return result;
  }

  const weekIds = weeks.map((w) => w.id);

  const { data: entries, error: entriesErr } = await supabase
    .from('availability_entries')
    .select('*')
    .in('availability_week_id', weekIds)
    .order('date', { ascending: true });

  if (entriesErr) {
    throw new Error(`שגיאה בטעינת רשומות זמינות תחנה: ${entriesErr.message}`);
  }

  const entriesByWeekId = new Map<string, AvailabilityEntry[]>();
  (entries ?? []).forEach((row) => {
    const entry = mapAvailabilityEntryRow(row);
    const list = entriesByWeekId.get(entry.availabilityWeekId) ?? [];
    list.push(entry);
    entriesByWeekId.set(entry.availabilityWeekId, list);
  });

  weeks.forEach((w) => {
    const mappedWeek = mapAvailabilityWeekRow(w);
    result.set(mappedWeek.stationMembershipId, {
      week: mappedWeek,
      entries: entriesByWeekId.get(mappedWeek.id) ?? [],
    });
  });

  return result;
}

/**
 * Saves or updates a worker's weekly availability submission.
 * Replaces the 7 daily entries atomically.
 */
export async function saveWeeklyAvailability(
  supabase: TypedSupabaseClient,
  input: SaveWeeklyAvailabilityInput
): Promise<WeeklyAvailabilityWithEntries> {
  const normWeekStart = getAvailabilityWeekStart(input.weekStartDate);

  // 1. Upsert availability_weeks row
  const now = new Date().toISOString();
  const { data: weekData, error: weekErr } = await supabase
    .from('availability_weeks')
    .upsert(
      {
        station_id: input.stationId,
        station_membership_id: input.stationMembershipId,
        week_start_date: normWeekStart,
        notes: input.notes !== undefined ? (input.notes ? input.notes.trim() : null) : null,
        submitted_at: now,
        updated_at: now,
      },
      { onConflict: 'station_membership_id,week_start_date' }
    )
    .select()
    .single();

  if (weekErr || !weekData) {
    throw new Error(`שגיאה בשמירת שבוע זמינות: ${weekErr?.message || ''}`);
  }

  const weekId = weekData.id;

  // 2. Delete existing entries for this availability_week_id
  const { error: delErr } = await supabase
    .from('availability_entries')
    .delete()
    .eq('availability_week_id', weekId);

  if (delErr) {
    throw new Error(`שגיאה בניקוי רשומות זמינות קודמות: ${delErr.message}`);
  }

  // 3. Insert new entries
  if (input.entries.length > 0) {
    const entriesToInsert = input.entries.map((entry) => {
      const startTime =
        entry.availabilityType === 'TIME_WINDOW' && entry.startTime
          ? normalizeTimeString(entry.startTime)
          : null;
      const endTime =
        entry.availabilityType === 'TIME_WINDOW' && entry.endTime
          ? normalizeTimeString(entry.endTime)
          : null;

      return {
        availability_week_id: weekId,
        date: entry.date,
        availability_type: entry.availabilityType,
        start_time: startTime,
        end_time: endTime,
        notes: entry.notes ? entry.notes.trim() : null,
      };
    });

    const { error: insErr } = await supabase.from('availability_entries').insert(entriesToInsert);

    if (insErr) {
      throw new Error(`שגיאה בשמירת פירוט זמינות יומית: ${insErr.message}`);
    }
  }

  // 4. Fetch the full created/updated structure
  const updated = await getWorkerWeeklyAvailability(
    supabase,
    input.stationMembershipId,
    normWeekStart
  );

  if (!updated) {
    throw new Error('שגיאה בשליפת זמינות מעודכנת לאחר שמירה');
  }

  return updated;
}

/**
 * Availability Matching Engine
 * Compares a scheduled shift with a worker's declared availability.
 * Returns: AVAILABLE | PARTIAL | UNAVAILABLE | NOT_SUBMITTED
 */
export function matchShiftWithAvailability(
  shiftDate: string,
  shiftStartAt: string,
  shiftEndAt: string,
  availability?: WeeklyAvailabilityWithEntries | null
): AvailabilityMatchResult {
  if (!availability || !availability.entries || availability.entries.length === 0) {
    return {
      status: 'NOT_SUBMITTED',
      label: 'טרם הוגשה זמינות',
    };
  }

  const entry = availability.entries.find((e) => e.date === shiftDate);
  if (!entry) {
    return {
      status: 'NOT_SUBMITTED',
      label: 'טרם הוגשה זמינות ליום זה',
    };
  }

  if (entry.availabilityType === 'ALL_DAY_AVAILABLE') {
    return {
      status: 'AVAILABLE',
      label: 'זמין למשמרת (כל היום)',
      entry,
    };
  }

  if (entry.availabilityType === 'ALL_DAY_UNAVAILABLE') {
    return {
      status: 'UNAVAILABLE',
      label: 'לא זמין ביום זה',
      reason: entry.notes ? `סיבה: ${entry.notes}` : 'העובד הצהיר שאינו זמין כלל ביום זה',
      entry,
    };
  }

  // TIME_WINDOW evaluation
  if (entry.availabilityType === 'TIME_WINDOW') {
    if (!entry.startTime || !entry.endTime) {
      return {
        status: 'AVAILABLE',
        label: 'זמין למשמרת',
        entry,
      };
    }

    // Parse shift times (HH:mm)
    const sStartHourStr = shiftStartAt.includes('T')
      ? (shiftStartAt.split('T')[1]?.slice(0, 5) ?? '00:00')
      : shiftStartAt.slice(11, 16);
    const sEndHourStr = shiftEndAt.includes('T')
      ? (shiftEndAt.split('T')[1]?.slice(0, 5) ?? '00:00')
      : shiftEndAt.slice(11, 16);

    const [sh = 0, sm = 0] = sStartHourStr.split(':').map(Number);
    const [eh = 0, em = 0] = sEndHourStr.split(':').map(Number);

    const shiftStartMinutes = sh * 60 + sm;
    let shiftEndMinutes = eh * 60 + em;
    if (shiftEndMinutes <= shiftStartMinutes) {
      // Overnight shift
      shiftEndMinutes += 24 * 60;
    }

    // Parse availability window (HH:mm)
    const [wh1 = 0, wm1 = 0] = entry.startTime.slice(0, 5).split(':').map(Number);
    const [wh2 = 0, wm2 = 0] = entry.endTime.slice(0, 5).split(':').map(Number);

    const windowStartMinutes = wh1 * 60 + wm1;
    let windowEndMinutes = wh2 * 60 + wm2;
    if (windowEndMinutes <= windowStartMinutes) {
      // Overnight window
      windowEndMinutes += 24 * 60;
    }

    const intersectionStart = Math.max(shiftStartMinutes, windowStartMinutes);
    const intersectionEnd = Math.min(shiftEndMinutes, windowEndMinutes);
    const intersectionDuration = Math.max(0, intersectionEnd - intersectionStart);
    const shiftTotalDuration = shiftEndMinutes - shiftStartMinutes;

    const windowFmt = `${entry.startTime.slice(0, 5)} - ${entry.endTime.slice(0, 5)}`;

    if (intersectionDuration >= shiftTotalDuration) {
      return {
        status: 'AVAILABLE',
        label: 'זמין למשמרת',
        reason: `בטווח הזמינות שהוגדר (${windowFmt})`,
        entry,
      };
    }

    if (intersectionDuration > 0) {
      return {
        status: 'PARTIAL',
        label: 'זמין חלקית',
        reason: `זמין בחלון ${windowFmt} (כיסוי חלקי של שעות המשמרת)`,
        entry,
      };
    }

    return {
      status: 'UNAVAILABLE',
      label: 'מחוץ לשעות הזמינות',
      reason: `העובד הצהיר זמינות רק בשעות ${windowFmt}`,
      entry,
    };
  }

  return {
    status: 'NOT_SUBMITTED',
    label: 'טרם הוגשה זמינות',
  };
}
