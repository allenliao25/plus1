-- Server-side block enforcement.
--
-- `user_blocks` already exists (RLS: a user manages rows where blocker_id =
-- auth.uid()). Until now blocking was enforced ONLY client-side, so a blocked
-- user could still, via the raw API, see the blocker's events, join them, send
-- friend requests, and open/receive DMs. This migration adds server-side teeth:
-- a block in EITHER direction now hides the blocker's discoverable events from
-- the blocked user, makes joins fail as if the event were closed, rejects friend
-- requests, and prevents opening/receiving direct messages between the pair.
--
-- The check is symmetric (either direction blocks) and deliberately opaque —
-- blocked flows fail the same way normal "closed" / "not found" flows do, so we
-- never reveal to the blocked user that a block exists, nor in which direction.

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

-- can_view_quest: the creator branch is untouched (a host always sees their own
-- event). Every OTHER visibility branch — local-area, friends-of, joined, and
-- invited — is now gated on the caller and the creator not being a blocked pair.
-- The quests / quest_joins / quest_share_links select policies all funnel through
-- this function, so patching it here covers every cross-user quest read path;
-- no policy inlines visibility logic separately.
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

-- join_quest_atomic: reject a join between a blocked pair with the SAME error
-- as a closed event, so a blocked user can't distinguish a block from a normal
-- closure. In practice the can_view_quest gate above (now block-aware on every
-- non-creator branch) already makes the SELECT ... for update find no row, so a
-- blocked caller hits 'event_not_found' first — equally opaque. This guard is
-- belt-and-suspenders: if the view gate is ever loosened, the join still fails
-- closed for a blocked pair.
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

-- Friend requests: a blocked pair (either direction) can no longer send a
-- friend request. The requester is auth.uid(); the "other user" is addressee_id.
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

-- Direct threads: opening (or resurfacing) a 1:1 thread with a blocked
-- counterpart fails with a generic error ('Could not start conversation.'),
-- indistinguishable from any other failure to start a chat.
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
revoke all on function public.get_or_create_direct_thread(uuid) from anon;
grant execute on function public.get_or_create_direct_thread(uuid) to authenticated;

-- Direct-thread messages: block the send path too, so that even if a direct
-- thread already exists (created before the block), neither party can post to
-- the other once a block is in place. The guard fires only for 2-person direct
-- threads: it checks the OTHER participant against the sender. Event/group
-- threads are exempt by design — a block should not silently mute a shared
-- event chat, and those threads have no single "counterpart".
--
-- Implemented as an insert-policy predicate via a SECURITY DEFINER helper
-- (rather than inlining a correlated subquery in the policy) so the existing
-- "users send accessible messages" check stays readable and the block lookup
-- runs past message_thread_participants RLS.
create or replace function public.direct_thread_send_allowed(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- True unless this is a direct thread whose other participant is in a
  -- blocked pair with the caller. Non-direct threads are always allowed here.
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
