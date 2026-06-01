-- plus1 private/friends/local event visibility and direct invites

alter table quests
  add column if not exists visibility text not null default 'local';

alter table profiles
  add column if not exists area text not null default 'Demo Area';

alter table quests
  add column if not exists area text not null default 'Demo Area';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'campus'
  ) then
    execute $sql$
      update profiles
      set area = campus
      where campus is not null
        and btrim(campus) <> ''
        and (area is null or area = 'Demo Area')
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'quests'
      and column_name = 'campus'
  ) then
    execute $sql$
      update quests
      set area = campus
      where campus is not null
        and btrim(campus) <> ''
        and (area is null or area = 'Demo Area')
    $sql$;
  end if;
end $$;

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
where area is null or btrim(area) = '';

alter table quests
  drop constraint if exists quests_visibility_check;

update quests
set visibility = 'local'
where visibility = 'campus'
   or visibility is null
   or btrim(visibility) = '';

alter table quests
  alter column visibility set default 'local';

alter table quests
  add constraint quests_visibility_check
  check (visibility in ('invite_only', 'friends', 'local'));

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

create unique index if not exists friendships_user_pair_unique
  on friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create index if not exists friendships_requester_status_idx
  on friendships (requester_id, status);

create index if not exists friendships_addressee_status_idx
  on friendships (addressee_id, status);

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

create unique index if not exists quest_invites_quest_id_invitee_id_unique
  on quest_invites (quest_id, invitee_id);

create index if not exists quest_invites_invitee_status_idx
  on quest_invites (invitee_id, status);

create index if not exists quests_visibility_idx
  on quests (visibility);

create index if not exists profiles_area_idx
  on profiles (area);

create index if not exists quests_area_status_start_time_idx
  on quests (area, status, start_time);

alter table friendships enable row level security;
alter table quest_invites enable row level security;

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

drop policy if exists "authenticated read joins" on quest_joins;
drop policy if exists "visible read joins" on quest_joins;
create policy "visible read joins"
  on quest_joins for select
  to authenticated
  using (public.can_view_quest(quest_id));

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
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

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
