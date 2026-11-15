#!/usr/bin/env bash
# دروازه‌های خروج باقی‌مانده فاز ۵ (PHASE_05 §۱۶): حرکت دستی، هشدار آستانه،
# ویرایش حرکت سیستمی، مجوز حرکت.
BASE=http://localhost:3162
OUT=/d/tmp/phase5-verify3.txt
RESP=/d/tmp/resp.json
BD=/d/tmp/bodies
CJ_A=/d/tmp/cj-admin.txt
CJ_S=/d/tmp/cj-sales.txt
: > "$OUT"

say() { echo -e "\n===================== $* =====================" >> "$OUT"; }

req() {
  local method=$1 url=$2 body=$3 jar=$4
  local code
  if [ -n "$body" ]; then
    code=$(curl -s -o "$RESP" -w "%{http_code}" -X "$method" "$BASE$url" \
      -H "Content-Type: application/json" --data-binary "@$body" -b "$jar" 2>/dev/null)
  else
    code=$(curl -s -o "$RESP" -w "%{http_code}" -X "$method" "$BASE$url" -b "$jar" 2>/dev/null)
  fi
  echo ">> $method $url -> $code" >> "$OUT"
  head -c 2000 "$RESP" >> "$OUT"
  echo "" >> "$OUT"
  echo "$code"
}

printf '{"wh":"raw","itemId":"RM-101","qty":10,"kind":"open","note":"افتتاحیه آزمون دروازه ۱"}' > "$BD/move-open.json"
printf '{"wh":"raw","itemId":"RM-101","qty":4,"kind":"out","note":"خروج دستی آزمون دروازه ۱"}' > "$BD/move-out.json"
printf '{"qty":5}' > "$BD/move-edit.json"

say "G1a) موجودی RM-101 قبل از حرکت‌های دستی"
req GET "/api/stock?q=RM-101" "" "$CJ_A"

say "G1b) ثبت حرکت دستی open (انتظار ۲۰۱)"
req POST /api/moves "$BD/move-open.json" "$CJ_A"

say "G1c) ثبت حرکت دستی out (انتظار ۲۰۱)"
req POST /api/moves "$BD/move-out.json" "$CJ_A"

say "G1d) موجودی RM-101 بعد از +۱۰ -۴ (مجموع جبری)"
req GET "/api/stock?q=RM-101" "" "$CJ_A"

say "G4) هشدار آستانه حداقل — GET /api/stock/alerts"
req GET /api/stock/alerts "" "$CJ_A"

say "G5a) ویرایش حرکت سیستمی kind=sale (انتظار ۴۰۰/۴۰۳)"
req PATCH /api/moves/mvmwd9f3xvx8at "$BD/move-edit.json" "$CJ_A"

say "G5b) ویرایش حرکت سیستمی kind=use (انتظار ۴۰۰/۴۰۳)"
MOVE_USE=$(python3 -c "import json;d=json.load(open('$RESP'));print('x')" 2>/dev/null)
req GET "/api/moves?kind=use&pageSize=1" "" "$CJ_A"
USE_ID=$(python3 -c "import json;d=json.load(open('$RESP'));print(d['items'][0]['id'])")
show() { echo "$*" >> "$OUT"; }
show "USE_ID=$USE_ID"
req PATCH "/api/moves/$USE_ID" "$BD/move-edit.json" "$CJ_A"

say "G7) ثبت حرکت بدون مجوز inventory.moves (ali-sales — انتظار ۴۰۳)"
req POST /api/moves "$BD/move-out.json" "$CJ_S"

say "پایان"
echo "DONE" >> "$OUT"
