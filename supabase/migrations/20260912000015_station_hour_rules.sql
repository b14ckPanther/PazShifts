-- Versioned station-owned reporting rules; no policy is enabled implicitly.
BEGIN;
CREATE FUNCTION public.valid_station_hour_rules(p jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE k text; v jsonb; n numeric;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 IF jsonb_typeof(p->'dailyMinutes') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'dailyMinutes')!=7 THEN RETURN false; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(p->'dailyMinutes') LOOP
  IF jsonb_typeof(v)!='number' THEN RETURN false; END IF;
  n:=v::text::numeric; IF n!=trunc(n) OR n<0 OR n>1440 THEN RETURN false; END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['firstOvertimeMinutes','firstRate','secondRate','weekStartsOn','breakMinutes','breakAfterMinutes','nightStart','nightEnd','nightRate','restRate','holidayRate'] LOOP
  IF jsonb_typeof(p->k) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
  n:=(p->>k)::numeric; IF n!=trunc(n) THEN RETURN false; END IF;
  IF k IN ('firstRate','secondRate','nightRate','restRate','holidayRate') THEN
   IF n<100 OR n>300 THEN RETURN false; END IF;
  ELSIF k='weekStartsOn' THEN IF n<0 OR n>6 THEN RETURN false; END IF;
  ELSIF k IN ('nightStart','nightEnd') THEN IF n<0 OR n>1439 THEN RETURN false; END IF;
  ELSE IF n<0 OR n>1440 THEN RETURN false; END IF;
  END IF;
 END LOOP;
 IF (p->>'secondRate')::int < (p->>'firstRate')::int THEN RETURN false; END IF;
 IF (p->>'breakMinutes')::int>0 AND (p->>'breakAfterMinutes')::int <= (p->>'breakMinutes')::int THEN RETURN false; END IF;
 IF NOT p ? 'weeklyMinutes' THEN RETURN false; END IF;
 IF p->'weeklyMinutes'!='null'::jsonb THEN
  IF jsonb_typeof(p->'weeklyMinutes')!='number' THEN RETURN false; END IF;
  n:=(p->>'weeklyMinutes')::numeric; IF n!=trunc(n) OR n<0 OR n>10080 THEN RETURN false; END IF;
 END IF;
 IF jsonb_typeof(p->'restDays') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'restDays')>7 THEN RETURN false; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(p->'restDays') LOOP
  IF jsonb_typeof(v)!='number' THEN RETURN false; END IF;
  n:=v::text::numeric; IF n!=trunc(n) OR n<0 OR n>6 THEN RETURN false; END IF;
 END LOOP;
 IF jsonb_typeof(p->'holidays') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'holidays')>366 THEN RETURN false; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(p->'holidays') LOOP
  IF jsonb_typeof(v)!='string' OR (v#>>'{}') !~ '^\d{4}-\d{2}-\d{2}$' OR to_char((v#>>'{}')::date,'YYYY-MM-DD')!=(v#>>'{}') THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
CREATE TABLE public.station_hour_rules (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 station_id uuid NOT NULL REFERENCES public.stations(id),
 effective_from date NOT NULL,
 rules jsonb NOT NULL CHECK(public.valid_station_hour_rules(rules)),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX station_hour_rules_versions ON public.station_hour_rules(station_id,effective_from DESC,id DESC);
ALTER TABLE public.station_hour_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.station_hour_rules FROM anon,authenticated;

CREATE FUNCTION public.get_station_hour_rules(p_station_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.is_platform_admin(auth.uid()) OR public.has_station_membership(p_station_id,auth.uid())) THEN RAISE EXCEPTION 'HOUR_RULES_FORBIDDEN'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id::text,'effectiveFrom',effective_from,'rules',rules,'createdAt',created_at) ORDER BY effective_from,id) FROM public.station_hour_rules WHERE station_id=p_station_id),'[]'::jsonb);
END $$;
CREATE FUNCTION public.save_station_hour_rules(p_station_id uuid,p_effective_from date,p_rules jsonb,p_ack_history boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_today date; v_previous public.station_hour_rules; v_id bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.is_platform_admin(auth.uid()) OR public.is_station_admin(p_station_id,auth.uid())) THEN RAISE EXCEPTION 'HOUR_RULES_FORBIDDEN'; END IF;
 SELECT (now() AT TIME ZONE timezone)::date INTO v_today FROM public.stations WHERE id=p_station_id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'HOUR_RULES_FORBIDDEN'; END IF;
 IF p_effective_from IS NULL OR p_effective_from<'2000-01-01' OR p_effective_from>'2100-12-31' OR NOT public.valid_station_hour_rules(p_rules) THEN RAISE EXCEPTION 'HOUR_RULES_INVALID'; END IF;
 IF extract(dow FROM p_effective_from)::int!=(p_rules->>'weekStartsOn')::int THEN RAISE EXCEPTION 'HOUR_RULES_WEEK_START'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('hour-rules:'||p_station_id::text,0));
 SELECT * INTO v_previous FROM public.station_hour_rules WHERE station_id=p_station_id ORDER BY effective_from DESC,id DESC LIMIT 1;
 IF FOUND THEN
  IF p_effective_from<=v_today OR p_effective_from<v_previous.effective_from THEN RAISE EXCEPTION 'HOUR_RULES_PAST'; END IF;
  IF (p_rules->>'weekStartsOn')::int!=(v_previous.rules->>'weekStartsOn')::int THEN RAISE EXCEPTION 'HOUR_RULES_FIXED_WEEK'; END IF;
 ELSIF p_effective_from<v_today AND NOT coalesce(p_ack_history,false) THEN RAISE EXCEPTION 'HOUR_RULES_ACK_HISTORY'; END IF;
 INSERT INTO public.station_hour_rules(station_id,effective_from,rules,created_by) VALUES (p_station_id,p_effective_from,p_rules,auth.uid()) RETURNING id INTO v_id;
 RETURN jsonb_build_object('id',v_id::text);
END $$;
REVOKE ALL ON FUNCTION public.get_station_hour_rules(uuid),public.save_station_hour_rules(uuid,date,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_station_hour_rules(uuid),public.save_station_hour_rules(uuid,date,jsonb,boolean) TO authenticated;
COMMIT;
