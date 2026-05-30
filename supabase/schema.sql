-- Schema for the plus1 CS153 MVP.
-- The app uses Supabase Auth-backed profiles and authenticated RLS policies.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  handle text not null,
  email text unique,
  phone text unique,
  avatar_initials text,
  website_url text,
  bio text,
  interests text[] not null default '{}',
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists quests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references profiles(id),
  title text not null,
  category text not null,
  location text not null,
  start_time timestamp not null,
  description text,
  max_people int not null default 4,
  status text not null default 'open',
  created_at timestamp default now()
);

create table if not exists quest_joins (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid references quests(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamp default now(),
  unique (quest_id, user_id)
);

create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  actor_id uuid references profiles(id),
  quest_id uuid references quests(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamp,
  created_at timestamp default now()
);

create unique index if not exists profiles_handle_unique
  on profiles (handle);

alter table profiles
  drop constraint if exists profiles_handle_format_check;

alter table profiles
  add constraint profiles_handle_format_check
  check (handle ~ '^[a-z0-9._]{3,30}$');

create unique index if not exists profiles_email_unique
  on profiles (email)
  where email is not null;

create unique index if not exists profiles_phone_unique
  on profiles (phone)
  where phone is not null;

create unique index if not exists quest_joins_quest_id_user_id_unique
  on quest_joins (quest_id, user_id);

create unique index if not exists push_tokens_user_id_token_unique
  on push_tokens (user_id, token);

create index if not exists activity_events_user_id_created_at_idx
  on activity_events (user_id, created_at desc);

alter table profiles enable row level security;
alter table quests enable row level security;
alter table quest_joins enable row level security;
alter table push_tokens enable row level security;
alter table activity_events enable row level security;

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

drop policy if exists "users read own activity" on activity_events;
create policy "users read own activity"
  on activity_events for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "actors create activity" on activity_events;
create policy "actors create activity"
  on activity_events for insert
  to authenticated
  with check (auth.uid() = actor_id);

drop policy if exists "users update own activity" on activity_events;
create policy "users update own activity"
  on activity_events for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No static seed rows after auth migration.
-- Profiles are created on first sign-in via app logic.
