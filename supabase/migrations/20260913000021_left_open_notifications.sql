BEGIN;
ALTER TABLE public.worker_notifications DROP CONSTRAINT worker_notifications_type_check;
ALTER TABLE public.worker_notifications ADD CONSTRAINT worker_notifications_type_check CHECK(type IN ('SCHEDULE_PUBLISHED','SHIFT_REMINDER','LEFT_OPEN'));
-- Preserve the existing schedule eligibility/delivery engine, adding one attendance category.
ALTER FUNCTION public.worker_notification_current(public.worker_notifications) RENAME TO worker_notification_current_schedule;
CREATE FUNCTION public.worker_notification_current(n public.worker_notifications) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN n.type='LEFT_OPEN' THEN n.expires_at>now() AND EXISTS(
 SELECT 1 FROM public.attendance_records r JOIN public.station_memberships m ON m.id=r.station_membership_id
 JOIN public.stations s ON s.id=r.station_id JOIN public.profiles p ON p.id=r.user_id
 LEFT JOIN public.worker_notification_preferences pref ON pref.user_id=r.user_id
 WHERE r.id::text=n.data->>'attendanceId' AND r.user_id=n.user_id AND r.station_id=n.station_id
 AND r.status='ACTIVE' AND m.status='ACTIVE' AND m.user_id=r.user_id AND s.is_active AND p.is_active
 AND r.clock_in_at<=now()-make_interval(hours=>s.left_open_warning_hours) AND coalesce(pref.reminder_minutes,60)>0
 ) ELSE public.worker_notification_current_schedule(n) END;
$$;
ALTER FUNCTION public.claim_worker_notifications() RENAME TO claim_worker_notifications_schedule;
CREATE FUNCTION public.claim_worker_notifications() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT pg_try_advisory_xact_lock(9131901) THEN RETURN '[]'::jsonb; END IF;
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
 RETURN public.claim_worker_notifications_schedule();
END $$;
REVOKE ALL ON FUNCTION public.worker_notification_current(public.worker_notifications),public.worker_notification_current_schedule(public.worker_notifications),public.claim_worker_notifications(),public.claim_worker_notifications_schedule() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.claim_worker_notifications() TO service_role;
COMMIT;
