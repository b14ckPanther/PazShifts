import { getServerContext, getCachedStation } from '@/app/lib/server-context';
import { redirect, notFound } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { getStationExceptionsForDate } from '@yellowshifts/database';
import { Container, PageHeader, Badge, Button } from '@yellowshifts/ui';
import { StationIcon, ArrowRightIcon, ClockIcon, CalendarIcon } from '@yellowshifts/icons';
import { LogoutButton } from '../../../components/LogoutButton';
import { StationExceptionsClient } from './StationExceptionsClient';

interface StationExceptionsPageProps {
  params: Promise<{ id: string }>;
}

export default async function StationExceptionsPage({ params }: StationExceptionsPageProps) {
  const { id: stationId } = await params;

  const { supabase, context } = await getServerContext();

  if (!context) {
    redirect('/login');
  }

  const station = await getCachedStation(stationId);
  if (!station) {
    notFound();
  }

  const isPlatformAdmin = context.isPlatformAdmin;
  const isStationAdmin = context.memberships.some(
    (m) =>
      (m.station.id === station.id || m.station.code.toUpperCase() === station.code.toUpperCase()) &&
      m.membership.role === 'ADMIN' &&
      m.membership.status === 'ACTIVE'
  );

  // Authorized: Platform Admin or active Station Admin
  if (!isPlatformAdmin && !isStationAdmin) {
    redirect('/');
  }

  // Get today's date in station timezone
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: station.timezone || 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const exceptionsResult = await getStationExceptionsForDate(supabase, station.id, today);

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
              gap: '12px',
            }}
          >
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
                <StationIcon size={22} />
              </div>
              <div>
                <h2
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    margin: 0,
                    lineHeight: '1.2',
                    color: 'var(--ys-color-text-primary, #111827)',
                  }}
                >
                  {station.name}
                </h2>
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--ys-color-text-secondary, #6B7280)',
                    margin: 0,
                  }}
                >
                  קוד תחנה: {station.code} — חריגות נוכחות
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Badge variant={isPlatformAdmin ? 'brandCrimson' : 'brandYellow'} dot>
                {isPlatformAdmin ? 'מנהל פלטפורמה' : 'מנהל תחנה'}
              </Badge>
              <LogoutButton variant="outline" />
            </div>
          </div>
        </Container>
      </header>

      <Container size="lg">
        {/* Navigation & Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            margin: '32px 0 24px 0',
          }}
        >
          <div>
            <Link
              href={`/stations/${encodeURIComponent(station.code)}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--ys-color-text-secondary, #6B7280)',
                fontSize: '13px',
                textDecoration: 'none',
                marginBottom: '8px',
              }}
            >
              <ArrowRightIcon size={14} />
              חזרה לפרטי התחנה
            </Link>
            <PageHeader
              title={`חריגות נוכחות — ${station.name}`}
              description="סקירה תפעולית של חריגות נוכחות ביום הנוכחי: איחורים, יציאות מוקדמות, אי-הגעות, כניסות לא מתוכננות ומשמרות שלא נסגרו."
              badge={
                <Badge
                  variant={exceptionsResult.exceptions.length > 0 ? 'brandCrimson' : 'neutral'}
                  dot
                >
                  {exceptionsResult.exceptions.length} חריגות
                </Badge>
              }
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <Link href={`/stations/${encodeURIComponent(station.code)}/attendance`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="md">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <ClockIcon size={16} />
                  נוכחות ושעון NFC
                </span>
              </Button>
            </Link>

            <Link href={`/stations/${encodeURIComponent(station.code)}/schedules`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="md">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <CalendarIcon size={16} />
                  סידור עבודה שבועי
                </span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Exceptions Client */}
        <StationExceptionsClient
          station={station}
          exceptionsResult={exceptionsResult}
          isPlatformAdmin={isPlatformAdmin}
          isStationAdmin={isStationAdmin}
        />
      </Container>
    </main>
  );
}
