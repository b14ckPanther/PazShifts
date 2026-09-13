import { useRef, useState } from 'react';
import {
  Image,
  InputAccessoryView,
  Platform,
  Keyboard,
  Linking,
  Pressable,
  type TextInput,
  View,
} from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import ArrowUpLeft from 'lucide-react-native/icons/arrow-up-left';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Mail from 'lucide-react-native/icons/mail';
import Phone from 'lucide-react-native/icons/phone';
import * as Haptics from 'expo-haptics';
import { passwordCredentials } from '@yellowshifts/database/public';
import { supabase, configured } from '../../src/lib/supabase';
import { useSession } from '../../src/auth/SessionProvider';
import { safeReturnPath } from '../../src/auth/return-path';
import { Button, Field, Label, Message, Screen, Skeleton, Surface } from '../../src/ui';
import logomark from '../../assets/logomark.png';
import { colors } from '../../src/ui/theme';
export default function Login() {
  const { state } = useSession();
  const params = useLocalSearchParams();
  const [mode, setMode] = useState<'phone' | 'email'>('phone'),
    [identifier, setIdentifier] = useState(''),
    [password, setPassword] = useState(''),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const passwordRef = useRef<TextInput>(null),
    identifierRef = useRef<TextInput>(null),
    submitting = useRef(false);
  if (state.phase === 'error') return <Redirect href="/" />;
  if (state.phase === 'ready') return <Redirect href={safeReturnPath(params.next)} />;
  const submit = async () => {
    if (submitting.current || !supabase) return;
    const credentials = passwordCredentials(identifier, password);
    if (!credentials || !password || (mode === 'email') !== 'email' in credentials) {
      setError('בדקו את פרטי ההתחברות והזינו סיסמה.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    Keyboard.dismiss();
    try {
      const { error } = await supabase.auth.signInWithPassword(credentials);
      if (error) throw error;
      setPassword('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      setError('לא הצלחנו להתחבר. בדקו את הפרטים ואת החיבור ונסו שוב.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <Screen>
      <View style={{ gap: 12, paddingTop: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={logomark} style={{ width: 48, height: 48 }} resizeMode="contain" />
          <Label
            english
            bold
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontSize: 24, flexShrink: 1 }}
          >
            YellowShifts
          </Label>
        </View>
        <Label bold style={{ fontSize: 38, lineHeight: 52, marginTop: 16 }}>
          טוב שחזרת.
        </Label>
        <Label style={{ fontSize: 18, color: colors.secondary }}>היום שלך מתחיל כאן.</Label>
      </View>
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="login-next">
          <View
            style={{
              backgroundColor: colors.surface,
              paddingHorizontal: 24,
              alignItems: 'flex-end',
            }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => passwordRef.current?.focus()}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Label bold>הבא</Label>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
      <Surface>
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            backgroundColor: colors.base,
            borderRadius: 18,
            padding: 5,
            gap: 6,
          }}
        >
          {(['phone', 'email'] as const).map((item) => {
            const Icon = item === 'phone' ? Phone : Mail;
            return (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === item, disabled: busy }}
                disabled={busy}
                onPress={() => {
                  setMode(item);
                  setIdentifier('');
                  setError('');
                  void Haptics.selectionAsync().catch(() => {});
                  identifierRef.current?.focus();
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 48,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 14,
                  backgroundColor: mode === item ? colors.cream : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Icon size={18} color={colors.text} />
                <Label bold>{item === 'phone' ? 'טלפון' : 'אימייל'}</Label>
              </Pressable>
            );
          })}
        </View>
        {state.phase === 'loading' && !busy ? (
          <Skeleton />
        ) : (
          <>
            <Field
              inputRef={identifierRef}
              label={mode === 'phone' ? 'מספר הטלפון שלך' : 'כתובת האימייל שלך'}
              value={identifier}
              onChangeText={setIdentifier}
              editable={!busy}
              inputAccessoryViewID={Platform.OS === 'ios' ? 'login-next' : undefined}
              keyboardType={mode === 'phone' ? 'phone-pad' : 'email-address'}
              autoComplete={mode === 'phone' ? 'tel' : 'email'}
              textContentType={mode === 'phone' ? 'telephoneNumber' : 'emailAddress'}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder={mode === 'phone' ? '050 000 0000' : 'name@example.com'}
            />
            <View style={{ gap: 8 }}>
              <Field
                inputRef={passwordRef}
                label="סיסמה"
                value={password}
                onChangeText={setPassword}
                editable={!busy}
                secureTextEntry={!visible}
                autoComplete="current-password"
                textContentType="password"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={visible ? 'הסתרת סיסמה' : 'הצגת סיסמה'}
                onPress={() => setVisible(!visible)}
                hitSlop={8}
                style={{
                  minHeight: 44,
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                <Label style={{ fontSize: 14 }}>{visible ? 'הסתרת סיסמה' : 'הצגת סיסמה'}</Label>
              </Pressable>
            </View>
            {!configured && <Message>יש להגדיר את חיבור האפליקציה לפני ההתחברות.</Message>}
            {error && <Message>{error}</Message>}
            <Button
              title={busy ? 'מתחברים…' : 'כניסה לחשבון'}
              busy={busy}
              disabled={!configured}
              onPress={() => void submit()}
            />
          </>
        )}
        <LinearGradient
          colors={[colors.surface, colors.cream]}
          style={{ borderRadius: 16, padding: 16 }}
        >
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Nour — Darb, פתיחת אתר"
            onPress={() => {
              void Linking.openURL('https://darb.co.il/he').catch(() =>
                setError('לא ניתן לפתוח את הקישור כעת.')
              );
            }}
            style={{
              minHeight: 44,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ gap: 4 }}>
              <Label english bold>
                Nour — Darb
              </Label>
              <Label style={{ fontSize: 11, color: colors.secondary }}>כל הזכויות שמורות</Label>
            </View>
            <ArrowUpLeft size={22} color={colors.deep} />
          </Pressable>
        </LinearGradient>
      </Surface>
    </Screen>
  );
}
