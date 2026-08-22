#!/usr/bin/env bash
# E2E smoke test for Strike production deployment.
# Run AFTER you've deployed to Vercel and configured all env vars.
#
# Usage: APP_URL=https://strike-xxx.vercel.app ./scripts/smoke.sh
#
# Exits non-zero on any failure.

set -euo pipefail

URL="${APP_URL:?Set APP_URL=https://your-app.vercel.app}"
FAILS=0

check() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "✓ $label"
  else
    echo "✗ $label (expected $expected, got $actual)"
    FAILS=$((FAILS + 1))
  fi
}

echo "→ 1. Health endpoint (basic reachability)"
HEALTH=$(curl -s -w "\n%{http_code}" "$URL/api/health")
HEALTH_BODY=$(echo "$HEALTH" | head -n -1)
HEALTH_CODE=$(echo "$HEALTH" | tail -n 1)
check "GET /api/health status" 200 "$HEALTH_CODE"
echo "  status: $(echo "$HEALTH_BODY" | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])")"

echo ""
echo "→ 2. Public pages (no auth required)"
for path in / /login /signup /manifest.json /icon.svg; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$URL$path")
  check "GET $path" 200 "$code"
done

echo ""
echo "→ 3. Security headers present"
HEADERS=$(curl -s -I "$URL/")
check "X-Content-Type-Options present" yes "$(echo "$HEADERS" | grep -ic "x-content-type-options:")"
check "X-Frame-Options present" yes "$(echo "$HEADERS" | grep -ic "x-frame-options:")"
check "Strict-Transport-Security present" yes "$(echo "$HEADERS" | grep -ic "strict-transport-security:")"
check "Content-Security-Policy present" yes "$(echo "$HEADERS" | grep -ic "content-security-policy:")"

echo ""
echo "→ 4. Authenticated routes redirect to /login (unauthenticated)"
for path in /closet /outfits /profile /audit /wishlist /mannequin; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$URL$path")
  # Expecting 307 (redirect to /login) — middleware sends unauth users there
  check "GET $path (unauth → 307)" 307 "$code"
done

echo ""
echo "→ 5. API routes return 401 without auth"
for path in /api/ai/recognize-garment /api/ai/generate-outfit /api/ai/analyze-reference /api/upload/sign /api/style/update-from-feedback; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$URL$path" -H "Content-Type: application/json" -d '{}')
  check "POST $path (unauth → 401)" 401 "$code"
done

echo ""
echo "---"
if [ "$FAILS" -eq 0 ]; then
  echo "✓ Smoke test passed ($FAILS failures)"
  echo ""
  echo "Next steps for manual verification:"
  echo "  1. Open $URL on your phone"
  echo "  2. Sign up with a real email (check inbox for confirmation if enabled)"
  echo "  3. Complete onboarding (body profile → style DNA)"
  echo "  4. Tap '+ Agregar' → take a photo"
  echo "  5. Verify the AI classifies it within 5-10 seconds"
  echo "  6. Save it → should appear in /closet"
  echo "  7. Tap '¿Qué me pongo?' → generate outfits"
  echo "  8. Tap 'Usé este look' → save + record"
  exit 0
else
  echo "✗ Smoke test failed ($FAILS failures)"
  exit 1
fi
