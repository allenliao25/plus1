-- Rename the local default visibility value away from the legacy campus term.

alter table quests
  add column if not exists visibility text not null default 'local';

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
