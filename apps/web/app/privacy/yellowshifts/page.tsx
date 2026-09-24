import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'YellowShifts Privacy' };
export default function Privacy() {
  return (
    <main
      lang="en"
      dir="ltr"
      style={{ maxWidth: 760, margin: '48px auto', padding: '24px', lineHeight: 1.8 }}
    >
      <h1>YellowShifts privacy notice</h1>
      <p>
        Updated 16 September 2026. YellowShifts helps workers and their station administrators
        manage shifts and attendance. Darb provides the application; your employer or station
        administrator manages your work records and account access.
      </p>
      <h2>Information used by the service</h2>
      <p>
        We process account identifiers, sign-in details, worker profile and contact information,
        station membership, schedules, availability, attendance, corrections and calculated work
        hours. Authorized administrators can access work records within their permitted scope.
      </p>
      <p>
        When notifications are enabled, we process a push token, installation identifier, device
        platform, app version, notification preferences and activity timestamps. Notification inbox
        and read status are associated with your account. You can change preferences in the app or
        disable permission in device settings.
      </p>
      <h2>Station interest requests</h2>
      <p>
        If you ask to bring YellowShifts to your station, we collect your name, mobile number,
        station and city, and any optional email, role or notes you provide. We use these details to
        respond to your request and manage follow-up, separately from worker accounts. We also
        record the app platform/version and use a keyed hash of your IP address for abuse limits;
        these rate-limit records are removed after 24 hours when the next request is processed.
        Authorized operators can review requests. If email alerts are configured, Resend processes
        the submitted contact details to notify our team. Contact us to request deletion or stop
        follow-up; no fixed retention period for interest requests has yet been established.
      </p>
      <h2>Location and station attendance</h2>
      <p>
        During a supported NFC attendance flow, precise location and accuracy are sent to the server
        to check proximity to the station. The current attendance implementation does not store
        these scan coordinates as a location history. A station tag opens a link; the tag does not
        identify the worker. Authentication, station access, location checks and worker confirmation
        govern attendance.
      </p>
      <p>
        Optional geofence reminders, where available, use device location and station boundaries to
        remind you to report attendance. They do not automatically check you in or out. Background
        location reminders and native NFC links are disabled in the initial TestFlight candidate.
        YellowShifts does not continuously upload a route history, use face recognition or use QR
        attendance.
      </p>
      <h2>Service providers and security</h2>
      <p>
        Supabase supports authentication and database storage; Expo and Apple deliver iOS push
        notifications; Vercel hosts the web service. These providers process information needed to
        operate their services and may process it outside your country. Operational infrastructure
        may retain security and diagnostic logs. The application uses encrypted connections and
        access controls; no system can guarantee absolute security.
      </p>
      <p>
        We use this information to provide work scheduling, attendance, account security and
        notifications. The current app does not include advertising or cross-app tracking
        functionality.
      </p>
      <h2>Retention and requests</h2>
      <p>
        Work records may need to be retained by your employer for operational and legal reasons.
        Retention depends on the record, employer requirements and service-provider settings; no
        fixed deletion period is promised here. Logging out does not delete work records. Ask your
        station administrator about record corrections or account access. For privacy, access or
        deletion requests, contact <a href="mailto:founder@darb.co.il">founder@darb.co.il</a>. We
        may need to verify your identity and coordinate with your employer before acting on a
        request.
      </p>
      <p>
        Do not email passwords, private keys or NFC tag tokens. Changes to this notice will be
        reflected in its update date.
      </p>
      <p>
        <a href="/support/yellowshifts">YellowShifts support</a>
      </p>
    </main>
  );
}
