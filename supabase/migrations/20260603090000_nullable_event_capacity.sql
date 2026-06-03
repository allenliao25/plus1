alter table quests
  alter column max_people drop not null,
  alter column max_people drop default;

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
    actor_name || ' joined ' || coalesce(target_quest.title, 'your event')
  );

  return 'joined';
end;
$$;

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

  select (1 + count(*))::integer
  into attendee_count
  from quest_joins
  where quest_id = new.id;

  if new.max_people < attendee_count then
    raise exception 'quest_capacity_below_attendance';
  end if;

  return new;
end;
$$;

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
