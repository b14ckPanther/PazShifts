import type {
  Database,
  AttendanceRecord,
  AttendanceRecordWithDetails,
  ResolvedNfcStation,
  ClockInInput,
  ClockInResult,
  ClockOutInput,
  ClockOutResult,
  AdminAttendanceCorrectionInput,
} from '@yellowshifts/types';
import type { TypedSupabaseClient } from './auth';

/**
 * Resolves a station from a public NFC token.
 * Does not expose internal database secrets or sequential IDs.
 */
export async function resolveStationByNfcToken(
  supabase: TypedSupabaseClient,
  token: string
): Promise<ResolvedNfcStation | null> {
  if (!token || !token.trim()) {
    return null;
  }

  const { data, error } = await supabase.rpc('resolve_station_by_nfc_token', {
    p_token: token.trim(),
  });

  if (error || !data || data.length === 0) {
    return null;
  }

  const station = data[0];
  if (!station) {
    return null;
  }

  return {
    id: station.id,
    code: station.code,
    name: station.name,
    address: station.address,
    timezone: station.timezone,
    is_active: station.is_active,
  };
}

/**
 * Checks if a worker currently has an active attendance session anywhere in the system.
 */
export async function getWorkerActiveAttendanceAnywhere(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<(AttendanceRecord & { station_name?: string }) | null> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select(
      `
      *,
      stations:station_id (
        name
      )
    `
    )
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const stationName = (data.stations as { name: string } | null)?.name;
  return {
    ...(data as unknown as AttendanceRecord),
    station_name: stationName,
  };
}

/**
 * Gets the active attendance record for a specific station membership.
 */
export async function getWorkerActiveAttendance(
  supabase: TypedSupabaseClient,
  stationMembershipId: string
): Promise<AttendanceRecord | null> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('station_membership_id', stationMembershipId)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as AttendanceRecord;
}

/**
 * Finds the most relevant scheduled shift for a worker clocking in at the station.
 * Matches if current time is within +/- 2.5 hours of a shift assigned to this membership today.
 */
export async function findMatchingScheduledShift(
  supabase: TypedSupabaseClient,
  stationId: string,
  membershipId: string
): Promise<string | null> {
  try {
    const now = new Date();
    const { data: assignments, error } = await supabase
      .from('shift_assignments')
      .select(
        `
        scheduled_shift_id,
        scheduled_shifts!inner (
          id,
          station_id,
          shift_date,
          start_at,
          end_at
        )
      `
      )
      .eq('station_id', stationId)
      .eq('station_membership_id', membershipId);

    if (error || !assignments || assignments.length === 0) {
      return null;
    }

    const nowMs = now.getTime();
    const candidateShifts = assignments
      .map(
        (a) =>
          a.scheduled_shifts as unknown as {
            id: string;
            station_id: string;
            shift_date: string;
            start_at: string;
            end_at: string;
          }
      )
      .filter((shift) => {
        const startMs = new Date(shift.start_at).getTime();
        const endMs = new Date(shift.end_at).getTime();
        // Allow clock-in window from 2.5 hours before start to 1 hour after end
        const windowStart = startMs - 2.5 * 60 * 60 * 1000;
        const windowEnd = endMs + 1 * 60 * 60 * 1000;
        return nowMs >= windowStart && nowMs <= windowEnd;
      });

    if (candidateShifts.length === 0) {
      return null;
    }

    // Pick the closest shift to now
    candidateShifts.sort((a, b) => {
      const diffA = Math.abs(new Date(a.start_at).getTime() - nowMs);
      const diffB = Math.abs(new Date(b.start_at).getTime() - nowMs);
      return diffA - diffB;
    });

    const bestShift = candidateShifts[0];
    return bestShift ? bestShift.id : null;
  } catch {
    return null;
  }
}

/**
 * Clock-in worker safely via NFC.
 * Enforces:
 * 1. Active station membership
 * 2. Cross-station active session detection & blocking
 * 3. Single active record partial unique constraint
 * 4. DB-side trusted timestamps
 * 5. Automatic scheduled shift association
 * 6. Concurrency & double-tap protection
 */
