import type { ReactNode } from 'react';
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
import { Container, EmptyState } from '@yellowshifts/ui';
import { CalendarIcon, WarningIcon } from '@yellowshifts/icons';
import { StationHeader } from '@/app/components/StationHeader';
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
  const shell = (children: ReactNode) => (
    <main className="admin-page">
      <StationHeader station={station} context={context} pageTitle="דוח שעות" />
      <Container size="xl">
        <div className="admin-page-body">{children}</div>
      </Container>
    </main>
  );
  try {
    const policies = await getHourPolicies(supabase, id);
    const from =
      typeof query.from === 'string' && validDate(query.from) ? query.from : weekStart(today, 0);
    const to = typeof query.to === 'string' && validDate(query.to) ? query.to : addDays(from, 6);
    if (to < from || Date.parse(to) - Date.parse(from) > 92 * 86400000)
      return shell(
        <EmptyState
          className="admin-empty-panel"
          role="alert"
          icon={<CalendarIcon size={26} />}
          title="טווח התאריכים אינו תקין"
          description="יש לבחור טווח של עד 93 ימים, עם תאריך סיום אחרי תאריך ההתחלה."
          action={
            <a href={`/stations/${id}/reports`} className="ys-button ys-button--primary">
              חזרה לדוח השבועי
            </a>
          }
        />
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
    return shell(
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
    return shell(
      <EmptyState
        className="admin-empty-panel"
        role="alert"
        icon={<WarningIcon size={26} />}
        title="דוח השעות לא נטען"
        description="לא יוצג דוח חלקי. נסו לרענן או לבחור תקופה קצרה יותר."
        action={
          <a href={`/stations/${id}/reports`} className="ys-button ys-button--primary">
            טעינת השבוע הנוכחי מחדש
          </a>
        }
      />
    );
  }
}
