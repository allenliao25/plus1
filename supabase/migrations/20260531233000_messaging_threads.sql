create table if not exists message_threads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'event')),
  quest_id uuid references quests(id) on delete cascade,
  direct_key text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  last_message_at timestamp,
  check (
    (kind = 'direct' and quest_id is null and direct_key is not null)
    or (kind = 'event' and quest_id is not null and direct_key is null)
  )
);

create table if not exists message_thread_participants (
  thread_id uuid not null references message_threads(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamp,
  created_at timestamp default now(),
  primary key (thread_id, user_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamp default now(),
  check (char_length(trim(body)) between 1 and 1000)
);

create unique index if not exists message_threads_direct_key_unique
  on message_threads (direct_key)
  where kind = 'direct' and direct_key is not null;

create unique index if not exists message_threads_event_quest_id_unique
  on message_threads (quest_id)
  where kind = 'event' and quest_id is not null;

create index if not exists message_threads_kind_last_message_at_idx
  on message_threads (kind, last_message_at desc nulls last, updated_at desc);

create index if not exists message_thread_participants_user_id_idx
  on message_thread_participants (user_id);

create index if not exists messages_thread_id_created_at_idx
  on messages (thread_id, created_at desc);

alter table message_threads enable row level security;
alter table message_thread_participants enable row level security;
alter table messages enable row level security;

create or replace function public.is_event_chat_member(
  target_quest_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from quests
    where quests.id = target_quest_id
      and quests.creator_id = target_user_id
  )
  or exists (
    select 1
    from quest_joins
    where quest_joins.quest_id = target_quest_id
      and quest_joins.user_id = target_user_id
  );
$$;

revoke all on function public.is_event_chat_member(uuid, uuid) from public;
grant execute on function public.is_event_chat_member(uuid, uuid) to authenticated;

create or replace function public.can_access_message_thread(
  target_thread_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from message_threads
    where message_threads.id = target_thread_id
      and (
        (
          message_threads.kind = 'direct'
          and exists (
            select 1
            from message_thread_participants
            where message_thread_participants.thread_id = message_threads.id
              and message_thread_participants.user_id = target_user_id
          )
        )
        or (
          message_threads.kind = 'event'
          and message_threads.quest_id is not null
          and public.is_event_chat_member(message_threads.quest_id, target_user_id)
        )
      )
  );
$$;

revoke all on function public.can_access_message_thread(uuid, uuid) from public;
grant execute on function public.can_access_message_thread(uuid, uuid) to authenticated;

create or replace function public.sync_event_thread_participants(
  target_thread_id uuid,
  target_quest_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into message_thread_participants (thread_id, user_id)
  select target_thread_id, quests.creator_id
  from quests
  where quests.id = target_quest_id
    and quests.creator_id is not null
  on conflict (thread_id, user_id) do nothing;

  insert into message_thread_participants (thread_id, user_id)
  select target_thread_id, quest_joins.user_id
  from quest_joins
  where quest_joins.quest_id = target_quest_id
    and quest_joins.user_id is not null
  on conflict (thread_id, user_id) do nothing;
end;
$$;

revoke all on function public.sync_event_thread_participants(uuid, uuid) from public;
grant execute on function public.sync_event_thread_participants(uuid, uuid) to authenticated;

create or replace function public.direct_message_key(left_user_id uuid, right_user_id uuid)
returns text
language sql
immutable
as $$
  select least(left_user_id, right_user_id)::text || ':' || greatest(left_user_id, right_user_id)::text;
$$;

revoke all on function public.direct_message_key(uuid, uuid) from public;
grant execute on function public.direct_message_key(uuid, uuid) to authenticated;

create or replace function public.get_or_create_direct_thread(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_thread_id uuid;
  thread_key text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'cannot_message_self';
  end if;

  if not public.are_friends(auth.uid(), target_user_id) then
    raise exception 'direct_messages_are_friends_only';
  end if;

  thread_key := public.direct_message_key(auth.uid(), target_user_id);

  select id
  into resolved_thread_id
  from message_threads
  where kind = 'direct'
    and direct_key = thread_key
  limit 1;

  if resolved_thread_id is null then
    insert into message_threads (kind, direct_key, created_by)
    values ('direct', thread_key, auth.uid())
    on conflict do nothing
    returning id into resolved_thread_id;

    if resolved_thread_id is null then
      select id
      into resolved_thread_id
      from message_threads
      where kind = 'direct'
        and direct_key = thread_key
      limit 1;
    end if;
  end if;

  insert into message_thread_participants (thread_id, user_id)
  values (resolved_thread_id, auth.uid()), (resolved_thread_id, target_user_id)
  on conflict (thread_id, user_id) do nothing;

  return resolved_thread_id;
end;
$$;

revoke all on function public.get_or_create_direct_thread(uuid) from public;
grant execute on function public.get_or_create_direct_thread(uuid) to authenticated;

create or replace function public.get_or_create_event_thread(target_quest_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_thread_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_event_chat_member(target_quest_id, auth.uid()) then
    raise exception 'event_chat_requires_host_or_attendee';
  end if;

  select id
  into resolved_thread_id
  from message_threads
  where kind = 'event'
    and quest_id = target_quest_id
  limit 1;

  if resolved_thread_id is null then
    insert into message_threads (kind, quest_id, created_by)
    values ('event', target_quest_id, auth.uid())
    on conflict do nothing
    returning id into resolved_thread_id;

    if resolved_thread_id is null then
      select id
      into resolved_thread_id
      from message_threads
      where kind = 'event'
        and quest_id = target_quest_id
      limit 1;
    end if;
  end if;

  perform public.sync_event_thread_participants(resolved_thread_id, target_quest_id);

  return resolved_thread_id;
end;
$$;

revoke all on function public.get_or_create_event_thread(uuid) from public;
grant execute on function public.get_or_create_event_thread(uuid) to authenticated;

drop policy if exists "users read accessible message threads" on message_threads;
create policy "users read accessible message threads"
  on message_threads for select
  to authenticated
  using (public.can_access_message_thread(id, auth.uid()));

drop policy if exists "message threads created through rpc" on message_threads;
create policy "message threads created through rpc"
  on message_threads for insert
  to authenticated
  with check (false);

drop policy if exists "users read accessible message participants" on message_thread_participants;
create policy "users read accessible message participants"
  on message_thread_participants for select
  to authenticated
  using (public.can_access_message_thread(thread_id, auth.uid()));

drop policy if exists "message participants created through rpc" on message_thread_participants;
create policy "message participants created through rpc"
  on message_thread_participants for insert
  to authenticated
  with check (false);

drop policy if exists "users update own message read state" on message_thread_participants;
create policy "users update own message read state"
  on message_thread_participants for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.can_access_message_thread(thread_id, auth.uid())
  )
  with check (
    user_id = auth.uid()
    and public.can_access_message_thread(thread_id, auth.uid())
  );

drop policy if exists "users read accessible messages" on messages;
create policy "users read accessible messages"
  on messages for select
  to authenticated
  using (public.can_access_message_thread(thread_id, auth.uid()));

drop policy if exists "users send accessible messages" on messages;
create policy "users send accessible messages"
  on messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.can_access_message_thread(thread_id, auth.uid())
    and char_length(trim(body)) between 1 and 1000
  );

create or replace function public.touch_message_thread_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update message_threads
  set last_message_at = new.created_at,
    updated_at = new.created_at
  where id = new.thread_id;

  return new;
end;
$$;

drop trigger if exists messages_touch_thread on messages;
create trigger messages_touch_thread
  after insert on messages
  for each row execute function public.touch_message_thread_after_insert();

do $$
begin
  alter publication supabase_realtime add table message_threads;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table message_thread_participants;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
