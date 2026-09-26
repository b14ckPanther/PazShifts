'use client';

import React, { useState, useEffect, useTransition, useRef } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Alert,
  Dialog,
  EmptyState,
  StatusBadge,
} from '@yellowshifts/ui';
import {
  CalendarClockIcon,
  CheckIcon,
  CircleCheckIcon,
  ClockIcon,
  CopyIcon,
  DangerIcon,
  HistoryIcon,
  NfcTagIcon,
  PlusIcon,
  RefreshIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  WarningIcon,
} from '@yellowshifts/icons';
import { refreshStationAttendanceAction, rotateNfcTokenAction } from '../../../actions/attendance';
import { configuredAppOrigin } from '@yellowshifts/database';
import { AttendanceRecordActions } from '../../../components/AttendanceRecordActions';
import { ManualAttendanceDialog } from '../../../components/ManualAttendanceDialog';
import { ElapsedDuration } from '../../../components/ElapsedDuration';
import type {
  Station,
  AttendanceRecordWithDetails,
  StationMemberWithProfile,
} from '@yellowshifts/types';

interface StationAttendanceClientProps {
  station: Station;
  members: StationMemberWithProfile[];
  canManageAttendance: boolean; // Platform Admin or Station Admin
  isPlatformAdmin?: boolean;
  initialActiveRecords: AttendanceRecordWithDetails[];
  initialCompletedRecords: AttendanceRecordWithDetails[];
}

type AttendanceTab = 'ACTIVE' | 'COMPLETED' | 'NFC';
type DeviationTone = 'danger' | 'warning' | 'info' | 'success';

const TABS: AttendanceTab[] = ['ACTIVE', 'COMPLETED', 'NFC'];

