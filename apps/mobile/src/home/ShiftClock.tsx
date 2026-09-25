import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { duration } from '@yellowshifts/reports';
import { Label } from '../ui';
import { colors } from '../ui/theme';

// Always derive elapsed time from the recorded instant, never accumulated ticks.
export function useElapsed(start: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
      if (AppState.currentState === 'active') {
        setNow(Date.now());
        timer = setInterval(() => setNow(Date.now()), 1000);
      }
    };
    sync();
    const subscription = AppState.addEventListener('change', sync);
    return () => {
      if (timer) clearInterval(timer);
      subscription.remove();
    };
  }, [start]);
  return Math.max(0, Math.floor((now - Date.parse(start)) / 1000));
}

function ClockUnit({
  value,
  label,
  seconds = false,
}: {
  value: string;
  label: string;
  seconds?: boolean;
}) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    turn.value = -24;
    turn.value = withTiming(0, { duration: 220 });
  }, [value, reduced, turn]);
  const motion = useAnimatedStyle(() => ({
    transform: [{ perspective: 500 }, { rotateX: `${turn.value}deg` }],
  }));
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 8, alignItems: 'center' }}>
      <View
        style={{
          alignSelf: 'stretch',
          paddingVertical: 12,
          paddingHorizontal: 4,
          borderRadius: 18,
          backgroundColor: seconds ? colors.crimson : '#FFFFFFD9',
          borderWidth: 1,
          borderColor: seconds ? colors.crimson : '#FFFFFF',
          overflow: 'hidden',
        }}
      >
        <Animated.View style={motion}>
          <Label
            english
            bold
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.45}
            style={{
              fontSize: seconds ? 36 : 44,
              lineHeight: 58,
              textAlign: 'center',
              color: seconds ? colors.surface : colors.text,
              fontVariant: ['tabular-nums'],
            }}
          >
            {value}
          </Label>
        </Animated.View>
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            height: 1,
            backgroundColor: seconds ? '#FFFFFF1A' : '#00000008',
          }}
        />
      </View>
      <Label style={{ fontSize: 12, textAlign: 'center' }}>{label}</Label>
    </View>
  );
}

export function Elapsed({ start, featured = false }: { start: string; featured?: boolean }) {
  const elapsed = useElapsed(start);
  const formatted = duration(elapsed);
  const [hours, minutes, seconds] = formatted.split(':');
  const accessible = `משך המשמרת: ${Math.floor(elapsed / 3600)} שעות, ${Math.floor(elapsed / 60) % 60} דקות ו-${elapsed % 60} שניות`;
  if (!featured)
    return (
      <Label
        english
        bold
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        accessibilityLabel={accessible}
        style={{ fontSize: 44, fontVariant: ['tabular-nums'] }}
      >
        {formatted}
      </Label>
    );
  return (
    <View
      accessible
      accessibilityLabel={accessible}
      accessibilityLiveRegion="none"
      style={{ gap: 18 }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ gap: 18 }}
      >
        <View style={{ flexDirection: 'row', direction: 'ltr', gap: 8, alignItems: 'flex-start' }}>
          <ClockUnit value={hours} label="שעות" />
          <ClockUnit value={minutes} label="דקות" />
          <ClockUnit value={seconds} label="שניות" seconds />
        </View>
        <View
          style={{
            flexDirection: 'row',
            direction: 'ltr',
            gap: 3,
            height: 12,
            alignItems: 'center',
          }}
        >
          {Array.from({ length: 30 }, (_, index) => (
            <View
              key={index}
              style={{
                flex: 1,
                height: index % 5 === 0 ? 12 : 6,
                borderRadius: 2,
                backgroundColor:
                  index === Math.floor((elapsed % 60) / 2) ? colors.crimson : '#00000026',
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
