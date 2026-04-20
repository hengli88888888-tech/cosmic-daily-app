#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

echo "== Git whitespace check =="
git diff --check

echo "== Production Supabase env =="
python3 scripts/verify_production_env.py

echo "== Flutter analyze =="
(cd app && flutter analyze)

echo "== Flutter tests =="
(cd app && flutter test)

echo "== Admin web production build =="
(cd admin-web && npm run build)

if [[ -f "$ROOT_DIR/.env.cloud" && -f "$ROOT_DIR/.env.knowledge-import" ]]; then
  echo "== Supabase cloud RLS isolation audit =="
  python3 scripts/audit_supabase_rls_isolation.py
else
  echo "== Supabase cloud RLS isolation audit =="
  echo "Skipped: .env.cloud and/or .env.knowledge-import not found."
fi

echo "== Git status =="
if [[ -n "$(git status --short)" ]]; then
  git status --short
  echo "Warning: working tree has uncommitted changes."
else
  echo "Working tree clean."
fi

echo "Prelaunch verification completed."
