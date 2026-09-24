BEGIN;
CREATE TABLE public.station_interest_leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,
 full_name text NOT NULL CHECK (length(full_name) BETWEEN 2 AND 80),
 phone text NOT NULL CHECK (phone ~ '^05[0-9]{8}$'),
 email text CHECK (length(email) <= 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 station_name_or_number text NOT NULL CHECK (length(station_name_or_number) BETWEEN 2 AND 120),
 city text NOT NULL CHECK (length(city) BETWEEN 2 AND 80),
 role text CHECK (role IN ('owner','manager','operations','other')),
 notes text CHECK (length(notes) <= 1000),
 source text NOT NULL DEFAULT 'mobile_login_acquisition' CHECK (source='mobile_login_acquisition'),
 platform text NOT NULL CHECK (platform IN ('ios','android')),
 app_version text CHECK (length(app_version) <= 40),
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','converted','closed')),
 email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sent','failed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX station_interest_phone_created ON public.station_interest_leads(phone,created_at DESC);
CREATE TABLE public.station_interest_rate_limits (
 ip_hash text NOT NULL CHECK (ip_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX station_interest_rate_created ON public.station_interest_rate_limits(created_at);
CREATE INDEX station_interest_rate_ip ON public.station_interest_rate_limits(ip_hash,created_at);
ALTER TABLE public.station_interest_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_interest_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.station_interest_leads, public.station_interest_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT,UPDATE ON public.station_interest_leads TO service_role;

-- Only the validated server route can execute this atomic intake. No anon INSERT policy.
CREATE FUNCTION public.submit_station_interest(p_request_id uuid,p_ip_hash text,p_lead jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing_id uuid; new_id uuid;
BEGIN
 IF p_request_id IS NULL OR p_ip_hash IS NULL OR p_ip_hash !~ '^[a-f0-9]{64}$' OR p_lead IS NULL THEN
  RAISE EXCEPTION 'Invalid intake request';
 END IF;
 -- Serializes the small public intake, including per-IP/phone limits and duplicates.
 PERFORM pg_advisory_xact_lock(9131924);
 DELETE FROM public.station_interest_rate_limits WHERE created_at < now()-interval '24 hours';
 IF (SELECT count(*) FROM public.station_interest_rate_limits WHERE ip_hash=p_ip_hash AND created_at>now()-interval '1 hour') >= 5
 OR (SELECT count(*) FROM public.station_interest_rate_limits WHERE created_at>now()-interval '1 hour') >= 100 THEN
  RETURN jsonb_build_object('result','limited');
 END IF;
 INSERT INTO public.station_interest_rate_limits(ip_hash) VALUES(p_ip_hash);
 SELECT id INTO existing_id FROM public.station_interest_leads
 WHERE request_id=p_request_id OR (phone=p_lead->>'phone'
  AND lower(station_name_or_number)=lower(p_lead->>'station_name_or_number')
  AND created_at>now()-interval '24 hours') LIMIT 1;
 IF existing_id IS NOT NULL THEN RETURN jsonb_build_object('result','duplicate'); END IF;
 IF (SELECT count(*) FROM public.station_interest_leads WHERE phone=p_lead->>'phone' AND created_at>now()-interval '24 hours') >= 3 THEN
  RETURN jsonb_build_object('result','limited');
 END IF;
 INSERT INTO public.station_interest_leads(request_id,full_name,phone,email,station_name_or_number,city,role,notes,platform,app_version)
 VALUES(p_request_id,p_lead->>'full_name',p_lead->>'phone',nullif(p_lead->>'email',''),p_lead->>'station_name_or_number',p_lead->>'city',nullif(p_lead->>'role',''),nullif(p_lead->>'notes',''),p_lead->>'platform',nullif(p_lead->>'app_version','')) RETURNING id INTO new_id;
 RETURN jsonb_build_object('result','created','id',new_id);
END $$;
REVOKE ALL ON FUNCTION public.submit_station_interest(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_station_interest(uuid,text,jsonb) TO service_role;
COMMIT;
