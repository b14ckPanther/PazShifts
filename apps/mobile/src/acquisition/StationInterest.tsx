import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInput,
} from 'react-native';
import Animated, {
  FadeInDown,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Building2 from 'lucide-react-native/icons/building';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Clock3 from 'lucide-react-native/icons/clock-3';
import Users from 'lucide-react-native/icons/users';
import Check from 'lucide-react-native/icons/check';
import Plus from 'lucide-react-native/icons/plus';
import X from 'lucide-react-native/icons/x';
import {
  emptyInterest,
  validateStationInterest,
  type StationInterest as Interest,
  type InterestErrors,
} from '@yellowshifts/database/public';
import { Button, Field, Label, Message } from '../ui';
import { colors, fonts } from '../ui/theme';
import { sendStationInterest } from './api';
const roles = [
  { value: 'owner', label: 'בעלים' },
  { value: 'manager', label: 'מנהל/ת תחנה' },
  { value: 'operations', label: 'מנהל/ת תפעול' },
  { value: 'other', label: 'אחר' },
] as const;
const focus = (node: View | null) => {
  const handle = node && findNodeHandle(node);
  if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
};
const haptic = () => {
  void Haptics.selectionAsync().catch(() => {});
};
export function StationInterestEntry({
  send = sendStationInterest,
}: {
  send?: typeof sendStationInterest;
}) {
  const [open, setOpen] = useState(false),
    [success, setSuccess] = useState(false),
    [optional, setOptional] = useState(false),
    [value, setValue] = useState<Interest>({ ...emptyInterest }),
    [errors, setErrors] = useState<InterestErrors>({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submitting = useRef(false),
    requestId = useRef(''),
    trigger = useRef<View>(null),
    heading = useRef<View>(null),
    inputs = useRef<Partial<Record<keyof Interest, TextInput | null>>>({}),
    scroll = useRef<ScrollView>(null);
  const reduced = useReducedMotion(),
    insets = useSafeAreaInsets();
  const progress = useSharedValue(0),
    scale = useSharedValue(1);
  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 70 }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.46 }));
  const teaserStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => {
    if (!open) return;
    progress.value = reduced
      ? 1
      : withSpring(1, { damping: 25, stiffness: 240, overshootClamping: true });
    const timer = setTimeout(() => focus(heading.current), reduced ? 40 : 350);
    return () => clearTimeout(timer);
  }, [open, reduced, progress]);
  useEffect(() => {
    if (!success) return;
    scroll.current?.scrollTo({ y: 0, animated: false });
    const timer = setTimeout(() => focus(heading.current), 150);
    return () => clearTimeout(timer);
  }, [success]);
  function finishClose() {
    setOpen(false);
    if (success) {
      setSuccess(false);
      setValue({ ...emptyInterest });
      setOptional(false);
      requestId.current = '';
    }
    setTimeout(() => focus(trigger.current), 100);
  }
  function close() {
    if (submitting.current) return;
    Keyboard.dismiss();
    if (reduced) {
      progress.value = 0;
      finishClose();
    } else
      progress.value = withTiming(0, { duration: 160 }, (finished) => {
        if (finished) runOnJS(finishClose)();
      });
  }
  async function submit() {
    if (submitting.current) return;
    const parsed = validateStationInterest(value);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      const first = Object.keys(parsed.errors)[0] as keyof Interest;
      if (['email', 'role', 'notes'].includes(first) && !optional) {
        setOptional(true);
        setTimeout(() => inputs.current[first]?.focus(), 100);
      } else inputs.current[first]?.focus();
      AccessibilityInfo.announceForAccessibility('יש פרטים שצריך להשלים. בדקו את השדות המסומנים.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    setErrors({});
    Keyboard.dismiss();
    try {
      requestId.current ||= Crypto.randomUUID();
      await send(
        parsed.value,
        requestId.current,
        Platform.OS,
        Constants.expoConfig?.version || '1.0.0'
      );
      setSuccess(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setError(
        e instanceof Error && /לא אושרה|יותר מדי/.test(e.message)
          ? e.message
          : 'לא הצלחנו לשלוח. הפרטים נשמרו כאן, ואפשר לנסות שוב.'
      );
      AccessibilityInfo.announceForAccessibility('השליחה לא הושלמה. אפשר לנסות שוב.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  function field(key: keyof Interest, label: string, next?: keyof Interest) {
    const ltr = key === 'phone' || key === 'email';
    return (
      <View key={key} style={{ gap: 5 }}>
        <Field
          label={label}
          value={value[key]}
          inputRef={(node) => {
            inputs.current[key] = node;
          }}
          onChangeText={(text) => {
            setValue((v) => ({ ...v, [key]: text }));
            setErrors((e) => ({ ...e, [key]: undefined }));
          }}
          editable={!busy}
          maxLength={
            {
              full_name: 80,
              phone: 30,
              station_name_or_number: 120,
              city: 80,
              email: 254,
              notes: 1000,
              role: 20,
            }[key]
          }
          keyboardType={
            key === 'phone' ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'
          }
          autoComplete={
            key === 'full_name'
              ? 'name'
              : key === 'phone'
                ? 'tel'
                : key === 'email'
                  ? 'email'
                  : 'off'
          }
          autoCapitalize={ltr ? 'none' : 'sentences'}
          autoCorrect={!ltr}
          multiline={key === 'notes'}
          returnKeyType={next ? 'next' : 'done'}
          submitBehavior={next ? 'submit' : key === 'notes' ? 'newline' : 'blurAndSubmit'}
          onSubmitEditing={() => (next ? inputs.current[next]?.focus() : Keyboard.dismiss())}
          accessibilityHint={errors[key] || undefined}
          style={{
            fontFamily: fonts.he,
            writingDirection: ltr ? 'ltr' : 'rtl',
            textAlign: ltr ? 'left' : 'right',
            borderColor: errors[key] ? colors.crimson : colors.border,
          }}
        />
        {errors[key] && (
          <Label accessibilityLiveRegion="polite" style={{ color: colors.crimson, fontSize: 14 }}>
            {errors[key]}
          </Label>
        )}
      </View>
    );
  }
  return (
    <>
      <Animated.View style={teaserStyle}>
        <Pressable
          ref={trigger}
          accessibilityRole="button"
          accessibilityLabel="מנהלים תחנה? הכירו את YellowShifts לתחנה שלכם"
          accessibilityHint="פתיחת טופס התעניינות, ללא חשבון עובד"
          onPressIn={() => {
            scale.value = reduced ? 1 : withSpring(0.98);
          }}
          onPressOut={() => {
            scale.value = reduced ? 1 : withSpring(1);
          }}
          onPress={() => {
            Keyboard.dismiss();
            haptic();
            setOpen(true);
          }}
          style={({ pressed }) => [
            styles.teaser,
            { backgroundColor: pressed ? '#FFF8DE' : colors.surface },
          ]}
        >
          <View style={styles.tile}>
            <Building2 size={22} color={colors.text} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Label bold style={{ fontSize: 17 }}>
              התחנה שלכם. הצוות שלכם.
            </Label>
            <Label style={{ fontSize: 14, color: colors.secondary }}>
              מנהלים תחנה? הכירו דרך פשוטה יותר לעבוד יחד.
            </Label>
          </View>
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
      </Animated.View>
      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.text }, backdropStyle]}
          />
          <Pressable
            accessibilityLabel="סגירת הפנייה"
            accessibilityRole="button"
            disabled={busy}
            onPress={close}
            style={StyleSheet.absoluteFill}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{
              flex: 1,
              width: '100%',
              justifyContent: 'flex-end',
              paddingTop: Math.max(insets.top, 16),
            }}
            pointerEvents="box-none"
          >
            <Animated.View
              accessibilityViewIsModal
              onAccessibilityEscape={close}
              style={[styles.sheet, panelStyle, { paddingBottom: Math.max(insets.bottom, 16) }]}
            >
              <View style={styles.topbar}>
                <Label english bold style={{ fontSize: 14, letterSpacing: 0.3 }}>
                  YellowShifts
                </Label>
                <Pressable
                  onPress={close}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="סגירה וחזרה לכניסה"
                  accessibilityState={{ disabled: busy }}
                  style={styles.close}
                >
                  <X size={22} />
                </Pressable>
              </View>
              <ScrollView
                ref={scroll}
                style={{ flexGrow: 0, flexShrink: 1 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12, gap: 22 }}
              >
                {success ? (
                  <Animated.View
                    entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)}
                    style={{ gap: 22, paddingVertical: 30 }}
                  >
                    <View style={styles.successIcon}>
                      <Check size={38} color={colors.text} strokeWidth={2.5} />
                    </View>
                    <View ref={heading} accessible accessibilityRole="header" style={{ gap: 10 }}>
                      <Label bold style={styles.headline}>
                        הצעד הבא מתחיל כאן.
                      </Label>
                      <Label style={styles.description}>
                        קיבלנו את הפנייה. נחזור אליכם בהקדם כדי להכיר את התחנה ולבדוק יחד איך
                        YellowShifts יכולה להתאים לצוות שלכם.
                      </Label>
                    </View>
                    <View style={styles.reassurance}>
                      <Label style={{ fontSize: 14 }}>בלי התחייבות. שיחה קצרה, בקצב שלכם.</Label>
                    </View>
                    <Button secondary title="סגור" onPress={close} />
                  </Animated.View>
                ) : (
                  <>
                    <Animated.View
                      entering={FadeInDown.delay(60)
                        .duration(220)
                        .reduceMotion(ReduceMotion.System)}
                      style={{ gap: 12 }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 4,
                          backgroundColor: colors.yellow,
                          borderRadius: 2,
                        }}
                      />
                      <View
                        ref={heading}
                        accessible
                        accessibilityRole="header"
                        accessibilityLabel="יותר סדר בתחנה. יותר שקט לצוות."
                      >
                        <Label bold style={styles.headline}>
                          יותר סדר בתחנה.{'\n'}יותר שקט לצוות.
                        </Label>
                      </View>
                      <Label style={styles.description}>
                        משמרות, נוכחות והיום־יום של הצוות — במקום אחד, עם YellowShifts.
                      </Label>
                      <View style={styles.benefits}>
                        {[
                          { Icon: CalendarDays, title: 'משמרות מסודרות' },
                          { Icon: Clock3, title: 'נוכחות ברורה' },
                          { Icon: Users, title: 'צוות מעודכן' },
                        ].map(({ Icon, title }) => (
                          <View key={title} style={styles.benefit}>
                            <Icon size={18} color={colors.crimson} />
                            <Label style={{ fontSize: 13, flexShrink: 1 }}>{title}</Label>
                          </View>
                        ))}
                      </View>
                    </Animated.View>
                    <Animated.View
                      entering={FadeInDown.delay(110)
                        .duration(220)
                        .reduceMotion(ReduceMotion.System)}
                      style={{ gap: 16 }}
                    >
                      <View style={{ gap: 4 }}>
                        <Label bold style={{ fontSize: 20 }}>
                          נתחיל בהיכרות קצרה
                        </Label>
                        <Label style={{ fontSize: 14, color: colors.secondary }}>
                          ארבעה פרטים, ונוכל לחזור אליכם.
                        </Label>
                      </View>
                      {field('full_name', 'שם מלא', 'phone')}
                      {field('phone', 'טלפון נייד', 'station_name_or_number')}
                      {field('station_name_or_number', 'שם התחנה או מספר התחנה', 'city')}
                      {field('city', 'עיר / יישוב')}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded: optional, disabled: busy }}
                        disabled={busy}
                        onPress={() => {
                          haptic();
                          setOptional(!optional);
                        }}
                        style={styles.optional}
                      >
                        <Label bold style={{ fontSize: 14 }}>
                          עוד קצת עליכם (לא חובה)
                        </Label>
                        {optional ? <X size={18} /> : <Plus size={18} />}
                      </Pressable>
                      {optional && (
                        <View style={{ gap: 16 }}>
                          {field('email', 'אימייל (לא חובה)')}
                          <Label bold>התפקיד בתחנה (לא חובה)</Label>
                          <View style={styles.roles}>
                            {roles.map((role) => (
                              <Pressable
                                key={role.value}
                                accessibilityRole="radio"
                                accessibilityState={{
                                  checked: value.role === role.value,
                                  disabled: busy,
                                }}
                                disabled={busy}
                                onPress={() => {
                                  haptic();
                                  setValue((v) => ({
                                    ...v,
                                    role: v.role === role.value ? '' : role.value,
                                  }));
                                }}
                                style={[
                                  styles.role,
                                  value.role === role.value && {
                                    backgroundColor: colors.yellow,
                                    borderColor: colors.yellow,
                                  },
                                ]}
                              >
                                <Label style={{ fontSize: 14 }}>{role.label}</Label>
                              </Pressable>
                            ))}
                          </View>
                          {field('notes', 'משהו שחשוב שנדע? (לא חובה)')}
                        </View>
                      )}
                      {error ? <Message>{error}</Message> : null}
                      <Button
                        secondary
                        title={busy ? 'שולחים את הפנייה…' : 'בואו נדבר על התחנה שלכם'}
                        onPress={() => void submit()}
                        busy={busy}
                      />
                      <Label style={{ fontSize: 13, color: colors.secondary }}>
                        בשליחה אתם מבקשים שניצור איתכם קשר בנוגע ל־YellowShifts. אין צורך בחשבון
                        עובד ואין התחייבות.
                      </Label>
                      <Pressable
                        accessibilityRole="link"
                        onPress={() => {
                          void Linking.openURL('https://paz.darb.co.il/privacy/yellowshifts').catch(
                            () => setError('לא הצלחנו לפתוח את מדיניות הפרטיות. נסו שוב.')
                          );
                        }}
                        style={{ minHeight: 44, justifyContent: 'center' }}
                      >
                        <Label style={{ fontSize: 13, textDecorationLine: 'underline' }}>
                          איך אנחנו שומרים על הפרטים שלכם
                        </Label>
                      </Pressable>
                    </Animated.View>
                  </>
                )}
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  teaser: {
    direction: 'rtl',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#FFF5CD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: { flex: 1, justifyContent: 'flex-end', direction: 'rtl', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '94%',
    alignSelf: 'center',
    flexShrink: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 4,
  },
  close: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: colors.base,
  },
  headline: { fontSize: 30, lineHeight: 42 },
  description: { fontSize: 16, color: colors.secondary, lineHeight: 26 },
  benefits: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.base,
  },
  optional: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  role: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: colors.yellow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reassurance: { padding: 18, borderRadius: 18, backgroundColor: colors.base },
});
