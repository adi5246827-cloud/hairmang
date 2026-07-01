-- =====================================================================
-- Demo data for every otherwise-empty table, so the admin dashboard can
-- show real-looking content across all 20 areas.
-- Idempotent: guarded by a sentinel (skips entirely if ai_recommendations
-- already has rows — only this seed populates that table).
-- =====================================================================
do $$
declare
  v_branch uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid;
  s1 uuid; s2 uuid;
  svc1 uuid; svc2 uuid; svc3 uuid;
  p1 uuid; p2 uuid; p3 uuid;
  sup uuid;
  plan1 uuid; plan2 uuid;
  acct1 uuid; acct2 uuid;
  appt_past uuid; appt_future uuid;
  conv1 uuid; conv2 uuid;
  inv1 uuid;
  camp1 uuid; camp2 uuid;
  po1 uuid;
  hh1 uuid;
  m_start date;
  m_end date;
begin
  if exists (select 1 from ai_recommendations) then
    raise notice 'demo data already seeded; skipping';
    return;
  end if;

  select id into v_branch from branches order by created_at limit 1;
  select id into s1 from staff order by created_at limit 1;
  select id into s2 from staff order by created_at offset 1 limit 1;
  select id into svc1 from services order by created_at limit 1;
  select id into svc2 from services order by created_at offset 1 limit 1;
  select id into svc3 from services order by created_at offset 2 limit 1;
  select id into p1 from products order by created_at limit 1;
  select id into p2 from products order by created_at offset 1 limit 1;
  select id into p3 from products order by created_at offset 2 limit 1;
  select id into sup from suppliers order by created_at limit 1;
  select id into plan1 from subscription_plans order by price_monthly asc limit 1;
  select id into plan2 from subscription_plans order by price_monthly desc limit 1;
  m_start := date_trunc('month', current_date)::date;
  m_end   := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;

  -- ---- demo clients (loyalty account auto-created by trigger) ----
  insert into clients (branch_id, full_name, phone, email, birthday, preferences, service_notes, distance_km, marketing_opt_in)
  values (v_branch,'מאיה לוי','050-2220001','maya@example.com','1991-04-12','בלונד קר, קפה שחור','רגישות קלה בקרקפת',7.5,true)
  returning id into c1;
  insert into clients (branch_id, full_name, phone, email, birthday, preferences, service_notes, distance_km, marketing_opt_in)
  values (v_branch,'יעל ברקוביץ','050-2220002','yael@example.com','1986-09-03','החלקה, שיער ארוך',null,15.0,true)
  returning id into c2;
  insert into clients (branch_id, full_name, phone, email, birthday, preferences, distance_km, marketing_opt_in)
  values (v_branch,'רוני שמש','050-2220003','roni@example.com','1995-12-21','תספורת קצרה',3.2,false)
  returning id into c3;
  insert into clients (branch_id, full_name, phone, email, birthday, preferences, distance_km, marketing_opt_in)
  values (v_branch,'דנה כהן','050-2220004','dana@example.com','1979-02-28','גוונים חמים',22.0,true)
  returning id into c4;

  select id into acct1 from loyalty_accounts where client_id = c1;
  select id into acct2 from loyalty_accounts where client_id = c2;

  -- ---- family + allergies ----
  insert into client_family_members (client_id, related_client_id, full_name, relationship)
  values (c1, c4, 'דנה כהן', 'אם'), (c2, null, 'מירב ברקוביץ', 'אחות');
  insert into client_allergies (client_id, substance, severity, notes)
  values (c1, 'אמוניה', 'בינונית', 'להשתמש בצבע ללא אמוניה'),
         (c4, 'PPD', 'גבוהה', 'בדיקת רגישות לפני כל צביעה');

  -- ---- appointments: one completed (past), one upcoming ----
  insert into appointments (branch_id, client_id, staff_id, status, starts_at, ends_at, source, total_price, confirmed_at, arrived_at)
  values (v_branch, c1, s1, 'completed', now() - interval '9 days' + interval '10 hours', now() - interval '9 days' + interval '12 hours', 'phone', 320, now() - interval '10 days', now() - interval '9 days' + interval '10 hours')
  returning id into appt_past;
  insert into appointment_services (appointment_id, service_id, staff_id, price, duration_minutes)
  values (appt_past, svc2, s1, 320, 120);

  insert into appointments (branch_id, client_id, staff_id, status, starts_at, ends_at, source, total_price, confirmed_at)
  values (v_branch, c2, s2, 'confirmed', now() + interval '2 days' + interval '9 hours', now() + interval '2 days' + interval '11 hours', 'whatsapp', 450, now())
  returning id into appt_future;
  insert into appointment_services (appointment_id, service_id, staff_id, price, duration_minutes)
  values (appt_future, svc3, s2, 450, 120);

  -- ---- hair history + photos + predictions ----
  insert into hair_history (client_id, staff_id, service_id, appointment_id, performed_on, color_formula, materials_used, professional_notes, next_treatment_recommendation)
  values (c1, s1, svc2, appt_past, current_date - 9, '7.1 + 9.1 ב-20 vol', 'צבע ללא אמוניה 60 גרם', 'תוצאה אחידה, שורשים כוסו', 'ריענון שורשים בעוד 6 שבועות')
  returning id into hh1;
  insert into hair_history_photos (hair_history_id, client_id, storage_path, kind)
  values (hh1, c1, 'hair-photos/demo-before.jpg', 'before'), (hh1, c1, 'hair-photos/demo-after.jpg', 'after');
  insert into hair_journey_predictions (client_id, prediction_type, predicted_date, details)
  values (c1, 'color_fade', current_date + 35, '{"confidence":0.82}'::jsonb),
         (c2, 'rebook_due', current_date + 14, '{"last_visit_days":40}'::jsonb);

  -- ---- hair simulation ----
  insert into hair_simulations (client_id, source_image_path, result_image_path, simulation_type, params)
  values (c1, 'hair-simulations/src1.jpg', 'hair-simulations/res1.jpg', 'color', '{"shade":"בלונד אפרפר"}'::jsonb);

  -- ---- waitlist ----
  insert into waitlist (branch_id, client_id, service_id, preferred_staff_id, desired_from, desired_to, status, priority)
  values (v_branch, c3, svc1, s1, now() + interval '1 day', now() + interval '4 days', 'waiting', 1);

  -- ---- deposits + cancellation risk on the upcoming appt ----
  insert into deposits (appointment_id, client_id, amount, status, paid_at)
  values (appt_future, c2, 100, 'paid', now());
  insert into cancellation_risks (appointment_id, client_id, score, level, factors, recommended_action)
  values (appt_future, c2, 68, 'high', '{"distance_km":15,"lead_time_h":48,"history":"no_show x1"}'::jsonb, 'בקשת מקדמה + תזכורת נוספת');

  -- ---- conversations + messages ----
  insert into conversations (client_id, channel, external_id, last_message_at)
  values (c1, 'whatsapp', '972502220001', now() - interval '1 hour')
  returning id into conv1;
  insert into messages (conversation_id, direction, body, intent, sent_by_bot) values
    (conv1, 'inbound',  'אפשר לקבוע תור לצבע השבוע?', 'book', false),
    (conv1, 'outbound', 'בטח! יש פנוי ביום רביעי ב-10:00. מתאים?', 'book', true),
    (conv1, 'inbound',  'מושלם, תקבעי לי', 'book', false);
  insert into conversations (client_id, channel, external_id, last_message_at, is_bot_active)
  values (c3, 'instagram', 'roni.ig', now() - interval '2 days', false)
  returning id into conv2;
  insert into messages (conversation_id, direction, body, intent, sent_by_bot) values
    (conv2, 'inbound',  'כמה עולה תספורת?', 'price', false),
    (conv2, 'outbound', 'תספורת נשים אצלנו 120 ₪', 'price', true);

  -- ---- inventory movements (trigger adjusts stock) ----
  insert into inventory_movements (product_id, branch_id, movement_type, quantity, notes)
  values (p1, v_branch, 'purchase', 12, 'קבלת סחורה'),
         (p2, v_branch, 'consumption', -3, 'שימוש בטיפול'),
         (p3, v_branch, 'adjustment', -1, 'תיקון ספירת מלאי');

  -- ---- purchase order + items ----
  insert into purchase_orders (supplier_id, branch_id, status, ordered_at, total)
  values (sup, v_branch, 'ordered', now() - interval '3 days', 980)
  returning id into po1;
  insert into purchase_order_items (purchase_order_id, product_id, quantity, unit_cost)
  values (po1, p1, 20, 28), (po1, p2, 10, 34);

  -- ---- sales opportunities (upsell) ----
  insert into sales_opportunities (client_id, trigger_service_id, product_id, message, status)
  values (c1, svc2, p1, 'מומלץ שמפו ללא מלחים לשמירה על הצבע', 'suggested'),
         (c2, svc3, p2, 'מסכה לשיער צבוע להזנה אחרי החלקה', 'sent');

  -- ---- loyalty transactions (trigger updates balance/tier) ----
  insert into loyalty_transactions (account_id, txn_type, points, reason, appointment_id)
  values (acct1, 'earn', 320, 'visit', appt_past),
         (acct1, 'earn', 50,  'birthday', null),
         (acct2, 'earn', 200, 'referral', null);

  -- ---- client subscriptions ----
  insert into client_subscriptions (client_id, plan_id, status, started_at, renews_at)
  values (c1, plan2, 'active', current_date - 30, current_date + 1),
         (c4, plan1, 'active', current_date - 10, current_date + 20);

  -- ---- invoice + items + payment for the completed appt ----
  insert into invoices (client_id, appointment_id, branch_id, status, subtotal, discount, tax, total, issued_at)
  values (c1, appt_past, v_branch, 'paid', 399, 0, 0, 399, now() - interval '9 days')
  returning id into inv1;
  insert into invoice_items (invoice_id, service_id, product_id, description, quantity, unit_price, line_total)
  values (inv1, svc2, null, 'צבע שיער', 1, 320, 320),
         (inv1, null, p1, 'שמפו ללא מלחים', 1, 79, 79);
  insert into payments (invoice_id, client_id, amount, method, staff_id)
  values (inv1, c1, 399, 'card', s1);

  -- ---- marketing campaigns + recipients ----
  insert into marketing_campaigns (branch_id, name, channel, audience_filter, message_template, status, scheduled_at)
  values (v_branch, 'חזרת לקוחות רדומות 45 יום', 'whatsapp', '{"lapsed_days":45}'::jsonb, 'התגעגענו! 15% הנחה על הביקור הבא 💜', 'scheduled', now() + interval '1 day')
  returning id into camp1;
  insert into campaign_recipients (campaign_id, client_id, sent_at, responded, converted)
  values (camp1, c1, null, false, false), (camp1, c4, null, false, false);
  insert into marketing_campaigns (branch_id, name, channel, audience_filter, message_template, status)
  values (v_branch, 'מבצע יום הולדת', 'sms', '{"birthday_month":true}'::jsonb, 'מזל טוב! מתנה מחכה לך בסלון 🎁', 'running')
  returning id into camp2;
  insert into campaign_recipients (campaign_id, client_id, sent_at, responded, converted)
  values (camp2, c1, now() - interval '2 days', true, true);

  -- ---- reviews ----
  insert into reviews (client_id, appointment_id, staff_id, rating, comment, submitted_at)
  values (c1, appt_past, s1, 5, 'הצבע יצא מושלם, שירות מעולה!', now() - interval '8 days'),
         (c4, null, s2, 4, 'מקצועיות, קצת המתנה', now() - interval '20 days');
  insert into reviews (client_id, staff_id, rating, requested_at, external_url)
  values (c2, s2, null, now() - interval '1 day', 'https://g.page/r/demo-review');

  -- ---- social accounts ----
  insert into social_accounts (branch_id, platform, handle, is_connected)
  values (v_branch, 'instagram', '@salon.demo', true),
         (v_branch, 'facebook', 'SalonDemo', false),
         (v_branch, 'tiktok', '@salon.demo', false);

  -- ---- leads ----
  insert into leads (branch_id, full_name, phone, source, status, notes)
  values (v_branch, 'תמר נחום', '050-2220010', 'instagram', 'new', 'שאלה על החלקה'),
         (v_branch, 'ליאת גל', '050-2220011', 'facebook', 'contacted', 'מעוניינת בצבע'),
         (v_branch, 'שירה אבן', '050-2220012', 'google', 'converted', 'הפכה ללקוחה');

  -- ---- staff shifts / time off / goals ----
  insert into staff_shifts (staff_id, branch_id, starts_at, ends_at, notes)
  values (s1, v_branch, now() + interval '1 day' + interval '9 hours',  now() + interval '1 day' + interval '17 hours', 'משמרת בוקר'),
         (s2, v_branch, now() + interval '1 day' + interval '12 hours', now() + interval '1 day' + interval '20 hours', 'משמרת ערב');
  insert into staff_time_off (staff_id, starts_at, ends_at, reason, approved)
  values (s1, now() + interval '10 days', now() + interval '12 days', 'חופשה', true);
  insert into staff_goals (staff_id, period_start, period_end, revenue_target, product_sales_target)
  values (s1, m_start, m_end, 25000, 3000),
         (s2, m_start, m_end, 30000, 4000);

  -- ---- business targets ----
  insert into business_targets (branch_id, period, target_date, revenue_target)
  values (v_branch, 'monthly', m_start, 120000),
         (v_branch, 'daily', current_date, 5000);

  -- ---- ai recommendations (also the sentinel table) ----
  insert into ai_recommendations (branch_id, category, title, body, estimated_value)
  values
   (v_branch, 'revenue',   'הגדלת מכירת מוצרים', 'שיעור מכירת המוצרים נמוך מהממוצע. הציעו מוצר משלים בכל טיפול צבע.', 4200),
   (v_branch, 'inventory', 'מלאי נמוך בצבעים', 'מספר מוצרים מתחת לסף ההזמנה — מומלץ להזמין השבוע.', 0),
   (v_branch, 'marketing', 'לקוחות רדומות', '18 לקוחות לא ביקרו 60 יום. קמפיין החזרה צפוי להחזיר כ-6.', 5400);

  raise notice 'demo data seeded';
end $$;
