#!/usr/bin/env bash
# ادامه بررسی زنده فاز ۵ — تکمیل خط لوله سفارش و حرکت‌های prod/sale
BASE=http://localhost:3162
OUT=/d/tmp/phase5-verify2.txt
RESP=/d/tmp/resp.json
BD=/d/tmp/bodies
CJ_A=/d/tmp/cj-admin.txt
: > "$OUT"

say() { echo -e "\n===================== $* =====================" >> "$OUT"; }
show() { echo "$*" >> "$OUT"; }

req() {
  local method=$1 url=$2 body=$3
  local code
  if [ -n "$body" ]; then
    code=$(curl -s -o "$RESP" -w "%{http_code}" -X "$method" "$BASE$url" \
      -H "Content-Type: application/json" --data-binary "@$body" -b "$CJ_A" 2>/dev/null)
  else
    code=$(curl -s -o "$RESP" -w "%{http_code}" -X "$method" "$BASE$url" -b "$CJ_A" 2>/dev/null)
  fi
  echo ">> $method $url -> $code" >> "$OUT"
  head -c 3000 "$RESP" >> "$OUT"
  echo "" >> "$OUT"
  echo "$code"
}

printf '{"action":"daccept","note":"بار طبق سند تحویل گرفته شد"}' > "$BD/order-daccept.json"

say "A) حرکت‌های prod (دریافت بار سفارش در دپو) — فیلتر kind=prod"
req GET "/api/moves?kind=prod" ""

say "B) قبول در انبار PF-1204 (۹→۱۰)"
req POST /api/orders/PF-1204/stage "$BD/order-daccept.json"

say "C) آماده‌سازی PF-1204 (۱۰→۱۱)"
req POST /api/orders/PF-1204/stage "$BD/order-prep.json"

say "D) تحویل PF-1204 (→done + حرکت sale)"
req POST /api/orders/PF-1204/stage "$BD/order-deliver.json"

say "E) آماده‌سازی PF-1206 (۱۰→۱۱)"
req POST /api/orders/PF-1206/stage "$BD/order-prep2.json"

say "F) تحویل PF-1206 (→done + حرکت sale)"
req POST /api/orders/PF-1206/stage "$BD/order-deliver.json"

say "G) حرکت‌های sale (خروج تحویل مشتری) — فیلتر kind=sale"
req GET "/api/moves?kind=sale" ""

say "H) حرکت‌های ورود تولید — فیلتر kind=job"
req GET "/api/moves?kind=job" ""

say "I) وضعیت نهایی هر دو سفارش"
req GET /api/orders/PF-1204 ""
req GET /api/orders/PF-1206 ""

say "J) موجودی نهایی دپو — فیلتر wh=depot"
req GET "/api/stock?wh=depot" ""

say "پایان"
echo "DONE" >> "$OUT"
