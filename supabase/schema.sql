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
  max_people int,
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
  muted_at timestamp,
  created_at timestamp default now(),
  primary key (thread_id, user_id)
);

alter table message_thread_participants
  add column if not exists muted_at timestamp;

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

create index if not exists quest_joins_user_id_idx
  on quest_joins (user_id);

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

create or replace function public.can_send_activity_to(recipient_id uuid, target_quest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    recipient_id = auth.uid()
    or exists (
      select 1
      from quest_invites
      where quest_invites.quest_id = target_quest_id
        and quest_invites.inviter_id = auth.uid()
        and quest_invites.invitee_id = recipient_id
    )
    or exists (
      select 1
      from friendships
      where friendships.status in ('pending', 'accepted')
        and (
          (friendships.requester_id = auth.uid() and friendships.addressee_id = recipient_id)
          or (friendships.requester_id = recipient_id and friendships.addressee_id = auth.uid())
        )
    );
$$;

revoke all on function public.can_send_activity_to(uuid, uuid) from public;
grant execute on function public.can_send_activity_to(uuid, uuid) to authenticated;

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

  if public.is_blocked_pair(auth.uid(), target_user_id) then
    raise exception 'Could not start conversation.';
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

-- Symmetric block test. SECURITY DEFINER because user_blocks RLS only exposes
-- the caller's own rows (blocker_id = auth.uid()); the check must see BOTH
-- directions without leaking which side placed the block.
create or replace function public.is_blocked_pair(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

revoke all on function public.is_blocked_pair(uuid, uuid) from public;
revoke all on function public.is_blocked_pair(uuid, uuid) from anon;
grant execute on function public.is_blocked_pair(uuid, uuid) to authenticated;

-- The creator branch is untouched (a host always sees their own event). Every
-- OTHER visibility branch is gated on the caller and creator not being a blocked
-- pair, so a block in either direction hides the blocker's discoverable events
-- from the blocked user across the quests / quest_joins / quest_share_links
-- select paths (all of which funnel through this function).
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
          not public.is_blocked_pair(auth.uid(), quests.creator_id)
          and (
            (
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
    and not public.is_blocked_pair(auth.uid(), addressee_id)
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

  if target_quest.status <> 'open'
    or public.is_blocked_pair(auth.uid(), target_quest.creator_id) then
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

  if target_quest.max_people is not null
    and 1 + join_count >= target_quest.max_people then
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
revoke all on function public.join_quest_atomic(uuid) from anon;
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

create or replace function public.prevent_quest_capacity_underflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  attendee_count integer;
begin
  select (1 + count(*))::integer
  into attendee_count
  from quest_joins
  where quest_id = new.id;

  if new.max_people is null then
    return new;
  end if;

  if new.max_people < attendee_count then
    raise exception 'quest_capacity_below_attendance';
  end if;

  return new;
end;
$$;

drop trigger if exists quest_capacity_underflow_guard on quests;
create trigger quest_capacity_underflow_guard
  before insert or update of max_people on quests
  for each row
  execute function public.prevent_quest_capacity_underflow();

create or replace function public.prevent_quest_join_over_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_max_people integer;
  join_count integer;
begin
  select max_people
  into target_max_people
  from quests
  where id = new.quest_id
  for update;

  if not found or target_max_people is null then
    return new;
  end if;

  select count(*)::integer
  into join_count
  from quest_joins
  where quest_id = new.quest_id;

  if 1 + join_count >= target_max_people then
    raise exception 'event_full';
  end if;

  return new;
end;
$$;

drop trigger if exists quest_join_capacity_guard on quest_joins;
create trigger quest_join_capacity_guard
  before insert on quest_joins
  for each row
  execute function public.prevent_quest_join_over_capacity();

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
  with check (
    auth.uid() = actor_id
    and public.can_send_activity_to(user_id, quest_id)
  );

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

-- Scoped to the caller's own participant row, so it also covers setting or
-- clearing muted_at (per-thread mute) — no separate mute policy is needed.
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

-- Direct-thread messages: block the send path too, so that even if a direct
-- thread already exists (created before a block), neither party can post to the
-- other once a block is in place. The guard fires only for 2-person direct
-- threads (checks the OTHER participant against the sender). Event/group threads
-- are exempt by design — a block should not silently mute a shared event chat.
create or replace function public.direct_thread_send_allowed(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from message_threads t
    join message_thread_participants other
      on other.thread_id = t.id
     and other.user_id <> auth.uid()
    where t.id = target_thread_id
      and t.kind = 'direct'
      and public.is_blocked_pair(auth.uid(), other.user_id)
  );
$$;

revoke all on function public.direct_thread_send_allowed(uuid) from public;
revoke all on function public.direct_thread_send_allowed(uuid) from anon;
grant execute on function public.direct_thread_send_allowed(uuid) to authenticated;

drop policy if exists "users send accessible messages" on messages;
create policy "users send accessible messages"
  on messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.can_access_message_thread(thread_id, auth.uid())
    and public.direct_thread_send_allowed(thread_id)
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

-- App Store compliance: user reports, user blocks, and full account deletion.
-- Supports Apple UGC guideline 1.2 (report/block) and guideline 5.1.1(v) (deletion).

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_kind text not null check (target_kind in ('quest', 'message', 'profile')),
  target_id uuid not null,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  constraint reports_details_length check (char_length(details) <= 2000)
);

create index if not exists reports_created_at_idx
  on reports (created_at desc);

create table if not exists user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_id_idx
  on user_blocks (blocked_id);

alter table reports enable row level security;
alter table user_blocks enable row level security;

drop policy if exists "users create own reports" on reports;
create policy "users create own reports"
  on reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "users read own blocks" on user_blocks;
create policy "users read own blocks"
  on user_blocks for select
  to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "users create own blocks" on user_blocks;
create policy "users create own blocks"
  on user_blocks for insert
  to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists "users remove own blocks" on user_blocks;
create policy "users remove own blocks"
  on user_blocks for delete
  to authenticated
  using (blocker_id = auth.uid());

-- Full account deletion. Deleting auth.users cascades to profiles, which cascades
-- to quest_joins, friendships, quest_invites, quest_share_links, push_tokens,
-- activity_events (user_id), message_thread_participants, and messages. The two
-- profile references without a cascade action (quests.creator_id and
-- activity_events.actor_id) are cleared first so the delete is not blocked.
-- message_threads.created_by is on delete set null and needs no handling.
-- The user's storage objects (profile photos, quest card covers) are purged
-- explicitly since auth.users does not cascade into storage.objects.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  target_user uuid := auth.uid();
begin
  if target_user is null then
    raise exception 'not_authenticated';
  end if;

  delete from storage.objects
  where bucket_id in ('profile-photos', 'quest-card-images')
    and (storage.foldername(name))[1] = target_user::text;

  delete from quests where creator_id = target_user;
  delete from activity_events where actor_id = target_user;

  delete from auth.users where id = target_user;
end;
$$;

revoke all on function public.delete_account() from public;
revoke all on function public.delete_account() from anon;
grant execute on function public.delete_account() to authenticated;

-- Server-side push pipeline: DB triggers that fan activity + message inserts
-- out to the `push` edge function via pg_net (async, non-blocking). The webhook
-- secret lives in Supabase Vault under 'push_webhook_secret'; absent it, the
-- trigger is dormant (returns NEW without posting). pg_net only enqueues the
-- HTTP post (delivery happens out-of-band) and the body is exception-guarded so
-- a Vault/enqueue error never rolls back the originating insert.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  webhook_secret text;
begin
  begin
    select decrypted_secret
    into webhook_secret
    from vault.decrypted_secrets
    where name = 'push_webhook_secret'
    limit 1;

    if webhook_secret is null then
      return new;
    end if;

    perform net.http_post(
      url := 'https://qjuiqeclnrvkyjnqltxq.supabase.co/functions/v1/push',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-push-secret', webhook_secret
      ),
      body := jsonb_build_object(
        'kind', TG_ARGV[0],
        'record', to_jsonb(new)
      )
    );
  exception
    when others then
      return new;
  end;

  return new;
end;
$$;

revoke all on function public.notify_push() from public;

drop trigger if exists activity_events_notify_push on public.activity_events;
create trigger activity_events_notify_push
  after insert on public.activity_events
  for each row
  execute function public.notify_push('activity');

drop trigger if exists messages_notify_push on public.messages;
create trigger messages_notify_push
  after insert on public.messages
  for each row
  execute function public.notify_push('message');


-- Contact sync: privacy-preserving server-side phone matching.
-- The client uploads normalized E.164 phone numbers from the device address
-- book; the server returns only the profiles that match, excluding the caller.
-- Numbers are never stored and names never leave the device.

drop function if exists public.match_contacts(text[]);

create or replace function public.match_contacts(phones text[])
returns table (
  id uuid,
  display_name text,
  handle text,
  avatar_url text,
  avatar_initials text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if phones is null or array_length(phones, 1) is null then
    return;
  end if;

  -- Cap input so a caller can't probe the whole user base in one call.
  if array_length(phones, 1) > 2000 then
    raise exception 'too_many_phones';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.handle,
    p.avatar_url,
    p.avatar_initials
  from profiles p
  where p.phone = any(phones)
    and p.id <> auth.uid();
end;
$$;

-- Supabase's project-level default privileges auto-grant execute to anon on
-- every new function, so revoking from public alone leaves anon able to call
-- it. Revoke from both, then grant only to authenticated.
revoke all on function public.match_contacts(text[]) from public;
revoke all on function public.match_contacts(text[]) from anon;
grant execute on function public.match_contacts(text[]) to authenticated;

-- Push token registration via SECURITY DEFINER RPC.
-- `push_tokens.token` has a standalone UNIQUE constraint, so a client-side
-- upsert with a composite (user_id, token) conflict target doesn't fire when a
-- second user signs in on a device whose token row still belongs to the first
-- user, and RLS blocks the second user from updating/deleting the first user's
-- row. This RPC deletes any existing row for the token (as the definer, past
-- RLS) then inserts a fresh row owned by the caller.

create or replace function public.register_push_token(target_token text, target_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if target_platform not in ('ios', 'android', 'web') then
    raise exception 'invalid_platform';
  end if;

  delete from push_tokens where token = target_token;

  insert into push_tokens (user_id, token, platform, updated_at)
  values (auth.uid(), target_token, target_platform, now());
end;
$$;

create or replace function public.unregister_push_token(target_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  delete from push_tokens
  where token = target_token
    and user_id = auth.uid();
end;
$$;

revoke all on function public.register_push_token(text, text) from public;
revoke all on function public.register_push_token(text, text) from anon;
grant execute on function public.register_push_token(text, text) to authenticated;

revoke all on function public.unregister_push_token(text) from public;
revoke all on function public.unregister_push_token(text) from anon;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Revoke anon EXECUTE from authenticated-only RPCs.
-- Supabase's default privileges grant EXECUTE to anon on new functions;
-- these four all require auth.uid() and should never be callable with
-- just the anon key. get_public_quest_share intentionally keeps its anon
-- grant (the signed-out web share page /e/[token] depends on it), and
-- RLS helper predicates keep theirs (they run during anon policy checks).

revoke execute on function public.join_quest_atomic(uuid) from anon;
revoke execute on function public.get_or_create_direct_thread(uuid) from anon;
revoke execute on function public.get_or_create_event_thread(uuid) from anon;
revoke execute on function public.create_quest_share_link(uuid) from anon;

-- Public profile stats: hosted / joined / friends counts for a profile header.
-- SECURITY DEFINER so it counts past RLS, but requires an authenticated caller
-- and returns plain aggregates only. anon/public EXECUTE explicitly revoked
-- (Supabase default-privileges grant EXECUTE to both on new functions).
create or replace function public.profile_stats(target_id uuid)
returns table (hosted int, joined int, friends int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from quests q where q.creator_id = target_id)::int as hosted,
    (select count(*) from quest_joins j where j.user_id = target_id)::int as joined,
    (
      select count(*)
      from friendships f
      where f.status = 'accepted'
        and (f.requester_id = target_id or f.addressee_id = target_id)
    )::int as friends
  where auth.uid() is not null;
$$;

revoke all on function public.profile_stats(uuid) from public;
revoke all on function public.profile_stats(uuid) from anon;
grant execute on function public.profile_stats(uuid) to authenticated;

-- No static seed rows after auth migration.
-- Profiles are created on first sign-in via app logic.
