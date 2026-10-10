\set ON_ERROR_STOP on
-- Worker notifications v2: Web Push subscriptions/queue, fixed shift reminders, checkout reminder,
-- availability eligibility, admin confirmation of a 12-hour capped record.
BEGIN;
INSERT INTO auth.users(id,email) VALUES('00000000-0000-4000-9000-000000000001','w@example.test'),('00000000-0000-4000-9000-000000000002','a@example.test'),('00000000-0000-4000-9000-000000000003','x@example.test');
INSERT INTO auth.sessions VALUES('00000000-0000-4000-9000-000000000011','00000000-0000-4000-9000-000000000001',null),('00000000-0000-4000-9000-000000000033','00000000-0000-4000-9000-000000000003',null);
INSERT INTO public.stations(id,code,name) VALUES('00000000-0000-4000-9000-000000000010','TEST-PUSH','פוש');
INSERT INTO public.station_memberships(id,station_id,user_id,role) VALUES
 ('00000000-0000-4000-9000-000000000100','00000000-0000-4000-9000-000000000010','00000000-0000-4000-9000-000000000001','WORKER'),
 ('00000000-0000-4000-9000-000000000200','00000000-0000-4000-9000-000000000010','00000000-0000-4000-9000-000000000002','ADMIN');
-- Next week submitted, so the time-of-week availability reminder stays out of the counts below.
INSERT INTO public.availability_weeks(id,station_id,station_membership_id,week_start_date) VALUES('00000000-0000-4000-9000-000000030000','00000000-0000-4000-9000-000000000010','00000000-0000-4000-9000-000000000100',
 (now() AT TIME ZONE 'Asia/Jerusalem')::date+(7-extract(dow FROM now() AT TIME ZONE 'Asia/Jerusalem')::int));
INSERT INTO public.availability_entries(availability_week_id,date,availability_type)
 SELECT w.id,w.week_start_date+d,'ALL_DAY_AVAILABLE' FROM public.availability_weeks w,generate_series(0,6) d WHERE w.id='00000000-0000-4000-9000-000000030000';

-- Subscriptions: only real push hosts, own session, no table access.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000000001',true),set_config('request.jwt.claim.session_id','00000000-0000-4000-9000-000000000011',true);
DO $$ BEGIN
 PERFORM public.register_web_push_subscription('https://fcm.googleapis.com/fcm/send/abc',repeat('B',87),repeat('a',22),'test');
 PERFORM public.register_web_push_subscription('https://fcm.googleapis.com/fcm/send/abc',repeat('C',87),repeat('b',22),'test');
 BEGIN PERFORM public.register_web_push_subscription('https://evil.example.com/push',repeat('B',87),repeat('a',22)); RAISE EXCEPTION 'arbitrary push host accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN PERFORM endpoint FROM public.worker_web_push_subscriptions; RAISE EXCEPTION 'subscription disclosure'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.claim_worker_web_push(); RAISE EXCEPTION 'worker web dispatch'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.cap_overdue_attendance(); RAISE EXCEPTION 'worker cap'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.worker_web_push_subscriptions)<>1 OR (SELECT p256dh FROM public.worker_web_push_subscriptions)<>repeat('C',87) THEN RAISE EXCEPTION 're-registration'; END IF;
END $$;
UPDATE public.worker_web_push_subscriptions SET created_at=now()-interval '1 hour';

