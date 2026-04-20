#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/liheng/Desktop/cosmic-daily-app"
APP_DIR="$ROOT/app"
SMOKE="$ROOT/scripts/oraya_local_smoke.py"

echo "==> flutter analyze"
cd "$APP_DIR"
flutter analyze

echo
echo "==> flutter build web"
flutter build web

echo
echo "==> local smoke"
python3 "$SMOKE"

echo
echo "Verification passed."
