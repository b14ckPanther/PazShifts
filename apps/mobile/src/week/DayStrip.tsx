import { useEffect } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Label } from '../ui';
import { colors } from '../ui/theme';
import { days, dateLabel } from './model';

/** Spacious visual dates inside full-size touch targets; Sunday stays on the right. */
export function DayStrip({
  week,
  day,
  today,
  counts,
  select,
}: {
  week: string;
  day: string;
  today: string;
  counts: Record<string, number>;
  select: (day: string) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const large = fontScale > 1.4;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -16, direction: 'rtl' }}
      contentContainerStyle={{
        flexDirection: 'row',
        direction: 'rtl',
        flexGrow: 1,
        paddingHorizontal: 4,
        paddingVertical: 8,
      }}
    >
      {days(week).map((date) => (
        <Day
          key={date}
          date={date}
          selected={date === day}
          today={date === today}
          count={counts[date] ?? 0}
          large={large ? fontScale : 1}
          select={() => select(date)}
        />
      ))}
    </ScrollView>
  );
}
function Day({
  date,
  selected,
  today,
  count,
  large,
  select,
}: {
  date: string;
  selected: boolean;
  today: boolean;
  count: number;
  large: number;
  select: () => void;
}) {
  const reduced = useReducedMotion();
  const lift = useSharedValue(selected ? -3 : 0);
  useEffect(() => {
    lift.value = withTiming(selected ? -3 : 0, { duration: reduced ? 0 : 180 });
  }, [selected, reduced, lift]);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  return (
    <Pressable
      onPress={select}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${count} משמרות${today ? ', היום' : ''}`}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: Math.ceil(44 * large),
        alignItems: 'center',
        gap: 10,
        paddingVertical: 6,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Label
        bold={selected}
        style={{ fontSize: 12, color: selected ? colors.text : colors.secondary }}
      >
        {['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'][new Date(date + 'T12:00:00Z').getUTCDay()]}
      </Label>
      <Animated.View
        style={[
          {
            width: Math.ceil(40 * large),
            minHeight: Math.ceil(44 * large),
            borderRadius: Math.ceil(24 * large),
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: selected ? colors.yellow : 'transparent',
            borderWidth: 1,
            borderColor: today && !selected ? colors.yellow : 'transparent',
          },
          motion,
        ]}
      >
        <Label english bold style={{ fontSize: 21, textAlign: 'center' }}>
          {Number(date.slice(-2))}
        </Label>
      </Animated.View>
      <View accessible={false} style={{ height: 6, flexDirection: 'row', gap: 3 }}>
        {Array.from({ length: Math.min(count, 3) }, (_, index) => (
          <View
            key={index}
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: selected ? colors.crimson : colors.secondary,
            }}
          />
        ))}
      </View>
    </Pressable>
  );
}
