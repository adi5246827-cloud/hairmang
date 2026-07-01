-- =====================================================================
-- SalonOS AI – Row Level Security
-- Secure-by-default: enable RLS on every public table and grant
-- authenticated staff full access. anon role gets NO access.
-- service_role bypasses RLS automatically (used by backend jobs / AI engine).
--
-- NOTE: clients are treated as back-office data operated by authenticated
-- staff. When a client-facing app with its own auth is wired up, add
-- per-row "own data" policies (e.g. clients.auth_user_id = auth.uid()).
-- =====================================================================

do $$
declare
  t text;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    -- 1. turn on RLS (denies everything until a policy allows it)
    execute format('alter table public.%I enable row level security', t);
    -- 2. block the table even for the table owner unless a policy matches
    execute format('alter table public.%I force row level security', t);

    -- 3. authenticated staff: full read/write
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_all', t);
    execute format(
      'create policy %I on public.%I as permissive for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;
end
$$;
