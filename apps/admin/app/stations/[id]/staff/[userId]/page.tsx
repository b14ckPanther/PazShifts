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
  Badge,
} from '@yellowshifts/ui';
import { ArrowRightIcon } from '@yellowshifts/icons';
import { StationHeader } from '../../../../components/StationHeader';
import { MemberDetailsActions } from '../../../../components/MemberDetailsActions';
import { RoleBadge, MembershipStatusBadge } from '../../../../components/StaffFilterableList';

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
    <main className="admin-page staff-page" dir="rtl">
      <StationHeader
        station={station}
        context={context}
        subtitle={`איש צוות • ${profile.fullName || 'משתמש'}`}
      />

      <Container size="lg">
        <div className="admin-page-body">
          <Link href={`/stations/${stationId}/staff`} className="admin-back-link">
            <ArrowRightIcon size={16} aria-hidden="true" />
            חזרה לצוות התחנה
          </Link>

          <div className="station-hero-section">
            <PageHeader
              title={profile.fullName || 'משתמש ללא שם'}
              description={`איש צוות בתחנת ${station.name} (${station.code})`}
              badge={<RoleBadge role={membership.role} />}
            />
          </div>

          <div className="staff-profile">
            <Card className="staff-profile-facts">
              <CardHeader>
                <CardTitle>פרטי חברות וזהות</CardTitle>
                <CardDescription>פרטי עובד ופרופיל מאומתים במערכת</CardDescription>
              </CardHeader>
              <dl className="staff-facts">
                <div className="staff-fact">
                  <dt>שם מלא</dt>
                  <dd>{profile.fullName || 'לא הוזן'}</dd>
                </div>
                <div className="staff-fact">
                  <dt>כתובת אימייל</dt>
                  <dd dir="auto">{profile.email}</dd>
                </div>
                <div className="staff-fact">
                  <dt>מספר טלפון</dt>
                  <dd>
                    {profile.phone ? (
                      <span dir="ltr" className="ys-num">
                        {profile.phone}
                      </span>
                    ) : (
                      'לא הוזן'
                    )}
                  </dd>
                </div>
                <div className="staff-fact">
                  <dt>קוד עובד בתחנה</dt>
                  <dd>
                    {membership.employeeCode ? (
                      <Badge variant="neutral">{membership.employeeCode}</Badge>
                    ) : (
                      'לא הוגדר'
                    )}
                  </dd>
                </div>
                <div className="staff-fact">
                  <dt>תפקיד בתחנה</dt>
                  <dd>
                    <RoleBadge role={membership.role} />
                  </dd>
                </div>
                <div className="staff-fact">
                  <dt>סטטוס חברות</dt>
                  <dd>
                    <MembershipStatusBadge status={membership.status} />
                  </dd>
                </div>
                <div className="staff-fact">
                  <dt>תחנה משויכת</dt>
                  <dd>
                    {station.name} ({station.code})
                  </dd>
                </div>
                <div className="staff-fact">
                  <dt>חבר בתחנה החל מ-</dt>
                  <dd className="ys-num">
                    {new Date(membership.createdAt).toLocaleDateString('he-IL')}
                  </dd>
                </div>
                <div className="staff-fact">
                  <dt>עדכון אחרון</dt>
                  <dd className="ys-num">
                    {new Date(membership.updatedAt).toLocaleDateString('he-IL')}
                  </dd>
                </div>
                <div className="staff-fact">
                  <dt>מזהה משתמש במערכת</dt>
                  <dd>
                    <code className="staff-fact-code">{profile.id}</code>
                  </dd>
                </div>
              </dl>
            </Card>

            <Card className="staff-profile-actions">
              <CardHeader>
                <CardTitle>ניהול איש צוות</CardTitle>
                <CardDescription>
                  הרשאות וגישה לתחנה, תוך שמירה על היסטוריית הפעילות
                </CardDescription>
              </CardHeader>
              <MemberDetailsActions
                stationId={station.id}
                member={member}
                currentUserId={context.user.id}
                isPlatformAdmin={isPlatformAdmin}
                layout="panel"
              />
            </Card>
          </div>
        </div>
      </Container>
    </main>
  );
}
