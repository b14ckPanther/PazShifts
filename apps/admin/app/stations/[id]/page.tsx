import { StationLocationSettings } from '@/app/components/StationLocationSettings';
import { getServerContext, getCachedStation } from '@/app/lib/server-context';
import { StationAdminSelector } from '../../components/StationAdminSelector';
import {
  StationOperations,
  StationStatusStrip,
  type StationLiveStatus,
} from '../../components/StationOperations';
import {
  getStationExceptionsForDate,
  getWeekStartDate,
  getWeeklySchedule,
  listStationAttendance,
} from '@yellowshifts/database';
import { localDate } from '@yellowshifts/reports';
import { redirect, notFound } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { Container, PageHeader, Badge, StatusBadge } from '@yellowshifts/ui';
import {
  EditIcon,
  ArrowRightIcon,
  MapPinIcon,
  PhoneIcon,
  ClockIcon,
  ShieldCheckIcon,
  SettingsIcon,
  ChevronDownIcon,
  NfcTagIcon,
  CalendarIcon,
  UserPlusIcon,
  TimerIcon,
} from '@yellowshifts/icons';
import { StationHeader } from '../../components/StationHeader';
import { StationStatusToggle } from '../../components/StationStatusToggle';
import { EditStationTolerancesModal } from '../../components/EditStationTolerancesModal';

interface StationDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function StationDetailsPage({ params }: StationDetailsPageProps) {
  const { id: stationId } = await params;

  const { supabase, context } = await getServerContext();

  if (!context) {
    redirect('/login');
  }

  const station = await getCachedStation(stationId);

  if (!station) {
    notFound();
  }

  const canonicalCode = encodeURIComponent(station.code);

  // Verify access: Platform Admin OR Station Admin of this station
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

  // Read-only live facts, reusing the attendance, exceptions and schedules page reads.
  // A failed read shows its tile as unavailable instead of failing the page.
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: station.timezone || 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const weekStart = getWeekStartDate(localDate(new Date(), station.timezone));
  const [attendanceRead, exceptionsRead, scheduleRead] = await Promise.allSettled([
    listStationAttendance(supabase, station.id),
    getStationExceptionsForDate(supabase, station.id, today),
    getWeeklySchedule(supabase, station.id, weekStart),
  ]);
  const liveStatus: StationLiveStatus = {
    onShift:
      attendanceRead.status === 'fulfilled'
        ? {
            count: attendanceRead.value.activeRecords.length,
            names: attendanceRead.value.activeRecords.map(
              (r) => r.user?.full_name?.trim().split(/\s+/)[0] || 'עובד'
            ),
          }
        : null,
    exceptionsToday:
      exceptionsRead.status === 'fulfilled' ? exceptionsRead.value.exceptions.length : null,
    schedule:
      scheduleRead.status === 'fulfilled'
        ? scheduleRead.value
          ? {
              state: scheduleRead.value.status,
              shiftCount: scheduleRead.value.shifts.length,
              missingManager: scheduleRead.value.shifts.filter(
                (shift) =>
                  !shift.assignments.some(
                    (a) => a.membership.role === 'ADMIN' || a.membership.role === 'SHIFT_MANAGER'
                  )
              ).length,
            }
          : { state: 'NONE', shiftCount: 0, missingManager: 0 }
        : null,
  };

  const selectorMemberships = context.memberships.filter(
    (m) => (m.membership.role === 'ADMIN' || isPlatformAdmin) && m.membership.status === 'ACTIVE'
  );

