import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Home from 'lucide-react-native/icons/house';
import Calendar from 'lucide-react-native/icons/calendar-days';
import Check from 'lucide-react-native/icons/calendar-check';
import Clock from 'lucide-react-native/icons/clock-3';
import User from 'lucide-react-native/icons/user-round';
import { Label } from '../ui';
import { colors } from '../ui/theme';
import { tabs } from './model';
const icons = [Home, Calendar, Check, Clock, User];
type Props = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
};
export function TabBar({ state, navigation }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingHorizontal: 8,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      {tabs.map((tab, i) => {
        const route = state.routes.find((r) => r.name === tab.name);
        if (!route) return null;
        const active = state.routes[state.index]?.key === route.key;
        const Icon = icons[i]!;
        return (
          <Pressable
            key={tab.name}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!active && !event.defaultPrevented) {
                void Haptics.selectionAsync().catch(() => {});
                navigation.navigate(tab.name);
              }
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 56,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              borderRadius: 16,
              backgroundColor: active ? colors.cream : 'transparent',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon
              size={22}
              color={active ? colors.text : colors.secondary}
              strokeWidth={active ? 2.2 : 1.7}
            />
            <Label bold={active} style={{ fontSize: 11, textAlign: 'center' }}>
              {tab.label}
            </Label>
          </Pressable>
        );
      })}
    </View>
  );
}
