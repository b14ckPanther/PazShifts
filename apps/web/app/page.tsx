import { localDate } from '@yellowshifts/reports';
import { getServerContext } from '@/app/lib/server-context';
import { BrandMark } from '@yellowshifts/ui';
import { redirect } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Alert,
  Container,
  PageHeader,
} from '@yellowshifts/ui';
import { ShieldCheckIcon } from '@yellowshifts/icons';
import {
  isSupabaseConfigured,
  getWeekStartDate,
  getWeeklySchedule,
  configuredAppOrigin,
} from '@yellowshifts/database';
import { StationSelector } from './components/StationSelector';
import { WorkerHeader } from './components/WorkerHeader';
import { LogoutButton } from './components/LogoutButton';
import { WorkerScheduleView } from './components/WorkerScheduleView';

interface PageProps {
  searchParams: Promise<{ stationId?: string; week?: string }>;
}

export default async function WebHomePage({ searchParams }: PageProps) {
  const isConfigured = isSupabaseConfigured();
  const adminOrigin = configuredAppOrigin(process.env.NEXT_PUBLIC_ADMIN_URL);

  if (!isConfigured) {
    return (
      <main className="worker-page">
        <Container size="md" className="worker-page-body">
          <Alert variant="warning" title="הגדרות מערכת חסרות">
            לא הוגדרו משתני סביבה מתאימים. אנא ודא קיום קובץ הגדרות סביבה תקין.
          </Alert>
        </Container>
      </main>
    );
  }

  const { supabase, context } = await getServerContext();

  if (!context) {
    redirect('/login');
  }

  const { user, profile, memberships, isPlatformAdmin } = context;
  const resolvedSearchParams = await searchParams;

  // CASE 1: Authenticated with ZERO active station memberships (including Platform Admin)
  if (memberships.length === 0) {
    return (
      <main className="worker-page">
        <header className="worker-header-root">
          <div className="worker-header-inner">
            <span className="worker-header-brand">
              <span className="worker-header-logo" aria-hidden="true">
                <BrandMark size={26} />
              </span>
              <span className="worker-header-titles">
                <span className="worker-header-title">YellowShifts</span>
                <span className="worker-header-subtitle">פורטל עובדים</span>
              </span>
            </span>
            <LogoutButton variant="secondary" />
          </div>
        </header>
        <Container size="sm">
          <div className="worker-page-body">
            <Card className="worker-no-station">
              <CardHeader>
                <div className="worker-no-station-badge">
                  <ShieldCheckIcon size={20} aria-hidden="true" />
                  <Badge variant={isPlatformAdmin ? 'brandYellow' : 'warning'} dot>
                    {isPlatformAdmin ? 'מנהל מערכת ראשי' : 'חשבון מאומת • ללא שיוך לתחנה'}
                  </Badge>
                </div>
                <CardTitle>
                  {isPlatformAdmin ? 'פורטל עובדים • מצב מנהל מערכת ראשי' : 'אין שיוך פעיל לתחנה'}
                </CardTitle>
                <CardDescription>
                  {isPlatformAdmin
                    ? 'הנך מחובר כמנהל מערכת ראשי (Platform Admin). אתר זה מיועד לצפייה במשמרות עובד. לניהול כלל התחנות, העובדים והמשמרות – עבור לפורטל הניהול.'
                    : 'חשבונך אומת במערכת, אך טרם הוקצה לתחנת פז פעילה. פנה למנהל התחנה שלך להקצאת שיוך.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="worker-no-station-facts">
                  <div>
                    <dt>שם</dt>
                    <dd>{profile?.fullName || user.email}</dd>
                  </div>
                  <div>
                    <dt>אימייל</dt>
                    <dd dir="ltr">{user.email}</dd>
                  </div>
                  <div>
                    <dt>הרשאה</dt>
                    <dd>
                      {isPlatformAdmin ? 'מנהל מערכת ראשי (Platform Admin)' : 'עובד ללא שיוך'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
              <CardFooter>
                {isPlatformAdmin &&
                  (adminOrigin ? (
                    <a href={adminOrigin} className="ys-button ys-button--primary">
                      מעבר לפורטל הניהול
                    </a>
                  ) : (
                    <Alert variant="warning" title="פורטל הניהול אינו מוגדר">
                      כתובת פורטל הניהול אינה זמינה. יש לפנות למנהל המערכת.
                    </Alert>
                  ))}
                <LogoutButton variant="secondary" />
              </CardFooter>
            </Card>
          </div>
        </Container>
      </main>
    );
  }

  // Determine Active Station Context (guaranteed memberships.length > 0 here)
  let activeContext = memberships[0]!;
  if (resolvedSearchParams.stationId) {
    const matched = memberships.find((m) => m.station.id === resolvedSearchParams.stationId);
    if (matched) {
      activeContext = matched;
    }
  }

  const selectedWeekStart = getWeekStartDate(
    resolvedSearchParams.week || localDate(new Date(), activeContext.station.timezone)
  );

  // Fetch published schedule for worker
  const schedule = await getWeeklySchedule(supabase, activeContext.station.id, selectedWeekStart);

  return (
    <main className="worker-page">
      <WorkerHeader
        station={activeContext.station}
        user={user}
        profile={profile}
        role={activeContext.membership.role}
        isPlatformAdmin={isPlatformAdmin}
        activeTab="shifts"
        pageTitle="המשמרות שלי"
      />

      <Container size="md">
        {memberships.length > 1 && (
          <StationSelector memberships={memberships} activeStationId={activeContext.station.id} />
        )}
        <PageHeader
          title="המשמרות שלי"
          description={`המשמרות ששובצת אליהן בתחנת ${activeContext.station.name}, מתוך סידורי עבודה שפורסמו.`}
        />

        <WorkerScheduleView
          timezone={activeContext.station.timezone}
          initialNow={Date.now()}
          stationId={activeContext.station.id}
          stationName={activeContext.station.name}
          workerUserId={user.id}
          selectedWeekStart={selectedWeekStart}
          schedule={schedule}
        />
      </Container>
    </main>
  );
}
