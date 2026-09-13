"""Sunday calendar migration tests. Disposable local PostgreSQL only.
Run: python3 tests/sunday-weeks-db.py (PostgreSQL binaries on PATH).
"""
from pathlib import Path
import subprocess
import tempfile
import uuid
import json
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
def command(*args):
    result = subprocess.run(args, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return result.stdout

with tempfile.TemporaryDirectory(prefix='ys-nfc-db-') as temporary:
    base = Path(temporary)
    command('initdb', '-D', str(base / 'data'), '-A', 'trust', '-U', 'postgres')
    command('pg_ctl', '-D', str(base / 'data'), '-l', str(base / 'postgres.log'),
            '-o', f"-k {base} -c listen_addresses=''", '-w', 'start')
    def sql(source, fails=False):
        result = subprocess.run(['psql', '-X', '-h', str(base), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], input=source, text=True, capture_output=True)
        assert (result.returncode != 0) if fails else (result.returncode == 0), result.stderr or source
        return result.stdout
    try:
        sql("""CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
        CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, phone text, raw_user_meta_data jsonb DEFAULT '{}');
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz);
        CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('session_id',coalesce(nullif(current_setting('request.jwt.claim.session_id',true),''),auth.uid()::text)) $$;
        GRANT USAGE ON SCHEMA auth TO authenticated, anon;""")
        migrations=sorted((ROOT / 'supabase/migrations').glob('*.sql'))
        for migration in migrations[:-1]: sql(migration.read_text())
        upgrade=migrations[-1].read_text()
        assert migrations[-1].name=='20260913000022_sunday_calendar_weeks.sql'
        sql("ALTER TABLE public.stations ALTER COLUMN latitude SET DEFAULT 32.858784, ALTER COLUMN longitude SET DEFAULT 35.090755;")
        sql("""
        INSERT INTO auth.users(id,email) VALUES ('00000000-0000-0000-0000-000000000001','sunday@example.com');
        INSERT INTO public.stations(id,code,name) VALUES ('00000000-0000-0000-0000-000000000101','SUNDAY','Test');
        INSERT INTO public.station_memberships(id,station_id,user_id,role) VALUES ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','WORKER');
        INSERT INTO public.schedules(id,station_id,week_start_date,status) VALUES
        ('00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000101','2026-09-07','PUBLISHED'),
        ('00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000101','2026-09-14','DRAFT');
        INSERT INTO public.scheduled_shifts(id,schedule_id,station_id,shift_date,start_at,end_at) VALUES
        ('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000101','2026-09-13','2026-09-13T22:00Z','2026-09-14T06:00Z'),
        ('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000101','2026-09-14','2026-09-14T06:00Z','2026-09-14T14:00Z');
        INSERT INTO public.shift_assignments(scheduled_shift_id,station_id,station_membership_id) SELECT id,station_id,'00000000-0000-0000-0000-000000000201' FROM public.scheduled_shifts;
        INSERT INTO public.availability_weeks(id,station_id,station_membership_id,week_start_date,notes) VALUES
        ('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000201','2026-09-07','First note'),
        ('00000000-0000-0000-0000-000000000502','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000201','2026-09-14','Second note');
        INSERT INTO public.availability_entries(availability_week_id,date,availability_type,start_time,end_time,notes)
        SELECT w.id,w.week_start_date+i,'TIME_WINDOW','22:00','06:00','keep day note' FROM public.availability_weeks w CROSS JOIN generate_series(0,6) i;
        """)
        def snapshot():
            return sql("SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.schedules s;")+sql("SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.availability_entries e;")
        before=snapshot()
        sql(upgrade, fails=True)
        assert snapshot()==before
        print('PASS: mixed publication statuses abort and roll back the whole migration')
        # Explicit fixture-only publication decision; production migration never does this.
        sql("UPDATE public.schedules SET status='PUBLISHED';")
        notifications=sql('SELECT count(*) FROM public.worker_notifications;')
        shifts=sql("SELECT jsonb_agg(jsonb_build_array(id,shift_date,start_at,end_at) ORDER BY id) FROM public.scheduled_shifts;")
        entries=sql("SELECT jsonb_agg(jsonb_build_array(id,date,availability_type,start_time,end_time,notes) ORDER BY id) FROM public.availability_entries;")
        assignments=sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.shift_assignments a;')
        sql(upgrade)
        assert shifts==sql("SELECT jsonb_agg(jsonb_build_array(id,shift_date,start_at,end_at) ORDER BY id) FROM public.scheduled_shifts;")
        assert entries==sql("SELECT jsonb_agg(jsonb_build_array(id,date,availability_type,start_time,end_time,notes) ORDER BY id) FROM public.availability_entries;")
        assert assignments==sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.shift_assignments a;')
        assert notifications==sql('SELECT count(*) FROM public.worker_notifications;')
        assert sql("SELECT count(*) FROM public.scheduled_shifts sh JOIN public.schedules s ON s.id=sh.schedule_id WHERE s.week_start_date='2026-09-13';").strip()=='2'
        assert sql("SELECT string_agg(n::text,',' ORDER BY week_start_date) FROM (SELECT w.week_start_date,count(e.id) n FROM public.availability_weeks w JOIN public.availability_entries e ON e.availability_week_id=w.id GROUP BY w.week_start_date) x;").strip()=='6,7,1'
        assert 'First note' in sql("SELECT notes FROM public.availability_weeks WHERE week_start_date='2026-09-13';")
        assert 'Second note' in sql("SELECT notes FROM public.availability_weeks WHERE week_start_date='2026-09-13';")
        sql("INSERT INTO public.schedules(station_id,week_start_date) VALUES ('00000000-0000-0000-0000-000000000101','2026-09-21');",fails=True)
        sql("INSERT INTO public.schedules(station_id,week_start_date) VALUES ('00000000-0000-0000-0000-000000000101','2026-09-27');")
        print('PASS: Sunday reassignment, overnight timestamps, assignments, per-day availability, source notes and no notification fanout')
        print('PASS: Sunday constraints accept Sunday and reject Monday')
    finally:
        command('pg_ctl','-D',str(base/'data'),'-m','immediate','-w','stop')
