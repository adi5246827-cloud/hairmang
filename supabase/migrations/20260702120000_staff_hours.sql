-- =====================================================================
-- Per-stylist working hours (each ספר its own schedule per weekday) +
-- stagger the default lunch breaks so the salon keeps coverage.
-- =====================================================================

-- 1) Stagger the seeded daily breaks across the first stylists.
with ranked as (
  select id, row_number() over (order by created_at) as rn
  from staff where is_active
)
update staff_breaks sb
set start_time = (array['13:00','13:30','14:30']::time[])[r.rn],
    end_time   = (array['13:30','14:00','15:00']::time[])[r.rn]
from ranked r
where sb.staff_id = r.id and sb.day_of_week is null and r.rn <= 3;

-- 2) Per-stylist working hours.
create table if not exists staff_hours (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references staff(id) on delete cascade,
  day_of_week  int  not null check (day_of_week between 0 and 6),
  start_time   time not null default '09:00',
  end_time     time not null default '20:00',
  is_off       boolean not null default false,   -- stylist does not work this day
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (staff_id, day_of_week)
);

alter table staff_hours enable row level security;
alter table staff_hours force row level security;
drop policy if exists "authenticated full access" on staff_hours;
create policy "authenticated full access" on staff_hours
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_set_updated_at on staff_hours;
create trigger trg_set_updated_at before update on staff_hours
  for each row execute function set_updated_at();

-- Seed each active stylist's week mirroring the salon hours (fully editable after).
insert into staff_hours (staff_id, day_of_week, start_time, end_time, is_off)
select s.id, bh.day_of_week, bh.open_time, bh.close_time, bh.is_closed
from staff s
cross join business_hours bh
where s.is_active
  and bh.branch_id = (select id from branches order by created_at limit 1)
  and not exists (select 1 from staff_hours)
on conflict (staff_id, day_of_week) do nothing;
