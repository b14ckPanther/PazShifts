BEGIN;
-- Worker notifications v2: PWA Web Push alongside Expo, fixed shift reminders (2h / 10 min),
-- availability reminders, a checkout reminder after the scheduled end, and a 12-hour cap on a
-- single check-in. The capped record waits for admin review and is not counted until confirmed.

ALTER TABLE public.worker_notifications DROP CONSTRAINT worker_notifications_type_check;
ALTER TABLE public.worker_notifications ADD CONSTRAINT worker_notifications_type_check CHECK(type IN (
 'SCHEDULE_PUBLISHED','SHIFT_REMINDER','LEFT_OPEN',
 'SHIFT_TODAY','SHIFT_SOON','CHECKOUT_REMINDER','SHIFT_CAPPED','AVAILABILITY_REMINDER'));

-- ---------- 12-hour cap ----------
-- FLAGGED (unused until now) means "stopped at 12 hours, waiting for admin review".
CREATE FUNCTION public.cap_overdue_attendance(p_user uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_count integer;
BEGIN
 WITH capped AS (
  UPDATE public.attendance_records SET status='FLAGGED',clock_out_at=clock_in_at+interval '12 hours',updated_at=clock_timestamp()
  WHERE status='ACTIVE' AND clock_in_at<=clock_timestamp()-interval '12 hours' AND (p_user IS NULL OR user_id=p_user)
  RETURNING *
 ), queued AS (
  INSERT INTO public.worker_notifications(user_id,station_id,type,title,body,data,dedupe_key,expires_at)
  SELECT c.user_id,c.station_id,'SHIFT_CAPPED','המשמרת נעצרה אחרי 12 שעות',
   'לא דווחה יציאה, לכן ספירת הזמן נעצרה. מנהל התחנה יאשר את שעת הסיום.',
   jsonb_build_object('stationId',c.station_id,'stationName',s.name,'attendanceId',c.id,'day',(c.clock_in_at AT TIME ZONE s.timezone)::date),
   'capped:'||c.id,now()+interval '24 hours'
  FROM capped c JOIN public.stations s ON s.id=c.station_id
  ON CONFLICT(dedupe_key) DO NOTHING
  RETURNING 1
 ) SELECT count(*) INTO v_count FROM capped;
 RETURN v_count;
END $$;

-- Admins confirm a capped record (keeping the 12-hour end) or correct it via save_manual_attendance.
-- A reason is optional for every admin attendance action.
CREATE OR REPLACE FUNCTION public.manage_attendance_record(p_station_id uuid,p_record_id uuid,p_action text,p_reason text,p_expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_actor uuid := auth.uid();
 v_old public.attendance_records;
 v_new public.attendance_records;
BEGIN
 IF v_actor IS NULL OR NOT (public.is_platform_admin(v_actor) OR public.is_station_admin(p_station_id,v_actor))
 OR NOT EXISTS(SELECT 1 FROM public.stations WHERE id=p_station_id AND is_active) THEN RAISE EXCEPTION 'MANUAL_FORBIDDEN'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('CLOSE','DELETE','CONFIRM') THEN RAISE EXCEPTION 'MANUAL_ACTION'; END IF;
 IF length(p_reason)>1000 THEN RAISE EXCEPTION 'MANUAL_REASON'; END IF;
 SELECT * INTO v_old FROM public.attendance_records WHERE id=p_record_id AND station_id=p_station_id;
 IF NOT FOUND THEN
  IF p_action='DELETE' AND EXISTS(SELECT 1 FROM public.attendance_removals WHERE attendance_record_id=p_record_id AND station_id=p_station_id) THEN RETURN jsonb_build_object('success',true); END IF;
  RAISE EXCEPTION 'MANUAL_STALE';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_old.user_id::text,0));
 SELECT * INTO v_old FROM public.attendance_records WHERE id=p_record_id AND station_id=p_station_id FOR UPDATE;
 IF NOT FOUND OR p_expected_updated_at IS NULL OR v_old.updated_at<>p_expected_updated_at THEN RAISE EXCEPTION 'MANUAL_STALE'; END IF;
 IF p_action='DELETE' THEN
  INSERT INTO public.attendance_removals(attendance_record_id,station_id,actor_id,reason,before_record)
   VALUES(v_old.id,p_station_id,v_actor,coalesce(trim(p_reason),''),to_jsonb(v_old));
  DELETE FROM public.attendance_records WHERE id=v_old.id;
  RETURN jsonb_build_object('success',true);
 ELSIF p_action='CONFIRM' THEN
  IF v_old.status<>'FLAGGED' OR v_old.clock_out_at IS NULL THEN RAISE EXCEPTION 'MANUAL_STALE'; END IF;
  UPDATE public.attendance_records SET status='COMPLETED',clock_out_source='MANUAL_ADMIN',
   corrected_by=v_actor,correction_reason=nullif(trim(p_reason),''),corrected_at=clock_timestamp(),updated_at=clock_timestamp()
   WHERE id=v_old.id RETURNING * INTO v_new;
 ELSE
  IF v_old.status<>'ACTIVE' THEN RAISE EXCEPTION 'MANUAL_STALE'; END IF;
  UPDATE public.attendance_records SET status='COMPLETED',clock_out_at=greatest(clock_timestamp(),clock_in_at),
   clock_out_source='MANUAL_ADMIN',corrected_by=v_actor,correction_reason=nullif(trim(p_reason),''),corrected_at=clock_timestamp(),updated_at=clock_timestamp()
   WHERE id=v_old.id RETURNING * INTO v_new;
 END IF;
 INSERT INTO public.attendance_manual_audit(station_id,attendance_record_id,actor_id,reason,before_record,after_record)
  VALUES(p_station_id,v_old.id,v_actor,coalesce(trim(p_reason),''),to_jsonb(v_old),to_jsonb(v_new));
 RETURN jsonb_build_object('success',true);
