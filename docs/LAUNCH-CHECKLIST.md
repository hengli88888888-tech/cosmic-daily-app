# Launch Checklist

This checklist is for the first production release of the Oraya consumer app.

## Backend

- Apply [schema.sql](/Users/liheng/Desktop/cosmic-daily-app/backend/schema.sql) to the target Supabase project.
- Deploy the current edge functions:
  - `save-profile-and-chart`
  - `chart-preview`
  - `first-impression`
  - `first-impression-debug`
  - `daily-guidance`
  - `master-reply-submit`
  - `question-threads`
  - `user-wallet`
  - `member-daily-messages`
  - `daily-member-messages-fanout`
  - `subscription-coin-grant`
  - `revenuecat-webhook`
  - `qimen-preview`
- Confirm anonymous auth is enabled.
- Confirm RLS is enabled on user-facing tables.
- Treat `master-reply-assign / queue / deliver` as internal-only ops paths, not part of the consumer launch flow.
- Confirm `save-profile-and-chart` rejects any non-verified / incomplete chart instead of silently saving fallback data.

## Scheduled jobs

- Run `subscription-coin-grant` on a weekly schedule.
- Run `daily-member-messages-fanout` once per day.
- Run `master-reply-sla-check` on the chosen SLA cadence.

## Payments

- Wire the production RevenueCat project to App Store / Play billing products.
- Follow [REVENUECAT-MOBILE-SETUP.md](/Users/liheng/Desktop/cosmic-daily-app/docs/REVENUECAT-MOBILE-SETUP.md) for client keys and product naming.
- Map entitlements to:
  - `basic_monthly`
  - `pro_monthly`
  - `pro_yearly`
- Verify [revenuecat-webhook/index.ts](/Users/liheng/Desktop/cosmic-daily-app/backend/supabase/functions/revenuecat-webhook/index.ts) is receiving live events.
- Do not expose the Annual Insight Report as purchasable until payment and fulfillment are real.

## Mobile builds

- Build release binaries with obfuscation:
  - `flutter build appbundle --release --obfuscate --split-debug-info=build/debug-info`
  - `flutter build ipa --release --obfuscate --split-debug-info=build/debug-info`
- Confirm public-facing product name and metadata read `Oraya`.
- Confirm only anon keys are included in the app.
- Confirm no knowledge-base JSON is bundled into the Flutter app.

## Functional QA

- Run [MANUAL-TEST-CHECKLIST.md](/Users/liheng/Desktop/cosmic-daily-app/docs/MANUAL-TEST-CHECKLIST.md) end-to-end.
- Validate chart accuracy on [chart-test](/Users/liheng/Desktop/cosmic-daily-app/app/lib/screens/chart_test_screen.dart) against your approved oracle.
- Validate:
  - onboarding -> first impression
  - legacy fallback user -> rebuild prompt -> onboarding rebuild -> first impression
  - free first question
  - same-thread follow-up
  - new topic coin spend
  - first-share bonus awards exactly once
  - member daily messages
  - saved readings
  - annual report preview state

## Content / Ops

- Approve the live first-impression copy.
- Approve the live member daily message copy for `Basic` and `Advanced`.
- Confirm the consumer flow is `system-first` and does not expose internal reply-ops concepts.

## Launch hold conditions

Do not launch if any of these are still true:

- users can see fake payment success
- another user’s data is readable through Supabase REST
- onboarding still stores raw birth inputs longer than intended
- first-impression or master-reply depends on fallback charts for normal users
- First Impression still falls back to `daily-guidance` or any fake local insight cards
- member daily messages do not expire/favorite correctly
- public-facing branding still shows `Cosmic Daily` or old placeholder app names
