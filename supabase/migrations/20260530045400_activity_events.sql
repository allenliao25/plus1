-- plus1 activity events
-- In-app notification feed for joins, edits, closes, and reminders.

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

create index if not exists activity_events_user_id_created_at_idx
  on activity_events (user_id, created_at desc);

alter table activity_events enable row level security;

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