/** Deviation as icon + text; the tone only reinforces what the words already say. */
function DeviationBadge({ tone, label }: { tone: DeviationTone; label: string }) {
  const Icon =
    tone === 'danger'
      ? DangerIcon
      : tone === 'warning'
        ? WarningIcon
        : tone === 'info'
          ? CalendarClockIcon
          : CircleCheckIcon;
  return (
    <span className={`att-deviation att-deviation--${tone}`}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}

function roleLabel(role: string | undefined) {
  return role === 'ADMIN' ? 'מנהל תחנה' : role === 'SHIFT_MANAGER' ? 'מנהל משמרת' : 'עובד';
}

export function StationAttendanceClient({
  station,
  members,
  canManageAttendance,
  initialActiveRecords,
  initialCompletedRecords,
}: StationAttendanceClientProps) {
  const [activeTab, setActiveTab] = useState<AttendanceTab>('ACTIVE');
  const [activeRecords, setActiveRecords] =
    useState<AttendanceRecordWithDetails[]>(initialActiveRecords);
  const [completedRecords, setCompletedRecords] =
    useState<AttendanceRecordWithDetails[]>(initialCompletedRecords);
  const [nfcToken, setNfcToken] = useState<string>(station.nfcPublicToken || '');

  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Admin Correction Modal State
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecordWithDetails | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const refreshVersion = useRef(0);
  const [isPending, startTransition] = useTransition();

  // Rotate Token Confirm Modal State
  const [showRotateModal, setShowRotateModal] = useState<boolean>(false);

  const tabRefs = useRef<Record<AttendanceTab, HTMLButtonElement | null>>({
    ACTIVE: null,
    COMPLETED: null,
    NFC: null,
  });

  const timezone = station.timezone || 'Asia/Jerusalem';

  const formatStationTime = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat('he-IL', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(isoString));
    } catch {
      return isoString.slice(11, 16);
    }
  };

  const stationDateKey = (value: string | number) => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(value));
    } catch {
      return String(value).slice(0, 10);
    }
  };

  const formatStationDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat('he-IL', {
        timeZone: timezone,
        day: '2-digit',
        month: '2-digit',
      }).format(new Date(isoString));
    } catch {
      return isoString.slice(5, 10);
    }
  };

  const renderTotalDuration = (startAt: string, endAt: string | null) => {
    if (!endAt) return '--';
    const diffMin = Math.max(
      0,
      Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000)
    );
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return (
      <>
        <span className="ys-num">{hours}</span> שעות ו-<span className="ys-num">{mins}</span> דקות
      </>
    );
  };

  const getRecordDeviation = (
    record: AttendanceRecordWithDetails
  ): { label: string; tone: DeviationTone; detail: string | null } => {
    const allowedLate = station.allowedLateMinutes ?? 10;
    const allowedEarly = station.allowedEarlyLeaveMinutes ?? 10;
    const leftOpenWarningHours = station.leftOpenWarningHours ?? 12;

    if (record.status === 'ACTIVE') {
      const elapsedHours = (Date.now() - new Date(record.clock_in_at).getTime()) / 3600000;
      if (elapsedHours >= leftOpenWarningHours) {
        return {
          label: 'משמרת לא נסגרה',
          tone: 'danger',
          detail: `פתוח ${Math.round(elapsedHours * 10) / 10} שעות`,
        };
      }
    }

    if (!record.scheduled_shift) {
      return { label: 'לא מתוכננת', tone: 'info', detail: null };
    }

    const scheduledStartMs = new Date(record.scheduled_shift.start_at).getTime();
    const clockInMs = new Date(record.clock_in_at).getTime();
    const lateMin = Math.max(0, Math.floor((clockInMs - scheduledStartMs) / 60000));
    const isLate = lateMin > allowedLate;

    let isEarly = false;
    let earlyMin = 0;
    if (record.clock_out_at && record.status === 'COMPLETED') {
      const scheduledEndMs = new Date(record.scheduled_shift.end_at).getTime();
      const clockOutMs = new Date(record.clock_out_at).getTime();
      earlyMin = Math.max(0, Math.floor((scheduledEndMs - clockOutMs) / 60000));
      isEarly = earlyMin > allowedEarly;
    }

    if (isLate && isEarly) {
      return {
        label: 'איחור ויציאה מוקדמת',
        tone: 'danger',
        detail: `איחור: ${lateMin} דק׳ | יציאה מוקדמת: ${earlyMin} דק׳`,
      };
    }
    if (isLate) {
      return { label: 'איחור', tone: 'warning', detail: `איחור של ${lateMin} דקות` };
    }
    if (isEarly) {
      return { label: 'יציאה מוקדמת', tone: 'warning', detail: `יציאה מוקדמת ב-${earlyMin} דקות` };
    }
    return { label: 'בזמן', tone: 'success', detail: null };
  };

  // The admin host cannot identify the separate worker project; require its configured origin.
  const origin = configuredAppOrigin(
    process.env.NEXT_PUBLIC_NFC_APP_URL || process.env.NEXT_PUBLIC_APP_URL
  );
  const nfcStationUrl = origin && nfcToken ? `${origin}/nfc/${encodeURIComponent(nfcToken)}` : null;

  const handleCopyNfcUrl = () => {
    if (!nfcStationUrl) return;
    navigator.clipboard.writeText(nfcStationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRotateToken = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await rotateNfcTokenAction(station.id);
      if (!result.success || !result.newToken) {
        setErrorMessage(result.error || 'שגיאה באיפוס מזהה שעון');
        return;
      }

      setNfcToken(result.newToken);
      setShowRotateModal(false);
      setSuccessMessage('מזהה עמדת השעון אופס בהצלחה. יש לעדכן את עמדת השעון בקישור החדש.');
    });
  };

  async function refreshAttendance() {
    const version = ++refreshVersion.current;
    try {
      const fresh = await refreshStationAttendanceAction(station.id);
      if (version !== refreshVersion.current) return;
      if (!fresh) {
        setRefreshError(true);
        return;
      }
      setActiveRecords(fresh.activeRecords);
      setCompletedRecords(fresh.completedRecords);
      setRefreshError(false);
    } catch {
      if (version === refreshVersion.current) setRefreshError(true);
    }
  }
  useEffect(() => {
    let cancelled = false;
    let busy = false;
    async function poll() {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      const version = ++refreshVersion.current;
      try {
        const fresh = await refreshStationAttendanceAction(station.id);
        if (!cancelled && version === refreshVersion.current) {
          if (fresh) {
            setActiveRecords(fresh.activeRecords);
            setCompletedRecords(fresh.completedRecords);
            setRefreshError(false);
          } else setRefreshError(true);
        }
      } catch {
        if (!cancelled && version === refreshVersion.current) setRefreshError(true);
      } finally {
        busy = false;
      }
    }
    const timer = setInterval(poll, 15000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [station.id]);

  // Status strip: derived only from the records already on the page.
  const todayKey = stationDateKey(Date.now());
  const completedToday = completedRecords.filter(
    (record) => stationDateKey(record.clock_in_at) === todayKey
  );
  const openIssues = [...activeRecords, ...completedToday].filter((record) => {
    if (record.status === 'FLAGGED') return true;
    const tone = getRecordDeviation(record).tone;
    return tone === 'danger' || tone === 'warning';
  }).length;

  const openEdit = (record: AttendanceRecordWithDetails) => {
    setSelectedRecord(record);
    setShowManual(true);
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.indexOf(activeTab);
    let next: AttendanceTab | undefined;
    // RTL: the next tab sits to the visual left.
    if (event.key === 'ArrowLeft') next = TABS[(index + 1) % TABS.length];
    if (event.key === 'ArrowRight') next = TABS[(index - 1 + TABS.length) % TABS.length];
    if (event.key === 'Home') next = TABS[0];
    if (event.key === 'End') next = TABS[TABS.length - 1];
    if (!next) return;
    event.preventDefault();
    setActiveTab(next);
    tabRefs.current[next]?.focus();
  };

  const tabProps = (tab: AttendanceTab) => ({
    ref: (node: HTMLButtonElement | null) => {
      tabRefs.current[tab] = node;
    },
    type: 'button' as const,
    role: 'tab',
    id: `attendance-tab-${tab}`,
    'aria-selected': activeTab === tab,
    'aria-controls': `attendance-panel-${tab}`,
    tabIndex: activeTab === tab ? 0 : -1,
    onClick: () => setActiveTab(tab),
    onKeyDown: onTabKeyDown,
  });

  const panelProps = (tab: AttendanceTab) => ({
    role: 'tabpanel',
    id: `attendance-panel-${tab}`,
    'aria-labelledby': `attendance-tab-${tab}`,
    hidden: activeTab !== tab,
    tabIndex: 0,
    className: 'attendance-panel',
  });

  return (
    <div className="station-attendance">
      <p className="att-facts">
        <span className="att-fact att-fact--live">
          <span className="att-fact-dot" aria-hidden="true" />
          <span className="ys-num">{activeRecords.length}</span> במשמרת עכשיו
        </span>
        <span className="att-fact">
          <span className="ys-num">{completedToday.length}</span> הסתיימו היום
        </span>
        <span
          className={`att-fact${openIssues > 0 ? ' att-fact--attention' : ''}`}
          title="איחור, יציאה מוקדמת או משמרת פתוחה"
        >
          {openIssues > 0 ? (
            <WarningIcon size={16} aria-hidden="true" />
          ) : (
            <CircleCheckIcon size={16} aria-hidden="true" />
          )}
          <span className="ys-num">{openIssues}</span> לבדיקה
        </span>
      </p>

      <div className="attendance-toolbar">
        <span
          role="status"
          className={`attendance-sync${refreshError ? ' attendance-sync--error' : ''}`}
        >
          {refreshError ? <WarningIcon size={16} aria-hidden="true" /> : null}
          {refreshError ? 'העדכון נכשל — הנתונים עשויים להיות לא עדכניים' : 'מתעדכן כל 15 שניות'}
        </span>
        <div className="admin-toolbar-actions">
          {canManageAttendance && (
            <Button
              rightIcon={<PlusIcon size={16} />}
              onClick={() => {
                setSelectedRecord(null);
                setShowManual(true);
              }}
            >
              דיווח ידני
            </Button>
          )}
          <Button
            variant="secondary"
            rightIcon={<RefreshIcon size={16} />}
            onClick={refreshAttendance}
          >
            רענון
          </Button>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMessage && !showRotateModal && (
        <Alert variant="danger" title="שגיאה">
          {errorMessage}
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success" title="הצלחה">
          {successMessage}
        </Alert>
      )}

      <div className="ys-segmented attendance-tabs" role="tablist" aria-label="לשוניות נוכחות">
        <button {...tabProps('ACTIVE')}>
          <ClockIcon size={16} aria-hidden="true" />
          <span>נוכחים כעת</span>
          <span className="attendance-tab-count ys-num">{activeRecords.length}</span>
        </button>
        <button {...tabProps('COMPLETED')}>
          <HistoryIcon size={16} aria-hidden="true" />
          <span>דיווחים אחרונים</span>
          <span className="attendance-tab-count ys-num">{completedRecords.length}</span>
        </button>
        <button {...tabProps('NFC')}>
          <NfcTagIcon size={16} aria-hidden="true" />
          <span>עמדת שעון</span>
        </button>
      </div>

      {/* TAB 1: Currently Clocked In */}
      <section {...panelProps('ACTIVE')}>
        <h2 className="ys-visually-hidden">עובדים פעילים כעת בתחנה</h2>
        {activeRecords.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClockIcon size={24} />}
              title="אין עובדים פעילים במשמרת כעת"
              description="ברגע שעובד ידווח נוכחות בתחנה, נתוניו יופיעו כאן בעדכון הבא."
            />
          </Card>
        ) : (
          <ul className="attendance-live-grid">
            {activeRecords.map((record) => {
              const dev = getRecordDeviation(record);
              const name = record.user?.full_name || 'עובד';
              return (
                <li key={record.id} className="attendance-live-card">
                  <div className="attendance-live-head">
                    <div className="attendance-live-person">
                      <h3 className="attendance-live-name">{name}</h3>
                      <span className="attendance-live-role">
                        {roleLabel(record.membership?.role)}
                      </span>
                    </div>
                    <StatusBadge status="live" />
                  </div>

                  <div className="attendance-live-timer">
                    <span className="attendance-live-timer-label">זמן נוכחי במשמרת</span>
                    <span className="attendance-live-timer-value ys-num" dir="ltr">
                      <ElapsedDuration start={record.clock_in_at} />
                    </span>
                  </div>

                  <dl className="attendance-live-facts">
                    <div>
                      <dt>כניסה</dt>
                      <dd>
                        <bdi dir="ltr" className="ys-num">
                          {formatStationTime(record.clock_in_at)}
                        </bdi>
                      </dd>
                    </div>
                    <div>
                      <dt>משמרת</dt>
                      <dd>
                        {record.scheduled_shift
                          ? record.scheduled_shift.shift_template?.name || 'שיבוץ שבועי'
                          : 'ללא שיבוץ מוקדם'}
                      </dd>
                    </div>
                  </dl>

                  <div className="attendance-deviation-row">
                    <DeviationBadge tone={dev.tone} label={dev.label} />
                    {dev.detail && (
                      <span className="attendance-deviation-detail">{dev.detail}</span>
                    )}
                  </div>

                  {canManageAttendance && (
                    <AttendanceRecordActions
                      record={record}
                      onSaved={() => {
                        void refreshAttendance();
                      }}
                      onEdit={() => openEdit(record)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* TAB 2: Recent reports */}
      <section {...panelProps('COMPLETED')}>
        <div className="admin-section-header">
          <div>
            <h2 className="admin-section-title">דיווחים אחרונים</h2>
            <p className="admin-section-description">
              תיעוד רשומות נוכחות שהושלמו בתחנה כולל ביקורת תיקונים
            </p>
          </div>
        </div>
        {completedRecords.length === 0 ? (
          <Card>
            <EmptyState icon={<HistoryIcon size={24} />} title="אין דיווחים אחרונים" />
          </Card>
        ) : (
          <div className="ys-table-wrap ys-table-wrap--stack attendance-history">
            <table className="ys-table">
              <thead>
                <tr>
                  <th scope="col">עובד</th>
                  <th scope="col">כניסה</th>
                  <th scope="col">יציאה</th>
                  <th scope="col">משך</th>
                  <th scope="col">מול הסידור</th>
                  {canManageAttendance && <th scope="col">פעולות</th>}
                </tr>
              </thead>
              <tbody>
                {completedRecords.map((record) => {
                  const dev = getRecordDeviation(record);
                  const isToday = stationDateKey(record.clock_in_at) === todayKey;
                  return (
                    <tr key={record.id}>
                      <td className="attendance-history-person">
                        <div>
                          <span className="attendance-history-name">
                            {record.user?.full_name || 'עובד'}
                          </span>
                          <span className="attendance-history-badges">
                            {record.status === 'COMPLETED' ? (
                              <StatusBadge status="completed" label="הושלמה" />
                            ) : (
                              <StatusBadge status="error" label="סומנה לביקורת" />
                            )}
                            {record.clock_out_source === 'MANUAL_ADMIN' && (
                              <Badge variant="brandCrimson">סגירה מנהלית</Badge>
                            )}
                          </span>
                          <span className="attendance-history-shift">
                            {record.scheduled_shift
                              ? `משמרת מתוכננת: ${record.scheduled_shift.shift_template?.name || 'שיבוץ שבועי'}`
                              : 'ללא שיבוץ מוקדם'}
                          </span>
                          {record.corrected_by && (
                            <span className="attendance-correction">
                              <ShieldAlertIcon size={14} aria-hidden="true" />
                              <span>
                                תוקן מנהלית ע״י: {record.corrector?.full_name || 'מנהל'} | סיבה:{' '}
                                {record.correction_reason}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td data-label="כניסה">
                        <span className="attendance-history-time">
                          <bdi dir="ltr" className="ys-num">
                            {formatStationTime(record.clock_in_at)}
                          </bdi>
                          <span className="attendance-history-date">
                            {isToday ? (
                              'היום'
                            ) : (
                              <bdi dir="ltr" className="ys-num">
                                {formatStationDate(record.clock_in_at)}
                              </bdi>
                            )}
                          </span>
                        </span>
                      </td>
                      <td data-label="יציאה">
                        <bdi dir="ltr" className="ys-num">
                          {record.clock_out_at ? formatStationTime(record.clock_out_at) : '--:--'}
                        </bdi>
                      </td>
                      <td data-label="משך">
                        <span className="attendance-history-duration">
                          {renderTotalDuration(record.clock_in_at, record.clock_out_at)}
                        </span>
                      </td>
                      <td data-label="מול הסידור">
                        <span className="attendance-history-deviation">
                          <DeviationBadge tone={dev.tone} label={dev.label} />
                          {dev.detail && (
                            <span className="attendance-deviation-detail">{dev.detail}</span>
                          )}
                        </span>
                      </td>
                      {canManageAttendance && (
                        <td className="attendance-history-actions">
                          <AttendanceRecordActions
                            record={record}
                            layout="row"
                            onSaved={() => {
                              void refreshAttendance();
                            }}
                            onEdit={() => openEdit(record)}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* TAB 3: Station Clock Setup */}
      <section {...panelProps('NFC')}>
        <Card className="attendance-clock">
          <CardHeader className="attendance-clock-header">
            <span className="attendance-clock-icon" aria-hidden="true">
              <NfcTagIcon size={22} />
            </span>
            <div>
              <CardTitle>הגדרות עמדת שעון נוכחות</CardTitle>
              <CardDescription>
                קישור ייעודי ומאובטח לעמדת שעון הנוכחות המוצבת בתחנה
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="attendance-clock-body">
            <div className="attendance-clock-note">
              <strong>אבטחת שעון הנוכחות ברשת YellowShifts:</strong>
              <p>
                עמדת השעון מכילה קישור מאובטח לזיהוי התחנה בלבד. העמדה אינה שומרת מזהה עובד, טוקן
                הרשאה או סיסמה. האימות מתבצע אך ורק באמצעות הזדהות מאובטחת של העובד במערכת, והרשאות
                הכניסה נבדקות בצד השרת.
              </p>
            </div>

            <dl className="attendance-clock-fields">
              <div>
                <dt>מזהה תחנה מאובטח</dt>
                <dd>
                  <code className="attendance-clock-value" dir="ltr">
                    {nfcToken}
                  </code>
                </dd>
              </div>
              <div>
                <dt>כתובת ה-URL של עמדת שעון הנוכחות</dt>
                <dd className="attendance-clock-url">
                  {nfcStationUrl ? (
                    <code className="attendance-clock-value" dir="ltr">
                      {nfcStationUrl}
                    </code>
                  ) : (
                    <span className="attendance-clock-missing">
                      קישור לשעון הנוכחות אינו זמין. יש להגדיר כתובת תקינה לאפליקציית העובדים.
                    </span>
                  )}
                  <Button
                    variant={copied ? 'primary' : 'secondary'}
                    onClick={handleCopyNfcUrl}
                    disabled={!nfcStationUrl}
                    rightIcon={copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                  >
                    {copied ? 'הועתק!' : 'העתק'}
                  </Button>
                  <span className="ys-visually-hidden" role="status">
                    {copied ? 'הקישור הועתק' : ''}
                  </span>
                </dd>
              </div>
            </dl>

            {/* Token Rotation Section */}
            {canManageAttendance && (
              <div className="attendance-clock-rotate">
                <div>
                  <h3 className="attendance-clock-rotate-title">איפוס מזהה עמדה (Rotation)</h3>
                  <p className="attendance-clock-rotate-text">
                    במקרה של צורך באבטחה מחדש של עמדת השעון בתחנה, ניתן לאפס את המזהה.
                  </p>
                </div>
                <Button
                  variant="destructiveOutline"
                  rightIcon={<RotateCcwIcon size={16} />}
                  onClick={() => setShowRotateModal(true)}
                >
                  איפוס מזהה שעון
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {showManual && (
        <ManualAttendanceDialog
          stationId={station.id}
          timezone={timezone}
          members={members}
          record={selectedRecord}
          onClose={() => {
            setShowManual(false);
            setSelectedRecord(null);
          }}
          onSaved={() => {
            setSuccessMessage('הדיווח נשמר בהצלחה.');
            void refreshAttendance();
          }}
        />
      )}

      {/* Rotate Token Confirm Dialog */}
      <Dialog
        open={showRotateModal}
        onClose={() => setShowRotateModal(false)}
        dismissible={!isPending}
        title="אישור איפוס מזהה שעון"
        footer={
          <>
            <Button variant="destructive" isLoading={isPending} onClick={handleRotateToken}>
              אשר איפוס מזהה שעון
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowRotateModal(false)}
              disabled={isPending}
            >
              ביטול
            </Button>
          </>
        }
      >
        <p className="attendance-dialog-text">
          פעולה זו תיצור מזהה חדש לעמדת השעון של התחנה ותבטל את המזהה הקודם. לאחר הפעולה, עמדת השעון
          הקודמת תפסיק לפעול עד לעדכון הקישור החדש.
        </p>
        {errorMessage && (
          <p className="admin-feedback admin-feedback--error attendance-dialog-error" role="alert">
            <span>{errorMessage}</span>
          </p>
        )}
      </Dialog>
    </div>
  );
}
