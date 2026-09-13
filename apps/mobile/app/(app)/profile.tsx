import { LocationPreferences } from '../../src/location/UI';
import { router } from 'expo-router';
import { View } from 'react-native';
import Constants from 'expo-constants';
import { Screen, Label, Surface, Button } from '../../src/ui';
import { AppHeader, roleName } from '../../src/home/Patterns';
import { useWorker } from '../../src/home/WorkerProvider';
import { useSession } from '../../src/auth/SessionProvider';
export default function Profile() {
  const { context, station } = useWorker();
  const { logout } = useSession();
  return (
    <Screen tabbed>
      <AppHeader />
      <Label accessibilityRole="header" bold style={{ fontSize: 30 }}>
        הפרופיל שלי
      </Label>
      <Surface>
        <Label bold style={{ fontSize: 24 }}>
          {context.fullName}
        </Label>
        {context.email && (
          <Label english selectable>
            {context.email}
          </Label>
        )}
        {context.phone && (
          <Label english selectable>
            {context.phone}
          </Label>
        )}
        <Label>{station ? roleName(station.role) : 'ללא תחנה פעילה'}</Label>
      </Surface>
      <View style={{ gap: 16 }}>
        <Label bold>התחנות שלי</Label>
        {context.stations.map((s) => (
          <View key={s.id} style={{ gap: 4 }}>
            <Label bold>{s.name}</Label>
            <Label>{roleName(s.role)}</Label>
          </View>
        ))}
      </View>
      <Button secondary title="העדכונים וההתראות שלך" onPress={() => router.push('/inbox')} />
      <LocationPreferences key={context.userId} />
      <Label english style={{ fontSize: 12 }}>
        YellowShifts · {Constants.expoConfig?.version ?? '1.0.0'}
      </Label>
      <Button secondary title="התנתקות מהחשבון" onPress={() => void logout()} />
    </Screen>
  );
}
