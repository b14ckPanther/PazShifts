import { getServerContext, getCachedStation } from '@/app/lib/server-context';
import { redirect, notFound } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { listShiftTemplates } from '@yellowshifts/database';
import { Container, PageHeader } from '@yellowshifts/ui';
import { ArrowRightIcon, StationIcon } from '@yellowshifts/icons';
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
      (m.station.id === station.id || m.station.code.toUpperCase() === station.code.toUpperCase()) &&
      m.membership.role === 'ADMIN' &&
      m.membership.status === 'ACTIVE'
  );

  if (!isPlatformAdmin && !isStationAdmin) {
    redirect('/');
  }

  const templates = await listShiftTemplates(supabase, station.id, false);

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
      {/* Top Header */}
      <StationHeader station={station} context={context} subtitle="תבניות משמרת" />

      {/* Breadcrumb & Navigation */}
      <div
        style={{
          backgroundColor: 'var(--ys-color-surface-raised, #FFFFFF)',
          borderBottom: '1px solid var(--ys-color-border-subtle, #E5E7EB)',
          padding: '10px 0',
        }}
      >
        <Container size="lg">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
            <Link
              href="/"
              style={{
                color: 'var(--ys-color-text-secondary, #6B7280)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ראשי
            </Link>
            <span style={{ color: 'var(--ys-color-text-muted, #9CA3AF)' }}>/</span>
            <Link
              href={`/stations/${encodeURIComponent(station.code)}`}
              style={{
                color: 'var(--ys-color-text-secondary, #6B7280)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <StationIcon size={14} />
              <span>{station.name}</span>
            </Link>
            <span style={{ color: 'var(--ys-color-text-muted, #9CA3AF)' }}>/</span>
            <span style={{ color: '#B45309', fontWeight: 600 }}>תבניות משמרות</span>
          </div>
        </Container>
      </div>

      <Container size="lg" style={{ marginTop: '24px' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link
            href={`/stations/${encodeURIComponent(station.code)}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--ys-color-text-secondary, #6B7280)',
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            <ArrowRightIcon size={14} />
            חזרה לפרטי התחנה
          </Link>

          <PageHeader
            title="תבניות משמרות"
            description={`הגדרת מבנה משמרות קבוע, שעות פעילות ומשמרות לילה 24/7 עבור תחנת ${station.name}`}
          />
        </div>

        <ShiftTemplatesManager
          stationId={station.id}
          stationName={station.name}
          initialTemplates={templates}
          canManage={true}
        />
      </Container>
    </main>
  );
}
