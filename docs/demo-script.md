# plus1 Demo Script (Under 3 Minutes)

Use this script for the CS 153 final video. It follows the course prompt structure (why, how it works, use cases, what more to add) and is designed for a 2:30-2:50 runtime.

## 0:00 - 0:20: Why this project exists

Talking points:

- "Campus plans usually happen in scattered group chats and DMs."
- "I built plus1 to make low-pressure plans easy to discover and join."
- "The core idea is a lightweight quest feed where students can post and join quickly."

On-screen:

- plus1 auth screen and app logo
- quick glance at Home feed with multiple quests

## 0:20 - 1:20: How the product works (live walkthrough)

### Step 1: Sign in

- Phone OTP flow (or Supabase Test OTP in demo mode)
- mention sessions persist across relaunches

### Step 2: Browse and join

- Home tab: open quests
- Explore tab: category + search filtering
- Open a quest, join it, and show attendee list

### Step 3: Create

- Create tab: fill in quest form manually
- Show AI assist from text prompt
- Show AI flyer extraction path (upload flyer image)
- Apply AI draft into form and post

### Step 4: Track updates and profile

- Activity tab: show join/edit/close event feed and unread behavior
- Profile tab: bio/interests updates, hosted/joined stats, and grouped quests

## 1:20 - 1:55: Technical architecture (concise)

Talking points:

- "Frontend is Next.js + React + Tailwind."
- "Auth/database/realtime are powered by Supabase with RLS policies."
- "AI drafting is served through two server routes backed by OpenAI."
- "I also wrapped the app with Capacitor for iPhone testing."

On-screen:

- architecture snippet from README
- brief file tree flash (app routes, lib services, supabase migrations)

## 1:55 - 2:20: Evidence and validation

Talking points:

- "I validated core flows manually and with lint/build checks."
- "I added integration tests for critical RLS join constraints."
- "I tested and documented real-world limitations like Twilio A2P constraints."

On-screen:

- `npm run lint`
- `npm run build`
- `npm run test`
- quick view of `docs/evaluation.md`

## 2:20 - 2:45: Use cases, impact, and what's next

Use cases:

- spontaneous food/study/workout plans
- club micro-events and flyer-to-post conversion
- low-friction social coordination for campus communities

Future work:

- production SMS compliance path (A2P/10DLC)
- richer matching and recommendations
- deep links and stronger sharing loop
- moderation/safety improvements

## Backup plan if live SMS fails during demo

- Use Supabase Test OTP pair and call it out explicitly.
- Say: "For demo reliability, I am using Supabase test OTP while real SMS provider compliance is still being finalized."
