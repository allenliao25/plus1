-- plus1 ASAP events
-- Allow events to omit a scheduled time; the app displays those as ASAP.

alter table public.quests
  alter column start_time drop not null;
