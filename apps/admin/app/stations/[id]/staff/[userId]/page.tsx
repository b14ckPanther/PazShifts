import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  createServerSupabaseClient,
  getAuthenticatedUserContext,
  getStationById,
  getStationMemberByUserId,
} from '@yellowshifts/database';
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
import { ArrowRightIcon, ShieldCheckIcon, UserIcon } from '@yellowshifts/icons';
import { LogoutButton } from '../../../../components/LogoutButton';
import { MemberDetailsActions } from '../../../../components/MemberDetailsActions';

interface StaffMemberDetailsPageProps {
  params: Promise<{ id: string; userId: string }>;
}

export default async function StaffMemberDetailsPage({ params }: StaffMemberDetailsPageProps) {
  const { id: stationId, userId } = await params;

  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const context = await getAuthenticatedUserContext(supabase);

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
                <UserIcon size={22} />
              </div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--ys-color-text-primary, #111827)',
                }}
              >
                {profile.fullName || 'משתמש'} • פרטי איש צוות
              </h2>
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
