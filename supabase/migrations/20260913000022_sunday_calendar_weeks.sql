-- Coordinated release: deploy Sunday-aware clients with this migration.
-- Run during a maintenance window. No shift dates/times, assignments or attendance are changed.
BEGIN;
LOCK TABLE public.schedules, public.scheduled_shifts, public.shift_assignments,
 public.availability_weeks, public.availability_entries IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE sunday_schedule_sources ON COMMIT DROP AS
 SELECT id source_id, station_id, week_start_date-1 target_week, status FROM public.schedules
 UNION
 SELECT s.id, s.station_id, sh.shift_date-extract(dow FROM sh.shift_date)::int, s.status
 FROM public.schedules s JOIN public.scheduled_shifts sh ON sh.schedule_id=s.id;
-- A weekly status cannot represent a mixture of published and draft source days.
-- Abort rather than exposing drafts or unpublishing previously visible shifts.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM sunday_schedule_sources GROUP BY station_id,target_week
 HAVING count(DISTINCT status)>1) THEN
 RAISE EXCEPTION 'Sunday migration: conflicting publication statuses; inspect sunday-weeks-preflight.sql and resolve before retrying';
 END IF;
 IF EXISTS(SELECT 1 FROM public.scheduled_shifts sh JOIN public.schedules s ON s.id=sh.schedule_id
 WHERE sh.shift_date<s.week_start_date OR sh.shift_date>s.week_start_date+6) THEN
 RAISE EXCEPTION 'Sunday migration: shift outside its original week; resolve before retrying';
 END IF;
 IF EXISTS(SELECT 1 FROM public.availability_entries e JOIN public.availability_weeks w ON w.id=e.availability_week_id
 WHERE e.date<w.week_start_date OR e.date>w.week_start_date+6) THEN
 RAISE EXCEPTION 'Sunday migration: availability outside its original week; resolve before retrying';
 END IF;
END $$;

ALTER TABLE public.schedules DROP CONSTRAINT chk_week_start_is_monday;
ALTER TABLE public.availability_weeks DROP CONSTRAINT chk_availability_week_monday;
-- Suppress publication fanout only inside this locked migration transaction.
ALTER TABLE public.schedules DISABLE TRIGGER queue_worker_publication;
UPDATE public.schedules SET week_start_date=week_start_date-1;
INSERT INTO public.schedules(station_id,week_start_date,status,created_by)
 SELECT x.station_id,x.target_week,min(x.status::text)::public.schedule_status,
 (array_agg(s.created_by ORDER BY s.created_at,s.id))[1]
 FROM sunday_schedule_sources x JOIN public.schedules s ON s.id=x.source_id
 GROUP BY x.station_id,x.target_week
 ON CONFLICT(station_id,week_start_date) DO NOTHING;
UPDATE public.scheduled_shifts sh SET schedule_id=s.id
 FROM public.schedules s WHERE s.station_id=sh.station_id
 AND s.week_start_date=sh.shift_date-extract(dow FROM sh.shift_date)::int AND sh.schedule_id<>s.id;
ALTER TABLE public.schedules ENABLE TRIGGER queue_worker_publication;

CREATE TEMP TABLE sunday_availability_sources ON COMMIT DROP AS
 SELECT w.id source_id,w.station_id,w.station_membership_id,w.week_start_date-1 target_week,
 w.week_start_date old_week,w.notes,w.submitted_at,w.updated_at FROM public.availability_weeks w
 UNION
 SELECT w.id,w.station_id,w.station_membership_id,e.date-extract(dow FROM e.date)::int,
 w.week_start_date,w.notes,w.submitted_at,w.updated_at
 FROM public.availability_weeks w JOIN public.availability_entries e ON e.availability_week_id=w.id;
UPDATE public.availability_weeks SET week_start_date=week_start_date-1;
INSERT INTO public.availability_weeks(station_id,station_membership_id,week_start_date,submitted_at)
 SELECT station_id,station_membership_id,target_week,max(submitted_at)
 FROM sunday_availability_sources GROUP BY station_id,station_membership_id,target_week
 ON CONFLICT(station_membership_id,week_start_date) DO NOTHING;
-- Preserve exact per-day data/IDs. Missing days remain missing, never invented as available.
UPDATE public.availability_entries e SET availability_week_id=target.id
 FROM public.availability_weeks old,public.availability_weeks target
 WHERE old.id=e.availability_week_id AND target.station_membership_id=old.station_membership_id
 AND target.week_start_date=e.date-extract(dow FROM e.date)::int AND e.availability_week_id<>target.id;
-- Retain both source notes, with original week provenance when combining submissions.
UPDATE public.availability_weeks w SET notes=x.notes, submitted_at=x.submitted_at
 FROM (SELECT station_membership_id,target_week,max(submitted_at) submitted_at,
 string_agg('['||old_week::text||'] '||notes,E'\n' ORDER BY old_week) FILTER (WHERE notes IS NOT NULL AND notes<>'') notes
 FROM sunday_availability_sources GROUP BY station_membership_id,target_week) x
 WHERE w.station_membership_id=x.station_membership_id AND w.week_start_date=x.target_week;
ALTER TABLE public.schedules ADD CONSTRAINT chk_week_start_is_sunday CHECK (extract(dow FROM week_start_date)=0);
ALTER TABLE public.availability_weeks ADD CONSTRAINT chk_availability_week_sunday CHECK (extract(dow FROM week_start_date)=0);

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

 v_current := timezone(v_timezone, statement_timestamp())::date - extract(dow FROM timezone(v_timezone, statement_timestamp()))::int;
 IF p_week IS NULL OR extract(dow FROM p_week) <> 0 OR p_week < v_current OR p_week > v_current+14 THEN
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
