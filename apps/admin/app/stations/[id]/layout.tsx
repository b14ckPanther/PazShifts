import { getServerContext } from '@/app/lib/server-context';
import { StationDock } from '../../components/StationDock';
export default async function StationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { context } = await getServerContext();
  const membership = context?.memberships.find(
    (m) => m.station.id === id && m.membership.status === 'ACTIVE'
  );
  const admin = !!context?.isPlatformAdmin || membership?.membership.role === 'ADMIN';
  const canSchedule = admin || membership?.membership.role === 'SHIFT_MANAGER';
  return (
    <>
      {children}
      {canSchedule && <StationDock stationId={id} admin={admin} />}
    </>
  );
}
