import { useMemo, type ReactNode } from 'react';
import { View, Pressable, Modal, ScrollView, PanResponder, I18nManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { addDays } from '@yellowshifts/reports';
import { Label, Button } from '../ui';
import { colors } from '../ui/theme';
import { dateLabel } from './model';
export const selection = () => {
  void Haptics.selectionAsync().catch(() => {});
};
export function WeekPicker({
  week,
  change,
  today,
  disabled = false,
}: {
  week: string;
  change: (delta: number) => void;
  today: () => void;
  disabled?: boolean;
}) {
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          !disabled && Math.abs(g.dx) > 35 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) > 60) change((g.dx > 0 ? 1 : -1) * (I18nManager.isRTL ? 1 : -1));
        },
      }),
    [disabled, change]
  );
  return (
    <View {...pan.panHandlers} style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="שבוע קודם"
          onPress={() => change(-1)}
          style={{ minWidth: 44, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}
        >
          <Label english bold style={{ fontSize: 28 }}>
            {I18nManager.isRTL ? '›' : '‹'}
          </Label>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Label english bold style={{ fontSize: 20, textAlign: 'center' }}>
            {dateLabel(week)} — {dateLabel(addDays(week, 6))}
          </Label>
          <Label style={{ fontSize: 12, textAlign: 'center' }}>{week.slice(0, 4)}</Label>
        </View>
        <Pressable
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="שבוע הבא"
          onPress={() => change(1)}
          style={{ minWidth: 44, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}
        >
          <Label english bold style={{ fontSize: 28 }}>
            {I18nManager.isRTL ? '‹' : '›'}
          </Label>
        </Pressable>
      </View>
      <Button secondary title="השבוע הנוכחי" onPress={today} disabled={disabled} />
    </View>
  );
}
export function Sheet({
  visible,
  close,
  title,
  children,
}: {
  visible: boolean;
  close: () => void;
  title: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets(),
    reduced = useReducedMotion();
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 50) close();
        },
      }),
    [close]
  );
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? 'none' : 'slide'}
      onRequestClose={close}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="סגירה"
          onPress={close}
          style={{ flex: 1 }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '90%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 20,
            paddingBottom: Math.max(insets.bottom, 20),
            gap: 12,
          }}
        >
          <View {...pan.panHandlers} style={{ alignItems: 'center', padding: 8 }}>
            <View
              style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }}
            />
          </View>
          <Label bold accessibilityRole="header" style={{ fontSize: 24, flexShrink: 1 }}>
            {title}
          </Label>
          <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 12 }}>{children}</ScrollView>
          <Button secondary title="סגירה" onPress={close} />
        </View>
      </View>
    </Modal>
  );
}
