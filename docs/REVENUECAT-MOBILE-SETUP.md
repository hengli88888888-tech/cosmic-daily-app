# RevenueCat Mobile Setup

This app now includes a mobile RevenueCat client path for memberships and coin packs.

## Dart defines

Pass the public SDK keys at build/run time:

```bash
flutter run \
  --dart-define=SUPABASE_URL=... \
  --dart-define=SUPABASE_ANON_KEY=... \
  --dart-define=REVENUECAT_APPLE_API_KEY=appl_xxx \
  --dart-define=REVENUECAT_GOOGLE_API_KEY=goog_xxx
```

Web builds stay read-only even if these keys are omitted.

## Expected product identifiers

The current client and webhook mapping expects identifiers equivalent to:

- `basic_monthly`
- `pro_monthly`
- `pro_yearly`
- `coins_5_pack`
- `coins_15_pack`
- `coins_50_pack`

The matching is alias-tolerant, but staying close to these names avoids ambiguity.

## RevenueCat dashboard expectations

- Put subscription products in the current offering so they appear on the membership screen.
- Put one-time coin packs in the same current offering as custom packages.
- Keep the current offering active for production.

## Backend sync

- Subscription status is written through [revenuecat-webhook/index.ts](/Users/liheng/Desktop/cosmic-daily-app/backend/supabase/functions/revenuecat-webhook/index.ts).
- Coin packs are granted through the same webhook via `grant_user_coins`.
- Wallet refresh is eventual: after a purchase, the app reloads wallet state, but the final balance depends on webhook delivery.

## Current UX

- Mobile:
  - offerings are loaded from RevenueCat
  - membership/coin-pack buttons can initiate a purchase
  - restore purchases is available
- Web:
  - the screen is visible
  - purchasing is intentionally unavailable

## Release caution

Do not enable purchase CTAs in production until:

- App Store / Play products are approved
- RevenueCat offering is populated
- webhook delivery is verified end-to-end
- test purchases update `subscriptions` and `coin_wallets` correctly
