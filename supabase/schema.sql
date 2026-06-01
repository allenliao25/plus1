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
  avatar_url text,
  website_url text,
  bio text,
  pronouns text,
  area text not null default 'Demo Area',
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
  start_time timestamp,
  description text,
  card_image_url text,
  area text not null default 'Demo Area',
  visibility text not null default 'local',
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

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamp default now(),
  updated_at timestamp default now(),
  check (requester_id <> addressee_id),
  check (status in ('pending', 'accepted', 'declined'))
);

create table if not exists quest_invites (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references quests(id) on delete cascade,
  inviter_id uuid not null references profiles(id) on delete cascade,
  invitee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamp default now(),
  updated_at timestamp default now(),
  check (inviter_id <> invitee_id),
  check (status in ('pending', 'accepted', 'declined'))
);

create table if not exists quest_share_links (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references quests(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,
  token text not null default encode(gen_random_bytes(16), 'hex'),
  revoked_at timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  check (char_length(token) >= 16)
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

alter table quests
  drop constraint if exists quests_visibility_check;

alter table quests
  add constraint quests_visibility_check
  check (visibility in ('invite_only', 'friends', 'local'));

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

create unique index if not exists friendships_user_pair_unique
  on friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create unique index if not exists quest_invites_quest_id_invitee_id_unique
  on quest_invites (quest_id, invitee_id);

create unique index if not exists quest_share_links_token_unique
  on quest_share_links (token);

create unique index if not exists quest_share_links_active_quest_id_unique
  on quest_share_links (quest_id)
  where revoked_at is null;

create index if not exists quest_share_links_quest_id_idx
  on quest_share_links (quest_id);

create index if not exists quest_share_links_created_by_idx
  on quest_share_links (created_by);

create unique index if not exists push_tokens_user_id_token_unique
  on push_tokens (user_id, token);

create index if not exists activity_events_user_id_created_at_idx
  on activity_events (user_id, created_at desc);

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

create index if not exists profiles_area_idx
  on profiles (area);

create index if not exists quests_area_status_start_time_idx
  on quests (area, status, start_time);

create index if not exists quests_visibility_idx
  on quests (visibility);

create index if not exists friendships_requester_status_idx
  on friendships (requester_id, status);

create index if not exists friendships_addressee_status_idx
  on friendships (addressee_id, status);

create index if not exists quest_invites_invitee_status_idx
  on quest_invites (invitee_id, status);

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do update
set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('quest-card-images', 'quest-card-images', true)
on conflict (id) do update
set public = excluded.public;

alter table profiles enable row level security;
alter table quests enable row level security;
alter table quest_joins enable row level security;
alter table friendships enable row level security;
alter table quest_invites enable row level security;
alter table quest_share_links enable row level security;
alter table push_tokens enable row level security;
alter table activity_events enable row level security;
alter table message_threads enable row level security;
alter table message_thread_participants enable row level security;
alter table messages enable row level security;

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

create or replace function public.current_user_area()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select profiles.area
      from profiles
      where profiles.id = auth.uid()
      limit 1
    ),
    'Demo Area'
  );
$$;

revoke all on function public.current_user_area() from public;
grant execute on function public.current_user_area() to authenticated;

create or replace function public.are_friends(left_user_id uuid, right_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from friendships
    where status = 'accepted'
      and (
        (requester_id = left_user_id and addressee_id = right_user_id)
        or (requester_id = right_user_id and addressee_id = left_user_id)
      )
  );
$$;

