\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email) VALUES('00000000-0000-4000-8000-000000000001','one@example.test'),('00000000-0000-4000-8000-000000000002','two@example.test');
INSERT INTO auth.sessions VALUES('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001',null),('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000002',null);
INSERT INTO public.stations(id,code,name) VALUES('00000000-0000-4000-8000-000000000010','TEST-NOTIFICATIONS','בדיקה');
INSERT INTO public.station_memberships(id,station_id,user_id) VALUES('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true),set_config('request.jwt.claim.session_id','00000000-0000-4000-8000-000000000011',true);
DO $$ BEGIN
 PERFORM public.register_worker_device('00000000-0000-4000-8000-000000001001',repeat('a',64),'ExpoPushToken[first]','ios','1');
 PERFORM public.register_worker_device('00000000-0000-4000-8000-000000001001',repeat('a',64),'ExpoPushToken[rotated]','ios','2');
 PERFORM public.register_worker_device('00000000-0000-4000-8000-000000001002',repeat('b',64),'ExpoPushToken[second]','android','1');
 IF (SELECT count(id) FROM public.worker_devices)<>2 THEN RAISE EXCEPTION 'registration update / multiple devices'; END IF;
 BEGIN PERFORM public.register_worker_device('00000000-0000-4000-8000-000000001003',repeat('c',64),'ExpoPushToken[rotated]','ios','1'); RAISE EXCEPTION 'duplicate token accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN PERFORM public.register_worker_device('00000000-0000-4000-8000-000000001001',repeat('x',64),'ExpoPushToken[stolen]','ios','1'); RAISE EXCEPTION 'proof bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO public.worker_notification_preferences(user_id,reminder_minutes) VALUES(auth.uid(),30);
 BEGIN INSERT INTO public.worker_notification_preferences(user_id) VALUES('00000000-0000-4000-8000-000000000002'); RAISE EXCEPTION 'foreign preferences'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM expo_push_token FROM public.worker_devices; RAISE EXCEPTION 'token disclosure'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.worker_devices DEFAULT VALUES; RAISE EXCEPTION 'unproven device insertion'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.worker_notifications DEFAULT VALUES; RAISE EXCEPTION 'privileged insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.claim_worker_notifications(); RAISE EXCEPTION 'worker dispatch'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO public.schedules(id,station_id,week_start_date) VALUES('00000000-0000-4000-8000-000000010000','00000000-0000-4000-8000-000000000010',(current_date-extract(dow FROM current_date)::int));
INSERT INTO public.scheduled_shifts(id,schedule_id,station_id,shift_date,start_at,end_at) VALUES('00000000-0000-4000-8000-000000020000','00000000-0000-4000-8000-000000010000','00000000-0000-4000-8000-000000000010',current_date,((now()+interval '20 minutes') AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'UTC',((now()+interval '8 hours') AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'UTC');
INSERT INTO public.shift_assignments(scheduled_shift_id,station_id,station_membership_id) VALUES('00000000-0000-4000-8000-000000020000','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000100');

UPDATE public.schedules SET status='PUBLISHED';
-- A 45-minute start is outside 30-minute preference, but inside 60 minutes.
UPDATE public.scheduled_shifts SET start_at=((now()+interval '45 minutes') AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'UTC';
DO $$ BEGIN
 PERFORM public.claim_worker_notifications();
 IF EXISTS(SELECT 1 FROM public.worker_notifications WHERE type='SHIFT_REMINDER') THEN RAISE EXCEPTION '30-minute window too early'; END IF;
END $$;
UPDATE public.worker_notification_preferences SET reminder_minutes=60;
DO $$ BEGIN
 PERFORM public.claim_worker_notifications();
 IF (SELECT count(*) FROM public.worker_notifications WHERE type='SHIFT_REMINDER')<>1 THEN RAISE EXCEPTION '60-minute window missed'; END IF;
 IF EXISTS(SELECT 1 FROM public.worker_notifications WHERE type='SHIFT_REMINDER' AND expires_at<>now()+interval '45 minutes') THEN RAISE EXCEPTION 'expiry is not real instant'; END IF;
 PERFORM public.claim_worker_notifications();
 IF (SELECT count(*) FROM public.worker_notifications WHERE type='SHIFT_REMINDER')<>1 THEN RAISE EXCEPTION 'duplicate logical event'; END IF;
END $$;
-- Once the real start is past, the UTC-labelled value must not keep it eligible.
UPDATE public.scheduled_shifts SET start_at=((now()-interval '1 minute') AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'UTC';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.worker_notifications n WHERE type='SHIFT_REMINDER' AND public.worker_notification_current(n)) THEN RAISE EXCEPTION 'past shift eligible'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL TIME ZONE 'America/Los_Angeles';
DO $$ BEGIN
 IF public.scheduled_notification_instant('2026-09-18 14:00Z','Asia/Jerusalem') IS DISTINCT FROM '2026-09-18 11:00Z'::timestamptz THEN RAISE EXCEPTION 'summer conversion'; END IF;
 IF public.scheduled_notification_instant('2026-12-18 14:00Z','Asia/Jerusalem') IS DISTINCT FROM '2026-12-18 12:00Z'::timestamptz THEN RAISE EXCEPTION 'winter conversion'; END IF;
 IF public.scheduled_notification_instant('2026-09-19 06:00Z','Asia/Jerusalem') IS DISTINCT FROM '2026-09-19 03:00Z'::timestamptz THEN RAISE EXCEPTION 'morning conversion'; END IF;
 IF public.scheduled_notification_instant('2026-03-27 02:30Z','Asia/Jerusalem') IS NOT NULL THEN RAISE EXCEPTION 'spring gap must skip'; END IF;
 IF public.scheduled_notification_instant('2026-10-25 01:30Z','Asia/Jerusalem') IS DISTINCT FROM '2026-10-24 22:30Z'::timestamptz THEN RAISE EXCEPTION 'fall overlap must use earlier instant'; END IF;
 IF public.scheduled_notification_instant('2026-09-18 14:00Z','UTC') IS DISTINCT FROM '2026-09-18 14:00Z'::timestamptz THEN RAISE EXCEPTION 'UTC conversion'; END IF;
 IF public.scheduled_notification_instant('2026-09-18 14:00Z','America/New_York') IS DISTINCT FROM '2026-09-18 18:00Z'::timestamptz THEN RAISE EXCEPTION 'negative offset'; END IF;
 IF has_function_privilege('authenticated','public.scheduled_notification_instant(timestamptz,text)','EXECUTE') THEN RAISE EXCEPTION 'helper exposed'; END IF;
 IF has_function_privilege('service_role','public.claim_worker_notifications_schedule()','EXECUTE') THEN RAISE EXCEPTION 'wrapper bypass exposed'; END IF;
END $$;
ROLLBACK;
