import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { BrandLogo, Container } from '@yellowshifts/ui';
import { LogoutButton } from './LogoutButton';

export function SchedulingHome({ stations }: { stations: { id: string; name: string }[] }) {
  return (
    <main className="scheduling-home" dir="rtl">
      <Container size="md">
        <header>
          <BrandLogo />
          <LogoutButton variant="outline" />
        </header>
        <h1>סידור העבודה</h1>
        <p>תכנון, שיבוץ ופרסום המשמרות בתחנות שלך.</p>
        <nav aria-label="תחנות לניהול סידור עבודה">
          {stations.map((station) => (
            <Link
              className="station-operation"
              key={station.id}
              href={`/stations/${station.id}/schedules`}
            >
              <span>
                <strong>{station.name}</strong>
                <small>פתיחת סידור העבודה השבועי</small>
              </span>
              <span aria-hidden="true">←</span>
            </Link>
          ))}
        </nav>
      </Container>
    </main>
  );
}
