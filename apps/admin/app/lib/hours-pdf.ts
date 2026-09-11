import { jsPDF } from 'jspdf';
import { addDays, clock, duration, weekStart, type HoursReport } from './hours-report';

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
  header();
  line('שעות נוכחות בלבד — ללא חישוב שכר או הפסקות.');
  line('רשומות פתוחות, מסומנות וחופפות אינן נכללות בסיכום.');
  line('משמרות לילה מחולקות לפי יום; שעות מחוץ לתקופה אינן נספרות.');
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
    let week = '';
    for (let date = report.from; date <= report.to; date = addDays(date, 1)) {
      const currentWeek = weekStart(date);
      if (week !== currentWeek) {
        week = currentWeek;
        room(21);
        line(
          `שבוע ${week} — סה״כ ${duration(entries.filter((e) => weekStart(e.date) === week).reduce((s, e) => s + e.seconds, 0))}`,
          11
        );
      }
      const daily = entries.filter((e) => e.date === date);
      room(daily.length ? 55 : 14);
      line(`${date} — ${duration(daily.reduce((s, e) => s + e.seconds, 0))}`);
      for (const entry of daily) {
        doc.setFontSize(9);
        const reasonLines = entry.reason
          ? doc.splitTextToSize(`סיבת תיקון: ${entry.reason}`, 180).length
          : 0;
        room(
          Math.min(
            100,
            15 + reasonLines * 7 + (entry.correctedAt ? 7 : 0) + (entry.status !== 'הושלמה' ? 7 : 0)
          )
        );
        text(
          `${clock(entry.start, report.timezone)} > ${clock(entry.end, report.timezone)} | ${duration(entry.seconds)}`,
          14,
          y,
          false,
          9
        );
        y += 6;
        line(`${entry.status} · ${entry.source}`, 9);
        if (entry.status !== 'הושלמה') {
          room(7);
          text(`${entry.start} > ${entry.end || 'OPEN'}`, 14, y, false, 8);
          y += 7;
        }
        if (entry.reason) line(`סיבת תיקון: ${entry.reason}`, 9);
        if (entry.correctedAt) {
          room(7);
          text(entry.correctedAt, 14, y, false, 8);
          y += 7;
        }
      }
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
