# Production notification dispatcher

The admin project `paz-shifts-admin` serves
`https://admin.paz.darb.co.il/api/internal/notifications`. It accepts POST with
`Authorization: Bearer <NOTIFICATIONS_CRON_SECRET>` and rejects unauthenticated
requests with 401. Admin middleware must let this **exact** path reach its own
bearer authentication; surrounding routes still require browser authentication.

## Production configuration

Vercel **Production**, admin project only:

- `NOTIFICATIONS_ENABLED=true`
- `NOTIFICATIONS_CRON_SECRET`: random server-only secret, also stored in Supabase
  Vault under `yellowshifts_notifications_cron_secret`.
- Existing `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `EXPO_ACCESS_TOKEN` only if Expo enhanced push security is enabled. Current
  project delivery does not require it.

Changing Vercel environment values requires a new deployment. Never put the
service-role key or scheduler secret in a mobile/public environment variable.
Never expose Vault or pg_net through PostgREST, RPCs, views, or diagnostic logs.
The managed pg_net request queue temporarily contains the Authorization header.
Production API checks reject both `Accept-Profile: net` and `Accept-Profile: vault`.

## One scheduler

Supabase `pg_cron` queues an authenticated HTTPS POST using `pg_net` every minute.
Vercel Hobby does not support the required minute cadence. No Vercel Cron or
second scheduler is configured.

After privately provisioning matching secrets and deploying the route, apply:

```sh
supabase db query --linked --file scripts/sql/notification-scheduler.sql
```

This is an explicit production operation, not an application migration or a test
fixture. The named job is updated on rerun rather than duplicated. Existing
notification schema and production schedules remain unchanged.

Pause immediately if necessary:

```sql
select cron.unschedule('yellowshifts-notification-dispatch');
```

Inspect status without exposing headers or secrets:

```sql
select jobid, jobname, schedule, active from cron.job
where jobname = 'yellowshifts-notification-dispatch';
select status, return_message, start_time, end_time from cron.job_run_details
where jobid = (select jobid from cron.job
  where jobname = 'yellowshifts-notification-dispatch')
order by start_time desc limit 10;
select id, status_code, timed_out, error_msg, content, created
from net._http_response order by created desc limit 10;
select state, error_code, count(*) from public.worker_notification_deliveries
 group by state, error_code;
```

A cron success means the HTTP request was queued. Also check HTTP 200 and the
response body's `claimed` count; redirects, 401, 503, or `enabled:false` are failures
to deliver. HTTP failures are retried by the next minute's invocation. Inspect
both cron and HTTP history when monitoring; no alerting service is configured.

## Delivery behavior

`queue_worker_publication` / `queue_published_worker_notifications()` creates
one `SCHEDULE_PUBLISHED` inbox item per assigned eligible worker and schedule.
`claim_worker_notifications()` uses an advisory lock, `SKIP LOCKED`, and unique
notification/device delivery rows. It also queues shift and left-open reminders.
Preferences, station membership, active auth sessions, registration age, schedule
status and expiration are rechecked before sending.

`apps/admin/app/api/lib/notification-delivery.ts` sends visible title/body,
`sound: default`, and `{notificationId,userId}` through Expo. Mobile resolves the
notification's authorized station/destination from the inbox. A closed app does
not need to execute JavaScript to show the alert.

Claims are limited to 100 deliveries. Accepted tickets are recorded and receipts
are checked after 15 minutes, then retried independently. A successful receipt
means handoff to APNs, not proof a person saw the alert. DeviceNotRegistered
invalidates only the matching token snapshot. Rate limits retry with backoff;
ambiguous transport failures become `uncertain` to avoid duplicate sends.

Republishing the same schedule does not create a new logical notification for a
worker already notified. A Draft schedule is ineligible. Old expired notifications
are not replayed. Multiple legitimate installations receive one push each.

## Physical test

Log into TestFlight as the intended worker, allow notifications, force-close the
app and lock the phone. Publish a real intended schedule from the admin interface.
Wait one dispatcher interval plus network delivery. Do not open the app manually.
Confirm the lock-screen alert, tap it, and confirm the correct schedule/inbox.
Repeat background and foreground; foreground intentionally updates the in-app
inbox without an additional system banner. Do not clear delivery history or add
mock inbox rows to force a test.

## Activation evidence — 2026-09-15 (Asia/Jerusalem)

Root causes confirmed against production:

1. The schedule trigger created the inbox item, but it had no delivery rows.
2. No scheduler existed; `cron.job` was absent before extension installation.
3. Vercel admin production lacked both notification enable and bearer-secret variables.
4. Middleware redirected POST requests to `/login` before route authentication.

Fixed the exact middleware exemption and added notification variables to the
Turbo build environment allowlist. Deployed admin production deployment
`dpl_3ubhktjkhLnRRZ8jA86GaEMNrNbM`. No mobile rebuild, signing change, or Git push.

Activated job `yellowshifts-notification-dispatch` (job 1). Its first automatic
run at 2026-09-14 21:03 UTC succeeded, with HTTP 200 and `{"claimed":0}`. The route
also returned 401 without authentication and 200 with valid authentication.
Three pre-existing test tickets were reconciled to `delivered` with no error.
These receipts are historical push evidence, not a new schedule-push physical test.

The current worker's two iOS registrations have tokens, enabled notifications,
and valid user-owned auth sessions. The schema does not store bundle identifier
or build number, so these fields alone cannot independently prove which token
belongs to TestFlight. No registrations were deleted speculatively.

The recent schedule notification remains ineligible while its schedule is Draft.
A fresh physical publication/lock-screen/tap test has been requested from the
owner; it must be recorded separately before claiming end-to-end qualification.

Validation: 15 dispatcher/middleware/auth unit tests, 13 mobile notification tests,
admin typecheck and lint, new test lint, formatting, production admin build, and
transactional local SQL publication/claim/idempotency/RLS/timezone tests passed.
An additional root ESLint invocation against the unchanged legacy delivery test
reported existing missing Node/Web globals; the application lint and new test lint
pass. Migrations 1–23 remain synchronized; no application migration was added.

### Physical schedule-push confirmation

The owner confirmed publishing a schedule after force-closing YellowShifts and
receiving the remote notification without reopening the app. This passes the
terminated-app schedule-publication delivery test.

Matching SCHEDULE_PUBLISHED inbox item `283d8ba9-de11-4805-b857-d72e93d76b7c`
was created at 2026-09-14 21:04:37 UTC. Both registered iOS installations received
accepted Expo tickets at 21:05:01 UTC (about 24 seconds later), each with exactly
one attempt and no error. This is one logical inbox notification with one delivery
per installation. Receipt reconciliation remains pending its normal 15-minute
interval. Lock-screen state, tap routing and foreground/background retesting for
this particular publication have not yet been separately confirmed.
