import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Stack } from 'expo-router';
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
import { SessionProvider } from '../src/auth/SessionProvider';
void SplashScreen.preventAutoHideAsync().catch(() => {});
export default function Root() {
  const [loaded, error] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_700Bold,
    Ubuntu_400Regular,
    Ubuntu_700Bold,
  });
  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);
  if (error) throw error;
  if (!loaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F6F6F6' } }}
          />
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** A quiet recovery screen; never show raw server errors or identifiers. */
export function ErrorBoundary({ retry }: { retry: () => Promise<void> }) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: 32,
        backgroundColor: '#FFF7CC',
        gap: 24,
      }}
    >
      <Text style={{ fontSize: 24, textAlign: 'right', color: '#000000' }}>
        לא הצלחנו לפתוח את האפליקציה
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={{ padding: 18, borderRadius: 18, backgroundColor: '#D10040' }}
      >
        <Text style={{ textAlign: 'center', color: '#FFFFFF', fontSize: 18 }}>ניסיון נוסף</Text>
      </Pressable>
    </View>
  );
}
