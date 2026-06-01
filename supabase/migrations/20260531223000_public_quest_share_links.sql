-- Public event share links used for Open Graph previews and signed-out landing pages.

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

create unique index if not exists quest_share_links_token_unique
  on quest_share_links (token);

create unique index if not exists quest_share_links_active_quest_id_unique
  on quest_share_links (quest_id)
  where revoked_at is null;

create index if not exists quest_share_links_quest_id_idx
  on quest_share_links (quest_id);

create index if not exists quest_share_links_created_by_idx
  on quest_share_links (created_by);

alter table quest_share_links enable row level security;

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