  return (
    <main className="admin-page">
      <StationHeader station={station} context={context} />

      <Container size="xl">
        <div className="admin-page-body">
          {selectorMemberships.length > 1 && (
            <StationAdminSelector
              activeStationId={stationId}
              adminMemberships={selectorMemberships}
              isPlatformAdmin={isPlatformAdmin}
            />
          )}

          {isPlatformAdmin && (
            <Link href="/" className="admin-back-link">
              <ArrowRightIcon size={16} aria-hidden="true" />
              <span>חזרה לכלל התחנות</span>
            </Link>
          )}

          {/* Page header with the primary actions at the top end */}
          <div className="station-hero-section">
            <PageHeader
              title={station.name}
              description="סידור עבודה, נוכחות חיה והצוות שלך — במקום אחד."
              badge={
                <StatusBadge
                  status={station.isActive ? 'success' : 'offline'}
                  label={station.isActive ? 'פעילה' : 'מושבתת'}
                />
              }
            />
            <div className="station-hero-actions">
              <Link
                href={`/stations/${canonicalCode}/schedules`}
                className="ys-button ys-button--primary"
              >
                <CalendarIcon size={18} aria-hidden="true" />
                <span>סידור עבודה</span>
              </Link>
              <Link
                href={`/stations/${canonicalCode}/staff`}
                className="ys-button ys-button--secondary"
              >
                <UserPlusIcon size={18} aria-hidden="true" />
                <span>הוספת עובד</span>
              </Link>
              <Link
                href={`/stations/${canonicalCode}/attendance`}
                className="ys-button ys-button--secondary"
              >
                <TimerIcon size={18} aria-hidden="true" />
                <span>דיווח נוכחות ידני</span>
              </Link>
            </div>
          </div>

          <StationStatusStrip stationId={canonicalCode} status={liveStatus} />

          <StationOperations stationId={canonicalCode} />

          <details className="station-settings">
            <summary>
              <SettingsIcon size={20} aria-hidden="true" />
              <span className="station-settings-summary-text">
                <strong>הגדרות התחנה ופרטי קשר</strong>
                <small>
                  {isPlatformAdmin ? 'עריכה וסטטוס, ' : ''}מיקום לדיווח נוכחות, סבילות איחורים ופרטי
                  התחנה
                </small>
              </span>
              <ChevronDownIcon className="station-settings-chevron" size={20} aria-hidden="true" />
            </summary>

            <div className="station-settings-body">
              {isPlatformAdmin && (
                <section className="station-settings-panel" aria-labelledby="station-admin-title">
                  <div className="admin-section-header">
                    <div>
                      <h3 id="station-admin-title" className="admin-section-title">
                        ניהול התחנה
                      </h3>
                      <p className="admin-section-description">
                        עריכת פרטי התחנה והפעלה או השבתה שלה.
                      </p>
                    </div>
                    <div className="station-hero-actions">
                      <Link
                        href={`/stations/${canonicalCode}/edit`}
                        className="ys-button ys-button--secondary"
                      >
                        <EditIcon size={18} aria-hidden="true" />
                        <span>עריכת פרטי תחנה</span>
                      </Link>
                      <StationStatusToggle
                        stationId={station.id}
                        isActive={station.isActive}
                        stationName={station.name}
                        size="md"
                      />
                    </div>
                  </div>
                </section>
              )}
              <StationLocationSettings station={station} />

              {/* Phase 9: Attendance Tolerance Settings */}
              <section className="station-settings-panel" aria-labelledby="tolerance-title">
                <div className="admin-section-header">
                  <div>
                    <h3 id="tolerance-title" className="admin-section-title">
                      הגדרות סבילות נוכחות
                    </h3>
                    <p className="admin-section-description">
                      ניהול איחורים וחריגות — באחריות מנהלי התחנה והמערכת.
                    </p>
                  </div>
                  <EditStationTolerancesModal station={station} />
                </div>
                <dl className="tolerance-summary">
                  <div>
                    <dt>איחור מותר</dt>
                    <dd>
                      <span className="ys-num">{station.allowedLateMinutes}</span>{' '}
                      <small>דקות</small>
                    </dd>
                  </div>
                  <div>
                    <dt>יציאה מוקדמת מותרת</dt>
                    <dd>
                      <span className="ys-num">{station.allowedEarlyLeaveMinutes}</span>{' '}
                      <small>דקות</small>
                    </dd>
                  </div>
                  <div>
                    <dt>התראת משמרת פתוחה</dt>
                    <dd>
                      <span className="ys-num">{station.leftOpenWarningHours}</span>{' '}
                      <small>שעות</small>
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Station Info Summary */}
              <section className="station-settings-panel" aria-labelledby="station-info-title">
                <div>
                  <h3 id="station-info-title" className="admin-section-title">
                    פרטי התחנה
                  </h3>
                  <p className="admin-section-description">פרטי הקשר והפעילות של התחנה</p>
                </div>
                <dl className="station-info-grid">
                  <div>
                    <dt>קוד תחנה ייחודי</dt>
                    <dd>
                      <Badge variant="brandYellow" dir="ltr">
                        {station.code}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt>שם מלא</dt>
                    <dd>{station.name}</dd>
                  </div>
                  <div>
                    <dt>כתובת</dt>
                    <dd>
                      <MapPinIcon size={16} aria-hidden="true" />
                      <span>{station.address || 'לא צוינה כתובת'}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>טלפון</dt>
                    <dd>
                      <PhoneIcon size={16} aria-hidden="true" />
                      <span dir="ltr">{station.phone || 'לא צוין טלפון'}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>אזור זמן</dt>
                    <dd>
                      <ClockIcon size={16} aria-hidden="true" />
                      <span dir="ltr">{station.timezone}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>מזהה עמדת שעון</dt>
                    <dd>
                      <NfcTagIcon size={16} aria-hidden="true" />
                      <code dir="ltr" className="station-info-token">
                        {station.nfcPublicToken || 'טרם הוגדר'}
                      </code>
                    </dd>
                  </div>
                  <div>
                    <dt>מנהלי תחנה מוקצים</dt>
                    <dd>
                      <ShieldCheckIcon size={16} aria-hidden="true" />
                      <Link href={`/stations/${canonicalCode}/staff`} className="station-info-link">
                        צפייה בצוות ובהרשאות
                      </Link>
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </details>
        </div>
      </Container>
    </main>
  );
}
