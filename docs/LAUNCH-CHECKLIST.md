# Launch Checklist

This checklist matches the current Oraya launch path: users start with a Qimen question first, then optionally add birth details and account/profile depth later.

## Engineering Gate

- Run the full prelaunch script:

```bash
./scripts/prelaunch_verify.sh
```

- Confirm these checks pass:
  - `git diff --check`
  - production Supabase env points to `lckhqitjvnszcojppnnh`
  - `flutter analyze`
  - `flutter test`
  - `npm run build` in `admin-web`
  - cloud RLS isolation audit, if cloud secret env files are present
- Keep the git working tree clean before building release artifacts.
- Do not commit real `.env`, `.env.cloud`, `.env.knowledge-import`, `admin-web/.env.local`, raw data, build caches, Pods, or node_modules.

## Backend

- Production Supabase project is `lckhqitjvnszcojppnnh`.
- Apply the latest [schema.sql](/Users/liheng/Desktop/cosmic-daily-app/backend/schema.sql) or migration set to the target Supabase project.
- Deploy the current Edge Functions used by the consumer path:
  - `user-wallet`
  - `master-reply-submit`
  - `question-threads`
  - `member-qimen-feedback`
  - `member-client-incidents`
  - `save-profile-and-chart`
  - `first-impression`
  - `daily-guidance`
- Deploy admin functions used for operations:
  - `admin-dashboard`
  - `admin-readings-list`
  - `admin-reading-detail`
  - `admin-qimen-feedback`
  - `admin-incidents`
  - `admin-users-search`
  - `admin-user-detail`
  - `admin-coins-adjust`
  - `admin-import-runs`
- Confirm anonymous sign-ins are enabled.
- Confirm RLS isolation with:

```bash
python3 scripts/audit_supabase_rls_isolation.py
```

- Confirm vector knowledge tables are populated and `match_document_chunks` works.
- Confirm production function secrets are set in Supabase, not only local `.env` files.

## Consumer QA

- Run the app through the cloud path only:

```bash
./scripts/run_oraya_cloud.sh
```

- Smoke test the current launch flow:
  - Fresh install opens directly to `Ask a question`.
  - First-time steps appear before question entry.
  - First question is free and does not show paywall.
  - Relationship third-party question shows optional relationship detail only after strong enough wording.
  - Partial text like `does my wife` does not prematurely show relationship detail.
  - School/admission question routes to school/exam style answer.
  - Investment/project question routes to money/project style answer and starts with a clear judgment.
  - Every answer starts with a clear short answer, then why, then action plan.
  - Follow-up in the same thread is free for missing clarification or costs 1 coin when appropriate.
  - `Saved Readings` shows active conversations.
  - Feedback invitations appear in `Saved Readings`, not inside the thread answer page.
  - Submitted feedback disappears from unhandled member messages.
  - Every pushed page has a working back path.
  - No user-facing Chinese text appears in English product flow.
  - No Qimen/Bazi professional terminology is exposed in consumer answers.

## Admin QA

- Confirm Google admin login works.
- Confirm the admin user exists in `admin_users`.
- Confirm dashboard loads after login.
- Confirm readings list shows newly submitted Qimen threads.
- Confirm reading detail shows thread messages, answer, vector matches, and feedback state.
- Confirm incidents page shows client/backend errors.
- Confirm non-admin users cannot call admin Edge Functions.

## Payments

- For iOS public launch, use Apple IAP for coins and membership.
- RevenueCat launch requirements:
  - App Store products are created and approved.
  - Current offering contains subscription and coin-pack packages.
  - App build receives `REVENUECAT_APPLE_API_KEY`.
  - `revenuecat-webhook` is deployed.
  - Test purchase updates `subscriptions` or `coin_wallets`.
- If IAP is not ready, hide purchase CTAs or keep launch limited to TestFlight credits.

## App Store

- Apple Developer account is active.
- Bundle ID and signing team are final.
- App name is `Oraya`.
- App icon and launch assets are final.
- App Store screenshots are prepared.
- Privacy Policy URL is live.
- Terms URL is live.
- Support URL or support email is live.
- App privacy labels are filled honestly.
- Age rating and entertainment/self-reflection disclaimer are set.
- If real Google login is enabled in the iOS app, Sign in with Apple must also be enabled.

## Launch Holds

Do not public-launch if any of these are true:

- Real keys were exposed and not rotated.
- One user can read another user's `profiles`, `coin_wallets`, `master_questions`, or feedback data.
- A normal question can return HTTP 400 without an incident record.
- Answers can appear in Chinese in the English flow.
- Answers can include internal Qimen/Bazi terminology.
- Relationship/third-party detection fires on incomplete text.
- The app can show fake purchase success.
- Paid coin flows are visible without working IAP.
- The admin dashboard cannot load production data.
- The repo has uncommitted launch-critical changes.
