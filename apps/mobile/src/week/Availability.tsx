import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, Alert, Platform, AccessibilityInfo } from 'react-native';
import { useLocalSearchParams, useNavigation, useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { addDays, weekStart } from '@yellowshifts/reports';
import type {
  SaveAvailabilityEntryInput,
  WeeklyAvailabilityWithEntries,
  AvailabilityType,
} from '@yellowshifts/types';
import { useWeekApi } from './Api';
import { Screen, Label, Button, Message, Skeleton } from '../ui';
import { colors } from '../ui/theme';
import { AppHeader } from '../home/Patterns';
import { useWorker } from '../home/WorkerProvider';
import { supabase } from '../lib/supabase';
import { WeekPicker, Sheet, selection } from './Patterns';
import { stationWeek, validDay, dateLabel, draftFor, fingerprint, validDraft } from './model';
const modes: { type: AvailabilityType; label: string }[] = [
  { type: 'ALL_DAY_AVAILABLE', label: 'זמין' },
  { type: 'ALL_DAY_UNAVAILABLE', label: 'לא זמין' },
  { type: 'TIME_WINDOW', label: 'שעות' },
];
export default function Availability() {
  const api = useWeekApi();
  const worker = useWorker(),
    { station, context } = worker;
  const params = useLocalSearchParams<{ week?: string }>(),
    navigation = useNavigation();
  const current = stationWeek(station?.timezone ?? 'Asia/Jerusalem');
  const [week, setWeek] = useState(() =>
    validDay(params.week) ? weekStart(params.week) : addDays(current, 7)
  );
  const [draft, setDraft] = useState<SaveAvailabilityEntryInput[]>([]),
    [saved, setSaved] = useState<WeeklyAvailabilityWithEntries | null>(null),
    [base, setBase] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(false),
    [revision, setRevision] = useState(0),
    [picker, setPicker] = useState<{ index: number; field: 'startTime' | 'endTime' } | null>(null),
    [undo, setUndo] = useState<SaveAvailabilityEntryInput[] | null>(null);
  const run = useRef(0),
    saving = useRef(false),
    alive = useRef(true);
  const dirty = draft.length > 0 && fingerprint(draft) !== base;
  const editable = week >= current && week <= addDays(current, 14);
  const latest = useRef({ dirty, busy, save: async () => false, discard: () => {} });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      run.current++;
    };
  }, []);
  useEffect(() => {
    const id = ++run.current;
    setLoading(true);
    setDraft([]);
    setBase('');
    setError('');
    setSuccess(false);
    setUndo(null);
    if (!station || !supabase) {
      setLoading(false);
      return;
    }
    void api
      .availability(supabase, context.userId, station.id, week)
      .then((value) => {
        if (id !== run.current || !alive.current) return;
        setSaved(value);
        const entries = draftFor(week, value);
        setDraft(entries);
        setBase(fingerprint(entries));
      })
      .catch(() => {
        if (id === run.current) setError('לא הצלחנו לטעון את הזמינות');
      })
      .finally(() => {
        if (id === run.current) setLoading(false);
      });
  }, [station?.id, context.userId, week, revision]);
  const save = async () => {
    if (saving.current || !supabase || !station || !editable || !validDraft(draft)) return false;
    saving.current = true;
    setBusy(true);
    setError('');
    setSuccess(false);
    const id = run.current;
    try {
      const result = await api.save(
        supabase,
        context.userId,
        station.id,
        week,
        draft,
        saved?.week.notes ?? null
      );
      if (!alive.current || id !== run.current) return false;
      const entries = draftFor(week, result);
      setSaved(result);
      setDraft(entries);
      setBase(fingerprint(entries));
      setSuccess(true);
      setUndo(null);
      latest.current.dirty = false;
      worker.setGuard(null);
      worker.refresh();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      AccessibilityInfo.announceForAccessibility('הזמינות נשמרה');
      return true;
    } catch {
      if (alive.current && id === run.current)
        setError('לא הצלחנו לשמור את הזמינות. השינויים שלך עדיין כאן.');
      return false;
    } finally {
      saving.current = false;
      if (alive.current) setBusy(false);
    }
  };
  latest.current = {
    dirty,
    busy,
    save,
    discard: () => {
      setDraft(draftFor(week, saved));
      latest.current.dirty = false;
    },
  };
  const guard = useCallback((action: () => void) => {
    if (latest.current.busy) return;
    if (!latest.current.dirty) {
      action();
      return;
    }
    Alert.alert('יש שינויים שלא נשמרו', 'לשמור לפני שממשיכים?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'יציאה ללא שמירה',
        style: 'destructive',
        onPress: () => {
          latest.current.discard();
          action();
        },
      },
      {
        text: 'שמירה',
        onPress: () => {
          void latest.current.save().then((ok) => {
            if (ok) action();
          });
        },
      },
    ]);
  }, []);
  useFocusEffect(
    useCallback(() => {
      worker.setGuard(guard);
      return () => worker.setGuard(null);
    }, [worker.setGuard, guard])
  );
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (latest.current.dirty || latest.current.busy) {
          event.preventDefault();
          guard(() => navigation.dispatch(event.data.action));
        }
      }),
    [navigation, guard]
  );
  // External Home week links use the same unsaved-change guard.
  const requested = useRef(params.week);
  useEffect(() => {
    if (params.week !== requested.current) {
      requested.current = params.week;
      if (validDay(params.week)) {
        const next = weekStart(params.week);
        guard(() => setWeek(next));
      }
    }
  }, [params.week, guard]);
  const update = (index: number, patch: Partial<SaveAvailabilityEntryInput>) => {
    if (busy || !editable) return;
    setSuccess(false);
    setDraft((v) => v.map((e, i) => (i === index ? { ...e, ...patch } : e)));
    selection();
  };
  const change = (delta: number) =>
    guard(() => {
      setWeek(addDays(week, delta * 7));
      selection();
    });
  const submitNeeded = !saved && draft.length === 7;
  const canSave = !busy && editable && validDraft(draft) && (dirty || submitNeeded);
  const selected = picker ? (draft[picker.index]?.[picker.field] ?? '08:00') : '08:00';
  return (
    <Screen
      tabbed
      footer={
        draft.length > 0 ? (
          <View
            style={{
              padding: 12,
              gap: 6,
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Label accessibilityLiveRegion="polite" style={{ fontSize: 12, textAlign: 'center' }}>
              {busy
                ? 'שומרים את הזמינות…'
                : dirty
                  ? 'יש שינויים שלא נשמרו'
                  : success
                    ? 'נשמר'
                    : saved
                      ? 'הזמינות נשלחה'
                      : 'עדיין לא נשלחה זמינות'}
            </Label>
            <Button
              title={busy ? 'שומרים…' : submitNeeded ? 'שליחת הזמינות' : 'שמירת השינויים'}
              busy={busy}
              disabled={!canSave}
              onPress={() => void save()}
            />
          </View>
        ) : undefined
      }
    >
      <AppHeader />
      <Label bold accessibilityRole="header" style={{ fontSize: 30 }}>
        מתי נוח לך לעבוד?
      </Label>
      <WeekPicker
        week={week}
        change={change}
        disabled={busy}
        today={() =>
          guard(() => {
            setWeek(current);
            selection();
          })
        }
      />
      {!station ? (
        <Label>אין תחנה פעילה בחשבון</Label>
      ) : loading ? (
        <Skeleton />
      ) : (
        <>
          {!editable && <Label>אפשר לעדכן את השבוע הנוכחי ועד שבועיים קדימה.</Label>}
          {error && <Message>{error}</Message>}
          {!draft.length ? (
            <Button title="ניסיון נוסף" onPress={() => setRevision((v) => v + 1)} />
          ) : (
            <>
              <Label style={{ color: colors.secondary }}>
                בחירה קצרה לכל יום. שעות לילה יכולות להסתיים למחרת.
              </Label>
              {editable && (
                <View style={{ gap: 8 }}>
                  <Button
                    secondary
                    disabled={busy}
                    title="זמין כל השבוע"
                    onPress={() => {
                      setUndo(draft);
                      setDraft((v) =>
                        v.map((e) => ({
                          ...e,
                          availabilityType: 'ALL_DAY_AVAILABLE',
                          startTime: null,
                          endTime: null,
                        }))
                      );
                      setSuccess(false);
                      selection();
                    }}
                  />
                  {undo && (
                    <Button
                      secondary
                      title="ביטול השינוי לכל השבוע"
                      disabled={busy}
                      onPress={() => {
                        setDraft(undo);
                        setUndo(null);
                      }}
                    />
                  )}
                </View>
              )}
              {draft.map((entry, index) => (
                <View
                  key={entry.date}
                  style={{
                    padding: 16,
                    gap: 12,
                    borderRadius: 22,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Label bold style={{ fontSize: 19 }}>
                    {dateLabel(entry.date, { weekday: 'long', day: 'numeric', month: 'numeric' })}
                  </Label>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {modes.map((mode) => (
                      <Pressable
                        key={mode.type}
                        disabled={busy || !editable}
                        accessibilityRole="radio"
                        accessibilityState={{
                          checked: entry.availabilityType === mode.type,
                          disabled: busy || !editable,
                        }}
                        accessibilityLabel={`${dateLabel(entry.date, { weekday: 'long' })}, ${mode.label === 'שעות' ? 'שעות מותאמות' : mode.label}`}
                        onPress={() =>
                          update(index, {
                            availabilityType: mode.type,
                            startTime:
                              mode.type === 'TIME_WINDOW' ? (entry.startTime ?? '08:00') : null,
                            endTime:
                              mode.type === 'TIME_WINDOW' ? (entry.endTime ?? '16:00') : null,
                          })
                        }
                        style={({ pressed }) => ({
                          flex: 1,
                          minHeight: 48,
                          justifyContent: 'center',
                          alignItems: 'center',
                          padding: 6,
                          borderRadius: 12,
                          backgroundColor:
                            entry.availabilityType === mode.type ? colors.cream : colors.base,
                          opacity: pressed ? 0.65 : 1,
                        })}
                      >
                        <Label
                          bold={entry.availabilityType === mode.type}
                          style={{ fontSize: 14, textAlign: 'center' }}
                        >
                          {mode.label}
                        </Label>
                      </Pressable>
                    ))}
                  </View>
                  {entry.availabilityType === 'TIME_WINDOW' && (
                    <Animated.View
                      entering={FadeIn.duration(140).reduceMotion(ReduceMotion.System)}
                      style={{ gap: 10 }}
                    >
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {(['startTime', 'endTime'] as const).map((field) => (
                          <Pressable
                            key={field}
                            disabled={busy || !editable}
                            accessibilityRole="button"
                            accessibilityLabel={`${field === 'startTime' ? 'שעת התחלה' : 'שעת סיום'}, ${entry[field]}`}
                            onPress={() => setPicker({ index, field })}
                            style={{
                              flex: 1,
                              minHeight: 64,
                              padding: 10,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <Label style={{ fontSize: 12 }}>
                              {field === 'startTime' ? 'משעה' : 'עד שעה'}
                            </Label>
                            <Label english bold style={{ fontSize: 22 }}>
                              {entry[field]}
                            </Label>
                          </Pressable>
                        ))}
                      </View>
                      {entry.startTime === entry.endTime ? (
                        <Message>יש לבחור שעות התחלה וסיום שונות</Message>
                      ) : (
                        entry.endTime! < entry.startTime! && <Label>הסיום למחרת</Label>
                      )}
                    </Animated.View>
                  )}
                </View>
              ))}
            </>
          )}
        </>
      )}
      <Sheet
        visible={Boolean(picker)}
        title={picker?.field === 'startTime' ? 'שעת התחלה' : 'שעת סיום'}
        close={() => setPicker(null)}
      >
        {picker && (
          <DateTimePicker
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            value={new Date(`2000-01-01T${selected}:00Z`)}
            timeZoneName="UTC"
            is24Hour
            locale="he-IL"
            themeVariant="light"
            onChange={(event, date) => {
              if (Platform.OS === 'android') setPicker(null);
              if (event.type === 'set' && date)
                update(picker.index, { [picker.field]: date.toISOString().slice(11, 16) });
            }}
          />
        )}
      </Sheet>
    </Screen>
  );
}
