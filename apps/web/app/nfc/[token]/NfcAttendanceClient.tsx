'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { BrandMark } from '@yellowshifts/ui';
import { CheckIcon, NfcIcon } from '@yellowshifts/icons';
import { processNfcScanAction } from '../../actions/attendance';
import type { NfcScanResult, ResolvedNfcStation } from '@yellowshifts/types';

const errors: Record<string, { title: string; text: string }> = {
  LOCATION_REQUIRED: {
    title: 'נדרש אישור מיקום',
    text: 'אפשרו גישה למיקום כדי לדווח נוכחות בתחנה.',
  },
  LOCATION_TIMEOUT: {
    title: 'המיקום לא התקבל בזמן',
    text: 'בדקו שהמיקום מופעל, התקרבו לאזור פתוח ונסו שוב.',
  },
  LOCATION_UNAVAILABLE: { title: 'המיקום אינו זמין', text: 'הפעילו שירותי מיקום בטלפון ונסו שוב.' },
  LOCATION_STALE: { title: 'נדרש מיקום עדכני', text: 'נסו שוב לקבלת מיקום חדש.' },
  LOCATION_INACCURATE: {
    title: 'המיקום אינו מדויק מספיק',
    text: 'נסו להתקרב לאזור פתוח בתחנה ולנסות שוב. לא בוצע דיווח.',
  },
  OUTSIDE_STATION: {
    title: 'נראה שאינכם בתחנה',
    text: 'דיווח נוכחות אפשרי רק בטווח המותר של התחנה. התקרבו ונסו שוב.',
  },
  LOCATION_NOT_CONFIGURED: {
    title: 'מיקום התחנה טרם הוגדר',
    text: 'פנו למנהל התחנה להגדרת המיקום.',
  },
  SERVICE_UNAVAILABLE: {
    title: 'הדיווח עדיין לא זמין',
    text: 'פנו למנהל התחנה להפעלת דיווח הנוכחות.',
  },
  SESSION_EXPIRED: {
    title: 'צריך להתחבר שוב',
    text: 'הסריקה נשמרת בקישור. התחברו כדי להשלים את הדיווח.',
  },
  INVALID_TAG: { title: 'התג אינו פעיל', text: 'פנו למנהל התחנה לבדיקת התג.' },
  INVALID_SCAN: { title: 'נדרשת סריקה חדשה', text: 'סרקו שוב את התג שבתחנה.' },
  EXPIRED_SCAN: { title: 'הסריקה פגה', text: 'לא בוצע דיווח חדש. סרקו שוב את התג שבתחנה.' },
  NO_MEMBERSHIP: { title: 'אין גישה לתחנה הזו', text: 'פנו למנהל התחנה לבדיקת השיוך שלכם.' },
  OTHER_STATION: {
    title: 'יש משמרת פתוחה בתחנה אחרת',
    text: 'סרקו את התג בתחנה שבה התחלתם כדי לסיים אותה.',
  },
  STALE_CHECKOUT: { title: 'המשמרת כבר הסתיימה', text: 'לא בוצע שינוי נוסף. חזרו למסך שלכם.' },
  NETWORK_ERROR: {
    title: 'הדיווח עדיין לא אושר',
    text: 'בדקו את החיבור ונסו שוב. ניסיון חוזר לא ייצור דיווח כפול.',
  },
};

