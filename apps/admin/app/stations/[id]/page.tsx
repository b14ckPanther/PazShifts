import { StationAdminSelector } from '../../components/StationAdminSelector';
import { StationOperations } from '../../components/StationOperations';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  createServerSupabaseClient,
  getAuthenticatedUserContext,
  getStationById,
  getStationMembers,
  listAssignableUsers,
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
  Button,
} from '@yellowshifts/ui';
import {
  StationIcon,
  UsersIcon,
  EditIcon,
  ArrowRightIcon,
  MapPinIcon,
  PhoneIcon,
  ClockIcon,
  CalendarIcon,
  ShieldCheckIcon,
  NfcIcon,
  SettingsIcon,
} from '@yellowshifts/icons';
import { LogoutButton } from '../../components/LogoutButton';
import { StationStatusToggle } from '../../components/StationStatusToggle';
import { AssignMemberForm } from '../../components/AssignMemberForm';
import { StaffFilterableList } from '../../components/StaffFilterableList';
import { EditStationTolerancesModal } from '../../components/EditStationTolerancesModal';

interface StationDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function StationDetailsPage({ params }: StationDetailsPageProps) {
  const { id: stationId } = await params;

  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const context = await getAuthenticatedUserContext(supabase);

  if (!context) {
    redirect('/login');
  }

  // Verify access: Platform Admin OR Station Admin of this station
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

  const [station, stationMembers, assignableUsers] = await Promise.all([
    getStationById(supabase, stationId),
    getStationMembers(supabase, stationId),
    listAssignableUsers(supabase).catch(() => []),
  ]);

  if (!station) {
    notFound();
  }

  const adminMembers = stationMembers.filter((m) => m.membership.role === 'ADMIN');

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
      {/* Header */}
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
                <StationIcon size={22} />
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
                  {station.name}
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
        {!isPlatformAdmin &&
          context.memberships.filter(
            (m) => m.membership.role === 'ADMIN' && m.membership.status === 'ACTIVE'
          ).length > 1 && (
            <StationAdminSelector
              activeStationId={stationId}
              adminMemberships={context.memberships.filter(
                (m) => m.membership.role === 'ADMIN' && m.membership.status === 'ACTIVE'
              )}
            />
          )}
        {/* Top Actions & Page Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            margin: '32px 0 24px 0',
          }}
        >
          <div>
            <Link
              href="/"
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
              חזרה לכלל התחנות
            </Link>
            <PageHeader
              title={station.name}
              description="סידור עבודה, נוכחות חיה והצוות שלך — במקום אחד."
              badge={
                <Badge variant={station.isActive ? 'success' : 'neutral'} dot>
                  {station.isActive ? 'פעילה' : 'מושבתת'}
                </Badge>
              }
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <Link href={`/stations/${station.id}/attendance`} style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="md">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <ClockIcon size={16} />
                  נוכחות ושעון NFC
                </span>
              </Button>
            </Link>

            <Link href={`/stations/${station.id}/schedules`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="md">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <CalendarIcon size={16} />
                  סידור עבודה שבועי
                </span>
              </Button>
            </Link>

            <Link href={`/stations/${station.id}/templates`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="md">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <ClockIcon size={16} />
                  תבניות משמרת
                </span>
              </Button>
            </Link>

            <Link href={`/stations/${station.id}/staff`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="md">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <UsersIcon size={16} />
                  ניהול צוות מלא
                </span>
              </Button>
            </Link>

            {isPlatformAdmin && (
              <>
                <Link href={`/stations/${station.id}/edit`} style={{ textDecoration: 'none' }}>
                  <Button variant="secondary" size="md">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <EditIcon size={16} />
                      עריכת פרטי תחנה
                    </span>
                  </Button>
                </Link>

                <StationStatusToggle
                  stationId={station.id}
                  isActive={station.isActive}
                  stationName={station.name}
                />
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <StationOperations stationId={station.id} />

          <details className="station-settings">
            <summary>הגדרות התחנה ופרטי קשר</summary>
            {/* Phase 9: Attendance Tolerance Settings */}
            <Card>
              <CardHeader>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <SettingsIcon size={18} style={{ color: 'var(--ys-color-brand-yellow)' }} />
                      <CardTitle>הגדרות סבילות נוכחות</CardTitle>
                    </div>
                    <CardDescription>
                      ניהול איחורים וחריגות — באחריות מנהלי התחנה והמערכת.
                    </CardDescription>
                  </div>
                  <EditStationTolerancesModal station={station} />
                </div>
              </CardHeader>
              <CardContent>
                <dl className="tolerance-summary">
                  <div>
                    <dt>איחור מותר</dt>
                    <dd>
                      {station.allowedLateMinutes} <small>דקות</small>
                    </dd>
                  </div>
                  <div>
                    <dt>יציאה מוקדמת מותרת</dt>
                    <dd>
                      {station.allowedEarlyLeaveMinutes} <small>דקות</small>
                    </dd>
                  </div>
                  <div>
                    <dt>התראת משמרת פתוחה</dt>
                    <dd>
                      {station.leftOpenWarningHours} <small>שעות</small>
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
            {/* Station Info Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle>פרטי התחנה</CardTitle>
                <CardDescription>פרטי הקשר והפעילות של התחנה</CardDescription>
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
                      קוד תחנה ייחודי
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '2px' }}>
                      <Badge variant="brandYellow">{station.code}</Badge>
                    </div>
                  </div>

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
                      {station.name}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{ fontSize: '12px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                    >
                      כתובת
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        marginTop: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--ys-color-text-primary, #111827)',
                      }}
                    >
                      <MapPinIcon size={15} color="var(--ys-color-text-muted, #9CA3AF)" />
                      {station.address || 'לא צוינה כתובת'}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{ fontSize: '12px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                    >
                      טלפון
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        marginTop: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--ys-color-text-primary, #111827)',
                      }}
                    >
                      <PhoneIcon size={15} color="var(--ys-color-text-muted, #9CA3AF)" />
                      <span dir="ltr">{station.phone || 'לא צוין טלפון'}</span>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{ fontSize: '12px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                    >
                      אזור זמן
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        marginTop: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--ys-color-text-primary, #111827)',
                      }}
                    >
                      <ClockIcon size={15} color="var(--ys-color-text-muted, #9CA3AF)" />
                      <span>{station.timezone}</span>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{ fontSize: '12px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                    >
                      מזהה NFC ציבורי
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        color: '#B45309',
                        marginTop: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <NfcIcon size={15} color="#B45309" />
                      <span>{station.nfcPublicToken || 'טרם הוגדר'}</span>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{ fontSize: '12px', color: 'var(--ys-color-text-secondary, #6B7280)' }}
                    >
                      מנהלי תחנה מוקצים
                    </div>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        marginTop: '2px',
                        color: '#B45309',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <ShieldCheckIcon size={16} />
                      <span>{adminMembers.length} מנהלים</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </details>
          <details className="station-settings">
            <summary>הוספת איש צוות</summary>
            {/* User Assignment Form */}
            <AssignMemberForm
              stationId={station.id}
              assignableUsers={assignableUsers.filter(
                (user) =>
                  user.id !== context.user.id &&
                  !stationMembers.some((member) => member.membership.userId === user.id)
              )}
              isPlatformAdmin={isPlatformAdmin}
            />
          </details>
          <StaffFilterableList
            stationId={station.id}
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
