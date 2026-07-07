# Plus1 Backlog

Working backlog from planning sessions. Priorities: P0 = build next, P1 = after P0s land, P2 = enabler/opportunistic, Later = parked on purpose.
Monetization tags: `free-forever` | `future-premium-candidate` | `n/a` — labels only, no billing code until user base exists.

---

## ✅ SHIPPED (July 7, 2026) — Guest RSVP on shared event links
**Rationale:** The share link is our only acquisition channel and it currently dead-ends at a sign-up wall; letting a non-user RSVP turns every event into an invite engine.
**Monetization:** free-forever (core viral loop — never paywall).
**Scope:** Public share page (`/e/[token]`) gains an "I'm in" button asking for first name only; guest attendees stored (new `quest_guest_joins` table or nullable-user join rows + RLS/RPC), count toward capacity, visible to host as "Name (guest)"; post-RSVP soft prompt to download the app. Web page first; native event detail shows guests. ~2–4 days.

## P0 (code done; Allen: Twilio A2P + APNs key + TestFlight remain) — Real onboarding unblock (SMS + App Store)
**Rationale:** Guest RSVP converts guests into signups only if OTP actually delivers and the app is installable; both are currently blocked.
**Monetization:** n/a (infrastructure).
**Scope:** Twilio A2P 10DLC registration for production SMS; add `PrivacyInfo.xcprivacy`; flip `aps-environment` to production; set APNs env vars so the dormant push pipeline goes live; TestFlight build. Mostly ops/config, ~1–2 days of work + carrier registration wait.

## ✅ SHIPPED (July 7, 2026, keys pending) — Analytics + crash reporting
**Rationale:** "Traction first" is unmeasurable today — zero telemetry anywhere; this is the instrument panel for every other bet.
**Monetization:** n/a (internal).
**Scope:** PostHog (events: signup funnel, event create/join, share-link visit → guest RSVP → install) + Sentry/crash reporting in web and native iOS. ~0.5–1 day, rides along with the next build wave.

## ✅ SHIPPED (July 7, 2026) — SMS invites to non-users from the invite picker
**Rationale:** Contact sync only matches contacts who already have Plus1 (≈nobody at launch); letting hosts text a guest-RSVP link to any contact makes the invite picker the growth engine. Composes with guest RSVP.
**Monetization:** free-forever (core viral loop).
**Scope:** Invite picker shows non-user contacts; tapping opens Messages pre-filled with the event's guest link. Share-sheet/MFMessageCompose only — no new backend. ~1 day, native iOS.

## ✅ SHIPPED (July 7, 2026) — "Free tonight" availability signal
**Rationale:** Launch audience is Allen's friend group — a "who's down" signal is useful at 5-friend density, unlike event discovery which needs a crowd; it's the demand-side half of the mission. (Confirmed for friends-first launch, July 2026.)
**Monetization:** free-forever (core loop).
**Scope:** One-tap status with auto-expiry (~end of night), visible to friends on Home/Tonight rail; "me too" tap groups the free people and prompts one to spin up a quick event; push on friend-goes-free. New `availability` table + RLS, Home surface, push trigger. ~1 week.

## ✅ SHIPPED (July 7, 2026) — "Friends going" social proof on event cards
**Rationale:** The #1 reason a student joins is who's already in; cards currently show a bare count ("3 going") instead of "Maya + 2 others" with avatars.
**Monetization:** free-forever.
**Scope:** Event feed cards (web + native) show up to 3 attendee avatars + first name, friends/mutuals ranked first. Data already fetched for detail views; mostly UI + a joined query. ~1–2 days.

## P2 — Waitlist with auto-promote
**Rationale:** Full events hard-bounce joiners and dropped spots never backfill; a waitlist recaptures both.
**Monetization:** future-premium-candidate (could later gate on host tier; free for now).
**Scope:** `quest_waitlist` table + RLS; "Join waitlist" replaces disabled button when full; on leave/capacity-increase, auto-promote earliest + push "a spot opened up." ~2–3 days.

## P2 — Feature flag / remote config rail
**Rationale:** Strategy is "premium-caliber features shipped free, paywall later = config flip" — needs an actual flag mechanism (today: env vars only, no runtime kill switch).
**Monetization:** n/a (enabler).
**Scope:** Single `app_config` table (key → JSON) read at app boot, cached, with per-feature boolean gates in web + native. ~0.5 day. Build when the first flag-worthy feature ships, not before.

## P2 — Land loose ends from repo sweep
**Rationale:** Two finished pieces of work are sitting unmerged.
**Monetization:** n/a.
**Scope:** Merge `origin/claude/youthful-kepler-b281db` (fixes spurious "Something went wrong" alerts on fast tab switching in native iOS); decide fate of `origin/cursor/seed-production-demo-script` (1,300-line production demo seeder from June — merge or delete). ~1 hour.

---

# Scale readiness
What 10k users would complain about, staged so we only build each tier when it's about to matter. Platform note (Allen, July 2026): **native iOS only for now — no web-app or Android investment** (the web share/guest-RSVP page is exempt; it's the acquisition funnel, not a platform).

