-- Push token registration via SECURITY DEFINER RPC.
-- `push_tokens.token` has a standalone UNIQUE constraint, so a client-side
-- upsert with a composite (user_id, token) conflict target doesn't fire when a
-- second user signs in on a device whose token row still belongs to the first
-- user, and RLS blocks the second user from updating/deleting the first user's
-- row. This RPC deletes any existing row for the token (as the definer, past
-- RLS) then inserts a fresh row owned by the caller.

create or replace function public.register_push_token(target_token text, target_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if target_platform not in ('ios', 'android', 'web') then
    raise exception 'invalid_platform';
  end if;

  delete from push_tokens where token = target_token;

  insert into push_tokens (user_id, token, platform, updated_at)
  values (auth.uid(), target_token, target_platform, now());
end;
$$;

create or replace function public.unregister_push_token(target_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  delete from push_tokens
  where token = target_token
    and user_id = auth.uid();
end;
$$;

-- Supabase's project-level default privileges auto-grant execute to anon on
-- every new function, so revoking from public alone leaves anon able to call
-- it. Revoke from both, then grant only to authenticated.
revoke all on function public.register_push_token(text, text) from public;
revoke all on function public.register_push_token(text, text) from anon;
grant execute on function public.register_push_token(text, text) to authenticated;

revoke all on function public.unregister_push_token(text) from public;
revoke all on function public.unregister_push_token(text) from anon;
grant execute on function public.unregister_push_token(text) to authenticated;
