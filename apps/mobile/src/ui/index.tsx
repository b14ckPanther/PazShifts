import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextProps,
  type TextInputProps,
  type ViewStyle,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, fonts } from './theme';
export function Label({
  style,
  english = false,
  bold = false,
  ...props
}: TextProps & { english?: boolean; bold?: boolean }) {
  const fontSize = StyleSheet.flatten(style)?.fontSize ?? 16;
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: english ? (bold ? fonts.enBold : fonts.en) : bold ? fonts.heBold : fonts.he,
          fontSize: 16,
          lineHeight: english ? Math.ceil(fontSize * 1.3) : undefined,
          color: colors.text,
          textAlign: 'auto',
          writingDirection: english ? 'ltr' : 'rtl',
        },
        style,
      ]}
    />
  );
}
export function Screen({
  children,
  tabbed = false,
  footer,
  refreshControl,
}: {
  children: ReactNode;
  tabbed?: boolean;
  footer?: ReactNode;
  refreshControl?: ScrollViewProps['refreshControl'];
}) {
  return (
    <SafeAreaView
      edges={tabbed ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
      style={{ flex: 1, backgroundColor: colors.base }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{
            flexGrow: 1,
            padding: 24,
            gap: 24,
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
          }}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
      {footer}
    </SafeAreaView>
  );
}
export function Surface({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.surface, style]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  busy = false,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1),
    reduced = useReducedMotion();
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={motion}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || busy, busy }}
        disabled={disabled || busy}
        onPressIn={() => {
          scale.value = reduced ? 1 : withSpring(0.98);
        }}
        onPressOut={() => {
          scale.value = reduced ? 1 : withSpring(1);
        }}
        onPress={() => {
          void Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        style={[
          styles.button,
          {
            backgroundColor: secondary ? colors.cream : colors.crimson,
            opacity: disabled || busy ? 0.65 : 1,
          },
        ]}
      >
        {busy && <ActivityIndicator color={secondary ? colors.text : colors.surface} />}
        <Label
          bold
          style={{
            color: secondary ? colors.text : colors.surface,
            textAlign: 'center',
            flexShrink: 1,
          }}
        >
          {title}
        </Label>
      </Pressable>
    </Animated.View>
  );
}
export function Field({
  label,
  inputRef,
  ...props
}: TextInputProps & { label: string; inputRef?: React.Ref<TextInput> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Label bold>{label}</Label>
      <TextInput
        ref={inputRef}
        {...props}
        accessibilityLabel={label}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        placeholderTextColor={colors.secondary}
        style={[
          styles.input,
          {
            borderColor: focused ? colors.yellow : colors.border,
            backgroundColor: focused ? colors.cream : colors.base,
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Message({ children }: { children: ReactNode }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ padding: 16, borderRadius: 16, backgroundColor: '#FFF0F3' }}
    >
      <Label style={{ color: colors.danger }}>{children}</Label>
    </View>
  );
}
export function Skeleton() {
  return (
    <View accessible accessibilityLabel="טוען את החשבון" style={{ gap: 16 }}>
      {[0.6, 1, 0.85].map((width, i) => (
        <View
          key={i}
          style={{
            height: i === 1 ? 100 : 20,
            width: `${width * 100}%`,
            alignSelf: 'flex-end',
            borderRadius: 16,
            backgroundColor: colors.border,
          }}
        />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  surface: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 24,
    gap: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    minHeight: 56,
    padding: 16,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.en,
    fontSize: 18,
    color: colors.text,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
});
