-- =====================================================================
-- Configurable opening / closing hours per weekday (per branch).
-- Replaces the hardcoded HOURS map in book-appointment. Editable from the
-- manager dashboard (שעות פעילות). day_of_week: 0=Sun … 6=Sat.
-- =====================================================================
create table if not exists business_hours (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) on delete cascade,
  day_of_week   int  not null check (day_of_week between 0 and 6),
  open_time     time not null default '09:00',
  close_time    time not null default '20:00',
  is_closed     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (branch_id, day_of_week)
);

-- RLS: same policy shape as the rest of the schema (authenticated = full access)
alter table business_hours enable row level security;
alter table business_hours force row level security;
drop policy if exists "authenticated full access" on business_hours;
create policy "authenticated full access" on business_hours
  for all to authenticated using (true) with check (true);

-- updated_at maintenance (global loop only covered tables existing at the time)
drop trigger if exists trg_set_updated_at on business_hours;
create trigger trg_set_updated_at before update on business_hours
  for each row execute function set_updated_at();

-- Seed the weekly schedule for the (single) branch.
insert into business_hours (branch_id, day_of_week, open_time, close_time, is_closed)
select b.id, v.dow, v.o::time, v.c::time, v.closed
from (select id from branches order by created_at limit 1) b
cross join (values
  (0, '10:00', '21:00', false),  -- Sunday
  (1, '00:00', '00:00', true ),  -- Monday   — closed
  (2, '09:00', '15:00', false),  -- Tuesday
  (3, '10:00', '21:00', false),  -- Wednesday
  (4, '10:00', '21:00', false),  -- Thursday
  (5, '09:00', '15:00', false),  -- Friday
  (6, '00:00', '00:00', true )   -- Saturday — closed
) as v(dow, o, c, closed)
on conflict (branch_id, day_of_week) do nothing;
