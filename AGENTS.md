# plus1 — agent instructions

General hangout app (user-facing "events", legacy internal "quests"): phone OTP auth, event discovery/create/join, activity feed, optional AI-assisted event drafting. Mobile-first Next.js app with a Capacitor iOS wrapper deployed to Vercel.

**Before large changes, read:** `README.md`, `docs/evaluation.md`, and relevant code under the paths below.

**Coding behavior:** follow `CLAUDE.md` (simplicity, surgical diffs, verify with tests/build).

---

## Product direction (read before any UI/UX work)

- **iOS-only now.** The Capacitor iOS app is the product; don't design or optimize for desktop web. This has startup ambitions — treat it as a real monetizable app, not a class project.
- Keep the **glassmorphic visual identity**.
- Visual quality bar: **Partiful / BeReal** (NOT Instagram). UX friction bar: **Kalshi / Cal AI**.
- Sacred actions: **join a plan** and **post a plan**. They must take seconds, not forms — any change that adds friction to these needs strong justification.

---

<!-- BEGIN:nextjs-agent-rules -->
## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Supabase Auth, Postgres, RLS, Realtime |
| AI | OpenAI Chat Completions (server-only API routes) |
| Mobile | Capacitor 8 iOS shell → loads deployed Vercel URL |
| Deploy | Vercel (`capacitor.config.ts` points at production URL) |

---

## Repository map (start here)

| Area | Path |
|------|------|
| App shell, auth gate, first-run profile setup | `components/AppShell.tsx` |
| Tab screens | `components/screens/` (Home, Explore, Activity, Profile) |
| Quest UI | `components/QuestDetail.tsx`, `CreateQuestForm.tsx`, `QuestList.tsx`, … |
| AI draft UI | `components/AiQuestDraft.tsx` |
| Auth + profile | `lib/authService.ts` |
| Quest CRUD / join / leave | `lib/questService.ts` |
| Activity feed | `lib/activityService.ts` |
| AI server helper | `lib/aiQuestDraft.ts` |
| AI API routes | `app/api/ai/quest-draft/route.ts`, `app/api/ai/flyer-to-quest/route.ts` |
| Supabase client | `lib/supabaseClient.ts` |
| DB schema + RLS | `supabase/schema.sql`, `supabase/migrations/` |
| Unit tests | `tests/authService.test.ts` |
| RLS integration tests | `lib/questService.test.mjs` (skips without Supabase test env) |

Entry: `app/page.tsx` → `AppShell`.

---

## What's implemented

- Phone OTP sign-in (Supabase Auth), session via `getSession()`
- First-run profile setup after OTP when display name looks auto-generated (`isLikelyAutoDisplayName` in `lib/authService.ts`)
- 5-tab shell: Home, Explore, Create, Activity, Profile
- Quest lifecycle: create, join, leave, host edit, close
- Activity feed with unread badge; Supabase Realtime on `activity_events`
- Shareable quest card (native share / clipboard)
- AI text-to-quest and flyer-image-to-quest **routes and UI exist**; they call OpenAI when `OPENAI_API_KEY` is set
- Capacitor iOS wrapper; push token registration is best-effort (non-blocking timeout)

## Not implemented (don't assume these exist)

- Production US SMS (Twilio A2P 10DLC not configured — use Supabase Test OTP for dev/demo)
- Unique username/handle column (display name only)
- Matching/recommendations, deep links, moderation pipeline
- Full production push notification pipeline

See `docs/evaluation.md` §4 (limitations) and §6 (stretch goals).

---

## Environment variables

Copy `.env.example` → `.env.local`. Never commit secrets.

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `OPENAI_API_KEY` | For AI features | Server-only. Used by `lib/aiQuestDraft.ts` via the two `/api/ai/*` routes. **Code is wired; key may be unset in local env** — Create → AI tab will error until set. |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini` |

Optional for RLS integration tests in `lib/questService.test.mjs`: Supabase service-role / test credentials (see test file).

---

## Supabase setup (required for full app)

1. Apply migrations in `supabase/migrations/` (listed in `README.md`).
2. Enable Realtime publication for `activity_events`.
3. Phone auth: use **Supabase Test phone numbers and OTP** for reliable local/demo sign-in unless Twilio 10DLC is fully configured.

---

## Verification (run before finishing work)

```bash
npm run lint
npm run build
npm run test
```

`npm test` runs unit tests (`tests/**/*.test.ts`) plus RLS tests (skipped if Supabase test env missing).

Manual demo checklist: `README.md`. Submission evidence plan: `docs/evaluation.md`, `docs/demo-script.md`.

---

## Deploys & git identity

- Vercel auto-deploys on push to `main` (Hobby plan, team `allenliao25s-projects`). Production: `https://plus1-livid.vercel.app` — the Capacitor shell loads this URL, so a broken `main` deploy breaks the iOS app too.
- **Commit-author gotcha:** the owner has two GitHub accounts. `allenliao25@gmail.com` is attributed by GitHub to `allenliao8`, and Vercel Hobby **blocks deploys whose commit author isn't a team member** ("Blocked — commit author did not have contributing access"). Author commits as `116464203+allenliao25@users.noreply.github.com` (set repo-local via `git config user.email`; verify before committing). To repair an already-pushed blocked commit: `git commit --amend --reset-author --no-edit && git push --force-with-lease`. Never work around it by upgrading to Pro.
- Landing branches: verified-green, rebase-clean branches may be opened as PRs and merged without asking (merge-commit style) — see the user-level `ship-pr` skill.

---

## Conventions

- **Client vs server:** Supabase anon client in browser; AI keys and sensitive logic stay in API routes / `lib/` server code. Never prefix secrets with `NEXT_PUBLIC_`.
- **Phone numbers:** use `normalizePhoneNumber()` from `lib/authService.ts` — don't duplicate normalization.
- **Profile bootstrap:** `ensureProfile()` on sign-in; first-run setup uses `completeProfileSetup()`.
- **Style:** match existing component patterns; mobile-first full-bleed safe-area layout in `AppShell`.
- **Changes:** minimal diff scoped to the task; no drive-by refactors.
- **Migrations:** add new SQL under `supabase/migrations/` with timestamp prefix; keep `supabase/schema.sql` in sync when schema changes.

---

## Docs (human + grader)

| File | Purpose |
|------|---------|
| `README.md` | Setup, architecture, demo checklist |
| `docs/evaluation.md` | Rubric evidence, limitations, screenshot plan |
| `docs/demo-script.md` | Under-3-minute demo video script |
| `docs/ai-disclosure.md` | AI/tool usage disclosure for course |

---

## When adding features or fixing bugs

1. State assumptions; read the files you will touch.
2. Prefer extending existing services (`authService`, `questService`, `activityService`) over new abstractions.
3. If touching auth, RLS, or Realtime, check migrations and policies in `supabase/`.
4. If touching AI flows, validate/clamp JSON in `lib/aiQuestDraft.ts` — don't trust raw model output.
5. Add or update tests when behavior is easy to regress (see `tests/authService.test.ts` for pattern).
6. Do not commit `.env.local`, credentials, or debug logs.
