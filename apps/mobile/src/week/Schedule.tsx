import { useCallback, useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { localDate, weekStart, clock, duration } from '@yellowshifts/reports';
import { type NativeSchedule, type NativeShift } from '@yellowshifts/database/public';
import { useWeekApi } from './Api';
import { Screen, Label, Surface, Skeleton, Button, Message } from '../ui';
import { colors } from '../ui/theme';
import { AppHeader, roleName } from '../home/Patterns';
import { ShiftTime } from '../home/Hero';
import { useWorker } from '../home/WorkerProvider';
import { supabase } from '../lib/supabase';
import { WeekPicker, Sheet, selection } from './Patterns';
import { days, stationWeek, validDay, dateLabel, shiftDay } from './model';
export default function Schedule() {
  const api = useWeekApi();
  const { station, context } = useWorker();
  const params = useLocalSearchParams<{ day?: string }>();
  const timezone = station?.timezone ?? 'Asia/Jerusalem',
    today = localDate(new Date(), timezone);
  const [week, setWeek] = useState(() =>
    validDay(params.day) ? weekStart(params.day, 0) : stationWeek(timezone)
  );
  const [day, setDay] = useState(() => (validDay(params.day) ? params.day : today));
  const [data, setData] = useState<NativeSchedule | null>(null),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0),
    [detail, setDetail] = useState<NativeShift | null>(null);
  useEffect(() => {
    if (validDay(params.day)) {
      setWeek(weekStart(params.day, 0));
      setDay(params.day);
    }
  }, [params.day]);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setData(null);
      setDetail(null);
      setError(false);
      if (supabase && station)
        void api
          .schedule(supabase, context.userId, station.id, week)
          .then((value) => {
            if (alive) setData(value);
          })
          .catch(() => {
            if (alive) setError(true);
          });
      return () => {
        alive = false;
      };
    }, [station?.id, context.userId, week, revision])
  );
  const change = (delta: number) => {
    const next = shiftDay(week, day, delta);
    setWeek(next.week);
    setDay(next.day);
    setDetail(null);
    selection();
  };
  const selected = data?.shifts.filter((s) => s.date === day) ?? [];
  const next = data?.shifts.find((s) => Date.parse(s.start) > Date.now())?.id;
  return (
    <Screen tabbed>
      <AppHeader />
      <Label bold accessibilityRole="header" style={{ fontSize: 30 }}>
        השבוע שלך
      </Label>
      <WeekPicker
        week={week}
        change={change}
        today={() => {
          setWeek(stationWeek(timezone));
          setDay(today);
          selection();
        }}
      />
      {!station ? (
        <Label>אין תחנה פעילה בחשבון</Label>
      ) : error ? (
        <>
          <Message>לא הצלחנו לטעון את סידור העבודה</Message>
          <Button title="ניסיון נוסף" onPress={() => setRevision((v) => v + 1)} />
        </>
      ) : !data ? (
        <Skeleton />
      ) : (
        <>
          <Label style={{ color: colors.secondary, fontSize: 13 }}>
            {data.published ? 'הסידור פורסם' : 'ממתינים לפרסום הסידור'}
          </Label>
          <View style={{ flexDirection: 'row', marginHorizontal: -20 }}>
            {days(week).map((d) => (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: d === day }}
                accessibilityLabel={`${dateLabel(d, { weekday: 'long', day: 'numeric', month: 'long' })}, ${data.shifts.filter((s) => s.date === d).length} משמרות${d === today ? ', היום' : ''}`}
                onPress={() => {
                  setDay(d);
                  selection();
                }}
                style={({ pressed }) => ({
                  minWidth: 44,
                  flex: 1,
                  minHeight: 88,
                  padding: 4,
                  gap: 6,
                  borderRadius: 16,
                  alignItems: 'center',
                  backgroundColor: d === day ? colors.yellow : colors.surface,
                  borderWidth: 1,
                  borderColor: d === today ? colors.yellow : colors.border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Label style={{ fontSize: 12 }}>
                  {
                    ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'][
                      new Date(d + 'T12:00:00Z').getUTCDay()
                    ]
                  }
                </Label>
                <Label
                  english
                  bold
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{ fontSize: 20, alignSelf: 'stretch', textAlign: 'center' }}
                >
                  {Number(d.slice(-2))}
                </Label>
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: data.shifts.some((s) => s.date === d)
                      ? colors.crimson
                      : 'transparent',
                  }}
                />
              </Pressable>
            ))}
          </View>
          <Animated.View
            key={week + day}
            entering={FadeIn.duration(140).reduceMotion(ReduceMotion.System)}
            style={{ gap: 16 }}
          >
            <Label bold style={{ fontSize: 20 }}>
              {dateLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}
            </Label>
            {!data.published ? (
              <Surface>
                <Label bold>סידור העבודה לשבוע זה עדיין לא פורסם</Label>
                <Label>המשמרות שלך יופיעו כאן לאחר הפרסום.</Label>
              </Surface>
            ) : !data.shifts.length ? (
              <Surface>
                <Label bold>השבוע פנוי בסידור</Label>
                <Label>הסידור פורסם, ואין בו משמרות ששובצת אליהן.</Label>
              </Surface>
            ) : !selected.length ? (
              <Surface>
                <Label bold>יום בלי משמרת</Label>
                <Label>אין לך שיבוץ ביום הזה. אפשר לבחור יום אחר למעלה.</Label>
              </Surface>
            ) : (
              selected.map((s) => (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.name}, ${clock(s.start, timezone)} עד ${clock(s.end, timezone)}, פתיחת פרטי משמרת`}
                  onPress={() => {
                    setDetail(s);
                    selection();
                  }}
                  style={({ pressed }) => ({
                    padding: 22,
                    gap: 12,
                    borderRadius: 24,
                    backgroundColor: s.id === next ? colors.yellow : colors.surface,
                    borderWidth: 1,
                    borderColor: s.id === next ? colors.yellow : colors.border,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  {s.id === next && (
                    <Label bold style={{ fontSize: 12 }}>
                      המשמרת הבאה
                    </Label>
                  )}
                  <ShiftTime start={s.start} end={s.end} timezone={timezone} />
                  {localDate(new Date(s.end), timezone) !==
                    localDate(new Date(s.start), timezone) && <Label>הסיום למחרת</Label>}
                  <Label bold style={{ fontSize: 22 }}>
                    {s.name}
                  </Label>
                  <Label>
                    {station.name} ·{' '}
                    {duration((Date.parse(s.end) - Date.parse(s.start)) / 1000).slice(0, -3)} שעות
                  </Label>
                  {s.coworkers.length > 0 && (
                    <Label style={{ fontSize: 13 }}>
                      {s.coworkers
                        .slice(0, 2)
                        .map((p) => p.name)
                        .join(' · ')}
                      {s.coworkers.length > 2 ? ` ועוד ${s.coworkers.length - 2}` : ''}
                    </Label>
                  )}
                </Pressable>
              ))
            )}
          </Animated.View>
          {!next && data.published && data.shifts.length > 0 && (
            <Label>אין משמרות עתידיות נוספות בשבוע הזה.</Label>
          )}
          <Button secondary title="רענון הסידור" onPress={() => setRevision((v) => v + 1)} />
        </>
      )}
      <Sheet
        visible={Boolean(detail)}
        title={detail?.name ?? 'פרטי המשמרת'}
        close={() => setDetail(null)}
      >
        {detail && (
          <>
            <Label>
              {dateLabel(detail.date, { weekday: 'long', day: 'numeric', month: 'long' })}
            </Label>
            <ShiftTime start={detail.start} end={detail.end} timezone={timezone} />
            <Label>
              {localDate(new Date(detail.end), timezone) !==
              localDate(new Date(detail.start), timezone)
                ? `הסיום ביום ${dateLabel(localDate(new Date(detail.end), timezone))}`
                : 'התחלה וסיום באותו יום'}
            </Label>
            <Label>
              {station?.name} ·{' '}
              {duration((Date.parse(detail.end) - Date.parse(detail.start)) / 1000).slice(0, -3)}{' '}
              שעות
            </Label>
            <Label bold>יחד במשמרת</Label>
            {detail.coworkers.length ? (
              detail.coworkers.map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ backgroundColor: colors.yellow, borderRadius: 14, padding: 12 }}>
                    <Label bold>
                      {p.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </Label>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label bold>{p.name}</Label>
                    <Label>{roleName(p.role)}</Label>
                  </View>
                </View>
              ))
            ) : (
              <Label>אין עובדים נוספים המוצגים למשמרת זו.</Label>
            )}
            {detail.notes && (
              <>
                <Label bold>לקראת המשמרת</Label>
                <Label>{detail.notes}</Label>
              </>
            )}
          </>
        )}
      </Sheet>
    </Screen>
  );
}
