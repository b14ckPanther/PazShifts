import { NfcIcon } from '@yellowshifts/icons';
export default function WebLoading() {
  return (
    <main className="mobile-flow" aria-busy="true">
      <section className="attendance-panel" role="status">
        <div className="attendance-symbol scan-processing" aria-hidden="true">
          <NfcIcon size={32} />
        </div>
        <h1>רק רגע…</h1>
        <p>טוענים את המסך שלך.</p>
      </section>
    </main>
  );
}
