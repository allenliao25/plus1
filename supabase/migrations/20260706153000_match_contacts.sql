-- Contact sync: privacy-preserving server-side phone matching.
-- The client uploads normalized E.164 phone numbers from the device address
-- book; the server returns only the profiles that match, excluding the caller.
-- Numbers are never stored and names never leave the device.

drop function if exists public.match_contacts(text[]);

create or replace function public.match_contacts(phones text[])
returns table (
  id uuid,
  display_name text,
  handle text,
  avatar_url text,
  avatar_initials text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if phones is null or array_length(phones, 1) is null then
    return;
  end if;

  -- Cap input so a caller can't probe the whole user base in one call.
  if array_length(phones, 1) > 2000 then
    raise exception 'too_many_phones';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.handle,
    p.avatar_url,
    p.avatar_initials
  from profiles p
  where p.phone = any(phones)
    and p.id <> auth.uid();
end;
$$;

-- Supabase's project-level default privileges auto-grant execute to anon on
-- every new function, so revoking from public alone leaves anon able to call
-- it. Revoke from both, then grant only to authenticated.
revoke all on function public.match_contacts(text[]) from public;
revoke all on function public.match_contacts(text[]) from anon;
grant execute on function public.match_contacts(text[]) to authenticated;
