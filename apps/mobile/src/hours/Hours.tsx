import { createContext, useContext, useCallback, useMemo, useState } from 'react';
import { View, Pressable, RefreshControl, Platform, I18nManager } from 'react-native';
import { useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { addDays, localDate, type ReportEntry } from '@yellowshifts/reports';
import {
  getMobileWorkerHours,
  HoursScopeError,
  hoursRange,
  type MobileHours,
  type HoursPeriod,
} from '@yellowshifts/database/public';
import { useWorker } from '../home/WorkerProvider';
import { Elapsed, nativeTime } from '../home/Hero';
import { supabase } from '../lib/supabase';
import { Screen, Label, Surface, Button, Skeleton, Message } from '../ui';
import { colors } from '../ui/theme';
import { Sheet, selection } from '../week/Patterns';
import { dateLabel } from '../week/model';
import { dayTitle, groupDays, hoursText, movePeriod, summarize } from './model';
export const HoursApi = createContext(getMobileWorkerHours);
function Time({ seconds, large = false }: { seconds: number; large?: boolean }) {
  return (
    <Label
      english
      bold
      maxFontSizeMultiplier={1.4}
      accessibilityLabel={`${Math.floor(seconds / 3600)} שעות ו-${Math.floor((seconds % 3600) / 60)} דקות`}
      style={{
        width: large ? '100%' : undefined,
        flexShrink: 1,
        fontSize: large
          ? hoursText(seconds).length > 6
            ? 36
            : 44
          : hoursText(seconds).length > 6
            ? 20
            : 25,
        fontVariant: ['tabular-nums'],
      }}
    >
      {hoursText(seconds)}
    </Label>
  );
}
function Rates({ entries }: { entries: ReportEntry[] }) {
  const { rates, breaks } = summarize(entries);
  const items = Object.entries(rates).filter(([, n]) => n > 0);
  if (!items.length && !breaks) return null;
  return (
    <View style={{ gap: 14 }}>
      <Label bold>חלוקת שעות לפי תעריף</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map(([rate, seconds]) => (
          <View
            key={rate}
            style={{
              flexGrow: 1,
              flexBasis: 120,
              padding: 12,
              borderRadius: 16,
              backgroundColor: rate === '100' ? colors.yellow : colors.base,
              gap: 5,
            }}
          >
            <Label bold accessibilityLabel={rate === 'unclassified' ? 'ללא סיווג' : `${rate} אחוז`}>
              {rate === 'unclassified' ? 'ללא סיווג' : `${rate}%`}
            </Label>
            <Time seconds={seconds} />
          </View>
        ))}
      </View>
      {breaks > 0 && (
        <Label style={{ color: colors.secondary }}>הפסקות שנוכו מהסיווג: {hoursText(breaks)}</Label>
      )}
      <Label style={{ fontSize: 12, color: colors.secondary }}>
        החלוקה לפי כללי התחנה, לאחר ניכוי הפסקות. אינה חישוב שכר.
      </Label>
    </View>
  );
}
export default function Hours() {
  const { station, context } = useWorker();
  const api = useContext(HoursApi);
  // A new station mounts a fresh state tree: no previous station can flash while loading.
  if (!station)
    return (
      <Screen tabbed>
        <Message>לא נמצאה תחנה זמינה</Message>
      </Screen>
    );
  return <HoursContent key={`${context.userId}:${station.id}`} station={station} api={api} />;
}
export function HoursContent({
  station,
  api,
  initialPeriod = { mode: 'week' },
}: {
  station: { id: string; name: string; timezone: string };
  api: typeof getMobileWorkerHours;
  initialPeriod?: HoursPeriod;
}) {
  const today = localDate(new Date(), station.timezone);
  const [period, setPeriod] = useState<HoursPeriod>(initialPeriod);
  const [snapshot, setSnapshot] = useState<{ key: string; value: MobileHours } | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  const [detailLimit, setDetailLimit] = useState(20);
  const [detail, setDetail] = useState<string | null>(null),
    [excluded, setExcluded] = useState(false);
  const [custom, setCustom] = useState(false),
    [from, setFrom] = useState(today),
    [to, setTo] = useState(today),
    [pick, setPick] = useState<'from' | 'to' | null>(null),
    [rangeError, setRangeError] = useState(false);
  const key = JSON.stringify(period);
  const report = snapshot?.key === key ? snapshot.value : null;
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      setError(false);
      if (!supabase) {
        setError(true);
        setLoading(false);
        return;
      }
      void api(supabase, station.id, period)
        .then((value) => {
          if (alive) setSnapshot({ key, value });
        })
        .catch((reason) => {
          if (alive) {
            setError(true);
            if (reason instanceof HoursScopeError) setSnapshot(null);
          }
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }, [api, station.id, key, revision])
  ); // period is represented by its stable serialized key
  const days = useMemo(() => groupDays(report?.entries || [], report?.weekStartsOn ?? 1), [report]);
  const summary = useMemo(() => summarize(report?.entries || []), [report]);
  const change = (value: HoursPeriod) => {
    selection();
    setDetail(null);
    setExcluded(false);
    setPeriod(value);
  };
  const active = report?.active?.start;
  const selected = days.find((d) => d.date === detail);
  const openRange = () => {
    setFrom(report?.from || today);
    setTo(report && report.to < today ? report.to : today);
    setRangeError(false);
    setCustom(true);
  };
  return (
    <Screen
      tabbed
      refreshControl={
        <RefreshControl
          refreshing={loading && !!report}
          onRefresh={() => setRevision((v) => v + 1)}
          tintColor={colors.crimson}
        />
      }
    >
      <View style={{ gap: 4 }}>
        <Label style={{ color: colors.secondary }}>{station.name}</Label>
        <Label bold accessibilityRole="header" style={{ fontSize: 32 }}>
          השעות שלי
        </Label>
        <Label style={{ color: colors.secondary }}>הזמן שלך בעבודה, יום אחרי יום</Label>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(
          [
            { title: 'השבוע', value: { mode: 'week' } },
            { title: 'שבוע קודם', value: { mode: 'week', anchor: addDays(today, -7) } },
            { title: 'החודש', value: { mode: 'month' } },
          ] as { title: string; value: HoursPeriod }[]
        ).map((item) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            accessibilityState={{ selected: JSON.stringify(item.value) === key }}
            onPress={() => change(item.value)}
            style={({ pressed }) => ({
              flexBasis: '45%',
              flexGrow: 1,
              minWidth: 0,
              paddingHorizontal: 10,
              paddingVertical: 12,
              minHeight: 44,
              borderRadius: 16,
              backgroundColor: JSON.stringify(item.value) === key ? colors.yellow : colors.surface,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Label bold style={{ textAlign: 'center', flexShrink: 1 }}>
              {item.title}
            </Label>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: period.mode === 'custom' }}
          onPress={openRange}
          style={{
            flexBasis: '45%',
            flexGrow: 1,
            minWidth: 0,
            padding: 12,
            borderRadius: 16,
            backgroundColor: period.mode === 'custom' ? colors.yellow : colors.surface,
          }}
        >
          <Label bold style={{ textAlign: 'center', flexShrink: 1 }}>
            טווח מותאם
          </Label>
        </Pressable>
      </View>
      {error && (
        <View accessibilityLiveRegion="polite" style={{ gap: 12 }}>
          <Message>
            {report
              ? 'לא הצלחנו לרענן. מוצגים הנתונים מהטעינה האחרונה.'
              : 'לא הצלחנו לטעון את השעות. נסו שוב בעוד רגע.'}
          </Message>
          <Button
            secondary
            title="ניסיון נוסף"
            onPress={() => setRevision((v) => v + 1)}
            busy={loading}
          />
        </View>
      )}
      {loading && !report && (
        <>
          <Skeleton />
          <Skeleton />
        </>
      )}
      {report && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {period.mode !== 'custom' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={period.mode === 'week' ? 'שבוע קודם' : 'חודש קודם'}
                onPress={() => change(movePeriod(period, report.from, -1))}
                style={{ padding: 12, minWidth: 44 }}
              >
                <Label english style={{ fontSize: 28 }}>
                  {I18nManager.isRTL ? '›' : '‹'}
                </Label>
              </Pressable>
            )}
            <View style={{ flex: 1 }}>
              <Label bold english={period.mode !== 'month'} style={{ textAlign: 'center' }}>
                {period.mode === 'month'
                  ? new Intl.DateTimeFormat('he-IL', {
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'UTC',
                    }).format(new Date(report.from + 'T12:00Z'))
                  : `${dateLabel(report.from)} — ${dateLabel(report.to)}`}
              </Label>
              <Label style={{ textAlign: 'center', color: colors.secondary, fontSize: 12 }}>
                {period.mode === 'month'
                  ? ''
                  : report.from.slice(0, 4) === report.to.slice(0, 4)
                    ? report.from.slice(0, 4)
                    : `${report.from.slice(0, 4)} — ${report.to.slice(0, 4)}`}
              </Label>
            </View>
            {period.mode !== 'custom' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={period.mode === 'week' ? 'שבוע הבא' : 'חודש הבא'}
                disabled={report.to >= today}
                accessibilityState={{ disabled: report.to >= today }}
                onPress={() => change(movePeriod(period, report.from, 1))}
                style={{ padding: 12, minWidth: 44, opacity: report.to >= today ? 0.3 : 1 }}
              >
                <Label english style={{ fontSize: 28 }}>
                  {I18nManager.isRTL ? '‹' : '›'}
                </Label>
              </Pressable>
            )}
          </View>
          <Animated.View
            key={key}
            entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)}
            style={{ backgroundColor: colors.yellow, borderRadius: 28, padding: 24, gap: 10 }}
          >
            <Label bold>שעות נוכחות שהושלמו</Label>
            <Time seconds={summary.seconds} large />
            <Label>{summary.shifts} משמרות בתקופה</Label>
            <Label style={{ color: colors.secondary, fontSize: 12 }}>
              לפני ניכוי הפסקות · רשומות פתוחות ולבדיקה אינן נספרות
            </Label>
          </Animated.View>
          {active && (
            <Surface>
              <Label bold>משמרת פעילה עכשיו</Label>
              <Elapsed start={active} />
              <Label>השעות הסופיות יתעדכנו לאחר דיווח יציאה.</Label>
            </Surface>
          )}
          {summary.excluded.length > 0 && (
            <Button
              secondary
              title="יש רשומות שלא נכללו בסיכום · לפרטים"
              onPress={() => {
                selection();
                setDetailLimit(20);
                setExcluded(true);
              }}
            />
          )}
          {(Object.keys(summary.rates).length > 0 || summary.breaks > 0) && (
            <Surface>
              <Rates entries={report.entries} />
            </Surface>
          )}
          <View style={{ gap: 12 }}>
            <Label bold accessibilityRole="header" style={{ fontSize: 23 }}>
              הימים שלך
            </Label>
            {!days.length && (
              <Surface>
                <Label bold>אין עדיין שעות עבודה לתקופה הזו</Label>
                <Label>
                  {active
                    ? 'יש משמרת פעילה כרגע. הסיכום יתעדכן לאחר היציאה.'
                    : 'אפשר לבחור תקופה אחרת. משמרות שהושלמו יופיעו כאן.'}
                </Label>
              </Surface>
            )}
            {days.map((day, index) => (
              <View key={day.date} style={{ gap: 12 }}>
                {period.mode !== 'week' && days[index - 1]?.week !== day.week && (
                  <Label style={{ fontSize: 13, color: colors.secondary }}>
                    שבוע {dateLabel(day.week)}
                  </Label>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${dayTitle(day.date)}, ${hoursText(day.seconds)} שעות${day.entries.some((e) => e.correctedAt) ? ', כולל תיקון מנהל' : ''}, לפתיחת פירוט`}
                  onPress={() => {
                    selection();
                    setDetailLimit(20);
                    setDetail(day.date);
                  }}
                  style={({ pressed }) => ({
                    backgroundColor: colors.surface,
                    borderRadius: 22,
                    padding: 18,
                    gap: 10,
                    opacity: pressed ? 0.65 : 1,
                  })}
                >
                  <Label bold>{dayTitle(day.date)}</Label>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <Time seconds={day.seconds} />
                    <Label style={{ color: colors.secondary }}>
                      {day.entries.length > 1
                        ? `${day.entries.length} מקטעי נוכחות`
                        : 'פירוט נוכחות'}
                    </Label>
                  </View>
                  {day.entries.some((e) => e.correctedAt) && (
                    <Label style={{ fontSize: 13, color: colors.secondary }}>
                      תוקן על ידי מנהל
                    </Label>
                  )}
                  {day.excluded.length > 0 && (
                    <Label style={{ fontSize: 13, color: colors.deep }}>כולל רשומה שלא נספרה</Label>
                  )}
                </Pressable>
              </View>
            ))}
          </View>
          <Label style={{ fontSize: 12, color: colors.secondary }}>
            עודכן {nativeTime(report.generatedAt, report.timezone)} ·{' '}
            {dayTitle(localDate(new Date(report.generatedAt), report.timezone))}
          </Label>
        </>
      )}
      {(selected || excluded) && report && (
        <Sheet
          visible
          close={() => {
            setDetail(null);
            setExcluded(false);
          }}
          title={excluded ? 'רשומות שלא נספרו' : dayTitle(selected!.date)}
        >
          <Label>הזמנים לפי השעון המקומי של התחנה. משמרות לילה מחולקות לפי יום.</Label>
          {(excluded ? summary.excluded : selected!.entries).slice(0, detailLimit).map((e, i) => (
            <Surface key={`${e.id}:${e.date}:${i}`}>
              <Label bold>{dayTitle(e.date)}</Label>
              <Label style={{ color: colors.secondary }}>מקטע הנוכחות ביום זה</Label>
              <Label english bold numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 24 }}>
                {nativeTime(e.start, report.timezone)} —{' '}
                {e.end ? nativeTime(e.end, report.timezone) : '…'}
              </Label>
              {e.status === 'הושלמה' &&
                e.end &&
                localDate(new Date(e.end), report.timezone) !== e.date && (
                  <Label>המקטע מסתיים בחצות</Label>
                )}
              {report.sessions?.[e.id] &&
                (report.sessions[e.id]!.start !== e.start ||
                  report.sessions[e.id]!.end !== e.end) && (
                  <View style={{ gap: 6 }}>
                    <Label>
                      דיווח כניסה:{' '}
                      {dayTitle(localDate(new Date(report.sessions[e.id]!.start), report.timezone))}{' '}
                      · {nativeTime(report.sessions[e.id]!.start, report.timezone)}
                    </Label>
                    <Label>
                      דיווח יציאה:{' '}
                      {report.sessions[e.id]!.end
                        ? `${dayTitle(localDate(new Date(report.sessions[e.id]!.end!), report.timezone))} · ${nativeTime(report.sessions[e.id]!.end!, report.timezone)}`
                        : 'טרם דווחה'}
                    </Label>
                  </View>
                )}
              <Label>{e.status}</Label>
              {e.seconds > 0 && <Time seconds={e.seconds} />}
              {e.status !== 'הושלמה' && (
                <Label>רשומה זו אינה כלולה בשעות שהושלמו. לבירור אפשר לפנות למנהל התחנה.</Label>
              )}
              {(e.correctedAt || e.source !== 'NFC') && (
                <Label bold>תיקון / דיווח ידני של מנהל</Label>
              )}
              {e.reason ? <Label>{e.reason}</Label> : null}
              <Rates entries={[e]} />
            </Surface>
          ))}
          {(excluded ? summary.excluded : selected!.entries).length > detailLimit && (
            <Button
              secondary
              title="הצגת רשומות נוספות"
              onPress={() => setDetailLimit((n) => n + 20)}
            />
          )}
        </Sheet>
      )}
      <Sheet
        visible={custom}
        close={() => {
          setCustom(false);
          setPick(null);
        }}
        title="התקופה שלך"
      >
        {(['from', 'to'] as const).map((field) => (
          <View key={field} style={{ gap: 8 }}>
            <Label bold>{field === 'from' ? 'מתאריך' : 'עד תאריך'}</Label>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                accessibilityLabel={field === 'from' ? 'בחירת תאריך התחלה' : 'בחירת תאריך סיום'}
                value={new Date((field === 'from' ? from : to) + 'T12:00:00Z')}
                mode="date"
                display="compact"
                timeZoneName="UTC"
                maximumDate={new Date(today + 'T23:59:00Z')}
                onChange={(event, value) => {
                  if (event.type === 'set' && value) {
                    (field === 'from' ? setFrom : setTo)(value.toISOString().slice(0, 10));
                    setRangeError(false);
                  }
                }}
              />
            ) : (
              <Button
                secondary
                title={dateLabel(field === 'from' ? from : to)}
                onPress={() => setPick(field)}
              />
            )}
          </View>
        ))}
        {Platform.OS !== 'ios' && pick && (
          <DateTimePicker
            value={new Date((pick === 'from' ? from : to) + 'T12:00:00Z')}
            mode="date"
            display="default"
            timeZoneName="UTC"
            maximumDate={new Date(today + 'T23:59:00Z')}
            onChange={(event, value) => {
              setPick(null);
              if (event.type === 'set' && value) {
                (pick === 'from' ? setFrom : setTo)(value.toISOString().slice(0, 10));
                setRangeError(false);
              }
            }}
          />
        )}
        {rangeError && <Message>בחרו תאריכים בסדר תקין, עד היום, בטווח של עד 93 ימים.</Message>}
        <Button
          title="הצגת השעות"
          onPress={() => {
            try {
              const value: HoursPeriod = { mode: 'custom', from, to };
              hoursRange(value, today);
              change(value);
              setCustom(false);
              setPick(null);
            } catch {
              setRangeError(true);
            }
          }}
        />
      </Sheet>
    </Screen>
  );
}
