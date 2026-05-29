-- Demo schema for the plus1 CS153 MVP.
-- This is intentionally permissive so the app can work with demo users before auth.
-- Replace these policies with real Supabase Auth + stricter RLS before production.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null unique,
  email text unique,
  avatar_initials text,
  created_at timestamp default now()
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

create unique index if not exists profiles_display_name_unique
  on profiles (display_name);

create unique index if not exists profiles_email_unique
  on profiles (email)
  where email is not null;

create unique index if not exists quest_joins_quest_id_user_id_unique
  on quest_joins (quest_id, user_id);

alter table profiles enable row level security;
alter table quests enable row level security;
alter table quest_joins enable row level security;

drop policy if exists "demo read profiles" on profiles;
create policy "demo read profiles"
  on profiles for select
  using (true);

drop policy if exists "demo create profiles" on profiles;
create policy "demo create profiles"
  on profiles for insert
  with check (true);

drop policy if exists "demo read quests" on quests;
create policy "demo read quests"
  on quests for select
  using (true);

drop policy if exists "demo create quests" on quests;
create policy "demo create quests"
  on quests for insert
  with check (true);

drop policy if exists "demo read joins" on quest_joins;
create policy "demo read joins"
  on quest_joins for select
  using (true);

drop policy if exists "demo create joins" on quest_joins;
create policy "demo create joins"
  on quest_joins for insert
  with check (true);

insert into profiles (display_name, email, avatar_initials)
values
  ('Allen', 'allen@example.com', 'AL'),
  ('Maya', 'maya@example.com', 'MA'),
  ('Chris', 'chris@example.com', 'CH')
on conflict (display_name) do update
set
  email = excluded.email,
  avatar_initials = excluded.avatar_initials;

insert into quests (
  creator_id,
  title,
  category,
  location,
  start_time,
  description,
  max_people,
  status
)
select
  profiles.id,
  'Dinner at Wilbur',
  'Food',
  'Wilbur Dining',
  now() + interval '2 hours',
  'Grabbing dinner after section. Easy yes, no need to stay long.',
  6,
  'open'
from profiles
where profiles.display_name = 'Maya'
  and not exists (
    select 1 from quests where quests.title = 'Dinner at Wilbur'
  );

insert into quests (
  creator_id,
  title,
  category,
  location,
  start_time,
  description,
  max_people,
  status
)
select
  profiles.id,
  'Study block at Green',
  'Study',
  'Green Library',
  now() + interval '4 hours',
  'Quiet table for a focused hour. Bring whatever you need to finish.',
  4,
  'open'
from profiles
where profiles.display_name = 'Chris'
  and not exists (
    select 1 from quests where quests.title = 'Study block at Green'
  );

insert into quests (
  creator_id,
  title,
  category,
  location,
  start_time,
  description,
  max_people,
  status
)
select
  profiles.id,
  'Quick campus walk',
  'Outdoors',
  'Main Quad',
  now() + interval '1 day',
  'Short loop before class. Good for getting outside without making it a whole thing.',
  5,
  'open'
from profiles
where profiles.display_name = 'Allen'
  and not exists (
    select 1 from quests where quests.title = 'Quick campus walk'
  );
