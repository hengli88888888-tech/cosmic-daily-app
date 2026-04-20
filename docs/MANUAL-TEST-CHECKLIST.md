# Manual Test Checklist

Use this checklist for pre-launch QA on the current Oraya app flow.

## Setup

- Use the cloud path, not local functions:

```bash
./scripts/run_oraya_cloud.sh
```

- Confirm `.env.cloud` points to `https://...supabase.co`.
- Confirm `supabase functions serve` is not running.
- Use a clean app install or clear simulator state for fresh-user tests.
- Keep the admin dashboard open in another browser so submitted questions and incidents can be checked.

## Fresh User Flow

- Open the app.
- Expected:
  - App lands on `Ask a question`.
  - User is not forced to fill birth details first.
  - The intro steps are visible before question entry.
  - For first-time users, intro steps animate slowly enough to read.
  - For returning users, intro steps are visible without animation.
  - Topic dropdown defaults to no selected topic.
- Enter a clear first question.
- Expected:
  - Button says first/opening question is free.
  - No immediate paywall.
  - Question submits successfully.
  - Answer starts with a clear short answer.
  - Answer includes a practical action plan.
  - No Chinese text appears in the English flow.
  - No Qimen/Bazi professional terms appear in the consumer answer.

## Routing Cases

Run these examples and check the answer category and opening judgment:

- Love/third-party: `Does my wife have an affair with the guy in her office?`
  - Expected: relationship supplement appears before submit.
  - Expected: partner birth year label says `Her birth year`.
  - Expected: answer gives a clear confirmed / not confirmed / likely judgment.
- Partial relationship text: `does my wife`
  - Expected: no relationship supplement yet.
- School: `Will I get into this school this year?`
  - Expected: answer speaks about admission/school outcome, not work.
- Work: `Will I get this job offer after this interview?`
  - Expected: answer speaks about the offer/interview.
- Money/project: `Should I invest more in my stock account right now?`
  - Expected: answer starts with a direct invest / wait / avoid / reduce-risk judgment.

## Thread Flow

- Submit a first question.
- Ask a missing-detail clarification if the system asks for one.
- Expected:
  - Clarification reply is free.
  - User is not sent to the coin purchase page before the first issue is resolved.
- Ask a normal same-thread follow-up.
- Expected:
  - Follow-up remains inside the same thread.
  - Cost messaging is clear.
  - Thread history shows user question and answer text.
- Tap `Start a different topic`.
- Expected:
  - New-topic cost is shown before spending.
  - Insufficient balance routes to coins page only for paid new-topic flow.

## Saved Readings

- Open `Saved Readings`.
- Expected:
  - Back navigation works.
  - Active conversations appear.
  - Unhandled member messages appear.
  - Read or submitted feedback messages do not remain in the unhandled member messages list.
  - Feedback invitation card appears only after an eligible delivered answer.
  - Feedback card is not shown inside the active answer page.
- Submit feedback for an eligible reading.
- Expected:
  - Coins are returned once.
  - Reading marks feedback as saved.
  - Feedback invite disappears from member messages.

## Birth Details Upsell

- After a Qimen answer, tap the birth-details prompt.
- Expected:
  - Copy explains why birth details improve personal insight.
  - First-time user sees `Update and Sign Up`.
  - First-time submit routes to the sign-up/login education page.
  - Existing profile user sees update behavior and does not get forced through sign-up.
  - Google/Apple buttons are only preview UI unless real OAuth is enabled.

## Wallet And Paywall

- Open coins/membership.
- Expected:
  - Current balance is visible.
  - First question state matches backend wallet state.
  - No fake purchase success appears.
  - If RevenueCat is not configured for production, purchase CTAs are hidden or safely disabled.
  - First-share bonus can only grant once.

## Admin Checks

- Log in with the configured admin Google account.
- Expected:
  - Dashboard loads.
  - Newly submitted questions appear in readings.
  - Reading detail includes answer, messages, vector matches, and feedback status.
  - Incidents page shows app/backend errors.
  - Non-admin sessions cannot access admin data.

## Security Checks

- Run:

```bash
python3 scripts/audit_supabase_rls_isolation.py
```

- Expected:
  - One anonymous user cannot read another user's `profiles`.
  - One anonymous user cannot read another user's `coin_wallets`.
  - One anonymous user cannot read another user's `master_questions`.
  - Feedback table is not directly exposed through client REST.

## Release Verification

- Run:

```bash
./scripts/prelaunch_verify.sh
```

- Expected:
  - All automated checks pass.
  - Git working tree is clean or only contains intentional new changes.
