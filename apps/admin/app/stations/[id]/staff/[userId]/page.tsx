import { getServerContext } from '@/app/lib/server-context';
import { redirect, notFound } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { getStationById, getStationMemberByUserId } from '@yellowshifts/database';
import {
  Container,
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from '@yellowshifts/ui';
import { ArrowRightIcon, ShieldCheckIcon } from '@yellowshifts/icons';
import { StationHeader } from '../../../../components/StationHeader';
import { MemberDetailsActions } from '../../../../components/MemberDetailsActions';

interface StaffMemberDetailsPageProps {
  params: Promise<{ id: string; userId: string }>;
}

export default async function StaffMemberDetailsPage({ params }: StaffMemberDetailsPageProps) {
  const { id: stationId, userId } = await params;

  const { supabase, context } = await getServerContext();

  if (!context) {
    redirect('/login');
  }

  const isPlatformAdmin = context.isPlatformAdmin;
  const isStationAdmin = context.memberships.some(
    (m) =>
      m.station.id === stationId &&
      m.membership.role === 'ADMIN' &&
      m.membership.status === 'ACTIVE'
  );

  if (!isPlatformAdmin && !isStationAdmin) {
    redirect('/');
  }

  const [station, member] = await Promise.all([
    getStationById(supabase, stationId),
    getStationMemberByUserId(supabase, stationId, userId),
  ]);

  if (!station || !member) {
    notFound();
  }

  const { profile, membership } = member;

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
      <StationHeader station={station} context={context} subtitle={`איש צוות • ${profile.fullName || 'משתמש'}`} />

      <Container size="md">
        <div style={{ margin: '32px 0 24px 0' }}>
          <Link
            href={`/stations/${stationId}/staff`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--ys-color-text-secondary, #6B7280)',
              fontSize: '13px',
              textDecoration: 'none',
              marginBottom: '8px',
            }}
          >
            <ArrowRightIcon size={14} />
            חזרה לצוות התחנה
          </Link>

          <PageHeader
            title={profile.fullName || 'משתמש ללא שם'}
            description={`איש צוות בתחנת ${station.name} (${station.code})`}
            badge={
              <Badge
                variant={
                  membership.role === 'ADMIN'
                    ? 'brandYellow'
                    : membership.role === 'SHIFT_MANAGER'
                      ? 'brandCrimson'
                      : 'neutral'
                }
              >
                {membership.role === 'ADMIN'
                  ? 'מנהל תחנה'
                  : membership.role === 'SHIFT_MANAGER'
                    ? 'מנהל משמרת'
                    : 'עובד'}
              </Badge>
            }
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Member Details Card */}
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheckIcon size={20} color="var(--ys-color-brand-yellow)" />
                <CardTitle>פרטי חברות וזהות</CardTitle>
              </div>
              <CardDescription>פרטי עובד ופרופיל מאומתים במערכת</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '20px',
                }}
              >
                <div>
                  <div
                    style={{ fontSize: '12px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                  >
                    שם מלא
                  </div>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      marginTop: '2px',
                      color: 'var(--ys-color-text-primary, #111827)',
                    }}
                  >
                    {profile.fullName || 'לא הוזן'}
                  </div>
                </div>

                <div>
                  <div
                    style={{ fontSize: '12px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                  >
                    כתובת אימייל
                  </div>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 500,
                      marginTop: '2px',
                      color: 'var(--ys-color-text-primary, #111827)',
                    }}
                  >
                    {profile.email}
                  </div>
                </div>

                <div>
                  <div
                    style={{ fontSize: '12px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                  >
                    מספר טלפון
                  </div>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 500,
                      marginTop: '2px',
                      color: 'var(--ys-color-text-primary, #111827)',
                    }}
                    dir="ltr"
                  >
                    {profile.phone || 'לא הוזן'}
                  </div>
                </div>

                <div>
                  <div
                    style={{ fontSize: '12px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                  >
                    קוד עובד בתחנה
                  </div>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      marginTop: '2px',
                      color: 'var(--ys-color-text-primary, #111827)',
                    }}
                  >
                    {membership.employeeCode ? (
                      <Badge variant="neutral">{membership.employeeCode}</Badge>
                    ) : (
                      'לא הוגדר'
                    )}
                  </div>
                </div>

                <div>
                  <div
                    style={{ fontSize: '12px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                  >
                    תפקיד בתחנה
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '2px' }}>
                    <Badge
                      variant={
                        membership.role === 'ADMIN'
                          ? 'brandYellow'
                          : membership.role === 'SHIFT_MANAGER'
                            ? 'brandCrimson'
                            : 'neutral'
                      }
                    >
                      {membership.role === 'ADMIN'
                        ? 'מנהל תחנה'
                        : membership.role === 'SHIFT_MANAGER'
                          ? 'מנהל משמרת'
                          : 'עובד'}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div
                    style={{ fontSize: '12px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                  >
                    סטטוס חברות
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '2px' }}>
                    <Badge
                      variant={
                        membership.status === 'ACTIVE'
                          ? 'success'
                          : membership.status === 'SUSPENDED'
                            ? 'danger'
                            : 'neutral'
                      }
                      dot
                    >
                      {membership.status === 'ACTIVE'
                        ? 'פעיל'
                        : membership.status === 'SUSPENDED'
                          ? 'מושעה'
                          : 'לא פעיל'}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div
                    style={{ fontSize: '12px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                  >
                    תחנה משויכת
                  </div>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 500,
                      marginTop: '2px',
                      color: 'var(--ys-color-text-primary, #111827)',
                    }}
                  >
                    {station.name} ({station.code})
                  </div>
                </div>

                <div>
                  <div
                    style={{ fontSize: '12px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                  >
                    חבר בתחנה החל מ-
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      color: 'var(--ys-color-text-primary, #111827)',
                      marginTop: '2px',
                    }}
                  >
                    {new Date(membership.createdAt).toLocaleDateString('he-IL')}
                  </div>
                </div>

                <div>
                  <div
                    style={{ fontSize: '12px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                  >
                    עדכון אחרון
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      color: 'var(--ys-color-text-primary, #111827)',
                      marginTop: '2px',
                    }}
                  >
                    {new Date(membership.updatedAt).toLocaleDateString('he-IL')}
                  </div>
                </div>

                <div>
                  <div
                    style={{ fontSize: '12px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                  >
                    מזהה משתמש במערכת
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--ys-color-text-secondary, #6B7280)',
                      marginTop: '2px',
                    }}
                  >
                    <code>{profile.id}</code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardHeader>
              <CardTitle>ניהול איש צוות</CardTitle>
              <CardDescription>הרשאות וגישה לתחנה, תוך שמירה על היסטוריית הפעילות</CardDescription>
            </CardHeader>
            <CardContent>
              <MemberDetailsActions
                stationId={station.id}
                member={member}
                currentUserId={context.user.id}
                isPlatformAdmin={isPlatformAdmin}
              />
            </CardContent>
          </Card>
        </div>
      </Container>
    </main>
  );
}
