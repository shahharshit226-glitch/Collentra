-- 0014_storage_and_realtime.sql

-- Public-read avatar bucket; each user may only write under their own
-- auth.uid() prefix, e.g. avatars/<uid>/photo.jpg.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

create policy avatars_owner_write on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_owner_update on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_owner_delete on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime: only the messages table needs live delivery (§43). RLS on
-- `messages` (0012) still applies to what a subscribed client actually
-- receives, so this does not widen access.
alter publication supabase_realtime add table messages;
