# MILESTONE — Real friends on TestFlight

Written 2026-07-06 (planning session with Allen). This is the **current milestone doc**: agent
sessions should work top-down from here. It supersedes BACKLOG.md's ordering where they
conflict; BACKLOG.md remains the long-term list. Update checkboxes as PRs merge.

**Pacing note:** waves below are PR-sized units of agent work, not calendar estimates. Waves 1–4
are largely independent of each other and can run as parallel sessions per AGENTS.md rules;
within a wave, items are ordered.

## North star

10–20 of Allen's real friends install plus1 from TestFlight, sign in without a test phone
number, and use it for actual plans. The two sacred actions hold the bar: **join a plan in
1 tap**, **post a plan in ≤10 seconds**.

## Decisions locked (Allen, 2026-07-06)

- Scope includes all four: real users on TestFlight, core-loop friction to the Cal AI bar,
  native-feel polish, and social/virality mechanics.
- **Auth: add Sign in with Apple instead of configuring Twilio A2P 10DLC.** Production SMS is
  dropped from the launch path. Supabase test-OTP numbers remain for dev and App Review.

## Standing assumption (veto if wrong)

**The native SwiftUI app at `ios/Plus1/` is the product.** It already has push registration,
universal links, contacts sync, analytics hooks, privacy manifest, and an App Store kit — far
past the Capacitor shell. The Capacitor wrapper at `ios/App/` is **frozen**: no new work, keep
it building only until the native TestFlight build exists, then delete it in a cleanup PR.
AGENTS.md's stack table predates this and should be corrected (Wave 0).

---

## Wave 0 — Housekeeping (unblocks clean parallel work)

- [ ] Update AGENTS.md: document `ios/Plus1/` as the primary app and `ios/App/` (Capacitor) as
      frozen; fix stale lines (deep links ARE implemented natively; `docs/evaluation.md` no
      longer exists; tab list). Point to this MILESTONE.md.
- [ ] Decide the two parked branches: merge `origin/claude/youthful-kepler-b281db` (fixes
      spurious "Something went wrong" alerts on fast native tab switching — wanted for Wave 2's
      crash-free bar) after rebase + verify; delete `origin/cursor/seed-production-demo-script`
      unless Allen objects (1,300 lines, stale since June).
      **Verify:** native smoke test passes; rapid tab-switching shows no error alerts.

## Wave 1 — Sign in with Apple (the launch unlock)

Goal: a stranger-to-the-backend iPhone user can create an account with Face ID and land in the
app with a profile.

- [ ] Native: `SignInWithAppleButton` flow → `supabase.auth.signInWithIdToken(provider: .apple,
      idToken:, nonce:)` (supabase-swift supports this). Wire into the existing session-phase
      handling in `Plus1App.swift` / auth views.
- [ ] Profile bootstrap for Apple users: reuse the existing ensure-profile path; use the
      Apple-provided name on first auth (it is only delivered once — persist it immediately).
      Users with no phone number must not break contact-sync matching or invites (guard the
      phone-keyed code paths).
- [ ] Keep phone OTP as a secondary option (existing users + App Review test account).
      **Non-goal:** account linking/merging between a phone account and an Apple account. New
      account is fine; don't build merging.
- [ ] **In-app account deletion** (Apple requires it once account creation exists; also right
      for launch). Server-side delete via an edge function or RPC with service-role — client
      anon key cannot delete auth users. Cascade user data per existing RLS/ownership model.
      **Verify:** create → delete → sign-in again yields a fresh empty account; deleted user's
      quests/messages handle per data model (host-transfer or tombstone — pick simplest,
      document choice in the PR).
- [ ] Ops (Allen, human-only — see checklist): enable Apple provider in Supabase Auth
      dashboard; create the Sign in with Apple key/Service ID in the Apple Developer portal.

**Verify (wave):** fresh simulator, no test credentials: Apple sign-in → profile setup → home
feed, all under a minute; UI smoke test extended to cover the Apple path (mock or skip-gated).

## Wave 2 — TestFlight pipeline + crash-free bar

