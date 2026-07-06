# Demo data

Realistic seed data lives in the **live** Supabase project (`qjuiqeclnrvkyjnqltxq`) so
the app demos well and screenshots aren't empty states.

## Demo accounts (Supabase Test OTPs — not secrets)

These are Supabase **test phone numbers** with fixed OTPs (valid through 2026-07-31).
They sign in through the real OTP flow; no SMS is actually sent.

| Person | Phone | OTP | Handle | Role in demo |
|--------|-------|-----|--------|--------------|
| Maya Chen | +18005550123 | 789012 | @maya | Hosts ramen / study / Dune events; friends with everyone |
| Jordan Rivers | +18005550124 | 123456 | @jordan | Hosts basketball / hike; joins Maya's ramen |
| Allen (yours) | +15104961239 | *(your own)* | — | Receives the Dune invite + an unread DM from Maya |

Reserved / do not use for seeding:
- `+15104961239` is Allen's real account (currently profile "Justin Bieber" / @lilbieber). **Not modified by the seed** other than gaining friendships, one invite, and one DM thread.
- `+11111111111` is reserved for UI tests — left unused.

> Note: on this project the auth users behind +18005550123 / +18005550124 predate
> the demo, so the seed **renames those existing profiles** to Maya / Jordan rather
> than creating new ones (the phone→auth-user mapping is fixed by Supabase).

## What's seeded

- **Profiles**: Maya Chen (@maya, "Stanford", food/social/outdoors), Jordan Rivers
  (@jordan, "Stanford", fitness/study). Avatars null (initials render fine).
- **Friendships** (all `accepted`): Maya↔Allen, Jordan↔Allen, Maya↔Jordan.
- **5 open events** (`visibility = campus`, `area = Stanford`), times computed in SQL
  relative to `now()` (America/Los_Angeles) so they stay fresh:
  1. Maya · food · "Late night ramen run 🍜" — today 21:00, 4 spots, Ramen Nagi
  2. Jordan · fitness · "Pickup basketball at the courts" — **live now** (`start_time = null`), 8 spots
  3. Maya · study · "Finals grind — Green Library" — tomorrow 14:00, 6 spots
  4. Jordan · outdoors · "Sunrise Dish hike" — tomorrow 06:30, 5 spots
  5. Maya · social · "Movie night: Dune marathon" — today 20:00, 5 spots
- **Joins**: Jordan → ramen; Maya → basketball. (Host counts toward capacity.)
- **Invite**: Maya invites Allen to the Dune night (`quest_invites` pending +
  an `invite` activity row for Allen, unread).
- **Chat**:
  - Event thread on the ramen run (Maya + Jordan), 4 casual messages.
  - Direct thread Maya→Allen, 2 messages, left unread for Allen (his inbox shows a badge).

Events use `visibility = 'campus'` — the live DB's discoverable tier (the checked-in
`supabase/schema.sql` still says `'local'`; the live project migrated the enum to
`invite_only / friends / campus`).

## Re-running

The seed is **idempotent**. Events use fixed UUIDs (`aaaa0001-…-00000000000{1..5}`)
with `ON CONFLICT ... DO UPDATE`; friendships/joins/invites/participants use
`ON CONFLICT DO NOTHING`/`DO UPDATE`; messages are guarded by
`WHERE NOT EXISTS` per thread. Running it again refreshes event times and updates
rows in place without creating duplicates.
