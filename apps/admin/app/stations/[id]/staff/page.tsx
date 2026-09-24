import { getServerContext, getCachedStation } from '@/app/lib/server-context';
import { redirect, notFound } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { getStationMembers, listAssignableUsers } from '@yellowshifts/database';
import {
  Container,
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
} from '@yellowshifts/ui';
import {
  UsersIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  UserIcon,
} from '@yellowshifts/icons';
import { LogoutButton } from '../../../components/LogoutButton';
import { StaffFilterableList } from '../../../components/StaffFilterableList';
import { AssignMemberForm } from '../../../components/AssignMemberForm';

interface StationStaffPageProps {
  params: Promise<{ id: string }>;
}

export default async function StationStaffPage({ params }: StationStaffPageProps) {
  const { id: stationId } = await params;

  const { supabase, context } = await getServerContext();

  if (!context) {
    redirect('/login');
  }

  const station = await getCachedStation(stationId);
  if (!station) {
    notFound();
  }

  // Caller authorization: Platform Admin OR Station Admin of this station
  const isPlatformAdmin = context.isPlatformAdmin;
  const isStationAdmin = context.memberships.some(
    (m) =>
      (m.station.id === station.id || m.station.code.toUpperCase() === station.code.toUpperCase()) &&
      m.membership.role === 'ADMIN' &&
      m.membership.status === 'ACTIVE'
  );

  if (!isPlatformAdmin && !isStationAdmin) {
    redirect('/');
  }

  const [stationMembers, assignableUsers] = await Promise.all([
    getStationMembers(supabase, station.id),
    listAssignableUsers(supabase).catch(() => []),
  ]);

  const adminMembers = stationMembers.filter(
    (m) => m.membership.role === 'ADMIN' && m.membership.status === 'ACTIVE'
  );
  const shiftManagers = stationMembers.filter(
    (m) => m.membership.role === 'SHIFT_MANAGER' && m.membership.status === 'ACTIVE'
  );
  const workers = stationMembers.filter(
    (m) => m.membership.role === 'WORKER' && m.membership.status === 'ACTIVE'
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
                <UsersIcon size={22} />
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
                  {station.name} • ניהול צוות ועובדים
                </h2>
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--ys-color-text-secondary, #6B7280)',
                    margin: 0,
                  }}
                >
                  קוד תחנה: {station.code} • YellowShifts
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Badge variant={isPlatformAdmin ? 'brandCrimson' : 'brandYellow'} dot>
                {isPlatformAdmin ? 'מנהל פלטפורמה' : 'מנהל תחנה'}
              </Badge>
              <LogoutButton variant="outline" />
            </div>
          </div>
        </Container>
      </header>

      <Container size="lg">
        {/* Navigation & Header */}
        <div style={{ margin: '32px 0 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Link
              href={`/stations/${encodeURIComponent(station.code)}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--ys-color-text-secondary, #6B7280)',
                fontSize: '13px',
                textDecoration: 'none',
              }}
            >
              <ArrowRightIcon size={14} />
              חזרה לפרטי התחנה
            </Link>
          </div>

          <PageHeader
            title={`ניהול צוות ועובדים — ${station.name}`}
            description={
              isPlatformAdmin
                ? 'ניהול צוות התחנה ומינוי מנהלים.'
                : 'ניהול העובדים ומנהלי המשמרת שלך, במקום אחד.'
            }
            badge={<Badge variant="brandYellow">{station.code}</Badge>}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Staff Metrics Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
            }}
          >
            <Card>
              <CardHeader style={{ paddingBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UsersIcon size={16} color="var(--ys-color-brand-yellow)" />
                  <CardTitle
                    style={{ fontSize: '13px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                  >
                    סך הכל אנשי צוות
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  style={{
                    fontSize: '26px',
                    fontWeight: 700,
                    color: 'var(--ys-color-text-primary, #111827)',
                  }}
                >
                  {stationMembers.length}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--ys-color-text-secondary, #6B7280)',
                    marginTop: '2px',
                  }}
                >
                  רשומים בתחנה
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader style={{ paddingBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheckIcon size={16} color="var(--ys-color-brand-yellow)" />
                  <CardTitle
                    style={{ fontSize: '13px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                  >
                    מנהלי תחנה פעילים
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  style={{
                    fontSize: '26px',
                    fontWeight: 700,
                    color: 'var(--ys-color-brand-yellow)',
                  }}
                >
                  {adminMembers.length}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--ys-color-text-secondary, #6B7280)',
                    marginTop: '2px',
                  }}
                >
                  בעלי הרשאת ניהול (ADMIN)
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader style={{ paddingBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BriefcaseIcon size={16} color="var(--ys-color-brand-crimson)" />
                  <CardTitle
                    style={{ fontSize: '13px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                  >
                    מנהלי משמרת פעילים
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  style={{
                    fontSize: '26px',
                    fontWeight: 700,
                    color: 'var(--ys-color-brand-crimson)',
                  }}
                >
                  {shiftManagers.length}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--ys-color-text-secondary, #6B7280)',
                    marginTop: '2px',
                  }}
                >
                  אחראי משמרת
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader style={{ paddingBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserIcon size={16} color="var(--ys-color-text-muted, #9CA3AF)" />
                  <CardTitle
                    style={{ fontSize: '13px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                  >
                    עובדים פעילים
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  style={{
                    fontSize: '26px',
                    fontWeight: 700,
                    color: 'var(--ys-color-text-primary, #111827)',
                  }}
                >
                  {workers.length}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--ys-color-text-secondary, #6B7280)',
                    marginTop: '2px',
                  }}
                >
                  עובדי תחנה ומתדלקים
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Assignment Drawer/Form */}
          <AssignMemberForm
            stationId={station.id}
            assignableUsers={assignableUsers.filter(
              (user) =>
                user.id !== context.user.id &&
                !stationMembers.some((member) => member.membership.userId === user.id)
            )}
            isPlatformAdmin={isPlatformAdmin}
          />

          {/* Filterable Staff List */}
          <StaffFilterableList
            stationId={station.id}
            members={stationMembers}
            canManage={isPlatformAdmin || isStationAdmin}
            currentUserId={context.user.id}
            isPlatformAdmin={isPlatformAdmin}
          />
        </div>
      </Container>
    </main>
  );
}
