import { useState, useCallback, useContext, createContext } from 'react';
import { View, Pressable, RefreshControl } from 'react-native';
import { router, Redirect, useFocusEffect } from 'expo-router';
import Calendar from 'lucide-react-native/icons/calendar-days';
import Clock from 'lucide-react-native/icons/clock-3';
import {
  readWorkerInbox,
  markWorkerNotificationsRead,
  type WorkerNotification,
} from '@yellowshifts/database/public';
import { useSession } from '../src/auth/SessionProvider';
import { useWorkerNotifications } from '../src/notifications/Provider';
import { NotificationSettings } from '../src/notifications/UI';
import { supabase } from '../src/lib/supabase';
import { Screen, Label, Surface, Button, Message, Skeleton } from '../src/ui';
import { colors } from '../src/ui/theme';
export default function InboxRoute() {
  const { state } = useSession();
  if (state.phase === 'signedOut') return <Redirect href="/login" />;
  if (state.phase !== 'ready')
    return (
      <Screen>
        <Skeleton />
      </Screen>
    );
  return <Inbox key={state.context!.userId} />;
}
export const InboxApi = createContext({ read: readWorkerInbox, mark: markWorkerNotificationsRead });
export function Inbox() {
  const api = useContext(InboxApi);
  const n = useWorkerNotifications(),
    [rows, setRows] = useState<WorkerNotification[]>([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [settings, setSettings] = useState(false),
    [opening, setOpening] = useState(false),
    [marking, setMarking] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!supabase || !n.enabled) {
        setBusy(false);
        return;
      }
      setBusy(true);
      void n.refresh();
      setError('');
      void api
        .read(supabase, page)
        .then((data) => {
          if (alive) {
            setRows((old) =>
              page ? [...old.filter((r) => !data.some((next) => next.id === r.id)), ...data] : data
            );
            setMore(data.length === 30);
          }
        })
        .catch(() => {
          if (alive) setError('לא הצלחנו לטעון את העדכונים.');
        })
        .finally(() => {
          if (alive) setBusy(false);
        });
      return () => {
        alive = false;
      };
    }, [page, revision, n.enabled, api])
  );
  const refresh = () => {
    setPage(0);
    setRevision((v) => v + 1);
    void n.refresh();
  };
  const markAll = async () => {
    if (!supabase) return;
    setOpening(true);
    setMarking(true);
    try {
      await api.mark(supabase);
      refresh();
    } catch {
      setError('לא הצלחנו לסמן את העדכונים.');
    } finally {
      setOpening(false);
      setMarking(false);
    }
  };
  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={busy && rows.length > 0}
          onRefresh={refresh}
          tintColor={colors.crimson}
        />
      }
    >
      <Button secondary title="חזרה לאפליקציה" onPress={() => router.replace('/')} />
      <View style={{ gap: 8 }}>
        <Label bold accessibilityRole="header" style={{ fontSize: 32 }}>
          העדכונים שלך
        </Label>
        <Label>כל מה שחשוב לדעת, במקום אחד רגוע.</Label>
      </View>
      <Button
        secondary
        title={settings ? 'חזרה לעדכונים' : 'בחירת ההתראות שלך'}
        onPress={() => setSettings((v) => !v)}
      />
      {settings ? (
        <NotificationSettings />
      ) : (
        <>
          {error && <Message>{error}</Message>}
          {error && <Button secondary title="ניסיון נוסף" onPress={refresh} />}
          {busy && !rows.length && <Skeleton />}
          {!busy && !rows.length && !error && (
            <Surface>
              <Label bold>הכול שקט כאן</Label>
              <Label>כשיהיה עדכון על הסידור או המשמרת שלך, הוא יופיע כאן.</Label>
            </Surface>
          )}
          {rows.some((r) => !r.read_at) && (
            <Button
              secondary
              title="סימון הכול כנקרא"
              busy={marking}
              disabled={opening}
              onPress={() => void markAll()}
            />
          )}
          {opening && !marking && <Label accessibilityLiveRegion="polite">פותח את העדכון…</Label>}
          {rows.map((row) => {
            const Icon = row.type === 'SHIFT_REMINDER' ? Clock : Calendar;
            return (
              <Pressable
                key={row.id}
                disabled={opening}
                accessibilityRole="button"
                accessibilityLabel={`${row.read_at ? 'נקרא' : 'חדש'}, ${row.title}, ${row.body}`}
                onPress={() => {
                  setOpening(true);
                  void n
                    .open(row.id, () => router.navigate('/'))
                    .catch(() => setError('העדכון כבר אינו זמין לחשבון הזה.'))
                    .finally(() => setOpening(false));
                }}
                style={({ pressed }) => ({
                  padding: 20,
                  gap: 10,
                  borderRadius: 24,
                  backgroundColor: row.read_at ? colors.surface : colors.yellow,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Icon color={colors.text} size={22} />
                  <Label bold style={{ flex: 1, fontSize: 19 }}>
                    {row.title}
                  </Label>
                </View>
                {!row.read_at && (
                  <Label bold style={{ fontSize: 12 }}>
                    חדש
                  </Label>
                )}
                <Label>{row.body}</Label>
                {row.data?.stationName && (
                  <Label style={{ fontSize: 13, color: colors.secondary }}>
                    {row.data.stationName}
                  </Label>
                )}
                <Label style={{ fontSize: 12, color: colors.secondary }}>
                  {new Intl.DateTimeFormat('he-IL', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(row.created_at))}
                </Label>
              </Pressable>
            );
          })}
          {more && (
            <Button
              secondary
              title="עדכונים קודמים"
              busy={busy}
              onPress={() => setPage((v) => v + 1)}
            />
          )}
        </>
      )}
    </Screen>
  );
}
