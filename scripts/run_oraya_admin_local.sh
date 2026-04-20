#!/usr/bin/env bash

set -euo pipefail

ROOT="/Users/liheng/Desktop/cosmic-daily-app"
ADMIN_WEB="$ROOT/admin-web"

cd "$ADMIN_WEB"

if [ ! -f ".env.local" ]; then
  cat > .env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
EOF
  echo "Created $ADMIN_WEB/.env.local with local Supabase defaults"
  echo "Seeded local Supabase defaults for development."
fi

if [ ! -d "node_modules" ]; then
  npm install
fi

if [ -d ".next" ]; then
  mv .next ".next.stable.$(date +%s)"
fi

npm run build
npm run start
