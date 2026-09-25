import { getServerContext, getCachedStation } from '@/app/lib/server-context';
import { redirect, notFound } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { getStationExceptionsForDate } from '@yellowshifts/database';
import { Container, PageHeader, Badge, Button } from '@yellowshifts/ui';
import { ArrowRightIcon, ClockIcon, CalendarIcon } from '@yellowshifts/icons';
import { StationHeader } from '../../../components/StationHeader';
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
      <StationHeader station={station} context={context} subtitle="חריגות נוכחות" />

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

          <div className="station-nav-pills">
            <Link href={`/stations/${encodeURIComponent(station.code)}/attendance`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="md">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <ClockIcon size={16} />
                  נוכחות עובדים
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
