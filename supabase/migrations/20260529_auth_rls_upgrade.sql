-- plus1 auth + lifecycle migration
-- Move from demo profile picker to real auth-backed profiles and policies.

create extension if not exists pgcrypto;

create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create unique index if not exists push_tokens_user_id_token_unique
  on push_tokens (user_id, token);

alter table push_tokens enable row level security;

alter table profiles
  alter column id drop default;

do $$
begin
  alter table profiles
    drop constraint if exists profiles_pkey;
exception
  when undefined_table then null;
end $$;

alter table profiles
  add constraint profiles_pkey primary key (id);

alter table profiles
  drop constraint if exists profiles_id_fkey;

alter table profiles
  add constraint profiles_id_fkey
  foreign key (id)
  references auth.users(id)
  on delete cascade;

drop policy if exists "demo read profiles" on profiles;
create policy "demo read profiles"
  on profiles for select
  to authenticated
  using (true);

drop policy if exists "users manage own profile" on profiles;
create policy "users manage own profile"
  on profiles for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "demo read quests" on quests;
create policy "demo read quests"
  on quests for select
  to authenticated
  using (true);

drop policy if exists "authenticated create quests" on quests;
create policy "authenticated create quests"
  on quests for insert
  to authenticated
  with check (
    auth.uid() = creator_id
    and status = 'open'
  );

drop policy if exists "hosts update their quests" on quests;
create policy "hosts update their quests"
  on quests for update
  to authenticated
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

drop policy if exists "demo read joins" on quest_joins;
create policy "demo read joins"
  on quest_joins for select
  to authenticated
  using (true);

drop policy if exists "users create joins" on quest_joins;
create policy "users create joins"
  on quest_joins for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from quests
      where quests.id = quest_joins.quest_id
        and quests.status = 'open'
        and quests.creator_id <> auth.uid()
        and (
          select count(*)::int + 1
          from quest_joins as existing_joins
          where existing_joins.quest_id = quest_joins.quest_id
        ) < coalesce(quests.max_people, 4)
    )
  );

drop policy if exists "users delete their joins" on quest_joins;
create policy "users delete their joins"
  on quest_joins for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users read own push tokens" on push_tokens;
create policy "users read own push tokens"
  on push_tokens for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users create own push tokens" on push_tokens;
create policy "users create own push tokens"
  on push_tokens for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users update own push tokens" on push_tokens;
create policy "users update own push tokens"
  on push_tokens for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users delete own push tokens" on push_tokens;
create policy "users delete own push tokens"
  on push_tokens for delete
  to authenticated
  using (auth.uid() = user_id);

-- Existing demo seed rows are intentionally not recreated.
-- Profiles are created through app sign-in, and quests are user-generated.
