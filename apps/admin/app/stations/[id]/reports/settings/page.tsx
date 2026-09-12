import { redirect, notFound } from 'next/navigation';
import { getServerContext } from '@/app/lib/server-context';
import { getHourPolicies, getStationById } from '@yellowshifts/database';
import { localDate } from '@yellowshifts/reports';
import { HourRulesForm } from './HourRulesForm';
export default async function HourRulesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, context } = await getServerContext();
  if (!context) redirect('/login');
  if (
    !context.isPlatformAdmin &&
    !context.memberships.some(
      (m) =>
        m.station.id === id && m.membership.role === 'ADMIN' && m.membership.status === 'ACTIVE'
    )
  )
    redirect('/');
  const station = await getStationById(supabase, id);
  if (!station) notFound();
  try {
    const policies = await getHourPolicies(supabase, id);
    return (
      <HourRulesForm
        stationId={id}
        stationName={station.name}
        today={localDate(new Date(), station.timezone)}
        policies={policies}
      />
    );
  } catch {
    return (
      <main dir="rtl" style={{ padding: 24 }}>
        <h1>לא ניתן לטעון כללי שעות</h1>
        <p>יש לוודא שמיגרציית כללי השעות הוחלה ושהחיבור זמין.</p>
        <a href={`/stations/${id}/reports`}>חזרה לדוח</a>
      </main>
    );
  }
}
