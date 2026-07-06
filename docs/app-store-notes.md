# App Store submission notes (plus1)

Crib sheet for App Store Connect. Copy the blocks below into the matching fields.

## App Review notes (paste into "Notes")

```
plus1 uses phone-number sign-in via one-time passcode (OTP).

For review, use the following Supabase test account (no real SMS is sent):
  Phone: +1 5104961239
  OTP:   123456

Enter the phone number, tap to receive a code, then enter 123456 to sign in.

User-generated content: users create events and send messages. Every user can
report objectionable content and block other users from within the app
(guideline 1.2). Reports are reviewed within 24 hours; offending content is
removed and abusive users are ejected. Account deletion is available in-app
under Profile → Settings (guideline 5.1.1(v)).
```

IMPORTANT before every submission: the Supabase test OTP has an expiry. In the
Supabase dashboard (Authentication → Sign In / Providers → Phone → Test OTPs),
extend the "Test OTPs Valid Until" date past the expected review window, or the
reviewer's login will fail.

## Privacy nutrition label (App Privacy)

| Data type | Collected? | Linked to identity? | Used for tracking? |
|-----------|-----------|---------------------|--------------------|
| Phone number | Yes (Contact Info) | Yes — identifier for auth | No |
| Name | Yes | Yes | No |
| User content (photos, events, messages) | Yes | Yes | No |
| Coarse area (general locality string) | Yes | Yes | No |

- Purpose for all: App Functionality only.
- No data is used for tracking across apps or websites.
- No advertising or analytics SDKs.

## URLs and contact

- Privacy Policy: https://plus1-livid.vercel.app/privacy
- Terms of Service (EULA): https://plus1-livid.vercel.app/terms
- Support / contact email: allen8@stanford.edu

## Moderation promise

Reports of objectionable content or abusive behavior are reviewed within 24
hours. Content is removed and offending users are ejected. Reports are stored in
the `reports` table and reviewed by the moderation team via the Supabase
dashboard; users can also block each other (`user_blocks` table).

## App Store listing

Ready-to-paste copy for App Store Connect. Character budgets noted per field.

### App name

```
plus1
```

### Subtitle (≤30 chars)

```
See what your friends are up to
```
(31 → trim to:) `Your friends' plans, live` (25 chars) — use this one.

```
Your friends' plans, live
```

### Promotional text (≤170 chars)

Editable any time without a new build — use it for what's happening now.

```
Finals week? Game night? Late ramen run? See what your friends are doing tonight and tap once to pull up. New this week: event group chats and the Tonight rail.
```

### Description (~2–3 short paragraphs + bullets)

```
plus1 is the fastest way to turn "we should hang out" into actually hanging out.

Open the app and you see what your friends are doing right now — the pickup game starting on the courts, the ramen run at 9, the study grind at the library. Tap once to join. No group-text negotiation, no dead threads. When you're the one with a plan, post it in seconds and your friends see it instantly.

Built on campus, made for your city. Every hangout gets its own group chat so plans don't scatter across five apps, and the Tonight rail surfaces what's live before it's over.

• See friends' hangouts on one live feed
• Join anything in a single tap
• Post your own plan in seconds — no cap or a set number of spots
• A group chat for every event
• Tonight rail for what's happening right now
• Find friends from your contacts, privately
```

### Keywords (100-char comma list, no spaces after commas)

```
hangout,friends,meetup,events,tonight,campus,college,social,plans,invite,rsvp,group chat,nearby,join
```
(97 chars. Deliberately omits "app" and "plus1" — the name is already indexed.)

### Category

- Primary: **Social Networking**
- Secondary: **Lifestyle**

### Age rating

Recommend **17+**. plus1 carries unfiltered user-generated content — open event
posts and group-chat messages between users — with no automated content filter.
Under Apple's questionnaire that maps to "Infrequent/Mild → Frequent/Intense
Mature/Suggestive Themes" via the "User-Generated Content" path, which lands at
17+. Our Terms of Service also state a 17+ minimum, so the rating and the EULA
agree.

Tradeoff worth noting: a 12+ rating is defensible if we lean on the in-app
report + block tooling (guideline 1.2) as the moderation control, since the
content itself isn't inherently mature. We choose 17+ to be conservative given
there is no pre-publication filtering — it's the safer answer for review and
avoids a rating-mismatch rejection. Revisit if/when an automated moderation
pipeline ships (see AGENTS.md "Not implemented").

Answer the UGC questions truthfully as: unrestricted web access = No; the app
does contain user-generated content = Yes (with reporting + blocking in place).

### URLs & copyright

| Field | Value |
|-------|-------|
| Support URL | https://plus1-livid.vercel.app |
| Marketing URL | https://plus1-livid.vercel.app |
| Privacy Policy URL | https://plus1-livid.vercel.app/privacy |
| Copyright | 2026 Allen Liao |

### Screenshots — 6.9" (1320 × 2868), upload in this order

Curated set lives in the store-shots output dir (see the submission run notes).
Suggested caption overlay concept per shot (keep captions to ~4 words):

| # | File | Shows | Caption concept |
|---|------|-------|-----------------|
| 1 | `01-home.png` | Home feed — Tonight + Happening now rails, live event cards | "See tonight, live" |
| 2 | `02-event-detail.png` | Event detail — Sunrise Dish hike, host, spots, Join | "Join in one tap" |
| 3 | `03-create.png` | Create sheet — when / category / spots / visibility | "Post a plan in seconds" |
| 4 | `04-explore.png` | Explore — find friends from contacts + suggestions | "Find your people" |
| 5 | `05-chat.png` | Event group chat — the ramen run thread | "A chat for every plan" |
| 6 | `06-activity.png` | Activity feed — invites, friend requests, reminders | "Never miss the move" |
| 7 | `07-profile.png` | Profile — hosted grid, stats, interests | "Your hangout history" |
| 8 | `08-dark-home.png` | Home feed in dark mode | "Looks great after dark" |

Six strong shots (1–2, 5–8, or 1–5) beat eight if App Store Connect flags any;
the ordering above front-loads the core loop (see → join → post → chat).

### What's New in 1.0

```
Welcome to plus1 — the first public release.

• See what your friends are doing tonight and join in one tap
• Post your own hangout in seconds
• A group chat for every event
• The Tonight rail: what's live, before it's over
• Find friends privately from your contacts

Thanks for being here early. Tell us what to build next.
```
