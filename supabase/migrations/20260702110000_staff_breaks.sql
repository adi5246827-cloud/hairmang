-- =====================================================================
-- Per-stylist recurring breaks (e.g. lunch). day_of_week NULL = every day.
-- The booking engine avoids these windows; the calendar renders them.
-- =====================================================================
create table if not exists staff_breaks (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references staff(id) on delete cascade,
  day_of_week  int check (day_of_week between 0 and 6),  -- NULL = every working day
  start_time   time not null,
  end_time     time not null,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table staff_breaks enable row level security;
alter table staff_breaks force row level security;
drop policy if exists "authenticated full access" on staff_breaks;
create policy "authenticated full access" on staff_breaks
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_set_updated_at on staff_breaks;
create trigger trg_set_updated_at before update on staff_breaks
  for each row execute function set_updated_at();

-- Seed one default daily lunch break per active stylist (only if table empty).
insert into staff_breaks (staff_id, day_of_week, start_time, end_time, note)
select s.id, null, '14:00'::time, '14:30'::time, 'הפסקת צהריים'
from staff s
where s.is_active
  and not exists (select 1 from staff_breaks);
