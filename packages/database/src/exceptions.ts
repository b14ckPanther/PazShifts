import type {
  StationTolerances,
  AttendanceDeviation,
  AttendanceException,
  AttendanceRecordWithDetails,
  StationExceptionsResult,
} from '@yellowshifts/types';
import type { TypedSupabaseClient } from './auth';

// ---------------------------------------------------------------------------
// Default Tolerances (used when DB values are missing — defensive fallback)
// ---------------------------------------------------------------------------

const DEFAULT_TOLERANCES: StationTolerances = {
  allowedLateMinutes: 10,
  allowedEarlyLeaveMinutes: 10,
  leftOpenWarningHours: 12,
};

// ---------------------------------------------------------------------------
// Tolerance Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch station tolerance settings with defensive fallback defaults.
 */
export async function getStationTolerances(
  supabase: TypedSupabaseClient,
  stationId: string
): Promise<StationTolerances> {
  const { data, error } = await supabase
    .from('stations')
    .select('allowed_late_minutes, allowed_early_leave_minutes, left_open_warning_hours')
    .eq('id', stationId)
    .maybeSingle();

  if (error || !data) {
    return { ...DEFAULT_TOLERANCES };
  }

  return {
    allowedLateMinutes: data.allowed_late_minutes ?? DEFAULT_TOLERANCES.allowedLateMinutes,
    allowedEarlyLeaveMinutes:
      data.allowed_early_leave_minutes ?? DEFAULT_TOLERANCES.allowedEarlyLeaveMinutes,
    leftOpenWarningHours: data.left_open_warning_hours ?? DEFAULT_TOLERANCES.leftOpenWarningHours,
  };
}

/**
 * Update station tolerance settings.
 */
export async function updateStationTolerances(
  supabase: TypedSupabaseClient,
  stationId: string,
  tolerances: Partial<StationTolerances>
): Promise<StationTolerances> {
  const updates: Record<string, number> = {};

  if (tolerances.allowedLateMinutes !== undefined) {
    updates.allowed_late_minutes = tolerances.allowedLateMinutes;
  }
  if (tolerances.allowedEarlyLeaveMinutes !== undefined) {
    updates.allowed_early_leave_minutes = tolerances.allowedEarlyLeaveMinutes;
  }
  if (tolerances.leftOpenWarningHours !== undefined) {
    updates.left_open_warning_hours = tolerances.leftOpenWarningHours;
  }

  const { error } = await supabase
    .from('stations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', stationId);

  if (error) {
    throw new Error(`שגיאה בעדכון הגדרות סבילות נוכחות: ${error.message}`);
  }

  return getStationTolerances(supabase, stationId);
}

// ---------------------------------------------------------------------------
// Deviation Computation (Pure Function)
// ---------------------------------------------------------------------------

interface ScheduledShiftContext {
  startAt: string; // ISO timestamp
  endAt: string; // ISO timestamp
}

/**
 * Computes the attendance deviation for a single record.
 * Pure function — no database access.
 */
export function computeAttendanceDeviation(
  record: {
    status: string;
    clock_in_at: string;
    clock_out_at: string | null;
    scheduled_shift_id: string | null;
  },
  scheduledShift: ScheduledShiftContext | null,
  tolerances: StationTolerances
): {
  deviation: AttendanceDeviation;
  lateMinutes: number | null;
  earlyLeaveMinutes: number | null;
  openHours: number | null;
} {
  const nowMs = Date.now();
  const clockInMs = new Date(record.clock_in_at).getTime();

  // LEFT_OPEN: Active record exceeding left_open_warning_hours
  if (record.status === 'ACTIVE') {
    const activeHours = (nowMs - clockInMs) / (1000 * 60 * 60);
    if (activeHours >= tolerances.leftOpenWarningHours) {
      return {
        deviation: 'LEFT_OPEN',
        lateMinutes: null,
        earlyLeaveMinutes: null,
        openHours: Math.round(activeHours * 10) / 10,
      };
    }
  }

  // UNSCHEDULED: No linked scheduled shift
  if (!record.scheduled_shift_id || !scheduledShift) {
    return {
      deviation: 'UNSCHEDULED',
      lateMinutes: null,
      earlyLeaveMinutes: null,
      openHours: null,
    };
  }

  const scheduledStartMs = new Date(scheduledShift.startAt).getTime();
  const scheduledEndMs = new Date(scheduledShift.endAt).getTime();

  // Late detection: clock-in after scheduled start + tolerance
  const lateMs = clockInMs - scheduledStartMs;
  const lateMinutes = Math.max(0, Math.floor(lateMs / 60000));
  const isLate = lateMinutes > tolerances.allowedLateMinutes;

  // Early leave detection: clock-out before scheduled end - tolerance
  let earlyLeaveMinutes = 0;
  let isEarlyLeave = false;
  if (record.clock_out_at && record.status === 'COMPLETED') {
    const clockOutMs = new Date(record.clock_out_at).getTime();
    const earlyMs = scheduledEndMs - clockOutMs;
    earlyLeaveMinutes = Math.max(0, Math.floor(earlyMs / 60000));
    isEarlyLeave = earlyLeaveMinutes > tolerances.allowedEarlyLeaveMinutes;
  }

  if (isLate && isEarlyLeave) {
    return {
      deviation: 'LATE_AND_EARLY_LEAVE',
      lateMinutes,
      earlyLeaveMinutes,
      openHours: null,
    };
  }

  if (isLate) {
    return {
      deviation: 'LATE',
      lateMinutes,
      earlyLeaveMinutes: null,
      openHours: null,
    };
  }

  if (isEarlyLeave) {
    return {
      deviation: 'EARLY_LEAVE',
      lateMinutes: null,
      earlyLeaveMinutes,
      openHours: null,
    };
  }

  return {
    deviation: 'ON_TIME',
    lateMinutes: null,
    earlyLeaveMinutes: null,
    openHours: null,
  };
}

