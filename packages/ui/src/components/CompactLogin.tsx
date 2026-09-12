'use client';

import { useActionState, useState } from 'react';

import { BrandLogo } from './Brand';
import { LoginCredit } from './DarbFooter';

interface LoginState {
  success: boolean;
  error?: string;
}
export function CompactLogin({
  action,
  nextPath,
  admin = false,
}: {
  action: (previous: LoginState | null, data: FormData) => Promise<LoginState>;
  nextPath: string;
  admin?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [showPassword, setShowPassword] = useState(false);
  const [method, setMethod] = useState<'phone' | 'email'>(admin ? 'email' : 'phone');
  const [identifiers, setIdentifiers] = useState({ phone: '', email: '' });
  const [dismissedError, setDismissedError] = useState<LoginState | null>(null);
  const nfc = !admin && nextPath.startsWith('/nfc/');
  return (
    <main className="mobile-flow login-flow" dir="rtl">
      <section className="login-panel" aria-labelledby="login-heading">
        <div className="mobile-brand">
          <BrandLogo />
          <small>{admin ? 'ניהול התחנה' : 'המשמרת שלך, בפשטות'}</small>
        </div>
        <header className="login-heading">
          <h1 id="login-heading">{nfc ? 'מתחברים ומדווחים' : 'טוב לראות אותך'}</h1>
          <p>{nfc ? 'מתחברים וממשיכים לסריקה.' : 'המשמרת הבאה מתחילה כאן.'}</p>
        </header>
        <form action={formAction} className="compact-login-form" aria-busy={pending}>
          <input type="hidden" name="next" value={nextPath} />
          <input type="hidden" name="method" value={method} />
          <div
            className="login-methods"
            role="tablist"
            aria-label="בחירת דרך התחברות"
            data-method={method}
          >
            {(['phone', 'email'] as const).map((option) => (
              <button
                key={option}
                id={`tab-${option}`}
                type="button"
                role="tab"
                aria-selected={method === option}
                aria-controls="login-identity-panel"
                tabIndex={method === option ? 0 : -1}
                disabled={pending}
                onClick={() => {
                  setMethod(option);
                  setDismissedError(state);
                }}
                onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const next =
                    event.key === 'Home'
                      ? 'phone'
                      : event.key === 'End'
                        ? 'email'
                        : method === 'phone'
                          ? 'email'
                          : 'phone';
                  setMethod(next);
                  setDismissedError(state);
                  document.getElementById(`tab-${next}`)?.focus();
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  {option === 'phone' ? (
                    <>
                      <rect x="6" y="2" width="12" height="20" rx="3" />
                      <path d="M10 18h4" />
                    </>
                  ) : (
                    <>
                      <rect x="3" y="5" width="18" height="14" rx="3" />
                      <path d="m3 7 9 6 9-6" />
                    </>
                  )}
                </svg>
                {option === 'phone' ? 'טלפון' : 'אימייל'}
              </button>
            ))}
          </div>
          {state?.error && state !== dismissedError && (
            <p className="mobile-error" role="alert">
              {state.error}
            </p>
          )}
          <div id="login-identity-panel" role="tabpanel" aria-labelledby={`tab-${method}`}>
            <label key={method} className="login-identity" htmlFor="login-identifier">
              {method === 'phone' ? 'מספר טלפון' : 'כתובת אימייל'}
              <input
                id="login-identifier"
                name="identifier"
                type={method === 'phone' ? 'tel' : 'email'}
                inputMode={method === 'phone' ? 'tel' : 'email'}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                dir="ltr"
                value={identifiers[method]}
                onChange={(event) =>
                  setIdentifiers({ ...identifiers, [method]: event.target.value })
                }
                placeholder={method === 'phone' ? '050-1234567' : 'name@example.com'}
                enterKeyHint="next"
                required
                disabled={pending}
              />
            </label>
          </div>
          <label htmlFor="login-password">
            סיסמה
            <div className="password-field">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                dir="ltr"
                enterKeyHint="go"
                required
                disabled={pending}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'הסתרת סיסמה' : 'הצגת סיסמה'}
                aria-pressed={showPassword}
              >
                {showPassword ? 'הסתרה' : 'הצגה'}
              </button>
            </div>
          </label>
          <button className="mobile-primary" type="submit" disabled={pending}>
            {pending ? 'מתחברים…' : nfc ? 'כניסה והמשך לסריקה' : 'כניסה'}
          </button>
        </form>
        <p className="login-help">אין לך פרטי כניסה? פנה למנהל התחנה.</p>
        <LoginCredit />
      </section>
    </main>
  );
}
