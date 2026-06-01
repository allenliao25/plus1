-- Tighten mutual-friend request updates: only the recipient can resolve a
-- pending request, and only into an accepted or declined state.

drop policy if exists "addressees update friend requests" on friendships;
create policy "addressees update friend requests"
  on friendships for update
  to authenticated
  using (
    auth.uid() = addressee_id
    and status = 'pending'
  )
  with check (
    auth.uid() = addressee_id
    and status in ('accepted', 'declined')
  );
