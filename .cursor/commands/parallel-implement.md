# Parallel implement (plus1)

Use `/multitask` only when tasks touch **different paths**. After reports merge, implement in one agent.

---

Target only: lib/questService.ts and components/AppShell.tsx

Add a 10s timeout to boot-time Supabase fetch. On timeout, show a clear error with Retry. Ensure isBooting always clears. Disable BottomNav and header Create while isBooting.

|||

Target only: components/BottomNav.tsx, app/layout.tsx, app/globals.css

Add iPhone safe-area padding to bottom nav and shell. Bump primary touch targets to at least 44px on nav tabs, demo user switcher, and Join buttons.

|||

Target only: lib/questService.ts and supabase/schema.sql (propose SQL only in report if schema change needed)

Enforce quest max_people on join — reject joins when goingCount >= maxPeople. Return user-friendly error in AppShell actionError.

---

When all three finish, run `npm run build` and `npm run lint`. Summarize what changed and give a 3-step iPhone test checklist.
