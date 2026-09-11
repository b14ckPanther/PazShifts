'use client';

import React, { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Alert,
} from '@yellowshifts/ui';
import {
  StationIcon,
  ClockIcon,
  CalendarIcon,
  CheckIcon,
  MapPinIcon,
  ShieldAlertIcon,
  RefreshIcon,
} from '@yellowshifts/icons';
import { clockInAction, clockOutAction } from '../../actions/attendance';
import { refreshNfcAttendanceState } from '../../actions/refreshState';
import type { ResolvedNfcStation, AttendanceRecord } from '@yellowshifts/types';

interface ScheduledShiftInfo {
  id: string;
  shift_date: string;
  start_at: string;
  end_at: string;
  templateName?: string;
}

interface NfcAttendanceClientProps {
  station: ResolvedNfcStation;
  workerName: string;
  membershipId: string;
  nfcToken: string;
  initialActiveRecord: AttendanceRecord | null;
  crossStationConflict: {
    stationName?: string;
  } | null;
  scheduledShift: ScheduledShiftInfo | null;
}

export function NfcAttendanceClient({
  station,
  workerName,
  membershipId,
  nfcToken,
  initialActiveRecord,
  crossStationConflict: initialCrossStationConflict,
  scheduledShift: initialScheduledShift,
}: NfcAttendanceClientProps) {
  const [activeRecord, setActiveRecord] = useState<AttendanceRecord | null>(initialActiveRecord);
  const [completedRecord, setCompletedRecord] = useState<AttendanceRecord | null>(null);
  const [completedDuration, setCompletedDuration] = useState<number | null>(null);
  const [crossStationConflict, setCrossStationConflict] = useState(initialCrossStationConflict);
  const [scheduledShift, setScheduledShift] = useState<ScheduledShiftInfo | null>(
    initialScheduledShift
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Debounce guard for rapid actions
  const lastActionRef = useRef<number>(0);

  // Real-time ticking elapsed timer for active attendance
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    if (!activeRecord) {
      setElapsedSeconds(0);
      return;
    }

    const startMs = new Date(activeRecord.clock_in_at).getTime();

    const updateTimer = () => {
      const nowMs = Date.now();
      const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedSeconds(diffSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeRecord]);

  // Server state refresh — reconcile client state with latest server truth
  const refreshState = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const result = await refreshNfcAttendanceState(nfcToken, membershipId);

      if (!result.authenticated) {
        setSessionExpired(true);
        setIsRefreshing(false);
        return;
      }

      setSessionExpired(false);
      setActiveRecord(result.activeRecord);
      setCrossStationConflict(result.crossStationConflict);
      setScheduledShift(result.scheduledShift);

      // Clear completed state if server says there's an active record now
      if (result.activeRecord) {
        setCompletedRecord(null);
        setCompletedDuration(null);
      }
    } catch {
      // Silent failure on refresh — don't disrupt the user
    } finally {
      setIsRefreshing(false);
    }
  }, [nfcToken, membershipId, isRefreshing]);

  // Visibility change listener — refresh state when page regains focus
  // Handles: browser back/forward, tab switching, phone screen unlock after NFC scan
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshState]);

  const formatElapsed = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatStationTime = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat('he-IL', {
        timeZone: station.timezone || 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(isoString));
    } catch {
      return isoString.slice(11, 19);
    }
  };

  const formatStationDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat('he-IL', {
        timeZone: station.timezone || 'Asia/Jerusalem',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date(isoString));
    } catch {
      return isoString.slice(0, 10);
    }
  };

  // Double-tap guard: block rapid actions within 2 seconds
  const canAct = () => {
    const now = Date.now();
    if (now - lastActionRef.current < 2000) return false;
    lastActionRef.current = now;
    return true;
  };

  // Clock-in handler with session expiry detection
  const handleClockIn = () => {
    if (!canAct()) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setSessionExpired(false);

    startTransition(async () => {
      const result = await clockInAction(station.id, membershipId);

      if (!result.success) {
        if (result.error?.includes('הסשן פג תוקף') || result.error?.includes('session')) {
          setSessionExpired(true);
        } else {
          setErrorMessage(result.error || 'שגיאה בכניסה למשמרת');
        }
        return;
      }

      if (result.attendanceRecord) {
        setActiveRecord(result.attendanceRecord);
        setSuccessMessage('משמרתך החלה בהצלחה!');
        setCrossStationConflict(null);
      }
    });
  };

  // Clock-out handler with session expiry detection
  const handleClockOut = () => {
    if (!activeRecord || !canAct()) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setSessionExpired(false);

    startTransition(async () => {
      const result = await clockOutAction(activeRecord.id);

      if (!result.success) {
        if (result.error?.includes('הסשן פג תוקף') || result.error?.includes('session')) {
          setSessionExpired(true);
        } else {
          setErrorMessage(result.error || 'שגיאה בסיום המשמרת');
        }
        return;
      }

      if (result.attendanceRecord) {
        setCompletedRecord(result.attendanceRecord);
        setCompletedDuration(result.durationMinutes ?? null);
        setActiveRecord(null);
        setSuccessMessage('משמרתך הסתיימה בהצלחה. תודה והמשך יום נעים!');
      }
    });
  };

  // Login redirect for expired session
  const handleLoginRedirect = () => {
    const returnPath = `/nfc/${encodeURIComponent(nfcToken)}`;
    window.location.href = `/login?next=${encodeURIComponent(returnPath)}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Station Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '16px',
          borderRadius: 'var(--ys-radius-lg)',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--ys-radius-md)',
            backgroundColor: 'var(--ys-color-brand-yellow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ys-color-brand-crimson)',
            flexShrink: 0,
          }}
        >
          <StationIcon size={26} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111827' }}>
              {station.name}
            </h2>
            <Badge variant="neutral">קוד {station.code}</Badge>
          </div>
          {station.address && (
            <p
              style={{
                fontSize: '12px',
                color: '#6B7280',
                margin: '4px 0 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <MapPinIcon size={12} />
              {station.address}
            </p>
          )}
        </div>
      </div>

      {/* Greeting & Worker Info */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 8px',
        }}
      >
        <div>
          <span style={{ fontSize: '13px', color: '#6B7280' }}>עובד מחובר:</span>
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: '2px 0 0 0' }}>
            {workerName}
          </p>
        </div>
        <div style={{ textAlign: 'left' }}>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>תאריך התחנה:</span>
          <p style={{ fontSize: '13px', fontWeight: 500, color: '#374151', margin: '2px 0 0 0' }}>
            {formatStationDate(new Date().toISOString())}
          </p>
        </div>
      </div>

      {/* Session Expired State */}
      {sessionExpired && (
        <Card
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#F59E0B',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F59E0B',
                }}
              >
                <ShieldAlertIcon size={20} />
              </div>
              <div>
                <CardTitle style={{ color: '#F59E0B', fontSize: '17px' }}>הסשן פג תוקף</CardTitle>
                <CardDescription style={{ color: '#4B5563' }}>
                  יש להתחבר מחדש כדי להמשיך לדווח נוכחות.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardFooter>
            <Button
              variant="brandYellow"
              fullWidth
              onClick={handleLoginRedirect}
              style={{ height: '48px', fontSize: '16px', fontWeight: 700, color: '#111827' }}
            >
              התחבר מחדש
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Alerts / Error Messages with Retry */}
      {errorMessage && !sessionExpired && (
        <Alert variant="danger" title="שגיאה">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>{errorMessage}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setErrorMessage(null);
                refreshState();
              }}
              style={{ alignSelf: 'flex-start' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <RefreshIcon size={14} />
                נסה שנית
              </span>
            </Button>
          </div>
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success" title="אישור פעולה">
          {successMessage}
        </Alert>
      )}

      {/* Cross-Station Conflict State */}
      {crossStationConflict && !activeRecord && !completedRecord && !sessionExpired && (
        <Card
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#EF4444',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#EF4444',
                }}
              >
                <ShieldAlertIcon size={20} />
              </div>
              <div>
                <CardTitle style={{ color: '#EF4444', fontSize: '17px' }}>
                  קיימת משמרת פעילה בתחנה אחרת
                </CardTitle>
                <CardDescription style={{ color: '#4B5563' }}>
                  הינך רשום כרגע במשמרת פעילה בתחנה &quot;
                  {crossStationConflict.stationName || 'אחרת'}&quot;.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p style={{ fontSize: '14px', color: '#4B5563', margin: 0, lineHeight: 1.5 }}>
              על פי נהלי YellowShifts, לא ניתן להתחיל משמרת חדשה לפני ביצוע סיום משמרת בתחנה הפעילה
              הקודמת. עליך לסרוק את תג ה-NFC של התחנה שבה התחלת לעבוד כדי לסגור אותה.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Completed Shift Summary (Just Clocked Out) */}
      {completedRecord && !activeRecord && !sessionExpired && (
        <Card
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#10B981',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10B981',
                }}
              >
                <CheckIcon size={22} />
              </div>
              <div>
                <CardTitle style={{ color: '#10B981', fontSize: '18px' }}>
                  המשמרת הסתיימה בהצלחה
                </CardTitle>
                <CardDescription style={{ color: '#6B7280' }}>
                  רשומת הנוכחות עודכנה בהצלחה
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                backgroundColor: '#F9FAFB',
                padding: '16px',
                borderRadius: 'var(--ys-radius-md)',
                border: '1px solid #E5E7EB',
              }}
            >
              <div>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>שעת כניסה</span>
                <p
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#111827',
                    margin: '4px 0 0 0',
                  }}
                >
                  {formatStationTime(completedRecord.clock_in_at)}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>שעת יציאה</span>
                <p
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#111827',
                    margin: '4px 0 0 0',
                  }}
                >
                  {completedRecord.clock_out_at
                    ? formatStationTime(completedRecord.clock_out_at)
                    : '--:--'}
                </p>
              </div>
              {completedDuration !== null && (
                <div
                  style={{
                    gridColumn: 'span 2',
                    borderTop: '1px solid #E5E7EB',
                    paddingTop: '10px',
                  }}
                >
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>משך זמן כולל</span>
                  <p
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: 'var(--ys-color-brand-crimson)',
                      margin: '4px 0 0 0',
                    }}
                  >
                    {Math.floor(completedDuration / 60)} שעות ו-{completedDuration % 60} דקות (
                    {completedDuration} דקות)
                  </p>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setCompletedRecord(null);
                setSuccessMessage(null);
                refreshState();
              }}
            >
              המשך למסך כניסה מחדש
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ACTIVE Shift State -> Dominated by Clock-Out Action */}
      {activeRecord && !sessionExpired && (
        <Card
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: 'var(--ys-color-brand-yellow)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Badge variant="brandYellow" dot>
                משמרת פעילה כעת
              </Badge>
              <span style={{ fontSize: '12px', color: '#6B7280' }}>מקור: תג NFC</span>
            </div>
            <CardTitle style={{ fontSize: '20px', color: '#111827', marginTop: '8px' }}>
              הינך רשום במשמרת בתחנה זו
            </CardTitle>
          </CardHeader>

          <CardContent>
            {/* Live Timer Box */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                borderRadius: 'var(--ys-radius-lg)',
                backgroundColor: '#F9FAFB',
                border: '1px solid #E5E7EB',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#6B7280',
                  marginBottom: '8px',
                }}
              >
                <ClockIcon size={18} />
                <span style={{ fontSize: '14px' }}>זמן נוכחי במשמרת</span>
              </div>
              <div
                style={{
                  fontSize: '38px',
                  fontWeight: 800,
                  color: 'var(--ys-color-brand-crimson)',
                  letterSpacing: '2px',
                  fontFamily: 'monospace',
                }}
              >
                {formatElapsed(elapsedSeconds)}
              </div>
              <span style={{ fontSize: '13px', color: '#6B7280', marginTop: '8px' }}>
                כניסה: {formatStationTime(activeRecord.clock_in_at)}
              </span>
            </div>

            {scheduledShift && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: '#92400E',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FCD34D',
                  padding: '10px 14px',
                  borderRadius: 'var(--ys-radius-md)',
                }}
              >
                <CalendarIcon size={16} />
                <span>
                  משמרת מתוכננת: {scheduledShift.templateName || 'משמרת משובצת'} (
                  {scheduledShift.start_at.slice(11, 16)} - {scheduledShift.end_at.slice(11, 16)})
                </span>
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button
              variant="destructive"
              size="lg"
              fullWidth
              isLoading={isPending}
              disabled={isPending}
              onClick={handleClockOut}
              style={{
                height: '52px',
                fontSize: '17px',
                fontWeight: 700,
                pointerEvents: isPending ? 'none' : 'auto',
              }}
            >
              סיום משמרת (Clock-Out)
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* NOT IN SHIFT State -> Dominated by Clock-In Action */}
      {!activeRecord && !crossStationConflict && !completedRecord && !sessionExpired && (
        <Card
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#E5E7EB',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Badge variant="neutral">לא במשמרת</Badge>
              <span style={{ fontSize: '12px', color: '#6B7280' }}>אימות NFC</span>
            </div>
            <CardTitle style={{ fontSize: '20px', color: '#111827', marginTop: '8px' }}>
              מוכן לתחילת משמרת
            </CardTitle>
            <CardDescription style={{ color: '#6B7280' }}>
              סריקת תג ה-NFC של התחנה זוהתה. לחץ כדי לתעד כניסה.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {scheduledShift ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  backgroundColor: '#FFFBEB',
                  padding: '16px',
                  borderRadius: 'var(--ys-radius-md)',
                  border: '1px solid #FCD34D',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CalendarIcon size={16} color="#B45309" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#92400E' }}>
                    נמצא שיבוץ מתוכנן להיום:
                  </span>
                </div>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#B45309',
                    margin: 0,
                    fontWeight: 600,
                  }}
                >
                  {scheduledShift.templateName || 'משמרת משובצת'} (
                  {scheduledShift.start_at.slice(11, 16)} - {scheduledShift.end_at.slice(11, 16)})
                </p>
                <span style={{ fontSize: '12px', color: '#92400E' }}>
                  רשומת הנוכחות תקושר אוטומטית למשמרת זו.
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  padding: '14px',
                  borderRadius: 'var(--ys-radius-md)',
                  color: '#4B5563',
                  fontSize: '13px',
                }}
              >
                <ClockIcon size={16} />
                <span>כניסה ללא שיבוץ מוקדם — שעת הכניסה תיקבע לפי שעון השרת</span>
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button
              variant="brandYellow"
              size="lg"
              fullWidth
              isLoading={isPending}
              disabled={isPending}
              onClick={handleClockIn}
              style={{
                height: '54px',
                fontSize: '18px',
                fontWeight: 700,
                color: '#111827',
                pointerEvents: isPending ? 'none' : 'auto',
              }}
            >
              התחלת משמרת (Clock-In)
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Operational Note */}
      <div style={{ textAlign: 'center', padding: '8px' }}>
        <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
          שעות הדיווח נקבעות באופן מאובטח לפי שעון שרת התחנה ולא לפי שעון המכשיר.
        </p>
      </div>
    </div>
  );
}
