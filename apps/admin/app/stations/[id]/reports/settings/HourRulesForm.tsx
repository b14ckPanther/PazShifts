'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { Alert, PageHeader } from '@yellowshifts/ui';
import { addDays, rateWeekStart, type HourRules, type HourPolicy } from '@yellowshifts/reports';
import { saveHourRules } from './actions';
import '../reports.css';
import './rules.css';
const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const draft: HourRules = {
  dailyMinutes: [480, 480, 480, 480, 480, 480, 480],
  firstOvertimeMinutes: 120,
  firstRate: 125,
  secondRate: 150,
  weeklyMinutes: null,
  weekStartsOn: 1,
  breakMinutes: 0,
  breakAfterMinutes: 360,
  nightStart: 1320,
  nightEnd: 360,
  nightRate: 100,
  restDays: [],
  restRate: 150,
  holidays: [],
  holidayRate: 150,
};
/** Display-only helper: stored values stay in minutes. */
const hoursHint = (minutes: number) => {
  if (!Number.isFinite(minutes)) return '';
  const hours = Math.round((minutes / 60) * 100) / 100;
  return hours === 1 ? 'שעה אחת' : `${hours} שעות`;
};
const time = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
export function HourRulesForm({
  stationId,
  stationName,
  today,
  policies,
}: {
  stationId: string;
  stationName: string;
  today: string;
  policies: HourPolicy[];
}) {
  const latest = policies[policies.length - 1];
  const [rules, setRules] = useState<HourRules>(latest?.rules || draft);
  const [effective, setEffective] = useState(
    latest && latest.effectiveFrom > today
      ? latest.effectiveFrom
      : addDays(rateWeekStart(today, rules.weekStartsOn), 7)
  );
  const [holidayText, setHolidayText] = useState(rules.holidays.join('\n'));
  const [ack, setAck] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function numberField(key: keyof HourRules, label: string, max = 1440, minutes = false) {
    const value = rules[key] as number;
    const hintId = `rules-${key}-hint`;
    return (
      <div className="ys-form-field">
        <label className="ys-label" htmlFor={`rules-${key}`}>
          {label}
        </label>
        <input
          id={`rules-${key}`}
          className="ys-num"
          type="number"
          inputMode="numeric"
          dir="ltr"
          min={key.toLowerCase().includes('rate') ? 100 : 0}
          max={max}
          step="1"
          required
          value={value}
          aria-describedby={minutes ? hintId : undefined}
          onChange={(e) => setRules({ ...rules, [key]: Number(e.target.value) })}
        />
        {minutes && (
          <span id={hintId} className="ys-help">
            {hoursHint(value)}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="hours-report hour-rules">
      <PageHeader
        className="report-header"
        title="כללי שעות ותוספות"
        description={`הגדרות ${stationName} לדוחות העובדים ולהנהלת חשבונות`}
      />

      <nav className="station-nav-pills" aria-label="דוחות ושעות">
        <Link href={`/stations/${stationId}/reports`}>דוח שעות</Link>
        <Link href={`/stations/${stationId}/reports/settings`} aria-current="page">
          הגדרת כללי שעות ותוספות
        </Link>
      </nav>

      <Alert
        variant={latest ? 'info' : 'warning'}
        role="note"
        title={latest ? 'הכללים נשמרים בגרסאות מתוארכות' : 'טיוטה בלבד — טרם הוגדרו כללים לתחנה'}
        className="rules-explanation"
      >
        <p>
          הערכים הראשוניים הם דוגמה לעריכה, לא קביעה של זכאות על פי דין. החישוב נעשה לכל תחנה בנפרד,
          לפי ימים קלנדריים באזור הזמן של התחנה; משמרת לילה מתפצלת בחצות.
        </p>
        <p>
          כאשר כמה תוספות חלות יחד, נלקח האחוז הגבוה ביותר — ללא חיבור אחוזים. שעות נוספות יומיות
          אינן נספרות שוב במכסה השבועית. מדרגת השעות הנוספות הראשונה משותפת לחריגה היומית והשבועית
          באותו יום.
        </p>
      </Alert>
      <form
        className="hour-rules-form"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          startTransition(async () => {
            try {
              const result = await saveHourRules(
                stationId,
                effective,
                { ...rules, holidays: holidayText.split(/[\s,]+/).filter(Boolean) },
                ack
              );
              if (result.error) setMessage({ tone: 'error', text: result.error });
              else {
                setMessage({
                  tone: 'success',
                  text: 'הכללים נשמרו. הדוחות יחושבו בהתאם לתאריך התחילה.',
                });
                router.refresh();
              }
            } catch {
              setMessage({ tone: 'error', text: 'לא ניתן לשמור כרגע. נסו שוב.' });
            }
          });
        }}
      >
        <section className="report-panel" aria-labelledby="rules-start-title">
          <h2 id="rules-start-title">תחילה ושבוע עבודה</h2>
          <div className="ys-form-grid">
            <div className="ys-form-field">
              <label className="ys-label" htmlFor="rules-effective">
                בתוקף מתאריך
              </label>
              <input
                id="rules-effective"
                className="ys-num"
                type="date"
                required
                min={latest ? addDays(today, 1) : '2000-01-01'}
                max="2100-12-31"
                value={effective}
                onChange={(e) => setEffective(e.target.value)}
              />
            </div>
            <div className="ys-form-field">
              <label className="ys-label" htmlFor="rules-week-start">
                יום תחילת השבוע
              </label>
              <select
                id="rules-week-start"
                value={rules.weekStartsOn}
                disabled={!!latest}
                onChange={(e) => setRules({ ...rules, weekStartsOn: Number(e.target.value) })}
              >
                {days.map((day, i) => (
                  <option key={day} value={i}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="rules-help">
            התאריך צריך לחול ביום תחילת השבוע. שינוי כללים קיימים חל רק בעתיד. שמירה נוספת לאותו
            תאריך עתידי יוצרת גרסה מחליפה; הגרסאות הקודמות נשמרות.
          </p>
          {!latest && effective < today && (
            <label className="rules-check rules-ack">
              <input
                type="checkbox"
                required
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              <span>אני מאשר/ת שההגדרה הראשונית תסווג גם שעות היסטוריות מתאריך זה.</span>
            </label>
          )}
        </section>
        <section className="report-panel" aria-labelledby="rules-overtime-title">
          <h2 id="rules-overtime-title">שעות רגילות ושעות נוספות</h2>
          <fieldset className="rules-fieldset">
            <legend>מכסה יומית בדקות</legend>
            <p className="rules-help">
              לדוגמה 480 דקות הן 8 שעות. כל משמרות העובד באותו יום מצטברות.
            </p>
            <div className="rules-days">
              {days.map((day, i) => (
                <div className="ys-form-field" key={day}>
                  <label className="ys-label" htmlFor={`rules-day-${i}`}>
                    {day}
                  </label>
                  <input
                    id={`rules-day-${i}`}
                    className="ys-num"
                    required
                    type="number"
                    inputMode="numeric"
                    dir="ltr"
                    min="0"
                    max="1440"
                    step="1"
                    aria-describedby={`rules-day-${i}-hint`}
                    value={rules.dailyMinutes[i]}
                    onChange={(e) => {
                      const dailyMinutes = [...rules.dailyMinutes];
                      dailyMinutes[i] = Number(e.target.value);
                      setRules({ ...rules, dailyMinutes });
                    }}
                  />
                  <span id={`rules-day-${i}-hint`} className="ys-help">
                    {hoursHint(rules.dailyMinutes[i] ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </fieldset>
          <div className="ys-form-grid">
            {numberField('firstOvertimeMinutes', 'דקות במדרגת השעות הנוספות הראשונה', 1440, true)}
            {numberField('firstRate', 'אחוז למדרגה הראשונה', 300)}
            {numberField('secondRate', 'אחוז ליתרת השעות הנוספות', 300)}
            <div className="ys-form-field">
              <label className="ys-label" htmlFor="rules-weeklyMinutes">
                מכסה שבועית בדקות (ריק = ללא מכסה)
              </label>
              <input
                id="rules-weeklyMinutes"
                className="ys-num"
                type="number"
                inputMode="numeric"
                dir="ltr"
                min="0"
                max="10080"
                step="1"
                aria-describedby="rules-weeklyMinutes-hint"
                value={rules.weeklyMinutes ?? ''}
                onChange={(e) =>
                  setRules({
                    ...rules,
                    weeklyMinutes: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
              <span id="rules-weeklyMinutes-hint" className="ys-help">
                {rules.weeklyMinutes === null ? 'ללא מכסה שבועית' : hoursHint(rules.weeklyMinutes)}
              </span>
            </div>
          </div>
        </section>
        <details className="report-panel rules-disclosure">
          <summary>הפסקות</summary>
          <div className="rules-disclosure-body">
            <p className="rules-help">
              ניכוי קבוע לכל משמרת סגורה שהגיעה לסף. לצורך הסיווג בלבד, הניכוי משויך לסוף המשמרת.
              אין לשנות את זמני הנוכחות. 0 דקות = ללא ניכוי.
            </p>
            <div className="ys-form-grid">
              {numberField('breakMinutes', 'דקות לניכוי בכל משמרת', 1440, true)}
              {numberField('breakAfterMinutes', 'ניכוי רק במשמרת שאורכה לפחות (דקות)', 1440, true)}
            </div>
          </div>
        </details>
        <details className="report-panel rules-disclosure">
          <summary>לילה, ימי מנוחה וחגים</summary>
          <div className="rules-disclosure-body">
            <p className="rules-help">
              תוספת לילה חלה רק על השעות שבתוך החלון. ימי מנוחה וחגים חלים מחצות עד חצות. אין זיהוי
              אוטומטי של חגים או ערב חג.
            </p>
            <div className="ys-form-grid">
              {(['nightStart', 'nightEnd'] as const).map((key) => (
                <div className="ys-form-field" key={key}>
                  <label className="ys-label" htmlFor={`rules-${key}`}>
                    {key === 'nightStart' ? 'תחילת חלון לילה' : 'סיום חלון לילה'}
                  </label>
                  <input
                    id={`rules-${key}`}
                    className="ys-num"
                    type="time"
                    dir="ltr"
                    required
                    value={time(rules[key])}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(':').map(Number);
                      setRules({ ...rules, [key]: h! * 60 + m! });
                    }}
                  />
                </div>
              ))}
              {numberField('nightRate', 'אחוז לילה (100 = ללא תוספת)', 300)}
              {numberField('restRate', 'אחוז בימי מנוחה', 300)}
              {numberField('holidayRate', 'אחוז בחגים שנבחרו', 300)}
            </div>
            <fieldset className="rules-fieldset">
              <legend>ימי מנוחה</legend>
              <div className="rules-days">
                {days.map((day, i) => (
                  <label className="rules-check" key={day}>
                    <input
                      type="checkbox"
                      checked={rules.restDays.includes(i)}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          restDays: e.target.checked
                            ? [...rules.restDays, i]
                            : rules.restDays.filter((d) => d !== i),
                        })
                      }
                    />
                    <span>{day}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="ys-form-field">
              <label className="ys-label" htmlFor="rules-holidays">
                תאריכי חגים — תאריך בכל שורה (YYYY-MM-DD)
              </label>
              <textarea
                id="rules-holidays"
                className="ys-num"
                dir="ltr"
                rows={4}
                value={holidayText}
                onChange={(e) => setHolidayText(e.target.value)}
                placeholder="2026-10-01"
              />
            </div>
          </div>
        </details>
        <div role="status" aria-live="polite" className="rules-message">
          {message && (
            <p className={`admin-feedback admin-feedback--${message.tone}`}>
              <span>{message.text}</span>
            </p>
          )}
        </div>
        <div className="ys-form-actions">
          <button
            className="ys-button ys-button--primary rules-save"
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {pending ? 'שומרים…' : 'שמירת כללי התחנה'}
          </button>
        </div>
      </form>
      {policies.length > 0 && (
        <details className="report-panel rules-disclosure">
          <summary>
            גרסאות שמורות (<span className="ys-num">{policies.length}</span>)
          </summary>
          <div className="rules-disclosure-body rules-versions">
            {[...policies].reverse().map((p) => (
              <details key={p.id} className="rules-version">
                <summary>
                  מתאריך <bdi className="ys-num">{p.effectiveFrom}</bdi> · גרסה {p.id}
                </summary>
                <p>
                  מדרגה ראשונה {p.rules.firstOvertimeMinutes} דקות ב-{p.rules.firstRate}%; יתרה ב-
                  {p.rules.secondRate}%. מכסה שבועית: {p.rules.weeklyMinutes ?? 'ללא'} דקות.
                </p>
                <p>מכסות יומיות (ראשון–שבת): {p.rules.dailyMinutes.join(' / ')}</p>
                <p>
                  הפסקה: {p.rules.breakMinutes} דקות אחרי {p.rules.breakAfterMinutes} דקות; לילה:{' '}
                  {time(p.rules.nightStart)}–{time(p.rules.nightEnd)} ב-{p.rules.nightRate}%; מנוחה:{' '}
                  {p.rules.restRate}%; חגים: {p.rules.holidayRate}%.
                </p>
                <p>
                  ימי מנוחה: {p.rules.restDays.map((d) => days[d]).join(', ') || 'ללא'}; חגים:{' '}
                  {p.rules.holidays.join(', ') || 'ללא'}
                </p>
              </details>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
