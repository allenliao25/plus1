-- Revoke anon EXECUTE from authenticated-only RPCs.
-- Supabase's default privileges grant EXECUTE to anon on new functions;
-- these four all require auth.uid() and should never be callable with
-- just the anon key. get_public_quest_share intentionally keeps its anon
-- grant (the signed-out web share page /e/[token] depends on it), and
-- RLS helper predicates keep theirs (they run during anon policy checks).

revoke execute on function public.join_quest_atomic(uuid) from anon;
revoke execute on function public.get_or_create_direct_thread(uuid) from anon;
revoke execute on function public.get_or_create_event_thread(uuid) from anon;
revoke execute on function public.create_quest_share_link(uuid) from anon;
