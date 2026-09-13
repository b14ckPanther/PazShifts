BEGIN;
-- Legacy schedule writers store station wall-clock components in UTC-labelled values.
-- Attendance timestamps are real instants and must never use this conversion.
-- Match the mobile adapter: earlier repeated hour; skip nonexistent local times.
CREATE FUNCTION public.scheduled_notification_instant(stored timestamptz, zone text)
RETURNS timestamptz LANGUAGE sql STABLE STRICT SET search_path=public,pg_temp AS $$
 WITH probes AS (
  SELECT stored + delta AS probe FROM (VALUES (interval '-24 hours'),(interval '0 hours'),(interval '24 hours')) v(delta)
 ), candidates AS (
  SELECT stored - ((probe AT TIME ZONE zone) - (probe AT TIME ZONE 'UTC')) AS instant FROM probes
 )
 SELECT min(instant) FROM candidates
 WHERE instant AT TIME ZONE zone = stored AT TIME ZONE 'UTC';
$$;
REVOKE ALL ON FUNCTION public.scheduled_notification_instant(timestamptz,text) FROM PUBLIC,anon,authenticated,service_role;

-- Replace only the schedule functions wrapped by migration 21. Preserve LEFT_OPEN,
-- advisory locking, device/session checks, retry limits and delivery deduplication.
-- Keep stored startAt/dedupe values unchanged so pending events remain identifiable.
CREATE OR REPLACE FUNCTION public.worker_notification_current_schedule(n public.worker_notifications) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT (n.type='SHIFT_REMINDER' OR n.expires_at>now()) AND EXISTS(
 SELECT 1 FROM public.station_memberships m JOIN public.profiles p ON p.id=m.user_id
 JOIN public.stations st ON st.id=m.station_id JOIN public.shift_assignments a ON a.station_membership_id=m.id
 JOIN public.scheduled_shifts s ON s.id=a.scheduled_shift_id JOIN public.schedules w ON w.id=s.schedule_id
 LEFT JOIN public.worker_notification_preferences pref ON pref.user_id=m.user_id
 WHERE m.user_id=n.user_id AND m.station_id=n.station_id AND m.status='ACTIVE' AND p.is_active AND st.is_active AND a.status='ASSIGNED' AND w.status='PUBLISHED'
 AND w.id::text=n.data->>'scheduleId'
 AND CASE WHEN n.type='SCHEDULE_PUBLISHED' THEN coalesce(pref.schedule_published,true)
 ELSE s.id::text=n.data->>'shiftId' AND s.start_at=(n.data->>'startAt')::timestamptz AND public.scheduled_notification_instant(s.start_at,st.timezone)>now() AND coalesce(pref.reminder_minutes,60)>0 AND public.scheduled_notification_instant(s.start_at,st.timezone)<=now()+make_interval(mins=>coalesce(pref.reminder_minutes,60)) END);
$$;
CREATE OR REPLACE FUNCTION public.claim_worker_notifications_schedule() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 -- Service-only RPC. Advisory lock prevents overlapping schedulers generating duplicate work.
 IF NOT pg_try_advisory_xact_lock(9131901) THEN RETURN '[]'::jsonb; END IF;
 INSERT INTO public.worker_notifications(user_id,station_id,type,title,body,data,dedupe_key,expires_at)
 SELECT m.user_id,m.station_id,'SHIFT_REMINDER','המשמרת שלך מתקרבת','אפשר לפתוח את פרטי המשמרת באפליקציה.',
 jsonb_build_object('stationName',st.name,'stationId',m.station_id,'scheduleId',w.id,'shiftId',s.id,'day',s.shift_date,'startAt',s.start_at),
 'shift:'||s.id||':'||extract(epoch FROM s.start_at)||':'||m.user_id,public.scheduled_notification_instant(s.start_at,st.timezone)
 FROM public.scheduled_shifts s JOIN public.schedules w ON w.id=s.schedule_id
 JOIN public.shift_assignments a ON a.scheduled_shift_id=s.id JOIN public.station_memberships m ON m.id=a.station_membership_id
 JOIN public.profiles p ON p.id=m.user_id JOIN public.stations st ON st.id=m.station_id
 LEFT JOIN public.worker_notification_preferences pref ON pref.user_id=m.user_id
 WHERE w.status='PUBLISHED' AND a.status='ASSIGNED' AND m.status='ACTIVE' AND p.is_active AND st.is_active
 AND coalesce(pref.reminder_minutes,60)>0 AND public.scheduled_notification_instant(s.start_at,st.timezone)>now() AND public.scheduled_notification_instant(s.start_at,st.timezone)<=now()+make_interval(mins=>coalesce(pref.reminder_minutes,60))
 ON CONFLICT(dedupe_key) DO NOTHING;
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
REVOKE ALL ON FUNCTION public.worker_notification_current_schedule(public.worker_notifications),public.claim_worker_notifications_schedule() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
