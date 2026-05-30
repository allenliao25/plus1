-- plus1 profile bio + interests
-- Add editable profile fields surfaced on the Profile page.

alter table profiles
  add column if not exists bio text,
  add column if not exists interests text[] not null default '{}';
