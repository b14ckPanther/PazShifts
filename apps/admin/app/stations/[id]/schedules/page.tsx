import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  createServerSupabaseClient,
  getAuthenticatedUserContext,
  getStationById,
  getWeeklySchedule,
  listShiftTemplates,
  getStationMembers,
  getWeekStartDate,
  getStationWeeklyAvailability,
} from '@yellowshifts/database';
import type { WeeklyAvailabilityWithEntries } from '@yellowshifts/types';
import { Container, PageHeader, Badge } from '@yellowshifts/ui';
import { ArrowRightIcon, StationIcon } from '@yellowshifts/icons';
import { LogoutButton } from '../../../components/LogoutButton';
import { WeeklyScheduleManager } from '../../../components/WeeklyScheduleManager';

interface StationSchedulesPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}

export default async function StationSchedulesPage({
  params,
  searchParams,
}: StationSchedulesPageProps) {
  const { id: stationId } = await params;
  const { week: weekQuery } = await searchParams;

  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const context = await getAuthenticatedUserContext(supabase);

  if (!context) {
    redirect('/login');
  }

  // Caller authorization: Platform Admin OR Station Admin / Shift Manager of this station
  const isPlatformAdmin = context.isPlatformAdmin;
  const userMembership = context.memberships.find(
    (m) => m.station.id === stationId && m.membership.status === 'ACTIVE'
  );

  const canAccess =
    isPlatformAdmin ||
    (userMembership &&
      (userMembership.membership.role === 'ADMIN' ||
        userMembership.membership.role === 'SHIFT_MANAGER'));

  if (!canAccess) {
    redirect('/');
  }

  const canEdit =
    isPlatformAdmin ||
    (userMembership &&
      (userMembership.membership.role === 'ADMIN' ||
        userMembership.membership.role === 'SHIFT_MANAGER'));

  const selectedWeekStart = getWeekStartDate(weekQuery || new Date());

  const [station, schedule, templates, members, weeklyAvailabilityMap] = await Promise.all([
    getStationById(supabase, stationId),
    getWeeklySchedule(supabase, stationId, selectedWeekStart),
    listShiftTemplates(supabase, stationId, true),
    getStationMembers(supabase, stationId),
    getStationWeeklyAvailability(supabase, stationId, selectedWeekStart),
  ]);

  if (!station) {
    notFound();
  }

  const activeMembers = members.filter((m) => m.membership.status === 'ACTIVE');

  const availabilityRecords: Record<string, WeeklyAvailabilityWithEntries> = {};
  weeklyAvailabilityMap.forEach((val, key) => {
    availabilityRecords[key] = val;
  });

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
                  {station.name} ({station.code}) • סידור עבודה שבועי
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isPlatformAdmin ? (
                <Badge variant="warning">מנהל מערכת ראשי</Badge>
              ) : userMembership?.membership.role === 'ADMIN' ? (
                <Badge variant="neutral">מנהל תחנה</Badge>
              ) : (
                <Badge variant="neutral">מנהל משמרת</Badge>
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
            <span style={{ color: '#B45309', fontWeight: 600 }}>סידור עבודה שבועי</span>
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
              marginBottom: '16px',
            }}
          >
            <ArrowRightIcon size={14} />
            <span>חזרה לסקירת תחנה</span>
          </Link>

          <PageHeader
            title="סידור עבודה שבועי"
            description={`ניהול משמרות שבועיות, שיבוץ עובדי תחנה ופרסום סידור רשמי עבור ${station.name}`}
          />
        </div>

        <WeeklyScheduleManager
          stationId={station.id}
          stationName={station.name}
          selectedWeekStart={selectedWeekStart}
          schedule={schedule}
          templates={templates}
          activeMembers={activeMembers}
          availabilityRecords={availabilityRecords}
          canEdit={Boolean(canEdit)}
        />
      </Container>
    </main>
  );
}
