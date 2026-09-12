'use server';
import { getServerContext } from '@/app/lib/server-context';
import { revalidatePath } from 'next/cache';
import type { HourRules } from '@yellowshifts/reports';
import type { Json } from '@yellowshifts/types';
import type { TypedSupabaseClient } from '@yellowshifts/database';

export async function saveHourRules(
  stationId: string,
  effectiveFrom: string,
  rules: HourRules,
  acknowledgeHistory: boolean
) {
  const { supabase, context } = await getServerContext();
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
    return { error: 'אין הרשאה לעריכת כללי השעות.' };
  const { error } = await (supabase as TypedSupabaseClient).rpc('save_station_hour_rules', {
    p_station_id: stationId,
    p_effective_from: effectiveFrom,
    p_rules: rules as unknown as Json,
    p_ack_history: acknowledgeHistory,
  });
  if (error) {
    const messages: Record<string, string> = {
      HOUR_RULES_WEEK_START: 'תאריך התחילה חייב להיות ביום שנבחר כתחילת השבוע.',
      HOUR_RULES_PAST: 'אפשר לשמור גרסה חדשה לתאריך עתידי בלבד, לא לפני הגרסה האחרונה.',
      HOUR_RULES_FIXED_WEEK: 'לא ניתן לשנות את יום תחילת השבוע לאחר הגדרת הכללים הראשונית.',
      HOUR_RULES_ACK_HISTORY: 'יש לאשר במפורש החלה ראשונית על תקופה קודמת.',
      HOUR_RULES_INVALID: 'בדקו את הערכים: דקות שלמות, אחוזים בין 100 ל־300 ותאריכים תקינים.',
    };
    return {
      error:
        messages[error.message] || 'שמירת הכללים נכשלה. בדקו את החיבור ואת התקנת מיגרציית הכללים.',
    };
  }
  revalidatePath(`/stations/${stationId}/reports`, 'layout');
  return { success: true };
}
