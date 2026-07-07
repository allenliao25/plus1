-- "Starting soon" reminders for event attendees.
--
-- Finds open quests whose start_time falls within the next ~65 minutes and
-- inserts one 'reminder' activity_event per attendee (quest_joins) and the
-- host. The activity_events insert trigger (notify_push) fans these out to the
-- push edge function → APNs, so inserting the rows is all that's needed for
-- delivery.
--
-- SECURITY DEFINER so the function can write reminders system-wide, bypassing
-- the actor-scoped RLS insert policy on activity_events. actor_id is set to the
-- quest creator (nullable column) so the row renders with a sensible actor.
--
-- Dedup: NOT EXISTS on an existing reminder for the same (user_id, quest_id)
-- guarantees each recipient is reminded at most once per event.

create or replace function public.send_event_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  with due_quests as (
    select id, creator_id, title, location
    from quests
    where status = 'open'
      and start_time is not null
      and start_time between now() and now() + interval '65 minutes'
  ),
  recipients as (
    -- Attendees.
    select q.id as quest_id, q.creator_id, q.title, q.location, j.user_id
    from due_quests q
    join quest_joins j on j.quest_id = q.id
    where j.user_id is not null
    union
    -- Host.
    select q.id as quest_id, q.creator_id, q.title, q.location, q.creator_id as user_id
    from due_quests q
    where q.creator_id is not null
  ),
  new_reminders as (
    insert into activity_events (user_id, actor_id, quest_id, type, title, body)
    select
      r.user_id,
      r.creator_id,
      r.quest_id,
      'reminder',
      'Starting soon',
      r.title || ' starts in about an hour — ' || r.location
    from recipients r
    where not exists (
      select 1
      from activity_events a
      where a.user_id = r.user_id
        and a.quest_id = r.quest_id
        and a.type = 'reminder'
    )
    returning 1
  )
  select count(*) into inserted_count from new_reminders;

  return inserted_count;
end;
$$;

revoke all on function public.send_event_reminders() from public;
revoke all on function public.send_event_reminders() from anon;
revoke all on function public.send_event_reminders() from authenticated;

-- Schedule every 5 minutes via pg_cron when available. On hosted Supabase,
-- enable pg_cron via Dashboard → Database → Extensions. The DO block is guarded
-- so this migration still applies on instances without pg_cron.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'send-event-reminders',
      '*/5 * * * *',
      $cron$select public.send_event_reminders();$cron$
    );
  else
    raise notice 'pg_cron not installed; send_event_reminders() was created but not scheduled. Enable pg_cron (Dashboard → Database → Extensions) and run cron.schedule(''send-event-reminders'', ''*/5 * * * *'', ''select public.send_event_reminders();'').';
  end if;
end;
$$;
