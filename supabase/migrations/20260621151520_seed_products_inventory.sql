-- =====================================================================
-- SalonOS AI – Seed products & inventory (§8, §11)
-- A starter supplier, retail + professional products, and stock rows
-- for the default branch. Idempotent (sku unique / where-not-exists).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Supplier
-- ---------------------------------------------------------------------
insert into suppliers (name, contact_name, phone, email)
select 'ספק ראשי', 'מחלקת הזמנות', '', ''
where not exists (select 1 from suppliers);

-- ---------------------------------------------------------------------
-- Products
--   is_retail = sellable to clients (drives §8 sales opportunities)
--   non-retail = professional consumables tracked for inventory (§11)
-- ---------------------------------------------------------------------
insert into products (supplier_id, sku, name, category, is_retail, retail_price, cost_price)
select s.id, v.sku, v.name, v.category, v.is_retail, v.retail, v.cost
from (values
  -- Retail (for clients)
  ('SHMP-NOSALT', 'שמפו ללא מלחים',       'shampoo',  true,  79,  28),
  ('MASK-COLOR',  'מסכה לשיער צבוע',       'mask',     true,  95,  34),
  ('SERUM-REPAIR','סרום משקם קצוות',       'serum',    true,  120, 40),
  ('CREAM-CURL',  'קרם תלתלים',            'styling',  true,  85,  30),
  ('OIL-ARGAN',   'שמן ארגן',              'styling',  true,  110, 38),
  ('HEAT-PROTECT','ספריי הגנה מחום',       'styling',  true,  69,  24),
  -- Professional consumables (inventory only)
  ('COLOR-7-1',   'צבע 7.1',               'color',    false, 0,   22),
  ('COLOR-6-0',   'צבע 6.0',               'color',    false, 0,   22),
  ('DEVELOPER-9', 'מחמצן 9%',              'color',    false, 0,   18),
  ('BLEACH-PWD',  'אבקת הבהרה',            'color',    false, 0,   45),
  ('SMOOTH-KER',  'חומר החלקה קרטין',      'smoothing',false, 0,   180),
  ('FOIL-ROLL',   'נייר אלומיניום לפסים',  'supplies', false, 0,   25)
) as v(sku, name, category, is_retail, retail, cost)
cross join (select id from suppliers order by created_at limit 1) s
on conflict (sku) do nothing;

-- ---------------------------------------------------------------------
-- Stock levels for the default branch (with reorder thresholds → §11 alerts)
-- ---------------------------------------------------------------------
insert into inventory_items (product_id, branch_id, quantity, unit, reorder_level)
select p.id, b.id, v.qty, v.unit, v.reorder
from (values
  ('SHMP-NOSALT', 24, 'unit', 6),
  ('MASK-COLOR',  18, 'unit', 5),
  ('SERUM-REPAIR',12, 'unit', 4),
  ('CREAM-CURL',  15, 'unit', 4),
  ('OIL-ARGAN',   10, 'unit', 3),
  ('HEAT-PROTECT',20, 'unit', 5),
  ('COLOR-7-1',   8,  'tube', 4),
  ('COLOR-6-0',   6,  'tube', 4),
  ('DEVELOPER-9', 5,  'liter',2),
  ('BLEACH-PWD',  4,  'kg',   2),
  ('SMOOTH-KER',  3,  'liter',1),
  ('FOIL-ROLL',   7,  'roll', 2)
) as v(sku, qty, unit, reorder)
join products p on p.sku = v.sku
cross join (select id from branches order by created_at limit 1) b
on conflict (product_id, branch_id) do nothing;
