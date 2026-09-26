import { getServerContext, getCachedStation } from '@/app/lib/server-context';
import { redirect, notFound } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { getStationExceptionsForDate } from '@yellowshifts/database';
import { Container, PageHeader } from '@yellowshifts/ui';
import { ArrowRightIcon, ClockIcon, WarningIcon } from '@yellowshifts/icons';
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
      (m.station.id === station.id ||
        m.station.code.toUpperCase() === station.code.toUpperCase()) &&
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

  const base = `/stations/${encodeURIComponent(station.code)}`;

  return (
    <main className="admin-page">
      <StationHeader station={station} context={context} subtitle="חריגות נוכחות" />

      <Container size="xl">
        <div className="admin-page-body">
          <Link href={base} className="admin-back-link">
            <ArrowRightIcon size={16} />
            חזרה לסקירת התחנה
          </Link>

          <div className="station-hero-section">
            <PageHeader
              className="att-page-header"
              title="חריגות נוכחות היום"
              description="סקירה תפעולית של חריגות נוכחות ביום הנוכחי: איחורים, יציאות מוקדמות, אי-הגעות, כניסות לא מתוכננות ומשמרות שלא נסגרו."
            />
            <nav className="station-nav-pills" aria-label="מסכי נוכחות">
              <Link href={`${base}/attendance`}>
                <ClockIcon size={16} />
                נוכחות בזמן אמת
              </Link>
              <Link href={`${base}/exceptions`} aria-current="page">
                <WarningIcon size={16} />
                חריגות נוכחות
              </Link>
            </nav>
          </div>

          <StationExceptionsClient
            station={station}
            exceptionsResult={exceptionsResult}
            isPlatformAdmin={isPlatformAdmin}
            isStationAdmin={isStationAdmin}
          />
        </div>
      </Container>
    </main>
  );
}