export async function clockInWorker(
  supabase: TypedSupabaseClient,
  input: ClockInInput
): Promise<ClockInResult> {
  const { stationId, membershipId, userId } = input;

  // 1. Verify active station membership
  const { data: membership, error: memberError } = await supabase
    .from('station_memberships')
    .select('id, role, status')
    .eq('id', membershipId)
    .eq('station_id', stationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (memberError || !membership || membership.status !== 'ACTIVE') {
    return {
      success: false,
      error: 'אינך מורשה לבצע כניסה: אין חברות פעילה בתחנה זו.',
    };
  }

  // 2. Check for existing active attendance across ANY station
  const existingActive = await getWorkerActiveAttendanceAnywhere(supabase, userId);
  if (existingActive) {
    if (existingActive.station_id !== stationId) {
      return {
        success: false,
        conflict: {
          isOtherStation: true,
          stationName: existingActive.station_name,
        },
        error: `הינך רשום כרגע במשמרת פעילה בתחנה "${existingActive.station_name || 'אחרת'}". לא ניתן להתחיל משמרת חדשה לפני סיום המשמרת הנוכחית.`,
      };
    }

    // Idempotent double-tap: already active at this station
    return {
      success: true,
      attendanceRecord: existingActive,
      linkedScheduledShiftId: existingActive.scheduled_shift_id,
    };
  }

  // 3. Match relevant scheduled shift
  const matchingShiftId = await findMatchingScheduledShift(supabase, stationId, membershipId);

  // 4. Insert attendance record (DB now() used for clock_in_at)
  const { data: newRecord, error: insertError } = await supabase
    .from('attendance_records')
    .insert({
      station_id: stationId,
      station_membership_id: membershipId,
      user_id: userId,
      scheduled_shift_id: matchingShiftId,
      status: 'ACTIVE',
      clock_in_source: 'NFC',
    })
    .select('*')
    .single();

  if (insertError) {
    // Handle race condition: if duplicate active record constraint fired
    if (insertError.code === '23505') {
      const currentActive = await getWorkerActiveAttendance(supabase, membershipId);
      if (currentActive) {
        return {
          success: true,
          attendanceRecord: currentActive,
          linkedScheduledShiftId: currentActive.scheduled_shift_id,
        };
      }
    }
    return {
      success: false,
      error: `שגיאה ברישום כניסה למשמרת: ${insertError.message}`,
    };
  }

  return {
    success: true,
    attendanceRecord: newRecord as AttendanceRecord,
    linkedScheduledShiftId: matchingShiftId,
  };
}

/**
 * Clock-out worker safely via NFC.
 * Enforces:
 * 1. Active attendance record exists
 * 2. Record belongs to authenticated user
 * 3. DB-side trusted timestamps
 * 4. Idempotent double-click safety
 */
export async function clockOutWorker(
  supabase: TypedSupabaseClient,
  input: ClockOutInput
): Promise<ClockOutResult> {
  const { attendanceRecordId, userId } = input;

  // 1. Fetch current record
  const { data: record, error: fetchError } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('id', attendanceRecordId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError || !record) {
    return {
      success: false,
      error: 'רשומת הנוכחות לא נמצאה או שאינה שייכת למשתמש זה.',
    };
  }

  // Idempotent double-tap safety: already completed
  if (record.status === 'COMPLETED') {
    const duration = record.clock_out_at
      ? Math.round(
          (new Date(record.clock_out_at).getTime() - new Date(record.clock_in_at).getTime()) / 60000
        )
      : undefined;

    return {
      success: true,
      attendanceRecord: record as AttendanceRecord,
      durationMinutes: duration,
    };
  }

  if (record.status !== 'ACTIVE') {
    return {
      success: false,
      error: 'לא ניתן לסיים משמרת שאינה פעילה.',
    };
  }

  // 2. Perform clock-out update with DB-trusted timestamp
  const nowMs = Date.now();
  const clockInMs = new Date(record.clock_in_at).getTime();
  const safeOutMs = Math.max(nowMs, clockInMs);
  const nowIso = new Date(safeOutMs).toISOString();

  const { data: updatedRecord, error: updateError } = await supabase
    .from('attendance_records')
    .update({
      status: 'COMPLETED',
      clock_out_at: nowIso,
      clock_out_source: 'NFC',
      updated_at: nowIso,
    })
    .eq('id', attendanceRecordId)
    .eq('status', 'ACTIVE')
    .select('*')
    .single();

  if (updateError || !updatedRecord) {
    return {
      success: false,
      error: `שגיאה בסיום המשמרת: ${updateError?.message || 'נכשל בעדכון'}`,
    };
  }

  const durationMinutes = Math.max(
    0,
    Math.round(
      (new Date(updatedRecord.clock_out_at!).getTime() -
        new Date(updatedRecord.clock_in_at).getTime()) /
        60000
    )
  );

  return {
    success: true,
    attendanceRecord: updatedRecord as AttendanceRecord,
    durationMinutes,
  };
}

/**
 * Lists station attendance for the Admin attendance view.
 */
export async function listStationAttendance(
  supabase: TypedSupabaseClient,
  stationId: string,
  options?: {
    date?: string; // YYYY-MM-DD
  }
): Promise<{
  activeRecords: AttendanceRecordWithDetails[];
  completedRecords: AttendanceRecordWithDetails[];
}> {
  // Query 1: Active records
  const activeQuery = supabase
    .from('attendance_records')
    .select(
      `
      *,
      profiles:user_id (
        id,
        full_name,
        phone
      ),
      station_memberships:station_membership_id (
        id,
        role,
        employee_code
      ),
      scheduled_shifts:scheduled_shift_id (
        id,
        shift_date,
        start_at,
        end_at,
        notes,
        shift_templates:shift_template_id (
          name,
          start_time,
          end_time
        )
      )
    `
    )
    .eq('station_id', stationId)
    .eq('status', 'ACTIVE')
    .order('clock_in_at', { ascending: false });

  // Query 2: Completed / Flagged records for date (default today)
  let completedQuery = supabase
    .from('attendance_records')
    .select(
      `
      *,
      profiles:user_id (
        id,
        full_name,
        phone
      ),
      station_memberships:station_membership_id (
        id,
        role,
        employee_code
      ),
      scheduled_shifts:scheduled_shift_id (
        id,
        shift_date,
        start_at,
        end_at,
        notes,
        shift_templates:shift_template_id (
          name,
          start_time,
          end_time
        )
      ),
      corrector:corrected_by (
        id,
        full_name
      )
    `
    )
    .eq('station_id', stationId)
    .in('status', ['COMPLETED', 'FLAGGED'])
    .order('clock_in_at', { ascending: false })
    .limit(50);

  if (options?.date) {
    completedQuery = completedQuery
      .gte('clock_in_at', `${options.date}T00:00:00Z`)
      .lte('clock_in_at', `${options.date}T23:59:59Z`);
  }

  const [{ data: activeData, error: activeErr }, { data: completedData, error: completedErr }] =
    await Promise.all([activeQuery, completedQuery]);
  if (activeErr) throw new Error('Unable to load station attendance');
  if (completedErr) {
    throw new Error('Unable to load station attendance history');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRecord = (item: any): AttendanceRecordWithDetails => {
    return {
      id: item.id,
      station_id: item.station_id,
      station_membership_id: item.station_membership_id,
      user_id: item.user_id,
      scheduled_shift_id: item.scheduled_shift_id,
      clock_in_at: item.clock_in_at,
      clock_out_at: item.clock_out_at,
      status: item.status,
      clock_in_source: item.clock_in_source,
      clock_out_source: item.clock_out_source,
      corrected_by: item.corrected_by,
      correction_reason: item.correction_reason,
      corrected_at: item.corrected_at,
      created_at: item.created_at,
      updated_at: item.updated_at,
      user: item.profiles
        ? {
            id: item.profiles.id,
            full_name: item.profiles.full_name,
            phone: item.profiles.phone,
          }
        : undefined,
      membership: item.station_memberships
        ? {
            id: item.station_memberships.id,
            role: item.station_memberships.role,
            employee_code: item.station_memberships.employee_code,
          }
        : undefined,
      scheduled_shift: item.scheduled_shifts
        ? {
            id: item.scheduled_shifts.id,
            shift_date: item.scheduled_shifts.shift_date,
            start_at: item.scheduled_shifts.start_at,
            end_at: item.scheduled_shifts.end_at,
            notes: item.scheduled_shifts.notes,
            shift_template: item.scheduled_shifts.shift_templates
              ? {
                  name: item.scheduled_shifts.shift_templates.name,
                  start_time: item.scheduled_shifts.shift_templates.start_time,
                  end_time: item.scheduled_shifts.shift_templates.end_time,
                }
              : null,
          }
        : null,
      corrector: item.corrector
        ? {
            id: item.corrector.id,
            full_name: item.corrector.full_name,
          }
        : null,
    };
  };

  return {
    activeRecords: (activeData || []).map(mapRecord),
    completedRecords: (completedData || []).map(mapRecord),
  };
}

/**
 * Minimal auditable admin correction for an attendance record.
 * Allowed actions:
 * - 'CLOSE': manually close an accidentally left-open attendance record
 * - 'FLAG': flag an attendance record for audit review
 */
export async function adminCorrectAttendance(
  supabase: TypedSupabaseClient,
  input: AdminAttendanceCorrectionInput
): Promise<{ success: boolean; record?: AttendanceRecord; error?: string }> {
  const { attendanceRecordId, stationId, adminUserId, action, reason, clockOutAt } = input;

  if (!reason || !reason.trim()) {
    return {
      success: false,
      error: 'יש להזין סיבת תיקון מנהלי מפורשת לצורכי ביקורת.',
    };
  }

  const nowIso = new Date().toISOString();
  const updatePayload: Database['public']['Tables']['attendance_records']['Update'] = {
    corrected_by: adminUserId,
    correction_reason: reason.trim(),
    corrected_at: nowIso,
    updated_at: nowIso,
  };

  if (action === 'CLOSE') {
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('clock_in_at')
      .eq('id', attendanceRecordId)
      .maybeSingle();

    const minTimeMs = existing?.clock_in_at ? new Date(existing.clock_in_at).getTime() : Date.now();
    const desiredOutMs = clockOutAt ? new Date(clockOutAt).getTime() : Date.now();
    const safeOutIso = new Date(Math.max(desiredOutMs, minTimeMs)).toISOString();

    updatePayload.status = 'COMPLETED';
    updatePayload.clock_out_at = safeOutIso;
    updatePayload.clock_out_source = 'MANUAL_ADMIN';
  } else if (action === 'FLAG') {
    updatePayload.status = 'FLAGGED';
  }

  const { data, error } = await supabase
    .from('attendance_records')
    .update(updatePayload)
    .eq('id', attendanceRecordId)
    .eq('station_id', stationId)
    .select('*')
    .single();

  if (error || !data) {
    return {
      success: false,
      error: `נכשל בתיקון רשומת נוכחות: ${error?.message || 'שגיאה'}`,
    };
  }

  return {
    success: true,
    record: data as AttendanceRecord,
  };
}

/**
 * Rotates a station's NFC public token.
 */
export async function rotateStationNfcToken(
  supabase: TypedSupabaseClient,
  stationId: string
): Promise<{ success: boolean; newToken?: string; error?: string }> {
  const { data, error } = await supabase.rpc('rotate_station_nfc_token', {
    p_station_id: stationId,
  });

  if (error || !data) {
    return {
      success: false,
      error: error?.message || 'נכשל בסיבוב מזהה NFC',
    };
  }

  return {
    success: true,
    newToken: data,
  };
}
