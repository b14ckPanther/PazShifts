import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../../src/auth/SessionProvider';
import { Button, Label, Message, Screen, Skeleton, Surface } from '../../src/ui';
export default function Foundation() {
  const { state, retry, logout } = useSession();
  if (state.phase === 'signedOut') return <Redirect href="/login" />;
  return (
    <Screen>
      <Label english bold style={{ fontSize: 24 }}>
        YellowShifts
      </Label>
      <Surface>
        {state.phase === 'loading' ? (
          <Skeleton />
        ) : state.phase === 'error' ? (
          <>
            <Message>{state.error}</Message>
            <Button title="ניסיון נוסף" onPress={retry} />
            <Button secondary title="התנתקות" onPress={() => void logout()} />
          </>
        ) : (
          <>
            <Label bold style={{ fontSize: 30 }}>
              שלום, {state.context?.fullName}
            </Label>
            <Label>החשבון שלך מחובר</Label>
            <View style={{ gap: 12 }}>
              {state.context?.stations.map((station) => (
                <View key={station.id}>
                  <Label bold>{station.name}</Label>
                  <Label english>{station.code}</Label>
                </View>
              ))}
            </View>
            {!state.context?.stations.length && (
              <Label>אין כרגע שיוך לתחנה פעילה. פנו למנהל התחנה.</Label>
            )}
            <Button secondary title="התנתקות" onPress={() => void logout()} />
          </>
        )}
      </Surface>
    </Screen>
  );
}
