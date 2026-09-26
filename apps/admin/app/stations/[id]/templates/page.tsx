import { getServerContext, getCachedStation } from '@/app/lib/server-context';
import { redirect, notFound } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { listShiftTemplates } from '@yellowshifts/database';
import { Container } from '@yellowshifts/ui';
import { ArrowRightIcon } from '@yellowshifts/icons';
import { StationHeader } from '../../../components/StationHeader';
import { ShiftTemplatesManager } from '../../../components/ShiftTemplatesManager';

interface StationTemplatesPageProps {
  params: Promise<{ id: string }>;
}

export default async function StationTemplatesPage({ params }: StationTemplatesPageProps) {
  const { id: stationId } = await params;

  const { supabase, context } = await getServerContext();

  if (!context) {
    redirect('/login');
  }

  const station = await getCachedStation(stationId);
  if (!station) {
    notFound();
  }

  // Caller authorization: Platform Admin OR Station Admin of this station
  const isPlatformAdmin = context.isPlatformAdmin;
  const isStationAdmin = context.memberships.some(
    (m) =>
      (m.station.id === station.id ||
        m.station.code.toUpperCase() === station.code.toUpperCase()) &&
      m.membership.role === 'ADMIN' &&
      m.membership.status === 'ACTIVE'
  );

  if (!isPlatformAdmin && !isStationAdmin) {
    redirect('/');
  }

  const templates = await listShiftTemplates(supabase, station.id, false);

  return (
    <main className="admin-page">
      <StationHeader station={station} context={context} subtitle="תבניות משמרת" />

      <Container size="lg">
        <div className="admin-page-body">
          <Link href={`/stations/${encodeURIComponent(station.code)}`} className="admin-back-link">
            <ArrowRightIcon size={16} aria-hidden="true" />
            חזרה לפרטי התחנה
          </Link>

          <ShiftTemplatesManager
            stationId={station.id}
            stationName={station.name}
            initialTemplates={templates}
            canManage={true}
          />
        </div>
      </Container>
    </main>
  );
}
