import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { StationIcon, ArrowRightIcon } from '@yellowshifts/icons';

export default function WebNotFound() {
  return (
    <main className="mobile-flow">
      <section className="attendance-panel">
        <div className="attendance-symbol attendance-neutral" aria-hidden="true">
          <StationIcon size={36} />
        </div>
        <h1>404 — הדף המבוקש לא נמצא</h1>
        <p>הכתובת אליה ניסית לגשת אינה קיימת או שהועברה למיקום אחר.</p>
        <Link href="/" className="mobile-primary">
          <ArrowRightIcon size={18} aria-hidden="true" />
          חזרה לדף הראשי
        </Link>
      </section>
    </main>
  );
}
