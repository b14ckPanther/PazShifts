import type { ReactNode } from 'react';
import { redirect, notFound } from 'next/navigation';
import { getServerContext, getCachedStation } from '@/app/lib/server-context';
import { getHourPolicies } from '@yellowshifts/database';
import { localDate } from '@yellowshifts/reports';
import { Container, EmptyState } from '@yellowshifts/ui';
import { WarningIcon } from '@yellowshifts/icons';
import { StationHeader } from '@/app/components/StationHeader';
import { HourRulesForm } from './HourRulesForm';
export default async function HourRulesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, context } = await getServerContext();
  if (!context) redirect('/login');

  const station = await getCachedStation(id);
  if (!station) notFound();

  if (
    !context.isPlatformAdmin &&
    !context.memberships.some(
      (m) =>
        (m.station.id === station.id ||
          m.station.code.toUpperCase() === station.code.toUpperCase()) &&
        m.membership.role === 'ADMIN' &&
        m.membership.status === 'ACTIVE'
    )
  )
    redirect('/');
  const shell = (children: ReactNode) => (
    <main className="admin-page">
      <StationHeader station={station} context={context} pageTitle="כללי שעות" />
      <Container size="lg">
        <div className="admin-page-body">{children}</div>
      </Container>
    </main>
  );
  try {
    const policies = await getHourPolicies(supabase, id);
    return shell(
      <HourRulesForm
        stationId={id}
        stationName={station.name}
        today={localDate(new Date(), station.timezone)}
        policies={policies}
      />
    );
  } catch {
    return shell(
      <EmptyState
        className="admin-empty-panel"
        role="alert"
        icon={<WarningIcon size={26} />}
        title="לא ניתן לטעון כללי שעות"
        description="יש לוודא שמיגרציית כללי השעות הוחלה ושהחיבור זמין."
        action={
          <a href={`/stations/${id}/reports`} className="ys-button ys-button--primary">
            חזרה לדוח
          </a>
        }
      />
    );
  }
}
