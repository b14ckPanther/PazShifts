"""Isolated PostgreSQL query-plan benchmark using repository migrations and synthetic data.
No network listener, environment credentials, Supabase connection, or production writes.
"""
from pathlib import Path
import subprocess
import tempfile
import json
ROOT = Path(__file__).resolve().parents[2]
def command(*args, **kwargs):
    return subprocess.run(args, text=True, capture_output=True, check=True, **kwargs).stdout
with tempfile.TemporaryDirectory(prefix='ys-perf-db-') as temporary:
    base = Path(temporary)
    command('initdb','-D',str(base/'data'),'-A','trust','-U','postgres')
    command('pg_ctl','-D',str(base/'data'),'-l',str(base/'log'),'-o',f"-k {base} -c listen_addresses=''",'-w','start')
    def sql(source):
        return command('psql','-X','-q','-h',str(base),'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At',input=source)
    try:
        sql("""CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
        CREATE SCHEMA auth;
        CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,phone text,raw_user_meta_data jsonb DEFAULT '{}');
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        GRANT USAGE ON SCHEMA auth TO authenticated,anon;""")
        for migration in sorted((ROOT/'supabase/migrations').glob('*.sql')): sql(migration.read_text())
        sql("""
        INSERT INTO auth.users(id,email) SELECT md5(i::text)::uuid,'fixture'||i||'@example.test' FROM generate_series(1,31) i;
        INSERT INTO stations(id,code,name) VALUES(md5('station')::uuid,'PERF','Synthetic');
        INSERT INTO station_memberships(station_id,user_id,role)
          SELECT md5('station')::uuid,md5(i::text)::uuid,CASE WHEN i=1 THEN 'ADMIN'::station_role ELSE 'WORKER'::station_role END FROM generate_series(1,31) i;
        INSERT INTO schedules(station_id,week_start_date,status)
          SELECT md5('station')::uuid,'2025-09-01'::date+i*7,'PUBLISHED' FROM generate_series(0,51) i;
        INSERT INTO scheduled_shifts(schedule_id,station_id,shift_date,start_at,end_at)
          SELECT id,station_id,week_start_date+d,week_start_date+d+time '08:00',week_start_date+d+time '16:00' FROM schedules CROSS JOIN generate_series(0,6) d;
        INSERT INTO shift_assignments(scheduled_shift_id,station_id,station_membership_id)
          SELECT s.id,s.station_id,m.id FROM scheduled_shifts s JOIN station_memberships m ON m.station_id=s.station_id WHERE m.role='WORKER';
        ANALYZE;
        """)
        # Equivalent relational filtering, with authenticated station-admin RLS enabled.
        base_query="""SELECT a.id,a.station_membership_id,s.shift_date,w.status,m.status
          FROM shift_assignments a JOIN scheduled_shifts s ON s.id=a.scheduled_shift_id
          JOIN schedules w ON w.id=s.schedule_id JOIN station_memberships m ON m.id=a.station_membership_id
          WHERE a.station_id=md5('station')::uuid"""
        queries={'before':base_query,'after':base_query+" AND s.shift_date='2026-08-24' AND w.status='PUBLISHED' AND m.status='ACTIVE'"}
        for name,query in queries.items():
            times=[]; last=None
            for i in range(21):
                raw=sql("BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='"+sql("SELECT md5('1')::uuid").strip()+"'; EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) "+query+"; ROLLBACK;")
                plan=json.loads(raw)[0]; last=plan
                if i: times.append(plan['Execution Time'])
            times.sort()
            print(json.dumps({'variant':name,'samples':20,'concurrency':1,'assignments':10920,'rows':last['Plan']['Actual Rows'],'p50Ms':times[9],'p95Ms':times[18],'sharedHitBlocks':last['Plan']['Shared Hit Blocks']}))
            (base/f'{name}.json').write_text(json.dumps(last))
            # Print plan node/index names only, no row contents or identifiers.
            def nodes(p):
                return [p.get('Index Name',p['Node Type'])]+[n for child in p.get('Plans',[]) for n in nodes(child)]
            print(json.dumps({'variant':name,'plan':nodes(last['Plan'])}))
    finally:
        command('pg_ctl','-D',str(base/'data'),'-m','immediate','-w','stop')
