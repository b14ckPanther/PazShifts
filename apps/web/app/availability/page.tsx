import { getServerContext } from '@/app/lib/server-context';
import { redirect } from 'next/navigation';
import { getAvailabilityWeekStart, getWorkerWeeklyAvailability } from '@yellowshifts/database';
import { Container, PageHeader } from '@yellowshifts/ui';
import { StationSelector } from '../components/StationSelector';
import { WorkerHeader } from '../components/WorkerHeader';
import { WeeklyAvailabilityForm } from '../components/WeeklyAvailabilityForm';

interface AvailabilityPageProps {
  searchParams: Promise<{ stationId?: string; week?: string }>;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getTodayDateStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
}

function getRelevantUpcomingWeek(currentSunday: string): string {
  const now = new Date();
  const d = new Date(`${currentSunday}T00:00:00Z`);
  // If we are on or past Thursday (day 4) or Sunday (day 0), default to next week, otherwise current week
  if (now.getDay() >= 4 || now.getDay() === 0) {
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return d.toISOString().slice(0, 10);
}

export default async function AvailabilityPage({ searchParams }: AvailabilityPageProps) {
  const { supabase, context } = await getServerContext();

  if (!context) {
    redirect('/login');
  }

  const { user, profile, memberships } = context;
  const resolvedSearchParams = await searchParams;

  if (memberships.length === 0) {
    redirect('/');
  }

  let activeContext = memberships[0];
  if (resolvedSearchParams.stationId) {
    const matched = memberships.find((m) => m.station.id === resolvedSearchParams.stationId);
    if (matched) {
      activeContext = matched;
    }
  }

  if (!activeContext) {
    redirect('/');
  }

  const todayStr = getTodayDateStr();
  const currentSunday = getAvailabilityWeekStart(todayStr);
  const maxWeekStart = addDays(currentSunday, 14);

  let selectedWeekStart = resolvedSearchParams.week
    ? getAvailabilityWeekStart(resolvedSearchParams.week)
    : getRelevantUpcomingWeek(currentSunday);

  // Enforce boundary: do not allow navigating to past weeks or beyond 2 weeks ahead
  if (selectedWeekStart < currentSunday) {
    selectedWeekStart = currentSunday;
  } else if (selectedWeekStart > maxWeekStart) {
    selectedWeekStart = maxWeekStart;
  }

  const isHistorical = selectedWeekStart < currentSunday;

  const availability = await getWorkerWeeklyAvailability(
    supabase,
    activeContext.membership.id,
    selectedWeekStart
  );

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
      <WorkerHeader
        station={activeContext.station}
        user={user}
        profile={profile}
        role={activeContext.membership.role}
        activeTab="availability"
        pageTitle="הגשת זמינות שבועית"
      />

      {/* Main Container */}
      <Container size="md">
        <div style={{ marginTop: '16px' }}>
          {memberships.length > 1 && (
            <StationSelector
              memberships={memberships}
              activeStationId={activeContext.station.id}
            />
          )}
          <PageHeader
            title="הגשת זמינות שבועית"
            description={`הגדר מתי אתה זמין לעבודה בתחנת ${activeContext.station.name}. מנהלי התחנה ישבצו אותך בהתאם להצהרה זו.`}
          />

          <WeeklyAvailabilityForm
            key={selectedWeekStart}
            stationId={activeContext.station.id}
            stationMembershipId={activeContext.membership.id}
            weekStartDate={selectedWeekStart}
            initialData={availability}
            isHistoricalWeek={isHistorical}
            todayStr={todayStr}
            currentWeekStart={currentSunday}
          />
        </div>
      </Container>
    </main>
  );
}
