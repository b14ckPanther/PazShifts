'use server';

import { cookies } from 'next/headers';
import { createServerSupabaseClient, clockInWorker, clockOutWorker } from '@yellowshifts/database';
import type { ClockInResult, ClockOutResult } from '@yellowshifts/types';

export async function clockInAction(
  stationId: string,
  membershipId: string
): Promise<ClockInResult> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: 'הסשן פג תוקף. יש להתחבר מחדש.',
    };
  }

  return await clockInWorker(supabase, {
    stationId,
    membershipId,
    userId: user.id,
  });
}

export async function clockOutAction(attendanceRecordId: string): Promise<ClockOutResult> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: 'הסשן פג תוקף. יש להתחבר מחדש.',
    };
  }

  return await clockOutWorker(supabase, {
    attendanceRecordId,
    userId: user.id,
  });
}
