\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email) VALUES('00000000-0000-4000-8000-000000000001','fixture1@example.test'),('00000000-0000-4000-8000-000000000002','fixture2@example.test');
INSERT INTO public.stations(id,code,name) VALUES('00000000-0000-4000-8000-000000000010','FIXTURE','בדיקה'),('00000000-0000-4000-8000-000000000020','OTHER','אחר');
INSERT INTO public.station_memberships(id,station_id,user_id) VALUES('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000002');
CREATE FUNCTION public.test_insert_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.notes='FAIL_TEST' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER test_insert_failure BEFORE INSERT ON public.availability_entries FOR EACH ROW EXECUTE FUNCTION public.test_insert_failure();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE w date:=(timezone('Asia/Jerusalem',now())::date-extract(dow FROM timezone('Asia/Jerusalem',now()))::int); payload jsonb; result jsonb; baseline jsonb; bad jsonb; i integer;
BEGIN
 SELECT jsonb_agg(jsonb_build_object('date',w+d,'availabilityType','ALL_DAY_AVAILABLE')) INTO payload FROM generate_series(0,6) d;
 result:=public.submit_worker_availability('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000100',w,payload);
 IF jsonb_array_length(result->'entries')<>7 THEN RAISE EXCEPTION 'success count'; END IF;
 result:=public.submit_worker_availability('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000100',w,jsonb_set(payload,'{0,availabilityType}','"ALL_DAY_UNAVAILABLE"'));
 IF result#>>'{entries,0,availability_type}'<>'ALL_DAY_UNAVAILABLE' THEN RAISE EXCEPTION 'replacement'; END IF;
 baseline:=result;
 BEGIN PERFORM public.submit_worker_availability('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000100',w+1,payload); RAISE EXCEPTION 'Monday allowed'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.submit_worker_availability('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000100',w-7,payload); RAISE EXCEPTION 'historical allowed'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.submit_worker_availability('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000100',w+21,payload); RAISE EXCEPTION 'future allowed'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 FOR i IN 1..7 LOOP
  bad:=CASE i WHEN 1 THEN payload-6 WHEN 2 THEN payload || (payload->0) WHEN 3 THEN jsonb_set(payload,'{1,date}',payload#>'{0,date}') WHEN 4 THEN jsonb_set(payload,'{0,date}','"2020-01-01"') WHEN 5 THEN jsonb_set(payload,'{0,availabilityType}','"INVALID"') WHEN 6 THEN jsonb_set(payload,'{6,notes}','"FAIL_TEST"') ELSE jsonb_set(jsonb_set(payload,'{0,availabilityType}','"TIME_WINDOW"'),'{0,startTime}','"25:00"') END;
  BEGIN
   PERFORM public.submit_worker_availability('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000100',w,bad);
   RAISE EXCEPTION 'expected rejection' USING ERRCODE='ZX001';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN RAISE; WHEN OTHERS THEN NULL; END;
  SELECT jsonb_build_object('week',to_jsonb(aw),'entries',(SELECT jsonb_agg(to_jsonb(e) ORDER BY e.date) FROM public.availability_entries e WHERE e.availability_week_id=aw.id)) INTO result FROM public.availability_weeks aw WHERE aw.station_membership_id='00000000-0000-4000-8000-000000000100';
  IF result<>baseline THEN RAISE EXCEPTION 'rollback mismatch %',i; END IF;
 END LOOP;
 BEGIN PERFORM public.submit_worker_availability('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000100',w,payload); RAISE EXCEPTION 'station leak' USING ERRCODE='ZX001'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.submit_worker_availability('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000200',w,payload); RAISE EXCEPTION 'worker leak' USING ERRCODE='ZX001'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.station_memberships SET status='INACTIVE' WHERE id='00000000-0000-4000-8000-000000000100';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.submit_worker_availability('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000100',current_date,'[]'); RAISE EXCEPTION 'inactive allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 BEGIN PERFORM public.submit_worker_availability('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000100',current_date,'[]'); RAISE EXCEPTION 'anonymous allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
