#!/usr/bin/env bash
# ============================================================================
# scripts/smoke.sh — آزمون دودی همه مسیرهای اصلی API (PHASE_08 دروازه خروج).
#
# نحوه استفاده:
#   bash scripts/smoke.sh [BASE_URL] [LOGIN] [PASSWORD]
#
# پیش‌فرض: http://localhost:3000 با کاربر مدیر seed توسعه. هر پاسخ ۵xx یا
# قطع ارتباط → خروج 非‌صفر. فقط وضعیت‌ها چاپ می‌شوند (بدون نشت داده).
# ============================================================================
set -uo pipefail

BASE="${1:-http://localhost:3000}"
USER="${2:-admin}"
PASS="${3:-barman-admin-1405}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

PASS_COUNT=0
FAIL_COUNT=0

# لاگین — نشست کوکی HttpOnly
login_code=$(curl -s -o /dev/null -w '%{http_code}' -c "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"$USER\",\"password\":\"$PASS\"}" \
  "$BASE/api/auth/login")
if [ "$login_code" != "200" ]; then
  echo "FAIL login → $login_code"
  exit 1
fi
echo "OK   login (200)"

check() {
  local method="$1" path="$2" expect="$3"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" \
    -X "$method" "$BASE$path")
  if [ "$code" = "$expect" ]; then
    echo "OK   $method $path → $code"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "FAIL $method $path → $code (expected $expect)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

check_401() {
  local path="$1"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")
  if [ "$code" = "401" ]; then
    echo "OK   (no-auth) $path → 401"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "FAIL (no-auth) $path → $code (expected 401)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# --- auth ---
check_401 "/api/leads"
check POST "/api/auth/logout" "204"

# لاگین مجدد برای مسیرهای بعدی
curl -s -o /dev/null -c "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -d "{\"name\":\"$USER\",\"password\":\"$PASS\"}" "$BASE/api/auth/login"

# --- CRM (فاز ۳) ---
check GET "/api/leads" "200"
check GET "/api/leads?stage=raw" "200"
check GET "/api/customers" "200"
check GET "/api/users" "200"

# --- سفارش (فاز ۴) ---
check GET "/api/orders" "200"
check GET "/api/orders?status=open" "200"

# --- انبار (فاز ۵) ---
check GET "/api/stock" "200"
check GET "/api/moves" "200"
check GET "/api/jobs" "200"

# --- خرید/مالی (فاز ۶) ---
check GET "/api/buys" "200"
check GET "/api/finance/receivables" "200"
check GET "/api/finance/cashflow" "200"
check GET "/api/finance/payables" "200"

# --- کاتالوگ/مدیریت/گزارش/خبر (فاز ۷) ---
check GET "/api/health" "200"
check GET "/api/admin/products" "200"
check GET "/api/admin/materials" "200"
check GET "/api/admin/users" "200"
check GET "/api/admin/settings" "200"
check GET "/api/admin/lists" "200"
check GET "/api/admin/suppliers" "200"
check GET "/api/catalog/products" "200"
check GET "/api/catalog/materials" "200"
check GET "/api/reports/sales?days=90" "200"
check GET "/api/home/summary" "200"
check POST "/api/export/leads-csv" "200"
check POST "/api/export/json" "200"
check POST "/api/export/zip" "200"

# --- باقی مجموعه‌ها ---
check GET "/api/txns" "200"
check GET "/api/suppliers" "200"
# بررسی موجودی آزاد — بدنه اقلام لازم است (Q-04)
RESV_BODY='{"items":[{"productId":"p1","qty":1}]}'
RESV_CODE=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" -X POST \
  -H 'Content-Type: application/json' \
  -d "$RESV_BODY" \
  "$BASE/api/reservations/check")
if [ "$RESV_CODE" = "200" ] || [ "$RESV_CODE" = "400" ]; then
  echo "OK   POST /api/reservations/check → $RESV_CODE"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "FAIL POST /api/reservations/check → $RESV_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# --- print امن (R-01) — توکن بدون لینک → 401 ---
PRINT_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/print/orders/PF-1201")
if [ "$PRINT_CODE" = "401" ]; then
  echo "OK   (no-token) /print/orders/PF-1201 → 401"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "FAIL (no-token) /print/orders/PF-1201 → $PRINT_CODE (expected 401)"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo
echo "passed: $PASS_COUNT  failed: $FAIL_COUNT"
if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
