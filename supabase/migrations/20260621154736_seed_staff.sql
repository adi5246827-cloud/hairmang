-- =====================================================================
-- SalonOS AI – Seed staff (§13)
-- A few active stylists in the default branch so the booking form can
-- offer a "preferred stylist" choice. Idempotent on full_name.
-- =====================================================================
insert into staff (branch_id, role_id, full_name, phone, commission_rate, hourly_cost, is_active)
select b.id, r.id, v.full_name, v.phone, v.commission, v.cost, true
from (values
  ('יעל לוי',   '050-1110001', 35, 60),
  ('דניאל כהן', '050-1110002', 30, 55),
  ('נועה אבני', '050-1110003', 35, 60)
) as v(full_name, phone, commission, cost)
cross join (select id from branches order by created_at limit 1) b
left join roles r on r.name = 'stylist'
where not exists (select 1 from staff s where s.full_name = v.full_name);
