-- Cap report details length and extend account deletion to purge storage objects.
-- Client mirrors the 2000-char cap in ReportSheet; this is the server guardrail.

-- The reports table is new/empty, so no backfill guard is needed for the check.
alter table reports
  add constraint reports_details_length check (char_length(details) <= 2000);

-- Extend delete_account() to ALSO remove the user's storage objects (profile
-- photos and quest card covers) before deleting the auth user. Objects are
-- stored under a "<userId>/..." prefix, matching the foldername() convention in
-- 20260530061000_quest_card_images.sql. search_path adds the storage schema so
-- storage.objects / storage.foldername resolve unqualified.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  target_user uuid := auth.uid();
begin
  if target_user is null then
    raise exception 'not_authenticated';
  end if;

  -- Purge the user's uploaded storage objects (no cascade from auth.users).
  delete from storage.objects
  where bucket_id in ('profile-photos', 'quest-card-images')
    and (storage.foldername(name))[1] = target_user::text;

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
