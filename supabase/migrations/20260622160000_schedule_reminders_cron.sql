-- =====================================================================
-- Schedule the WhatsApp reminder dispatch to run automatically every hour
-- via pg_cron + pg_net. The cron job calls the JWT-protected send-reminders
-- Edge Function; it authenticates with the PUBLIC anon key (a valid JWT —
-- already shipped in the browser, so not a secret). send-reminders is
-- idempotent (reminder_sent_at guard), so an extra run never double-sends.
--
-- The function itself runs in simulation mode until the WhatsApp secrets
-- are set, so this is safe to enable now.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- replace any previous definition of this job (idempotent re-runs)
do $$
begin
  perform cron.unschedule('salonos-hourly-reminders');
exception when others then
  null; -- job didn't exist yet
end $$;

select cron.schedule(
  'salonos-hourly-reminders',
  '0 * * * *',                       -- top of every hour
  $cmd$
  select net.http_post(
    url := 'https://hdzmqoslaghgvydykixf.supabase.co/functions/v1/send-reminders?hours=24',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhkem1xb3NsYWdoZ3Z5ZHlraXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMzQ1NjgsImV4cCI6MjA5NzYxMDU2OH0.iPhY80HryCmboCpE9o8gVuwA4JZgt7IFPwws68IIdec'
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

-- confirm registration in the push output
do $$
declare n int;
begin
  select count(*) into n from cron.job where jobname = 'salonos-hourly-reminders';
  raise notice 'salonos reminder cron jobs registered: %', n;
end $$;
