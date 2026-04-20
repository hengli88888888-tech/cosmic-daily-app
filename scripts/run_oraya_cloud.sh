#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/liheng/Desktop/cosmic-daily-app"
APP_DIR="$ROOT/app"
ENV_FILE="$ROOT/.env.cloud"

if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="$ROOT/.env"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing /Users/liheng/Desktop/cosmic-daily-app/.env.cloud and /Users/liheng/Desktop/cosmic-daily-app/.env"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_ANON_KEY:-}" ]]; then
  echo "SUPABASE_URL or SUPABASE_ANON_KEY is missing in $ENV_FILE"
  exit 1
fi

if [[ "$SUPABASE_URL" == *"127.0.0.1"* || "$SUPABASE_URL" == *"localhost"* ]]; then
  echo "SUPABASE_URL points to local Supabase. This script is for the real hosted path only."
  exit 1
fi

DEVICE_ARGS=()
if [[ $# -gt 0 ]]; then
  DEVICE_ARGS=(-d "$1")
fi

cd "$APP_DIR"
flutter run \
  "${DEVICE_ARGS[@]}" \
  --dart-define=SUPABASE_URL="$SUPABASE_URL" \
  --dart-define=SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