revoke all on function public.are_friends(uuid, uuid) from public;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

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
  thread_id uuid;
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
  into thread_id
  from message_threads
  where kind = 'direct'
    and direct_key = thread_key
  limit 1;

  if thread_id is null then
    insert into message_threads (kind, direct_key, created_by)
    values ('direct', thread_key, auth.uid())
    on conflict do nothing
    returning id into thread_id;

    if thread_id is null then
      select id
      into thread_id
      from message_threads
      where kind = 'direct'
        and direct_key = thread_key
      limit 1;
    end if;
  end if;

  insert into message_thread_participants (thread_id, user_id)
  values (thread_id, auth.uid()), (thread_id, target_user_id)
  on conflict (thread_id, user_id) do nothing;

  return thread_id;
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
  thread_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_event_chat_member(target_quest_id, auth.uid()) then
    raise exception 'event_chat_requires_host_or_attendee';
  end if;

  select id
  into thread_id
  from message_threads
  where kind = 'event'
    and quest_id = target_quest_id
  limit 1;

  if thread_id is null then
    insert into message_threads (kind, quest_id, created_by)
    values ('event', target_quest_id, auth.uid())
    on conflict do nothing
    returning id into thread_id;

    if thread_id is null then
      select id
      into thread_id
      from message_threads
      where kind = 'event'
        and quest_id = target_quest_id
      limit 1;
    end if;
  end if;

  perform public.sync_event_thread_participants(thread_id, target_quest_id);

  return thread_id;
end;
$$;

revoke all on function public.get_or_create_event_thread(uuid) from public;
grant execute on function public.get_or_create_event_thread(uuid) to authenticated;

create or replace function public.can_view_quest(target_quest_id uuid)
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
      and (
        quests.creator_id = auth.uid()
        or (
          quests.visibility = 'local'
          and quests.area = public.current_user_area()
        )
        or (
          quests.visibility = 'friends'
          and public.are_friends(auth.uid(), quests.creator_id)
        )
        or exists (
          select 1
          from quest_joins
          where quest_joins.quest_id = quests.id
            and quest_joins.user_id = auth.uid()
        )
        or exists (
          select 1
          from quest_invites
          where quest_invites.quest_id = quests.id
            and quest_invites.invitee_id = auth.uid()
            and quest_invites.status <> 'declined'
        )
      )
  );
$$;

revoke all on function public.can_view_quest(uuid) from public;
grant execute on function public.can_view_quest(uuid) to authenticated;

drop policy if exists "same area read profiles" on profiles;
drop policy if exists "authenticated read profiles" on profiles;
create policy "authenticated read profiles"
  on profiles for select
  to authenticated
  using (true);

drop policy if exists "users manage own profile" on profiles;
create policy "users manage own profile"
  on profiles for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "same area read quests" on quests;
drop policy if exists "authenticated read quests" on quests;
drop policy if exists "visible read quests" on quests;
create policy "visible read quests"
  on quests for select
  to authenticated
  using (public.can_view_quest(id));

drop policy if exists "authenticated create quests" on quests;
create policy "authenticated create quests"
  on quests for insert
  to authenticated
  with check (
    auth.uid() = creator_id
    and status = 'open'
    and area = public.current_user_area()
    and visibility in ('invite_only', 'friends', 'local')
  );

drop policy if exists "hosts update their quests" on quests;
create policy "hosts update their quests"
  on quests for update
  to authenticated
  using (auth.uid() = creator_id)
  with check (
    auth.uid() = creator_id
    and visibility in ('invite_only', 'friends', 'local')
  );

drop policy if exists "same area read joins" on quest_joins;
drop policy if exists "authenticated read joins" on quest_joins;
drop policy if exists "visible read joins" on quest_joins;
create policy "visible read joins"
  on quest_joins for select
  to authenticated
  using (public.can_view_quest(quest_id));

drop policy if exists "joins created through atomic rpc" on quest_joins;
create policy "joins created through atomic rpc"
  on quest_joins for insert
  to authenticated
  with check (false);

drop policy if exists "users delete their joins" on quest_joins;
create policy "users delete their joins"
  on quest_joins for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users read their friendships" on friendships;
create policy "users read their friendships"
  on friendships for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "users create friend requests" on friendships;
create policy "users create friend requests"
  on friendships for insert
  to authenticated
  with check (
    auth.uid() = requester_id
    and requester_id <> addressee_id
    and status = 'pending'
  );

