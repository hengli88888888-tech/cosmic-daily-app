# Production Supabase

Oraya production uses the existing hosted Supabase project:

- Project ref: `lckhqitjvnszcojppnnh`
- Project URL: `https://lckhqitjvnszcojppnnh.supabase.co`

Do not treat this project as disposable staging data anymore.

## Source Of Truth

- Mobile cloud builds read Supabase URL and anon key from `.env.cloud`.
- Knowledge/vector import scripts read Supabase URL and secret key from `.env.knowledge-import`.
- Both files must point to the same project ref: `lckhqitjvnszcojppnnh`.
- Real env files stay local and must never be committed.

Verify the production env with:

```bash
python3 scripts/verify_production_env.py
```

## Production Rules

- Rotate exposed keys before public launch.
- Do not run destructive SQL manually on this project without a backup/export.
- Do not use this project for throwaway load tests.
- Test data cleanup must be deliberate and logged.
- All Edge Function updates should be followed by cloud-path app testing.
- Admin access must stay limited to rows in `admin_users`.

## Before Public Launch

- Delete or archive obvious test users, test questions, and test feedback.
- Keep imported vector knowledge data intact.
- Keep admin user records intact.
- Re-run:

```bash
./scripts/prelaunch_verify.sh
```

## Safe Cleanup Scope

These are generally safe to clean after export when they are clearly test records:

- anonymous test users
- test `master_questions`
- test `qimen_outcome_feedback`
- test `internal_incidents`
- test `coin_wallets` and `coin_ledger` tied to deleted test users

Do not delete:

- `document_sources`
- `documents`
- `document_versions`
- `document_chunks`
- `admin_users`
- production function secrets
