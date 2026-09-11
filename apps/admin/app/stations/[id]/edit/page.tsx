import { getServerContext } from '@/app/lib/server-context';
import { redirect, notFound } from 'next/navigation';
import { getStationById } from '@yellowshifts/database';
import { Container, PageHeader, Badge } from '@yellowshifts/ui';
import { EditStationForm } from '../../../components/EditStationForm';
import { LogoutButton } from '../../../components/LogoutButton';
import { PlatformAdminIcon } from '@yellowshifts/icons';

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
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--ys-color-surface-base, #F8FAFC)',
        color: 'var(--ys-color-text-primary, #111827)',
        paddingBottom: '64px',
        direction: 'rtl',
      }}
    >
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '3px solid var(--ys-color-brand-yellow)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          padding: '16px 0',
        }}
      >
        <Container size="lg">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--ys-radius-sm)',
                  backgroundColor: 'var(--ys-color-brand-yellow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ys-color-text-primary)',
                }}
              >
                <PlatformAdminIcon size={22} />
              </div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--ys-color-text-primary, #111827)',
                }}
              >
                YellowShifts Admin • עריכת תחנה
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Badge variant="brandYellow" dot>
                מנהל פלטפורמה
              </Badge>
              <LogoutButton variant="outline" />
            </div>
          </div>
        </Container>
      </header>

      <Container size="md">
        <div style={{ margin: '32px 0 24px 0' }}>
          <PageHeader
            title={`עריכת ${station.name}`}
            description="עדכן את פרטי התחנה. השינויים ייכנסו לתוקף מיד במערכת."
            badge={<Badge variant="brandYellow">{station.code}</Badge>}
          />
        </div>

        <EditStationForm station={station} />
      </Container>
    </main>
  );
}
