import { useEffect, useState, useRef } from 'react';
import { View, Switch, Linking, Pressable, Alert } from 'react-native';
import Bell from 'lucide-react-native/icons/bell';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useWorkerNotifications } from './Provider';
import { useSession } from '../auth/SessionProvider';
import { useWorker } from '../home/WorkerProvider';
import { Surface, Label, Button, Message } from '../ui';
import { Sheet } from '../week/Patterns';
import { colors } from '../ui/theme';
export function NotificationBridge() {
  const { target, consume } = useWorkerNotifications(),
    worker = useWorker();
  const { retry } = useSession();
  const attempted = useRef<typeof target>(null);
  useEffect(() => {
    if (target) {
      if (!worker.context.stations.some((s) => s.id === target.stationId)) {
        if (attempted.current !== target) {
          attempted.current = target;
          retry();
          return;
        }
        consume();
        Alert.alert('העדכון אינו זמין', 'לא ניתן לפתוח את התחנה בחשבון הזה.');
        return;
      }
      consume();
      worker.openStation(target.stationId, () =>
        target.screen === 'home'
          ? router.navigate('/')
          : router.navigate({ pathname: '/schedule', params: { day: target.day } })
      );
    }
  }, [target, worker.context, retry]);
  return null;
}
export function NotificationBell() {
  const n = useWorkerNotifications();
  if (!n.enabled) return null;
  return (
    <View style={{ gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`העדכונים שלך, ${n.unread} עדכונים שלא נקראו`}
        onPress={() => {
          void Haptics.selectionAsync();
          router.push('/inbox');
        }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          gap: 12,
          alignItems: 'center',
          padding: 16,
          borderRadius: 22,
          backgroundColor: pressed ? colors.cream : colors.surface,
        })}
      >
        <Bell size={22} color={colors.text} />
        <Label bold style={{ flex: 1 }}>
          העדכונים שלך
        </Label>
        {n.unread > 0 && (
          <View
            style={{
              backgroundColor: colors.yellow,
              borderRadius: 12,
              paddingHorizontal: 9,
              paddingVertical: 3,
            }}
          >
            <Label english bold>
              {n.unread > 9 ? '9+' : n.unread}
            </Label>
          </View>
        )}
        <ChevronLeft size={18} color={colors.secondary} />
      </Pressable>
      {n.error && (
        <Message>לא הצלחנו לעדכן את ההתראות כרגע. אפשר לנסות שוב בתיבת העדכונים.</Message>
      )}
      {n.banner && (
        <Label accessibilityLiveRegion="polite">יש עדכון חדש שמחכה לך בתיבת העדכונים.</Label>
      )}
      {n.ask && <PermissionOffer />}
    </View>
  );
}
export function PermissionOffer() {
  const n = useWorkerNotifications(),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const run = async (enable: boolean) => {
    setBusy(true);
    setError(false);
    try {
      if (enable) await n.enable();
      else await n.later();
      setShow(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button secondary title="להישאר מעודכן" onPress={() => setShow(true)} />
      <Sheet
        visible={show}
        close={() => {
          if (!busy) setShow(false);
        }}
        title="העדכון הנכון, בזמן הנכון"
      >
        <Label>
          קבל התראה כשסידור העבודה מתפרסם וכשהמשמרת שלך מתקרבת. אפשר לשנות את הבחירה בכל רגע.
        </Label>
        {error && <Message>לא הצלחנו להפעיל התראות כרגע. אפשר לנסות שוב מאוחר יותר.</Message>}
        <Button title="אפשר התראות" busy={busy} onPress={() => void run(true)} />
        <Button secondary title="לא עכשיו" disabled={busy} onPress={() => void run(false)} />
      </Sheet>
    </>
  );
}
export function NotificationSettings() {
  const n = useWorkerNotifications(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  if (!n.enabled) return <Message>העדכונים יהיו זמינים בגרסה הבאה.</Message>;
  const save = async (value: NonNullable<typeof n.prefs>) => {
    setBusy(true);
    setError(false);
    try {
      await n.save(value);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Surface>
      <Label bold style={{ fontSize: 24 }}>
        בדיוק העדכונים שמתאימים לך
      </Label>
      <Label>
        {n.permission === 'granted'
          ? 'התראות מופעלות במכשיר הזה'
          : n.permission === 'denied'
            ? 'התראות כבויות במכשיר הזה'
            : 'הבחירה אם לקבל התראות היא שלך'}
      </Label>
      {n.permission === 'denied' ? (
        <Button secondary title="פתיחת הגדרות המכשיר" onPress={() => void Linking.openSettings()} />
      ) : n.permission !== 'granted' ? (
        <PermissionOffer />
      ) : null}
      {(error || n.error) && <Message>לא הצלחנו לעדכן כרגע. בדקו את החיבור ונסו שוב.</Message>}
      {!n.prefs ? (
        <Button secondary title="טעינה מחדש" onPress={() => void n.refresh()} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Label bold style={{ flex: 1 }}>
              פרסום סידור עבודה
            </Label>
            <Switch
              accessibilityLabel="התראה על פרסום סידור עבודה"
              disabled={busy}
              value={n.prefs.schedule_published}
              trackColor={{ true: colors.yellow }}
              onValueChange={(v) => void save({ ...n.prefs!, schedule_published: v })}
            />
          </View>
          {busy && <Label accessibilityLiveRegion="polite">שומר את הבחירה שלך…</Label>}
          <Label bold>לפני המשמרת</Label>
          <Label>
            בחר מתי לקבל תזכורת. בחירה ללא תזכורת מכבה גם את התזכורת למשמרת שנשארה פתוחה.
          </Label>
          {([60, 30, 0] as const).map((minutes) => (
            <Button
              key={minutes}
              secondary={n.prefs!.reminder_minutes !== minutes}
              disabled={busy}
              title={`${minutes ? `${minutes} דקות לפני` : 'ללא תזכורת'}${n.prefs!.reminder_minutes === minutes ? ' · נבחר' : ''}`}
              onPress={() => void save({ ...n.prefs!, reminder_minutes: minutes })}
            />
          ))}
        </>
      )}
    </Surface>
  );
}
