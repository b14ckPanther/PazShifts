'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  createServerSupabaseClient,
  getAuthenticatedUserContext,
  createShiftTemplate,
  updateShiftTemplate,
  toggleShiftTemplateStatus,
  deleteShiftTemplate,
  createWeeklySchedule,
  updateScheduleStatus,
  createScheduledShift,
  updateScheduledShiftTimes,
  deleteScheduledShift,
  assignWorkerToShift,
  removeWorkerFromShift,
  calculateShiftTimestamps,
  getWeekStartDate,
  duplicateScheduledShift,
  copyWeeklySchedule,
  validateWeeklyScheduleForPublish,
  revertScheduleToDraft,
} from '@yellowshifts/database';
import type { ScheduleStatus, CopyWeekResult, ScheduleValidationResult } from '@yellowshifts/types';

export interface ScheduleActionResult {
  success: boolean;
  id?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Authorization Helper
// ---------------------------------------------------------------------------

async function checkStationAccess(
  stationId: string,
  requireAdmin: boolean = false
): Promise<{ error?: string; userId?: string }> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const context = await getAuthenticatedUserContext(supabase);

  if (!context) {
    return { error: 'נדרשת התחברות למערכת' };
  }

  if (context.isPlatformAdmin) {
    return { userId: context.user.id };
  }

  const userStation = context.memberships.find(
    (m) => m.station.id === stationId && m.membership.status === 'ACTIVE'
  );

  if (!userStation) {
    return { error: 'אינך חבר פעיל בתחנה זו' };
  }

  if (requireAdmin && userStation.membership.role !== 'ADMIN') {
    return { error: 'פעולה זו מותרת למנהל תחנה בלבד' };
  }

  if (
    !requireAdmin &&
    userStation.membership.role !== 'ADMIN' &&
    userStation.membership.role !== 'SHIFT_MANAGER'
  ) {
    return { error: 'פעולה זו מותרת למנהל תחנה או מנהל משמרת בלבד' };
  }

  return { userId: context.user.id };
}

// ---------------------------------------------------------------------------
// Shift Template Actions
// ---------------------------------------------------------------------------

export async function createShiftTemplateAction(
  _prevState: ScheduleActionResult | null,
  formData: FormData
): Promise<ScheduleActionResult> {
  const stationId = formData.get('stationId') as string;
  const name = (formData.get('name') as string)?.trim();
  const startTime = (formData.get('startTime') as string)?.trim();
  const endTime = (formData.get('endTime') as string)?.trim();
  const displayOrderStr = formData.get('displayOrder') as string;
  const displayOrder = displayOrderStr ? parseInt(displayOrderStr, 10) : 0;

  if (!stationId) return { success: false, error: 'מזהה תחנה חסר' };
  if (!name || name.length < 1) return { success: false, error: 'נא להזין שם תבנית תקין' };
  if (!startTime || !endTime) return { success: false, error: 'נא להזין שעות התחלה וסיום' };
  if (startTime === endTime)
    return { success: false, error: 'שעת סיום חייבת להיות שונה משעת התחלה' };

  const auth = await checkStationAccess(stationId, true);
  if (auth.error) return { success: false, error: auth.error };

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    const template = await createShiftTemplate(supabase, {
      stationId,
      name,
      startTime,
      endTime,
      displayOrder,
      isActive: true,
    });

    revalidatePath(`/stations/${stationId}/templates`);
    revalidatePath(`/stations/${stationId}/schedules`);

    return { success: true, id: template.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה ביצירת תבנית משמרת',
    };
  }
}

export async function updateShiftTemplateAction(
  _prevState: ScheduleActionResult | null,
  formData: FormData
): Promise<ScheduleActionResult> {
  const stationId = formData.get('stationId') as string;
  const templateId = formData.get('templateId') as string;
  const name = (formData.get('name') as string)?.trim();
  const startTime = (formData.get('startTime') as string)?.trim();
  const endTime = (formData.get('endTime') as string)?.trim();
  const displayOrderStr = formData.get('displayOrder') as string;
  const displayOrder = displayOrderStr ? parseInt(displayOrderStr, 10) : undefined;

  if (!stationId || !templateId) return { success: false, error: 'פרטים מזהים חסרים' };
  if (!name || name.length < 1) return { success: false, error: 'נא להזין שם תבנית תקין' };
  if (!startTime || !endTime) return { success: false, error: 'נא להזין שעות התחלה וסיום' };
  if (startTime === endTime)
    return { success: false, error: 'שעת סיום חייבת להיות שונה משעת התחלה' };

  const auth = await checkStationAccess(stationId, true);
  if (auth.error) return { success: false, error: auth.error };

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    const template = await updateShiftTemplate(supabase, templateId, {
      name,
      startTime,
      endTime,
      displayOrder,
    });

    revalidatePath(`/stations/${stationId}/templates`);
    revalidatePath(`/stations/${stationId}/schedules`);

    return { success: true, id: template.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בעדכון תבנית משמרת',
    };
  }
}

