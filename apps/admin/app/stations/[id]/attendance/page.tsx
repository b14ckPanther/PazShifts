import { getServerContext, getCachedStation } from '@/app/lib/server-context';
import { redirect, notFound } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { listStationAttendance, getStationMembers } from '@yellowshifts/database';
import { Container, PageHeader } from '@yellowshifts/ui';
import { ArrowRightIcon, ClockIcon, WarningIcon } from '@yellowshifts/icons';
import { StationHeader } from '../../../components/StationHeader';
import { StationAttendanceClient } from './StationAttendanceClient';

interface StationAttendancePageProps {
  params: Promise<{ id: string }>;
}

export default async function StationAttendancePage({ params }: StationAttendancePageProps) {
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

  const [{ activeRecords, completedRecords }, members] = await Promise.all([
    listStationAttendance(supabase, station.id),
    getStationMembers(supabase, station.id),
  ]);

  const canManageAttendance = isPlatformAdmin || isStationAdmin;

  const base = `/stations/${encodeURIComponent(station.code)}`;

  return (
    <main className="admin-page">
      <StationHeader station={station} context={context} subtitle="נוכחות עובדים בזמן אמת" />

      <Container size="xl">
        <div className="admin-page-body">
          <Link href={base} className="admin-back-link">
            <ArrowRightIcon size={16} />
            חזרה לסקירת התחנה
          </Link>

          <div className="station-hero-section">
            <PageHeader
              className="att-page-header"
              title="נוכחות עובדים"
              description="בקרת עובדים פעילים בזמן אמת, משמרות שהסתיימו, עמדת שעון נוכחות ותיקונים מנהליים."
            />
            <nav className="station-nav-pills" aria-label="מסכי נוכחות">
              <Link href={`${base}/attendance`} aria-current="page">
                <ClockIcon size={16} />
                נוכחות בזמן אמת
              </Link>
              <Link href={`${base}/exceptions`}>
                <WarningIcon size={16} />
                חריגות נוכחות
              </Link>
            </nav>
          </div>

          <StationAttendanceClient
            members={members}
            station={station}
            canManageAttendance={canManageAttendance}
            isPlatformAdmin={isPlatformAdmin}
            initialActiveRecords={activeRecords}
            initialCompletedRecords={completedRecords}
          />
        </div>
      </Container>
    </main>
  );
}
