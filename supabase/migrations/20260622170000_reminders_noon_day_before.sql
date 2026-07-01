-- =====================================================================
-- Change the reminder schedule to: noon (12:00 Asia/Jerusalem) on the day
-- BEFORE each appointment. The function (no ?hours param) targets all of
-- tomorrow's appointments.
--
-- pg_cron runs in UTC. Noon Israel = 09:00 UTC (summer, IDT) or 10:00 UTC
-- (winter, IST), so we fire at both 09:00 and 10:00 UTC and gate the actual
-- POST on the local hour being exactly 12 — so it runs once, at Israeli noon,
-- correctly across daylight-saving changes.
-- =====================================================================
do $$
begin
  perform cron.unschedule('salonos-hourly-reminders');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('salonos-noon-reminders');
exception when others then null;
end $$;

select cron.schedule(
  'salonos-noon-reminders',
  '0 9,10 * * *',                    -- 09:00 and 10:00 UTC; gated to Israeli noon below
  $cmd$
  do $inner$
  begin
    if extract(hour from (now() at time zone 'Asia/Jerusalem'))::int = 12 then
      perform net.http_post(
        url := 'https://hdzmqoslaghgvydykixf.supabase.co/functions/v1/send-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhkem1xb3NsYWdoZ3Z5ZHlraXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMzQ1NjgsImV4cCI6MjA5NzYxMDU2OH0.iPhY80HryCmboCpE9o8gVuwA4JZgt7IFPwws68IIdec'
        ),
        body := '{}'::jsonb
      );
    end if;
  end $inner$;
  $cmd$
);

do $$
declare n int;
begin
  select count(*) into n from cron.job where jobname = 'salonos-noon-reminders';
  raise notice 'noon reminder cron registered: %', n;
end $$;
