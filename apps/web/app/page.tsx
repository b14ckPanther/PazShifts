import { getServerContext } from '@/app/lib/server-context';
import { BrandMark } from '@yellowshifts/ui';
import { redirect } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Alert,
  Button,
  Container,
  PageHeader,
} from '@yellowshifts/ui';
import { ShieldCheckIcon, BriefcaseIcon, CalendarIcon } from '@yellowshifts/icons';
import {
  isSupabaseConfigured,
  getWeekStartDate,
  getWeeklySchedule,
  configuredAppOrigin,
} from '@yellowshifts/database';
import { StationSelector } from './components/StationSelector';
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
      <main style={{ minHeight: '100vh', padding: '40px 16px', direction: 'rtl' }}>
        <Container size="md">
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
      <main
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--ys-color-surface-base, #F8FAFC)',
          color: 'var(--ys-color-text-primary, #111827)',
          paddingBottom: '64px',
          direction: 'rtl',
        }}
      >
        <header
          style={{
            backgroundColor: '#FFFFFF',
            borderBottom: '3px solid var(--ys-color-brand-yellow)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            padding: '16px 0',
          }}
        >
          <Container size="lg">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BrandMark size={36} />
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111827' }}>
                  YellowShifts • פורטל עובדים
                </h2>
              </div>
              <LogoutButton variant="outline" />
            </div>
          </Container>
        </header>

        <Container size="md">
          <div style={{ marginTop: '48px' }}>
            <Card
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <CardHeader>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}
                >
                  <ShieldCheckIcon
                    size={22}
                    color={
                      isPlatformAdmin
                        ? 'var(--ys-color-brand-yellow)'
                        : 'var(--ys-color-status-warning)'
                    }
                  />
                  <Badge variant={isPlatformAdmin ? 'brandYellow' : 'warning'} dot>
                    {isPlatformAdmin ? 'מנהל מערכת ראשי' : 'חשבון מאומת • ללא שיוך לתחנה'}
                  </Badge>
                </div>
                <CardTitle style={{ color: '#111827' }}>
                  {isPlatformAdmin ? 'פורטל עובדים • מצב מנהל מערכת ראשי' : 'אין שיוך פעיל לתחנה'}
                </CardTitle>
                <CardDescription style={{ color: '#4B5563' }}>
                  {isPlatformAdmin
                    ? 'הנך מחובר כמנהל מערכת ראשי (Platform Admin). אתר זה מיועד לצפייה במשמרות עובד. לניהול כלל התחנות, העובדים והמשמרות – עבור לפורטל הניהול.'
                    : 'חשבונך אומת במערכת, אך טרם הוקצה לתחנת פז פעילה. פנה למנהל התחנה שלך להקצאת שיוך.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  style={{
                    backgroundColor: 'var(--ys-color-surface-muted, #F9FAFB)',
                    padding: '16px',
                    borderRadius: 'var(--ys-radius-md)',
                    border: '1px solid #E5E7EB',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#374151',
                  }}
                >
                  <div>
                    <strong>שם:</strong> {profile?.fullName || user.email}
                  </div>
                  <div>
                    <strong>אימייל:</strong> {user.email}
                  </div>
                  <div>
                    <strong>הרשאה:</strong>{' '}
                    {isPlatformAdmin ? 'מנהל מערכת ראשי (Platform Admin)' : 'עובד ללא שיוך'}
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}
                >
                  {isPlatformAdmin &&
                    (adminOrigin ? (
                      <a href={adminOrigin} style={{ textDecoration: 'none' }}>
                        <Button variant="primary">מעבר לפורטל הניהול</Button>
                      </a>
                    ) : (
                      <Alert variant="warning" title="פורטל הניהול אינו מוגדר">
                        כתובת פורטל הניהול אינה זמינה. יש לפנות למנהל המערכת.
                      </Alert>
                    ))}
                  <LogoutButton variant="secondary" />
                </div>
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

  const selectedWeekStart = getWeekStartDate(resolvedSearchParams.week || new Date());

  // Fetch published schedule for worker
  const schedule = await getWeeklySchedule(supabase, activeContext.station.id, selectedWeekStart);

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
                  קוד תחנה: {activeContext.station.code} • {profile?.fullName || user.email}
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Link
                href={`/?stationId=${activeContext.station.id}`}
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
                <BriefcaseIcon size={16} />
                <span>המשמרות שלי</span>
              </Link>

              <Link
                href={`/availability?stationId=${activeContext.station.id}`}
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
                <CalendarIcon size={16} />
                <span>זמינות</span>
              </Link>
              <Link
                href={`/hours?stationId=${activeContext.station.id}`}
                style={{ color: '#111827', padding: '10px 14px', fontWeight: 600 }}
              >
                השעות שלי
              </Link>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            title="המשמרות שלי"
            description={`צפייה במשמרות המאושרות ששובצת אליהן בתחנת ${activeContext.station.name}. מוצגות רק משמרות מתוך סידורי עבודה רשמיים שפורסמו.`}
          />

          <WorkerScheduleView
            stationId={activeContext.station.id}
            stationName={activeContext.station.name}
            workerUserId={user.id}
            selectedWeekStart={selectedWeekStart}
            schedule={schedule}
          />
        </div>
      </Container>
    </main>
  );
}
