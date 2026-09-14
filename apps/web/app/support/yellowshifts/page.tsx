import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'YellowShifts Support' };
export default function Support() {
  return (
    <main
      lang="en"
      dir="ltr"
      style={{ maxWidth: 760, margin: '48px auto', padding: '24px', lineHeight: 1.8 }}
    >
      <h1>YellowShifts support</h1>
      <p>
        For help with the worker app, contact{' '}
        <a href="mailto:founder@darb.co.il">founder@darb.co.il</a>.
      </p>
      <p>
        Include your station name, device model, app version, approximate time of the problem and a
        short description. Remove personal employee information from screenshots. Never send
        passwords, private keys or NFC tag tokens.
      </p>
      <h2>Before contacting us</h2>
      <ul>
        <li>
          For account access, missing assignments or attendance corrections, contact your station
          administrator.
        </li>
        <li>
          For missing notifications, check both the app preferences and notification permission in
          device settings.
        </li>
        <li>
          For a failed attendance report, check your connection and location permission. Ask your
          administrator to check the record before retrying; do not assume a failed screen means no
          report was saved.
        </li>
      </ul>
      <p>
        Native NFC links and background location reminders are not enabled in the initial TestFlight
        candidate.
      </p>
      <p>
        <a href="/privacy/yellowshifts">Privacy notice and data requests</a>
      </p>
    </main>
  );
}
