-- Storage for delivery paperwork: order photos, receipts, warehouse slips and
-- sample-collection shots taken at a stop.
--
-- PRIVATE bucket, not public. These images carry customer names, addresses and
-- signatures; a public bucket would serve any of them to anyone who guessed
-- the URL. The app reads them through short-lived signed URLs instead, which
-- the anon key can mint for a signed-in user — so no service-role key is
-- needed and none is added to the environment.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'delivery-photos',
  'delivery-photos',
  false,
  -- Compressed uploads land near 300KB; 5MB leaves room for an original that
  -- the browser declined to re-encode, without letting a video through.
  5242880,
  -- HEIC is deliberately absent. Only Safari can decode it, so an accepted
  -- HEIC would be an object Android could never display. The client refuses it
  -- with an explanation instead — see src/lib/images/compress.ts.
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Object keys are "<user_id>/<trip_id>/<stop_id>/<uuid>.jpg", so the first
-- path segment is the owner and every policy below pivots on it. Matching the
-- folder rather than joining back to trip_stops keeps these checks cheap and
-- means an orphaned file is still protected.

create policy delivery_photos_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'delivery-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy delivery_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'delivery-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy delivery_photos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'delivery-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'delivery-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy delivery_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'delivery-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
