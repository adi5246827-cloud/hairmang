-- =====================================================================
-- SalonOS AI – Seed / reference data
-- Configuration rows the system needs to operate (idempotent inserts).
-- No fake clients/appointments — only catalog & config.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 18. Default branch
-- ---------------------------------------------------------------------
insert into branches (name, address, phone, timezone)
select 'מספרה ראשית', '', '', 'Asia/Jerusalem'
where not exists (select 1 from branches);

-- ---------------------------------------------------------------------
-- 18. Roles & permissions
-- ---------------------------------------------------------------------
insert into roles (name, permissions) values
  ('owner',        '{"all": true}'),
  ('manager',      '{"dashboard": true, "staff": true, "inventory": true, "reports": true, "marketing": true}'),
  ('stylist',      '{"appointments": true, "clients": true, "hair_history": true}'),
  ('receptionist', '{"appointments": true, "clients": true, "payments": true}')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- 9. VIP loyalty tiers
-- ---------------------------------------------------------------------
insert into loyalty_tiers (name, min_points, benefits) values
  ('silver',   0,    '{"perks": ["הטבות בסיסיות", "תזכורות אישיות", "מבצעי יום הולדת"]}'),
  ('gold',     500,  '{"perks": ["קדימות בתורים", "הנחות על מוצרים", "הטבות חודשיות"]}'),
  ('platinum', 1500, '{"perks": ["שירות VIP", "תורים מועדפים", "טיפולים בלעדיים", "הצעות אישיות"]}')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- 10. Monthly subscription plans
-- ---------------------------------------------------------------------
insert into subscription_plans (name, price_monthly, benefits)
select v.name, v.price, v.benefits::jsonb
from (values
  ('Silver Plan',   99,  '{"perks": ["פן אחד בחודש", "הנחה על מוצרים"]}'),
  ('Gold Plan',     199, '{"perks": ["שני פאנים בחודש", "טיפול מסכה אחד", "10% הנחה על מוצרים"]}'),
  ('Platinum Plan', 349, '{"perks": ["טיפולי פרימיום", "קדימות בתורים", "הנחות מיוחדות", "שירות אישי"]}')
) as v(name, price, benefits)
where not exists (select 1 from subscription_plans sp where sp.name = v.name);

-- ---------------------------------------------------------------------
-- Service categories
-- ---------------------------------------------------------------------
insert into service_categories (name)
select v.name
from (values ('תספורת'), ('צבע'), ('החלקה'), ('פן'), ('טיפולי שיער'), ('גברים'), ('תוספות שיער')) as v(name)
where not exists (select 1 from service_categories sc where sc.name = v.name);

-- ---------------------------------------------------------------------
-- Services (catalog). Premium treatments require a deposit (spec §3).
-- material_cost feeds the real-profitability engine (spec §12).
-- ---------------------------------------------------------------------
insert into services (category_id, name, duration_minutes, base_price, material_cost, requires_deposit, deposit_amount)
select sc.id, v.name, v.dur, v.price, v.material, v.dep, v.dep_amt
from (values
  ('תספורת',     'תספורת נשים',        45,  120,  10, false, 0),
  ('תספורת',     'תספורת גברים',       30,  80,   8,  false, 0),
  ('פן',         'פן',                 40,  90,   12, false, 0),
  ('צבע',        'צבע שורשים',         90,  280,  60, false, 0),
  ('צבע',        'צבע מלא',            150, 600,  140, true,  150),
  ('צבע',        'צבע מורכב / בליאז''', 240, 950,  260, true,  250),
  ('החלקה',      'החלקה',              180, 800,  220, true,  200),
  ('טיפולי שיער','מסכה משקמת',         30,  150,  35, false, 0),
  ('תוספות שיער','תוספות שיער',        240, 1800, 700, true,  400),
  ('גברים',      'עיצוב זקן',          20,  60,   6,  false, 0)
) as v(cat, name, dur, price, material, dep, dep_amt)
join service_categories sc on sc.name = v.cat
where not exists (select 1 from services s where s.name = v.name);

-- ---------------------------------------------------------------------
-- 7. Sample dynamic-pricing rules for the default branch
-- ---------------------------------------------------------------------
insert into pricing_rules (branch_id, name, day_of_week, start_time, end_time, adjustment_type, adjustment_value, is_active)
select b.id, v.name, v.dow, v.st::time, v.et::time, v.atype, v.aval, true
from (values
  ('הנחת שעות חלשות (אמצע שבוע בוקר)', 2, '09:00', '12:00', 'percent', -15),
  ('פרימיום שעות עומס (סוף שבוע)',     5, '16:00', '20:00', 'percent', 10)
) as v(name, dow, st, et, atype, aval)
cross join (select id from branches order by created_at limit 1) b
where not exists (select 1 from pricing_rules pr where pr.name = v.name);
