import { nativeNfcEnabled } from '../src/lib/features';
import { attendanceChanged } from '../src/nfc/events';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { View, Linking } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import Nfc from 'lucide-react-native/icons/nfc';
import Check from 'lucide-react-native/icons/check';
import * as Haptics from 'expo-haptics';
import {
  getNativeNfcContext,
  submitNativeNfc,
  type NativeNfcContext,
} from '@yellowshifts/database/public';
import type { NfcScanResult } from '@yellowshifts/types';
import { useSession } from '../src/auth/SessionProvider';
import { supabase } from '../src/lib/supabase';
import { readPending, savePending, clearNfcIntent, type PendingScan } from '../src/nfc/pending';
import { scanLocation } from '../src/nfc/location';
import { nfcErrors } from '../src/nfc/errors';
import { Screen, Label, Surface, Button, Message, Skeleton } from '../src/ui';
import { colors } from '../src/ui/theme';
import { reconcileWorkerGeofences } from '../src/location/runtime';
export const NfcApi = createContext({
  context: getNativeNfcContext,
  submit: submitNativeNfc,
  read: readPending,
  save: savePending,
  clear: clearNfcIntent,
  location: scanLocation,
});
export default function Attendance() {
  if (!nativeNfcEnabled)
    return (
      <Screen>
        <Label bold>דיווח נוכחות באתר</Label>
        <Label>בגרסה זו יש לפתוח את קישור תג התחנה בדפדפן כדי לדווח נוכחות.</Label>
        <Button title="למסך שלי" onPress={() => router.replace('/')} />
      </Screen>
    );
  return <AttendanceContent />;
}
export function AttendanceContent() {
  const { state, logout } = useSession();
  const userId = state.context?.userId;
  const identity = useRef(userId);
  identity.current = userId;
  const alive = useRef(true),
    lock = useRef(false);
  const api = useContext(NfcApi);
  const { invalid, scan } = useLocalSearchParams();
  const [pending, setPending] = useState<PendingScan | null>(null),
    [context, setContext] = useState<NativeNfcContext | null>(null),
    [result, setResult] = useState<NfcScanResult | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setContext(null);
    setPending(null);
    setResult(null);
    if (state.phase !== 'ready' || !userId || !supabase) return;
    void (async () => {
      if (invalid) throw Error('INVALID_SCAN');
      const value = await api.read();
      if (!current) return;
      if (!value) throw Error('INVALID_SCAN');
      if (value.userId && value.userId !== userId) throw Error('SESSION_EXPIRED');
      const owned = { ...value, userId };
      await api.save(owned);
      if (!current) return;
      setPending(owned);
      const loaded = await api.context(supabase, userId, value.token, value.scanId);
      if (!current) return;
      setPending(owned);
      setContext(loaded);
      if (
        loaded.receipt &&
        (!loaded.receipt.success || loaded.receipt.action !== 'CHECKOUT_PENDING')
      ) {
        setResult(loaded.receipt);
        if (loaded.receipt.success) {
          void api.save({ ...owned, completed: true }).catch(() => {});
          attendanceChanged(userId);
        }
      }
      if (!loaded.receipt && value.at < Date.now() - 15 * 60000) setError('EXPIRED_SCAN');
    })()
      .catch((e) => {
        if (current)
          setError(e instanceof Error && nfcErrors[e.message] ? e.message : 'NETWORK_ERROR');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [userId, state.phase, revision, invalid, scan]);
  if (state.phase === 'signedOut') return <Redirect href="/login?next=attendance" />;
  if (state.phase === 'error')
    return (
      <Screen>
        <Message>לא הצלחנו לאמת את החשבון.</Message>
        <Button title="חזרה לחשבון" onPress={() => router.replace('/')} />
      </Screen>
    );
  const submit = async () => {
    if (lock.current || !context || !pending || !userId || !supabase) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      // Frozen intent is persisted before sending; lost responses never select a new action.
      const intent: PendingScan = {
        ...pending,
        action: pending.action ?? (context.active ? 'CLOCK_OUT' : 'CLOCK_IN'),
        recordId: pending.action ? pending.recordId : (context.active?.id ?? null),
      };
      const location = await api.location();
      if (!alive.current || identity.current !== userId) return;
      intent.sent = true;
      await api.save(intent);
      setPending(intent);
      if (!alive.current || identity.current !== userId) return;
      const response = await api.submit(
        supabase,
        userId,
        {
          token: intent.token,
          scanId: intent.scanId,
          at: intent.at,
          action: intent.action!,
          recordId: intent.recordId ?? null,
        },
        location
      );
      if (!alive.current || identity.current !== userId) return;
      setResult(response);
      if (response.success) {
        void api.save({ ...intent, completed: true }).catch(() => {});
        attendanceChanged(userId);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        void reconcileWorkerGeofences(userId, context.station.id);
      } else setError(response.code);
    } catch (e) {
      if (alive.current && identity.current === userId)
        setError(e instanceof Error && nfcErrors[e.message] ? e.message : 'NETWORK_ERROR');
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const complete = result?.success && result.action !== 'CHECKOUT_PENDING';
  const other = context?.active && context.active.station_id !== context.station.id;
  const uncertain = pending?.sent && !complete;
  const time = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', {
      hourCycle: 'h23',
      timeZone: context?.station.timezone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 20 }}>
        <View style={{ backgroundColor: colors.yellow, padding: 20, borderRadius: 28 }}>
          {complete ? <Check size={36} /> : <Nfc size={36} />}
        </View>
        <Label bold accessibilityRole="header" style={{ fontSize: 28 }}>
          דיווח נוכחות
        </Label>
        <Label>{context?.station.name ?? 'התג של התחנה שלך'}</Label>
      </View>
      {loading ? (
        <Skeleton />
      ) : (
        <>
          {error && <Message>{nfcErrors[error] ?? nfcErrors.NETWORK_ERROR}</Message>}
          {context && (
            <Surface>
              <View style={{ gap: 16 }}>
                {complete && result.success ? (
                  <>
                    <Label bold style={{ fontSize: 24 }}>
                      {result.action === 'CLOCK_OUT'
                        ? 'היציאה אושרה'
                        : result.action === 'CANCELLED'
                          ? 'המשמרת נשארה פתוחה'
                          : 'הכניסה אושרה'}
                    </Label>
                    <Label>
                      {result.record.status === 'ACTIVE'
                        ? 'המשמרת שלך פעילה. בסיום יש לסרוק שוב את התג.'
                        : 'הרשומה עודכנה בשרת. השעות שלך יתעדכנו בהתאם.'}
                    </Label>
                    <Label>
                      {new Intl.DateTimeFormat('he-IL', {
                        timeZone: context.station.timezone,
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }).format(new Date(result.record.clock_in_at))}
                    </Label>
                    <Label english bold style={{ fontSize: 28, textAlign: 'center' }}>
                      {time(result.record.clock_in_at)}
                      {result.record.clock_out_at ? ` — ${time(result.record.clock_out_at)}` : ''}
                    </Label>
                    {result.duplicate && <Label>סריקה חוזרת סמוכה אינה משנה את הדיווח.</Label>}
                  </>
                ) : (
                  <>
                    <Label bold style={{ fontSize: 24 }}>
                      {other
                        ? 'משמרת פעילה בתחנה אחרת'
                        : uncertain
                          ? 'בדיקת הדיווח האחרון'
                          : context.active
                            ? 'סיימת את המשמרת?'
                            : 'מוכנים להתחיל?'}
                    </Label>
                    {context.active && (
                      <Label>תחילת המשמרת: {time(context.active.clock_in_at)}</Label>
                    )}
                    {context.active &&
                      Date.now() - Date.parse(context.active.clock_in_at) >=
                        context.leftOpenHours * 3600000 && (
                        <Message>
                          המשמרת פתוחה זמן ממושך. אם שכחת לדווח יציאה, פנה למנהל לתיקון השעות.
                        </Message>
                      )}
                    <Label>
                      בעת האישור נבדוק את המיקום הנוכחי שלך מול טווח התחנה. המיקום אינו נשמר
                      כהיסטוריה.
                    </Label>
                    {other ? (
                      <Message>{nfcErrors.OTHER_STATION}</Message>
                    ) : (
                      <Button
                        title={
                          busy
                            ? 'מאמתים את הדיווח…'
                            : uncertain
                              ? 'ניסיון חוזר לאותה סריקה'
                              : context.active
                                ? 'אישור יציאה'
                                : 'אישור כניסה'
                        }
                        busy={busy}
                        disabled={Boolean(
                          error &&
                          [
                            'EXPIRED_SCAN',
                            'STATE_CHANGED',
                            'STALE_CHECKOUT',
                            'SESSION_EXPIRED',
                            'SERVICE_UNAVAILABLE',
                          ].includes(error)
                        )}
                        onPress={() => void submit()}
                      />
                    )}
                  </>
                )}
              </View>
            </Surface>
          )}
          {['STATE_CHANGED', 'EXPIRED_SCAN', 'STALE_CHECKOUT'].includes(error) && (
            <Button
              secondary
              title="חזרה לסריקה חדשה"
              onPress={() => void api.clear().then(() => router.replace('/'))}
            />
          )}
          {!complete && (uncertain || error) && (
            <Button
              secondary
              title={uncertain ? 'בדיקת הדיווח' : 'ניסיון נוסף'}
              disabled={busy}
              onPress={() => setRevision((v) => v + 1)}
            />
          )}
          {error === 'SESSION_EXPIRED' && (
            <Button
              title="התחברות מחדש"
              disabled={busy}
              onPress={() => {
                const saved = pending;
                setBusy(true);
                void logout()
                  .then(async () => {
                    if (saved) await api.save(saved);
                    router.replace('/login?next=attendance');
                  })
                  .catch(() => setError('NETWORK_ERROR'))
                  .finally(() => setBusy(false));
              }}
            />
          )}
          {error.startsWith('LOCATION_') && (
            <Button secondary title="הגדרות מיקום" onPress={() => void Linking.openSettings()} />
          )}
          <Button
            secondary
            title={complete ? 'למסך שלי' : uncertain ? 'חזרה — הדיווח טרם אומת' : 'לא עכשיו'}
            disabled={busy}
            onPress={() => {
              if (complete || !pending?.sent) void api.clear().then(() => router.replace('/'));
              else router.replace('/');
            }}
          />
        </>
      )}
    </Screen>
  );
}
