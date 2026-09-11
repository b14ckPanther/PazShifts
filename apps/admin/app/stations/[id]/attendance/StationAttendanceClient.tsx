'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Alert,
  Input,
} from '@yellowshifts/ui';
import {
  ClockIcon,
  NfcIcon,
  CheckIcon,
  CopyIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  UserIcon,
  CloseIcon,
} from '@yellowshifts/icons';
import { adminCorrectAttendanceAction, rotateNfcTokenAction } from '../../../actions/attendance';
import { configuredAppOrigin } from '@yellowshifts/database';
import type { Station, AttendanceRecordWithDetails } from '@yellowshifts/types';

interface StationAttendanceClientProps {
  station: Station;
  canManageAttendance: boolean; // Platform Admin or Station Admin
  isPlatformAdmin?: boolean;
  initialActiveRecords: AttendanceRecordWithDetails[];
  initialCompletedRecords: AttendanceRecordWithDetails[];
}

export function StationAttendanceClient({
  station,
  canManageAttendance,
  initialActiveRecords,
  initialCompletedRecords,
}: StationAttendanceClientProps) {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'COMPLETED' | 'NFC'>('ACTIVE');
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
  const [correctionAction, setCorrectionAction] = useState<'CLOSE' | 'FLAG'>('CLOSE');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [isPending, startTransition] = useTransition();

  // Rotate Token Confirm Modal State
  const [showRotateModal, setShowRotateModal] = useState<boolean>(false);

  // Live timer tick for active records
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatStationTime = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat('he-IL', {
        timeZone: station.timezone || 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(isoString));
    } catch {
      return isoString.slice(11, 16);
    }
  };

  const getElapsedDuration = (clockInAt: string) => {
    const startMs = new Date(clockInAt).getTime();
    const diffSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    const hours = Math.floor(diffSec / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    const seconds = diffSec % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTotalDuration = (startAt: string, endAt: string | null) => {
    if (!endAt) return '--';
    const diffMin = Math.max(
      0,
      Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000)
    );
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return `${hours} שעות ו-${mins} דקות`;
  };

  const getRecordDeviation = (record: AttendanceRecordWithDetails) => {
    const allowedLate = station.allowedLateMinutes ?? 10;
    const allowedEarly = station.allowedEarlyLeaveMinutes ?? 10;
    const leftOpenWarningHours = station.leftOpenWarningHours ?? 12;

    if (record.status === 'ACTIVE') {
      const elapsedHours = (Date.now() - new Date(record.clock_in_at).getTime()) / 3600000;
      if (elapsedHours >= leftOpenWarningHours) {
        return {
          label: 'משמרת לא נסגרה',
          color: '#EF4444',
          bg: 'rgba(239, 68, 68, 0.12)',
          detail: `פתוח ${Math.round(elapsedHours * 10) / 10} שעות`,
        };
      }
    }

    if (!record.scheduled_shift) {
      return {
        label: 'לא מתוכננת',
        color: '#3B82F6',
        bg: 'rgba(59, 130, 246, 0.12)',
        detail: null,
      };
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
        color: '#EF4444',
        bg: 'rgba(239, 68, 68, 0.12)',
        detail: `איחור: ${lateMin} דק׳ | יציאה מוקדמת: ${earlyMin} דק׳`,
      };
    }
    if (isLate) {
      return {
        label: 'איחור',
        color: '#F59E0B',
        bg: 'rgba(245, 158, 11, 0.12)',
        detail: `איחור של ${lateMin} דקות`,
      };
    }
    if (isEarly) {
      return {
        label: 'יציאה מוקדמת',
        color: '#F59E0B',
        bg: 'rgba(245, 158, 11, 0.12)',
        detail: `יציאה מוקדמת ב-${earlyMin} דקות`,
      };
    }
    return {
      label: 'בזמן',
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.12)',
      detail: null,
    };
  };

  // The admin host cannot identify the separate worker project; require its configured origin.
  const origin = configuredAppOrigin(process.env.NEXT_PUBLIC_APP_URL);
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
        setErrorMessage(result.error || 'שגיאה בסיבוב מזהה ה-NFC');
        return;
      }

      setNfcToken(result.newToken);
      setShowRotateModal(false);
      setSuccessMessage('מזהה תג ה-NFC סובב בהצלחה. יש לעדכן את תג ה-NFC הפיזי בקישור החדש.');
    });
  };

  const handleSaveCorrection = () => {
    if (!selectedRecord) return;
    if (!correctionReason.trim()) {
      setErrorMessage('יש להזין סיבת תיקון מנהלי מפורשת לצורכי ביקורת.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await adminCorrectAttendanceAction({
        attendanceRecordId: selectedRecord.id,
        stationId: station.id,
        action: correctionAction,
        reason: correctionReason.trim(),
      });

      if (!result.success || !result.record) {
        setErrorMessage(result.error || 'שגיאה בביצוע תיקון מנהלי');
        return;
      }

      // If closed, remove from active and add to completed
      if (correctionAction === 'CLOSE') {
        setActiveRecords((prev) => prev.filter((r) => r.id !== selectedRecord.id));
        setCompletedRecords((prev) => [
          {
            ...selectedRecord,
            status: 'COMPLETED',
            clock_out_at: result.record!.clock_out_at,
            clock_out_source: 'MANUAL_ADMIN',
            corrected_by: result.record!.corrected_by,
            correction_reason: result.record!.correction_reason,
            corrected_at: result.record!.corrected_at,
          },
          ...prev,
        ]);
      } else {
        // If flagged
        setActiveRecords((prev) =>
          prev.map((r) => (r.id === selectedRecord.id ? { ...r, status: 'FLAGGED' } : r))
        );
      }

      setSelectedRecord(null);
      setCorrectionReason('');
      setSuccessMessage('רשומת הנוכחות עודכנה בהצלחה ונרשמה ביומן הביקורת.');
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #E5E7EB',
          paddingBottom: '12px',
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant={activeTab === 'ACTIVE' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('ACTIVE')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <ClockIcon size={16} />
            נוכחים כעת במשמרת
            <Badge variant={activeRecords.length > 0 ? 'brandYellow' : 'neutral'}>
              {activeRecords.length}
            </Badge>
          </span>
        </Button>

        <Button
          variant={activeTab === 'COMPLETED' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('COMPLETED')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <CheckIcon size={16} />
            משמרות שהסתיימו היום
            <Badge variant="neutral">{completedRecords.length}</Badge>
          </span>
        </Button>

        <Button
          variant={activeTab === 'NFC' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('NFC')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <NfcIcon size={16} />
            תג NFC והגדרות תחנה
          </span>
        </Button>
      </div>

      {/* Global Alerts */}
      {errorMessage && (
        <Alert variant="danger" title="שגיאה">
          {errorMessage}
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success" title="הצלחה">
          {successMessage}
        </Alert>
      )}

      {/* TAB 1: Currently Clocked In */}
      {activeTab === 'ACTIVE' && (
        <Card
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <CardTitle style={{ fontSize: '18px', color: '#111827' }}>
                  עובדים פעילים כעת בתחנה
                </CardTitle>
                <CardDescription style={{ color: '#6B7280' }}>
                  נתוני זמן אמת המבוססים על סריקת תג ה-NFC של התחנה
                </CardDescription>
              </div>
              <Badge variant="brandYellow" dot>
                מעודכן בזמן אמת
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {activeRecords.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 16px',
                  color: '#9CA3AF',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <ClockIcon size={32} />
                <p style={{ margin: 0, fontSize: '15px', color: '#374151' }}>
                  אין עובדים פעילים במשמרת כעת
                </p>
                <span style={{ fontSize: '13px', color: '#6B7280' }}>
                  ברגע שעובד יסרוק את תג ה-NFC בתחנה, נוכחותו תופיע כאן מיד.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeRecords.map((record) => (
                  <div
                    key={record.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      padding: '16px',
                      backgroundColor: '#F9FAFB',
                      borderRadius: 'var(--ys-radius-md)',
                      border: '1px solid #E5E7EB',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          color: '#D97706',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <UserIcon size={20} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                            {record.user?.full_name || 'עובד'}
                          </span>
                          <Badge variant="neutral">
                            {record.membership?.role === 'ADMIN'
                              ? 'מנהל תחנה'
                              : record.membership?.role === 'SHIFT_MANAGER'
                                ? 'מנהל משמרת'
                                : 'עובד'}
                          </Badge>
                          {record.clock_in_source === 'NFC' && (
                            <Badge variant="brandYellow">NFC</Badge>
                          )}
                          {(() => {
                            const dev = getRecordDeviation(record);
                            return (
                              <Badge
                                variant="neutral"
                                style={{
                                  backgroundColor: dev.bg,
                                  color: dev.color,
                                  fontWeight: 600,
                                }}
                              >
                                {dev.label}
                              </Badge>
                            );
                          })()}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '12px',
                            color: '#6B7280',
                            marginTop: '4px',
                          }}
                        >
                          <span>כניסה: {formatStationTime(record.clock_in_at)}</span>
                          {record.scheduled_shift ? (
                            <span>
                              משמרת מתוכננת:{' '}
                              {record.scheduled_shift.shift_template?.name || 'שיבוץ שבועי'}
                            </span>
                          ) : (
                            <span style={{ color: '#9CA3AF' }}>ללא שיבוץ מוקדם</span>
                          )}
                          {(() => {
                            const dev = getRecordDeviation(record);
                            return dev.detail ? (
                              <span style={{ color: dev.color, fontWeight: 500 }}>
                                • {dev.detail}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {/* Live Ticking Duration */}
                      <div style={{ textAlign: 'left' }}>
                        <span style={{ fontSize: '11px', color: '#6B7280' }}>משך זמן נוכחי</span>
                        <p
                          style={{
                            fontSize: '18px',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            color: '#D97706',
                            margin: '2px 0 0 0',
                          }}
                        >
                          {getElapsedDuration(record.clock_in_at)}
                        </p>
                      </div>

                      {canManageAttendance && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedRecord(record);
                            setCorrectionAction('CLOSE');
                            setCorrectionReason('');
                          }}
                        >
                          תיקון מנהלי
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: Completed Today */}
      {activeTab === 'COMPLETED' && (
        <Card
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <CardHeader>
            <CardTitle style={{ fontSize: '18px', color: '#111827' }}>
              משמרות שהסתיימו היום
            </CardTitle>
            <CardDescription style={{ color: '#6B7280' }}>
              תיעוד רשומות נוכחות שהושלמו בתחנה כולל ביקורת תיקונים
            </CardDescription>
          </CardHeader>
          <CardContent>
            {completedRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: '#6B7280' }}>
                <p style={{ margin: 0, fontSize: '15px' }}>אין משמרות שהסתיימו היום</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {completedRecords.map((record) => (
                  <div
                    key={record.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '14px 16px',
                      backgroundColor: '#F9FAFB',
                      borderRadius: 'var(--ys-radius-md)',
                      border: '1px solid #E5E7EB',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                          {record.user?.full_name || 'עובד'}
                        </span>
                        <Badge variant={record.status === 'COMPLETED' ? 'success' : 'danger'}>
                          {record.status === 'COMPLETED' ? 'הושלמה' : 'סומנה לביקורת'}
                        </Badge>
                        {record.clock_out_source === 'MANUAL_ADMIN' && (
                          <Badge variant="brandCrimson">סגירה מנהלית</Badge>
                        )}
                        {(() => {
                          const dev = getRecordDeviation(record);
                          return (
                            <Badge
                              variant="neutral"
                              style={{
                                backgroundColor: dev.bg,
                                color: dev.color,
                                fontWeight: 600,
                              }}
                            >
                              {dev.label}
                            </Badge>
                          );
                        })()}
                      </div>

                      <div style={{ fontSize: '13px', color: '#374151' }}>
                        <span>{formatStationTime(record.clock_in_at)}</span>
                        <span style={{ margin: '0 6px' }}>←</span>
                        <span>
                          {record.clock_out_at ? formatStationTime(record.clock_out_at) : '--:--'}
                        </span>
                        <span style={{ margin: '0 8px', color: '#9CA3AF' }}>|</span>
                        <strong style={{ color: '#D97706' }}>
                          {getTotalDuration(record.clock_in_at, record.clock_out_at)}
                        </strong>
                      </div>
                    </div>

                    {/* Scheduled Shift Context & Deviation Details */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '12px',
                        color: '#6B7280',
                      }}
                    >
                      {record.scheduled_shift ? (
                        <span>
                          משמרת מתוכננת:{' '}
                          {record.scheduled_shift.shift_template?.name || 'שיבוץ שבועי'}
                        </span>
                      ) : (
                        <span style={{ color: '#9CA3AF' }}>ללא שיבוץ מוקדם</span>
                      )}
                      {(() => {
                        const dev = getRecordDeviation(record);
                        return dev.detail ? (
                          <span style={{ color: dev.color, fontWeight: 500 }}>• {dev.detail}</span>
                        ) : null;
                      })()}
                    </div>

                    {/* Audited Correction Footnote if corrected */}
                    {record.corrected_by && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#B45309',
                          backgroundColor: '#FEF3C7',
                          border: '1px solid #FDE68A',
                          padding: '6px 10px',
                          borderRadius: 'var(--ys-radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <ShieldAlertIcon size={14} />
                        <span>
                          תוקן מנהלית ע״י: {record.corrector?.full_name || 'מנהל'} | סיבה:{' '}
                          {record.correction_reason}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: Station NFC Tag */}
      {activeTab === 'NFC' && (
        <Card
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--ys-radius-md)',
                  backgroundColor: 'var(--ys-color-brand-yellow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ys-color-brand-crimson)',
                }}
              >
                <NfcIcon size={22} />
              </div>
              <div>
                <CardTitle style={{ fontSize: '18px', color: '#111827' }}>
                  הגדרות תג NFC פיזי לתחנה
                </CardTitle>
                <CardDescription style={{ color: '#4B5563' }}>
                  קישור ייעודי ומאובטח לצריבה על מדבקת / תג ה-NFC הפיזי המוצב בתחנה
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Architecture Explanation */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--ys-radius-md)',
                  backgroundColor: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  fontSize: '13px',
                  color: '#111827',
                  lineHeight: 1.6,
                }}
              >
                <strong>אבטחת תגי NFC ברשת YellowShifts:</strong>
                <p style={{ margin: '6px 0 0 0', color: '#4B5563' }}>
                  תג ה-NFC הפיזי מכיל אך ורק את כתובת התחנה. התג אינו מכיל מזהה עובד, טוקן הרשאה או
                  סיסמה. האימות מתבצע אך ורק באמצעות הזדהות מאובטחת של העובד במערכת, והרשאות הכניסה
                  נבדקות בצד השרת.
                </p>
              </div>

              {/* Public Station Token Box */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    color: '#374151',
                    marginBottom: '6px',
                  }}
                >
                  מזהה ציבורי אקראי לתחנה (NFC Public Token)
                </label>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--ys-radius-md)',
                    backgroundColor: '#F9FAFB',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    color: '#B45309',
                    border: '1px solid #E5E7EB',
                    wordBreak: 'break-all',
                  }}
                >
                  {nfcToken}
                </div>
              </div>

              {/* NFC URL to Encode Box */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    color: '#374151',
                    marginBottom: '6px',
                  }}
                >
                  כתובת ה-URL לצריבה על תג ה-NFC הפיזי
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: 'var(--ys-radius-md)',
                    backgroundColor: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      color: '#111827',
                      wordBreak: 'break-all',
                    }}
                  >
                    {nfcStationUrl ||
                      'קישור NFC אינו זמין. יש להגדיר כתובת תקינה לאפליקציית העובדים לפני כתיבת התג.'}
                  </span>
                  <Button
                    variant={copied ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={handleCopyNfcUrl}
                    disabled={!nfcStationUrl}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                      {copied ? 'הועתק!' : 'העתק'}
                    </span>
                  </Button>
                </div>
              </div>

              {/* Token Rotation Section */}
              {canManageAttendance && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '16px',
                    borderTop: '1px solid #E5E7EB',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                      החלפת מזהה NFC (Rotation)
                    </span>
                    <p style={{ fontSize: '12px', color: '#4B5563', margin: '2px 0 0 0' }}>
                      במקרה של אובדן תג או החלפת מדבקה פיזית בתחנה, ניתן לסובב את המזהה.
                    </p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => setShowRotateModal(true)}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <RotateCcwIcon size={14} />
                      סובב מזהה NFC
                    </span>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Correction Modal */}
      {selectedRecord && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '16px',
          }}
          onClick={() => setSelectedRecord(null)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              width: '100%',
              maxWidth: '500px',
              padding: '24px',
              direction: 'rtl',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#111827' }}>
                  תיקון מנהלי לרשומת נוכחות
                </h3>
                <p style={{ fontSize: '13px', color: '#4B5563', margin: '4px 0 0 0' }}>
                  עובד: {selectedRecord.user?.full_name || 'עובד'} | שעת כניסה:{' '}
                  {formatStationTime(selectedRecord.clock_in_at)}
                </p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6B7280',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <CloseIcon size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    color: '#374151',
                    marginBottom: '8px',
                  }}
                >
                  סוג פעולת תיקון מנהלי
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Button
                    type="button"
                    variant={correctionAction === 'CLOSE' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setCorrectionAction('CLOSE')}
                  >
                    סגירת משמרת (Clock-Out)
                  </Button>
                  <Button
                    type="button"
                    variant={correctionAction === 'FLAG' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => setCorrectionAction('FLAG')}
                  >
                    סימון לחקירה (FLAG)
                  </Button>
                </div>
              </div>

              <Input
                id="correctionReason"
                label="סיבת התיקון (שדה חובה לצורכי ביקורת)"
                placeholder="לדוגמה: עובד שכח לסגור משמרת בסיום יום עבודה..."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                isRequired
                helperText="הסיבה ומזהה המנהל יתועדו ביומן המערכת לצורכי ביקורת תפעולית."
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '12px',
                }}
              >
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setSelectedRecord(null)}
                  disabled={isPending}
                >
                  ביטול
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  isLoading={isPending}
                  onClick={handleSaveCorrection}
                >
                  שמור תיקון מנהלי
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rotate Token Confirm Modal */}
      {showRotateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '16px',
          }}
          onClick={() => setShowRotateModal(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              direction: 'rtl',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#111827' }}>
                אישור החלפת מזהה NFC
              </h3>
              <button
                onClick={() => setShowRotateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6B7280',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <CloseIcon size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '14px', color: '#374151', margin: 0, lineHeight: 1.5 }}>
                פעולה זו תיצור מזהה תג חדש לתחנה ותבטל את המזהה הקודם. לאחר הפעולה, כל תג פיזי שנצרב
                בעבר יפסיק לפעול ויחזיר שגיאה, עד אשר תצרוב את הקישור החדש על התג הפיזי.
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '12px',
                }}
              >
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowRotateModal(false)}
                  disabled={isPending}
                >
                  ביטול
                </Button>
                <Button
                  variant="destructive"
                  size="md"
                  isLoading={isPending}
                  onClick={handleRotateToken}
                >
                  אשר החלפת מזהה NFC
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
