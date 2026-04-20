# Web Manual Test Report

Date: 2026-03-16

## Environment

- Flutter web run command:
  - `flutter run -d chrome --web-port 7357 --dart-define=SUPABASE_URL=http://127.0.0.1:54321 --dart-define=SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`
- Supabase local stack:
  - `supabase start`
  - `supabase db reset`
- Edge functions:
  - `supabase functions serve --env-file ../../.env`

## Passed UI Checks

- Welcome page renders correctly.
- Welcome -> Onboarding navigation works.
- Onboarding copy matches the current privacy/minimal-retention messaging.
- Onboarding date picker opens and selects a date correctly.
- Onboarding city input accepts text and shows autocomplete suggestions.
- First Impression empty state now uses product language instead of old `daily guidance` error copy.
- Ask page renders with free-opening-question messaging.
- Coins & Membership page renders with membership and coin-pack sections.
- Saved Readings page renders with empty-state notices.
- Annual report preview page renders and no longer fakes a purchase.

## Fixed During Testing

- [today_screen.dart](/Users/liheng/Desktop/cosmic-daily-app/app/lib/screens/today_screen.dart)
  - App bar title changed from `Your Reading` to `First Impression`.
  - Old fallback text `Failed to load daily guidance` removed.
  - Added a product-safe empty state that routes users back to onboarding/profile completion.

## Confirmed Local Auth State

- Local anonymous sign-in was initially blocked because `enable_anonymous_sign_ins` was missing in [backend/supabase/config.toml](/Users/liheng/Desktop/cosmic-daily-app/backend/supabase/config.toml).
- Anonymous sign-in is now enabled locally:
  - `[auth]`
  - `enable_signup = true`
  - `enable_anonymous_sign_ins = true`
- Browser session now receives a real local anonymous auth token in `localStorage` under `sb-127-auth-token`.

## Current Blocking Issue

The remaining blocker is not Flutter UI. It is the local Supabase edge runtime when `verify_jwt = true`.

Observed runtime error from `supabase functions serve`:

- `TypeError: Key for the ES256 algorithm must be of type CryptoKey. Received an instance of Uint8Array`

Impact:

- Local calls to JWT-protected functions fail before the function body runs.
- This blocks true local end-to-end testing for:
  - `user-wallet`
  - `question-threads`
  - `save-profile-and-chart`
  - `master-reply-submit`
  - any other `verify_jwt = true` function

Symptoms seen in the web app:

- Ask page falls back to default/free-copy states.
- Coins page and Ask page can become inconsistent because wallet data is not actually loading.
- Onboarding submission cannot be fully validated against the local function runtime.

## Recommended Next Step

Use one of these paths to complete real end-to-end testing:

1. Test against a deployed Supabase project where the updated edge functions are already deployed.
2. Upgrade the local Supabase CLI / edge runtime and retest the JWT-protected functions.
3. If strictly needed for local-only smoke testing, create a temporary local-testing config that disables `verify_jwt` for selected user-facing functions, while keeping production config unchanged.

## Screenshots Captured

Testing artifacts were captured under:

- `/tmp/cosmic_web_test/`

Key screenshots include:

- `welcome_restarted.png`
- `onboarding_after_click3.png`
- `onboarding_datepicker.png`
- `today_empty_fixed.png`
- `master_reply_after_anon_enabled.png`
- `paywall_after_anon_enabled.png`
