# Station-owner acquisition

## Experience

A compact secondary card follows the worker login panel. It never opens by itself:
“התחנה שלכם. הצוות שלכם.” / “מנהלים תחנה? הכירו דרך פשוטה יותר לעבוד יחד.”
The sheet headline is “יותר סדר בתחנה. יותר שקט לצוות.” Four required fields precede
optional details. A yellow submit action reads “בואו נדבר על התחנה שלכם”.
Success stays open: “הצעד הבא מתחיל כאן.” The operator is asked to contact the lead;
there is no claim that a contract or worker account has been created.

The native Modal uses the existing Reanimated spring/fade, reduced-motion settings,
haptics, Heebo, Lucide icons, keyboard avoidance and a scrollable layout. Close is
explicit; an in-flight submission temporarily prevents dismissal/duplicates. Draft
fields remain in memory across closing/reopening and retry; successful close resets
them. No acquisition PII is persisted in device storage or included in logs.

## Backend

POST `https://admin.paz.darb.co.il/api/station-interest` is the only public intake.
It bypasses browser middleware for this exact path and applies strict validation,
8 KiB body limits, canonical Israeli mobile numbers, known fields/platforms and
server-only Supabase RPC. The canonical route assumes Vercel, whose edge overwrites
`x-forwarded-for`; it fails closed without trusted hosting/IP and the rate secret.
Local `NODE_ENV=development` uses a loopback rate bucket. Native callers do not need
CORS or a worker session. Other hosts need an audited trusted-IP implementation.

Migration `20260916000024_station_interest_leads.sql` creates RLS-protected leads
and short-lived hash-only IP counters. No anon/authenticated table access or RPC
execution is granted. A SECURITY DEFINER RPC, restricted to service_role, enforces:

- Five accepted intake attempts per IP hash/hour; global cap 100/hour.
- Three new leads per normalized mobile number/day.
- UUID request idempotency and phone/station duplicate suppression for 24 hours.
- Atomic advisory locking, database field constraints and fixed source/status.
- Old rate records pruned after 24 hours on the next intake.

Raw IP is not stored in these tables. Infrastructure logs follow hosting policies.
These are basic abuse controls, not proof of human identity; distributed abuse can
exhaust the shared cap. Add Vercel WAF controls if traffic requires them. Do not add
public SELECT/INSERT policies to troubleshoot intake.

## Email and operator access

There was no existing transactional email provider. A fetch-based Resend adapter
is prepared (no dependency added). New leads are stored first, then emailed as plain
text with a stable provider idempotency key. Missing email configuration leaves
`email_status=pending`; provider failures leave `failed`; neither loses the lead.
Duplicates do not resend email. Email is not configured or physically verified yet.
There is no automatic retry worker for lead emails; pending/failed requests need
operator review. Configure email before shipping this acquisition UI publicly.

Required Vercel **paz-shifts-admin / Production** variables:

- Existing `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `STATION_LEADS_RATE_SECRET`: independent cryptographically random secret, >=32
  characters; server-only. Do not reuse notification or authentication secrets.
- `STATION_LEADS_EMAIL`: monitored destination chosen by the owner.
- `STATION_LEADS_FROM`: Resend-verified sender/domain.
- `RESEND_API_KEY`: server-only Resend sending key.

No new mobile environment variables or permissions. No personal mailbox in client
code. No analytics vendor, tracking identifier or growth dashboard was added.
Until an admin inbox is separately implemented, authorized database operators can
review `station_interest_leads` in Supabase Table Editor and update `status` through
new/contacted/qualified/converted/closed. Never expose this table to workers.

Operational checks (trusted SQL editor only; do not publish contact data):

```sql
select status, email_status, count(*) from public.station_interest_leads
 group by status, email_status;
```

For pending/failed alerts, contact/review the lead from the restricted table; adding
a durable email retry worker or Platform Admin lead inbox is a separate follow-up.
Resend processes contact details when configured; the privacy page includes this
flow. The owner must finalize lead retention policy and verified sender setup.

## Release steps

1. Review migration and configure the above server variables privately.
2. From repo root: `supabase migration list`, then `supabase db push` only when the
   pending list contains this intended migration. This task did not apply production SQL.
3. Deploy the admin route and updated worker-site privacy page. Do not deploy the
   admin from an unrestricted working directory containing ignored secrets.
4. Test one owner-authorized real request, email receipt, duplicate retry and 429.
5. Build/distribute a new mobile bundle/build. No new native dependency or permission
   is needed; TestFlight users need a new build unless a compatible OTA channel is
   already configured and deliberately used.

Backend must be live before distributing the new mobile UI. Existing worker auth,
NFC, schedule, notification dispatch and background-location guards are unchanged.
No production deployment, migration, lead, email, commit or push was performed here.

## Tests / visual fixture

- Mobile interaction tests: CTA open/close, required fields/validation, RTL,
  keyboard wrapper, duplicate-submit guard, retry, persistent success/reset,
  transport acknowledgement/rate errors, and login-placement regression.
- Server tests: invalid/oversized inputs, forged metadata, trusted-IP requirements,
  RPC errors, duplicates, rate limits and email success/failure.
- `tests/sql/station-interest.sql`: disposable local DB only, rolled-back fixtures;
  checks grants/RLS, fixed status, idempotency, IP/phone limits and DB validation.
- `tests/visual/StationInterestPreview.tsx`: isolated native visual fixture, never
  writes leads or emails. `tests/visual/interest-entry.tsx` is its standalone entry.
  The normal `expo-router/entry` is restored; no preview route remains in `app/`.

### Validation completed

- 168 mobile tests and 21 server/notification regression tests passed.
- Local migration and transactional SQL checks passed. Eight concurrent requests
  produced one stored lead, four duplicate acknowledgements and three rate limits.
- Mobile, admin, database and web typechecks passed; relevant lint and formatting
  passed. Admin and web production builds passed.
- Native iOS simulator build passed. Production-profile iOS and Android exports
  passed; both source maps passed the server/fixture bundle boundary check.
- iPhone simulator visual QA covered the real sheet component, keyboard entry,
  success state and accessibility extra-large text using isolated in-memory input.
  No real lead or email was sent. Physical Android, VoiceOver/TalkBack and live
  production intake/email delivery remain unverified.
- Expo Doctor was not rerun: no mobile configuration, native dependency or
  permission changed.

### Acquisition file inventory

- Mobile: login placement, `src/acquisition/{StationInterest.tsx,api.ts}`, interaction
  tests, the two isolated visual fixtures and this document.
- Shared: `packages/database/src/station-interest.ts` and its public export.
- Server: `apps/admin/app/api/station-interest/{route.ts,handler.ts}`, exact public
  middleware exception and server environment declarations in `turbo.json`.
- Database: migration `20260916000024_station_interest_leads.sql`, SQL tests and
  server handler tests.
- Privacy: `apps/web/app/privacy/yellowshifts/page.tsx`.

Pre-existing notification-dispatcher edits and files were preserved. They are not
part of this feature's file inventory. Nothing was committed or pushed.