drop policy if exists "addressees update friend requests" on friendships;
create policy "addressees update friend requests"
  on friendships for update
  to authenticated
  using (
    auth.uid() = addressee_id
    and status = 'pending'
  )
  with check (
    auth.uid() = addressee_id
    and status in ('accepted', 'declined')
  );

drop policy if exists "users remove their friendships" on friendships;
create policy "users remove their friendships"
  on friendships for delete
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "users read relevant invites" on quest_invites;
create policy "users read relevant invites"
  on quest_invites for select
  to authenticated
  using (
    auth.uid() = invitee_id
    or exists (
      select 1
      from quests
      where quests.id = quest_invites.quest_id
        and quests.creator_id = auth.uid()
    )
  );

drop policy if exists "hosts create quest invites" on quest_invites;
create policy "hosts create quest invites"
  on quest_invites for insert
  to authenticated
  with check (
    auth.uid() = inviter_id
    and inviter_id <> invitee_id
    and exists (
      select 1
      from quests
      where quests.id = quest_invites.quest_id
        and quests.creator_id = auth.uid()
    )
  );

drop policy if exists "invitees update own quest invites" on quest_invites;
create policy "invitees update own quest invites"
  on quest_invites for update
  to authenticated
  using (
    auth.uid() = invitee_id
    or exists (
      select 1
      from quests
      where quests.id = quest_invites.quest_id
        and quests.creator_id = auth.uid()
    )
  )
  with check (
    auth.uid() = invitee_id
    or exists (
      select 1
      from quests
      where quests.id = quest_invites.quest_id
        and quests.creator_id = auth.uid()
    )
  );

drop policy if exists "hosts remove quest invites" on quest_invites;
create policy "hosts remove quest invites"
  on quest_invites for delete
  to authenticated
  using (
    auth.uid() = invitee_id
    or exists (
      select 1
      from quests
      where quests.id = quest_invites.quest_id
        and quests.creator_id = auth.uid()
    )
  );

drop policy if exists "users read visible quest share links" on quest_share_links;
create policy "users read visible quest share links"
  on quest_share_links for select
  to authenticated
  using (public.can_view_quest(quest_id));

drop policy if exists "hosts revoke quest share links" on quest_share_links;
create policy "hosts revoke quest share links"
  on quest_share_links for update
  to authenticated
  using (
    exists (
      select 1
      from quests
      where quests.id = quest_share_links.quest_id
        and quests.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from quests
      where quests.id = quest_share_links.quest_id
        and quests.creator_id = auth.uid()
    )
  );

