# Manual Test Checklist

This checklist is for pre-launch manual QA of the Oraya consumer app after the latest
security hardening pass.

## Environment prerequisites

- Apply the latest `/backend/schema.sql` to Supabase.
- Deploy the latest edge functions:
  - `save-profile-and-chart`
  - `first-impression`
  - `daily-guidance`
  - `member-daily-messages`
  - `daily-member-messages-fanout`
  - `user-wallet`
  - `question-threads`
  - `master-reply-submit`
  - `master-reply-assign`
  - `master-reply-queue`
  - `master-reply-deliver`
- Confirm anonymous auth is enabled in Supabase.
- Use a clean test account/session for each major scenario.
- For mobile device testing:
  - Android SDK must be installed and configured.
  - iOS target must be configured if testing on iPhone or Simulator.

## Consumer flow

### 1. Welcome -> Onboarding -> First Impression

- Launch app fresh.
- Confirm welcome page loads without admin/internal wording.
- Confirm the brand reads `Oraya`.
- Tap `Create your energy profile`.
- Confirm onboarding explains:
  - real birth details affect accuracy
  - data is encrypted
  - setup data is minimized after chart creation
- Submit valid birth date, optional time, and city.
- Expected:
  - no error
  - navigation lands on First Impression page
  - no `daily guidance` wording is visible
  - page shows hero summary + 3 insight cards + question CTA
  - no `Cosmic Daily` branding remains in the visible consumer flow
  - response source is the formal `first-impression` chain, not a visual fallback

### 1a. Legacy fallback profile recovery

- Use an older account with a historical fallback chart.
- Open the First Impression page.
- Expected:
  - no insight cards are shown
  - page clearly blocks with a rebuild/update state
  - CTA routes to onboarding in rebuild mode
- Re-enter the same birth details once.
- Expected:
  - profile rebuild succeeds
  - return to First Impression page
  - three formal insight cards now appear

### 1b. Broken profile / incomplete chart guard

- Trigger or simulate a chart setup failure.
- Expected:
  - onboarding shows a real error message
  - First Impression does not show “fake” insight cards
  - page shows a preparing/rebuild state instead of a content fallback

### 2. Free first question

- From First Impression, open question screen.
- Expected:
  - page says first deep reading is unlocked
  - no immediate paywall
- Ask a deep question.
- Expected:
  - submission succeeds
  - first question is treated as free
  - thread becomes active
  - wallet remains valid and app does not force a paywall

### 3. Same-thread follow-up

- In the active thread, ask a follow-up question.
- Expected:
  - follow-up submits in the same thread
  - thread history shows both user messages and actual answer text
  - cost messaging says follow-up is `1 coin`
- Open `Saved Readings`.
- Expected:
  - the thread appears there
  - tapping it returns to the same thread

### 4. New topic -> coins flow

- From the active thread, choose `Start a different topic`.
- Confirm the UI now offers:
  - `Deep reading · 5 coins`
  - `Quick answer · 2 coins`
- Submit a new topic with enough balance.
- Expected:
  - balance decreases correctly
  - new thread appears
- Repeat with insufficient balance.
- Expected:
  - app redirects to `Coins & Membership`

### 5. Wallet / membership

- Open `Coins & Membership`.
- Confirm:
  - current balance is displayed
  - `coins never expire` wording is visible
  - first-question state matches reality
  - plans and coin packs show correct pricing
  - first-share bonus card is visible
  - first share awards `5 coins`
  - second and later shares do not award more coins

### 6. Saved Readings

- Open `Saved Readings`.
- Confirm:
  - member messages appear for subscribed members
  - unread messages can be opened and marked read
  - bookmarked messages remain available beyond 3 days
  - active conversations appear from backend threads
  - no old `daily guidance` history section remains

### 6b. Annual report preview

- Open `Annual Insight Report`.
- Expected:
  - page clearly states that payment and fulfillment are not enabled in this build
  - no fake purchase success flow appears
  - no local “processing” report is created

### 6a. Daily member guidance

- Create or use an active `Basic` subscription test user.
- Open `Saved Readings`.
- Expected:
  - a brief daily member message appears
  - title/summary are concise
- Create or use an active `Advanced` subscription test user.
- Open `Saved Readings`.
- Expected:
  - a deeper daily member message appears
  - expanded content includes more context than the basic version
- Bookmark a daily message.
- Confirm it remains visible after its normal 3-day expiry window.

## Security smoke checks

### 7. Privacy minimization

- After onboarding, inspect DB records for the test user.
- Expected:
  - `bazi_charts.chart_text`, `pillars`, `analysis` exist
  - raw `dob`, `tob`, `birthplace`, coordinates are null or removed from long-term records
  - `raw_payload` is null

### 7a. First impression diagnostics

- For an admin test user, call `first-impression-debug`.
- Expected:
  - returns profile
  - returns chart
  - returns first-impression state
  - returns internal factors / raw top3 structure
  - indicates whether a historical fallback profile was detected

### 8. Direct data access

- Using anon/authenticated user credentials, attempt to access tables directly via Supabase REST.
- Expected:
  - user can never read another user’s `profiles`, `bazi_charts`, `coin_wallets`, `coin_ledger`, `master_questions`
  - direct insert/update to protected workflow tables is rejected by RLS

### 9. Admin endpoints

- Without JWT, call:
  - `master-reply-queue`
  - `master-reply-deliver`
- Expected:
  - request is rejected
- With non-admin JWT, call:
  - `master-reply-queue`
  - `master-reply-assign`
  - `master-reply-deliver`
- Expected:
  - returns `403`

## Local verification already completed

- `flutter analyze` for the consumer app: pass
- `flutter test`: pass

## Current local blockers

- Android build cannot run here because no Android SDK is configured.
- iOS build cannot run here because the project is not configured for iOS yet.
