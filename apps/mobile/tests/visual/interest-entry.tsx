import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_700Bold,
} from '@expo-google-fonts/heebo';
import { Ubuntu_400Regular, Ubuntu_700Bold } from '@expo-google-fonts/ubuntu';
import Preview from './StationInterestPreview';
function App() {
  const [loaded] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_700Bold,
    Ubuntu_400Regular,
    Ubuntu_700Bold,
  });
  return loaded ? (
    <SafeAreaProvider>
      <Preview />
    </SafeAreaProvider>
  ) : null;
}
registerRootComponent(App);
