#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/liheng/Desktop/cosmic-daily-app"
APP_DIR="$ROOT/app"
ENV_FILE="$ROOT/.env.cloud"

if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="$ROOT/.env"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ROOT/.env.cloud and $ROOT/.env"
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
  echo "SUPABASE_URL points to local Supabase. Release builds must use the hosted production project."
  exit 1
fi

DEFINE_ARGS=(
  --dart-define=SUPABASE_URL="$SUPABASE_URL"
  --dart-define=SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
)

if [[ -n "${REVENUECAT_APPLE_API_KEY:-}" ]]; then
  DEFINE_ARGS+=(--dart-define=REVENUECAT_APPLE_API_KEY="$REVENUECAT_APPLE_API_KEY")
fi

cd "$APP_DIR"

flutter build ipa \
  --release \
  --obfuscate \
  --split-debug-info=build/debug-info/ios \
  "${DEFINE_ARGS[@]}"
