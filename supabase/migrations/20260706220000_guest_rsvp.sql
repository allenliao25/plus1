-- Guest RSVP on shared event links (the growth loop).
-- A non-user who receives a share link can RSVP with just a first name — no
-- account, no OTP. Guests are stored in a dedicated table (they have no
-- profile row, so they can't live in quest_joins which FKs profiles).
--
-- Security model: the table is RLS-locked with no direct DML; all writes go
-- through SECURITY DEFINER RPCs callable by anon. The RPCs re-resolve the
-- share token, re-check quest state, lock the quest row, and enforce both the
-- real capacity (host + authed joins + guests) and a per-quest guest cap
-- (abuse valve). A random claim_token lets a guest cancel later.

create table if not exists quest_guest_joins (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references quests(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  claim_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamp default now()
);

create index if not exists quest_guest_joins_quest_id_idx
  on quest_guest_joins (quest_id);

alter table quest_guest_joins enable row level security;

-- Readable by anyone who can see the quest (host + attendees see the guest
-- list). No direct insert/update/delete — RPC-only, mirroring quest_joins.
drop policy if exists "visible read guest joins" on quest_guest_joins;
create policy "visible read guest joins"
  on quest_guest_joins for select
  to authenticated
  using (public.can_view_quest(quest_id));

drop policy if exists "guest joins created through rpc" on quest_guest_joins;
create policy "guest joins created through rpc"
  on quest_guest_joins for insert
  to authenticated, anon
  with check (false);

drop policy if exists "guest joins updated through rpc" on quest_guest_joins;
create policy "guest joins updated through rpc"
  on quest_guest_joins for update
  to authenticated, anon
  using (false);

drop policy if exists "guest joins deleted through rpc" on quest_guest_joins;
create policy "guest joins deleted through rpc"
  on quest_guest_joins for delete
  to authenticated, anon
  using (false);

-- Per-quest guest cap: an abuse valve independent of max_people so an open
-- share link can't be spammed into thousands of fake guest rows.
create or replace function public.quest_guest_cap()
returns integer
language sql
immutable
as $$ select 20 $$;

-- Anon-callable guest RSVP. Returns the claim_token (so the guest can cancel)
-- and the updated going count.
create or replace function public.guest_join_via_share(share_token text, guest_name text)
returns table(claim_token text, going_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quest quests%rowtype;
  clean_name text;
  join_count integer;
  guest_count integer;
  total_going integer;
  new_claim_token text;
begin
  clean_name := btrim(coalesce(guest_name, ''));

  if char_length(clean_name) < 1 then
    raise exception 'guest_name_required';
  end if;

  if char_length(clean_name) > 40 then
    clean_name := left(clean_name, 40);
  end if;

  -- Resolve an unrevoked share link -> quest, then lock the quest row so the
  -- capacity check below is race-safe against concurrent joins.
  select quests.*
  into target_quest
  from quest_share_links
  join quests on quests.id = quest_share_links.quest_id
  where quest_share_links.token = btrim(share_token)
    and quest_share_links.revoked_at is null
  limit 1
  for update of quests;

  if not found then
    raise exception 'share_unavailable';
  end if;

  if target_quest.status <> 'open' then
    raise exception 'event_closed';
  end if;

  -- Don't let guests RSVP to an event that already started.
  if target_quest.start_time is not null
     and target_quest.start_time < now() then
    raise exception 'event_started';
  end if;

  select count(*)::integer into join_count
  from quest_joins
  where quest_id = target_quest.id;

  select count(*)::integer into guest_count
  from quest_guest_joins
  where quest_id = target_quest.id;

  if guest_count >= public.quest_guest_cap() then
    raise exception 'guest_cap_reached';
  end if;

  -- Real capacity: host (1) + authed joins + existing guests.
  total_going := 1 + join_count + guest_count;

  if target_quest.max_people is not null
     and total_going >= target_quest.max_people then
    raise exception 'event_full';
  end if;

  insert into quest_guest_joins (quest_id, display_name)
  values (target_quest.id, clean_name)
  returning quest_guest_joins.claim_token into new_claim_token;

  -- Notify the host. Guarded so a feed-insert failure never rolls back the
  -- RSVP itself (mirrors the activity-insert intent in join_quest_atomic).
  begin
    insert into activity_events (user_id, actor_id, quest_id, type, title)
    values (
      target_quest.creator_id,
      null,
      target_quest.id,
      'join',
      clean_name || ' (guest) is in for ' || coalesce(target_quest.title, 'your event')
    );
  exception
    when others then null;
  end;

  return query select new_claim_token, (total_going + 1);
end;
$$;

revoke all on function public.guest_join_via_share(text, text) from public;
grant execute on function public.guest_join_via_share(text, text) to anon, authenticated;

-- Anon-callable cancel: a guest undoes their own RSVP via their claim_token.
create or replace function public.guest_cancel_via_token(claim_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from quest_guest_joins
  where quest_guest_joins.claim_token = btrim(guest_cancel_via_token.claim_token);

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

revoke all on function public.guest_cancel_via_token(text) from public;
grant execute on function public.guest_cancel_via_token(text) to anon, authenticated;

-- Fold guests into the public going count on the share page.
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
      1
      + (select count(*) from quest_joins where quest_joins.quest_id = quests.id)
      + (select count(*) from quest_guest_joins where quest_guest_joins.quest_id = quests.id)
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

-- Authed joins must also count guest rows against max_people, atomically.
create or replace function public.join_quest_atomic(target_quest_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quest quests%rowtype;
  join_count integer;
  guest_count integer;
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

  select count(*)::integer
  into guest_count
  from quest_guest_joins
  where quest_id = target_quest_id;

  if target_quest.max_people is not null
    and 1 + join_count + guest_count >= target_quest.max_people then
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
    actor_name || ' joined ' || coalesce(target_quest.title, 'your event')
  );

  return 'joined';
exception
  when unique_violation then
    return 'already_joined';
end;
$$;

revoke all on function public.join_quest_atomic(uuid) from public;
revoke execute on function public.join_quest_atomic(uuid) from anon;
grant execute on function public.join_quest_atomic(uuid) to authenticated;

-- The join-insert trigger guard must also see guests, or a burst of
-- authed inserts could still overshoot when guests fill the room.
create or replace function public.prevent_quest_join_over_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_max_people integer;
  join_count integer;
  guest_count integer;
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

  select count(*)::integer
  into guest_count
  from quest_guest_joins
  where quest_id = new.quest_id;

  if 1 + join_count + guest_count >= target_max_people then
    raise exception 'event_full';
  end if;

  return new;
end;
$$;

-- Capacity-underflow guard (host lowering max_people) must count guests too.
create or replace function public.prevent_quest_capacity_underflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  attendee_count integer;
begin
  if new.max_people is null then
    return new;
  end if;

  select (
    1
    + (select count(*) from quest_joins where quest_id = new.id)
    + (select count(*) from quest_guest_joins where quest_id = new.id)
  )::integer
  into attendee_count;

  if new.max_people < attendee_count then
    raise exception 'quest_capacity_below_attendance';
  end if;

  return new;
end;
$$;
