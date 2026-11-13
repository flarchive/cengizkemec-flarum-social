# HTTP smoke test
#
# Requires a running Flarum installation with Flarum Social enabled.
# Export:
#   BASE_URL=https://forum.example.com
#   ADMIN_TOKEN=...
#   MEMBER_TOKEN=...        (optional; guest checks run without it)
#
# Usage: bash tests/http-smoke.sh

set -eu

BASE_URL="${BASE_URL:-http://localhost:8080}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
MEMBER_TOKEN="${MEMBER_TOKEN:-}"

pass=0
fail=0

check() {
  name="$1"
  expected="$2"
  actual="$3"

  if [ "$actual" = "$expected" ]; then
    echo "PASS $name ($actual)"
    pass=$((pass + 1))
  else
    echo "FAIL $name (expected $expected, got $actual)"
    fail=$((fail + 1))
  fi
}

status() {
  curl -s -o /dev/null -w '%{http_code}' "$@"
}

check "guest bootstrap" "200" "$(status "$BASE_URL/api/social/bootstrap")"
check "guest feed" "200" "$(status "$BASE_URL/api/social/feed")"
# A guest POST is stopped by CSRF before the auth check, or by auth when a
# valid guest CSRF token is supplied. Both outcomes are secure.
guest_write="$(status -X POST -H 'Content-Type: application/json' --data '{"body":"guest"}' "$BASE_URL/api/social/posts")"
case "$guest_write" in
  400|401|403) echo "PASS guest write blocked ($guest_write)"; pass=$((pass + 1)) ;;
  *) echo "FAIL guest write blocked (got $guest_write)"; fail=$((fail + 1)) ;;
esac
check "public room by slug or id" "200" "$(status "$BASE_URL/api/social/rooms/1")"
check "private media without auth" "404" "$(status "$BASE_URL/api/social/media/999999/file")"

if [ -n "$ADMIN_TOKEN" ]; then
  check "admin overview" "200" "$(status -H "Authorization: Token $ADMIN_TOKEN" "$BASE_URL/api/social/admin/overview")"
  check "janitor" "200" "$(status -X POST -H "Authorization: Token $ADMIN_TOKEN" "$BASE_URL/api/social/presence/janitor")"
fi

if [ -n "$MEMBER_TOKEN" ]; then
  check "member bootstrap" "200" "$(status -H "Authorization: Token $MEMBER_TOKEN" "$BASE_URL/api/social/bootstrap")"
fi

echo
echo "Passed: $pass  Failed: $fail"
test "$fail" -eq 0