END; $$;

CREATE OR REPLACE FUNCTION public.save_manual_attendance(
 p_station_id uuid, p_membership_id uuid, p_record_id uuid,
 p_clock_in timestamp, p_clock_out timestamp, p_reason text, p_expected_updated_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
 v_actor uuid := auth.uid();
 v_member public.station_memberships;
 v_old public.attendance_records;
 v_new public.attendance_records;
 v_zone text;
 v_in timestamptz;
 v_out timestamptz;
BEGIN
 IF v_actor IS NULL OR NOT (public.is_platform_admin(v_actor) OR public.is_station_admin(p_station_id, v_actor)) THEN
  RAISE EXCEPTION 'MANUAL_FORBIDDEN';
 END IF;
 IF length(p_reason) > 1000 THEN RAISE EXCEPTION 'MANUAL_REASON'; END IF;
 SELECT * INTO v_member FROM public.station_memberships WHERE id = p_membership_id AND station_id = p_station_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'MANUAL_FORBIDDEN'; END IF;
 SELECT timezone INTO v_zone FROM public.stations WHERE id = p_station_id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'MANUAL_FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_member.user_id::text, 0));
 IF p_record_id IS NOT NULL THEN
  SELECT * INTO v_old FROM public.attendance_records WHERE id = p_record_id AND station_id = p_station_id AND station_membership_id = p_membership_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MANUAL_FORBIDDEN'; END IF;
  IF p_expected_updated_at IS NULL OR v_old.updated_at != p_expected_updated_at THEN RAISE EXCEPTION 'MANUAL_STALE'; END IF;
 ELSIF v_member.status != 'ACTIVE' THEN RAISE EXCEPTION 'MANUAL_FORBIDDEN';
 END IF;
 v_in := p_clock_in AT TIME ZONE v_zone;
 v_out := p_clock_out AT TIME ZONE v_zone;
 IF v_in IS NULL OR NOT isfinite(v_in) OR v_in > now() OR
    (v_out IS NOT NULL AND (NOT isfinite(v_out) OR v_out < v_in OR v_out > now())) THEN
  RAISE EXCEPTION 'MANUAL_TIME';
 END IF;
 -- Reject local timestamps inside a daylight-saving gap instead of silently shifting them.
 IF v_in AT TIME ZONE v_zone != p_clock_in OR (v_out IS NOT NULL AND v_out AT TIME ZONE v_zone != p_clock_out) THEN RAISE EXCEPTION 'MANUAL_TIME'; END IF;
 IF EXISTS (SELECT 1 FROM public.attendance_records r WHERE r.user_id = v_member.user_id
   AND (p_record_id IS NULL OR r.id != p_record_id)
   AND tstzrange(r.clock_in_at, coalesce(r.clock_out_at, 'infinity'), '[)') && tstzrange(v_in, coalesce(v_out, 'infinity'), '[)')) THEN
  RAISE EXCEPTION 'MANUAL_OVERLAP';
 END IF;
 IF p_record_id IS NULL THEN
  INSERT INTO public.attendance_records(station_id, station_membership_id, user_id, clock_in_at, clock_out_at, status, clock_in_source, clock_out_source, corrected_by, correction_reason, corrected_at)
  VALUES (p_station_id,p_membership_id,v_member.user_id,v_in,v_out,
    CASE WHEN v_out IS NULL THEN 'ACTIVE'::public.attendance_status ELSE 'COMPLETED'::public.attendance_status END,
    'MANUAL_ADMIN',CASE WHEN v_out IS NULL THEN NULL ELSE 'MANUAL_ADMIN'::public.attendance_source END,v_actor,nullif(trim(p_reason),''),now()) RETURNING * INTO v_new;
 ELSE
  UPDATE public.attendance_records SET clock_in_at=v_in, clock_out_at=v_out,
   status=CASE WHEN v_out IS NULL THEN 'ACTIVE'::public.attendance_status ELSE 'COMPLETED'::public.attendance_status END,
   clock_in_source=CASE WHEN v_in IS DISTINCT FROM v_old.clock_in_at THEN 'MANUAL_ADMIN'::public.attendance_source ELSE clock_in_source END,
   clock_out_source=CASE WHEN v_out IS NULL THEN NULL WHEN v_out IS DISTINCT FROM v_old.clock_out_at THEN 'MANUAL_ADMIN'::public.attendance_source ELSE clock_out_source END,
   corrected_by=v_actor, correction_reason=nullif(trim(p_reason),''), corrected_at=now(), updated_at=now()
  WHERE id=p_record_id RETURNING * INTO v_new;
 END IF;
 INSERT INTO public.attendance_manual_audit(station_id, attendance_record_id, actor_id, reason, before_record, after_record)
 VALUES(p_station_id,v_new.id,v_actor,coalesce(trim(p_reason),''),CASE WHEN p_record_id IS NULL THEN NULL ELSE to_jsonb(v_old) END,to_jsonb(v_new));
 RETURN to_jsonb(v_new);
END; $$;

-- Every scan caps the worker's own overdue check-in first, so a scan after 12 hours starts fresh
-- even if the scheduler has not run yet. The engine itself is unchanged.
ALTER FUNCTION public.process_nfc_scan(text,uuid,timestamptz,text,double precision,double precision,double precision,timestamptz) RENAME TO process_nfc_scan_engine;
REVOKE ALL ON FUNCTION public.process_nfc_scan_engine(text,uuid,timestamptz,text,double precision,double precision,double precision,timestamptz) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.process_nfc_scan(p_token text,p_scan_id uuid,p_scanned_at timestamptz,p_decision text,p_latitude double precision,p_longitude double precision,p_accuracy double precision,p_location_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  PERFORM public.cap_overdue_attendance(auth.uid());
 END IF;
 RETURN public.process_nfc_scan_engine(p_token,p_scan_id,p_scanned_at,p_decision,p_latitude,p_longitude,p_accuracy,p_location_at);
END $$;
REVOKE ALL ON FUNCTION public.process_nfc_scan(text,uuid,timestamptz,text,double precision,double precision,double precision,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.process_nfc_scan(text,uuid,timestamptz,text,double precision,double precision,double precision,timestamptz) TO authenticated;

-- ---------- Eligibility, re-checked immediately before every send ----------
CREATE OR REPLACE FUNCTION public.worker_notification_current(n public.worker_notifications) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT CASE
 WHEN n.type='LEFT_OPEN' THEN n.expires_at>now() AND EXISTS(
  SELECT 1 FROM public.attendance_records r JOIN public.station_memberships m ON m.id=r.station_membership_id
  JOIN public.stations s ON s.id=r.station_id JOIN public.profiles p ON p.id=r.user_id
  LEFT JOIN public.worker_notification_preferences pref ON pref.user_id=r.user_id
  WHERE r.id::text=n.data->>'attendanceId' AND r.user_id=n.user_id AND r.station_id=n.station_id
  AND r.status='ACTIVE' AND m.status='ACTIVE' AND m.user_id=r.user_id AND s.is_active AND p.is_active
  AND r.clock_in_at<=now()-make_interval(hours=>s.left_open_warning_hours) AND coalesce(pref.reminder_minutes,60)>0)
 WHEN n.type='CHECKOUT_REMINDER' THEN n.expires_at>now() AND EXISTS(
  SELECT 1 FROM public.attendance_records r JOIN public.station_memberships m ON m.id=r.station_membership_id
  JOIN public.stations s ON s.id=r.station_id JOIN public.profiles p ON p.id=r.user_id
  WHERE r.id::text=n.data->>'attendanceId' AND r.user_id=n.user_id AND r.station_id=n.station_id
  AND r.status='ACTIVE' AND m.status='ACTIVE' AND s.is_active AND p.is_active)
 WHEN n.type='SHIFT_CAPPED' THEN n.expires_at>now() AND EXISTS(
  SELECT 1 FROM public.attendance_records r JOIN public.station_memberships m ON m.id=r.station_membership_id
  JOIN public.stations s ON s.id=r.station_id JOIN public.profiles p ON p.id=r.user_id
  WHERE r.id::text=n.data->>'attendanceId' AND r.user_id=n.user_id AND r.status='FLAGGED'
  AND m.status='ACTIVE' AND s.is_active AND p.is_active)
 WHEN n.type='AVAILABILITY_REMINDER' THEN n.expires_at>now() AND EXISTS(
  SELECT 1 FROM public.station_memberships m JOIN public.stations s ON s.id=m.station_id JOIN public.profiles p ON p.id=m.user_id
  WHERE m.id::text=n.data->>'membershipId' AND m.user_id=n.user_id AND m.status='ACTIVE' AND s.is_active AND p.is_active
  AND NOT EXISTS(SELECT 1 FROM public.availability_weeks w WHERE w.station_membership_id=m.id AND w.week_start_date=(n.data->>'weekStart')::date
   AND (SELECT count(DISTINCT e.date) FROM public.availability_entries e WHERE e.availability_week_id=w.id)=7))
 WHEN n.type IN ('SHIFT_TODAY','SHIFT_SOON') THEN EXISTS(
  SELECT 1 FROM public.station_memberships m JOIN public.profiles p ON p.id=m.user_id
  JOIN public.stations st ON st.id=m.station_id JOIN public.shift_assignments a ON a.station_membership_id=m.id
  JOIN public.scheduled_shifts s ON s.id=a.scheduled_shift_id JOIN public.schedules w ON w.id=s.schedule_id
  LEFT JOIN public.worker_notification_preferences pref ON pref.user_id=m.user_id
  WHERE m.user_id=n.user_id AND m.station_id=n.station_id AND m.status='ACTIVE' AND p.is_active AND st.is_active
  AND a.status='ASSIGNED' AND w.status='PUBLISHED' AND coalesce(pref.reminder_minutes,60)>0
  AND s.id::text=n.data->>'shiftId' AND s.start_at=(n.data->>'startAt')::timestamptz
  AND public.scheduled_notification_instant(s.start_at,st.timezone)>now()
  AND (n.type='SHIFT_TODAY' OR NOT EXISTS(SELECT 1 FROM public.attendance_records r WHERE r.user_id=n.user_id AND r.status='ACTIVE')))
 ELSE public.worker_notification_current_schedule(n) END;
$$;

-- The legacy 0/30/60 reminder is replaced by the fixed 2-hour and 10-minute reminders below.
-- Everything else in the Expo claim (device/session checks, retries, dedupe) is unchanged.
CREATE OR REPLACE FUNCTION public.claim_worker_notifications_schedule() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF NOT pg_try_advisory_xact_lock(9131901) THEN RETURN '[]'::jsonb; END IF;
 DELETE FROM public.worker_devices WHERE last_seen_at<now()-interval '30 days';
 UPDATE public.worker_notification_deliveries SET state='uncertain',error_code='Interrupted',updated_at=now() WHERE state='sending' AND updated_at<now()-interval '5 minutes';
 INSERT INTO public.worker_notification_deliveries(notification_id,device_id,token_snapshot)
 SELECT n.id,d.id,d.expo_push_token FROM public.worker_notifications n JOIN public.worker_devices d ON d.user_id=n.user_id
 JOIN auth.sessions sess ON sess.id=d.session_id AND (sess.not_after IS NULL OR sess.not_after>now())
 WHERE d.notifications_enabled AND n.created_at>=d.created_at AND public.worker_notification_current(n)
 ON CONFLICT(notification_id,device_id) DO NOTHING;
 UPDATE public.worker_notification_deliveries q SET state='cancelled',updated_at=now()
 FROM public.worker_notifications n,public.worker_devices d WHERE q.notification_id=n.id AND q.device_id=d.id AND q.state='pending'
 AND (NOT public.worker_notification_current(n) OR d.user_id<>n.user_id OR d.expo_push_token<>q.token_snapshot OR NOT d.notifications_enabled);
 UPDATE public.worker_notification_deliveries q SET state='pending',token_snapshot=d.expo_push_token,updated_at=now()
 FROM public.worker_notifications n,public.worker_devices d WHERE q.notification_id=n.id AND q.device_id=d.id AND q.state='cancelled' AND q.attempts=0
 AND d.user_id=n.user_id AND d.notifications_enabled AND n.created_at>=d.created_at AND public.worker_notification_current(n);
 UPDATE public.worker_notification_deliveries SET state='failed',error_code='RetryLimit',updated_at=now() WHERE state='pending' AND attempts>=3;
 WITH candidates AS (
 SELECT q.id FROM public.worker_notification_deliveries q JOIN public.worker_devices d ON d.id=q.device_id
 JOIN auth.sessions sess ON sess.id=d.session_id AND (sess.not_after IS NULL OR sess.not_after>now())
 WHERE q.state='pending' AND q.next_attempt_at<=now() AND q.attempts<3 ORDER BY q.next_attempt_at,q.id LIMIT 100 FOR UPDATE OF q SKIP LOCKED
 ), claimed AS (
 UPDATE public.worker_notification_deliveries q SET state='sending',attempts=attempts+1,updated_at=now() FROM candidates c WHERE q.id=c.id RETURNING q.*
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'token',q.token_snapshot,'notificationId',n.id,'title',n.title,'body',n.body,'userId',n.user_id)), '[]'::jsonb) INTO result
 FROM claimed q JOIN public.worker_notifications n ON n.id=q.notification_id;
 RETURN result;
END $$;

-- ---------- Generation: runs every minute from the scheduler ----------
CREATE OR REPLACE FUNCTION public.claim_worker_notifications() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT pg_try_advisory_xact_lock(9131901) THEN RETURN '[]'::jsonb; END IF;
 PERFORM public.cap_overdue_attendance();

 -- Left open (stations warning earlier than the 12-hour cap).
 INSERT INTO public.worker_notifications(user_id,station_id,type,title,body,data,dedupe_key,expires_at)
 SELECT r.user_id,r.station_id,'LEFT_OPEN','המשמרת עדיין פתוחה','אם סיימת לעבוד, סרוק את תג התחנה לדיווח יציאה. אם שכחת לדווח, פנה למנהל לתיקון.',
 jsonb_build_object('stationId',r.station_id,'stationName',s.name,'attendanceId',r.id,'day',(r.clock_in_at AT TIME ZONE s.timezone)::date),
 'left-open:'||r.id,now()+interval '24 hours'
 FROM public.attendance_records r JOIN public.station_memberships m ON m.id=r.station_membership_id
 JOIN public.stations s ON s.id=r.station_id JOIN public.profiles p ON p.id=r.user_id
 LEFT JOIN public.worker_notification_preferences pref ON pref.user_id=r.user_id
 WHERE r.status='ACTIVE' AND m.status='ACTIVE' AND m.user_id=r.user_id AND m.station_id=r.station_id AND s.is_active AND p.is_active
 AND r.clock_in_at<=now()-make_interval(hours=>s.left_open_warning_hours) AND coalesce(pref.reminder_minutes,60)>0
 ON CONFLICT(dedupe_key) DO NOTHING;

 -- Shift today (2 hours before) and shift soon (10 minutes before). Stored shift times are
 -- station wall-clock values; scheduled_notification_instant gives the real instant.
 INSERT INTO public.worker_notifications(user_id,station_id,type,title,body,data,dedupe_key,expires_at)
 SELECT m.user_id,m.station_id,k.type,k.title,
  CASE k.type WHEN 'SHIFT_TODAY' THEN 'המשמרת שלך מתחילה היום ב-'||to_char(s.start_at AT TIME ZONE 'UTC','HH24:MI')||' בתחנת '||st.name||'.'
  ELSE 'המשמרת מתחילה ב-'||to_char(s.start_at AT TIME ZONE 'UTC','HH24:MI')||'. בהגעה, סרקו את תג התחנה.' END,
  jsonb_build_object('stationName',st.name,'stationId',m.station_id,'scheduleId',w.id,'shiftId',s.id,'day',s.shift_date,'startAt',s.start_at),
  lower(k.type)||':'||s.id||':'||extract(epoch FROM s.start_at)||':'||m.user_id,x.instant
 FROM public.scheduled_shifts s JOIN public.schedules w ON w.id=s.schedule_id
 JOIN public.shift_assignments a ON a.scheduled_shift_id=s.id JOIN public.station_memberships m ON m.id=a.station_membership_id
 JOIN public.profiles p ON p.id=m.user_id JOIN public.stations st ON st.id=m.station_id
 LEFT JOIN public.worker_notification_preferences pref ON pref.user_id=m.user_id
 CROSS JOIN LATERAL (SELECT public.scheduled_notification_instant(s.start_at,st.timezone) AS instant) x
 JOIN (VALUES ('SHIFT_TODAY','יש לך משמרת היום',interval '120 minutes',interval '30 minutes'),
              ('SHIFT_SOON','המשמרת מתחילה בעוד 10 דקות',interval '10 minutes',interval '0 minutes')) k(type,title,lead,cutoff)
  ON now()>=x.instant-k.lead AND now()<x.instant-k.cutoff
 WHERE s.start_at BETWEEN now()-interval '1 day' AND now()+interval '1 day'
 AND w.status='PUBLISHED' AND a.status='ASSIGNED' AND m.status='ACTIVE' AND p.is_active AND st.is_active
 AND coalesce(pref.reminder_minutes,60)>0
 AND (k.type='SHIFT_TODAY' OR NOT EXISTS(SELECT 1 FROM public.attendance_records r WHERE r.user_id=m.user_id AND r.status='ACTIVE'))
 ON CONFLICT(dedupe_key) DO NOTHING;

 -- Checkout reminder: still checked in 10 minutes after the linked shift's scheduled end.
 INSERT INTO public.worker_notifications(user_id,station_id,type,title,body,data,dedupe_key,expires_at)
 SELECT r.user_id,r.station_id,'CHECKOUT_REMINDER','זכרו לדווח יציאה',
  'המשמרת שלך הסתיימה ב-'||to_char(sh.end_at AT TIME ZONE 'UTC','HH24:MI')||'. אם סיימת לעבוד, סרקו את תג התחנה לדיווח יציאה.',
  jsonb_build_object('stationId',r.station_id,'stationName',s.name,'attendanceId',r.id,'day',(r.clock_in_at AT TIME ZONE s.timezone)::date),
  'checkout:'||r.id,r.clock_in_at+interval '12 hours'
 FROM public.attendance_records r JOIN public.scheduled_shifts sh ON sh.id=r.scheduled_shift_id
 JOIN public.station_memberships m ON m.id=r.station_membership_id
 JOIN public.stations s ON s.id=r.station_id JOIN public.profiles p ON p.id=r.user_id
 CROSS JOIN LATERAL (SELECT public.scheduled_notification_instant(sh.end_at,s.timezone) AS instant) x
 WHERE r.status='ACTIVE' AND m.status='ACTIVE' AND s.is_active AND p.is_active
 AND x.instant>r.clock_in_at AND now()>=x.instant+interval '10 minutes' AND r.clock_in_at>now()-interval '12 hours'
 ON CONFLICT(dedupe_key) DO NOTHING;

 -- Availability: Thursday 18:00, Friday 12:00, Saturday 08:00 station time, until next week is submitted.
 INSERT INTO public.worker_notifications(user_id,station_id,type,title,body,data,dedupe_key,expires_at)
 SELECT m.user_id,m.station_id,'AVAILABILITY_REMINDER',
  CASE WHEN k.dow=6 THEN 'תזכורת אחרונה: הגשת זמינות' ELSE 'הגשת זמינות לשבוע הבא' END,
  CASE WHEN k.dow=6 THEN 'ההגשה לשבוע הבא נסגרת הבוקר. הגישו זמינות עכשיו כדי שישבצו אתכם.'
  ELSE 'עוד לא הגשת זמינות לשבוע שמתחיל ב-'||to_char(x.next_week,'DD/MM')||'. ההגשה נסגרת בשבת בבוקר.' END,
  jsonb_build_object('stationId',m.station_id,'stationName',st.name,'membershipId',m.id,'weekStart',x.next_week,'day',x.local_now::date),
  'availability:'||m.id||':'||x.next_week||':'||k.dow,
  (x.local_now::date+k.at+interval '3 hours') AT TIME ZONE st.timezone
 FROM public.station_memberships m JOIN public.stations st ON st.id=m.station_id JOIN public.profiles p ON p.id=m.user_id
 CROSS JOIN LATERAL (SELECT now() AT TIME ZONE st.timezone AS local_now) l
 CROSS JOIN LATERAL (SELECT l.local_now,(l.local_now::date+(7-extract(dow FROM l.local_now)::int)) AS next_week) x
 JOIN (VALUES (4,time '18:00'),(5,time '12:00'),(6,time '08:00')) k(dow,at)
  ON extract(dow FROM x.local_now)=k.dow AND x.local_now::time>=k.at AND x.local_now::time<k.at+interval '3 hours'
 WHERE m.status='ACTIVE' AND m.role<>'ADMIN' AND st.is_active AND p.is_active
 AND NOT EXISTS(SELECT 1 FROM public.availability_weeks w WHERE w.station_membership_id=m.id AND w.week_start_date=x.next_week
  AND (SELECT count(DISTINCT e.date) FROM public.availability_entries e WHERE e.availability_week_id=w.id)=7)
 ON CONFLICT(dedupe_key) DO NOTHING;

 RETURN public.claim_worker_notifications_schedule();
END $$;

-- ---------- Web Push (PWA) ----------
-- A subscription belongs to the signed-in browser session; logging out removes it.
CREATE TABLE public.worker_web_push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,
 -- Only real push services: the dispatcher must never POST to an arbitrary host.
 endpoint text NOT NULL UNIQUE CHECK (length(endpoint)<=1024 AND endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'),
 p256dh text NOT NULL CHECK (p256dh ~ '^[A-Za-z0-9_-]{80,100}={0,2}$'),
 auth_secret text NOT NULL CHECK (auth_secret ~ '^[A-Za-z0-9_-]{16,32}={0,2}$'),
 user_agent text CHECK (length(user_agent)<=300),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.worker_web_push_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 notification_id uuid NOT NULL REFERENCES public.worker_notifications(id) ON DELETE CASCADE,
 subscription_id uuid NOT NULL REFERENCES public.worker_web_push_subscriptions(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','sent','failed','uncertain','cancelled')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 error_code text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(notification_id,subscription_id)
);
CREATE INDEX worker_web_push_user ON public.worker_web_push_subscriptions(user_id);
CREATE INDEX worker_web_push_pending ON public.worker_web_push_deliveries(next_attempt_at) WHERE state='pending';
CREATE INDEX worker_notifications_recent ON public.worker_notifications(created_at);
ALTER TABLE public.worker_web_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_web_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.worker_web_push_subscriptions,public.worker_web_push_deliveries FROM anon,authenticated;
GRANT ALL ON public.worker_web_push_subscriptions,public.worker_web_push_deliveries TO service_role;

CREATE FUNCTION public.register_web_push_subscription(p_endpoint text,p_p256dh text,p_auth text,p_user_agent text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_session uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active) THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 v_session := (auth.jwt()->>'session_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=v_session AND user_id=auth.uid() AND (not_after IS NULL OR not_after>now())) THEN RAISE EXCEPTION 'Session unavailable'; END IF;
 -- The endpoint and keys are held by this browser; re-registering moves it to whoever signed in.
 INSERT INTO public.worker_web_push_subscriptions(user_id,session_id,endpoint,p256dh,auth_secret,user_agent)
 VALUES(auth.uid(),v_session,p_endpoint,p_p256dh,p_auth,left(p_user_agent,300))
 ON CONFLICT(endpoint) DO UPDATE SET created_at=CASE WHEN worker_web_push_subscriptions.user_id<>excluded.user_id THEN now() ELSE worker_web_push_subscriptions.created_at END,
  user_id=excluded.user_id,session_id=excluded.session_id,p256dh=excluded.p256dh,auth_secret=excluded.auth_secret,
  user_agent=excluded.user_agent,last_seen_at=now(),updated_at=now();
END $$;
CREATE FUNCTION public.unregister_web_push_subscription(p_endpoint text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 DELETE FROM public.worker_web_push_subscriptions WHERE endpoint=p_endpoint AND user_id=auth.uid();
$$;

-- Service-only: queue web deliveries for current notifications and claim a batch to send.
CREATE FUNCTION public.claim_worker_web_push() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF NOT pg_try_advisory_xact_lock(9131902) THEN RETURN '[]'::jsonb; END IF;
 DELETE FROM public.worker_web_push_subscriptions WHERE last_seen_at<now()-interval '60 days';
 UPDATE public.worker_web_push_deliveries SET state='uncertain',error_code='Interrupted',updated_at=now() WHERE state='sending' AND updated_at<now()-interval '5 minutes';
 INSERT INTO public.worker_web_push_deliveries(notification_id,subscription_id)
 SELECT n.id,w.id FROM public.worker_notifications n JOIN public.worker_web_push_subscriptions w ON w.user_id=n.user_id
 JOIN auth.sessions sess ON sess.id=w.session_id AND (sess.not_after IS NULL OR sess.not_after>now())
 WHERE n.created_at>now()-interval '2 days' AND n.created_at>=w.created_at AND public.worker_notification_current(n)
 ON CONFLICT(notification_id,subscription_id) DO NOTHING;
 UPDATE public.worker_web_push_deliveries q SET state='cancelled',updated_at=now()
 FROM public.worker_notifications n,public.worker_web_push_subscriptions w WHERE q.notification_id=n.id AND q.subscription_id=w.id AND q.state='pending'
 AND (NOT public.worker_notification_current(n) OR w.user_id<>n.user_id);
 UPDATE public.worker_web_push_deliveries SET state='failed',error_code='RetryLimit',updated_at=now() WHERE state='pending' AND attempts>=3;
 WITH candidates AS (
  SELECT q.id FROM public.worker_web_push_deliveries q WHERE q.state='pending' AND q.next_attempt_at<=now() AND q.attempts<3
  ORDER BY q.next_attempt_at,q.id LIMIT 100 FOR UPDATE OF q SKIP LOCKED
 ), claimed AS (
  UPDATE public.worker_web_push_deliveries q SET state='sending',attempts=attempts+1,updated_at=now() FROM candidates c WHERE q.id=c.id RETURNING q.*
 ) SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',q.id,'subscriptionId',w.id,'endpoint',w.endpoint,'p256dh',w.p256dh,'auth',w.auth_secret,
   'notificationId',n.id,'type',n.type,'title',n.title,'body',n.body,
   'url','/stations/'||st.code||CASE
     WHEN n.type='AVAILABILITY_REMINDER' THEN '/availability'
     WHEN n.type IN ('CHECKOUT_REMINDER','SHIFT_CAPPED','LEFT_OPEN','SHIFT_SOON','SHIFT_TODAY') THEN '/home'
     ELSE '' END)), '[]'::jsonb) INTO result
 FROM claimed q JOIN public.worker_notifications n ON n.id=q.notification_id
 JOIN public.worker_web_push_subscriptions w ON w.id=q.subscription_id JOIN public.stations st ON st.id=n.station_id;
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.cap_overdue_attendance(uuid),public.worker_notification_current(public.worker_notifications),
 public.claim_worker_notifications(),public.claim_worker_notifications_schedule(),public.claim_worker_web_push(),
 public.register_web_push_subscription(text,text,text,text),public.unregister_web_push_subscription(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.register_web_push_subscription(text,text,text,text),public.unregister_web_push_subscription(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_worker_notifications(),public.claim_worker_web_push(),public.cap_overdue_attendance(uuid) TO service_role;
COMMIT;
