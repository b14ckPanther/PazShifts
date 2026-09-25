import { redirect } from 'next/navigation';
import { getMobileHome } from '@yellowshifts/database/public';
import { Container } from '@yellowshifts/ui';
import { getServerContext } from '../lib/server-context';
import { WorkerHeader } from '../components/WorkerHeader';
import { StationSelector } from '../components/StationSelector';
import { WorkerHome } from './WorkerHome';
import './home.css';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const { supabase, context } = await getServerContext();
  if (!context) redirect('/login?next=/home');
  const { stationId } = await searchParams;
  const membership = stationId
    ? context.memberships.find((m) => m.station.id === stationId)
    : context.memberships[0];
  if (!membership) redirect('/');
  let data;
  try {
    data = await getMobileHome(
      // The SSR adapter and mobile query use compatible clients with different SDK type versions.
      supabase as unknown as Parameters<typeof getMobileHome>[0],
      context.user.id,
      membership.station.id
    );
  } catch {
    data = null;
  }
  return (
    <main className="worker-home-page">
      <WorkerHeader
        station={membership.station}
        user={context.user}
        profile={context.profile}
        role={membership.membership.role}
        isPlatformAdmin={context.isPlatformAdmin}
        activeTab="home"
        pageTitle="ראשי"
      />
      <Container size="md">
        {context.memberships.length > 1 && (
          <StationSelector
            memberships={context.memberships}
            activeStationId={membership.station.id}
          />
        )}
        <WorkerHome
          key={`${context.user.id}:${membership.station.id}`}
          data={data}
          name={context.profile?.fullName || 'לך'}
          station={membership.station.name}
        />
      </Container>
    </main>
  );
}
