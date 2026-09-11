import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { t } from '@yellowshifts/i18n';
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
import {
  PlatformAdminIcon,
  StationAdminIcon,
  StationIcon,
  ShieldAlertIcon,
  LockIcon,
  PlusIcon,
  ShieldCheckIcon,
} from '@yellowshifts/icons';
import {
  createServerSupabaseClient,
  getAuthenticatedUserContext,
  isSupabaseConfigured,
  listAllStations,
  getStationMembers,
  listAssignableUsers,
} from '@yellowshifts/database';
import { LogoutButton } from './components/LogoutButton';
import { StationAdminSelector } from './components/StationAdminSelector';
import { StationFilterableList } from './components/StationFilterableList';
import { AssignMemberForm } from './components/AssignMemberForm';
import { StaffFilterableList } from './components/StaffFilterableList';

interface PageProps {
  searchParams: Promise<{ stationId?: string }>;
}

export default async function AdminHomePage({ searchParams }: PageProps) {
  const isConfigured = isSupabaseConfigured();

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

  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const context = await getAuthenticatedUserContext(supabase);

  if (!context) {
    redirect('/login');
  }

  const { user, profile, isPlatformAdmin, memberships } = context;
  const adminMemberships = memberships.filter((m) => m.membership.role === 'ADMIN');
  const resolvedSearchParams = await searchParams;

  // CASE 1: Neither Platform Admin NOR Station Admin (SHIFT_MANAGER, WORKER, or Unassigned)
  if (!isPlatformAdmin && adminMemberships.length === 0) {
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
            borderBottom: '3px solid var(--ys-color-brand-crimson)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            padding: '16px 0',
          }}
        >
          <Container size="lg">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ShieldAlertIcon size={24} color="var(--ys-color-brand-crimson)" />
                <h2
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    margin: 0,
                    color: 'var(--ys-color-text-primary, #111827)',
                  }}
                >
                  YellowShifts Admin
                </h2>
              </div>
              <LogoutButton variant="outline" />
            </div>
          </Container>
        </header>

        <Container size="md">
          <div style={{ marginTop: '56px' }}>
            <Card>
              <CardHeader>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}
                >
                  <LockIcon size={22} color="var(--ys-color-status-danger)" />
                  <Badge variant="danger" dot>
                    גישה מוגבלת
                  </Badge>
                </div>
                <CardTitle>{t('auth.unauthorizedAdminTitle')}</CardTitle>
                <CardDescription>{t('auth.unauthorizedAdminDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  style={{
                    backgroundColor: 'var(--ys-color-surface-muted)',
                    padding: '16px',
                    borderRadius: 'var(--ys-radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '13px',
                    color: 'var(--ys-color-text-secondary)',
                  }}
                >
                  <div>
                    <strong>משתמש:</strong> {profile?.fullName || user.email}
                  </div>
                  <div>
                    <strong>מזהה:</strong> <code>{user.id}</code>
                  </div>
                  <div>
                    <strong>סטטוס הרשאה:</strong> חסום — למשתמש זה אין תפקיד ADMIN או
                    PLATFORM_ADMIN.
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <LogoutButton variant="secondary" />
              </CardFooter>
            </Card>
          </div>
        </Container>
      </main>
    );
  }

  // CASE 2: Platform Admin (Global Shell)
  if (isPlatformAdmin) {
    const stations = await listAllStations(supabase);

    // Fetch memberships across all stations to calculate real counts
    const { data: allMemberships } = await supabase
      .from('station_memberships')
      .select('station_id, role, status')
      .eq('status', 'ACTIVE');

    interface StationMembershipSummary {
      station_id: string;
      role: 'ADMIN' | 'SHIFT_MANAGER' | 'WORKER';
      status: string;
    }

    const memberCounts: Record<string, { total: number; admins: number }> = {};
    let totalAdminsCount = 0;

    for (const m of (allMemberships as unknown as StationMembershipSummary[] | null) ?? []) {
      const existing = memberCounts[m.station_id] ?? { total: 0, admins: 0 };
      existing.total += 1;
      if (m.role === 'ADMIN') {
        existing.admins += 1;
        totalAdminsCount += 1;
      }
      memberCounts[m.station_id] = existing;
    }

    const totalStations = stations.length;
    const activeStations = stations.filter((s) => s.isActive).length;
    const inactiveStations = totalStations - activeStations;

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
                  <PlatformAdminIcon size={22} />
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
                    YellowShifts Admin
                  </h2>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--ys-color-text-secondary, #6B7280)',
                      margin: 0,
                    }}
                  >
                    {t('roles.platformAdmin')} • ניהול מערכת גלובלי
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Badge variant="brandYellow" dot>
                  {t('roles.platformAdmin')}
                </Badge>
                <LogoutButton variant="outline" />
              </div>
            </div>
          </Container>
        </header>

        <Container size="lg">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              margin: '32px 0 24px 0',
            }}
          >
            <PageHeader
              title={t('stationsAdmin.title')}
              description="ממשק ניהול רב-תחנתי עליון. הקמה, עדכון, ניהול סטטוס והקצאת מנהלי תחנות ברשת YellowShifts."
              badge={
                <Badge variant="brandCrimson" dot>
                  הרשאת על גלובלית
                </Badge>
              }
            />

            <Link href="/stations/new" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="md">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <PlusIcon size={16} />
                  {t('stationsAdmin.createStation')}
                </span>
              </Button>
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Real Stats Metric Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              <Card>
                <CardHeader style={{ paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <StationIcon size={18} color="var(--ys-color-brand-yellow)" />
                    <CardTitle
                      style={{ fontSize: '14px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                    >
                      {t('stationsAdmin.totalStations')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: 'var(--ys-color-text-primary, #111827)',
                    }}
                  >
                    {totalStations}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--ys-color-text-secondary, #6B7280)',
                      marginTop: '4px',
                    }}
                  >
                    תחנות פעילות ברשת
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader style={{ paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Badge variant="success" dot>
                      פעילות
                    </Badge>
                    <CardTitle
                      style={{ fontSize: '14px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                    >
                      {t('stationsAdmin.activeStations')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#16A34A' }}>
                    {activeStations}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--ys-color-text-secondary, #6B7280)',
                      marginTop: '4px',
                    }}
                  >
                    פתוחות לכניסת עובדים ומנהלים
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader style={{ paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Badge variant="neutral" dot>
                      מושבתות
                    </Badge>
                    <CardTitle
                      style={{ fontSize: '14px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                    >
                      {t('stationsAdmin.inactiveStations')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: 'var(--ys-color-text-secondary, #6B7280)',
                    }}
                  >
                    {inactiveStations}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--ys-color-text-secondary, #6B7280)',
                      marginTop: '4px',
                    }}
                  >
                    גישה חסומה ברמת RLS
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader style={{ paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheckIcon size={18} color="var(--ys-color-brand-yellow)" />
                    <CardTitle
                      style={{ fontSize: '14px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                    >
                      {t('stationsAdmin.totalAdmins')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: 'var(--ys-color-brand-yellow)',
                    }}
                  >
                    {totalAdminsCount}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--ys-color-text-secondary, #6B7280)',
                      marginTop: '4px',
                    }}
                  >
                    הקצאות מנהלי תחנה פעילות
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filterable Stations List */}
            <StationFilterableList stations={stations} memberCounts={memberCounts} />
          </div>
        </Container>
      </main>
    );
  }

  // CASE 3: Station ADMIN (Assigned Station Context)
  let activeAdminStation = adminMemberships[0];
  if (resolvedSearchParams.stationId) {
    const matched = adminMemberships.find((m) => m.station.id === resolvedSearchParams.stationId);
    if (matched) {
      activeAdminStation = matched;
    }
  }

  if (!activeAdminStation) {
    redirect('/login');
  }

  const currentStationId = activeAdminStation.station.id;
  const [stationMembers, assignableUsers] = await Promise.all([
    getStationMembers(supabase, currentStationId),
    listAssignableUsers(supabase).catch(() => []),
  ]);

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
                <StationAdminIcon size={22} />
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
                  {activeAdminStation.station.name} • פורטל ניהול תחנה
                </h2>
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--ys-color-text-secondary, #6B7280)',
                    margin: 0,
                  }}
                >
                  קוד תחנה: {activeAdminStation.station.code}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {adminMemberships.length > 1 && (
                <StationAdminSelector
                  adminMemberships={adminMemberships}
                  activeStationId={currentStationId}
                />
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge variant="brandYellow" dot>
                  {t('roles.stationAdmin')}
                </Badge>
                <LogoutButton variant="outline" />
              </div>
            </div>
          </div>
        </Container>
      </header>

      <Container size="lg">
        <PageHeader
          title={`ניהול תחנת ${activeAdminStation.station.name}`}
          description="הינך מחובר כמנהל תחנה מורשה. ניהול מוגדר לתחנה זו בלבד."
          badge={
            <Badge variant="success" dot>
              {activeAdminStation.station.code}
            </Badge>
          }
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Station Details Card */}
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StationIcon size={20} color="var(--ys-color-brand-crimson)" />
                <CardTitle>פרטי התחנה המנוהלת</CardTitle>
              </div>
              <CardDescription>פרטי התחנה והגדרות פעילות</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: '#AAAAAA' }}>שם התחנה</div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>
                    {activeAdminStation.station.name}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#AAAAAA' }}>קוד זיהוי</div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>
                    {activeAdminStation.station.code}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#AAAAAA' }}>כתובת</div>
                  <div style={{ fontSize: '15px', fontWeight: 500 }}>
                    {activeAdminStation.station.address || 'לא הוזנה'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#AAAAAA' }}>אזור זמן</div>
                  <div style={{ fontSize: '15px', fontWeight: 500 }}>
                    {activeAdminStation.station.timezone}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assign Member Form */}
          <AssignMemberForm
            stationId={currentStationId}
            assignableUsers={assignableUsers.filter(
              (user) =>
                user.id !== context.user.id &&
                !stationMembers.some((member) => member.membership.userId === user.id)
            )}
            isPlatformAdmin={isPlatformAdmin}
          />

          <StaffFilterableList
            stationId={currentStationId}
            members={stationMembers}
            canManage
            currentUserId={context.user.id}
            isPlatformAdmin={isPlatformAdmin}
          />
        </div>
      </Container>
    </main>
  );
}
