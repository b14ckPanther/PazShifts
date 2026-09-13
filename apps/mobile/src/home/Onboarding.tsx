import { useState } from 'react';
import { Image, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import { Button, Label, Screen, Message } from '../ui';
import { colors } from '../ui/theme';
import mark from '../../assets/logomark.png';
import { onboardingKey } from './model';
export function Onboarding({ done }: { done: () => void }) {
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  async function finish() {
    setBusy(true);
    setError(false);
    try {
      await SecureStore.setItemAsync(onboardingKey, 'complete');
      done();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'space-between', gap: 32, paddingVertical: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={mark} style={{ width: 44, height: 44 }} />
          <Label english bold numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1 }}>
            YellowShifts
          </Label>
        </View>
        <Animated.View
          key={step}
          entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
          style={{ gap: 24 }}
        >
          <View
            accessible={false}
            style={{
              height: 160,
              justifyContent: 'center',
              padding: 24,
              backgroundColor: colors.yellow,
              borderRadius: 24,
            }}
          >
            <Image
              source={mark}
              style={{ width: 64, height: 64, alignSelf: 'center' }}
              resizeMode="contain"
            />
            <View
              style={{
                height: 4,
                width: step === 0 ? '40%' : '80%',
                backgroundColor: colors.yellow,
                marginTop: 16,
              }}
            />
          </View>
          <Label bold style={{ fontSize: 32 }}>
            {step === 0 ? 'המשמרת שלך, בפשטות' : 'אתם בשליטה'}
          </Label>
          <Label style={{ fontSize: 19, lineHeight: 30 }}>
            {step === 0
              ? 'משמרות, זמינות ושעות עבודה — במקום אחד. כל מה שחשוב ליום שלך, במבט אחד.'
              : 'המידע שלך מוצג בחשבון שלך. בהמשך ניתן יהיה לבחור תזכורות — הרשאות מיקום והתראות יישארו לבחירתך.'}
          </Label>
        </Animated.View>
        <View style={{ gap: 12 }}>
          {error && <Message>לא הצלחנו לשמור. נסו שוב.</Message>}
          <Label english style={{ textAlign: 'center', color: colors.secondary }}>
            {step + 1} / 2
          </Label>
          <Button
            busy={busy}
            title={step === 0 ? 'נעים להכיר' : 'בואו נתחיל'}
            onPress={() => (step === 0 ? setStep(1) : void finish())}
          />
          {step === 0 && (
            <Button secondary busy={busy} title="ישר לחשבון שלי" onPress={() => void finish()} />
          )}
        </View>
      </View>
    </Screen>
  );
}
