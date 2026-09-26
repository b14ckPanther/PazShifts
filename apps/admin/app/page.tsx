import { getServerContext } from '@/app/lib/server-context';
import { SchedulingHome } from './components/SchedulingHome';
import { redirect } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { AdminHeader } from '@/app/components/AdminHeader';
import { t } from '@yellowshifts/i18n';
import {
  Card,
  Badge,
  Alert,
  Container,
  PageHeader,
  EmptyState,
  StatusBadge,
} from '@yellowshifts/ui';
import {
  StationIcon,
  LockIcon,
  PlusIcon,
  ShieldCheckIcon,
  CircleCheckIcon,
  PowerIcon,
} from '@yellowshifts/icons';
import { isSupabaseConfigured, listAllStations } from '@yellowshifts/database';
import { LogoutButton } from './components/LogoutButton';
import { StationFilterableList } from './components/StationFilterableList';

interface PageProps {
  searchParams: Promise<{ stationId?: string }>;
}

export default async function AdminHomePage({ searchParams }: PageProps) {
  const isConfigured = isSupabaseConfigured();

  if (!isConfigured) {
    return (
      <main className="admin-page">
        <Container size="md" className="admin-page-body">
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

  const { user, profile, isPlatformAdmin, memberships } = context;
  const adminMemberships = memberships.filter(
    (m) => m.membership.role === 'ADMIN' && m.membership.status === 'ACTIVE'
  );
  const resolvedSearchParams = await searchParams;

  const schedulingMemberships = memberships.filter(
    (m) => m.membership.role === 'SHIFT_MANAGER' && m.membership.status === 'ACTIVE'
  );
  if (!isPlatformAdmin && adminMemberships.length === 0 && schedulingMemberships.length > 0)
    return <SchedulingHome stations={schedulingMemberships.map((m) => m.station)} />;

  // CASE 1: Neither Platform Admin NOR Station Admin (SHIFT_MANAGER, WORKER, or Unassigned)
  if (!isPlatformAdmin && adminMemberships.length === 0) {
    return (
      <main className="admin-page">
        <AdminHeader title="YellowShifts" subtitle="ניהול תחנות" homeHref="/" context={context} />
        <Container size="md">
          <div className="admin-page-body admin-access-body">
            <Card className="admin-access-card">
              <EmptyState
                icon={<LockIcon size={26} />}
                title={t('auth.unauthorizedAdminTitle')}
                description={t('auth.unauthorizedAdminDesc')}
              />
              <dl className="admin-access-facts">
                <div>
                  <dt>משתמש</dt>
                  <dd>{profile?.fullName || user.email}</dd>
                </div>
                <div>
                  <dt>מזהה</dt>
                  <dd>
                    <code dir="ltr">{user.id}</code>
                  </dd>
                </div>
                <div>
                  <dt>סטטוס הרשאה</dt>
                  <dd>
                    <StatusBadge status="error" label="גישה מוגבלת" /> למשתמש זה אין תפקיד ADMIN או
                    PLATFORM_ADMIN.
                  </dd>
                </div>
              </dl>
              <div className="ys-form-actions">
                <LogoutButton variant="secondary" />
              </div>
            </Card>
          </div>
        </Container>
      </main>
    );
  }

  // CASE 2: Platform Admin (Global Shell)
  if (isPlatformAdmin) {
    const [stations, { data: allMemberships }] = await Promise.all([
      listAllStations(supabase),
      supabase
        .from('station_memberships')
        .select('station_id, role, status')
        .eq('status', 'ACTIVE'),
    ]);

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
      <main className="admin-page">
        <AdminHeader title="YellowShifts" subtitle="ניהול תחנות" homeHref="/" context={context} />
        <Container size="xl">
          <div className="admin-page-body">
            <div className="station-hero-section">
              <PageHeader
                title={t('stationsAdmin.title')}
                description="הקמה, עדכון, סטטוס והקצאת מנהלים לכל תחנות הרשת."
                badge={<Badge variant="brandCrimson">{t('roles.platformAdmin')}</Badge>}
              />
              <Link href="/stations/new" className="ys-button ys-button--primary">
                <PlusIcon size={18} aria-hidden="true" />
                <span>{t('stationsAdmin.createStation')}</span>
              </Link>
            </div>

            <dl className="admin-facts" aria-label="סיכום רשת התחנות">
              <div className="admin-fact">
                <dt>
                  <StationIcon size={16} aria-hidden="true" />
                  {t('stationsAdmin.totalStations')}
                </dt>
                <dd className="ys-num">{totalStations}</dd>
              </div>
              <div className="admin-fact">
                <dt>
                  <CircleCheckIcon size={16} aria-hidden="true" />
                  {t('stationsAdmin.activeStations')}
                </dt>
                <dd className="ys-num">{activeStations}</dd>
              </div>
              <div className="admin-fact">
                <dt>
                  <PowerIcon size={16} aria-hidden="true" />
                  {t('stationsAdmin.inactiveStations')}
                </dt>
                <dd className="ys-num">{inactiveStations}</dd>
              </div>
              <div className="admin-fact">
                <dt>
                  <ShieldCheckIcon size={16} aria-hidden="true" />
                  {t('stationsAdmin.totalAdmins')}
                </dt>
                <dd className="ys-num">{totalAdminsCount}</dd>
              </div>
            </dl>

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

  redirect(`/stations/${encodeURIComponent(activeAdminStation.station.code)}`);
}