export async function toggleShiftTemplateStatusAction(
  stationId: string,
  templateId: string,
  isActive: boolean
): Promise<ScheduleActionResult> {
  const auth = await checkStationAccess(stationId, true);
  if (auth.error) return { success: false, error: auth.error };

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    await toggleShiftTemplateStatus(supabase, templateId, isActive);

    revalidatePath(`/stations/${stationId}/templates`);
    revalidatePath(`/stations/${stationId}/schedules`);

    return { success: true, id: templateId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בעדכון סטטוס תבנית',
    };
  }
}

export async function deleteShiftTemplateAction(
  stationId: string,
  templateId: string
): Promise<ScheduleActionResult> {
  const auth = await checkStationAccess(stationId, true);
  if (auth.error) return { success: false, error: auth.error };

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    await deleteShiftTemplate(supabase, templateId);

    revalidatePath(`/stations/${stationId}/templates`);
    revalidatePath(`/stations/${stationId}/schedules`);

    return { success: true, id: templateId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'שגיאה במחיקת תבנית' };
  }
}

// ---------------------------------------------------------------------------
// Schedule Actions
// ---------------------------------------------------------------------------

export async function createWeeklyScheduleAction(
  _prevState: ScheduleActionResult | null,
  formData: FormData
): Promise<ScheduleActionResult> {
  const stationId = formData.get('stationId') as string;
  const weekStartDate = formData.get('weekStartDate') as string;

  if (!stationId) return { success: false, error: 'מזהה תחנה חסר' };
  if (!weekStartDate) return { success: false, error: 'נא לבחור שבוע' };

  const auth = await checkStationAccess(stationId, false);
  if (auth.error) return { success: false, error: auth.error };

  const normSunday = getWeekStartDate(weekStartDate);

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    const schedule = await createWeeklySchedule(supabase, {
      stationId,
      weekStartDate: normSunday,
      createdBy: auth.userId,
    });

    revalidatePath(`/stations/${stationId}/schedules`);

    return { success: true, id: schedule.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה ביצירת סידור שבועי',
    };
  }
}

export async function updateScheduleStatusAction(
  stationId: string,
  scheduleId: string,
  status: ScheduleStatus
): Promise<ScheduleActionResult> {
  const requireAdmin = status === 'ARCHIVED';
  const auth = await checkStationAccess(stationId, requireAdmin);
  if (auth.error) return { success: false, error: auth.error };

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    await updateScheduleStatus(supabase, scheduleId, status);

    revalidatePath(`/stations/${stationId}/schedules`);

    return { success: true, id: scheduleId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בעדכון סטטוס סידור',
    };
  }
}

// ---------------------------------------------------------------------------
// Scheduled Shifts Actions
// ---------------------------------------------------------------------------

export async function createScheduledShiftAction(
  _prevState: ScheduleActionResult | null,
  formData: FormData
): Promise<ScheduleActionResult> {
  const stationId = formData.get('stationId') as string;
  const scheduleId = formData.get('scheduleId') as string;
  const shiftDate = formData.get('shiftDate') as string;
  const startTime = formData.get('startTime') as string;
  const endTime = formData.get('endTime') as string;
  const shiftTemplateId = (formData.get('shiftTemplateId') as string) || null;
  const notes = (formData.get('notes') as string) || null;

  if (!stationId || !scheduleId || !shiftDate || !startTime || !endTime) {
    return { success: false, error: 'חסרים שדות חובה להוספת משמרת' };
  }

  const auth = await checkStationAccess(stationId, false);
  if (auth.error) return { success: false, error: auth.error };

  const { startAt, endAt } = calculateShiftTimestamps(shiftDate, startTime, endTime);

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    const shift = await createScheduledShift(supabase, {
      scheduleId,
      stationId,
      shiftTemplateId: shiftTemplateId && shiftTemplateId !== '' ? shiftTemplateId : null,
      shiftDate,
      startAt,
      endAt,
      notes,
    });

    revalidatePath(`/stations/${stationId}/schedules`);

    return { success: true, id: shift.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'שגיאה בהוספת משמרת' };
  }
}

export async function updateScheduledShiftTimesAction(
  _prevState: ScheduleActionResult | null,
  formData: FormData
): Promise<ScheduleActionResult> {
  const stationId = formData.get('stationId') as string;
  const shiftId = formData.get('shiftId') as string;
  const shiftDate = formData.get('shiftDate') as string;
  const startTime = formData.get('startTime') as string;
  const endTime = formData.get('endTime') as string;
  const notes = (formData.get('notes') as string) || null;

  if (!stationId || !shiftId || !shiftDate || !startTime || !endTime) {
    return { success: false, error: 'חסרים שדות חובה לעדכון משמרת' };
  }

  const auth = await checkStationAccess(stationId, false);
  if (auth.error) return { success: false, error: auth.error };

  const { startAt, endAt } = calculateShiftTimestamps(shiftDate, startTime, endTime);

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    const shift = await updateScheduledShiftTimes(supabase, shiftId, {
      startAt,
      endAt,
      notes,
    });

    revalidatePath(`/stations/${stationId}/schedules`);

    return { success: true, id: shift.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בעדכון זמני משמרת',
    };
  }
}

