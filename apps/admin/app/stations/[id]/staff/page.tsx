import { getServerContext, getCachedStation } from '@/app/lib/server-context';
import { redirect, notFound } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { getStationMembers, listAssignableUsers } from '@yellowshifts/database';
import { Container, PageHeader, Badge } from '@yellowshifts/ui';
import {
  UsersIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  UserIcon,
} from '@yellowshifts/icons';
import { StationHeader } from '../../../components/StationHeader';
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
      (m.station.id === station.id ||
        m.station.code.toUpperCase() === station.code.toUpperCase()) &&
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
    <main className="admin-page staff-page" dir="rtl">
      <StationHeader station={station} context={context} subtitle="ניהול צוות ועובדים" />

      <Container size="xl">
        <div className="admin-page-body">
          <Link href={`/stations/${encodeURIComponent(station.code)}`} className="admin-back-link">
            <ArrowRightIcon size={16} aria-hidden="true" />
            חזרה לסקירת התחנה
          </Link>

          <div className="station-hero-section">
            <PageHeader
              title="צוות התחנה"
              description={
                isPlatformAdmin
                  ? `ניהול צוות תחנת ${station.name} ומינוי מנהלים.`
                  : `ניהול העובדים ומנהלי המשמרת של ${station.name}, במקום אחד.`
              }
              badge={<Badge variant="brandYellow">{station.code}</Badge>}
              actions={
                <AssignMemberForm
                  stationId={station.id}
                  assignableUsers={assignableUsers.filter(
                    (user) =>
                      user.id !== context.user.id &&
                      !stationMembers.some((member) => member.membership.userId === user.id)
                  )}
                  isPlatformAdmin={isPlatformAdmin}
                />
              }
            />
          </div>

          <ul className="staff-summary" aria-label="סיכום הצוות">
            <li>
              <UsersIcon size={16} aria-hidden="true" />
              <span className="ys-num">{stationMembers.length}</span> אנשי צוות
            </li>
            <li>
              <UserIcon size={16} aria-hidden="true" />
              <span className="ys-num">{workers.length}</span> עובדים
            </li>
            <li>
              <BriefcaseIcon size={16} aria-hidden="true" />
              <span className="ys-num">{shiftManagers.length}</span> מנהלי משמרת
            </li>
            <li>
              <ShieldCheckIcon size={16} aria-hidden="true" />
              <span className="ys-num">{adminMembers.length}</span> מנהלי תחנה
            </li>
          </ul>

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
