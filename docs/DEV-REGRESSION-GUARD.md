# Dev Regression Guard

When changing Oraya, do not stop at source edits. Validate the served artifact and the real user path.

## Required checks after UI or onboarding changes

Preferred one-command path:

```bash
bash /Users/liheng/Desktop/cosmic-daily-app/scripts/oraya_verify_local.sh
```

Manual equivalent:

```bash
cd /Users/liheng/Desktop/cosmic-daily-app/app
flutter analyze
flutter build web
```

2. Run the local smoke chain:

```bash
python3 /Users/liheng/Desktop/cosmic-daily-app/scripts/oraya_local_smoke.py
```

This verifies:
- built web artifact still points at local Supabase in localhost preview
- anonymous sign-in works
- `save-profile-and-chart` returns `verified_ready`
- `user-wallet` returns signup bonus state
- `member-daily-messages` responds
- `first-impression` returns 3 formal insights

## Required checks after `today_screen.dart` or `onboarding_screen.dart`

Do not trust source order alone.

Check the actual served page:

```bash
python3 -m http.server 7358 --directory /Users/liheng/Desktop/cosmic-daily-app/app/build/web
```

Then test in a fresh localhost page:

- `http://127.0.0.1:7358/#/onboarding`
- `http://127.0.0.1:7358/#/today`

## Local web rules

- Use `7358` for local preview.
- `app/web/flutter_bootstrap.js` unregisters old service workers to avoid stale bundles.
- `main.dart` falls back to local Supabase config only when running on localhost web preview.

## Change discipline

- First verify with the real served artifact.
- Then tell the user what changed.
- If the user reports a regression, reproduce it against the live local page before editing again.
