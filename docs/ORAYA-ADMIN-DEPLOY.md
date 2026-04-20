# Oraya Admin Web Deploy

## Scope

This document covers the standalone admin console at:

- `/Users/liheng/Desktop/cosmic-daily-app/admin-web`

It assumes:

- Supabase Auth is already enabled
- `admin_users` exists in `public`
- Google OAuth is the only V1 admin login method

## Required backend deploys

Deploy these admin-only functions:

- `admin-dashboard`
- `admin-users-search`
- `admin-user-detail`
- `admin-readings-list`
- `admin-reading-detail`
- `admin-incidents`
- `admin-coins-adjust`
- `admin-first-impression-rerun`
- `admin-import-runs`
- `admin-dev-bootstrap` (local development only, do not expose as a production operator flow)
- `first-impression-debug`

These admin functions currently use function-level auth checks in code via `requireAdminContext`, so local and production config can keep:

- `verify_jwt = false`

for the admin-only functions in:

- `/Users/liheng/Desktop/cosmic-daily-app/backend/supabase/config.toml`

## Admin account setup

Every admin must exist in `admin_users`.

Minimum fields:

- `user_id`
- `role`

Supported V1 roles:

- `super_admin`
- `operator`
- `reviewer`

## Google OAuth setup

In Supabase Auth:

1. Enable `Google`
2. Add the Google client ID and client secret
3. Add your admin web origin and callback URL

Recommended callback URL pattern:

- `https://admin.your-domain.com/dashboard`

For local development:

- `http://localhost:3000/dashboard`

## Admin web environment

Create:

- `/Users/liheng/Desktop/cosmic-daily-app/admin-web/.env.local`

With:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_ANON_KEY
```

## Local start

```bash
bash /Users/liheng/Desktop/cosmic-daily-app/scripts/run_oraya_admin_local.sh
```

## Production build

```bash
cd /Users/liheng/Desktop/cosmic-daily-app/admin-web
npm install
npm run build
npm run start
```

## V1 operator flows

- Search users
- Open user detail
- Inspect chart and first-impression output
- Review question threads
- Inspect incidents
- Grant coins
- Rerun first-impression
- Check import run state

## Known limits

- V1 does not edit raw charts
- V1 does not edit stored answers
- V1 does not directly edit subscriptions
- V1 reads RevenueCat results but does not write RevenueCat state
- `admin-import-runs` is local/dev friendly; deployed environments may not expose local filesystem run state
