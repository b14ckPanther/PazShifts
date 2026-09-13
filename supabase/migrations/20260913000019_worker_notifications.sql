BEGIN;
CREATE TABLE public.worker_devices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,
 installation_id uuid NOT NULL UNIQUE,
 installation_proof text NOT NULL,
 expo_push_token text NOT NULL UNIQUE CHECK (expo_push_token ~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$'),
 platform text NOT NULL CHECK (platform IN ('ios','android')),
 app_version text CHECK (length(app_version) <= 40),
 notifications_enabled boolean NOT NULL DEFAULT true,
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.worker_notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 schedule_published boolean NOT NULL DEFAULT true,
 reminder_minutes smallint NOT NULL DEFAULT 60 CHECK (reminder_minutes IN (0,30,60))
);
CREATE TABLE public.worker_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
 type text NOT NULL CHECK (type IN ('SCHEDULE_PUBLISHED','SHIFT_REMINDER')),
 title text NOT NULL,
 body text NOT NULL,
 data jsonb NOT NULL,
 dedupe_key text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 expires_at timestamptz NOT NULL
);
CREATE TABLE public.worker_notification_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 notification_id uuid NOT NULL REFERENCES public.worker_notifications(id) ON DELETE CASCADE,
 device_id uuid NOT NULL REFERENCES public.worker_devices(id) ON DELETE CASCADE,
 token_snapshot text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','ticket','delivered','failed','uncertain','cancelled')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 ticket_id text,
 error_code text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(notification_id,device_id)
);
-- Scheduled reminder scan is bounded by start_at; existing indexes lead with schedule/station.
CREATE INDEX scheduled_shifts_reminder_start ON public.scheduled_shifts(start_at);
CREATE INDEX worker_devices_user ON public.worker_devices(user_id);
CREATE INDEX worker_inbox_page ON public.worker_notifications(user_id,created_at DESC,id DESC);
CREATE INDEX worker_inbox_unread ON public.worker_notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX worker_delivery_pending ON public.worker_notification_deliveries(next_attempt_at) WHERE state='pending';
CREATE INDEX worker_delivery_receipts ON public.worker_notification_deliveries(next_attempt_at) WHERE state='ticket';
ALTER TABLE public.worker_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_notification_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.worker_devices,public.worker_notifications,public.worker_notification_preferences,public.worker_notification_deliveries FROM anon,authenticated;
GRANT SELECT(id,user_id,installation_id,platform,app_version,notifications_enabled,last_seen_at,created_at,updated_at),DELETE ON public.worker_devices TO authenticated;
GRANT SELECT ON public.worker_notifications TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.worker_notification_preferences TO authenticated;
GRANT ALL ON public.worker_devices,public.worker_notifications,public.worker_notification_preferences,public.worker_notification_deliveries TO service_role;
CREATE POLICY own_devices_read ON public.worker_devices FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY own_devices_delete ON public.worker_devices FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE POLICY own_preferences ON public.worker_notification_preferences FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY own_inbox ON public.worker_notifications FOR SELECT TO authenticated USING(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.station_memberships m WHERE m.user_id=auth.uid() AND m.station_id=worker_notifications.station_id AND m.status='ACTIVE') AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active) AND EXISTS(SELECT 1 FROM public.stations s WHERE s.id=worker_notifications.station_id AND s.is_active));
-- Device ownership changes require a per-installation proof, never merely a token or UUID.
CREATE FUNCTION public.register_worker_device(p_installation uuid,p_secret text,p_token text,p_platform text,p_version text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.worker_devices; v_session uuid; v_proof text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active) THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_installation IS NULL OR p_secret IS NULL OR length(p_secret) < 64 OR length(p_secret)>128 THEN RAISE EXCEPTION 'Invalid installation'; END IF;
 v_session := (auth.jwt()->>'session_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=v_session AND user_id=auth.uid() AND (not_after IS NULL OR not_after>now())) THEN RAISE EXCEPTION 'Session unavailable'; END IF;
 v_proof := encode(sha256(convert_to(p_secret,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_installation::text,19));
 SELECT * INTO v FROM public.worker_devices WHERE installation_id=p_installation FOR UPDATE;
 IF FOUND AND v.installation_proof<>v_proof THEN RAISE EXCEPTION 'Installation unavailable' USING ERRCODE='42501'; END IF;
 IF p_token IS NULL THEN DELETE FROM public.worker_devices WHERE installation_id=p_installation; RETURN NULL; END IF;
 -- Never redirect an existing token belonging to a different installation.
 INSERT INTO public.worker_devices(user_id,session_id,installation_id,installation_proof,expo_push_token,platform,app_version)
 VALUES(auth.uid(),v_session,p_installation,v_proof,p_token,p_platform,p_version)
 ON CONFLICT(installation_id) DO UPDATE SET created_at=CASE WHEN worker_devices.user_id<>excluded.user_id THEN now() ELSE worker_devices.created_at END,user_id=excluded.user_id,session_id=excluded.session_id,expo_push_token=excluded.expo_push_token,platform=excluded.platform,app_version=excluded.app_version,notifications_enabled=true,last_seen_at=now(),updated_at=now()
 RETURNING id INTO v.id;
 RETURN v.id;
END $$;
CREATE FUNCTION public.mark_worker_notifications_read(p_id uuid DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 UPDATE public.worker_notifications SET read_at=coalesce(read_at,now()) WHERE user_id=auth.uid() AND (p_id IS NULL OR id=p_id);
$$;
-- Queue only once per schedule/recipient, including after reopening/republishing.
CREATE FUNCTION public.queue_published_worker_notifications() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.status='PUBLISHED' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
 INSERT INTO public.worker_notifications(user_id,station_id,type,title,body,data,dedupe_key,expires_at)
 SELECT DISTINCT m.user_id,NEW.station_id,'SCHEDULE_PUBLISHED','סידור העבודה פורסם','סידור העבודה שלך מוכן לצפייה.',
 jsonb_build_object('stationName',st.name,'stationId',NEW.station_id,'scheduleId',NEW.id,'day',NEW.week_start_date),
 'schedule:'||NEW.id||':'||m.user_id, now()+interval '24 hours'
 FROM public.scheduled_shifts s JOIN public.shift_assignments a ON a.scheduled_shift_id=s.id
 JOIN public.station_memberships m ON m.id=a.station_membership_id
 JOIN public.profiles p ON p.id=m.user_id JOIN public.stations st ON st.id=NEW.station_id
 WHERE s.schedule_id=NEW.id AND a.status='ASSIGNED' AND m.status='ACTIVE' AND m.station_id=NEW.station_id AND p.is_active AND st.is_active
 ON CONFLICT(dedupe_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER queue_worker_publication AFTER INSERT OR UPDATE OF status ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.queue_published_worker_notifications();
-- Private eligibility check runs again immediately before a send is claimed.
CREATE FUNCTION public.worker_notification_current(n public.worker_notifications) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT n.expires_at>now() AND EXISTS(
 SELECT 1 FROM public.station_memberships m JOIN public.profiles p ON p.id=m.user_id
 JOIN public.stations st ON st.id=m.station_id JOIN public.shift_assignments a ON a.station_membership_id=m.id
 JOIN public.scheduled_shifts s ON s.id=a.scheduled_shift_id JOIN public.schedules w ON w.id=s.schedule_id
 LEFT JOIN public.worker_notification_preferences pref ON pref.user_id=m.user_id
 WHERE m.user_id=n.user_id AND m.station_id=n.station_id AND m.status='ACTIVE' AND p.is_active AND st.is_active AND a.status='ASSIGNED' AND w.status='PUBLISHED'
 AND w.id::text=n.data->>'scheduleId'
 AND CASE WHEN n.type='SCHEDULE_PUBLISHED' THEN coalesce(pref.schedule_published,true)
 ELSE s.id::text=n.data->>'shiftId' AND s.start_at=(n.data->>'startAt')::timestamptz AND s.start_at>now() AND coalesce(pref.reminder_minutes,60)>0 AND s.start_at<=now()+make_interval(mins=>coalesce(pref.reminder_minutes,60)) END);
$$;
CREATE FUNCTION public.claim_worker_notifications() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 -- Service-only RPC. Advisory lock prevents overlapping schedulers generating duplicate work.
 IF NOT pg_try_advisory_xact_lock(9131901) THEN RETURN '[]'::jsonb; END IF;
 INSERT INTO public.worker_notifications(user_id,station_id,type,title,body,data,dedupe_key,expires_at)
 SELECT m.user_id,m.station_id,'SHIFT_REMINDER','המשמרת שלך מתקרבת','אפשר לפתוח את פרטי המשמרת באפליקציה.',
 jsonb_build_object('stationName',st.name,'stationId',m.station_id,'scheduleId',w.id,'shiftId',s.id,'day',s.shift_date,'startAt',s.start_at),
 'shift:'||s.id||':'||extract(epoch FROM s.start_at)||':'||m.user_id,s.start_at
 FROM public.scheduled_shifts s JOIN public.schedules w ON w.id=s.schedule_id
 JOIN public.shift_assignments a ON a.scheduled_shift_id=s.id JOIN public.station_memberships m ON m.id=a.station_membership_id
 JOIN public.profiles p ON p.id=m.user_id JOIN public.stations st ON st.id=m.station_id
 LEFT JOIN public.worker_notification_preferences pref ON pref.user_id=m.user_id
 WHERE w.status='PUBLISHED' AND a.status='ASSIGNED' AND m.status='ACTIVE' AND p.is_active AND st.is_active
 AND coalesce(pref.reminder_minutes,60)>0 AND s.start_at>now() AND s.start_at<=now()+make_interval(mins=>coalesce(pref.reminder_minutes,60))
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
REVOKE ALL ON FUNCTION public.register_worker_device(uuid,text,text,text,text), public.mark_worker_notifications_read(uuid),public.queue_published_worker_notifications(),public.worker_notification_current(public.worker_notifications),public.claim_worker_notifications() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_worker_device(uuid,text,text,text,text),public.mark_worker_notifications_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_worker_notifications() TO service_role;
COMMIT;
