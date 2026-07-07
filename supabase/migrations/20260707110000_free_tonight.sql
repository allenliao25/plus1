-- "Free tonight" availability signal — the demand-side half of the app.
--
-- One tap says you're free tonight; accepted friends (minus blocked pairs) see
-- it and can tap "me too". Going free inserts one 'friend_free' activity_event
-- per friend, which rides the existing notify_push pipeline (activity insert →
-- edge function → APNs), so friends get a push with no new delivery code.
--
-- One row per user (pk = user_id); setting again upserts. Auto-expiry lives in
-- expires_at (clients read only unexpired rows) — no cron needed to clean up.

create table if not exists availability (
  user_id uuid primary key references profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists availability_expires_at_idx
  on availability (expires_at);

alter table availability enable row level security;

-- Read: your own row, plus accepted friends' rows (excluding blocked pairs).
drop policy if exists "users read own and friends availability" on availability;
create policy "users read own and friends availability"
  on availability for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      public.are_friends(auth.uid(), user_id)
      and not public.are_blocked(auth.uid(), user_id)
    )
  );

-- Write: own row only. (The RPC below is the normal path — it also fans out
-- notifications — but a direct upsert/delete is scoped to the caller either way.)
drop policy if exists "users insert own availability" on availability;
create policy "users insert own availability"
  on availability for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users update own availability" on availability;
create policy "users update own availability"
  on availability for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users delete own availability" on availability;
create policy "users delete own availability"
  on availability for delete
  to authenticated
  using (user_id = auth.uid());

-- set_free_tonight(until): upsert the caller's availability and, on a fresh
-- go-free (no existing unexpired row), notify every friend.
--
-- `until` comes from the client (which knows the user's local "4am next
-- occurrence"); the server clamps it to [now()+30min, now()+18h] so a bad or
-- stale client value can't set an absurd window. Extending an already-active
-- row updates expires_at but does NOT re-blast friends (dedup on the prior
-- unexpired row), so tapping again to push the time out stays quiet.
--
-- SECURITY DEFINER because the per-friend activity_events inserts must bypass
-- the actor-scoped insert policy (actor is the caller, recipients are friends).
-- The notification fan-out is exception-guarded so a notify hiccup never rolls
-- back the availability write — same pattern as the reminders/push helpers.
create or replace function public.set_free_tonight(until timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  clamped_expires timestamptz;
  had_active boolean;
  caller_name text;
begin
  if caller is null then
    raise exception 'not_authenticated';
  end if;

  -- Clamp: min 30 minutes out, max 18 hours out.
  clamped_expires := least(
    greatest(until, now() + interval '30 minutes'),
    now() + interval '18 hours'
  );

  -- Fresh go-free only if there is no current, unexpired row.
  select exists (
    select 1 from availability
    where user_id = caller and expires_at > now()
  ) into had_active;

  insert into availability (user_id, expires_at)
  values (caller, clamped_expires)
  on conflict (user_id)
  do update set expires_at = excluded.expires_at, created_at = now();

  if had_active then
    return;
  end if;

  begin
    select coalesce(display_name, 'Someone') into caller_name
    from profiles where id = caller;

    insert into activity_events (user_id, actor_id, quest_id, type, title, body)
    select
      f.friend_id,
      caller,
      null,
      'friend_free',
      caller_name || ' is free tonight',
      'Tap to say you''re free too'
    from (
      select
        case when requester_id = caller then addressee_id else requester_id end
          as friend_id
      from friendships
      where status = 'accepted'
        and (requester_id = caller or addressee_id = caller)
    ) f
    where not public.are_blocked(caller, f.friend_id);
  exception
    when others then
      -- Never roll back the availability write on a notification failure.
      null;
  end;
end;
$$;

revoke all on function public.set_free_tonight(timestamptz) from public;
revoke all on function public.set_free_tonight(timestamptz) from anon;
grant execute on function public.set_free_tonight(timestamptz) to authenticated;

-- clear_free_tonight(): delete the caller's own availability row.
create or replace function public.clear_free_tonight()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from availability where user_id = auth.uid();
end;
$$;

revoke all on function public.clear_free_tonight() from public;
revoke all on function public.clear_free_tonight() from anon;
grant execute on function public.clear_free_tonight() to authenticated;
