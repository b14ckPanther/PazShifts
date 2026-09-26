import { getServerContext } from '@/app/lib/server-context';
import { redirect, notFound } from 'next/navigation';
import { getStationById } from '@yellowshifts/database';
import { Container, PageHeader, Badge } from '@yellowshifts/ui';
import { StationHeader } from '../../../components/StationHeader';
import { EditStationForm } from '../../../components/EditStationForm';

interface EditStationPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditStationPage({ params }: EditStationPageProps) {
  const { id: stationId } = await params;

  const { supabase, context } = await getServerContext();

  if (!context) {
    redirect('/login');
  }

  // Only Platform Admin can edit station properties
  if (!context.isPlatformAdmin) {
    redirect(`/stations/${stationId}`);
  }

  const station = await getStationById(supabase, stationId);

  if (!station) {
    notFound();
  }

  return (
    <main className="admin-page">
      <StationHeader station={station} context={context} subtitle="עריכת תחנה" />

      <Container size="lg">
        <div className="admin-page-body station-form-page">
          <PageHeader
            title={`עריכת ${station.name}`}
            description="עדכן את פרטי התחנה. השינויים ייכנסו לתוקף מיד במערכת."
            badge={
              <Badge variant="brandYellow" dir="ltr">
                {station.code}
              </Badge>
            }
          />

          <EditStationForm station={station} />
        </div>
      </Container>
    </main>
  );
}
