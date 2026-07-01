-- =====================================================================
-- SalonOS AI – Initial schema
-- Generated from specs/salon_premium_system.md
-- Empty database (structure only, no seed data)
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------
create type appointment_status as enum (
  'pending', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show'
);
create type waitlist_status as enum ('waiting', 'offered', 'accepted', 'expired', 'cancelled');
create type deposit_status as enum ('pending', 'paid', 'refunded', 'forfeited');
create type risk_level as enum ('low', 'medium', 'high');
create type loyalty_tier_name as enum ('silver', 'gold', 'platinum');
create type loyalty_txn_type as enum ('earn', 'redeem', 'expire', 'adjust');
create type subscription_status as enum ('active', 'paused', 'cancelled', 'expired');
create type channel_type as enum ('whatsapp', 'sms', 'email', 'instagram', 'facebook', 'tiktok', 'google', 'website', 'phone', 'walk_in');
create type message_direction as enum ('inbound', 'outbound');
create type campaign_status as enum ('draft', 'scheduled', 'running', 'completed', 'cancelled');
create type lead_status as enum ('new', 'contacted', 'scheduled', 'converted', 'lost');
create type invoice_status as enum ('draft', 'issued', 'paid', 'partially_paid', 'cancelled', 'refunded');
create type payment_method as enum ('cash', 'card', 'bit', 'bank_transfer', 'subscription', 'other');
create type po_status as enum ('draft', 'ordered', 'received', 'cancelled');
create type movement_type as enum ('purchase', 'consumption', 'adjustment', 'return', 'waste');

