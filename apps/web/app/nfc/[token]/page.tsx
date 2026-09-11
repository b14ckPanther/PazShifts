import type { TypedSupabaseClient } from '@yellowshifts/database';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient, resolveStationByNfcToken } from '@yellowshifts/database';
import { NfcAttendanceClient } from './NfcAttendanceClient';

export const dynamic = 'force-dynamic';
export default async function NfcStationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ scan?: string; at?: string }>;
}) {
  const { token } = await params;
  const { scan, at } = await searchParams;
  const supabase: TypedSupabaseClient = createServerSupabaseClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const query = new URLSearchParams();
    if (scan) query.set('scan', scan);
    if (at) query.set('at', at);
    redirect(`/login?next=${encodeURIComponent(`/nfc/${encodeURIComponent(token)}?${query}`)}`);
  }
  const station = await resolveStationByNfcToken(supabase, token);
  if (!station || !station.is_active || !scan || !at) {
    return (
      <main className="mobile-flow">
        <section className="attendance-panel">
          <div className="attendance-symbol attendance-warning">!</div>
          <h1>לא ניתן לקרוא את התג</h1>
          <p>סרקו שוב את תג התחנה. אם הבעיה נמשכת, פנו למנהל התחנה.</p>
          <Link className="mobile-secondary" href="/">
            למסך שלי
          </Link>
        </section>
      </main>
    );
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();
  return (
    <main className="mobile-flow attendance-flow" dir="rtl">
      <NfcAttendanceClient
        key={scan}
        station={station}
        workerName={profile?.full_name || 'עובד'}
        nfcToken={token}
        scanId={scan}
        scannedAt={Number(at)}
      />
    </main>
  );
}
