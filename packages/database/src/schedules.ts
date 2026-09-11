import type {
  ShiftTemplate,
  Schedule,
  ScheduledShift,
  ShiftAssignment,
  ShiftAssignmentWithProfile,
  ScheduledShiftWithDetails,
  WeeklyScheduleDetails,
  CreateShiftTemplateInput,
  UpdateShiftTemplateInput,
  CreateScheduleInput,
  CreateScheduledShiftInput,
  UpdateScheduledShiftInput,
  AssignShiftWorkerInput,
  DuplicateShiftInput,
  CopyWeekOptions,
  CopyWeekResult,
  ScheduleValidationResult,
  ScheduleValidationWarning,
  ScheduleStatus,
  Database,
  StationRole,
  MembershipStatus,
} from '@yellowshifts/types';
import type { TypedSupabaseClient } from './auth';

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapShiftTemplateRow(
  row: Database['public']['Tables']['shift_templates']['Row']
): ShiftTemplate {
  return {
    id: row.id,
    stationId: row.station_id,
    name: row.name,
    startTime: row.start_time.slice(0, 5), // "HH:MM"
    endTime: row.end_time.slice(0, 5), // "HH:MM"
    isActive: row.is_active,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapScheduleRow(row: Database['public']['Tables']['schedules']['Row']): Schedule {
  return {
    id: row.id,
    stationId: row.station_id,
    weekStartDate: row.week_start_date,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapScheduledShiftRow(
  row: Database['public']['Tables']['scheduled_shifts']['Row']
): ScheduledShift {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    stationId: row.station_id,
    shiftTemplateId: row.shift_template_id,
    shiftDate: row.shift_date,
    startAt: row.start_at,
    endAt: row.end_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapShiftAssignmentRow(
  row: Database['public']['Tables']['shift_assignments']['Row']
): ShiftAssignment {
  return {
    id: row.id,
    scheduledShiftId: row.scheduled_shift_id,
    stationId: row.station_id,
    stationMembershipId: row.station_membership_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Date & Time Utility Functions
// ---------------------------------------------------------------------------

/**
 * Normalizes a time string to "HH:MM:SS".
 */
export function normalizeTimeString(time: string): string {
  const parts = time.trim().split(':');
  const p0 = parts[0] ?? '00';
  const p1 = parts[1] ?? '00';
  const p2 = parts[2] ?? '00';

  if (parts.length === 2) {
    return `${p0.padStart(2, '0')}:${p1.padStart(2, '0')}:00`;
  }
  if (parts.length === 3) {
    return `${p0.padStart(2, '0')}:${p1.padStart(2, '0')}:${p2.padStart(2, '0')}`;
  }
  return time;
}

/**
 * Deterministically calculates the Monday date of the week for a given date.
 * Output format: "YYYY-MM-DD".
 */
export function getWeekStartDate(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00Z`) : new Date(date);
  const day = d.getUTCDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days to Monday; else 1 - day
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Adds days to a "YYYY-MM-DD" date string and returns the resulting "YYYY-MM-DD".
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculates startAt and endAt timestamps for a shift.
 * Handles overnight shifts spanning across midnight (where endTime <= startTime).
 */
export function calculateShiftTimestamps(
  shiftDate: string,
  startTime: string,
  endTime: string
): { startAt: string; endAt: string; isOvernight: boolean } {
  const normStart = normalizeTimeString(startTime);
  const normEnd = normalizeTimeString(endTime);

  const startHour = parseInt(normStart.slice(0, 2), 10);
  const startMin = parseInt(normStart.slice(3, 5), 10);
  const endHour = parseInt(normEnd.slice(0, 2), 10);
  const endMin = parseInt(normEnd.slice(3, 5), 10);

  const isOvernight = endHour < startHour || (endHour === startHour && endMin <= startMin);
  const endDate = isOvernight ? addDaysToDate(shiftDate, 1) : shiftDate;

  // Store in ISO format with UTC representation
  const startAt = `${shiftDate}T${normStart}Z`;
  const endAt = `${endDate}T${normEnd}Z`;

  return { startAt, endAt, isOvernight };
}

// ---------------------------------------------------------------------------
// Shift Templates
// ---------------------------------------------------------------------------

export async function listShiftTemplates(
  supabase: TypedSupabaseClient,
  stationId: string,
  activeOnly: boolean = false
): Promise<ShiftTemplate[]> {
  let query = supabase
    .from('shift_templates')
    .select('*')
    .eq('station_id', stationId)
    .order('display_order', { ascending: true })
    .order('start_time', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`שגיאה בטעינת תבניות משמרת: ${error.message}`);
  }

  return (data ?? []).map(mapShiftTemplateRow);
}

export async function getShiftTemplateById(
  supabase: TypedSupabaseClient,
  templateId: string
): Promise<ShiftTemplate | null> {
  const { data, error } = await supabase
    .from('shift_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`שגיאה באיתור תבנית משמרת: ${error.message}`);
  }

  return data ? mapShiftTemplateRow(data) : null;
}

export async function createShiftTemplate(
  supabase: TypedSupabaseClient,
  input: CreateShiftTemplateInput
): Promise<ShiftTemplate> {
  const normStart = normalizeTimeString(input.startTime);
  const normEnd = normalizeTimeString(input.endTime);

  if (normStart === normEnd) {
    throw new Error('שעת סיום חייבת להיות שונה משעת התחלה');
  }

  const { data, error } = await supabase
    .from('shift_templates')
    .insert({
      station_id: input.stationId,
      name: input.name.trim(),
      start_time: normStart,
      end_time: normEnd,
      display_order: input.displayOrder ?? 0,
      is_active: input.isActive ?? true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`שגיאה ביצירת תבנית משמרת: ${error.message}`);
  }

  return mapShiftTemplateRow(data);
}

export async function updateShiftTemplate(
  supabase: TypedSupabaseClient,
  templateId: string,
  input: UpdateShiftTemplateInput
): Promise<ShiftTemplate> {
  const updates: Database['public']['Tables']['shift_templates']['Update'] = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.startTime !== undefined) updates.start_time = normalizeTimeString(input.startTime);
  if (input.endTime !== undefined) updates.end_time = normalizeTimeString(input.endTime);
  if (input.displayOrder !== undefined) updates.display_order = input.displayOrder;
  if (input.isActive !== undefined) updates.is_active = input.isActive;

  const { data, error } = await supabase
    .from('shift_templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .single();

  if (error) {
    throw new Error(`שגיאה בעדכון תבנית משמרת: ${error.message}`);
  }

  return mapShiftTemplateRow(data);
}

export async function toggleShiftTemplateStatus(
  supabase: TypedSupabaseClient,
  templateId: string,
  isActive: boolean
): Promise<ShiftTemplate> {
  return updateShiftTemplate(supabase, templateId, { isActive });
}

export async function deleteShiftTemplate(
  supabase: TypedSupabaseClient,
  templateId: string
): Promise<void> {
  const { error } = await supabase.from('shift_templates').delete().eq('id', templateId);
  if (error) {
    throw new Error(`שגיאה במחיקת תבנית משמרת: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

export async function getWeeklySchedule(
  supabase: TypedSupabaseClient,
  stationId: string,
  weekStartDate: string
): Promise<WeeklyScheduleDetails | null> {
  const normWeekStart = getWeekStartDate(weekStartDate);

  // 1. Fetch Schedule row
  const { data: scheduleData, error: scheduleError } = await supabase
    .from('schedules')
    .select('*')
    .eq('station_id', stationId)
    .eq('week_start_date', normWeekStart)
    .single();

  if (scheduleError) {
    if (scheduleError.code === 'PGRST116') return null;
    throw new Error(`שגיאה בטעינת סידור עבודה: ${scheduleError.message}`);
  }

  // 2. Fetch Scheduled Shifts for this schedule
  const { data: shiftsData, error: shiftsError } = await supabase
    .from('scheduled_shifts')
    .select(
      `
      *,
      shift_templates (
        name
      ),
      shift_assignments (
        id,
        scheduled_shift_id,
        station_id,
        station_membership_id,
        status,
        created_at,
        updated_at,
        station_memberships (
          id,
          role,
          status,
          employee_code,
          profiles (
            id,
            full_name,
            email,
            phone,
            avatar_url
          )
        )
      )
    `
    )
    .eq('schedule_id', scheduleData.id)
    .order('shift_date', { ascending: true })
    .order('start_at', { ascending: true });

  if (shiftsError) {
    throw new Error(`שגיאה בטעינת משמרות סידור: ${shiftsError.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shifts: ScheduledShiftWithDetails[] = (shiftsData ?? []).map((s: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignments: ShiftAssignmentWithProfile[] = (s.shift_assignments ?? []).map((a: any) => {
      const mem = a.station_memberships;
      const prof = mem?.profiles;
      return {
        id: a.id,
        scheduledShiftId: a.scheduled_shift_id,
        stationId: a.station_id,
        stationMembershipId: a.station_membership_id,
        status: a.status,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        membership: {
          id: mem?.id ?? a.station_membership_id,
          role: (mem?.role as StationRole) ?? 'WORKER',
          status: (mem?.status as MembershipStatus) ?? 'ACTIVE',
          employeeCode: mem?.employee_code ?? null,
        },
        user: {
          id: prof?.id ?? '',
          fullName: prof?.full_name ?? 'משתמש',
          email: prof?.email ?? null,
          phone: prof?.phone ?? null,
          avatarUrl: prof?.avatar_url ?? null,
        },
      };
    });

    return {
      id: s.id,
      scheduleId: s.schedule_id,
      stationId: s.station_id,
      shiftTemplateId: s.shift_template_id,
      shiftDate: s.shift_date,
      startAt: s.start_at,
      endAt: s.end_at,
      notes: s.notes,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      templateName: s.shift_templates?.name ?? null,
      assignments,
    };
  });

  return {
    ...mapScheduleRow(scheduleData),
    shifts,
  };
}

export async function createWeeklySchedule(
  supabase: TypedSupabaseClient,
  input: CreateScheduleInput
): Promise<Schedule> {
  const normWeekStart = getWeekStartDate(input.weekStartDate);

  const { data, error } = await supabase
    .from('schedules')
    .insert({
      station_id: input.stationId,
      week_start_date: normWeekStart,
      status: 'DRAFT',
      created_by: input.createdBy ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('כבר קיים סידור עבודה שבועי עבור שבוע ותחנה אלו');
    }
    throw new Error(`שגיאה ביצירת סידור שבועי: ${error.message}`);
  }

  return mapScheduleRow(data);
}

export async function updateScheduleStatus(
  supabase: TypedSupabaseClient,
  scheduleId: string,
  status: ScheduleStatus
): Promise<Schedule> {
  const { data, error } = await supabase
    .from('schedules')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .select()
    .single();

  if (error) {
    throw new Error(`שגיאה בעדכון סטטוס סידור עבודה: ${error.message}`);
  }

  return mapScheduleRow(data);
}

// ---------------------------------------------------------------------------
// Scheduled Shifts
// ---------------------------------------------------------------------------

export async function createScheduledShift(
  supabase: TypedSupabaseClient,
  input: CreateScheduledShiftInput
): Promise<ScheduledShift> {
  const { data, error } = await supabase
    .from('scheduled_shifts')
    .insert({
      schedule_id: input.scheduleId,
      station_id: input.stationId,
      shift_template_id: input.shiftTemplateId ?? null,
      shift_date: input.shiftDate,
      start_at: input.startAt,
      end_at: input.endAt,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`שגיאה בהוספת משמרת לסידור: ${error.message}`);
  }

  return mapScheduledShiftRow(data);
}

export async function updateScheduledShiftTimes(
  supabase: TypedSupabaseClient,
  shiftId: string,
  input: UpdateScheduledShiftInput
): Promise<ScheduledShift> {
  const updates: Database['public']['Tables']['scheduled_shifts']['Update'] = {
    updated_at: new Date().toISOString(),
  };

  if (input.startAt !== undefined) updates.start_at = input.startAt;
  if (input.endAt !== undefined) updates.end_at = input.endAt;
  if (input.notes !== undefined) updates.notes = input.notes ? input.notes.trim() : null;

  const { data, error } = await supabase
    .from('scheduled_shifts')
    .update(updates)
    .eq('id', shiftId)
    .select()
    .single();

  if (error) {
    throw new Error(`שגיאה בעדכון זמני משמרת: ${error.message}`);
  }

  return mapScheduledShiftRow(data);
}

export async function deleteScheduledShift(
  supabase: TypedSupabaseClient,
  shiftId: string
): Promise<void> {
  const { error } = await supabase.from('scheduled_shifts').delete().eq('id', shiftId);
  if (error) {
    throw new Error(`שגיאה במחיקת משמרת מסידור: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Shift Assignments
// ---------------------------------------------------------------------------

export async function assignWorkerToShift(
  supabase: TypedSupabaseClient,
  input: AssignShiftWorkerInput
): Promise<ShiftAssignment> {
  const { data, error } = await supabase
    .from('shift_assignments')
    .insert({
      scheduled_shift_id: input.scheduledShiftId,
      station_id: input.stationId,
      station_membership_id: input.stationMembershipId,
      status: input.status ?? 'ASSIGNED',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('עובד זה כבר משובץ למשמרת זו');
    }
    throw new Error(`שגיאה בשיבוץ עובד למשמרת: ${error.message}`);
  }

  return mapShiftAssignmentRow(data);
}

export async function removeWorkerFromShift(
  supabase: TypedSupabaseClient,
  assignmentId: string
): Promise<void> {
  const { error } = await supabase.from('shift_assignments').delete().eq('id', assignmentId);
  if (error) {
    throw new Error(`שגיאה בהסרת שיבוץ עובד: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Advanced Phase 6 Scheduling Operations
// ---------------------------------------------------------------------------

/**
 * Duplicates a scheduled shift to a target date.
 * Preserves shift template, duration, start/end hours, and notes.
 */
export async function duplicateScheduledShift(
  supabase: TypedSupabaseClient,
  input: DuplicateShiftInput
): Promise<ScheduledShift> {
  // 1. Fetch source shift
  const { data: sourceShift, error: srcErr } = await supabase
    .from('scheduled_shifts')
    .select('*')
    .eq('id', input.sourceShiftId)
    .single();

  if (srcErr || !sourceShift) {
    throw new Error(`משמרת המקור לא נמצאה: ${srcErr?.message || ''}`);
  }

  // 2. Extract hours
  const startStr = sourceShift.start_at.includes('T')
    ? (sourceShift.start_at.split('T')[1]?.slice(0, 5) ?? '00:00')
    : sourceShift.start_at.slice(11, 16);
  const endStr = sourceShift.end_at.includes('T')
    ? (sourceShift.end_at.split('T')[1]?.slice(0, 5) ?? '00:00')
    : sourceShift.end_at.slice(11, 16);

  const { startAt, endAt } = calculateShiftTimestamps(input.targetShiftDate, startStr, endStr);

  // 3. Create target shift
  const { data, error } = await supabase
    .from('scheduled_shifts')
    .insert({
      schedule_id: input.scheduleId,
      station_id: input.stationId,
      shift_template_id: sourceShift.shift_template_id,
      shift_date: input.targetShiftDate,
      start_at: startAt,
      end_at: endAt,
      notes:
        input.notes !== undefined ? (input.notes ? input.notes.trim() : null) : sourceShift.notes,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`שגיאה בשכפול משמרת: ${error.message}`);
  }

  return mapScheduledShiftRow(data);
}

/**
 * Copies an entire weekly schedule from source week to target week.
 * Preserves relative day offset and start/end times.
 * If copyAssignments is true, copies worker assignments only for workers who remain ACTIVE.
 */
export async function copyWeeklySchedule(
  supabase: TypedSupabaseClient,
  options: CopyWeekOptions
): Promise<CopyWeekResult> {
  const normSourceWeek = getWeekStartDate(options.sourceWeekStartDate);
  const normTargetWeek = getWeekStartDate(options.targetWeekStartDate);

  if (normSourceWeek === normTargetWeek) {
    throw new Error('לא ניתן להעתיק שבוע לעצמו');
  }

  // 1. Fetch or create target schedule
  let targetSchedule = await getWeeklySchedule(supabase, options.stationId, normTargetWeek);
  if (!targetSchedule) {
    const created = await createWeeklySchedule(supabase, {
      stationId: options.stationId,
      weekStartDate: normTargetWeek,
      createdBy: options.createdBy ?? null,
    });
    targetSchedule = await getWeeklySchedule(supabase, options.stationId, created.weekStartDate);
  }

  if (!targetSchedule) {
    throw new Error('שגיאה באיתור או יצירת סידור שבוע יעד');
  }

  if (targetSchedule.status !== 'DRAFT') {
    throw new Error('ניתן להעתיק שבוע רק לסידור עבודה הנמצא בסטטוס טיוטה (DRAFT)');
  }

  // 2. Fetch source schedule
  const sourceSchedule = await getWeeklySchedule(supabase, options.stationId, normSourceWeek);
  if (!sourceSchedule || sourceSchedule.shifts.length === 0) {
    return {
      targetScheduleId: targetSchedule.id,
      copiedShifts: 0,
      copiedAssignments: 0,
      skippedInactiveWorkers: 0,
    };
  }

  // 3. Compute day offset between target and source weeks
  const sourceTime = new Date(`${normSourceWeek}T00:00:00Z`).getTime();
  const targetTime = new Date(`${normTargetWeek}T00:00:00Z`).getTime();
  const diffDays = Math.round((targetTime - sourceTime) / (1000 * 60 * 60 * 24));

  // 4. Fetch active memberships of station for safe assignment migration
  const { data: activeMemberships, error: memErr } = await supabase
    .from('station_memberships')
    .select('id, status')
    .eq('station_id', options.stationId)
    .eq('status', 'ACTIVE');

  if (memErr) {
    throw new Error(`שגיאה בטעינת אנשי צוות פעילים: ${memErr.message}`);
  }

  const activeMemberIds = new Set((activeMemberships ?? []).map((m) => m.id));

  let copiedShifts = 0;
  let copiedAssignments = 0;
  let skippedInactiveWorkers = 0;

  // 5. Duplicate each shift and assignments
  for (const srcShift of sourceSchedule.shifts) {
    const targetShiftDate = addDaysToDate(srcShift.shiftDate, diffDays);

    const sTime = srcShift.startAt.includes('T')
      ? (srcShift.startAt.split('T')[1]?.slice(0, 5) ?? '00:00')
      : srcShift.startAt.slice(11, 16);
    const eTime = srcShift.endAt.includes('T')
      ? (srcShift.endAt.split('T')[1]?.slice(0, 5) ?? '00:00')
      : srcShift.endAt.slice(11, 16);

    const { startAt, endAt } = calculateShiftTimestamps(targetShiftDate, sTime, eTime);

    const { data: newShift, error: shiftInsertErr } = await supabase
      .from('scheduled_shifts')
      .insert({
        schedule_id: targetSchedule.id,
        station_id: options.stationId,
        shift_template_id: srcShift.shiftTemplateId,
        shift_date: targetShiftDate,
        start_at: startAt,
        end_at: endAt,
        notes: srcShift.notes,
      })
      .select()
      .single();

    if (shiftInsertErr || !newShift) {
      throw new Error(`שגיאה בהעתקת משמרת לסידור היעד: ${shiftInsertErr?.message || ''}`);
    }

    copiedShifts++;

    // Copy assignments if requested
    if (options.copyAssignments && srcShift.assignments.length > 0) {
      for (const assign of srcShift.assignments) {
        if (activeMemberIds.has(assign.stationMembershipId)) {
          const { error: assignErr } = await supabase.from('shift_assignments').insert({
            scheduled_shift_id: newShift.id,
            station_id: options.stationId,
            station_membership_id: assign.stationMembershipId,
            status: 'ASSIGNED',
          });
          if (!assignErr) {
            copiedAssignments++;
          }
        } else {
          skippedInactiveWorkers++;
        }
      }
    }
  }

  return {
    targetScheduleId: targetSchedule.id,
    copiedShifts,
    copiedAssignments,
    skippedInactiveWorkers,
  };
}

/**
 * Validates a weekly schedule before publishing.
 * Detects hard errors (empty schedule) and operational warnings (shifts with 0 staff, shifts with no manager).
 */
export async function validateWeeklyScheduleForPublish(
  supabase: TypedSupabaseClient,
  scheduleId: string
): Promise<ScheduleValidationResult> {
  const { data: schedule, error: schErr } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', scheduleId)
    .single();

  if (schErr || !schedule) {
    throw new Error(`סידור עבודה לא נמצא: ${schErr?.message || ''}`);
  }

  const { data: shiftsData, error: shiftsErr } = await supabase
    .from('scheduled_shifts')
    .select(
      `
      id,
      shift_date,
      start_at,
      end_at,
      shift_templates (
        name
      ),
      shift_assignments (
        id,
        station_membership_id,
        station_memberships (
          id,
          role,
          status
        )
      )
    `
    )
    .eq('schedule_id', scheduleId)
    .order('shift_date', { ascending: true })
    .order('start_at', { ascending: true });

  if (shiftsErr) {
    throw new Error(`שגיאה בבדיקת משמרות: ${shiftsErr.message}`);
  }

  const shifts = shiftsData ?? [];
  const errors: string[] = [];
  const warnings: ScheduleValidationWarning[] = [];
  let totalAssignments = 0;

  if (shifts.length === 0) {
    errors.push('לא ניתן לפרסם סידור עבודה ריק ללא משמרות.');
    return {
      canPublish: false,
      errors,
      warnings,
      totalShifts: 0,
      totalAssignments: 0,
    };
  }

  for (const s of shifts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignments = (s.shift_assignments ?? []) as any[];
    totalAssignments += assignments.length;

    const sTime = s.start_at.includes('T')
      ? (s.start_at.split('T')[1]?.slice(0, 5) ?? '')
      : s.start_at.slice(11, 16);
    const eTime = s.end_at.includes('T')
      ? (s.end_at.split('T')[1]?.slice(0, 5) ?? '')
      : s.end_at.slice(11, 16);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tName = (s.shift_templates as any)?.name ?? null;

    // Check 1: Zero assigned staff
    if (assignments.length === 0) {
      warnings.push({
        shiftId: s.id,
        shiftDate: s.shift_date,
        startTime: sTime,
        endTime: eTime,
        templateName: tName,
        type: 'no_workers',
        message: `משמרת ללא עובדים משובצים (${s.shift_date} ${sTime}-${eTime})`,
      });
    } else {
      // Check 2: At least one manager (ADMIN or SHIFT_MANAGER)
      const hasManager = assignments.some(
        (a) =>
          a.station_memberships?.role === 'ADMIN' || a.station_memberships?.role === 'SHIFT_MANAGER'
      );

      if (!hasManager) {
        warnings.push({
          shiftId: s.id,
          shiftDate: s.shift_date,
          startTime: sTime,
          endTime: eTime,
          templateName: tName,
          type: 'no_manager',
          message: `משמרת ללא מנהל משמרת או מנהל תחנה משובץ (${s.shift_date} ${sTime}-${eTime})`,
        });
      }
    }
  }

  return {
    canPublish: errors.length === 0,
    errors,
    warnings,
    totalShifts: shifts.length,
    totalAssignments,
  };
}

/**
 * Reverts a PUBLISHED weekly schedule back to DRAFT for controlled editing.
 */
export async function revertScheduleToDraft(
  supabase: TypedSupabaseClient,
  scheduleId: string
): Promise<Schedule> {
  const { data, error } = await supabase
    .from('schedules')
    .update({
      status: 'DRAFT',
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .select()
    .single();

  if (error) {
    throw new Error(`שגיאה בהחזרת סידור לטיוטה: ${error.message}`);
  }

  return mapScheduleRow(data);
}