-- =====================================================================
-- 18. Multi-branch network
-- =====================================================================
create table branches (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  address       text,
  phone         text,
  email         text,
  timezone      text default 'Asia/Jerusalem',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table roles (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,            -- owner, manager, stylist, receptionist
  permissions   jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- =====================================================================
-- 13. Staff management
-- =====================================================================
create table staff (
  id                  uuid primary key default gen_random_uuid(),
  branch_id           uuid references branches(id) on delete set null,
  role_id             uuid references roles(id) on delete set null,
  auth_user_id        uuid,                       -- links to auth.users
  full_name           text not null,
  phone               text,
  email               text,
  commission_rate     numeric(5,2) default 0,     -- percent
  hourly_cost         numeric(10,2) default 0,    -- for profitability calc
  is_active           boolean not null default true,
  hired_at            date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table staff_shifts (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid not null references staff(id) on delete cascade,
  branch_id     uuid references branches(id) on delete set null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  notes         text,
  created_at    timestamptz not null default now()
);

create table staff_time_off (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid not null references staff(id) on delete cascade,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  reason        text,
  approved      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table staff_goals (
  id              uuid primary key default gen_random_uuid(),
  staff_id        uuid not null references staff(id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  revenue_target  numeric(12,2),
  product_sales_target numeric(12,2),
  created_at      timestamptz not null default now()
);

-- =====================================================================
-- 2. Advanced client card / CRM
-- =====================================================================
create table clients (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id) on delete set null,
  full_name       text not null,
  phone           text,
  email           text,
  birthday        date,
  preferences     text,
  service_notes   text,
  address         text,
  distance_km     numeric(6,2),                  -- used by cancellation-risk engine (4)
  preferred_staff_id uuid references staff(id) on delete set null,
  marketing_opt_in boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table client_family_members (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  related_client_id uuid references clients(id) on delete set null,
  full_name     text,
  relationship  text,
  created_at    timestamptz not null default now()
);

create table client_allergies (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  substance     text not null,
  severity      text,
  notes         text,
  created_at    timestamptz not null default now()
);

-- =====================================================================
-- Service catalog (used across 3, 7, 8, 12)
-- =====================================================================
create table service_categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  created_at    timestamptz not null default now()
);

create table services (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid references service_categories(id) on delete set null,
  name              text not null,
  description       text,
  duration_minutes  int not null default 30,
  base_price        numeric(10,2) not null default 0,
  material_cost     numeric(10,2) not null default 0,  -- 12. profitability
  requires_deposit  boolean not null default false,    -- 3. deposits for premium
  deposit_amount    numeric(10,2) default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- =====================================================================
-- 2. Hair history & AI Hair Journey
-- =====================================================================
create table hair_history (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete cascade,
  staff_id          uuid references staff(id) on delete set null,
  service_id        uuid references services(id) on delete set null,
  appointment_id    uuid,                          -- fk added after appointments table
  performed_on      date not null default current_date,
  color_formula     text,
  materials_used    text,
  professional_notes text,
  next_treatment_recommendation text,
  created_at        timestamptz not null default now()
);

create table hair_history_photos (
  id                uuid primary key default gen_random_uuid(),
  hair_history_id   uuid not null references hair_history(id) on delete cascade,
  client_id         uuid not null references clients(id) on delete cascade,
  storage_path      text not null,
  kind              text,                          -- 'before' | 'after'
  created_at        timestamptz not null default now()
);

create table hair_journey_predictions (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete cascade,
  prediction_type   text not null,                 -- color_fade, root_growth, repair_due, rebook_due, product_match
  predicted_date    date,
  details           jsonb default '{}'::jsonb,
  resolved          boolean not null default false,
  created_at        timestamptz not null default now()
);

-- =====================================================================
-- 7. Dynamic pricing rules
-- =====================================================================
create table pricing_rules (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) on delete cascade,
  service_id    uuid references services(id) on delete cascade,
  name          text not null,
  day_of_week   int,                               -- 0-6, null = any
  start_time    time,
  end_time      time,
  adjustment_type text not null default 'percent', -- 'percent' | 'fixed'
  adjustment_value numeric(10,2) not null default 0,
  applies_to_tier loyalty_tier_name,               -- VIP-specific pricing
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- =====================================================================
-- 3. Smart appointments
-- =====================================================================
create table appointments (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid references branches(id) on delete set null,
  client_id         uuid not null references clients(id) on delete cascade,
  staff_id          uuid references staff(id) on delete set null,
  status            appointment_status not null default 'pending',
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  source            channel_type default 'website',
  total_price       numeric(10,2) not null default 0,
  notes             text,
  booked_at         timestamptz not null default now(),
  confirmed_at      timestamptz,
  arrived_at        timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table appointment_services (
  id                uuid primary key default gen_random_uuid(),
  appointment_id    uuid not null references appointments(id) on delete cascade,
  service_id        uuid references services(id) on delete set null,
  staff_id          uuid references staff(id) on delete set null,
  price             numeric(10,2) not null default 0,
  duration_minutes  int not null default 0,
  created_at        timestamptz not null default now()
);

-- now hair_history can reference appointments
alter table hair_history
  add constraint hair_history_appointment_fk
  foreign key (appointment_id) references appointments(id) on delete set null;

-- 3. Smart waitlist
create table waitlist (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid references branches(id) on delete set null,
  client_id         uuid not null references clients(id) on delete cascade,
  service_id        uuid references services(id) on delete set null,
  preferred_staff_id uuid references staff(id) on delete set null,
  desired_from      timestamptz,
  desired_to        timestamptz,
  status            waitlist_status not null default 'waiting',
  priority          int not null default 0,
  offered_appointment_id uuid references appointments(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- 3 & 4. Deposits for expensive treatments
create table deposits (
  id                uuid primary key default gen_random_uuid(),
  appointment_id    uuid references appointments(id) on delete cascade,
  client_id         uuid not null references clients(id) on delete cascade,
  amount            numeric(10,2) not null,
  status            deposit_status not null default 'pending',
  paid_at           timestamptz,
  created_at        timestamptz not null default now()
);

-- =====================================================================
-- 4. Cancellation-risk AI engine
-- =====================================================================
create table cancellation_risks (
  id                uuid primary key default gen_random_uuid(),
  appointment_id    uuid not null references appointments(id) on delete cascade,
  client_id         uuid not null references clients(id) on delete cascade,
  score             numeric(5,2) not null default 0,   -- 0-100
  level             risk_level not null default 'low',
  factors           jsonb default '{}'::jsonb,         -- history, lead time, weather, holidays...
  recommended_action text,                              -- deposit, extra reminder, call...
  computed_at       timestamptz not null default now()
);

-- =====================================================================
-- 5. WhatsApp AI
-- =====================================================================
create table conversations (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid references clients(id) on delete set null,
  channel           channel_type not null default 'whatsapp',
  external_id       text,
  is_bot_active     boolean not null default true,
  last_message_at   timestamptz,
  created_at        timestamptz not null default now()
);

create table messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references conversations(id) on delete cascade,
  direction         message_direction not null,
  body              text,
  media_url         text,
  intent            text,                              -- detected intent (book, cancel, price...)
  sent_by_bot       boolean not null default false,
  created_at        timestamptz not null default now()
);

-- =====================================================================
-- 6. AI hair simulation
-- =====================================================================
create table hair_simulations (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid references clients(id) on delete set null,
  source_image_path text not null,
  result_image_path text,
  simulation_type   text,                              -- color, shade, cut, blowout, smoothing, beard, extensions, length
  params            jsonb default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

-- =====================================================================
-- 11. Smart inventory
-- =====================================================================
create table suppliers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  phone         text,
  email         text,
  created_at    timestamptz not null default now()
);

create table products (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid references suppliers(id) on delete set null,
  sku           text unique,
  name          text not null,
  category      text,                                  -- color, shampoo, mask, smoothing material...
  is_retail     boolean not null default false,        -- sellable to clients (8)
  retail_price  numeric(10,2) default 0,
  cost_price    numeric(10,2) default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table inventory_items (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id) on delete cascade,
  branch_id       uuid references branches(id) on delete cascade,
  quantity        numeric(12,2) not null default 0,
  unit            text default 'unit',
  reorder_level   numeric(12,2) not null default 0,
  updated_at      timestamptz not null default now(),
  unique (product_id, branch_id)
);

create table inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id) on delete cascade,
  branch_id       uuid references branches(id) on delete set null,
  movement_type   movement_type not null,
  quantity        numeric(12,2) not null,                -- positive in, negative out
  appointment_id  uuid references appointments(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

create table purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid references suppliers(id) on delete set null,
  branch_id     uuid references branches(id) on delete set null,
  status        po_status not null default 'draft',
  ordered_at    timestamptz,
  received_at   timestamptz,
  total         numeric(12,2) default 0,
  created_at    timestamptz not null default now()
);

create table purchase_order_items (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id        uuid references products(id) on delete set null,
  quantity          numeric(12,2) not null,
  unit_cost         numeric(10,2) not null default 0
);

-- =====================================================================
-- 8. Automated sales / product recommendations
-- =====================================================================
create table sales_opportunities (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete cascade,
  trigger_service_id uuid references services(id) on delete set null,
  product_id        uuid references products(id) on delete set null,
  message           text,
  status            text not null default 'suggested', -- suggested, sent, converted, dismissed
  created_at        timestamptz not null default now()
);

-- =====================================================================
-- 9. VIP loyalty club
-- =====================================================================
create table loyalty_tiers (
  id              uuid primary key default gen_random_uuid(),
  name            loyalty_tier_name not null unique,
  min_points      int not null default 0,
  benefits        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table loyalty_accounts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null unique references clients(id) on delete cascade,
  tier_id         uuid references loyalty_tiers(id) on delete set null,
  points_balance  int not null default 0,
  lifetime_points int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table loyalty_transactions (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references loyalty_accounts(id) on delete cascade,
  txn_type        loyalty_txn_type not null,
  points          int not null,
  reason          text,                                 -- visit, product, referral, birthday
  appointment_id  uuid references appointments(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- =====================================================================
-- 10. Monthly subscriptions
-- =====================================================================
create table subscription_plans (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,                         -- Silver / Gold / Platinum Plan
  price_monthly   numeric(10,2) not null default 0,
  benefits        jsonb default '{}'::jsonb,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table client_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  plan_id         uuid not null references subscription_plans(id) on delete restrict,
  status          subscription_status not null default 'active',
  started_at      date not null default current_date,
  renews_at       date,
  cancelled_at    timestamptz,
  created_at      timestamptz not null default now()
);

-- =====================================================================
-- 16. Billing / client app (invoices, payments)
-- =====================================================================
create table invoices (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete restrict,
  appointment_id  uuid references appointments(id) on delete set null,
  branch_id       uuid references branches(id) on delete set null,
  status          invoice_status not null default 'draft',
  subtotal        numeric(12,2) not null default 0,
  discount        numeric(12,2) not null default 0,
  tax             numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  issued_at       timestamptz,
  created_at      timestamptz not null default now()
);

create table invoice_items (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references invoices(id) on delete cascade,
  service_id      uuid references services(id) on delete set null,
  product_id      uuid references products(id) on delete set null,
  description     text,
  quantity        numeric(10,2) not null default 1,
  unit_price      numeric(10,2) not null default 0,
  line_total      numeric(12,2) not null default 0
);

create table payments (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid references invoices(id) on delete set null,
  client_id       uuid references clients(id) on delete set null,
  amount          numeric(12,2) not null,
  method          payment_method not null default 'card',
  staff_id        uuid references staff(id) on delete set null,
  paid_at         timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- =====================================================================
-- 14. Automated marketing
-- =====================================================================
create table marketing_campaigns (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id) on delete set null,
  name            text not null,
  channel         channel_type not null default 'whatsapp',
  audience_filter jsonb default '{}'::jsonb,             -- color clients, lapsed 45d, VIP...
  message_template text,
  status          campaign_status not null default 'draft',
  scheduled_at    timestamptz,
  created_at      timestamptz not null default now()
);

create table campaign_recipients (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references marketing_campaigns(id) on delete cascade,
  client_id       uuid not null references clients(id) on delete cascade,
  sent_at         timestamptz,
  responded       boolean not null default false,
  converted       boolean not null default false,
  created_at      timestamptz not null default now()
);

-- =====================================================================
-- 15. Reviews & reputation
-- =====================================================================
create table reviews (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references clients(id) on delete set null,
  appointment_id  uuid references appointments(id) on delete set null,
  staff_id        uuid references staff(id) on delete set null,
  rating          int check (rating between 1 and 5),
  comment         text,
  external_url    text,                                  -- google review link
  requested_at    timestamptz,
  submitted_at    timestamptz,
  created_at      timestamptz not null default now()
);

-- =====================================================================
-- 17. Social channels & leads
-- =====================================================================
create table social_accounts (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id) on delete cascade,
  platform        channel_type not null,
  handle          text,
  access_token    text,
  is_connected    boolean not null default false,
  created_at      timestamptz not null default now()
);

create table leads (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id) on delete set null,
  full_name       text,
  phone           text,
  email           text,
  source          channel_type not null default 'instagram',
  status          lead_status not null default 'new',
  converted_client_id uuid references clients(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

-- =====================================================================
-- 1 & 19. Manager dashboard targets + AI Business Coach
-- =====================================================================
create table business_targets (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id) on delete cascade,
  period          text not null,                         -- 'daily' | 'monthly'
  target_date     date not null,
  revenue_target  numeric(12,2) not null default 0,
  created_at      timestamptz not null default now()
);

create table ai_recommendations (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id) on delete set null,
  category        text,                                  -- revenue, staffing, pricing, inventory, marketing
  title           text,
  body            text not null,
  estimated_value numeric(12,2),
  is_dismissed    boolean not null default false,
  created_at      timestamptz not null default now()
);

-- =====================================================================
-- Indexes for common lookups
-- =====================================================================
create index idx_clients_branch on clients(branch_id);
create index idx_clients_phone on clients(phone);
create index idx_appointments_client on appointments(client_id);
create index idx_appointments_staff on appointments(staff_id);
create index idx_appointments_starts_at on appointments(starts_at);
create index idx_appointments_status on appointments(status);
create index idx_appointment_services_appt on appointment_services(appointment_id);
create index idx_hair_history_client on hair_history(client_id);
create index idx_messages_conversation on messages(conversation_id);
create index idx_inventory_items_branch on inventory_items(branch_id);
create index idx_inventory_movements_product on inventory_movements(product_id);
create index idx_loyalty_txn_account on loyalty_transactions(account_id);
create index idx_campaign_recipients_campaign on campaign_recipients(campaign_id);
create index idx_cancellation_risks_appt on cancellation_risks(appointment_id);
create index idx_leads_status on leads(status);
