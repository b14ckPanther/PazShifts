import { redirect } from 'next/navigation';
import { getServerContext } from '@/app/lib/server-context';
import { readOwnReportAttendance, getHourPolicies } from '@yellowshifts/database';
import {
  addDays,
  shiftReportEntries,
  dayBoundary,
  localDate,
  validDate,
  weekStart,
} from '@yellowshifts/reports';
import { WorkerHoursClient } from './WorkerHoursClient';

export default async function WorkerHoursPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string; from?: string; to?: string }>;
}) {
  const { supabase, context } = await getServerContext();
  if (!context) redirect('/login?next=%2Fhours');
  const query = await searchParams;
  const membership = query.stationId
    ? context.memberships.find((m) => m.station.id === query.stationId)
    : context.memberships[0];
  if (!membership)
    return (
      <main dir="rtl" style={{ padding: 24 }}>
        <h1>השעות שלי</h1>
        <p>לא נמצאה תחנה זמינה לחשבון שלך.</p>
        <a href="/">חזרה למסך הראשי</a>
      </main>
    );
  const { station } = membership;
  const today = localDate(new Date(), station.timezone);
  try {
    const policies = await getHourPolicies(supabase, station.id);
    const from =
      typeof query.from === 'string' && validDate(query.from) ? query.from : weekStart(today, 0);
    const to = typeof query.to === 'string' && validDate(query.to) ? query.to : addDays(from, 6);
    if (to < from || Date.parse(to) - Date.parse(from) > 92 * 86400000)
      return (
        <main dir="rtl" style={{ padding: 24 }}>
          <p>יש לבחור תקופה של עד 93 ימים.</p>
          <a href={`/hours?stationId=${station.id}`}>חזרה לדוח השבועי</a>
        </main>
      );
    const records = await readOwnReportAttendance(
      supabase,
      context.user.id,
      station.id,
      new Date(dayBoundary(addDays(from, -7), station.timezone)).toISOString(),
      new Date(dayBoundary(addDays(to, 1), station.timezone)).toISOString()
    );
    return (
      <WorkerHoursClient
        stationId={station.id}
        today={today}
        stations={context.memberships.map((m) => ({ id: m.station.id, name: m.station.name }))}
        station={station}
        user={context.user}
        profile={context.profile}
        memberships={context.memberships}
        report={{
          station: station.name,
          timezone: station.timezone,
          from,
          to,
          generatedAt: new Date().toISOString(),
          people: [
            {
              id: membership.membership.id,
              name: context.profile?.fullName || 'החשבון שלי',
              code: membership.membership.employeeCode || '',
            },
          ],
          entries: shiftReportEntries(records, from, to, station.timezone, policies),
          policies: policies.map(({ id, effectiveFrom }) => ({ id, effectiveFrom })),
          rateWeekStartsOn: policies[0]?.rules.weekStartsOn,
        }}
      />
    );
  } catch {
    return (
      <main dir="rtl" style={{ padding: 24 }}>
        <h1>לא הצלחנו לטעון את השעות</h1>
        <p>לא יוצג דוח חלקי. נסו שוב בעוד רגע.</p>
        <a href={`/hours?stationId=${station.id}`}>טעינה מחדש</a>
      </main>
    );
  }
}
