# plus1 Evaluation and Evidence (CS 153)

This document maps plus1's current state to the CS 153 project rubric and records concrete validation evidence, known limitations, and next checks.

## 1) Problem and insight

### Problem

People often coordinate casual events (food, study, walks, errands) through fragmented group chats. That workflow has high friction:

- no shared browse surface for plans nearby
- unclear host ownership and participant capacity
- poor visibility into updates after joining

### Insight

A mobile-first event model can reduce coordination overhead if it combines:

- fast phone sign-in
- simple create/join/leave lifecycle
- clear host controls and attendance limits
- AI-assisted drafting from text or flyer images

## 2) Execution and technical work

plus1 includes substantial implementation across frontend, backend routes, auth, database policy, and mobile runtime.

### Product capabilities implemented

- Phone OTP auth and persistent sessions
- Unique @handle setup, local area selection, and profile editing
- Familiar 5-tab app shell (Home, Events, Create, People, Profile) with Home header Activity/Messages icons
- Event lifecycle (create, join, leave, edit, close)
- Activity feed with unread indicators
- Friends-only DMs and event chats for hosts/attendees
- AI text-to-event and flyer-to-event draft routes
- Shareable event card flow
- Capacitor iOS wrapper and native-safe-area UI polish

### Technical scope evidence

- Auth + profile bootstrap/update logic: `lib/authService.ts`
- Event reads/writes and hydration (legacy service name): `lib/questService.ts`
- Activity feed + writes: `lib/activityService.ts`
- Messaging inbox/thread service: `lib/messageService.ts`
- AI server helper and routes:
  - `lib/aiQuestDraft.ts`
  - `app/api/ai/quest-draft/route.ts`
  - `app/api/ai/flyer-to-quest/route.ts`
- App shell and tabbed product flow: `components/AppShell.tsx`
- Database and RLS policy definitions:
  - `supabase/schema.sql`
  - `supabase/migrations/20260529_auth_rls_upgrade.sql`
  - `supabase/migrations/20260529_push_tokens.sql`
  - `supabase/migrations/20260530045200_phone_auth_profiles.sql`
  - `supabase/migrations/20260530045300_profile_bio_interests.sql`
  - `supabase/migrations/20260530045400_activity_events.sql`
  - `supabase/migrations/20260531233000_messaging_threads.sql`

## 3) Evaluation and evidence

## A. Functional validation checklist

- Auth flow tested with Supabase Test OTP pair
- Sign-in persistence tested across app relaunches
- Join/leave/edit/close event paths exercised manually
- Activity feed write/read flow tested via join/edit/close actions
- AI draft routes tested for both text and flyer uploads

### B. Automated/engineering validation

- Lint gate: `npm run lint`
- Production build gate: `npm run build`
- RLS integration test coverage in:
  - `lib/questService.test.mjs`
  - validates atomic capacity, host self-join rejection, and outside-area rejection when Supabase test env vars are configured

### C. Iteration evidence from development

Observed and resolved during implementation/testing:

- Twilio trial + A2P 10DLC blocked real US SMS delivery; test OTP path documented for grading/demo reliability
- iOS boot hang caused by blocking push token registration; fixed by making registration best-effort/non-blocking
- Login UX refactored to dedicated full-screen auth (no tab bar) to mirror expected social-app patterns
- App shell redesigned from floating card to full-bleed safe-area layout for realistic iPhone UX

### D. Informal user feedback notes (early)

From real usage/testing sessions:

- Dedicated login screen felt more familiar and reduced confusion
- Icon-only bottom nav looked cleaner and more "native social app"
- Phone number formatting expectations were unclear; normalization and clearer messaging were needed
- Fast AI draft mode was useful for reducing friction before posting

### E. Screenshot capture plan for submission

Capture one clean screenshot for each of these states (device frame optional):

- Dedicated phone login screen
- Home feed with multiple open events
- Events screen with search + category filter active
- People screen with suggestions/friend actions
- Inbox and chat thread screens
- Create screen with AI text draft populated
- Create screen with flyer upload flow
- Event detail + attendee list
- Activity feed with unread indicator
- Profile screen with updated bio/interests
- Profile screen with handle, bio, photo, and event tabs
- Profile setup/edit with local area selected

## 4) Limitations and failure analysis

- **SMS delivery in US:** real Twilio OTP delivery may require A2P 10DLC registration; this can block carrier delivery in trial/new setups
- **AI extraction reliability:** flyer parsing may miss details or produce imperfect defaults; human review before posting is still required
- **Push notifications:** native push token registration is best-effort in development; full production push pipeline still requires deployment hardening
- **Network effects:** utility depends on active local user density
- **Local relevance:** profile-selected area filtering limits demo visibility, but it is not GPS or address verification
- **Moderation/safety:** report, block, takedown, and reputation tools are documented future work, not implemented product surfaces yet
- **Reminder activity:** join/edit/close activity is database-backed; reminder events remain client-orchestrated polish
- **Message notifications:** in-app unread badges exist, but message push notifications are not implemented yet
- **Internal naming:** some files, tables, and TypeScript types still use legacy `quest` naming while the product copy uses "events"

## 5) Success criteria and status

| Criterion | Target | Current status |
|---|---|---|
| User can authenticate with phone OTP | End-to-end sign-in works | Met (test OTP path) |
| User can create and join events | Core lifecycle works | Met |
| User sees updates after interactions | Activity feed + unread works | Met for join/edit/close; reminders are best-effort |
| AI can bootstrap event fields | Text + flyer routes return validated draft JSON | Met for signed-in users, with quality and rate limits |
| Project is reproducible by grader | Setup + migration + demo checklist documented | In progress (README/docs updated this pass) |
| Evidence of iteration and technical depth | Commit history + architecture + validation artifacts | Met, with ongoing polish |

## 6) What to add next (post-submission stretch)

- 10DLC-compliant SMS production rollout
- richer matching/recommendation using profile interests + time/location proximity
- deep-link based share/open event flow
- report/block flows, moderator takedown tools, and host reputation/verification
- stronger locality using ZIP/radius, GPS radius, or explicit travel-distance preferences

## 7) Final verification protocol

Run before recording/submitting:

```bash
npm run lint
npm run build
npm run test
```

Then execute the manual demo checklist in `README.md` using either:

- Supabase Test OTP (most reliable for grading/demo), or
- Twilio SMS if compliance configuration is already complete.
