-- Enforce user_blocks across the app. The table exists with self-management RLS,
-- but no predicate consulted it, so blocked users could still see each other's
-- quests, DM each other, and exchange activity events. This adds a symmetric
-- are_blocked() helper and wires it into the SECURITY DEFINER predicates so a
-- block hides content in BOTH directions (blocker->blocked and blocked->blocker).
--
-- Event chat membership is intentionally left untouched: a block does not eject
-- someone from an event thread they already belong to. What blocks prevent is
-- viewing the other party's quests (so they can't discover/join new ones), the
-- creation of new direct threads, and activity events between the pair.

create or replace function public.are_blocked(left_user_id uuid, right_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_blocks
    where (user_blocks.blocker_id = left_user_id and user_blocks.blocked_id = right_user_id)
       or (user_blocks.blocker_id = right_user_id and user_blocks.blocked_id = left_user_id)
  );
$$;

revoke all on function public.are_blocked(uuid, uuid) from public;
grant execute on function public.are_blocked(uuid, uuid) to authenticated;

-- can_view_quest: a user cannot view a quest whose creator has a block
-- relationship with them (either direction).
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

-- can_send_activity_to: no activity events between blocked pairs.
create or replace function public.can_send_activity_to(recipient_id uuid, target_quest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not public.are_blocked(auth.uid(), recipient_id)
    and (
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
      )
    );
$$;

revoke all on function public.can_send_activity_to(uuid, uuid) from public;
grant execute on function public.can_send_activity_to(uuid, uuid) to authenticated;

-- can_access_message_thread: a blocked pair cannot access a shared DIRECT thread.
-- Event threads keep the simple membership check so a block doesn't break event
-- chat someone is already part of.
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
          and not exists (
            select 1
            from message_thread_participants other
            where other.thread_id = message_threads.id
              and other.user_id <> target_user_id
              and public.are_blocked(target_user_id, other.user_id)
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

-- get_or_create_direct_thread: blocked pairs cannot start a new DM.
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
revoke execute on function public.get_or_create_direct_thread(uuid) from anon;
grant execute on function public.get_or_create_direct_thread(uuid) to authenticated;

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
    and not public.are_blocked(auth.uid(), addressee_id)
  );
