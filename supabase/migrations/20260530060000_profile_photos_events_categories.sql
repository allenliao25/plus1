-- plus1 profile photos + event category polish

alter table profiles
  add column if not exists avatar_url text;

update quests
set category = 'Sidequest'
where category = 'Errand';

update profiles
set interests = array_replace(interests, 'Errand', 'Sidequest')
where interests @> array['Errand'];

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "profile photos are public" on storage.objects;
create policy "profile photos are public"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

drop policy if exists "users upload own profile photos" on storage.objects;
create policy "users upload own profile photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users update own profile photos" on storage.objects;
create policy "users update own profile photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete own profile photos" on storage.objects;
create policy "users delete own profile photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
