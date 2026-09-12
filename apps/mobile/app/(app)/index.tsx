import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { duration, addDays } from '@yellowshifts/reports';
import { Screen, Label, Surface, Button } from '../../src/ui';
import { colors } from '../../src/ui/theme';
import { AppHeader, DataState, RefreshStamp } from '../../src/home/Patterns';
import { Hero } from '../../src/home/Hero';
import { useWorker } from '../../src/home/WorkerProvider';
export default function Home() {
  const { context, data } = useWorker();
  const router = useRouter();
  const weekly =
    data?.shifts.filter((s) => s.shift_date >= data.week && s.shift_date < addDays(data.week, 7)) ??
    [];
  return (
    <Screen tabbed>
      <AppHeader />
      <View style={{ gap: 4 }}>
        <Label style={{ color: colors.secondary }}>טוב לראות אותך</Label>
        <Label bold accessibilityRole="header" style={{ fontSize: 30 }}>
          {context.fullName.split(' ')[0]}
        </Label>
      </View>
      {!data ? (
        <DataState />
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="פתיחת המשמרת בסידור"
            onPress={() => {
              const next = data.shifts.find((s) => Date.parse(s.end_at) > Date.now());
              router.navigate({
                pathname: '/schedule',
                params: next ? { day: next.shift_date } : {},
              });
            }}
          >
            <Hero />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="משמרות השבוע"
              onPress={() => router.navigate('/schedule')}
              style={({ pressed }) => ({
                opacity: pressed ? 0.65 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                flex: 1,
                padding: 18,
                borderRadius: 20,
                backgroundColor: colors.surface,
                gap: 8,
              })}
            >
              <Label style={{ fontSize: 13 }}>השבוע בסידור</Label>
              <Label english bold style={{ fontSize: 30 }}>
                {weekly.length}
              </Label>
              <Label style={{ fontSize: 12, color: colors.secondary }}>משמרות שפורסמו</Label>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="שעות נוכחות השבוע"
              onPress={() => router.navigate('/hours')}
              style={({ pressed }) => ({
                opacity: pressed ? 0.65 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                flex: 1,
                padding: 18,
                borderRadius: 20,
                backgroundColor: colors.surface,
                gap: 8,
              })}
            >
              <Label style={{ fontSize: 13 }}>שעות השבוע</Label>
              <Label
                english
                bold
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={{ fontSize: 28, fontVariant: ['tabular-nums'] }}
              >
                {duration(data.confirmedSeconds).slice(0, -3)}
              </Label>
              <Label style={{ fontSize: 12, color: colors.secondary }}>נוכחות סגורה</Label>
            </Pressable>
          </View>
          <Surface>
            <Label bold>
              {data.availabilitySubmitted ? 'זמינות לשבוע הבא נשלחה' : 'עוד דבר קטן לשבוע הבא'}
            </Label>
            <Label>
              {data.availabilitySubmitted
                ? 'אפשר לנשום. הזמינות שלך אצל מנהל התחנה.'
                : 'עדיין לא שלחת זמינות. אפשר להשלים אותה כאן.'}
            </Label>
            {!data.availabilitySubmitted && (
              <Button
                title="שליחת זמינות"
                onPress={() =>
                  router.navigate({ pathname: '/availability', params: { week: data.nextWeek } })
                }
              />
            )}
          </Surface>
          {data.reviewCount > 0 && (
            <Label style={{ color: colors.deep }}>
              יש {data.reviewCount} רשומות פתוחות או לבדיקה. הן אינן נכללות בסיכום השעות.
            </Label>
          )}
          <RefreshStamp />
        </>
      )}
    </Screen>
  );
}
