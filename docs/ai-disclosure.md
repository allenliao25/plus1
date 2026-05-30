# AI Usage Disclosure and Credits (CS 153)

This document discloses where AI tools were used in the plus1 project and credits external tools/services used to build and evaluate the project.

## 1) AI usage in development process

AI tools were used as implementation assistants, not as autonomous project owners. Major usage patterns:

- brainstorming product UX flows and iteration options
- debugging runtime issues (auth/session state, mobile boot behavior, Twilio/Supabase setup issues)
- drafting/refining frontend component code and API route scaffolding
- reviewing edge cases and proposing test scenarios
- improving developer documentation and deployment instructions

All generated or suggested code was reviewed, edited, and validated through lint/build/test/manual checks before inclusion.

## 2) AI usage in product features

plus1 includes explicit end-user AI functionality:

- Text prompt to structured quest draft:
  - `app/api/ai/quest-draft/route.ts`
- Flyer image to structured quest draft:
  - `app/api/ai/flyer-to-quest/route.ts`
- Shared server-side parsing/validation layer:
  - `lib/aiQuestDraft.ts`

Important guardrail:

- Model output is treated as untrusted and normalized into a constrained quest schema before use.

## 3) Human-authored technical work

Substantial human implementation and integration work includes:

- app architecture, screen flow, and mobile-first UX decisions
- Supabase schema/RLS design and migration updates
- auth/session/bootstrap logic and bug fixes
- realtime subscriptions and activity feed behavior
- manual testing, repro setup, and deployment workflow

## 4) Integrity statement

- This repo is maintained as original project work for CS 153.
- AI tools were used for acceleration and iteration, not for blind copy-paste submission.
- Generated suggestions were adapted to project constraints and validated through runtime checks.
- Known limitations and tradeoffs are documented in:
  - `docs/evaluation.md`

## 5) External tools and platform credits

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/)
- [OpenAI API](https://platform.openai.com/docs/)
- [Twilio](https://www.twilio.com/docs)
- [Capacitor](https://capacitorjs.com/)
- [Vercel](https://vercel.com/docs)

## 6) Collaboration and sources

- Primary implementation: project author (student)
- AI coding support: Cursor assistant interactions within this repository
- No external starter template or forked codebase was used as the core app foundation for plus1
