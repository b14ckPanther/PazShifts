'use server';

import { passwordCredentials } from '@yellowshifts/database';
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
  const identifier = String(formData.get('identifier') ?? formData.get('email') ?? '').trim();
  const password = formData.get('password') as string;

  if (!identifier || !password) {
    return {
      success: false,
      error: 'נא להזין אימייל או טלפון וסיסמה',
    };
  }

  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);

  const credentials = passwordCredentials(identifier, password);
  if (!credentials) return { success: false, error: 'פרטי ההתחברות אינם תקינים.' };
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    return {
      success: false,
      error:
        error.status === 429
          ? 'יותר מדי ניסיונות. נסו שוב בעוד רגע.'
          : 'פרטי ההתחברות אינם נכונים. נסו שוב.',
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
