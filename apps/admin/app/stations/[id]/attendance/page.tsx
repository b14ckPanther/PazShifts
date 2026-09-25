import { getServerContext, getCachedStation } from '@/app/lib/server-context';
import { redirect, notFound } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { listStationAttendance, getStationMembers } from '@yellowshifts/database';
import { Container, PageHeader, Badge, Button } from '@yellowshifts/ui';
import {
  ArrowRightIcon,
  CalendarIcon,
  UsersIcon,
  WarningIcon,
} from '@yellowshifts/icons';
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
      (m.station.id === station.id || m.station.code.toUpperCase() === station.code.toUpperCase()) &&
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
      <StationHeader station={station} context={context} subtitle="נוכחות ושעון NFC" />

      <Container size="lg">
        {/* Navigation Breadcrumb & Header */}
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
              title={`נוכחות ושעון NFC — ${station.name}`}
              description="בקרת עובדים פעילים בזמן אמת, משמרות שהסתיימו היום, הגדרות תג NFC ותיקונים מנהליים."
              badge={
                <Badge variant={activeRecords.length > 0 ? 'brandYellow' : 'neutral'} dot>
                  {activeRecords.length} פעילים כעת
                </Badge>
              }
            />
          </div>

          <div className="station-nav-pills">
            <Link href={`/stations/${encodeURIComponent(station.code)}/exceptions`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="md">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <WarningIcon size={16} />
                  חריגות נוכחות
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

            <Link href={`/stations/${encodeURIComponent(station.code)}/staff`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="md">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <UsersIcon size={16} />
                  צוות התחנה
                </span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Real-time Attendance Client */}
        <StationAttendanceClient
          members={members}
          station={station}
          canManageAttendance={canManageAttendance}
          isPlatformAdmin={isPlatformAdmin}
          initialActiveRecords={activeRecords}
          initialCompletedRecords={completedRecords}
        />
      </Container>
    </main>
  );
}
