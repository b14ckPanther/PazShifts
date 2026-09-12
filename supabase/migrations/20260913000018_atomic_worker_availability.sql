-- Atomic worker submission. No new tables/columns or RLS changes.
BEGIN;
CREATE OR REPLACE FUNCTION public.submit_worker_availability(
 p_station_id uuid, p_membership_id uuid, p_week date,
 p_entries jsonb, p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
 v_timezone text;
 v_current date;
 v_week public.availability_weeks;
 v_entry jsonb;
 v_date date;
 v_type text;
 v_start time;
 v_end time;
 v_seen date[] := '{}';
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 -- Serialize submissions before validating access; use SELECT rights only.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_membership_id::text, 18));
 SELECT s.timezone INTO v_timezone
 FROM public.station_memberships m JOIN public.stations s ON s.id=m.station_id
 JOIN public.profiles p ON p.id=m.user_id
 WHERE m.id=p_membership_id AND m.station_id=p_station_id AND m.user_id=auth.uid()
 AND m.status='ACTIVE' AND s.is_active AND p.is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active membership required' USING ERRCODE='42501'; END IF;

 v_current := date_trunc('week', timezone(v_timezone, statement_timestamp()))::date;
 IF p_week IS NULL OR extract(isodow FROM p_week) <> 1 OR p_week < v_current OR p_week > v_current+14 THEN
  RAISE EXCEPTION 'Invalid availability week' USING ERRCODE='22023';
 END IF;
 IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_entries) <> 7 THEN
  RAISE EXCEPTION 'Exactly seven days required' USING ERRCODE='22023';
 END IF;
 FOR v_entry IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
  IF jsonb_typeof(v_entry) IS DISTINCT FROM 'object' OR coalesce(v_entry->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' THEN
   RAISE EXCEPTION 'Invalid day' USING ERRCODE='22023';
  END IF;
  v_date := (v_entry->>'date')::date;
  v_type := v_entry->>'availabilityType';
  IF v_date < p_week OR v_date > p_week+6 OR v_date=ANY(v_seen) OR v_type IS NULL OR
   v_type NOT IN ('ALL_DAY_AVAILABLE','ALL_DAY_UNAVAILABLE','TIME_WINDOW') THEN
   RAISE EXCEPTION 'Invalid or duplicate day' USING ERRCODE='22023';
  END IF;
  v_seen := array_append(v_seen,v_date);
  IF v_type='TIME_WINDOW' THEN
   IF coalesce(v_entry->>'startTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
    OR coalesce(v_entry->>'endTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
    RAISE EXCEPTION 'Invalid time window' USING ERRCODE='22023';
   END IF;
   v_start := (v_entry->>'startTime')::time; v_end := (v_entry->>'endTime')::time;
   IF v_start=v_end THEN RAISE EXCEPTION 'Equal times are invalid' USING ERRCODE='22023'; END IF;
  END IF;
 END LOOP;
 INSERT INTO public.availability_weeks(station_id,station_membership_id,week_start_date,notes,submitted_at,updated_at)
 VALUES(p_station_id,p_membership_id,p_week,nullif(trim(p_notes),''),statement_timestamp(),statement_timestamp())
 ON CONFLICT(station_membership_id,week_start_date) DO UPDATE SET
 notes=excluded.notes,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at
 RETURNING * INTO v_week;
 DELETE FROM public.availability_entries WHERE availability_week_id=v_week.id;
 INSERT INTO public.availability_entries(availability_week_id,date,availability_type,start_time,end_time,notes)
 SELECT v_week.id,(e->>'date')::date,(e->>'availabilityType')::public.availability_type,
 CASE WHEN e->>'availabilityType'='TIME_WINDOW' THEN (e->>'startTime')::time END,
 CASE WHEN e->>'availabilityType'='TIME_WINDOW' THEN (e->>'endTime')::time END,
 nullif(trim(e->>'notes'),'') FROM jsonb_array_elements(p_entries) e;
 RETURN jsonb_build_object('week',to_jsonb(v_week),'entries',(
 SELECT jsonb_agg(to_jsonb(e) ORDER BY e.date) FROM public.availability_entries e WHERE e.availability_week_id=v_week.id));
END;
$$;
REVOKE ALL ON FUNCTION public.submit_worker_availability(uuid,uuid,date,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_worker_availability(uuid,uuid,date,jsonb,text) TO authenticated;
COMMIT;
