-- Disposable LOCAL database only. Transaction always rolls back test fixtures.
BEGIN;
DO $$ BEGIN
 IF has_table_privilege('anon','public.station_interest_leads','INSERT')
 OR has_table_privilege('authenticated','public.station_interest_leads','SELECT')
 OR has_function_privilege('anon','public.submit_station_interest(uuid,text,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','public.submit_station_interest(uuid,text,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'Public lead access leaked'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.station_interest_leads'::regclass) THEN RAISE EXCEPTION 'RLS missing'; END IF;
END $$;
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb; payload jsonb:=jsonb_build_object('full_name','Local test','phone','0501234567','station_name_or_number','Fixture','city','Haifa','platform','ios','app_version','1.0.0','status','converted');
BEGIN
 r:=public.submit_station_interest('00000000-0000-4000-8000-000000000024',repeat('a',64),payload);
 IF r->>'result'<>'created' THEN RAISE EXCEPTION 'Insert failed'; END IF;
 IF (SELECT status FROM public.station_interest_leads WHERE id=(r->>'id')::uuid)<>'new' THEN RAISE EXCEPTION 'Status injection'; END IF;
 r:=public.submit_station_interest('00000000-0000-4000-8000-000000000024',repeat('a',64),payload);
 IF r->>'result'<>'duplicate' THEN RAISE EXCEPTION 'Retry duplicated'; END IF;
 r:=public.submit_station_interest('00000000-0000-4000-8000-000000000025',repeat('b',64),payload);
 IF r->>'result'<>'duplicate' THEN RAISE EXCEPTION 'Phone/station duplicated'; END IF;
 FOR i IN 1..3 LOOP PERFORM public.submit_station_interest(gen_random_uuid(),repeat('a',64),payload); END LOOP;
 r:=public.submit_station_interest(gen_random_uuid(),repeat('a',64),payload);
 IF r->>'result'<>'limited' THEN RAISE EXCEPTION 'IP limit missing'; END IF;
 FOR i IN 1..2 LOOP
  r:=public.submit_station_interest(gen_random_uuid(),repeat('c',64),payload||jsonb_build_object('station_name_or_number','Fixture '||i));
  IF r->>'result'<>'created' THEN RAISE EXCEPTION 'Distinct station rejected'; END IF;
 END LOOP;
 r:=public.submit_station_interest(gen_random_uuid(),repeat('d',64),payload||jsonb_build_object('station_name_or_number','Fourth'));
 IF r->>'result'<>'limited' THEN RAISE EXCEPTION 'Phone limit missing'; END IF;
 BEGIN
  PERFORM public.submit_station_interest(gen_random_uuid(),repeat('e',64),payload||jsonb_build_object('phone','not-phone'));
  RAISE EXCEPTION 'Invalid phone accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO public.station_interest_rate_limits(ip_hash)
 SELECT repeat('f',64) FROM generate_series(1,100);
SET LOCAL ROLE service_role;
DO $$ BEGIN
 IF public.submit_station_interest(gen_random_uuid(),repeat('9',64),
 '{"full_name":"Local test","phone":"0501234568","station_name_or_number":"Fixture","city":"Haifa","platform":"ios"}'::jsonb)->>'result'<>'limited'
 THEN RAISE EXCEPTION 'Global cap missing'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
