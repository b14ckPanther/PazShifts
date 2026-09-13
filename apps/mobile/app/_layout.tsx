import '../src/location/backgroundTasks';
import { NotificationProvider } from '../src/notifications/Provider';
import 'react-native-gesture-handler';
import { useCallback, useEffect, useState } from 'react';
import { Text, Pressable, ScrollView, View } from 'react-native';
import { LocaleProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Heebo_400Regular } from '@expo-google-fonts/heebo/400Regular';
import { Heebo_500Medium } from '@expo-google-fonts/heebo/500Medium';
import { Heebo_700Bold } from '@expo-google-fonts/heebo/700Bold';
import { Ubuntu_400Regular } from '@expo-google-fonts/ubuntu/400Regular';
import { Ubuntu_700Bold } from '@expo-google-fonts/ubuntu/700Bold';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LaunchSplash } from '../src/ui/LaunchSplash';
import { SessionProvider } from '../src/auth/SessionProvider';
void SplashScreen.preventAutoHideAsync().catch(() => {});
export default function Root() {
  const [launching, setLaunching] = useState(true);
  const finishLaunch = useCallback(() => setLaunching(false), []);
  const [loaded, error] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_700Bold,
    Ubuntu_400Regular,
    Ubuntu_700Bold,
  });
  useEffect(() => {
    if (error) void SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);
  if (error) throw error;
  if (!loaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1, direction: 'rtl' }}>
      <LocaleProvider direction="rtl">
        <SafeAreaProvider>
          <SessionProvider>
            <NotificationProvider>
              <StatusBar style="dark" />
              <View
                style={{ flex: 1 }}
                accessibilityElementsHidden={launching}
                importantForAccessibility={launching ? 'no-hide-descendants' : 'auto'}
              >
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: '#F6F6F6' },
                  }}
                />
              </View>
            </NotificationProvider>
          </SessionProvider>
          {launching && <LaunchSplash onDone={finishLaunch} />}
        </SafeAreaProvider>
      </LocaleProvider>
    </GestureHandlerRootView>
  );
}

/** A quiet recovery screen; never show raw server errors or identifiers. */
export function ErrorBoundary({ retry }: { retry: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  // The font-loading render can fail before Root's effects commit.
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        padding: 32,
        paddingTop: 64,
        gap: 24,
        backgroundColor: '#F6F6F6',
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ fontSize: 24, textAlign: 'right', color: '#000000' }}
      >
        לא הצלחנו לפתוח את האפליקציה
      </Text>
      <Text style={{ fontSize: 16, textAlign: 'right' }}>
        הדיווחים שכבר אושרו נשמרו. ניתן לנסות לפתוח שוב את המסך.
      </Text>
      {failed && (
        <Text accessibilityRole="alert" style={{ textAlign: 'right' }}>
          הפתיחה לא הושלמה. סגרו ופתחו שוב את האפליקציה.
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: pending, busy: pending }}
        disabled={pending}
        onPress={() => {
          setPending(true);
          setFailed(false);
          void retry()
            .catch(() => setFailed(true))
            .finally(() => setPending(false));
        }}
        style={{
          padding: 18,
          borderRadius: 18,
          backgroundColor: '#D10040',
          opacity: pending ? 0.6 : 1,
        }}
      >
        <Text style={{ textAlign: 'center', color: '#FFFFFF', fontSize: 18 }}>
          {pending ? 'פותחים…' : 'ניסיון נוסף'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
