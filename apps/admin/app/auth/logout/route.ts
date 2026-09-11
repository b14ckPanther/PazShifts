import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@yellowshifts/database';

/** A full document redirect avoids rendering the old authenticated RSC tree after cookie removal. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin !== request.nextUrl.origin) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  try {
    const supabase = createServerSupabaseClient(await cookies());
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    const response = NextResponse.redirect(new URL('/login', request.url), 303);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return new NextResponse(
      '<!doctype html><html lang="he" dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1"><title>התנתקות</title><body style="font-family:system-ui;background:#f8fafc;color:#111827;padding:24px"><h1>לא הצלחנו להשלים את ההתנתקות</h1><p>בדקו את החיבור ונסו שוב.</p><form method="post" action="/auth/logout"><button style="padding:14px 24px;font:inherit">נסו שוב</button></form></body></html>',
      {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  }
}
