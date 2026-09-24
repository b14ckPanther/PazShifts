import { redirect, notFound } from 'next/navigation';
import { getHourPolicies, getStationById } from '@yellowshifts/database';
import { getServerContext } from '@/app/lib/server-context';
import {
  addDays,
  shiftReportEntries,
  dayBoundary,
  localDate,
  validDate,
  weekStart,
} from '@/app/lib/hours-report';
import { readReportAttendance, readReportPeople } from '@/app/lib/report-query';
import { HoursReportClient } from './HoursReportClient';

interface ReportsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function ReportsPage({ params, searchParams }: ReportsPageProps) {
  const { id } = await params;
  const { supabase, context } = await getServerContext();
  if (!context) redirect('/login');

  if (
    !context.isPlatformAdmin &&
    !context.memberships.some(
      (m) =>
        (m.station.id === id || m.station.code?.toUpperCase() === id.toUpperCase()) &&
        m.membership.role === 'ADMIN' &&
        m.membership.status === 'ACTIVE'
    )
  )
    redirect('/');

  const station = await getStationById(supabase, id);
  if (!station) notFound();
  const today = localDate(new Date(), station.timezone);
  const query = await searchParams;
  try {
    const policies = await getHourPolicies(supabase, id);
    const from =
      typeof query.from === 'string' && validDate(query.from) ? query.from : weekStart(today, 0);
    const to = typeof query.to === 'string' && validDate(query.to) ? query.to : addDays(from, 6);
    if (to < from || Date.parse(to) - Date.parse(from) > 92 * 86400000)
      return (
        <main dir="rtl" style={{ padding: 24 }}>
          יש לבחור טווח של עד 93 ימים, עם תאריך סיום אחרי תאריך ההתחלה.{' '}
          <a href={`/stations/${id}/reports`}>חזרה לדוח השבועי</a>
        </main>
      );
    const [records, people] = await Promise.all([
      readReportAttendance(
        supabase,
        id,
        new Date(dayBoundary(addDays(from, -7), station.timezone)).toISOString(),
        new Date(dayBoundary(addDays(to, 1), station.timezone)).toISOString()
      ),
      readReportPeople(supabase, id),
    ]);
    for (const record of records)
      if (!people.some((p) => p.id === record.station_membership_id))
        people.push({ id: record.station_membership_id, name: 'עובד היסטורי', code: '' });
    people.sort((a, b) => a.name.localeCompare(b.name, 'he'));
    return (
      <HoursReportClient
        stationId={id}
        today={today}
        report={{
          station: station.name,
          timezone: station.timezone,
          from,
          to,
          generatedAt: new Date().toISOString(),
          people,
          entries: shiftReportEntries(records, from, to, station.timezone, policies),
          policies: policies.map(({ id, effectiveFrom }) => ({ id, effectiveFrom })),
          rateWeekStartsOn: policies[0]?.rules.weekStartsOn,
        }}
      />
    );
  } catch {
    return (
      <main dir="rtl" style={{ padding: 24 }}>
        <h1>דוח השעות לא נטען</h1>
        <p>לא יוצג דוח חלקי. נסו לרענן או לבחור תקופה קצרה יותר.</p>
        <a href={`/stations/${id}/reports`}>טעינת השבוע הנוכחי מחדש</a>
      </main>
    );
  }
}
