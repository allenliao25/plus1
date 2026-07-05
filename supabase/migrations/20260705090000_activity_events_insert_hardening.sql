-- Harden activity_events inserts: an actor may only write into another user's
-- feed when that recipient is themself, an invitee of the actor on the quest,
-- or has a pending/accepted friendship with the actor.

create or replace function public.can_send_activity_to(recipient_id uuid, target_quest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
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
    );
$$;

revoke all on function public.can_send_activity_to(uuid, uuid) from public;
grant execute on function public.can_send_activity_to(uuid, uuid) to authenticated;

drop policy if exists "actors create activity" on activity_events;
create policy "actors create activity"
  on activity_events for insert
  to authenticated
  with check (
    auth.uid() = actor_id
    and public.can_send_activity_to(user_id, quest_id)
  );

create index if not exists quest_joins_user_id_idx
  on quest_joins (user_id);
