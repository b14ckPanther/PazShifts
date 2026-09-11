'use client';

import { useActionState, useState } from 'react';
import { BrandLogo } from './Brand';

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
          <p>{nfc ? 'הנוכחות תירשם אוטומטית לאחר ההתחברות.' : 'טלפון או אימייל, והסיסמה שלך.'}</p>
        </header>
        <form action={formAction} className="compact-login-form" aria-busy={pending}>
          <input type="hidden" name="next" value={nextPath} />
          {state?.error && (
            <p className="mobile-error" role="alert">
              {state.error}
            </p>
          )}
          <label htmlFor="login-email">
            טלפון או אימייל
            <input
              id="login-email"
              name="identifier"
              type="text"
              inputMode="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              dir="ltr"
              placeholder="050-1234567 / name@example.com"
              enterKeyHint="next"
              required
              disabled={pending}
            />
          </label>
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
            {pending ? 'מתחברים…' : nfc ? 'כניסה ודיווח נוכחות' : 'כניסה'}
          </button>
        </form>
        <p className="login-help">אין לך פרטי כניסה? פנה למנהל התחנה.</p>
      </section>
    </main>
  );
}
