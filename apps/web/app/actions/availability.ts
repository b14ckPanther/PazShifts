'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  createServerSupabaseClient,
  getAuthenticatedUserContext,
  saveWeeklyAvailability,
  getAvailabilityWeekStart,
} from '@yellowshifts/database';
import type { SaveAvailabilityEntryInput } from '@yellowshifts/types';

export interface SaveAvailabilityResult {
  success: boolean;
  error?: string;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function saveWorkerAvailabilityAction(input: {
  stationId: string;
  stationMembershipId: string;
  weekStartDate: string;
  notes?: string;
  entries: SaveAvailabilityEntryInput[];
}): Promise<SaveAvailabilityResult> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    const context = await getAuthenticatedUserContext(supabase);

    if (!context) {
      return { success: false, error: 'אינך מחובר למערכת' };
    }

    // Security validation: verify that stationMembershipId belongs to the caller and is ACTIVE
    const membership = context.memberships.find(
      (m) =>
        m.membership.id === input.stationMembershipId &&
        m.station.id === input.stationId &&
        m.membership.status === 'ACTIVE'
    );

    if (!membership && !context.isPlatformAdmin) {
      return { success: false, error: 'אין לך הרשאה להגיש זמינות עבור שיוך זה' };
    }

    // Business rules:
    // 1. Prevent editing weeks older than the current active week
    // 2. Allow availability submission for up to 2 weeks in advance
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(
      new Date()
    );
    const currentWeekStart = getAvailabilityWeekStart(todayStr);
    const targetWeekStart = getAvailabilityWeekStart(input.weekStartDate);

    if (targetWeekStart <= currentWeekStart) {
      return {
        success: false,
        error: 'לא ניתן להגיש או לעדכן זמינות עבור השבוע הנוכחי או שבועות שעברו. הגשת זמינות פתוחה עבור השבוע הבא ואילך בלבד.',
      };
    }

    const maxWeekStart = addDays(currentWeekStart, 14);
    if (targetWeekStart > maxWeekStart) {
      return { success: false, error: 'ניתן להגיש זמינות עד שבועיים קדימה בלבד' };
    }

    await saveWeeklyAvailability(supabase, {
      stationId: input.stationId,
      stationMembershipId: input.stationMembershipId,
      weekStartDate: targetWeekStart,
      notes: input.notes,
      entries: input.entries,
    });

    revalidatePath('/availability');
    revalidatePath('/');

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בשמירת זמינות',
    };
  }
}
