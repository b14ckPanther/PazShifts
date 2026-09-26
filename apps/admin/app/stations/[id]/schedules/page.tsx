import { localDate } from '@yellowshifts/reports';
import { getServerContext, getCachedStation } from '@/app/lib/server-context';
import { redirect, notFound } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { getScheduleWorkspace, getWeekStartDate } from '@yellowshifts/database';
import type { WeeklyAvailabilityWithEntries } from '@yellowshifts/types';
import { Container, PageHeader } from '@yellowshifts/ui';
import { ArrowRightIcon } from '@yellowshifts/icons';
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
      (m.station.id === station.id ||
        m.station.code.toUpperCase() === station.code.toUpperCase()) &&
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

  const isShiftManagerOnly =
    userMembership?.membership.role === 'SHIFT_MANAGER' && !isPlatformAdmin;
  const backHref = isShiftManagerOnly ? '/' : `/stations/${encodeURIComponent(station.code)}`;

  return (
    <main className="admin-page">
      <StationHeader station={station} context={context} subtitle="סידור עבודה שבועי" />

      <Container size="xl">
        <div className="admin-page-body">
          <Link href={backHref} className="admin-back-link">
            <ArrowRightIcon size={16} aria-hidden="true" />
            <span>{isShiftManagerOnly ? 'חזרה לתחנות שלי' : 'חזרה לסקירת התחנה'}</span>
          </Link>

          <PageHeader
            title="סידור עבודה שבועי"
            description={`תכנון, שיבוץ ופרסום משמרות עבור ${station.name}`}
          />

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
        </div>
      </Container>
    </main>
  );
}
