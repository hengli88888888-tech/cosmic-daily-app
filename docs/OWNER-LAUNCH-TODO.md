# Owner Launch Todo

These are the non-code launch items that need a product/business owner decision or account access.

## Must Do Before Public App Store Launch

- Rotate exposed keys:
  - Supabase service role / secret key
  - OpenAI key if it was ever enabled
  - DashScope/Qwen key if it was exposed outside your local machine
- Decide production Supabase strategy:
  - use the current cloud project after deleting test data, or
  - create a clean production Supabase project and redeploy schema/functions/vector data.
- Create legal/support pages:
  - Privacy Policy URL
  - Terms URL
  - Support URL or support email
- Apple Developer setup:
  - final Bundle ID
  - signing team
  - TestFlight access
  - app privacy labels
  - age rating
  - screenshots
- Payment decision:
  - if selling coins/membership on iOS, configure Apple IAP and RevenueCat before public launch.
  - if IAP is not ready, launch TestFlight with free credits and keep purchase CTAs disabled.
- Login decision:
  - if real Google login is enabled in the iOS app, also enable Sign in with Apple.
  - if we want fastest TestFlight, keep mobile login as anonymous/profile-later first.
- Admin hosting decision:
  - local admin is acceptable for internal testing.
  - public operations should use a hosted admin site with restricted Google admin access.
- Final content approval:
  - answer tone
  - disclaimers
  - coin/feedback reward copy
  - birth-details upsell copy

## Must Do Before TestFlight

- Confirm `Oraya` app name, icon, and screenshots.
- Confirm the app does not expose fake purchase success.
- Run 20 real Qimen questions through the cloud path and reject launch if answers:
  - read the topic incorrectly
  - do not start with a clear judgment
  - show Chinese in the English flow
  - expose Qimen/Bazi terminology
  - ask irrelevant clarification questions
- Confirm the admin dashboard can see submitted questions.
- Confirm incidents are recorded for backend/app failures.
- Confirm feedback reward behavior with at least one test reading.

## Can Wait Until After TestFlight

- Full marketing website beyond Privacy/Terms/Support.
- Push notifications.
- Sophisticated feedback sampling rules.
- Public dashboard analytics.
- Multiple app brands sharing the same knowledge backend.
- Full automated answer-quality regression suite.
