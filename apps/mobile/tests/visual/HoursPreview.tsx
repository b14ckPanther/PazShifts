import { useCallback, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { addDays, classifiedEntries, dayBoundary } from '@yellowshifts/reports';
import type { AttendanceRecord } from '@yellowshifts/types';
import { hoursRange, type getMobileWorkerHours } from '@yellowshifts/database/public';
import { HoursContent, HoursApi } from '../../src/hours/Hours';
import { Worker } from '../../src/home/WorkerProvider';
import { Label } from '../../src/ui';
const station = {
  id: 'fixture-station',
  membershipId: 'fixture-member',
  timezone: 'Asia/Jerusalem',
  name: 'תחנת בדיקה',
  code: 'fixture',
  role: 'WORKER',
};
export default function HoursPreview() {
  const [longRange, setLongRange] = useState(false);
  const [width, setWidth] = useState(320),
    [scenario, setScenario] = useState('mixed');
  const api = useCallback<typeof getMobileWorkerHours>(
    async (_client, stationId, period) => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (scenario === 'error') throw Error('isolated offline fixture');
      const today = '2026-09-13';
      const { from, to } = hoursRange(period, today);
      const records: AttendanceRecord[] = [];
      if (scenario !== 'empty')
        for (let date = from, i = 0; date <= to && date < today; date = addDays(date, 1), i++) {
          if (scenario === 'sparse' && i % 7 !== 0) continue;
          const start =
            dayBoundary(date, station.timezone) + (scenario === 'overnight' ? 22 : 7) * 3600000;
          records.push({
            id: `fixture-${i}`,
            user_id: 'fixture-worker',
            station_membership_id: station.membershipId,
            clock_in_at: new Date(start).toISOString(),
            clock_out_at: new Date(
              start + (scenario === 'regular' ? 7 : scenario === 'overnight' ? 8 : 12) * 3600000
            ).toISOString(),
            status: 'COMPLETED',
            corrected_at: i === 0 ? new Date(start).toISOString() : null,
            correction_reason: i === 0 ? 'עודכנה שעת הכניסה לבקשת העובד' : null,
          } as AttendanceRecord);
          if (i === 0 && scenario === 'mixed')
            records.push({
              ...records[0]!,
              id: 'fixture-second',
              clock_in_at: new Date(start + 13 * 3600000).toISOString(),
              clock_out_at: new Date(start + 14 * 3600000).toISOString(),
              corrected_at: null,
              correction_reason: null,
            });
        }
      if (scenario === 'mixed' || scenario === 'active')
        records.push({
          id: 'fixture-active',
          user_id: 'fixture-worker',
          station_membership_id: station.membershipId,
          clock_in_at: '2026-09-13T08:00:00Z',
          clock_out_at: null,
          status: 'ACTIVE',
          corrected_at: null,
        } as AttendanceRecord);
      const policies = [
        {
          id: '1',
          effectiveFrom: '2020-01-01',
          createdAt: '2020-01-01',
          rules: {
            dailyMinutes: Array(7).fill(480),
            weeklyMinutes: scenario === 'regular' ? null : 2520,
            firstOvertimeMinutes: 120,
            firstRate: 125,
            secondRate: 150,
            weekStartsOn: 1,
            breakMinutes: scenario === 'regular' ? 0 : 30,
            breakAfterMinutes: 360,
            restDays: [],
            restRate: 150,
            holidays: [],
            holidayRate: 150,
            nightStart: 0,
            nightEnd: 0,
            nightRate: 100,
          },
        },
      ];
      return {
        stationId,
        timezone: station.timezone,
        today,
        from,
        to,
        generatedAt: '2026-09-13T12:00Z',
        weekStartsOn: 1,
        entries: classifiedEntries(
          scenario === 'active' ? records.slice(-1) : records,
          from,
          to,
          station.timezone,
          policies,
          Date.parse('2026-09-14T00:00Z')
        ),
        sessions: Object.fromEntries(
          records.map((r) => [r.id, { start: r.clock_in_at, end: r.clock_out_at }])
        ),
        active: ['mixed', 'active'].includes(scenario)
          ? { start: new Date(Date.now() - 8200000).toISOString() }
          : null,
      };
    },
    [scenario]
  );
  return (
    <View style={{ flex: 1, backgroundColor: '#ddd', paddingTop: 55 }}>
      <ScrollView horizontal style={{ maxHeight: 46 }} contentContainerStyle={{ gap: 12 }}>
        {[320, 390, 430].map((n) => (
          <Pressable key={n} onPress={() => setWidth(n)} style={{ padding: 10 }}>
            <Label>{n}</Label>
          </Pressable>
        ))}
        {['mixed', 'regular', 'sparse', 'empty', 'active', 'error', 'overnight'].map((s) => (
          <Pressable key={s} onPress={() => setScenario(s)} style={{ padding: 10 }}>
            <Label>{s}</Label>
          </Pressable>
        ))}
        <Pressable onPress={() => setLongRange((v) => !v)} style={{ padding: 10 }}>
          <Label>93 days</Label>
        </Pressable>
      </ScrollView>
      <View style={{ flex: 1, width, alignSelf: 'center', maxWidth: '100%' }}>
        <Worker.Provider
          value={{
            station,
            context: {
              userId: 'fixture-worker',
              fullName: 'בדיקה',
              email: null,
              phone: null,
              stations: [station],
            },
            openStation: (_id, action) => action(),
            select: () => {},
            data: null,
            error: false,
            loading: false,
            refresh: () => {},
            proceed: (fn) => fn(),
            setGuard: () => {},
          }}
        >
          <HoursApi.Provider value={api}>
            <HoursContent
              key={String(longRange)}
              station={station}
              api={api}
              initialPeriod={
                longRange
                  ? { mode: 'custom', from: '2026-06-13', to: '2026-09-13' }
                  : { mode: 'week' }
              }
            />
          </HoursApi.Provider>
        </Worker.Provider>
      </View>
    </View>
  );
}