## ✅ SHIPPED (July 7, 2026) — Block enforcement
**Rationale:** `user_blocks` exists but no RLS checks it — blocked users can still see your events and message you; a block that doesn't block is a broken safety promise.
**Monetization:** n/a (safety).
**Scope:** Add block checks to `can_view_quest()`, `can_access_message_thread()`, people search, and friend suggestions; hide both directions. Migration + RLS predicate updates + native "blocked users" list in settings. ~1 day.

## ✅ SHIPPED (July 7, 2026) — Report queue that reaches a human
**Rationale:** Reports insert into a table nobody watches, while App Store notes promise 24-hour review; unactioned reports are a liability and a churn story.
**Monetization:** n/a (safety).
**Scope:** Trigger on `reports` insert → push/email to Allen (reuse pg_net → edge function pattern); minimal admin action = close event / delete content via service role. No dashboard build. ~0.5–1 day.

## ✅ SHIPPED (July 7, 2026) — Event reminders
**Rationale:** The one push users actually want ("starting in 1 hour") doesn't exist — the `reminder` activity type is schema-only; reminders are retention, not noise.
**Monetization:** free-forever.
**Scope:** Scheduled job (Supabase cron/pg_cron) finds quests starting in ~60 min, inserts `reminder` activity_events for attendees → existing push pipeline delivers. ~1 day.

## At first traction — Request-to-join + location privacy
**Rationale:** Local events show exact location to any stranger in the area and joins are instant; hosts (women especially) will demand vetting. Predicted #1 request at scale.
**Monetization:** free-forever (safety-adjacent, never paywall).
**Scope:** Optional "approve joins" toggle per event; pending-join state + host approve/decline; location shown only after acceptance for approval-mode events. Schema + RLS + native UI. ~3–4 days.

## At first traction — Notification settings
**Rationale:** Every join/edit/message fires a push with zero controls; fatigue → notifications off → dead user.
**Monetization:** n/a.
**Scope:** Per-thread mute + category toggles (messages / event activity / friend requests) stored in a `notification_prefs` table; edge function checks prefs before send. ~2 days.

## At first traction — ASAP event expiry
**Rationale:** Events with no start time never age out of the feed until manually closed; stale events make the app feel dead.
**Monetization:** n/a.
**Scope:** Auto-close ASAP events ~24h after creation (cron or feed-query filter). ~0.5 day.

## At first traction — Campus (.edu) verification
**Rationale:** "Is this a real student?" trust badge + fixes area fragmentation ("Stanford" vs "Palo Alto" free-text splintering one campus into invisible feeds); could be a launch feature ("Stanford-verified").
**Monetization:** free-forever.
**Scope:** .edu email verification flow → verified-campus badge on profiles; campus becomes a canonical area value. ~3 days.

## 1k+ users — Deferred scale work
**Rationale:** Real problems, wrong time. Recorded so they're not forgotten.
**Scope (each unscoped until relevant):** reliability/flake signal on profiles ("went to 8 of 9"); message deletion; realtime re-architecture (web client currently subscribes to unfiltered quests/joins/friendships changes — every insert broadcasts to every client; chat also polls at 2–4s) + feed pagination; durable AI rate limiting (currently in-memory, resets per serverless instance).

## Killed for now (Allen, July 2026) — Web app & Android investment
No Android push (currently iOS-only in the edge function, stays that way), no Android app, no web-app feature work. Web exists only as the share/guest-RSVP funnel.

---

## Later — Crews (persistent small groups)
**Rationale:** A named group (dorm floor, climbing crew) you post events into directly; strongest when launch audience is a club/org — parked because launch is friends-first. Spec before building.
**Monetization:** future-premium-candidate (e.g., large-crew tier).
**Scope:** Groups + membership tables, group-scoped visibility and chat, group feed surface. ~1–2 weeks. Revisit after guest-RSVP funnel data.

## Killed (decided, don't relitigate)
- **Photo recaps / event memories** — second product; Instagram owns it.
- **Time-polls ("when works?")** — reintroduces the coordination friction Plus1 deletes; ASAP-mode stays the opinion.
- **"Maybe" RSVP** — lowers commitment energy; against the "who's down" vibe.
- **Recommendations/matching, typing indicators, chat media** — density-dependent polish; empty-room problems.

## Later — Sponsored events tab
**Rationale:** Allen's preferred first monetization surface: local businesses/orgs pay for placement once there's an audience; zero tax on the social loop.
**Monetization:** future-premium-candidate (advertiser-paid, not user-paid).
**Scope:** Not scoped. Revisit at meaningful WAU. No build now.

## Later — AI drafting push + host power tools
**Rationale:** Explicitly parked by Allen (AI draft "a gimmick" for now; power tools not the current bet). Recorded so we don't relitigate.
**Monetization:** future-premium-candidate.
**Scope:** None now. Note: AI draft exists on web only; native has no AI tab.
