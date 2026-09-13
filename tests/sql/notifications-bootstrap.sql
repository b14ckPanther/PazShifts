-- Disposable local database only. Run availability-bootstrap.sql first.
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id),not_after timestamptz);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('session_id',current_setting('request.jwt.claim.session_id',true)) $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF; END $$;
GRANT USAGE ON SCHEMA public,auth TO service_role;
