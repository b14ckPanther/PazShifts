import { localDate } from '@yellowshifts/reports';
import { getServerContext, getCachedStation } from '@/app/lib/server-context';
import { redirect, notFound } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import {
  getScheduleWorkspace,
  getWeekStartDate,
} from '@yellowshifts/database';
import type { WeeklyAvailabilityWithEntries } from '@yellowshifts/types';
import { Container, PageHeader } from '@yellowshifts/ui';
import { ArrowRightIcon, StationIcon } from '@yellowshifts/icons';
import { StationHeader } from '../../../components/StationHeader';
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

  const { supabase, context } = await getServerContext();

  if (!context) {
    redirect('/login');
  }

  const station = await getCachedStation(stationId);
  if (!station) notFound();

  // Caller authorization: Platform Admin OR Station Admin / Shift Manager of this station
  const isPlatformAdmin = context.isPlatformAdmin;
  const userMembership = context.memberships.find(
    (m) =>
      (m.station.id === station.id || m.station.code.toUpperCase() === station.code.toUpperCase()) &&
      m.membership.status === 'ACTIVE'
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

  const currentWeekStart = getWeekStartDate(localDate(new Date(), station.timezone));
  const selectedWeekStart = getWeekStartDate(weekQuery || currentWeekStart);

  const { schedule, templates, members, weeklyAvailabilityMap } = await getScheduleWorkspace(
    supabase,
    station.id,
    selectedWeekStart
  );

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
      <StationHeader station={station} context={context} subtitle="סידור עבודה שבועי" />

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
              href={
                userMembership?.membership.role === 'SHIFT_MANAGER' && !isPlatformAdmin
                  ? '/'
                  : `/stations/${encodeURIComponent(station.code)}`
              }
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
            href={
              userMembership?.membership.role === 'SHIFT_MANAGER' && !isPlatformAdmin
                ? '/'
                : `/stations/${encodeURIComponent(station.code)}`
            }
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
            <span>
              {userMembership?.membership.role === 'SHIFT_MANAGER' && !isPlatformAdmin
                ? 'חזרה לתחנות שלי'
                : 'חזרה לסקירת תחנה'}
            </span>
          </Link>

          <PageHeader
            title="סידור עבודה שבועי"
            description={`תכנון, שיבוץ ופרסום משמרות עבור ${station.name}`}
          />
        </div>

        <WeeklyScheduleManager
          stationId={station.id}
          stationName={station.name}
          selectedWeekStart={selectedWeekStart}
          currentWeekStart={currentWeekStart}
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
