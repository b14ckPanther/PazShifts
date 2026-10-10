'use client';

import { AlertGlyph } from '@yellowshifts/icons';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
export default function WebError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mobile-flow">
      <section className="attendance-panel">
        <div className="attendance-symbol attendance-warning" aria-hidden="true">
          <AlertGlyph size={40} strokeWidth={2} variant="duo" />
        </div>
        <h1>לא הצלחנו לטעון</h1>
        <p>בדקו את החיבור ונסו שוב. אם סרקתם תג, חכו לאישור הנוכחות על המסך.</p>
        <button className="mobile-primary" onClick={reset}>
          ניסיון חוזר
        </button>
        <Link className="attendance-home" href="/">
          למסך שלי
        </Link>
      </section>
    </main>
  );
}
