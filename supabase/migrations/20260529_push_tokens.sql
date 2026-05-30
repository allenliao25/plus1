-- plus1 push tokens table for APNs/FCM bridge
-- Supports Tier 2 push notifications when app is backgrounded or closed.

create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create unique index if not exists push_tokens_user_id_token_unique
  on push_tokens (user_id, token);

alter table push_tokens enable row level security;

drop policy if exists "users read own push tokens" on push_tokens;
create policy "users read own push tokens"
  on push_tokens for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users create own push tokens" on push_tokens;
create policy "users create own push tokens"
  on push_tokens for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users update own push tokens" on push_tokens;
create policy "users update own push tokens"
  on push_tokens for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users delete own push tokens" on push_tokens;
create policy "users delete own push tokens"
  on push_tokens for delete
  to authenticated
  using (auth.uid() = user_id);
