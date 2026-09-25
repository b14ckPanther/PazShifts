import { jsPDF } from 'jspdf';
import {
  addDays,
  clock,
  duration,
  localDate,
  weekStart,
  rateText,
  type HoursReport,
} from './hours-report';

/** Loaded only on export; the Hebrew font is served locally and embedded in the file. */
export function createHoursPdf(report: HoursReport, font: string) {
  const doc = new jsPDF({ compress: true });
  doc.addFileToVFS('Heebo.ttf', font);
  doc.addFont('Heebo.ttf', 'Heebo', 'normal');
  doc.setFont('Heebo');
  let y = 18;
  let continuation = '';
  function text(value: string, x: number, top: number, rtl = true, size = 10) {
    doc.setFontSize(size);
    doc.setR2L(false);
    doc.text(value, x, top, {
      align: rtl ? 'right' : 'left',
      isInputVisual: false,
      isOutputVisual: true,
      isInputRtl: rtl,
      isOutputRtl: false,
    });
  }
  function header() {
    doc.setFillColor('#FFBF00');
    doc.rect(0, 0, 210, 4, 'F');
    doc.setTextColor('#111827');
    text('דוח שעות עבודה', 196, 16, true, 17);
    text(report.station, 196, 24);
    text(`${report.from} — ${report.to} | ${report.timezone}`, 14, 33, false, 9);
    y = 43;
    if (continuation) {
      text(continuation, 196, y, true, 10);
      y += 9;
    }
  }
  function room(height: number) {
    if (y + height > 277) {
      doc.addPage();
      header();
    }
  }
  function line(value: string, size = 10) {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(value, 180) as string[];
    for (const part of lines) {
      room(7);
      text(part, 196, y, true, size);
      y += 7;
    }
  }
  function divider() {
    room(5);
    doc.setDrawColor('#E2E8F0');
    doc.line(14, y, 196, y);
    y += 6;
  }
  function tableHeader() {
    doc.setFillColor('#F1F5F9');
    doc.rect(14, y - 4, 182, 9, 'F');
    for (const [label, x] of [
      ['תאריך', 193],
      ['כניסה', 155],
      ['יציאה', 130],
      ['משך', 105],
      ['מצב / מקור', 76],
    ] as const)
      text(label, x, y + 2, true, 9);
    y += 10;
  }
  function tableRow(
    date: string,
    start: string | null,
    end: string | null,
    seconds: number,
    status: string,
    extraHeight = 0
  ) {
    doc.setFontSize(9);
    const overnight =
      end && localDate(new Date(end), report.timezone) !== date
        ? ` · יציאה ב-${localDate(new Date(end), report.timezone)}`
        : '';
    const lines = doc.splitTextToSize(status + overnight, 60) as string[];
    const height = Math.max(10, lines.length * 5 + 4);
    if (y + height + extraHeight > 277) {
      doc.addPage();
      header();
      tableHeader();
    }
    text(date, 160, y, false, 9);
    text(clock(start, report.timezone), 134, y, false, 9);
    text(clock(end, report.timezone), 109, y, false, 9);
    text(duration(seconds), 80, y, false, 9);
    lines.forEach((part, i) => text(part, 76, y + i * 5, true, 9));
    y += height;
    doc.setDrawColor('#E2E8F0');
    doc.line(14, y - 5, 196, y - 5);
  }
  header();
  line('נוכחות וסיווג לפי כללי התחנה — ללא חישוב שכר כספי.');
  line('התוספות אינן מצטברות; שעות ללא כללים מסומנות בנפרד.');
  line(rateText(report.entries), 9);
  line('רשומות פתוחות, מסומנות וחופפות אינן נכללות בסיכום.');
  line('כל משמרת נספרת בשלמותה לפי תאריך הכניסה, גם אם היציאה למחרת.');
  line('משך מוצג בשעות:דקות:שניות. התיקונים הידניים כלולים ומסומנים.');
  line(`סה״כ שעות סגורות: ${duration(report.entries.reduce((s, e) => s + e.seconds, 0))}`);
  divider();
  line('סיכום הצוות', 14);
  for (const person of report.people) {
    line(
      `${person.name} — ${duration(report.entries.filter((e) => e.personId === person.id).reduce((s, e) => s + e.seconds, 0))}`
    );
  }
  divider();
  for (const person of report.people) {
    continuation = person.name;
    room(30);
    line(person.name, 14);
    line(`קוד עובד: ${person.code || 'לא הוגדר'}`);
    // Stable identity remains available even for duplicate names or missing employee codes.
    room(7);
    text(person.id, 14, y, false, 8);
    y += 7;
    const entries = report.entries.filter((e) => e.personId === person.id);
    line(`סך שעות בתקופה: ${duration(entries.reduce((s, e) => s + e.seconds, 0))}`);
    line(rateText(entries), 9);
    let week = '';
    for (let date = report.from; date <= report.to; date = addDays(date, 1)) {
      const currentWeek = weekStart(date, 0);
      if (week !== currentWeek) {
        week = currentWeek;
        room(21);
        line(
          `שבוע ${week} — סה״כ ${duration(entries.filter((e) => weekStart(e.date, 0) === week).reduce((s, e) => s + e.seconds, 0))}`,
          11
        );
      }
      if (date === report.from || date === currentWeek)
        line(rateText(entries.filter((e) => weekStart(e.date, 0) === week)), 9);
      const daily = entries.filter((e) => e.date === date);
      if (date === report.from || date === currentWeek) {
        room(20);
        tableHeader();
      }
      if (!daily.length) tableRow(date, null, null, 0, 'ללא נוכחות');
      for (const entry of daily) {
        doc.setFontSize(9);
        const extraHeight =
          doc.splitTextToSize(rateText([entry]), 180).length * 7 +
          (entry.reason ? doc.splitTextToSize(entry.reason, 180).length * 7 : 0) +
          (entry.correctedAt ? 7 : 0);
        tableRow(
          date,
          entry.start,
          entry.end,
          entry.seconds,
          `${entry.status} · ${entry.source}`,
          extraHeight
        );
        line(rateText([entry]), 8);
        if (entry.reason) line(`סיבת תיקון: ${entry.reason}`, 9);
        if (entry.correctedAt) {
          room(7);
          text(entry.correctedAt, 14, y, false, 8);
          y += 7;
        }
      }
      if (daily.length > 1)
        line(`סה״כ ביום ${date}: ${duration(daily.reduce((sum, e) => sum + e.seconds, 0))}`, 9);
    }
    divider();
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setTextColor('#475569');
    text(`${page} / ${pages}`, 14, 289, false, 9);
    text(
      `הופק: ${new Date(report.generatedAt).toLocaleString('he-IL', { timeZone: report.timezone })}`,
      196,
      289,
      true,
      8
    );
  }
  return doc;
}
export async function exportHoursPdf(report: HoursReport, filename: string) {
  const response = await fetch('/fonts/Heebo-Regular.ttf');
  if (!response.ok || response.redirected) throw new Error('Font unavailable');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] !== 0 || bytes[1] !== 1 || bytes[2] !== 0 || bytes[3] !== 0)
    throw new Error('Invalid font');
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  createHoursPdf(report, btoa(binary)).save(`${filename}.pdf`);
}
