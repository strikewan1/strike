#!/usr/bin/env bash
# Quick deploy helper. Run this after:
#   1. Pre-flight passed (`npm run preflight`)
#   2. Supabase project created + migrations applied
#   3. Vercel project imported from GitHub
#   4. Env vars set in Vercel dashboard
#
# Usage: ./scripts/deploy.sh [commit-message]

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MSG="${1:-deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ)}"

echo "→ Stage all changes"
git add -A

if git diff --cached --quiet; then
  echo "! Nothing to commit"
else
  echo "→ Commit: $MSG"
  git commit -m "$MSG"
fi

# Check if a remote exists
if ! git remote get-url origin >/dev/null 2>&1; then
  echo ""
  echo "✗ No remote 'origin' configured."
  echo "  Add one with:"
  echo "    git remote add origin git@github.com:<user>/<repo>.git"
  echo "  Or create the repo first:"
  echo "    gh repo create strike --public --source=. --remote=origin --push"
  echo ""
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "→ Push to origin/$BRANCH"
git push origin "$BRANCH"

echo ""
echo "✓ Pushed to origin/$BRANCH"
echo ""
echo "→ Vercel will auto-deploy from this push"
echo "  Watch progress at: https://vercel.com/dashboard"
echo ""
echo "  Once deploy completes:"
echo "    1. Copy the *.vercel.app URL"
echo "    2. Update Supabase Auth → URL Configuration:"
echo "       Site URL: <your-vercel-url>"
echo "       Redirect URLs: <your-vercel-url>/**"
echo "    3. Open the URL on your phone and test the signup flow"
