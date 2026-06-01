-- plus1 course hardening: local area filtering, atomic joins, and reliable lifecycle activity

alter table profiles
  add column if not exists area text not null default 'Demo Area';

alter table quests
  add column if not exists area text not null default 'Demo Area';

update profiles
set area = 'Demo Area'
where area is null or btrim(area) = '';

update quests
set area = coalesce(
  (
    select profiles.area
    from profiles
    where profiles.id = quests.creator_id
  ),
  'Demo Area'
)
where area is null or btrim(area) = '' or area = 'Demo Area';

create index if not exists profiles_area_idx
  on profiles (area);

create index if not exists quests_area_status_start_time_idx
  on quests (area, status, start_time);

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

drop policy if exists "demo read profiles" on profiles;
drop policy if exists "same area read profiles" on profiles;
drop policy if exists "authenticated read profiles" on profiles;
create policy "authenticated read profiles"
  on profiles for select
  to authenticated
  using (true);

drop policy if exists "demo read quests" on quests;
drop policy if exists "same area read quests" on quests;
drop policy if exists "authenticated read quests" on quests;
create policy "authenticated read quests"
  on quests for select
  to authenticated
  using (true);

drop policy if exists "authenticated create quests" on quests;
create policy "authenticated create quests"
  on quests for insert
  to authenticated
  with check (
    auth.uid() = creator_id
    and status = 'open'
    and area = public.current_user_area()
  );

drop policy if exists "hosts update their quests" on quests;
create policy "hosts update their quests"
  on quests for update
  to authenticated
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

drop policy if exists "demo read joins" on quest_joins;
drop policy if exists "same area read joins" on quest_joins;
drop policy if exists "authenticated read joins" on quest_joins;
create policy "authenticated read joins"
  on quest_joins for select
  to authenticated
  using (true);

drop policy if exists "users create joins" on quest_joins;
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
    and area = public.current_user_area()
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
