import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { getServerContext } from '@/app/lib/server-context';
import { Container, PageHeader } from '@yellowshifts/ui';
import { ArrowLeftIcon, CalendarIcon } from '@yellowshifts/icons';
import { AdminHeader } from './AdminHeader';

/** Shift managers' home: the stations whose weekly schedule they manage. */
export async function SchedulingHome({
  stations,
}: {
  stations: { id: string; code: string; name: string }[];
}) {
  // Cached per request: the page that renders this already resolved the same context.
  const { context } = await getServerContext();

  return (
    <main className="admin-page">
      {context && (
        <AdminHeader title="YellowShifts" subtitle="סידורי עבודה" homeHref="/" context={context} />
      )}
      <Container size="md">
        <div className="admin-page-body">
          <PageHeader title="סידור העבודה" description="תכנון, שיבוץ ופרסום המשמרות בתחנות שלך." />
          <nav className="scheduling-home-stations" aria-label="תחנות לניהול סידור עבודה">
            {stations.map((station) => (
              <Link
                className="scheduling-home-station"
                key={station.id}
                href={`/stations/${encodeURIComponent(station.code)}/schedules`}
              >
                <span className="scheduling-home-station-icon" aria-hidden="true">
                  <CalendarIcon size={22} />
                </span>
                <span className="scheduling-home-station-body">
                  <strong>{station.name}</strong>
                  <small>פתיחת סידור העבודה השבועי</small>
                </span>
                <ArrowLeftIcon
                  size={18}
                  aria-hidden="true"
                  className="scheduling-home-station-arrow"
                />
              </Link>
            ))}
          </nav>
        </div>
      </Container>
    </main>
  );
}
