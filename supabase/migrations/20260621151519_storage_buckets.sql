-- =====================================================================
-- SalonOS AI – Storage buckets
-- Private buckets for client hair photos (§2) and AI simulations (§6).
-- Access restricted to authenticated staff via storage.objects policies.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Buckets (private; 10MB image limit)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('hair-photos', 'hair-photos', false, 10485760,
    array['image/jpeg','image/png','image/webp','image/heic']),
  ('hair-simulations', 'hair-simulations', false, 10485760,
    array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Policies: authenticated staff have full access to these two buckets.
-- anon has none; service_role bypasses RLS for backend AI jobs.
-- ---------------------------------------------------------------------
drop policy if exists "salon staff read media" on storage.objects;
create policy "salon staff read media"
  on storage.objects for select to authenticated
  using (bucket_id in ('hair-photos', 'hair-simulations'));

drop policy if exists "salon staff insert media" on storage.objects;
create policy "salon staff insert media"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('hair-photos', 'hair-simulations'));

drop policy if exists "salon staff update media" on storage.objects;
create policy "salon staff update media"
  on storage.objects for update to authenticated
  using (bucket_id in ('hair-photos', 'hair-simulations'))
  with check (bucket_id in ('hair-photos', 'hair-simulations'));

drop policy if exists "salon staff delete media" on storage.objects;
create policy "salon staff delete media"
  on storage.objects for delete to authenticated
  using (bucket_id in ('hair-photos', 'hair-simulations'));
