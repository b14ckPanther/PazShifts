import { useEffect, useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import { useSession } from '../../src/auth/SessionProvider';
import { Button, Label, Message, Screen, Skeleton } from '../../src/ui';
import { WorkerProvider } from '../../src/home/WorkerProvider';
import { Onboarding } from '../../src/home/Onboarding';
import { onboardingDone, onboardingKey, tabs } from '../../src/home/model';
import { TabBar } from '../../src/home/TabBar';
export default function Shell() {
  const { state, retry, logout } = useSession();
  const reducedMotion = useReducedMotion();
  const [intro, setIntro] = useState<boolean | null>(null),
    [failed, setFailed] = useState(false);
  const load = () => {
    setFailed(false);
    void SecureStore.getItemAsync(onboardingKey)
      .then((value) => setIntro(onboardingDone(value)))
      .catch(() => setFailed(true));
  };
  useEffect(load, []);
  if (state.phase === 'signedOut') return <Redirect href="/login" />;
  if (state.phase === 'error')
    return (
      <Screen>
        <Message>{state.error}</Message>
        <Button title="ניסיון נוסף" onPress={retry} />
        <Button secondary title="התנתקות" onPress={() => void logout()} />
      </Screen>
    );
  if (failed)
    return (
      <Screen>
        <Label>לא הצלחנו לפתוח את החשבון</Label>
        <Button title="ניסיון נוסף" onPress={load} />
      </Screen>
    );
  if (state.phase !== 'ready' || !state.context || intro === null)
    return (
      <Screen>
        <Skeleton />
      </Screen>
    );
  if (!intro) return <Onboarding done={() => setIntro(true)} />;
  return (
    <WorkerProvider key={state.context.userId} context={state.context}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerShown: false,
          animation: reducedMotion ? 'none' : 'fade',
          sceneStyle: { backgroundColor: '#F6F6F6' },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
        ))}
      </Tabs>
    </WorkerProvider>
  );
}