// ---------------------------------------------------------------------------
// Exception Engine — Full Day
// ---------------------------------------------------------------------------

/**
 * Retrieves all attendance exceptions for a station on a given date.
 * Combines:
 * 1. Deviation analysis on all attendance records for the date
 * 2. No-show detection for published assigned shifts with no attendance
 * 3. Left-open detection for ACTIVE records exceeding threshold
 */
export async function getStationExceptionsForDate(
  supabase: TypedSupabaseClient,
  stationId: string,
  date: string // YYYY-MM-DD
): Promise<StationExceptionsResult> {
  const dateStart = `${date}T00:00:00Z`;
  const dateEnd = `${date}T23:59:59Z`;

  // 1. Fetch all attendance records for the date (including ACTIVE left-open from earlier)
  const attendanceQuery = supabase
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
    .or(`clock_in_at.gte.${dateStart},status.eq.ACTIVE`)
    .lte('clock_in_at', dateEnd)
    .order('clock_in_at', { ascending: true });

  // 2. Fetch published shift assignments for the date (for no-show detection)
  const assignmentQuery = supabase
    .from('shift_assignments')
    .select(
      `
      id,
      station_membership_id,
      scheduled_shift_id,
      station_memberships!inner (
        id,
        role,
        status,
        employee_code,
        user_id,
        profiles (
          id,
          full_name,
          phone
        )
      ),
      scheduled_shifts!inner (
        id,
        schedule_id,
        shift_date,
        start_at,
        end_at,
        shift_template_id,
        shift_templates:shift_template_id (
          name
        ),
        schedules!inner (
          status
        )
      )
    `
    )
    .eq('station_id', stationId)
    .eq('scheduled_shifts.shift_date', date)
    .eq('scheduled_shifts.schedules.status', 'PUBLISHED')
    .eq('station_memberships.status', 'ACTIVE');

  const [tolerances, attendanceResult, assignmentResult] = await Promise.all([
    getStationTolerances(supabase, stationId),
    attendanceQuery,
    assignmentQuery,
  ]);
  if (attendanceResult.error || assignmentResult.error)
    throw new Error('לא ניתן לטעון את חריגות הנוכחות. נסו שוב.');
  const records = attendanceResult.data || [];
  const assignmentData = assignmentResult.data;

  // Filter to published, active-membership, today's assignments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todayPublishedAssignments = (assignmentData || []).filter((a: any) => {
    const shift = a.scheduled_shifts;
    const schedule = shift?.schedules;
    const membership = a.station_memberships;
    return (
      shift?.shift_date === date &&
      schedule?.status === 'PUBLISHED' &&
      membership?.status === 'ACTIVE'
    );
  });

  // Build a set of scheduled_shift_ids that have attendance for the date
  const attendedShiftIds = new Set(
    records
      .filter((r: Record<string, unknown>) => r.scheduled_shift_id)
      .map((r: Record<string, unknown>) => r.scheduled_shift_id as string)
  );

  const exceptions: AttendanceException[] = [];
  const nowMs = Date.now();

  // 3. Analyze each attendance record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of records as any[]) {
    const scheduledShiftData = item.scheduled_shifts;
    const scheduledShiftContext: ScheduledShiftContext | null = scheduledShiftData
      ? { startAt: scheduledShiftData.start_at, endAt: scheduledShiftData.end_at }
      : null;

    const result = computeAttendanceDeviation(
      {
        status: item.status,
        clock_in_at: item.clock_in_at,
        clock_out_at: item.clock_out_at,
        scheduled_shift_id: item.scheduled_shift_id,
      },
      scheduledShiftContext,
      tolerances
    );

    // Skip ON_TIME records (no exception)
    if (result.deviation === 'ON_TIME') {
      continue;
    }

    const profile = item.profiles;
    const membership = item.station_memberships;

    const mappedRecord: AttendanceRecordWithDetails = {
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
      user: profile
        ? { id: profile.id, full_name: profile.full_name, phone: profile.phone }
        : undefined,
      membership: membership
        ? { id: membership.id, role: membership.role, employee_code: membership.employee_code }
        : undefined,
      scheduled_shift: scheduledShiftData
        ? {
            id: scheduledShiftData.id,
            shift_date: scheduledShiftData.shift_date,
            start_at: scheduledShiftData.start_at,
            end_at: scheduledShiftData.end_at,
            notes: scheduledShiftData.notes ?? null,
            shift_template: scheduledShiftData.shift_templates
              ? {
                  name: scheduledShiftData.shift_templates.name,
                  start_time: scheduledShiftData.shift_templates.start_time,
                  end_time: scheduledShiftData.shift_templates.end_time,
                }
              : null,
          }
        : null,
      corrector: item.corrector
        ? { id: item.corrector.id, full_name: item.corrector.full_name }
        : null,
    };

    exceptions.push({
      id: `att-${item.id}`,
      deviation: result.deviation,
      attendanceRecord: mappedRecord,
      scheduledShift: scheduledShiftData
        ? {
            id: scheduledShiftData.id,
            shiftDate: scheduledShiftData.shift_date,
            startAt: scheduledShiftData.start_at,
            endAt: scheduledShiftData.end_at,
            templateName: scheduledShiftData.shift_templates?.name ?? null,
          }
        : null,
      worker: {
        id: profile?.id ?? item.user_id,
        fullName: profile?.full_name ?? 'עובד',
        phone: profile?.phone ?? null,
        employeeCode: membership?.employee_code ?? null,
        membershipId: item.station_membership_id,
      },
      scheduledStart: scheduledShiftContext?.startAt ?? null,
      scheduledEnd: scheduledShiftContext?.endAt ?? null,
      actualClockIn: item.clock_in_at,
      actualClockOut: item.clock_out_at,
      lateMinutes: result.lateMinutes,
      earlyLeaveMinutes: result.earlyLeaveMinutes,
      openHours: result.openHours,
    });
  }

  // 4. Detect No-Shows: Published shift assignments with no matching attendance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const assignment of todayPublishedAssignments as any[]) {
    const shiftId = assignment.scheduled_shift_id;

    // Skip if attendance exists for this shift
    if (attendedShiftIds.has(shiftId)) {
      continue;
    }

    const shift = assignment.scheduled_shifts;
    const membership = assignment.station_memberships;
    const profile = membership?.profiles;

    // Only flag as no-show if we're past the grace period
    const scheduledStartMs = new Date(shift.start_at).getTime();
    const graceDeadlineMs = scheduledStartMs + tolerances.allowedLateMinutes * 60 * 1000;

    if (nowMs <= graceDeadlineMs) {
      continue; // Still within grace period — not a no-show yet
    }

    exceptions.push({
      id: `noshow-${assignment.id}`,
      deviation: 'NO_SHOW',
      attendanceRecord: null,
      scheduledShift: {
        id: shift.id,
        shiftDate: shift.shift_date,
        startAt: shift.start_at,
        endAt: shift.end_at,
        templateName: shift.shift_templates?.name ?? null,
      },
      worker: {
        id: profile?.id ?? membership?.user_id ?? '',
        fullName: profile?.full_name ?? 'עובד',
        phone: profile?.phone ?? null,
        employeeCode: membership?.employee_code ?? null,
        membershipId: assignment.station_membership_id,
      },
      scheduledStart: shift.start_at,
      scheduledEnd: shift.end_at,
      actualClockIn: null,
      actualClockOut: null,
      lateMinutes: null,
      earlyLeaveMinutes: null,
      openHours: null,
    });
  }

  // 5. Sort exceptions by severity: LEFT_OPEN > NO_SHOW > LATE_AND_EARLY_LEAVE > LATE > EARLY_LEAVE > UNSCHEDULED
  const severityOrder: Record<AttendanceDeviation, number> = {
    LEFT_OPEN: 0,
    NO_SHOW: 1,
    LATE_AND_EARLY_LEAVE: 2,
    LATE: 3,
    EARLY_LEAVE: 4,
    UNSCHEDULED: 5,
    ON_TIME: 6,
  };

  exceptions.sort((a, b) => severityOrder[a.deviation] - severityOrder[b.deviation]);

  return {
    exceptions,
    tolerances,
    date,
    totalScheduledShifts: todayPublishedAssignments.length,
    totalAttendanceRecords: records.length,
  };
}
