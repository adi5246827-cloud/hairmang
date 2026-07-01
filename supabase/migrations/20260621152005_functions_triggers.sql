-- =====================================================================
-- SalonOS AI – Functions & triggers
--   1. auto-maintain updated_at on every table that has the column
--   2. auto-create a loyalty account for each new client (§9)
--   3. keep loyalty balances + tier in sync from transactions (§9)
--   4. adjust inventory stock from movements (§11)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
  loop
    execute format('drop trigger if exists trg_set_updated_at on public.%I', t);
    execute format(
      'create trigger trg_set_updated_at before update on public.%I
         for each row execute function set_updated_at()',
      t
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 2. Auto-create a loyalty account (silver tier) for every new client
-- ---------------------------------------------------------------------
create or replace function create_loyalty_account_for_client()
returns trigger
language plpgsql
as $$
declare
  v_tier_id uuid;
begin
  select id into v_tier_id from loyalty_tiers where name = 'silver' limit 1;
  insert into loyalty_accounts (client_id, tier_id, points_balance, lifetime_points)
  values (new.id, v_tier_id, 0, 0)
  on conflict (client_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_client_loyalty on clients;
create trigger trg_client_loyalty
  after insert on clients
  for each row execute function create_loyalty_account_for_client();

-- ---------------------------------------------------------------------
-- 3. Keep loyalty balance + tier in sync from each transaction
-- ---------------------------------------------------------------------
create or replace function apply_loyalty_transaction()
returns trigger
language plpgsql
as $$
declare
  v_balance int;
  v_lifetime int;
  v_tier_id uuid;
begin
  -- adjust balance; only positive earns add to lifetime points
  update loyalty_accounts
  set points_balance = points_balance + new.points,
      lifetime_points = lifetime_points + greatest(new.points, 0)
  where id = new.account_id
  returning points_balance, lifetime_points into v_balance, v_lifetime;

  -- recompute tier from lifetime points (highest threshold met)
  select id into v_tier_id
  from loyalty_tiers
  where min_points <= v_lifetime
  order by min_points desc
  limit 1;

  update loyalty_accounts
  set tier_id = v_tier_id
  where id = new.account_id;

  return new;
end;
$$;

drop trigger if exists trg_apply_loyalty_txn on loyalty_transactions;
create trigger trg_apply_loyalty_txn
  after insert on loyalty_transactions
  for each row execute function apply_loyalty_transaction();

-- ---------------------------------------------------------------------
-- 4. Adjust stock from inventory movements (§11)
--    quantity is signed: +in / -out
-- ---------------------------------------------------------------------
create or replace function apply_inventory_movement()
returns trigger
language plpgsql
as $$
begin
  update inventory_items
  set quantity = quantity + new.quantity
  where product_id = new.product_id
    and (branch_id = new.branch_id or (branch_id is null and new.branch_id is null));

  -- if no stock row exists for this product/branch, create one
  if not found then
    insert into inventory_items (product_id, branch_id, quantity)
    values (new.product_id, new.branch_id, new.quantity);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_inventory_movement on inventory_movements;
create trigger trg_apply_inventory_movement
  after insert on inventory_movements
  for each row execute function apply_inventory_movement();
