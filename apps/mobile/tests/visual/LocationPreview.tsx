import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Worker } from '../../src/home/WorkerProvider';
import { LocationPreferences, LocationApi } from '../../src/location/UI';
import { Screen, Button } from '../../src/ui';
import type { Preferences } from '../../src/location/model';
export default function LocationPreview() {
  const [width, setWidth] = useState(320),
    [mode, setMode] = useState('off'),
    [prefs, setPrefs] = useState<Preferences>({ arrival: false, exit: false });
  const states = ['off', 'ready', 'background', 'precise', 'notifications'];
  return (
    <Worker.Provider
      value={{
        context: { userId: 'fixture', fullName: 'בדיקה', email: null, phone: null, stations: [] },
        station: undefined,
        data: null,
        error: false,
        loading: false,
        select: () => {},
        openStation: (_, a) => a(),
        proceed: (a) => a(),
        refresh: () => {},
        setGuard: () => {},
      }}
    >
      <LocationApi.Provider
        value={{
          getPreferences: async () => prefs,
          savePreferences: async (_, p) => setPrefs(p),
          permissionState: async () => (mode === 'off' ? 'foreground' : mode),
          reconcileWorkerGeofences: async () => {},
        }}
      >
        <View style={{ flex: 1, paddingTop: 60, alignItems: 'center', backgroundColor: '#ececec' }}>
          <ScrollView horizontal style={{ maxHeight: 65 }}>
            <Button
              title={String(width)}
              onPress={() => setWidth(width === 320 ? 390 : width === 390 ? 430 : 320)}
            />
            <Button
              title={mode}
              onPress={() => {
                const next = states[(states.indexOf(mode) + 1) % states.length];
                setMode(next);
                setPrefs({ arrival: next !== 'off', exit: next !== 'off' });
              }}
            />
          </ScrollView>
          <View style={{ width, flex: 1 }}>
            <Screen>
              <LocationPreferences key={mode} />
            </Screen>
          </View>
        </View>
      </LocationApi.Provider>
    </Worker.Provider>
  );
}
