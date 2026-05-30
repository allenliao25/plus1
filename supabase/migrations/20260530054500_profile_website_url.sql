-- plus1 profile website links
-- Add an optional public website URL for editable profile identity.

alter table profiles
  add column if not exists website_url text;