create or replace function public.join_quest_atomic(target_quest_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quest quests%rowtype;
  join_count integer;
  actor_name text;
begin
  select *
  into target_quest
  from quests
  where id = target_quest_id
    and public.can_view_quest(id)
  for update;

  if not found then
    raise exception 'event_not_found';
  end if;

  if target_quest.status <> 'open' then
    raise exception 'event_closed';
  end if;

  if target_quest.creator_id = auth.uid() then
    raise exception 'host_cannot_join';
  end if;

  if exists (
    select 1
    from quest_joins
    where quest_id = target_quest_id
      and user_id = auth.uid()
  ) then
    return 'already_joined';
  end if;

  select count(*)::integer
  into join_count
  from quest_joins
  where quest_id = target_quest_id;

  if 1 + join_count >= coalesce(target_quest.max_people, 4) then
    raise exception 'event_full';
  end if;

  insert into quest_joins (quest_id, user_id)
  values (target_quest_id, auth.uid());

  update quest_invites
  set status = 'accepted',
    updated_at = now()
  where quest_id = target_quest_id
    and invitee_id = auth.uid();

  select coalesce(display_name, 'Someone')
  into actor_name
  from profiles
  where id = auth.uid();

  insert into activity_events (user_id, actor_id, quest_id, type, title)
  values (
    target_quest.creator_id,
    auth.uid(),
    target_quest_id,
    'join',
    actor_name || ' joined ' || target_quest.title
  );

  return 'joined';
exception
  when unique_violation then
    return 'already_joined';
end;
$$;

revoke all on function public.join_quest_atomic(uuid) from public;
grant execute on function public.join_quest_atomic(uuid) to authenticated;

create or replace function public.create_quest_share_link(target_quest_id uuid)
returns table(token text, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quest quests%rowtype;
  existing_token text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to share this event.';
  end if;

  select *
  into target_quest
  from quests
  where id = target_quest_id;

  if not found then
    raise exception 'Event not found.';
  end if;

  if not public.can_view_quest(target_quest_id) then
    raise exception 'You cannot share this event.';
  end if;

  select quest_share_links.token
  into existing_token
  from quest_share_links
  where quest_share_links.quest_id = target_quest_id
    and quest_share_links.revoked_at is null
  order by quest_share_links.created_at asc
  limit 1;

  if existing_token is not null then
    return query select existing_token, false;
    return;
  end if;

  if target_quest.visibility <> 'local'
     and target_quest.creator_id is distinct from auth.uid() then
    raise exception 'Only the host can enable public sharing for this private event.';
  end if;

  insert into quest_share_links (quest_id, created_by)
  values (target_quest_id, auth.uid())
  returning quest_share_links.token into existing_token;

  return query select existing_token, true;
end;
$$;

revoke all on function public.create_quest_share_link(uuid) from public;
grant execute on function public.create_quest_share_link(uuid) to authenticated;

create or replace function public.get_public_quest_share(share_token text)
returns table(
  token text,
  quest_id uuid,
  title text,
  category text,
  location text,
  start_time timestamp,
  description text,
  card_image_url text,
  visibility text,
  status text,
  host_display_name text,
  host_handle text,
  going_count bigint,
  max_people int,
  created_at timestamp
)
language sql
stable
security definer
set search_path = public
as $$
  select
    quest_share_links.token,
    quests.id as quest_id,
    quests.title,
    quests.category,
    quests.location,
    quests.start_time,
    quests.description,
    quests.card_image_url,
    quests.visibility,
    quests.status,
    profiles.display_name as host_display_name,
    profiles.handle as host_handle,
    (
      select count(*)
      from quest_joins
      where quest_joins.quest_id = quests.id
    ) as going_count,
    quests.max_people,
    quest_share_links.created_at
  from quest_share_links
  join quests on quests.id = quest_share_links.quest_id
  left join profiles on profiles.id = quests.creator_id
  where quest_share_links.token = btrim(share_token)
    and quest_share_links.revoked_at is null
  limit 1;
$$;

revoke all on function public.get_public_quest_share(text) from public;
grant execute on function public.get_public_quest_share(text) to anon, authenticated;

create or replace function public.record_quest_update_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_type text;
  activity_title text;
begin
  if auth.uid() is null or old.creator_id <> auth.uid() then
    return new;
  end if;

  if old.status is distinct from new.status and new.status = 'closed' then
    activity_type := 'close';
    activity_title := new.title || ' was closed';
  elsif old.title is distinct from new.title
    or old.category is distinct from new.category
    or old.location is distinct from new.location
    or old.start_time is distinct from new.start_time
    or old.description is distinct from new.description
    or old.card_image_url is distinct from new.card_image_url
    or old.max_people is distinct from new.max_people then
    activity_type := 'edit';
    activity_title := new.title || ' was updated';
  else
    return new;
  end if;

  insert into activity_events (user_id, actor_id, quest_id, type, title)
  select quest_joins.user_id, auth.uid(), new.id, activity_type, activity_title
  from quest_joins
  where quest_joins.quest_id = new.id
    and quest_joins.user_id <> auth.uid();

  return new;
end;
$$;

drop trigger if exists quest_update_activity_trigger on quests;
create trigger quest_update_activity_trigger
  after update on quests
  for each row
  execute function public.record_quest_update_activity();

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

-- No static seed rows after auth migration.
-- Profiles are created on first sign-in via app logic.
