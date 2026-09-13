import { getServerContext } from '@/app/lib/server-context';
import { BrandMark } from '@yellowshifts/ui';
import { redirect } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { getAvailabilityWeekStart, getWorkerWeeklyAvailability } from '@yellowshifts/database';
import { Container, PageHeader } from '@yellowshifts/ui';
import { CalendarIcon, BriefcaseIcon } from '@yellowshifts/icons';
import { StationSelector } from '../components/StationSelector';
import { LogoutButton } from '../components/LogoutButton';
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
            <div
              className="worker-header-identity"
              style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <BrandMark size={36} />
              <div>
                <h2
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    margin: 0,
                    lineHeight: '1.2',
                    color: '#111827',
                  }}
                >
                  YellowShifts • {activeContext.station.name}
                </h2>
                <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
                  פורטל עובדים • {profile?.fullName || user.email}
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link
                href={`/stations/${encodeURIComponent(activeContext.station.code)}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: 'var(--ys-radius-md)',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D1D5DB',
                  color: '#4B5563',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                <BriefcaseIcon size={16} />
                <span>המשמרות שלי</span>
              </Link>

              <Link
                href={`/stations/${encodeURIComponent(activeContext.station.code)}/availability`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: 'var(--ys-radius-md)',
                  backgroundColor: 'var(--ys-color-brand-yellow)',
                  color: 'var(--ys-color-text-primary)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                }}
              >
                <CalendarIcon size={16} />
                <span>זמינות</span>
              </Link>
            </div>

            <div className="worker-header-actions">
              {memberships.length > 1 && (
                <StationSelector
                  memberships={memberships}
                  activeStationId={activeContext.station.id}
                />
              )}
              <LogoutButton variant="outline" />
            </div>
          </div>
        </Container>
      </header>

      {/* Main Container */}
      <Container size="md">
        <div style={{ marginTop: '28px' }}>
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
