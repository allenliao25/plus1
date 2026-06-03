update quests
set max_people = attendance.going_count
from (
  select quests.id, (1 + count(quest_joins.user_id))::integer as going_count
  from quests
  left join quest_joins on quest_joins.quest_id = quests.id
  group by quests.id
) as attendance
where quests.id = attendance.id
  and coalesce(quests.max_people, 4) < attendance.going_count;

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

  if coalesce(new.max_people, 4) < attendee_count then
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
  select coalesce(max_people, 4)
  into target_max_people
  from quests
  where id = new.quest_id
  for update;

  if not found then
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
