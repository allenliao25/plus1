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
