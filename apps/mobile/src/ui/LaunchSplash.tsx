import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from './theme';
import mark from '../../assets/logomark.png';

/** The OS launch screen stays static; this matching overlay animates the handoff once. */
export function LaunchSplash({ onDone }: { onDone: () => void }) {
  const [laidOut, setLaidOut] = useState(false);
  const reduced = useReducedMotion();
  const turn = useSharedValue(0),
    scale = useSharedValue(1),
    opacity = useSharedValue(1);
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 700 }, { rotateY: `${turn.value}deg` }, { scale: scale.value }],
  }));
  const coverStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  useEffect(() => {
    if (!laidOut) return;
    // The matching logo has laid out before we release the native splash.
    void SplashScreen.hideAsync().catch(() => {});
    if (reduced) {
      opacity.value = withTiming(0, { duration: 120 });
    } else {
      turn.value = withTiming(360, { duration: 620, easing: Easing.inOut(Easing.cubic) });
      scale.value = withSequence(
        withTiming(1.16, { duration: 180, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 440, easing: Easing.out(Easing.cubic) })
      );
      opacity.value = withDelay(660, withTiming(0, { duration: 160 }));
    }
    // Navigation never depends on a worklet completion callback or on network readiness.
    const timer = setTimeout(onDone, reduced ? 160 : 840);
    return () => {
      clearTimeout(timer);
      cancelAnimation(turn);
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [laidOut, reduced, onDone, turn, scale, opacity]);
  return (
    <Animated.View
      onLayout={() => setLaidOut(true)}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="פותחים את YellowShifts"
      accessibilityState={{ busy: true }}
      style={[styles.cover, coverStyle]}
    >
      <Animated.Image source={mark} resizeMode="contain" style={[styles.logo, logoStyle]} />
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 96, height: 96 },
});