-- Shift in 60 minutes: SHIFT_TODAY only, reaches the web subscription with a deep link.
INSERT INTO public.schedules(id,station_id,week_start_date,status) VALUES('00000000-0000-4000-9000-000000010000','00000000-0000-4000-9000-000000000010',(current_date-extract(dow FROM current_date)::int),'PUBLISHED');
INSERT INTO public.scheduled_shifts(id,schedule_id,station_id,shift_date,start_at,end_at) VALUES('00000000-0000-4000-9000-000000020000','00000000-0000-4000-9000-000000010000','00000000-0000-4000-9000-000000000010',current_date,
 ((now()+interval '60 minutes') AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'UTC',((now()+interval '8 hours') AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'UTC');
INSERT INTO public.shift_assignments(scheduled_shift_id,station_id,station_membership_id) VALUES('00000000-0000-4000-9000-000000020000','00000000-0000-4000-9000-000000000010','00000000-0000-4000-9000-000000000100');
DO $$ DECLARE batch jsonb; BEGIN
 PERFORM public.claim_worker_notifications();
 IF (SELECT count(*) FROM public.worker_notifications WHERE type='SHIFT_TODAY')<>1 OR EXISTS(SELECT 1 FROM public.worker_notifications WHERE type='SHIFT_SOON') THEN RAISE EXCEPTION 'shift today window'; END IF;
 batch:=public.claim_worker_web_push();
 IF jsonb_array_length(batch)<>1 OR batch->0->>'url'<>'/stations/TEST-PUSH/home' OR batch->0->>'type'<>'SHIFT_TODAY' THEN RAISE EXCEPTION 'web claim %',batch; END IF;
 IF jsonb_array_length(public.claim_worker_web_push())<>0 THEN RAISE EXCEPTION 'duplicate web claim'; END IF;
END $$;

-- 10 minutes before: SHIFT_SOON, but not once the worker has already checked in.
UPDATE public.scheduled_shifts SET start_at=((now()+interval '8 minutes') AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'UTC';
INSERT INTO public.attendance_records(id,station_id,station_membership_id,user_id,scheduled_shift_id,clock_in_at,status) VALUES('00000000-0000-4000-9000-000000040000','00000000-0000-4000-9000-000000000010','00000000-0000-4000-9000-000000000100','00000000-0000-4000-9000-000000000001','00000000-0000-4000-9000-000000020000',now()-interval '1 minute','ACTIVE');
DO $$ BEGIN
 PERFORM public.claim_worker_notifications();
 IF EXISTS(SELECT 1 FROM public.worker_notifications WHERE type='SHIFT_SOON') THEN RAISE EXCEPTION 'soon reminder after check-in'; END IF;
END $$;
DELETE FROM public.attendance_records WHERE id='00000000-0000-4000-9000-000000040000';
DO $$ BEGIN
 PERFORM public.claim_worker_notifications();
 IF (SELECT count(*) FROM public.worker_notifications WHERE type='SHIFT_SOON')<>1 THEN RAISE EXCEPTION 'shift soon missing'; END IF;
END $$;

-- Checkout reminder: still checked in 10+ minutes after the linked shift ended.
UPDATE public.scheduled_shifts SET start_at=((now()-interval '9 hours') AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'UTC',end_at=((now()-interval '20 minutes') AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'UTC';
INSERT INTO public.attendance_records(id,station_id,station_membership_id,user_id,scheduled_shift_id,clock_in_at,status) VALUES('00000000-0000-4000-9000-000000040001','00000000-0000-4000-9000-000000000010','00000000-0000-4000-9000-000000000100','00000000-0000-4000-9000-000000000001','00000000-0000-4000-9000-000000020000',now()-interval '9 hours','ACTIVE');
DO $$ BEGIN
 PERFORM public.claim_worker_notifications();
 PERFORM public.claim_worker_notifications();
 IF (SELECT count(*) FROM public.worker_notifications WHERE type='CHECKOUT_REMINDER')<>1 THEN RAISE EXCEPTION 'checkout reminder'; END IF;
END $$;
UPDATE public.attendance_records SET status='COMPLETED',clock_out_at=now() WHERE id='00000000-0000-4000-9000-000000040001';
DO $$ BEGIN
 IF (SELECT public.worker_notification_current(n) FROM public.worker_notifications n WHERE type='CHECKOUT_REMINDER') THEN RAISE EXCEPTION 'checkout reminder after checkout'; END IF;
END $$;

-- Availability eligibility follows submission of all seven days.
INSERT INTO public.worker_notifications(user_id,station_id,type,title,body,data,dedupe_key,expires_at)
 SELECT '00000000-0000-4000-9000-000000000001','00000000-0000-4000-9000-000000000010','AVAILABILITY_REMINDER','t','b',
 jsonb_build_object('membershipId','00000000-0000-4000-9000-000000000100','weekStart',week_start_date,'day',current_date),'availability:test',now()+interval '1 hour'
 FROM public.availability_weeks WHERE id='00000000-0000-4000-9000-000000030000';
DO $$ BEGIN
 IF (SELECT public.worker_notification_current(n) FROM public.worker_notifications n WHERE dedupe_key='availability:test') THEN RAISE EXCEPTION 'submitted week still reminded'; END IF;
 DELETE FROM public.availability_entries WHERE availability_week_id='00000000-0000-4000-9000-000000030000' AND date=(SELECT max(date) FROM public.availability_entries WHERE availability_week_id='00000000-0000-4000-9000-000000030000');
 IF NOT (SELECT public.worker_notification_current(n) FROM public.worker_notifications n WHERE dedupe_key='availability:test') THEN RAISE EXCEPTION 'partial week not reminded'; END IF;
END $$;

-- 12-hour cap: admin confirms the flagged record; only FLAGGED can be confirmed.
INSERT INTO public.attendance_records(id,station_id,station_membership_id,user_id,clock_in_at,status) VALUES('00000000-0000-4000-9000-000000040002','00000000-0000-4000-9000-000000000010','00000000-0000-4000-9000-000000000100','00000000-0000-4000-9000-000000000001',now()-interval '14 hours','ACTIVE');
SELECT public.cap_overdue_attendance();
SELECT set_config('test.updated',updated_at::text,true) FROM public.attendance_records WHERE id='00000000-0000-4000-9000-000000040002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000000002',true);
DO $$ BEGIN
 PERFORM public.manage_attendance_record('00000000-0000-4000-9000-000000000010','00000000-0000-4000-9000-000000040002','CONFIRM','אושר',current_setting('test.updated')::timestamptz);
 BEGIN PERFORM public.manage_attendance_record('00000000-0000-4000-9000-000000000010','00000000-0000-4000-9000-000000040002','CONFIRM','שוב',current_setting('test.updated')::timestamptz); RAISE EXCEPTION 'confirm of completed record'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'MANUAL_STALE' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT status::text||'|'||(clock_out_at-clock_in_at)||'|'||clock_out_source::text FROM public.attendance_records WHERE id='00000000-0000-4000-9000-000000040002')<>'COMPLETED|12:00:00|MANUAL_ADMIN' THEN RAISE EXCEPTION 'confirm result'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.attendance_manual_audit WHERE attendance_record_id='00000000-0000-4000-9000-000000040002') THEN RAISE EXCEPTION 'confirm audit'; END IF;
END $$;

-- Logging out (session gone) removes the web subscription.
DELETE FROM auth.sessions WHERE id='00000000-0000-4000-9000-000000000011';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.worker_web_push_subscriptions) THEN RAISE EXCEPTION 'session cascade'; END IF; END $$;
ROLLBACK;
