import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { duration, addDays } from '@yellowshifts/reports';
import { Label } from '../ui';
import { colors } from '../ui/theme';
import { useWorker } from './WorkerProvider';
import { heroState } from './model';
export const nativeTime = (value: string, timezone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timezone,
  }).format(new Date(value));
export function Elapsed({ start }: { start: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Label
      english
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
      bold
      accessibilityLabel={`משך המשמרת ${duration(Math.max(0, (now - Date.parse(start)) / 1000))}`}
      style={{ fontSize: 44, fontVariant: ['tabular-nums'] }}
    >
      {duration(Math.max(0, (now - Date.parse(start)) / 1000))}
    </Label>
  );
}
export function ShiftTime({
  start,
  end,
  timezone,
}: {
  start: string;
  end: string;
  timezone: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        direction: 'ltr',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: 8,
      }}
    >
      <Label english bold style={{ fontSize: 32, fontVariant: ['tabular-nums'] }}>
        {nativeTime(start, timezone)}
      </Label>
      <Label english style={{ fontSize: 24 }}>
        –
      </Label>
      <Label english bold style={{ fontSize: 32, fontVariant: ['tabular-nums'] }}>
        {nativeTime(end, timezone)}
      </Label>
    </View>
  );
}
export function Hero() {
  const { data, station } = useWorker();
  if (!data) return null;
  const hero = heroState(data, Date.now());
  const titles = {
    active: 'במשמרת עכשיו',
    soon: 'המשמרת מתחילה בקרוב',
    today: 'המשמרת שלך היום',
    completed: 'סיימת להיום',
    upcoming: 'המשמרת הבאה שלך',
    empty: 'זמן לתכנן קדימה',
  };
  const shift = hero.shift;
  const minutes = shift ? Math.ceil((Date.parse(shift.start_at) - Date.now()) / 60000) : 0;
  return (
    <Animated.View
      key={hero.kind + data.stationId}
      entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
      style={{
        padding: 24,
        borderRadius: 24,
        backgroundColor: colors.yellow,
        gap: 18,
        borderWidth: 1,
        borderColor: colors.yellow,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.crimson }} />
        <Label bold style={{ fontSize: 18, flexShrink: 1 }}>
          {titles[hero.kind]}
        </Label>
      </View>
      {hero.kind === 'active' && data.active ? (
        <>
          <Elapsed start={data.active.clock_in_at} />
          <Label>
            כניסה ב־{nativeTime(data.active.clock_in_at, data.activeTimezone)} ·{' '}
            {data.activeStation ?? 'תחנה אחרת'}
          </Label>
          {shift && <Label>סיום מתוכנן: {nativeTime(shift.end_at, data.timezone)}</Label>}
          <Label style={{ fontSize: 12, color: colors.secondary }}>
            לפי הדיווח האחרון שהתקבל מהשרת
          </Label>
        </>
      ) : hero.kind === 'completed' ? (
        <>
          <Label english bold style={{ fontSize: 44, fontVariant: ['tabular-nums'] }}>
            {duration(data.completedTodaySeconds).slice(0, -3)}
          </Label>
          <Label>שעות נוכחות סגורות היום. כל הכבוד.</Label>
          {shift && (
            <Label>
              המשמרת הבאה ב־
              {new Intl.DateTimeFormat('he-IL', {
                day: 'numeric',
                month: 'numeric',
                timeZone: data.timezone,
              }).format(new Date(shift.start_at))}
            </Label>
          )}
        </>
      ) : shift ? (
        <>
          <Label>
            {shift.shift_date === data.today
              ? 'היום'
              : shift.shift_date === addDays(data.today, 1)
                ? 'מחר'
                : new Intl.DateTimeFormat('he-IL', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'numeric',
                    timeZone: data.timezone,
                  }).format(new Date(shift.start_at))}
          </Label>
          <ShiftTime start={shift.start_at} end={shift.end_at} timezone={data.timezone} />
          <Label>
            {station?.name}
            {minutes > 0
              ? ` · בעוד ${minutes < 60 ? `${minutes} דקות` : `${Math.floor(minutes / 60)} שעות`}`
              : ' · שעת ההתחלה הגיעה'}
          </Label>
        </>
      ) : (
        <>
          <Label bold style={{ fontSize: 26 }}>
            אין משמרות שפורסמו עבורך כרגע
          </Label>
          <Label style={{ lineHeight: 26 }}>כאן תופיע המשמרת הבאה שלך לאחר פרסום הסידור.</Label>
        </>
      )}
    </Animated.View>
  );
}
