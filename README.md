# plus1

Campus hangouts, without the group text.

plus1 is a mobile-first Next.js app where students can post low-pressure quests (dinner, study, walks), join each other, and manage their plans in one feed.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- Supabase (Auth + Postgres + Realtime)
- Capacitor iOS wrapper for mobile testing

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Fill `.env.local` with your Supabase project values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (for auth redirect; default `http://localhost:3000`)
- `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` (for Tier 2 push sender)

4. Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database

- Canonical schema: `supabase/schema.sql`
- Migration snapshot for auth + RLS hardening: `supabase/migrations/20260529_auth_rls_upgrade.sql`
- Migration snapshot for push tokens: `supabase/migrations/20260529_push_tokens.sql`

Core tables:

- `profiles` (linked to `auth.users`)
- `quests`
- `quest_joins`
- `push_tokens`

## Current product scope

- Email link auth
- Feed with category filtering
- Create quest
- Join / leave quest
- Host close quest
- Host edit quest
- Attendee list + status badges
- My quests grouped by hosting / going / closed / past

## Scripts

- `npm run dev` - run dev server on LAN
- `npm run build` - production build
- `npm run lint` - lint
- `npm run cap:sync:ios` - sync Capacitor iOS project
- `npm run cap:open:ios` - open iOS project in Xcode

## Notes

- Realtime notifications are wired through Supabase changes and Capacitor local notifications on native iOS builds.
- RLS policies are auth-scoped for profile, quest, and join operations.
- Tier 2 push infrastructure includes `push_tokens` storage and a Firebase Admin sender utility in `lib/pushSender.ts`.
