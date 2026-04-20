# Release Hardening

Use release obfuscation for production mobile builds so the shipped Flutter app
does not expose readable symbol names by default.

## Android

```bash
cd app
flutter build appbundle \
  --release \
  --obfuscate \
  --split-debug-info=build/debug-info/android
```

## iOS

```bash
cd app
flutter build ipa \
  --release \
  --obfuscate \
  --split-debug-info=build/debug-info/ios
```

## Rules

- Never ship `SUPABASE_SERVICE_ROLE_KEY` in the client.
- RevenueCat SDK keys are public client keys; only ship the platform public SDK keys, never webhook secrets or store server credentials.
- Keep `specs/knowledge-base/` and other internal rule assets off the client bundle.
- Store split debug symbols in a private location with restricted access.
