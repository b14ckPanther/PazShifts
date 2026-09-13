import { useState } from 'react';
import { Modal, Pressable, View, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Chevron from 'lucide-react-native/icons/chevron-down';
import Check from 'lucide-react-native/icons/check';
import X from 'lucide-react-native/icons/x';
import { Label, Button, Message, Skeleton } from '../ui';
import { colors } from '../ui/theme';
import { useWorker } from './WorkerProvider';
export const roleName = (role: string) =>
  role === 'ADMIN' ? 'מנהל תחנה' : role === 'SHIFT_MANAGER' ? 'אחראי משמרת' : 'עובד';
export function AppHeader() {
  const { context, station, select } = useWorker(),
    [open, setOpen] = useState(false);
  const reduced = useReducedMotion(),
    insets = useSafeAreaInsets();
  const heading = (
    <View style={{ flex: 1, gap: 4 }}>
      <Label style={{ fontSize: 12, color: colors.secondary }}>התחנה שלי</Label>
      <Label bold style={{ fontSize: 18 }}>
        {station?.name ?? 'ללא תחנה פעילה'}
      </Label>
    </View>
  );
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {context.stations.length > 1 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`החלפת תחנה, ${station?.name ?? ''}`}
            onPress={() => setOpen(true)}
            style={{ flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            {heading}
            <Chevron size={18} />
          </Pressable>
        ) : (
          heading
        )}
        <View
          accessibilityLabel={context.fullName}
          style={{
            width: 44,
            height: 44,
            borderRadius: 16,
            backgroundColor: colors.yellow,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Label bold>
            {context.fullName
              .split(' ')
              .slice(0, 2)
              .map((n) => Array.from(n)[0])
              .join('')}
          </Label>
        </View>
      </View>
      <Modal
        visible={open}
        transparent
        animationType={reduced ? 'none' : 'slide'}
        onRequestClose={() => setOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="סגירת בחירת תחנה"
            onPress={() => setOpen(false)}
            style={{ flex: 1 }}
          />
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 24,
              paddingBottom: Math.max(insets.bottom, 24),
              maxHeight: '75%',
              gap: 20,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Label bold accessibilityRole="header" style={{ fontSize: 24 }}>
                איפה עובדים היום?
              </Label>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="סגירה"
                onPress={() => setOpen(false)}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={22} />
              </Pressable>
            </View>
            <ScrollView>
              {context.stations.map((s) => (
                <Pressable
                  key={s.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: s.id === station?.id }}
                  accessibilityLabel={`${s.name}, ${roleName(s.role)}`}
                  onPress={() => {
                    select(s.id);
                    setOpen(false);
                    void Haptics.selectionAsync().catch(() => {});
                  }}
                  style={({ pressed }) => ({
                    minHeight: 76,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    padding: 16,
                    borderRadius: 18,
                    backgroundColor: s.id === station?.id ? colors.yellow : colors.surface,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Label bold>{s.name}</Label>
                    <Label style={{ fontSize: 13, color: colors.secondary }}>
                      {roleName(s.role)}
                    </Label>
                  </View>
                  {s.id === station?.id && <Check size={22} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
export function DataState() {
  const { station, error, refresh } = useWorker();
  if (!station)
    return (
      <>
        <Label bold>החשבון שלך מוכן</Label>
        <Label>אין כרגע שיוך לתחנה פעילה. מנהל התחנה יכול לעזור.</Label>
      </>
    );
  if (error)
    return (
      <>
        <Message>לא הצלחנו לטעון את העדכון. בדקו את החיבור ונסו שוב.</Message>
        <Button title="ניסיון נוסף" onPress={refresh} />
      </>
    );
  return <Skeleton />;
}
export function WebAction({
  title,
  path,
}: {
  title: string;
  path: 'schedule' | 'availability' | 'hours';
}) {
  const { station } = useWorker();
  const [error, setError] = useState(false);
  return (
    <View style={{ gap: 12 }}>
      <Button
        secondary
        title={title}
        onPress={() => {
          if (!station) return;
          const suffix = path === 'schedule' ? '' : `/${path}`;
          void Linking.openURL(
            `https://paz.darb.co.il/stations/${encodeURIComponent(station.code)}${suffix}`
          ).catch(() => setError(true));
        }}
      />
      {error && <Message>לא ניתן לפתוח את האתר כרגע.</Message>}
    </View>
  );
}
export function RefreshStamp() {
  const { data, refresh, loading } = useWorker();
  return (
    <View style={{ gap: 8 }}>
      <Label style={{ fontSize: 12, color: colors.secondary }}>
        הנתונים מתעדכנים בזמן שהאפליקציה פתוחה
        {data
          ? ` · ${new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: data.timezone }).format(data.fetchedAt)}`
          : ''}
      </Label>
      <Button
        secondary
        busy={loading}
        title={loading ? 'מעדכנים…' : 'רענון הנתונים'}
        onPress={refresh}
      />
    </View>
  );
}