export async function deleteScheduledShiftAction(
  stationId: string,
  shiftId: string
): Promise<ScheduleActionResult> {
  const auth = await checkStationAccess(stationId, false);
  if (auth.error) return { success: false, error: auth.error };

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    await deleteScheduledShift(supabase, shiftId);

    revalidatePath(`/stations/${stationId}/schedules`);

    return { success: true, id: shiftId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'שגיאה במחיקת משמרת' };
  }
}

// ---------------------------------------------------------------------------
// Shift Assignment Actions
// ---------------------------------------------------------------------------

export async function assignWorkerToShiftAction(
  _prevState: ScheduleActionResult | null,
  formData: FormData
): Promise<ScheduleActionResult> {
  const stationId = formData.get('stationId') as string;
  const scheduledShiftId = formData.get('scheduledShiftId') as string;
  const stationMembershipId = formData.get('stationMembershipId') as string;

  if (!stationId || !scheduledShiftId || !stationMembershipId) {
    return { success: false, error: 'חסרים פרטי שיבוץ עובד' };
  }

  const auth = await checkStationAccess(stationId, false);
  if (auth.error) return { success: false, error: auth.error };

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    const assignment = await assignWorkerToShift(supabase, {
      scheduledShiftId,
      stationId,
      stationMembershipId,
    });

    revalidatePath(`/stations/${stationId}/schedules`);

    return { success: true, id: assignment.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בשיבוץ עובד למשמרת',
    };
  }
}

export async function removeWorkerFromShiftAction(
  stationId: string,
  assignmentId: string
): Promise<ScheduleActionResult> {
  const auth = await checkStationAccess(stationId, false);
  if (auth.error) return { success: false, error: auth.error };

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    await removeWorkerFromShift(supabase, assignmentId);

    revalidatePath(`/stations/${stationId}/schedules`);

    return { success: true, id: assignmentId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'שגיאה בהסרת שיבוץ עובד' };
  }
}

// ---------------------------------------------------------------------------
// Phase 6 Actions: Duplicate Shift, Copy Week, Validation, Revert to Draft
// ---------------------------------------------------------------------------

export async function duplicateShiftAction(
  stationId: string,
  scheduleId: string,
  sourceShiftId: string,
  targetShiftDate: string,
  notes?: string | null
): Promise<ScheduleActionResult> {
  const auth = await checkStationAccess(stationId, false);
  if (auth.error) return { success: false, error: auth.error };

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    const shift = await duplicateScheduledShift(supabase, {
      stationId,
      scheduleId,
      sourceShiftId,
      targetShiftDate,
      notes,
    });

    revalidatePath(`/stations/${stationId}/schedules`);

    return { success: true, id: shift.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בשכפול משמרת',
    };
  }
}

export interface CopyWeekActionResult extends ScheduleActionResult {
  copiedShifts?: number;
  copiedAssignments?: number;
  skippedInactiveWorkers?: number;
}

export async function copyPreviousWeekAction(
  stationId: string,
  sourceWeekStart: string,
  targetWeekStart: string,
  copyAssignments: boolean
): Promise<CopyWeekActionResult> {
  const auth = await checkStationAccess(stationId, false);
  if (auth.error) return { success: false, error: auth.error };

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    const result: CopyWeekResult = await copyWeeklySchedule(supabase, {
      stationId,
      sourceWeekStartDate: sourceWeekStart,
      targetWeekStartDate: targetWeekStart,
      copyAssignments,
      createdBy: auth.userId,
    });

    revalidatePath(`/stations/${stationId}/schedules`);

    return {
      success: true,
      id: result.targetScheduleId,
      copiedShifts: result.copiedShifts,
      copiedAssignments: result.copiedAssignments,
      skippedInactiveWorkers: result.skippedInactiveWorkers,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בהעתקת שבוע קודם',
    };
  }
}

export interface ValidationActionResult {
  success: boolean;
  validation?: ScheduleValidationResult;
  error?: string;
}

export async function validateScheduleAction(
  stationId: string,
  scheduleId: string
): Promise<ValidationActionResult> {
  const auth = await checkStationAccess(stationId, false);
  if (auth.error) return { success: false, error: auth.error };

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    const validation = await validateWeeklyScheduleForPublish(supabase, scheduleId);

    return { success: true, validation };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בבדיקת תקינות סידור',
    };
  }
}

export async function revertScheduleToDraftAction(
  stationId: string,
  scheduleId: string
): Promise<ScheduleActionResult> {
  const auth = await checkStationAccess(stationId, false);
  if (auth.error) return { success: false, error: auth.error };

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);

    await revertScheduleToDraft(supabase, scheduleId);

    revalidatePath(`/stations/${stationId}/schedules`);

    return { success: true, id: scheduleId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בהחזרת סידור לטיוטה',
    };
  }
}
