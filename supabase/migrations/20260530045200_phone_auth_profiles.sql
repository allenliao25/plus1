-- plus1 phone auth profile fields
-- Add phone identity and profile updated_at support for phone OTP accounts.

alter table profiles
  add column if not exists phone text,
  add column if not exists updated_at timestamp default now();

create unique index if not exists profiles_phone_unique
  on profiles (phone)
  where phone is not null;
