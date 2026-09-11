import { getServerContext } from '@/app/lib/server-context';
import { redirect, notFound } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { getStationById, listShiftTemplates } from '@yellowshifts/database';
import { Container, PageHeader, Badge } from '@yellowshifts/ui';
import { ArrowRightIcon, StationIcon } from '@yellowshifts/icons';
import { LogoutButton } from '../../../components/LogoutButton';
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

  // Caller authorization: Platform Admin OR Station Admin of this station
  const isPlatformAdmin = context.isPlatformAdmin;
  const isStationAdmin = context.memberships.some(
    (m) =>
      m.station.id === stationId &&
      m.membership.role === 'ADMIN' &&
      m.membership.status === 'ACTIVE'
  );

  if (!isPlatformAdmin && !isStationAdmin) {
    redirect('/');
  }

  const [station, templates] = await Promise.all([
    getStationById(supabase, stationId),
    listShiftTemplates(supabase, stationId, false),
  ]);

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
      {/* Top Header */}
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '3px solid var(--ys-color-brand-yellow)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          padding: '16px 0',
        }}
      >
        <Container size="lg">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: 'var(--ys-color-brand-yellow)',
                  color: '#16161A',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                }}
              >
                P
              </div>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: 'var(--ys-color-text-primary, #111827)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  YellowShifts Admin
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.8125rem',
                    color: 'var(--ys-color-text-secondary, #6B7280)',
                  }}
                >
                  {station.name} ({station.code}) • תבניות משמרת
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isPlatformAdmin ? (
                <Badge variant="warning">מנהל מערכת ראשי</Badge>
              ) : (
                <Badge variant="neutral">מנהל תחנה</Badge>
              )}
              <LogoutButton variant="outline" />
            </div>
          </div>
        </Container>
      </header>

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
              href={`/stations/${station.id}`}
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
            href={`/stations/${station.id}`}
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
