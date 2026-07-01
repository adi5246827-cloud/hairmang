-- =====================================================================
-- Add a separate toner block and a sensitivity (patch) test to formulas.
-- =====================================================================
alter table client_formulas add column if not exists toner_brand      text;
alter table client_formulas add column if not exists toner_shade      text;   -- גוון הטונר
alter table client_formulas add column if not exists toner_developer  text;   -- חמצן לטונר (vol / %) — חופשי
alter table client_formulas add column if not exists toner_minutes    int;    -- זמן השהיית טונר

alter table client_formulas add column if not exists patch_test_done  boolean not null default false;
alter table client_formulas add column if not exists patch_test_date  date;
alter table client_formulas add column if not exists patch_test_notes text;

-- enrich the existing demo formula so the new fields are visible
update client_formulas
set toner_brand = 'Wella',
    toner_shade = '/81',
    toner_developer = '6 vol',
    toner_minutes = 10,
    patch_test_done = true,
    patch_test_date = current_date - 11,
    patch_test_notes = 'ללא תגובה — תקין'
where title = 'צבע שורשים — בלונד קר'
  and toner_brand is null;
