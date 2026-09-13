-- Read only. Rows here need an explicit publication decision before migration.
WITH sources AS (
 SELECT id,station_id,week_start_date-1 target_week,status FROM public.schedules
 UNION
 SELECT s.id,s.station_id,sh.shift_date-extract(dow FROM sh.shift_date)::int,s.status
 FROM public.schedules s JOIN public.scheduled_shifts sh ON sh.schedule_id=s.id
)
SELECT station_id,target_week,array_agg(DISTINCT status) statuses,array_agg(DISTINCT id) schedule_ids
FROM sources GROUP BY station_id,target_week HAVING count(DISTINCT status)>1;
SELECT sh.id,sh.shift_date,s.week_start_date FROM public.scheduled_shifts sh
JOIN public.schedules s ON s.id=sh.schedule_id
WHERE sh.shift_date<s.week_start_date OR sh.shift_date>s.week_start_date+6;
SELECT e.id,e.date,w.week_start_date FROM public.availability_entries e
JOIN public.availability_weeks w ON w.id=e.availability_week_id
WHERE e.date<w.week_start_date OR e.date>w.week_start_date+6;