Goal: an installable build real friends can get, with observability on.

- [ ] Native release build: archive `ios/Plus1` (XcodeGen project), version/build numbering,
      release configuration sanity (APNs entitlement per-config already exists).
- [ ] Wire PostHog + Sentry DSNs via config (code is no-op-when-unset already) — keys are an
      ops item; make sure a missing key stays silent in release.
- [ ] Push end-to-end: once the APNs `.p8` is uploaded (ops), verify device receives
      join/message pushes from the deployed `push` edge function; fix dead spots.
- [ ] App Review readiness: review notes with the test-OTP account, privacy policy URL
      reachable, screenshot set (reuse/extend the existing App Store kit).
      **Verify:** TestFlight internal build installs on Allen's phone; a second (friend) device
      can install via invite link; Sentry shows a test crash from the release build; push
      arrives with the app backgrounded.

## Wave 3 — Core loop to the Cal AI bar

Goal: measure, then cut. Don't redesign blind.

- [ ] Instrument funnels first (PostHog): `create_opened → create_posted` with elapsed ms and
      field-interaction counts; `plan_viewed → join_tapped → join_committed`. Ship, collect
      from Wave-2 testers.
- [ ] Post-a-plan ≤10s in the native create flow: smart defaults on (ASAP time, last-used or
      current location, category optional), required fields = title + place only, everything
      else below the fold. Kill any field the funnel shows nobody uses.
- [ ] Join stays 1 tap; the post-join moment must answer "now what" — surface chat + who's
      going immediately (the join→chat race guard from web PR #28 has a native equivalent —
      verify it exists, port if not).
      **Verify:** stopwatch test on device: cold app → posted plan in ≤10s; funnel dashboards
      show median create time and drop-off per field.

## Wave 4 — Social & virality mechanics

Goal: every plan is a growth loop; joining friends takes zero setup.

- [ ] Share loop: post-create share sheet with the share card + `plus1-livid.vercel.app/e/<token>`
      link (native share card exists). Link behavior: app installed → universal link opens the
      plan (shipped); not installed → web share page with guest RSVP (shipped) + prominent
      TestFlight/App Store CTA. **Add:** the web share page's install CTA, and a post-install
      "paste link / it just works" path — keep it simple, no deferred-deep-link SDK.
- [ ] Onboarding friend graph: run contacts sync (shipped) during first-run, show "friends
      already here" + one-tap follow/friend; empty-graph fallback = prompt to share the app.
- [ ] Post-join/post-create nudges: "invite 2 friends makes this happen" style prompt wired to
      the share sheet (copy light, not spammy).
      **Verify:** two-device demo: device A posts + shares; device B (guest, web) RSVPs; device
      B installs, signs in with Apple, opens the same link, is in the plan with chat.

---

## Ops checklist (Allen — human-only, batch at your convenience)

Everything else in this milestone is agent-executable; these are the genuine blockers, listed
so sessions can defer them to the end per the usual unattended-run pattern:

1. Apple Developer portal: Sign in with Apple key + Service ID; enable Apple provider in
   Supabase Auth dashboard (Wave 1).
2. APNs Auth Key `.p8` → Supabase edge-function secret (unlocks the already-deployed push
   pipeline) (Wave 2).
3. App Store Connect: app record for `com.allenliao.Plus1`, TestFlight internal group, invite
   friends (Wave 2).
4. PostHog project key + Sentry DSN (Wave 2/3).
5. NOT needed anymore: Twilio A2P 10DLC (superseded by Apple Sign-In decision).

## Definition of done

A friend with no prior account: installs from TestFlight → signs in with Apple → opens a
shared plan link → joins in 1 tap → gets a push when someone else joins. Allen posts a plan
from a cold start in ≤10 seconds. Sentry + PostHog are receiving release-build events.

## Explicitly out of scope (unchanged from BACKLOG.md)

Twilio/production SMS, matching/recommendations, moderation automation beyond the human report
queue, Android/desktop web, Crews, monetization, AI-draft investment (web-only gimmick for now),
account merging.
