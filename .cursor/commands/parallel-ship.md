# Parallel ship check (plus1)

Run these as **parallel subagents** using `/multitask` and `|||` between each block.
Do not edit files in this pass — return concise reports only.

---

Target only: next.config.ts, instrumentation.ts, lib/supabaseClient.ts, lib/questService.ts, components/AppShell.tsx, package.json

Audit mobile dev reliability for plus1. Trace AppShell boot → fetchDemoProfiles. List failure modes that cause "Connecting to Supabase..." or dead buttons on iPhone over LAN (http://10.x.x.x:3000). Review allowedDevOrigins and dev scripts. Return top 3 risks with file references and minimal fix recommendations.

|||

Target only: components/*.tsx, app/globals.css, app/layout.tsx

Audit mobile UX for plus1 on real iPhone Safari. Review touch targets, safe areas, keyboard/viewport issues, navigation clarity, loading and error states. Return top 5 improvements ranked by impact with file references. No code changes.

|||

Target only: supabase/schema.sql, lib/questService.ts, lib/supabaseClient.ts, types/quest.ts

Audit Supabase backend readiness for plus1. Map tables to questService functions. List gaps before class demo vs production (auth, RLS, join capacity, quest close/leave, migrations). Return top 5 sprint tasks with file references. No code changes.

---

After all three reports return, synthesize into one prioritized action list:
1. Fix now (blocks mobile or demo)
2. Next sprint
3. Later / production

Then ask which item to implement in a **single** follow-up agent (no parallel writes).
