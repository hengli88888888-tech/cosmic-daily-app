# Qimen Launch Smoke Checklist

## Goal
Validate the launch-critical path before public rollout.

## Environment
- Confirm production `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and service-role envs are present.
- Confirm all required Supabase functions are deployed:
  - `master-reply-submit`
  - `question-threads`
  - `member-qimen-feedback`
  - `user-wallet`
  - `save-profile-and-chart`
  - `first-impression`
- Confirm wallet RPCs are live:
  - `spend_user_coins`
  - `grant_user_coins`

## Core User Flow
1. Fresh user opens app and lands on `/master-reply`.
2. Qimen calibration card is visible before asking.
3. User submits first question without any birth-data gate.
4. Qimen loading card cycles through resonance messages.
5. Delivered answer shows:
   - revelation frame
   - 120-minute rescan warning
   - birth-profile upgrade card
6. User can continue same thread for follow-up.
7. User can open a different topic without stale thread auto-opening.

## Coins and Billing
- First deep reading is free only for the first root question.
- Follow-up in the same thread costs `1 coin`.
- New quick reading costs `2 coins`.
- New deep reading costs `5 coins`.
- Insufficient balance routes to paywall cleanly.
- Wallet balance refreshes correctly after ask, follow-up, and feedback reward.

## Feedback Loop
- Only invited answers show the feedback card.
- Reward band shown in UI matches backend invite snapshot (`3/4/5`).
- Feedback submit requires verdict plus meaningful text.
- Reward is granted only once per answer.
- Updating a saved feedback record does not issue duplicate coins.

## Birth Profile Upgrade
- Post-answer upgrade card appears only for delivered Qimen answers.
- Tapping upgrade opens `/onboarding` in upgrade/edit mode.
- Birth details submit returns user to the original Qimen thread.
- Existing profile users see upgrade/update language rather than first-time setup language.

## Archive and Return Paths
- `/my-folder` opens saved threads correctly with `threadId`.
- Archive feedback line shows dynamic reward, not hardcoded `3 coins`.
- Opening `/master-reply` without `threadId` stays on a clean ask screen.
- `/welcome` acts only as a landing page and does not override the main app entry flow.

## Daily Guidance Promise
- If push-backed daily suggestions are live, verify permission flow and delivery.
- If push is not live, remove or soften any wording that implies guaranteed push delivery before launch.

## Admin and Operations
- Admin Qimen page loads and shows:
  - pending feedback threads
  - recent feedback
  - reward band stats
  - reward quality deltas
- Known debt:
  - `admin-qimen-feedback` still fails `deno check` only because of the existing `assert-admin.ts` type mismatch.

## Release Decision
Release to a small cohort only if:
- the full user flow passes on real devices
- coin spend and reward logic are correct
- feedback invitation snapshot is stable
- onboarding return-to-thread works
- copy about daily suggestions matches actual delivery capability
