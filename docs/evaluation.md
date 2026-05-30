# plus1 Evaluation and Evidence (CS 153)

This document maps plus1's current state to the CS 153 project rubric and records concrete validation evidence, known limitations, and next checks.

## 1) Problem and insight

### Problem

Students often coordinate low-commitment plans (food, study, walks, errands) through fragmented group chats. That workflow has high friction:

- no shared browse surface for plans nearby
- unclear host ownership and participant capacity
- poor visibility into updates after joining

### Insight

A mobile-first, low-pressure "quest" model can reduce coordination overhead if it combines:

- fast phone sign-in
- simple create/join/leave lifecycle
- clear host controls and attendance limits
- AI-assisted drafting from text or flyer images

## 2) Execution and technical work

plus1 includes substantial implementation across frontend, backend routes, auth, database policy, and mobile runtime.

### Product capabilities implemented

- Phone OTP auth and persistent sessions
- Unique @handle setup and profile editing
- Instagram-style 5-tab app shell (Home, Explore, Create, Activity, Profile)
- Quest lifecycle (create, join, leave, edit, close)
- Activity feed with unread indicators
- AI text-to-quest and flyer-to-quest draft routes
- Shareable quest card flow
- Capacitor iOS wrapper and native-safe-area UI polish

### Technical scope evidence

- Auth + profile bootstrap/update logic: `lib/authService.ts`
- Quest reads/writes and hydration: `lib/questService.ts`
- Activity feed + writes: `lib/activityService.ts`
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

## 3) Evaluation and evidence

## A. Functional validation checklist

- Auth flow tested with Supabase Test OTP pair
- Sign-in persistence tested across app relaunches
- Join/leave/edit/close quest paths exercised manually
- Activity feed write/read flow tested via join/edit/close actions
- AI draft routes tested for both text and flyer uploads

### B. Automated/engineering validation

- Lint gate: `npm run lint`
- Production build gate: `npm run build`
- RLS integration test coverage in:
  - `lib/questService.test.mjs`
  - validates over-capacity join rejection and host self-join rejection behavior

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
- Home feed with multiple open quests
- Explore screen with search + category filter active
- Create screen with AI text draft populated
- Create screen with flyer upload flow
- Quest detail + attendee list
- Activity feed with unread indicator
- Profile screen with updated bio/interests
- Profile screen with handle, bio, and quest tabs

## 4) Limitations and failure analysis

- **SMS delivery in US:** real Twilio OTP delivery may require A2P 10DLC registration; this can block carrier delivery in trial/new setups
- **AI extraction reliability:** flyer parsing may miss details or produce imperfect defaults; human review before posting is still required
- **Push notifications:** native push token registration is best-effort in development; full production push pipeline still requires deployment hardening
- **Network effects:** utility depends on active local user density
- **Moderation/safety:** no automated moderation pipeline yet

## 5) Success criteria and status

| Criterion | Target | Current status |
|---|---|---|
| User can authenticate with phone OTP | End-to-end sign-in works | Met (test OTP path) |
| User can create and join quests | Core lifecycle works | Met |
| User sees updates after interactions | Activity feed + unread works | Met |
| AI can bootstrap quest fields | Text + flyer routes return validated draft JSON | Met (with quality limits) |
| Project is reproducible by grader | Setup + migration + demo checklist documented | In progress (README/docs updated this pass) |
| Evidence of iteration and technical depth | Commit history + architecture + validation artifacts | Met, with ongoing polish |

## 6) What to add next (post-submission stretch)

- 10DLC-compliant SMS production rollout
- richer matching/recommendation using profile interests + time/location proximity
- deep-link based share/open quest flow
- moderation and trust/safety controls

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
