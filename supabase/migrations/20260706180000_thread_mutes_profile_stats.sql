-- Per-thread mute + public profile stats.
--
-- 1. message_thread_participants.muted_at: a participant may silence a thread.
--    UTC-naive timestamp to match the rest of the schema. The existing
--    "users update own message read state" UPDATE policy is already scoped to
--    `user_id = auth.uid()`, so it covers setting/clearing muted_at on the
--    caller's own row — no new policy required.
--
-- 2. public.profile_stats(target_id): hosted / joined / friends counts for a
--    public profile header. SECURITY DEFINER so it can count past RLS, but it
--    requires an authenticated caller and returns plain aggregate counts only.

alter table message_thread_participants
  add column if not exists muted_at timestamp;

create or replace function public.profile_stats(target_id uuid)
returns table (hosted int, joined int, friends int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from quests q where q.creator_id = target_id)::int as hosted,
    (select count(*) from quest_joins j where j.user_id = target_id)::int as joined,
    (
      select count(*)
      from friendships f
      where f.status = 'accepted'
        and (f.requester_id = target_id or f.addressee_id = target_id)
    )::int as friends
  where auth.uid() is not null;
$$;

revoke all on function public.profile_stats(uuid) from public;
revoke all on function public.profile_stats(uuid) from anon;
grant execute on function public.profile_stats(uuid) to authenticated;
