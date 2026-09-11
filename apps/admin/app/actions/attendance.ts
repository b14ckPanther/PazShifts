'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  createServerSupabaseClient,
  getAuthenticatedUserContext,
  adminCorrectAttendance,
  rotateStationNfcToken,
} from '@yellowshifts/database';
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
    (m) => m.station.id === input.stationId && m.membership.role === 'ADMIN'
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
    (m) => m.station.id === stationId && m.membership.role === 'ADMIN'
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
