-- App Store compliance backend: user reports, user blocks, and full account deletion.
-- Supports Apple UGC guideline 1.2 (report/block) and guideline 5.1.1(v) (account deletion).

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_kind text not null check (target_kind in ('quest', 'message', 'profile')),
  target_id uuid not null,
  reason text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists reports_created_at_idx
  on reports (created_at desc);

create table if not exists user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_id_idx
  on user_blocks (blocked_id);

alter table reports enable row level security;
alter table user_blocks enable row level security;

-- Reports are write-only for regular users; the moderation team reads them via the
-- Supabase dashboard (service role bypasses RLS). No select/update/delete policies.
drop policy if exists "users create own reports" on reports;
create policy "users create own reports"
  on reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "users read own blocks" on user_blocks;
create policy "users read own blocks"
  on user_blocks for select
  to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "users create own blocks" on user_blocks;
create policy "users create own blocks"
  on user_blocks for insert
  to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists "users remove own blocks" on user_blocks;
create policy "users remove own blocks"
  on user_blocks for delete
  to authenticated
  using (blocker_id = auth.uid());

-- Full account deletion for App Store guideline 5.1.1(v).
-- Deleting auth.users cascades to profiles (on delete cascade), which in turn
-- cascades to quest_joins, friendships, quest_invites, quest_share_links,
-- push_tokens, activity_events (user_id), message_thread_participants, and
-- messages. Two profile references have NO cascade action and would otherwise
-- block the delete, so they are cleared explicitly first:
--   * quests.creator_id -> profiles(id)         (deleting the quest cascades to
--     its joins, invites, share links, and event threads)
--   * activity_events.actor_id -> profiles(id)
-- message_threads.created_by is on delete set null, so it needs no handling.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user uuid := auth.uid();
begin
  if target_user is null then
    raise exception 'not_authenticated';
  end if;

  -- Clear references that do not cascade from profiles.
  delete from quests where creator_id = target_user;
  delete from activity_events where actor_id = target_user;

  -- Cascades through profiles to all remaining user-owned rows.
  delete from auth.users where id = target_user;
end;
$$;

revoke all on function public.delete_account() from public;
revoke all on function public.delete_account() from anon;
grant execute on function public.delete_account() to authenticated;
