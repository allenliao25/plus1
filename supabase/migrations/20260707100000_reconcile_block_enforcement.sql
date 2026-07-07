-- Reconcile block enforcement: re-assert the wave's superseding definitions.
--
-- Context: the wave's block-enforcement (20260706190000) and guest-RSVP
-- (20260706220000) migrations were authored to supersede the older
-- 20260707090000_block_enforcement.sql, but that file landed on main via a
-- parallel PR AFTER this branch was cut, so it now has a LATER timestamp and
-- runs last on a fresh apply — clobbering the newer are_blocked()-based
-- can_view_quest / get_or_create_direct_thread, the guest-aware
-- join_quest_atomic (capacity must count guest rows), and the friendships /
-- messages policies. This migration re-applies the intended final versions so
-- the migration set converges to schema.sql. Idempotent (create or replace).

-- can_view_quest (are_blocked-based).
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
      and not public.are_blocked(auth.uid(), quests.creator_id)
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

-- get_or_create_direct_thread (are_blocked-based).
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

  if public.are_blocked(auth.uid(), target_user_id) then
    raise exception 'cannot_message_blocked_user';
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

-- join_quest_atomic (guest-aware capacity).
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

-- Friend requests: block-guarded via are_blocked().
drop policy if exists "users create friend requests" on friendships;
create policy "users create friend requests"
  on friendships for insert
  to authenticated
  with check (
    auth.uid() = requester_id
    and requester_id <> addressee_id
    and status = 'pending'
    and not public.are_blocked(auth.uid(), addressee_id)
  );

-- Messages send policy: block enforcement folded into can_access_message_thread
-- (no direct_thread_send_allowed dependency in the wave design).
drop policy if exists "users send accessible messages" on messages;
create policy "users send accessible messages"
  on messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.can_access_message_thread(thread_id, auth.uid())
    and char_length(trim(body)) between 1 and 1000
  );

revoke execute on function public.join_quest_atomic(uuid) from anon;
revoke execute on function public.get_or_create_direct_thread(uuid) from anon;

-- Drop the superseded helpers 20260707090000 created but the wave design no
-- longer references, so the migration set matches schema.sql (which never
-- declares them). Both are now unreferenced after the redefinitions above.
drop function if exists public.direct_thread_send_allowed(uuid);
drop function if exists public.is_blocked_pair(uuid, uuid);
