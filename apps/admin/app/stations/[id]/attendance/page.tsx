import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  createServerSupabaseClient,
  getAuthenticatedUserContext,
  getStationById,
  listStationAttendance,
} from '@yellowshifts/database';
import { Container, PageHeader, Badge, Button } from '@yellowshifts/ui';
import {
  StationIcon,
  ArrowRightIcon,
  CalendarIcon,
  UsersIcon,
  WarningIcon,
} from '@yellowshifts/icons';
import { LogoutButton } from '../../../components/LogoutButton';
import { StationAttendanceClient } from './StationAttendanceClient';

interface StationAttendancePageProps {
  params: Promise<{ id: string }>;
}

export default async function StationAttendancePage({ params }: StationAttendancePageProps) {
  const { id: stationId } = await params;

  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const context = await getAuthenticatedUserContext(supabase);

  if (!context) {
    redirect('/login');
  }

  const isPlatformAdmin = context.isPlatformAdmin;
  const isStationAdmin = context.memberships.some(
    (m) => m.station.id === stationId && m.membership.role === 'ADMIN'
  );
  const isShiftManager = context.memberships.some(
    (m) => m.station.id === stationId && m.membership.role === 'SHIFT_MANAGER'
  );

  // Authorized: Platform Admin, Station Admin, or Shift Manager (read-only)
  if (!isPlatformAdmin && !isStationAdmin && !isShiftManager) {
    redirect('/');
  }

  const station = await getStationById(supabase, stationId);
  if (!station) {
    notFound();
  }

  const { activeRecords, completedRecords } = await listStationAttendance(supabase, stationId);

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
                  קוד תחנה: {station.code} • נוכחות ושעון NFC
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Badge variant={isPlatformAdmin ? 'brandCrimson' : 'brandYellow'} dot>
                {isPlatformAdmin ? 'מנהל פלטפורמה' : isStationAdmin ? 'מנהל תחנה' : 'מנהל משמרת'}
              </Badge>
              <LogoutButton variant="outline" />
            </div>
          </div>
        </Container>
      </header>

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
              href={`/stations/${station.id}`}
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

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <Link href={`/stations/${station.id}/exceptions`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="md">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <WarningIcon size={16} />
                  חריגות נוכחות
                </span>
              </Button>
            </Link>

            <Link href={`/stations/${station.id}/schedules`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="md">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <CalendarIcon size={16} />
                  סידור עבודה שבועי
                </span>
              </Button>
            </Link>

            <Link href={`/stations/${station.id}/staff`} style={{ textDecoration: 'none' }}>
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
