-- PL/pgSQL variable thread_id conflicted with message_thread_participants.thread_id
-- in ON CONFLICT, causing: column reference "thread_id" is ambiguous

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
