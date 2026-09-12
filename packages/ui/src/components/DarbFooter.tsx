import '../styles/darb-footer.css';

/** Static attribution: no hydration, remote assets, trackers, or animation dependency. */
export function DarbFooter() {
  return (
    <footer className="darb-footer" aria-label="קרדיט לפיתוח">
      <a
        className="darb-credit"
        href="https://darb.co.il/he"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="פותח על ידי Darb — לאתר Darb, נפתח בלשונית חדשה"
      >
        <span className="darb-credit-copy">
          <span className="darb-credit-caption">
            <bdi dir="ltr">© 2026 Darb.</bdi> כל הזכויות שמורות.
          </span>
          <span className="darb-credit-signature">
            <span>עיצוב ופיתוח</span>
            <strong dir="ltr">
              Darb<span className="darb-credit-dot">.</span>
            </strong>
          </span>
          <span className="darb-credit-founder" dir="ltr">
            Nour · Founder of Darb
          </span>
        </span>
        <span className="darb-credit-arrow" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 18 18 6M6 6h12v12"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </a>
    </footer>
  );
}
