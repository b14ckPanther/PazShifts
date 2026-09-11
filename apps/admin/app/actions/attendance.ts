'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  createServerSupabaseClient,
  getAuthenticatedUserContext,
  adminCorrectAttendance,
  rotateStationNfcToken,
} from '@yellowshifts/database';
import type { TypedSupabaseClient } from '@yellowshifts/database';
import type { AttendanceRecord } from '@yellowshifts/types';

export interface AdminCorrectionResult {
  success: boolean;
  record?: AttendanceRecord;
  error?: string;
}

export interface RotateTokenResult {
  success: boolean;
  newToken?: string;
  error?: string;
}

export async function adminCorrectAttendanceAction(input: {
  attendanceRecordId: string;
  stationId: string;
  action: 'CLOSE' | 'FLAG';
  reason: string;
  clockOutAt?: string;
}): Promise<AdminCorrectionResult> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);

  const context = await getAuthenticatedUserContext(supabase);
  if (!context) {
    return { success: false, error: 'המשתמש אינו מחובר' };
  }

  const isPlatformAdmin = context.isPlatformAdmin;
  const isStationAdmin = context.memberships.some(
    (m) =>
      m.station.id === input.stationId &&
      m.membership.role === 'ADMIN' &&
      m.membership.status === 'ACTIVE'
  );

  if (!isPlatformAdmin && !isStationAdmin) {
    return {
      success: false,
      error: 'הרשאה נדחתה: רק מנהל תחנה או מנהל מערכת ראשי רשאים לבצע תיקון מנהלי ברשומות נוכחות.',
    };
  }

  const result = await adminCorrectAttendance(supabase, {
    ...input,
    adminUserId: context.user.id,
  });

  if (result.success) {
    revalidatePath(`/stations/${input.stationId}/attendance`);
  }

  return result;
}

export async function rotateNfcTokenAction(stationId: string): Promise<RotateTokenResult> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);

  const context = await getAuthenticatedUserContext(supabase);
  if (!context) {
    return { success: false, error: 'המשתמש אינו מחובר' };
  }

  const isPlatformAdmin = context.isPlatformAdmin;
  const isStationAdmin = context.memberships.some(
    (m) =>
      m.station.id === stationId &&
      m.membership.role === 'ADMIN' &&
      m.membership.status === 'ACTIVE'
  );

  if (!isPlatformAdmin && !isStationAdmin) {
    return {
      success: false,
      error: 'הרשאה נדחתה: רק מנהל תחנה או מנהל מערכת ראשי רשאים לסובב את מזהה ה-NFC.',
    };
  }

  const result = await rotateStationNfcToken(supabase, stationId);

  if (result.success) {
    revalidatePath(`/stations/${stationId}/attendance`);
    revalidatePath(`/stations/${stationId}`);
  }

  return result;
}

export async function saveManualAttendanceAction(input: {
  stationId: string;
  membershipId: string;
  recordId: string | null;
  clockIn: string;
  clockOut: string | null;
  reason: string;
  expectedUpdatedAt: string | null;
}): Promise<AdminCorrectionResult> {
  const supabase: TypedSupabaseClient = createServerSupabaseClient(await cookies());
  const context = await getAuthenticatedUserContext(supabase);
  if (
    !context ||
    (!context.isPlatformAdmin &&
      !context.memberships.some(
        (m) =>
          m.station.id === input.stationId &&
          m.membership.role === 'ADMIN' &&
          m.membership.status === 'ACTIVE'
      ))
  )
    return { success: false, error: 'אין הרשאה לעריכת נוכחות בתחנה זו.' };
  if (!input.reason.trim() || input.reason.length > 1000)
    return { success: false, error: 'יש להזין סיבת תיקון (עד 1,000 תווים).' };
  const { data, error } = await supabase.rpc('save_manual_attendance', {
    p_station_id: input.stationId,
    p_membership_id: input.membershipId,
    p_record_id: input.recordId,
    p_clock_in: input.clockIn,
    p_clock_out: input.clockOut,
    p_reason: input.reason.trim(),
    p_expected_updated_at: input.expectedUpdatedAt,
  });
  if (error || !data) {
    const message = error?.message || '';
    return {
      success: false,
      error: message.includes('MANUAL_STALE')
        ? 'הרשומה השתנתה מאז שפתחת אותה. סגור ופתח שוב כדי לערוך את הנתונים העדכניים.'
        : message.includes('MANUAL_OVERLAP') || error?.code === '23505'
          ? 'קיים דיווח חופף לעובד. בדוק את זמני הכניסה והיציאה.'
          : message.includes('MANUAL_TIME') || error?.code?.startsWith('22')
            ? 'יש לבחור שעות תקינות בעבר, עם יציאה אחרי הכניסה.'
            : error?.code === 'PGRST202'
              ? 'נדרש עדכון מסד הנתונים לפני שימוש בדיווח ידני.'
              : 'לא ניתן לשמור את הדיווח. בדוק את פרטי העובד ונסה שוב.',
    };
  }
  revalidatePath(`/stations/${input.stationId}/attendance`);
  revalidatePath(`/stations/${input.stationId}/exceptions`);
  revalidatePath(`/stations/${input.stationId}`);
  return { success: true, record: data as unknown as AttendanceRecord };
}

export async function refreshStationAttendanceAction(stationId: string) {
  const supabase: TypedSupabaseClient = createServerSupabaseClient(await cookies());
  const context = await getAuthenticatedUserContext(supabase);
  if (
    !context ||
    (!context.isPlatformAdmin &&
      !context.memberships.some(
        (m) =>
          m.station.id === stationId &&
          m.membership.role === 'ADMIN' &&
          m.membership.status === 'ACTIVE'
      ))
  )
    return null;
  const { listStationAttendance } = await import('@yellowshifts/database');
  return listStationAttendance(supabase, stationId);
}
