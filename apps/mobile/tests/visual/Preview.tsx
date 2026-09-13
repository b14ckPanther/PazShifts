import { useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { dayBoundary } from '@yellowshifts/reports';
import { Worker } from '../../src/home/WorkerProvider';
import { WeekApi } from '../../src/week/Api';
import Schedule from '../../src/week/Schedule';
import Availability from '../../src/week/Availability';
import { days } from '../../src/week/model';
import { Label } from '../../src/ui';
import type { NativeSchedule } from '@yellowshifts/database/public';
import type { WeeklyAvailabilityWithEntries } from '@yellowshifts/types';
const timezone = 'Asia/Jerusalem';
export default function Preview() {
  const [page, setPage] = useState('schedule'),
    [width, setWidth] = useState(320),
    [scenario, setScenario] = useState('mixed'),
    [station, setStation] = useState('fixture-a');
  const guard = useRef<((action: () => void) => void) | null>(null);
  const stations = ['fixture-a', 'fixture-b'].map((id, i) => ({
    id,
    name: `תחנת בדיקה ${i + 1}`,
    code: id,
    timezone,
    membershipId: id,
    role: 'WORKER',
  }));
  const context = {
    userId: 'fixture-worker',
    fullName: 'עובד בדיקה',
    email: null,
    phone: null,
    stations,
  };
  const proceed = (fn: () => void) => (guard.current ? guard.current(fn) : fn());
  const api = {
    schedule: async (
      _c: unknown,
      _u: string,
      _s: string,
      week: string
    ): Promise<NativeSchedule> => ({
      published: scenario !== 'unpublished',
      shifts:
        scenario === 'empty' || scenario === 'unpublished'
          ? []
          : [0, 1].map((n) => ({
              id: `fixture-${n}`,
              date: week,
              start: new Date(dayBoundary(week, timezone) + (n ? 22 : 7) * 3600000).toISOString(),
              end: new Date(dayBoundary(week, timezone) + (n ? 30 : 15) * 3600000).toISOString(),
              name: n ? 'לילה' : 'בוקר',
              notes: 'הערת בדיקה לתצוגה בלבד',
              coworkers: [{ id: 'coworker', name: 'עמית לבדיקה', role: 'WORKER' }],
            })),
    }),
    availability: async (
      _c: unknown,
      _u: string,
      _s: string,
      week: string
    ): Promise<WeeklyAvailabilityWithEntries | null> =>
      scenario === 'empty'
        ? null
        : {
            week: {
              id: 'fixture',
              stationId: station,
              stationMembershipId: station,
              weekStartDate: week,
              notes: null,
              submittedAt: '2026-09-13T00:00Z',
              updatedAt: '2026-09-13T00:00Z',
            },
            entries: days(week).map((date, i) => ({
              id: date,
              availabilityWeekId: 'fixture',
              date,
              availabilityType:
                scenario === 'all'
                  ? 'ALL_DAY_AVAILABLE'
                  : i % 3 === 0
                    ? 'TIME_WINDOW'
                    : i % 3 === 1
                      ? 'ALL_DAY_UNAVAILABLE'
                      : 'ALL_DAY_AVAILABLE',
              startTime: i % 3 === 0 ? '22:00' : null,
              endTime: i % 3 === 0 ? '06:00' : null,
              notes: null,
              createdAt: '',
              updatedAt: '',
            })),
          },
    save: async (
      _c: unknown,
      _u: string,
      _s: string,
      week: string,
      entries: import('@yellowshifts/types').SaveAvailabilityEntryInput[]
    ) => {
      await new Promise((r) => setTimeout(r, 800));
      if (scenario === 'error') throw Error('fixture');
      return {
        week: {
          id: 'fixture',
          stationId: station,
          stationMembershipId: station,
          weekStartDate: week,
          notes: null,
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        entries: entries.map((e) => ({
          ...e,
          id: e.date,
          availabilityWeekId: 'fixture',
          startTime: e.startTime ?? null,
          endTime: e.endTime ?? null,
          notes: e.notes ?? null,
          createdAt: '',
          updatedAt: '',
        })),
      };
    },
  };
  return (
    <View style={{ flex: 1, paddingTop: 55, backgroundColor: '#ddd' }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          'schedule',
          'availability',
          'mixed',
          'empty',
          'unpublished',
          'all',
          'error',
          '320',
          '390',
          '430',
        ].map((v) => (
          <Pressable
            key={v}
            onPress={() =>
              proceed(() => {
                if (/^\d/.test(v)) setWidth(Number(v));
                else if (v === 'schedule' || v === 'availability') setPage(v);
                else setScenario(v);
              })
            }
            style={{ padding: 7 }}
          >
            <Label english>{v}</Label>
          </Pressable>
        ))}
      </View>
      <View style={{ width, flex: 1, alignSelf: 'center' }}>
        <Worker.Provider
          value={{
            context,
            station: stations.find((s) => s.id === station),
            data: null,
            error: false,
            loading: false,
            openStation: (_id, action) => action(),
            select: (id) => proceed(() => setStation(id)),
            refresh: () => {},
            proceed,
            setGuard: (next) => {
              guard.current = next;
            },
          }}
        >
          <WeekApi.Provider value={api}>
            {page === 'schedule' ? (
              <Schedule key={scenario + station} />
            ) : (
              <Availability key={scenario + station} />
            )}
          </WeekApi.Provider>
        </Worker.Provider>
      </View>
    </View>
  );
}
