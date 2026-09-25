'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
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
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function numberField(key: keyof HourRules, label: string, max = 1440) {
    return (
      <label>
        {label}
        <input
          type="number"
          min={key.toLowerCase().includes('rate') ? 100 : 0}
          max={max}
          step="1"
          required
          value={rules[key] as number}
          onChange={(e) => setRules({ ...rules, [key]: Number(e.target.value) })}
        />
      </label>
    );
  }
  return (
    <main className="hours-report hour-rules" dir="rtl">
      <Link href={`/stations/${stationId}/reports`}>← חזרה לדוח השעות</Link>
      <header>
        <p>{stationName}</p>
        <h1>כללי שעות ותוספות</h1>
        <p>הגדרות התחנה לדוחות העובדים ולהנהלת חשבונות</p>
      </header>
      <div className="report-panel rules-explanation">
        <strong>
          {latest ? 'הכללים נשמרים בגרסאות מתוארכות' : 'טיוטה בלבד — טרם הוגדרו כללים לתחנה'}
        </strong>
        <p>
          הערכים הראשוניים הם דוגמה לעריכה, לא קביעה של זכאות על פי דין. החישוב נעשה לכל תחנה בנפרד,
          לפי ימים קלנדריים באזור הזמן של התחנה; משמרת לילה מתפצלת בחצות.
        </p>
        <p>
          כאשר כמה תוספות חלות יחד, נלקח האחוז הגבוה ביותר — ללא חיבור אחוזים. שעות נוספות יומיות
          אינן נספרות שוב במכסה השבועית. מדרגת השעות הנוספות הראשונה משותפת לחריגה היומית והשבועית
          באותו יום.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMessage('');
          startTransition(async () => {
            try {
              const result = await saveHourRules(
                stationId,
                effective,
                { ...rules, holidays: holidayText.split(/[\s,]+/).filter(Boolean) },
                ack
              );
              if (result.error) setMessage(result.error);
              else {
                setMessage('הכללים נשמרו. הדוחות יחושבו בהתאם לתאריך התחילה.');
                router.refresh();
              }
            } catch {
              setMessage('לא ניתן לשמור כרגע. נסו שוב.');
            }
          });
        }}
      >
        <section className="report-panel">
          <h2>תחילה ושבוע עבודה</h2>
          <div className="rules-grid">
            <label>
              בתוקף מתאריך
              <input
                type="date"
                required
                min={latest ? addDays(today, 1) : '2000-01-01'}
                max="2100-12-31"
                value={effective}
                onChange={(e) => setEffective(e.target.value)}
              />
            </label>
            <label>
              יום תחילת השבוע
              <select
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
            </label>
          </div>
          <p>
            התאריך צריך לחול ביום תחילת השבוע. שינוי כללים קיימים חל רק בעתיד. שמירה נוספת לאותו
            תאריך עתידי יוצרת גרסה מחליפה; הגרסאות הקודמות נשמרות.
          </p>
          {!latest && effective < today && (
            <label className="rules-check">
              <input
                type="checkbox"
                required
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              אני מאשר/ת שההגדרה הראשונית תסווג גם שעות היסטוריות מתאריך זה.
            </label>
          )}
        </section>
        <section className="report-panel">
          <h2>שעות רגילות ושעות נוספות</h2>
          <p>מכסה יומית בדקות — לדוגמה 480 דקות הן 8 שעות. כל משמרות העובד באותו יום מצטברות.</p>
          <div className="rules-days">
            {days.map((day, i) => (
              <label key={day}>
                {day}
                <input
                  required
                  type="number"
                  min="0"
                  max="1440"
                  step="1"
                  value={rules.dailyMinutes[i]}
                  onChange={(e) => {
                    const dailyMinutes = [...rules.dailyMinutes];
                    dailyMinutes[i] = Number(e.target.value);
                    setRules({ ...rules, dailyMinutes });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="rules-grid">
            {numberField('firstOvertimeMinutes', 'דקות במדרגת השעות הנוספות הראשונה')}
            {numberField('firstRate', 'אחוז למדרגה הראשונה', 300)}
            {numberField('secondRate', 'אחוז ליתרת השעות הנוספות', 300)}
            <label>
              מכסה שבועית בדקות (ריק = ללא מכסה)
              <input
                type="number"
                min="0"
                max="10080"
                step="1"
                value={rules.weeklyMinutes ?? ''}
                onChange={(e) =>
                  setRules({
                    ...rules,
                    weeklyMinutes: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
        </section>
        <details className="report-panel">
          <summary>הפסקות</summary>
          <p>
            ניכוי קבוע לכל משמרת סגורה שהגיעה לסף. לצורך הסיווג בלבד, הניכוי משויך לסוף המשמרת. אין
            לשנות את זמני הנוכחות. 0 דקות = ללא ניכוי.
          </p>
          <div className="rules-grid">
            {numberField('breakMinutes', 'דקות לניכוי בכל משמרת')}
            {numberField('breakAfterMinutes', 'ניכוי רק במשמרת שאורכה לפחות (דקות)')}
          </div>
        </details>
        <details className="report-panel">
          <summary>לילה, ימי מנוחה וחגים</summary>
          <p>
            תוספת לילה חלה רק על השעות שבתוך החלון. ימי מנוחה וחגים חלים מחצות עד חצות. אין זיהוי
            אוטומטי של חגים או ערב חג.
          </p>
          <div className="rules-grid">
            {(['nightStart', 'nightEnd'] as const).map((key) => (
              <label key={key}>
                {key === 'nightStart' ? 'תחילת חלון לילה' : 'סיום חלון לילה'}
                <input
                  type="time"
                  dir="ltr"
                  required
                  value={time(rules[key])}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number);
                    setRules({ ...rules, [key]: h! * 60 + m! });
                  }}
                />
              </label>
            ))}
            {numberField('nightRate', 'אחוז לילה (100 = ללא תוספת)', 300)}
            {numberField('restRate', 'אחוז בימי מנוחה', 300)}
            {numberField('holidayRate', 'אחוז בחגים שנבחרו', 300)}
          </div>
          <fieldset>
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
                  {day}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            תאריכי חגים — תאריך בכל שורה (YYYY-MM-DD)
            <textarea
              dir="ltr"
              rows={4}
              value={holidayText}
              onChange={(e) => setHolidayText(e.target.value)}
              placeholder="2026-10-01"
            />
          </label>
        </details>
        <p role="status" className="rules-message">
          {message}
        </p>
        <button className="rules-save" disabled={pending}>
          {pending ? 'שומרים…' : 'שמירת כללי התחנה'}
        </button>
      </form>
      {policies.length > 0 && (
        <details className="report-panel">
          <summary>גרסאות שמורות ({policies.length})</summary>
          {[...policies].reverse().map((p) => (
            <details key={p.id} className="rules-version">
              <summary>
                מתאריך <bdi>{p.effectiveFrom}</bdi> · גרסה {p.id}
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
        </details>
      )}
    </main>
  );
}
