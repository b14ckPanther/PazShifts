'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@yellowshifts/database';

export interface AuthActionResult {
  success: boolean;
  error?: string;
}

export async function loginAction(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const email = (formData.get('email') as string)?.trim();
  const password = formData.get('password') as string;

  if (!email || !password) {
    return {
      success: false,
      error: 'נא להזין כתובת אימייל וסיסמה',
    };
  }

  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  const rawNext = (formData.get('next') as string)?.trim();
  const isSafeNext =
    rawNext &&
    rawNext.startsWith('/') &&
    !rawNext.startsWith('//') &&
    !rawNext.startsWith('/\\') &&
    !rawNext.includes(':');

  redirect(isSafeNext ? rawNext : '/');
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);

  await supabase.auth.signOut();
  redirect('/login');
}
