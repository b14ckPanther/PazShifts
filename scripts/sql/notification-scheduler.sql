-- Production operations only; run after deploying the authenticated admin route.
-- NOT an application migration: never enable real delivery in a test database.
-- Prerequisite: Vercel production NOTIFICATIONS_ENABLED=true and identical
-- NOTIFICATIONS_CRON_SECRET stored in Vault as yellowshifts_notifications_cron_secret.
-- Provision that secret privately. Never paste it into this file or a Git commit.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Keep net and vault OUT of PostgREST exposed schemas. pg_net's transient
-- request queue contains the Authorization header; do not expose it through
-- application RPCs, views, logs, or a public API. Hosted extension objects are
-- managed by supabase_admin. Vault's decrypted view is not readable by client roles.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'yellowshifts_notifications_cron_secret'
      AND length(decrypted_secret) >= 32
  ) THEN
    RAISE EXCEPTION 'Provision the notification bearer secret in Vault first';
  END IF;
END $$;

-- Scheduling the same named job updates it rather than adding a second scheduler.
SELECT cron.schedule(
  'yellowshifts-notification-dispatch',
  '* * * * *',
  $job$
    SELECT net.http_post(
      url := 'https://admin.paz.darb.co.il/api/internal/notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'yellowshifts_notifications_cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $job$
);
COMMIT;

-- Check both cron.job_run_details AND net._http_response: a cron success only
-- proves the HTTP request was queued, not that the dispatcher returned HTTP 200.
-- Emergency pause: SELECT cron.unschedule('yellowshifts-notification-dispatch');
