-- Run in the Supabase SQL Editor as postgres, after selecting exact TEST account IDs.
-- Deletes selected accounts AND their attendance, NFC receipts, assignments and availability.
-- Does not delete stations, schedules, shift templates or other workers' attendance.
-- Defaults to ROLLBACK: inspect the preview/counts, then change the LAST line to COMMIT.
-- Never put real worker accounts in this list. No wildcard/email-domain matching is used.
BEGIN;
CREATE TEMP TABLE test_account_targets (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO test_account_targets(id) VALUES
  ('00000000-0000-0000-0000-000000000000'); -- REPLACE with a test auth.users.id
-- Add more UUID rows above if needed.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM test_account_targets t LEFT JOIN auth.users u ON u.id=t.id WHERE u.id IS NULL)
  THEN RAISE EXCEPTION 'A target UUID does not exist. Replace placeholders with exact test account IDs.'; END IF;
  IF EXISTS (SELECT 1 FROM public.platform_admins p JOIN test_account_targets t ON t.id=p.user_id)
     OR EXISTS (SELECT 1 FROM public.station_memberships m JOIN test_account_targets t ON t.id=m.user_id WHERE m.role='ADMIN')
  THEN RAISE EXCEPTION 'Admin accounts are protected. This script only removes non-admin test accounts.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.attendance_manual_audit a
    JOIN test_account_targets t ON t.id=a.actor_id
    JOIN public.attendance_records r ON r.id=a.attendance_record_id
    WHERE NOT EXISTS (SELECT 1 FROM test_account_targets target WHERE target.id=r.user_id)
  ) THEN RAISE EXCEPTION 'Target account authored another worker''s attendance audit. Preserve this account/history.'; END IF;
END $$;

-- Preview: confirm identities and how many attendance rows will disappear.
SELECT u.id, u.email, p.full_name,
  (SELECT count(*) FROM public.attendance_records r WHERE r.user_id=u.id) AS attendance_records,
  (SELECT count(*) FROM public.station_memberships m WHERE m.user_id=u.id) AS memberships
FROM auth.users u JOIN test_account_targets t ON t.id=u.id
LEFT JOIN public.profiles p ON p.id=u.id;

DELETE FROM public.nfc_scan_receipts n
WHERE n.user_id IN (SELECT id FROM test_account_targets)
   OR n.attendance_id IN (SELECT id FROM public.attendance_records WHERE user_id IN (SELECT id FROM test_account_targets));
DELETE FROM public.attendance_manual_audit a
WHERE a.attendance_record_id IN (SELECT id FROM public.attendance_records WHERE user_id IN (SELECT id FROM test_account_targets));
DELETE FROM public.attendance_records WHERE user_id IN (SELECT id FROM test_account_targets);
DELETE FROM public.shift_assignments WHERE station_membership_id IN
  (SELECT id FROM public.station_memberships WHERE user_id IN (SELECT id FROM test_account_targets));
-- availability_days cascade from availability_weeks; weeks also cascade from memberships.
DELETE FROM public.availability_weeks WHERE station_membership_id IN
  (SELECT id FROM public.station_memberships WHERE user_id IN (SELECT id FROM test_account_targets));
DELETE FROM public.station_memberships WHERE user_id IN (SELECT id FROM test_account_targets);
-- public.profiles and Auth-owned dependants use existing foreign-key cascades.
DELETE FROM auth.users WHERE id IN (SELECT id FROM test_account_targets) RETURNING id, email;
ROLLBACK; -- Change to COMMIT only after checking the exact target IDs and preview.
