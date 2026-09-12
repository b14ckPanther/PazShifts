import { View } from 'react-native';
import { duration } from '@yellowshifts/reports';
import { Screen, Label, Surface } from '../ui';
import { AppHeader, DataState, RefreshStamp, WebAction } from './Patterns';
import { useWorker } from './WorkerProvider';
import { ShiftTime } from './Hero';
export function Preview({ kind }: { kind: 'schedule' | 'availability' | 'hours' }) {
  const { data } = useWorker();
  const shift = data?.shifts.find((s) => Date.parse(s.end_at) > Date.now());
  const title = { schedule: 'המשמרות שלי', availability: 'הזמינות שלי', hours: 'השעות שלי' }[kind];
  return (
    <Screen tabbed>
      <AppHeader />
      <Label accessibilityRole="header" bold style={{ fontSize: 30 }}>
        {title}
      </Label>
      {!data ? (
        <DataState />
      ) : (
        <>
          <Surface>
            {kind === 'schedule' ? (
              <>
                <Label bold>המשמרת הקרובה</Label>
                {shift ? (
                  <>
                    <Label>
                      {new Intl.DateTimeFormat('he-IL', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        timeZone: data.timezone,
                      }).format(new Date(shift.start_at))}
                    </Label>
                    <ShiftTime start={shift.start_at} end={shift.end_at} timezone={data.timezone} />
                  </>
                ) : (
                  <Label>אין משמרות שפורסמו עבורך ב־28 הימים הקרובים.</Label>
                )}
                <WebAction title="לסידור המלא באתר" path="schedule" />
              </>
            ) : kind === 'availability' ? (
              <>
                <Label bold>
                  לשבוע שמתחיל ב־
                  {new Intl.DateTimeFormat('he-IL', {
                    day: 'numeric',
                    month: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(data.nextWeek + 'T12:00:00Z'))}
                </Label>
                <Label>
                  {data.availabilitySubmitted ? 'הזמינות שלך נשלחה' : 'הזמינות שלך עדיין לא נשלחה'}
                </Label>
                <Label>ניתן למלא ולעדכן את הזמינות באתר.</Label>
                <WebAction
                  title={data.availabilitySubmitted ? 'עדכון הזמינות באתר' : 'שליחת זמינות באתר'}
                  path="availability"
                />
              </>
            ) : (
              <>
                <Label bold>נוכחות סגורה השבוע</Label>
                <Label english bold style={{ fontSize: 44, fontVariant: ['tabular-nums'] }}>
                  {duration(data.confirmedSeconds).slice(0, -3)}
                </Label>
                <Label>שעות נוכחות בלבד, ללא חישוב שכר. רשומות פתוחות או לבדיקה אינן נספרות.</Label>
                <WebAction title="לפירוט ולדוחות באתר" path="hours" />
              </>
            )}
          </Surface>
          <View>
            <RefreshStamp />
          </View>
        </>
      )}
    </Screen>
  );
}