export function NfcAttendanceClient({
  station,
  workerName,
  nfcToken,
  scanId,
  scannedAt,
}: {
  station: ResolvedNfcStation;
  workerName: string;
  nfcToken: string;
  scanId: string;
  scannedAt: number;
}) {
  const [result, setResult] = useState<NfcScanResult | null>(null);
  const [pending, setPending] = useState(true);
  const [now, setNow] = useState<number | null>(null);
  const started = useRef(false);
  const busy = useRef(false);
  const decisionRef = useRef<'scan' | 'confirm' | 'cancel'>('scan');
  const processScan = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      if (!navigator.onLine) {
        setResult({ success: false, code: 'NETWORK_ERROR' });
        return;
      }
      let location:
        { latitude: number; longitude: number; accuracy: number; timestamp: number } | undefined;
      if (decisionRef.current !== 'cancel') {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            if (!navigator.geolocation) return reject(new Error('unavailable'));
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              maximumAge: 0,
              timeout: 12000,
            });
          });
          location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
        } catch (error) {
          const code =
            typeof error === 'object' && error !== null && 'code' in error ? error.code : 2;
          setResult({
            success: false,
            code:
              code === 1
                ? 'LOCATION_REQUIRED'
                : code === 3
                  ? 'LOCATION_TIMEOUT'
                  : 'LOCATION_UNAVAILABLE',
          });
          return;
        }
      }
      const response = await processNfcScanAction(
        nfcToken,
        scanId,
        scannedAt,
        decisionRef.current,
        location
      );
      setResult(response);
      if (response.success && !response.replayed) navigator.vibrate?.(60);
    } catch {
      setResult({ success: false, code: 'NETWORK_ERROR' });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, [nfcToken, scanId, scannedAt]);

  useEffect(() => {
    // Do not process preloaded/background documents; only the first visible opening.
    const start = () => {
      if (document.visibilityState === 'visible' && !started.current) {
        started.current = true;
        void processScan();
      }
    };
    start();
    document.addEventListener('visibilitychange', start);
    return () => document.removeEventListener('visibilitychange', start);
  }, [processScan]);
  useEffect(() => {
    if (!result?.success || result.record.status !== 'ACTIVE') return;
    const update = () => setNow(Date.now());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [result]);

  const record = result?.success ? result.record : null;
  const active = record?.status === 'ACTIVE';
  const confirmCheckout = result?.success && result.action === 'CHECKOUT_PENDING';
  const time = (value: string) =>
    new Intl.DateTimeFormat('he-IL', {
      timeZone: station.timezone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  const seconds = record
    ? Math.max(
        0,
        Math.floor(
          ((active
            ? (now ?? Date.parse(record.clock_in_at))
            : Date.parse(record.clock_out_at || record.clock_in_at)) -
            Date.parse(record.clock_in_at)) /
            1000
        )
      )
    : 0;
  const duration = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
  const error = result && !result.success ? errors[result.code] || errors.NETWORK_ERROR! : null;
  const returnPath = `/nfc/${encodeURIComponent(nfcToken)}?${new URLSearchParams({ scan: scanId, at: String(scannedAt) })}`;
  return (
    <section
      className={`attendance-panel${confirmCheckout ? ' attendance-confirmation' : ''}`}
      aria-labelledby="attendance-heading"
      aria-busy={pending}
    >
      <div className="attendance-topline">
        <BrandMark />
        <span>
          {station.name}
          <small>{workerName}</small>
        </span>
        <span className="scan-chip">
          <NfcIcon size={14} /> NFC
        </span>
      </div>
      <div
        className={`attendance-symbol ${pending ? 'scan-processing' : error ? 'attendance-warning' : ''}`}
        aria-hidden="true"
      >
        {pending || confirmCheckout ? <NfcIcon size={38} /> : error ? '!' : <CheckIcon size={38} />}
      </div>
      <div role="status" aria-live="polite">
        <h1 id="attendance-heading">
          {pending
            ? 'בודקים מיקום ונוכחות…'
            : error
              ? error.title
              : confirmCheckout
                ? 'לסיים את המשמרת?'
                : result?.success && result.action === 'CANCELLED'
                  ? 'ממשיכים במשמרת'
                  : result?.success && result.replayed
                    ? 'הסריקה כבר נקלטה'
                    : active
                      ? 'המשמרת התחילה'
                      : 'המשמרת הסתיימה'}
        </h1>
        <p className="attendance-subtitle">
          {pending
            ? 'אפשרו גישה למיקום. הדיווח יאושר רק לאחר הבדיקה.'
            : error
              ? error.text
              : confirmCheckout
                ? 'המשמרת עדיין פתוחה. אשרו רק אם סיימתם לעבוד.'
                : active
                  ? 'יום עבודה נעים!'
                  : 'תודה על העבודה, להתראות במשמרת הבאה.'}
        </p>
      </div>
      {!pending && record && (
        <>
          <div className="attendance-timer">
            <span>{active ? 'זמן במשמרת' : 'משך המשמרת'}</span>
            <strong dir="ltr">{duration}</strong>
          </div>
          <dl className="attendance-times">
            <div>
              <dt>כניסה</dt>
              <dd>{time(record.clock_in_at)}</dd>
            </div>
            <div>
              <dt>{active ? 'מצב' : 'יציאה'}</dt>
              <dd>{active ? 'במשמרת' : record.clock_out_at ? time(record.clock_out_at) : '—'}</dd>
            </div>
          </dl>
          <div className="scan-instruction" hidden={confirmCheckout}>
            <NfcIcon size={24} />
            <span>
              {confirmCheckout
                ? 'הסריקה נקלטה. המשמרת תסתיים רק לאחר האישור שלך.'
                : active
                  ? 'לסיום המשמרת, סרקו שוב את תג התחנה ואשרו יציאה.'
                  : 'למשמרת הבאה, סרקו את התג בכניסה.'}
              {result?.success && result.duplicate && (
                <small>סריקה חוזרת בתוך 10 שניות אינה משנה את הדיווח.</small>
              )}
            </span>
          </div>
        </>
      )}
      {!pending && confirmCheckout && (
        <div style={{ display: 'grid', gap: 10 }}>
          <button
            className="mobile-primary"
            onClick={() => {
              decisionRef.current = 'confirm';
              void processScan();
            }}
          >
            כן, סיום משמרת
          </button>
          <button
            className="mobile-secondary"
            onClick={() => {
              decisionRef.current = 'cancel';
              void processScan();
            }}
          >
            סרקתי בטעות — ממשיכים לעבוד
          </button>
        </div>
      )}
      {!pending &&
        result &&
        !result.success &&
        [
          'NETWORK_ERROR',
          'LOCATION_REQUIRED',
          'LOCATION_TIMEOUT',
          'LOCATION_UNAVAILABLE',
          'LOCATION_STALE',
          'LOCATION_INACCURATE',
          'OUTSIDE_STATION',
        ].includes(result.code) && (
          <button className="mobile-primary" onClick={() => void processScan()}>
            ניסיון חוזר לאותה סריקה
          </button>
        )}
      {!pending && result && !result.success && result.code === 'SESSION_EXPIRED' && (
        <Link className="mobile-primary" href={`/login?next=${encodeURIComponent(returnPath)}`}>
          התחברות
        </Link>
      )}
      <Link href="/" className="attendance-home">
        למסך שלי
      </Link>
    </section>
  );
}
