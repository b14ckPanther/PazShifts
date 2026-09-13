import { useMemo, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { AttendanceContent as Attendance, NfcApi } from '../../app/attendance';
import { AuthContext } from '../../src/auth/SessionProvider';
import { Label } from '../../src/ui';
import type { NfcScanResult } from '@yellowshifts/types';
export default function NfcPreview() {
  const [width, setWidth] = useState(320),
    [scenario, setScenario] = useState('entry');
  const api = useMemo(() => {
    const clock_in_at = new Date(Date.now() - 13 * 3600000).toISOString();
    const record = { id: 'fixture-record', station_id: 'fixture', clock_in_at, status: 'ACTIVE' };
    const result = { success: true, action: 'CLOCK_IN', record } as NfcScanResult;
    return {
      read: async () => ({
        token: '0123456789abcdef',
        scanId: '00000000-0000-4000-8000-000000000001',
        at: Date.now(),
        userId: 'fixture-user',
      }),
      save: async () => {},
      clear: async () => {},
      location: async () => ({ latitude: 0, longitude: 0, accuracy: 1, timestamp: Date.now() }),
      context: async () => ({
        station: {
          id: 'fixture',
          name: 'תחנת בדיקה — קריית אתא',
          code: 'FIXTURE',
          address: null,
          timezone: 'Asia/Jerusalem',
          is_active: true,
        },
        active: scenario === 'exit' ? record : null,
        leftOpenHours: 12,
        receipt: scenario === 'success' ? result : null,
      }),
      submit: async () => {
        await new Promise((r) => setTimeout(r, 800));
        if (scenario === 'error') throw Error('NETWORK_ERROR');
        return result;
      },
    } as React.ContextType<typeof NfcApi>;
  }, [scenario]);
  return (
    <AuthContext.Provider
      value={{
        state: {
          phase: 'ready',
          error: null,
          context: {
            userId: 'fixture-user',
            fullName: 'בדיקה',
            email: 'fixture@example.test',
            phone: null,
            stations: [],
          },
        },
        retry: () => {},
        logout: async () => {},
      }}
    >
      <View style={{ flex: 1, alignItems: 'center', paddingTop: 55 }}>
        <ScrollView horizontal style={{ flexGrow: 0, maxHeight: 46 }}>
          {[320, 390, 430].map((w) => (
            <Pressable key={w} onPress={() => setWidth(w)} style={{ padding: 8 }}>
              <Label>{w}</Label>
            </Pressable>
          ))}
          {['entry', 'exit', 'success', 'error'].map((s) => (
            <Pressable key={s} onPress={() => setScenario(s)} style={{ padding: 8 }}>
              <Label>{s}</Label>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ width, flex: 1 }}>
          <NfcApi.Provider value={api}>
            <Attendance key={scenario} />
          </NfcApi.Provider>
        </View>
      </View>
    </AuthContext.Provider>
  );
}
