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
            Nour · Darb
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

/** Compact credit for the login card, with no extra loading or animation runtime. */
export function LoginCredit() {
  return (
    <footer className="login-credit">
      <a
        href="https://darb.co.il/he"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Nour · Darb — עיצוב ופיתוח, נפתח בלשונית חדשה"
      >
        <span className="login-credit-label">עיצוב ופיתוח</span>
        <span className="login-credit-name" dir="ltr">
          Nour <span aria-hidden="true">·</span>{' '}
          <strong>
            Darb<span className="darb-credit-dot">.</span>
          </strong>
        </span>
        <span className="login-credit-launch" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
      <small>
        <bdi dir="ltr">© 2026 Darb.</bdi> כל הזכויות שמורות.
      </small>
    </footer>
  );
}
