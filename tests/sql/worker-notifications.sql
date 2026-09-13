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
INSERT INTO public.scheduled_shifts(id,schedule_id,station_id,shift_date,start_at,end_at) VALUES('00000000-0000-4000-8000-000000020000','00000000-0000-4000-8000-000000010000','00000000-0000-4000-8000-000000000010',current_date,now()+interval '20 minutes',now()+interval '8 hours');
INSERT INTO public.shift_assignments(scheduled_shift_id,station_id,station_membership_id) VALUES('00000000-0000-4000-8000-000000020000','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000100');
UPDATE public.schedules SET status='PUBLISHED';
UPDATE public.schedules SET status='DRAFT';
UPDATE public.schedules SET status='PUBLISHED';
DO $$ DECLARE batch jsonb; BEGIN
 IF (SELECT count(*) FROM public.worker_notifications)<>1 THEN RAISE EXCEPTION 'publication targeting/deduplication'; END IF;
 batch:=public.claim_worker_notifications();
 IF jsonb_array_length(batch)<>4 THEN RAISE EXCEPTION '2 events x 2 devices, got %',batch; END IF;
 IF jsonb_array_length(public.claim_worker_notifications())<>0 THEN RAISE EXCEPTION 'duplicate claims'; END IF;
 IF (SELECT count(*) FROM public.worker_notifications WHERE type='SHIFT_REMINDER')<>1 THEN RAISE EXCEPTION 'reminder missing'; END IF;
END $$;
-- Edits invalidate pending reminders; no stale push is eligible.
UPDATE public.worker_notification_deliveries SET state='pending';
UPDATE public.scheduled_shifts SET start_at=now()+interval '2 hours';
DO $$ BEGIN
 PERFORM public.claim_worker_notifications();
 IF EXISTS(SELECT 1 FROM public.worker_notification_deliveries d JOIN public.worker_notifications n ON n.id=d.notification_id WHERE n.type='SHIFT_REMINDER' AND d.state<>'cancelled') THEN RAISE EXCEPTION 'stale reminder'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.worker_notifications)<>2 THEN RAISE EXCEPTION 'own inbox'; END IF;
 PERFORM public.mark_worker_notifications_read();
 IF EXISTS(SELECT 1 FROM public.worker_notifications WHERE read_at IS NULL) THEN RAISE EXCEPTION 'mark all'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true),set_config('request.jwt.claim.session_id','00000000-0000-4000-8000-000000000022',true);
DO $$ BEGIN
 IF (SELECT count(id) FROM public.worker_devices)<>0 OR (SELECT count(*) FROM public.worker_notifications)<>0 OR (SELECT count(*) FROM public.worker_notification_preferences)<>0 THEN RAISE EXCEPTION 'RLS leak'; END IF;
 BEGIN PERFORM public.register_worker_device('00000000-0000-4000-8000-000000001001',repeat('x',64),'ExpoPushToken[stolen]','ios','1'); RAISE EXCEPTION 'account transfer without proof'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.register_worker_device('00000000-0000-4000-8000-000000001001',repeat('a',64),'ExpoPushToken[rotated]','ios','2');
 IF (SELECT count(id) FROM public.worker_devices)<>1 THEN RAISE EXCEPTION 'account transfer'; END IF;
 PERFORM public.register_worker_device('00000000-0000-4000-8000-000000001001',repeat('a',64),null,'ios','2');
 IF (SELECT count(id) FROM public.worker_devices)<>0 THEN RAISE EXCEPTION 'logout / permission revoked'; END IF;
END $$;
RESET ROLE;
UPDATE public.worker_notification_preferences SET reminder_minutes=0;
UPDATE public.scheduled_shifts SET start_at=now()+interval '10 minutes';
DO $$ BEGIN
 PERFORM public.claim_worker_notifications();
 IF (SELECT count(*) FROM public.worker_notifications WHERE type='SHIFT_REMINDER')<>1 THEN RAISE EXCEPTION 'disabled preference generated reminder'; END IF;
END $$;
UPDATE public.station_memberships SET status='INACTIVE';
DO $$ BEGIN
 IF jsonb_array_length(public.claim_worker_notifications())<>0 THEN RAISE EXCEPTION 'inactive/disabled dispatch'; END IF;
 DELETE FROM auth.sessions WHERE user_id='00000000-0000-4000-8000-000000000001';
 IF EXISTS(SELECT 1 FROM public.worker_devices) THEN RAISE EXCEPTION 'revocation cascade'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.worker_notifications) THEN RAISE EXCEPTION 'revoked membership inbox'; END IF; END $$;
RESET ROLE;
UPDATE public.profiles SET is_active=false WHERE id='00000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 BEGIN PERFORM public.register_worker_device('00000000-0000-4000-8000-000000001001',repeat('a',64),'ExpoPushToken[x]','ios','1'); RAISE EXCEPTION 'inactive profile registration'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
