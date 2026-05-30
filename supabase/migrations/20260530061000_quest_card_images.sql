-- plus1 quest card image support

alter table quests
  add column if not exists card_image_url text;

insert into storage.buckets (id, name, public)
values ('quest-card-images', 'quest-card-images', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "quest card images are public" on storage.objects;
create policy "quest card images are public"
  on storage.objects for select
  using (bucket_id = 'quest-card-images');

drop policy if exists "users upload own quest card images" on storage.objects;
create policy "users upload own quest card images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'quest-card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users update own quest card images" on storage.objects;
create policy "users update own quest card images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'quest-card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'quest-card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete own quest card images" on storage.objects;
create policy "users delete own quest card images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'quest-card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
