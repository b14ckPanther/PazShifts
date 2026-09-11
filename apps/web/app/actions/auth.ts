'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient, safeNextPath } from '@yellowshifts/database';

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
      error:
        error.status === 429
          ? 'יותר מדי ניסיונות. נסו שוב בעוד רגע.'
          : 'האימייל או הסיסמה אינם נכונים. נסו שוב.',
    };
  }

  redirect(safeNextPath(formData.get('next')));
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);

  await supabase.auth.signOut();
  redirect('/login');
}
