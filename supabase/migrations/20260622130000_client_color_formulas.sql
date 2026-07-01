-- =====================================================================
-- Dedicated color-formula storage for the client card.
-- A formula has header fields (developer/oxygen, ratio, timing, technique)
-- plus one-or-more color components (brand, shade code, amount) so several
-- colors can be combined in a single mix.
-- =====================================================================
create table if not exists client_formulas (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete cascade,
  staff_id          uuid references staff(id) on delete set null,
  appointment_id    uuid references appointments(id) on delete set null,
  title             text,                       -- e.g. "צבע שורשים", "גוון נוכחי"
  developer_volume  numeric(5,1),               -- חמצן: vol (10/20/30/40)
  developer_amount  numeric(8,2),               -- כמות חמצן
  developer_unit    text default 'ml',
  mixing_ratio      text,                       -- יחס ערבוב, e.g. "1:1.5"
  processing_minutes int,                       -- זמן החדרה / השהיה
  technique         text,                       -- טכניקה: מריחה מלאה / פוילים / בליאז'
  application_areas text,                        -- אזורי מריחה: שורשים / אורכים / קצוות
  result_notes      text,                        -- תוצאה / הערות מקצועיות
  performed_on      date default current_date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists client_formula_components (
  id                uuid primary key default gen_random_uuid(),
  formula_id        uuid not null references client_formulas(id) on delete cascade,
  brand             text,            -- שם החברה המייצרת (L'Oréal, Wella...)
  shade_code        text,            -- מספר הצבע (7.1, 9.3...)
  shade_name        text,            -- שם הגוון (אופציונלי)
  amount            numeric(8,2),    -- כמות הצבע
  unit              text default 'g',
  sort_order        int not null default 0
);

create index if not exists idx_client_formulas_client on client_formulas(client_id);
create index if not exists idx_formula_components_formula on client_formula_components(formula_id);

-- keep updated_at fresh (function defined in the functions/triggers migration)
drop trigger if exists trg_set_updated_at on public.client_formulas;
create trigger trg_set_updated_at before update on public.client_formulas
  for each row execute function set_updated_at();

-- RLS: same convention as every other table (authenticated full access)
do $$
declare t text;
begin
  foreach t in array array['client_formulas','client_formula_components'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_all', t);
    execute format(
      'create policy %I on public.%I as permissive for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t);
  end loop;
end $$;

-- demo formula for an existing demo client (idempotent)
do $$
declare
  v_client uuid;
  v_staff uuid;
  v_formula uuid;
begin
  select id into v_client from clients where full_name = 'מאיה לוי' order by created_at limit 1;
  if v_client is null then return; end if;
  if exists (select 1 from client_formulas where client_id = v_client) then return; end if;
  select id into v_staff from staff order by created_at limit 1;

  insert into client_formulas
    (client_id, staff_id, title, developer_volume, developer_amount, developer_unit,
     mixing_ratio, processing_minutes, technique, application_areas, result_notes, performed_on)
  values
    (v_client, v_staff, 'צבע שורשים — בלונד קר', 20, 90, 'ml',
     '1:1.5', 35, 'מריחה מלאה', 'שורשים + אורכים', 'כיסוי מלא, גוון אחיד', current_date - 9)
  returning id into v_formula;

  insert into client_formula_components (formula_id, brand, shade_code, shade_name, amount, unit, sort_order) values
    (v_formula, 'L''Oréal', '7.1', 'בלונד אפרפר',       40, 'g', 0),
    (v_formula, 'L''Oréal', '9.1', 'בלונד בהיר אפרפר', 20, 'g', 1);
end $$;
