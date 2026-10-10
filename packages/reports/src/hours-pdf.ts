import { jsPDF } from 'jspdf';
import {
  decimalHours,
  displayDate,
  entryNote,
  hoursSummary,
  hundredths,
  isCounted,
  payRateKeys,
  printedHours,
  printedRates,
  shortClock,
  shortDate,
  weekdayLabel,
  type HoursReport,
  type ReportEntry,
  type ReportPerson,
} from './hours-report';

export type PdfAssets = { regular: string; bold?: string; logo?: string };

const PAGE = { width: 210, height: 297, margin: 14 };
const RIGHT = PAGE.width - PAGE.margin;
const CONTENT = PAGE.width - PAGE.margin * 2;
const BODY_BOTTOM = 276;
const ROW = 7.4;
const INK = '#1c1714';
const MUTED = '#6e665f';
const HAIRLINE = '#e6e2da';
const SOFT = '#faf9f6';
const YELLOW = '#fcbc00';
const YELLOW_SUBTLE = '#fff4cc';
const CRIMSON = '#d10040';
const WARNING = '#8a4b00';
const HEBREW = /[֐-׿]/;

type Column = {
  label: string;
  width: number;
  align?: 'center' | 'right';
};

/** Generated on the client and loaded only on export; fonts and logo are served locally. */
export function createHoursPdf(report: HoursReport, assets: PdfAssets) {
  const doc = new jsPDF({ compress: true });
  doc.addFileToVFS('Heebo.ttf', assets.regular);
  doc.addFont('Heebo.ttf', 'Heebo', 'normal');
  doc.addFileToVFS('Heebo-Bold.ttf', assets.bold ?? assets.regular);
  doc.addFont('Heebo-Bold.ttf', 'Heebo', 'bold');
  doc.setFont('Heebo', 'normal');
  doc.setLineHeightFactor(1);

  const period = `${displayDate(report.from)} – ${displayDate(report.to)}`;
  let y = 0;

  function text(
    value: string,
    x: number,
    top: number,
    {
      size = 9.5,
      bold = false,
      color = INK,
      align = 'right',
    }: { size?: number; bold?: boolean; color?: string; align?: 'left' | 'right' | 'center' } = {}
  ) {
    const rtl = HEBREW.test(value);
    doc.setFont('Heebo', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.setR2L(false);
    doc.text(value, x, top, {
      align,
      baseline: 'middle',
      isInputVisual: false,
      isOutputVisual: true,
      isInputRtl: rtl,
      isOutputRtl: false,
    });
  }

  function header(title: string, subtitle: string) {
    doc.setFillColor(YELLOW);
    doc.rect(0, 0, PAGE.width, 2.2, 'F');
    let titleX = RIGHT;
    if (assets.logo) {
      doc.addImage(assets.logo, 'PNG', RIGHT - 15, 9, 15, 15);
      titleX = RIGHT - 19;
    }
    text(title, titleX, 14.2, { size: 17, bold: true });
    text(subtitle, titleX, 21.2, { size: 10, color: MUTED });
    text(period, PAGE.margin, 14.2, { size: 11, bold: true, align: 'left' });
    doc.setDrawColor(HAIRLINE);
    doc.setLineWidth(0.3);
    doc.line(PAGE.margin, 29, RIGHT, 29);
    y = 35;
  }

  function stats(items: { label: string; value: string }[]) {
    const gap = 3;
    const width = Math.min(42, (CONTENT - gap * (items.length - 1)) / items.length);
    const height = 18;
    items.forEach((item, i) => {
      const right = RIGHT - i * (width + gap);
      doc.setFillColor(i === 0 ? INK : SOFT);
      doc.setDrawColor(i === 0 ? INK : HAIRLINE);
      doc.roundedRect(right - width, y, width, height, 2.2, 2.2, 'FD');
      const color = i === 0 ? '#ffffff' : INK;
      const muted = i === 0 ? '#d8d2cb' : MUTED;
      text(item.label, right - 3.5, y + 4.8, { size: 8, color: muted });
      text(item.value, right - 3.5, y + 11.6, { size: 14, bold: true, color });
    });
    y += height + 7;
  }

  function columnsAt(columns: Column[]) {
    let right = RIGHT;
    return columns.map((column) => {
      const at = { ...column, right, left: right - column.width };
      right -= column.width;
      return at;
    });
  }

  function cell(
    value: string,
    column: ReturnType<typeof columnsAt>[number],
    top: number,
    options: { bold?: boolean; color?: string; size?: number } = {}
  ) {
    if (!value) return;
    if (column.align === 'right') text(value, column.right - 2.5, top, options);
    else text(value, column.left + column.width / 2, top, { ...options, align: 'center' });
  }

  function tableHead(columns: ReturnType<typeof columnsAt>) {
    doc.setFillColor(INK);
    doc.roundedRect(PAGE.margin, y, CONTENT, ROW + 0.6, 1.6, 1.6, 'F');
    for (const column of columns)
      cell(column.label, column, y + (ROW + 0.6) / 2, { bold: true, color: '#ffffff', size: 8.5 });
    y += ROW + 0.6;
  }

  function rowBackground(index: number) {
    if (index % 2) {
      doc.setFillColor(SOFT);
      doc.rect(PAGE.margin, y, CONTENT, ROW, 'F');
    }
    doc.setDrawColor(HAIRLINE);
    doc.setLineWidth(0.2);
    doc.line(PAGE.margin, y + ROW, RIGHT, y + ROW);
  }

  function totalRow(columns: ReturnType<typeof columnsAt>, values: (string | undefined)[]) {
    y += 1.2;
    doc.setFillColor(YELLOW_SUBTLE);
    doc.setDrawColor(YELLOW);
    doc.setLineWidth(0.3);
    doc.roundedRect(PAGE.margin, y, CONTENT, ROW + 1, 1.6, 1.6, 'FD');
    columns.forEach((column, i) => {
      if (values[i]) cell(values[i]!, column, y + (ROW + 1) / 2, { bold: true, size: 10 });
    });
    y += ROW + 1;
  }

  // 100/125/150 are always printed; station rules may add other percentages.
  const rateKeys = payRateKeys;
  // Totals are sums of the printed per-shift values, so every column adds up on paper.
  const printed = printedHours;
  const sumHours = (entries: ReportEntry[]) =>
    entries.reduce((sum, e) => sum + hundredths(e.seconds), 0);
  const rows = printedRates(report.entries);
  const rowRates = (entry: ReportEntry) => rows.get(entry) ?? {};
  const sumRate = (entries: ReportEntry[], rate: string) =>
    entries.reduce((sum, e) => sum + (rowRates(e)[rate] || 0), 0);
  const rateValue = (entries: ReportEntry[], rate: string) => {
    const value = sumRate(entries, rate);
    return value > 0 ? printed(value) : '';
  };

  function personPage(person: ReportPerson, entries: ReportEntry[]) {
    const title = person.name;
    header(title, report.station);
    const summary = hoursSummary(entries);
    const rates = rateKeys(entries);
    const items = [
      { label: 'סה״כ שעות', value: printed(sumHours(entries)) },
      { label: 'ימי עבודה', value: String(summary.days) },
      { label: 'משמרות', value: String(summary.shifts) },
    ];
    if (!entries.length) {
      stats(items);
      text('לא נרשמו משמרות בתקופה זו.', RIGHT, y + 4, { color: MUTED, size: 11 });
      return;
    }
    stats(items);

    const notes = entries.some((e) => entryNote(e));
    const fixed = 22 + 10 + 19 + 24 + 19 + rates.length * 17;
    const spare = CONTENT - fixed;
    const columns = columnsAt([
      { label: 'תאריך', width: 22 + (notes ? 0 : spare * 0.2), align: 'right' },
      { label: 'יום', width: 10 },
      { label: 'כניסה', width: 19 + (notes ? 0 : spare * 0.2) },
      { label: 'יציאה', width: 24 + (notes ? 0 : spare * 0.2) },
      { label: 'שעות', width: 19 + (notes ? 0 : spare * 0.2) },
      ...rates.map((rate) => ({
        label: `${rate}%`,
        width: 17 + (notes ? 0 : (spare * 0.2) / rates.length),
      })),
      ...(notes ? [{ label: 'הערה', width: spare, align: 'right' as const }] : []),
    ]);
    tableHead(columns);
    let previousDate = '';
    entries.forEach((entry, index) => {
      if (y + ROW > BODY_BOTTOM - ROW - 2) {
        doc.addPage();
        header(title, report.station);
        tableHead(columns);
        previousDate = '';
      }
      rowBackground(index);
      const middle = y + ROW / 2;
      const counted = isCounted(entry);
      const dimmed = counted ? INK : MUTED;
      if (entry.date !== previousDate) {
        cell(shortDate(entry.date, report), columns[0]!, middle);
        cell(weekdayLabel(entry.date), columns[1]!, middle, { color: MUTED });
      }
      previousDate = entry.date;
      cell(shortClock(entry.start, report.timezone), columns[2]!, middle, { color: dimmed });
      cell(shortClock(entry.end, report.timezone), columns[3]!, middle, { color: dimmed });
      cell(counted ? decimalHours(entry.seconds) : '—', columns[4]!, middle, {
        bold: counted,
        color: dimmed,
      });
      rates.forEach((rate, i) =>
        cell(rateValue([entry], rate), columns[5 + i]!, middle, { color: dimmed })
      );
      if (notes) {
        const value = entryNote(entry);
        cell(value, columns[columns.length - 1]!, middle, {
          size: 8,
          color: counted ? MUTED : WARNING,
        });
      }
      y += ROW;
    });
    totalRow(columns, [
      'סה״כ',
      '',
      '',
      '',
      printed(sumHours(entries)),
      ...rates.map((rate) => rateValue(entries, rate)),
    ]);
  }

  function teamPage(people: ReportPerson[]) {
    header('סיכום צוות', report.station);
    const summary = hoursSummary(report.entries);
    const rates = rateKeys(report.entries);
    stats([
      { label: 'סה״כ שעות', value: printed(sumHours(report.entries)) },
      { label: 'עובדים', value: String(people.length) },
      { label: 'משמרות', value: String(summary.shifts) },
    ]);
    const fixed = 18 + 20 + 22 + rates.length * 18;
    const columns = columnsAt([
      { label: 'עובד', width: CONTENT - fixed, align: 'right' },
      { label: 'ימי עבודה', width: 18 },
      { label: 'משמרות', width: 20 },
      { label: 'שעות', width: 22 },
      ...rates.map((rate) => ({ label: `${rate}%`, width: 18 })),
    ]);
    tableHead(columns);
    people.forEach((person, index) => {
      if (y + ROW > BODY_BOTTOM - ROW - 2) {
        doc.addPage();
        header('סיכום צוות', report.station);
        tableHead(columns);
      }
      const entries = report.entries.filter((e) => e.personId === person.id);
      const own = hoursSummary(entries);
      rowBackground(index);
      const middle = y + ROW / 2;
      cell(person.name, columns[0]!, middle, { bold: true });
      cell(String(own.days), columns[1]!, middle);
      cell(String(own.shifts), columns[2]!, middle);
      cell(printed(sumHours(entries)), columns[3]!, middle, { bold: true });
      rates.forEach((rate, i) => cell(rateValue(entries, rate), columns[4 + i]!, middle));
      y += ROW;
    });
    totalRow(columns, [
      'סה״כ',
      String(summary.days),
      String(summary.shifts),
      printed(sumHours(report.entries)),
      ...rates.map((rate) => rateValue(report.entries, rate)),
    ]);
  }

  // Team exports open with one summary page; only workers with attendance get a page.
  const people = report.people.filter(
    (person) => report.people.length === 1 || report.entries.some((e) => e.personId === person.id)
  );
  if (report.people.length > 1) {
    teamPage(people);
    for (const person of people) {
      doc.addPage();
      personPage(
        person,
        report.entries.filter((e) => e.personId === person.id)
      );
    }
  } else if (people[0]) personPage(people[0], report.entries);
  else header('דוח שעות', report.station);

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(HAIRLINE);
    doc.setLineWidth(0.3);
    doc.line(PAGE.margin, 283, RIGHT, 283);
    doc.setFont('Heebo', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(INK);
    doc.text('Darb', PAGE.margin, 288.5, { baseline: 'middle' });
    doc.setTextColor(CRIMSON);
    doc.text('.', PAGE.margin + doc.getTextWidth('Darb'), 288.5, { baseline: 'middle' });
    if (pages > 1)
      text(`${page} / ${pages}`, RIGHT, 288.5, { size: 8, color: MUTED, align: 'right' });
  }
  return doc;
}

async function base64(path: string, check?: (bytes: Uint8Array) => boolean) {
  const response = await fetch(path);
  if (!response.ok || response.redirected) throw new Error(`Unavailable: ${path}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (check && !check(bytes)) throw new Error(`Invalid: ${path}`);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
const isTrueType = (bytes: Uint8Array) =>
  bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0;

export async function exportHoursPdf(report: HoursReport, filename: string) {
  const [regular, bold, logo] = await Promise.all([
    base64('/fonts/Heebo-Regular.ttf', isTrueType),
    // Bold weight and logo are presentation only; the report still exports without them.
    base64('/fonts/Heebo-Bold.ttf', isTrueType).catch(() => undefined),
    base64('/brand/logomark-report.png', (b) => b[0] === 0x89 && b[1] === 0x50)
      .then((data) => `data:image/png;base64,${data}`)
      .catch(() => undefined),
  ]);
  createHoursPdf(report, { regular, bold, logo }).save(`${filename}.pdf`);
}
