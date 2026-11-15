#!/usr/bin/env bash
# بررسی زنده فاز ۵ — سرور پروداکشن‌بیلد روی پورت ۳۱۶۱
# همه بدنه‌های فارسی از فایل‌های JSON دقیق خوانده می‌شوند (جلوگیری از
# تغییر کدگذاری در پوسته).
BASE=http://localhost:3162
OUT=/d/tmp/phase5-verify.txt
RESP=/d/tmp/resp.json
BD=/d/tmp/bodies
CJ_A=/d/tmp/cj-admin.txt
CJ_P=/d/tmp/cj-prod.txt
CJ_S=/d/tmp/cj-sales.txt
: > "$OUT"

say() { echo -e "\n===================== $* =====================" >> "$OUT"; }
show() { echo "$*" >> "$OUT"; }

jqp() { python3 -c "import json,sys;d=json.load(sys.stdin);print($1)" < "$RESP" 2>/dev/null; }

#_req METHOD URL [BODYFILE|''] JAR
req() {
  local method=$1 url=$2 body=$3 jar=$4
  local code
  if [ -n "$body" ]; then
    code=$(curl -s -o "$RESP" -w "%{http_code}" -X "$method" "$BASE$url" \
      -H "Content-Type: application/json" --data-binary "@$body" -b "$jar" -c "$jar" 2>/dev/null)
  else
    code=$(curl -s -o "$RESP" -w "%{http_code}" -X "$method" "$BASE$url" \
      -b "$jar" -c "$jar" 2>/dev/null)
  fi
  echo ">> $method $url -> $code" >> "$OUT"
  head -c 2600 "$RESP" >> "$OUT"
  echo "" >> "$OUT"
  echo "$code"
}

PID=cmwbymjva0000nzqwinswwja8   # BR-101 پنل سه‌بعدی گچی (خط prod)

say "0) سلامت سرور"
req GET /api/health "" /dev/null

say "1) ورود admin"
req POST /api/auth/login "$BD/login-admin.json" "$CJ_A"

say "2) موجودی اولیه + کاتالوگ + لیست کارها"
req GET /api/stock "" "$CJ_A"
req GET "/api/catalog/products" "" "$CJ_A"
req GET "/api/jobs" "" "$CJ_A"

say "3) ایجاد کار ۱ با BOM (qty=100)"
req POST /api/jobs "$BD/job-create.json" "$CJ_A"
JOB1=$(jqp "d.get('id','')")
show "JOB1=$JOB1"

say "4) جزئیات کار ۱ (bomSnapshot ذخیره‌شده)"
req GET "/api/jobs/$JOB1" "" "$CJ_A"
show "bomSnapshot=$(jqp "json.dumps(d.get('bomSnapshot',''),ensure_ascii=False)")"

say "5) شروع کار ۱ (plan->run + حرکت‌های use)"
req POST "/api/jobs/$JOB1/start" "$BD/empty.json" "$CJ_A"

say "5b) پایان تولید کار ۱ (run->qc، معادل data-jmade دمو)"
req PATCH "/api/jobs/$JOB1" "$BD/job-made.json" "$CJ_A"

say "6) کنترل کیفیت کار ۱ — سالم ۹۰ + ضایعات ۵ (مجموع ۹۵ <= 100)"
req POST "/api/jobs/$JOB1/qc" "$BD/job1-qc.json" "$CJ_A"

say "7) دریافت حاصل کار ۱ در دپو (sent->done + حرکت job)"
req POST "/api/jobs/$JOB1/receive" "$BD/job-receive.json" "$CJ_A"

say "8) کار ۲ برای تست رد QC — ایجاد + شروع"
req POST /api/jobs "$BD/job-create.json" "$CJ_A"
JOB2=$(jqp "d.get('id','')")
show "JOB2=$JOB2"
req POST "/api/jobs/$JOB2/start" "$BD/empty.json" "$CJ_A"
say "8b) پایان تولید کار ۲ (run->qc)"
req PATCH "/api/jobs/$JOB2" "$BD/job-made.json" "$CJ_A"

say "9) QC کار ۲ — سالم ۸۰ + ضایعات ۳۰ (مجموع ۱۱۰ > 100) — انتظار ۴۰۰"
req POST "/api/jobs/$JOB2/qc" "$BD/job2-qc.json" "$CJ_A"

say "10) موجودی و حرکت‌ها بعد از عملیات کارها"
req GET /api/stock "" "$CJ_A"
req GET /api/moves "" "$CJ_A"

say "11) وضعیت سفارش‌های PF-1204 و PF-1206"
req GET "/api/orders/PF-1204" "" "$CJ_A"
S1204=$(jqp "d.get('stage')")
show "PF-1204 stage=$S1204"
req GET "/api/orders/PF-1206" "" "$CJ_A"
S1206=$(jqp "d.get('stage')")
show "PF-1206 stage=$S1206"

# --- هدایت PF-1204 از مرحله فعلی تا done ---
if [ "$S1204" = "5" ]; then
  say "12) قطعی‌سازی PF-1204 (۵→۶)"
  req POST /api/orders/PF-1204/stage "$BD/order-finalize.json" "$CJ_A"
fi
if [ "$S1204" = "5" ] || [ "$S1204" = "6" ]; then
  say "13) پذیرش تولید PF-1204 (۶→۷)"
  req POST /api/orders/PF-1204/stage "$BD/order-paccept.json" "$CJ_A"
fi
say "14) شروع تولید PF-1204 (حرکت‌های use)"
req POST /api/orders/PF-1204/stage "$BD/order-startprod.json" "$CJ_A"
say "15) پایان تولید PF-1204 (۷→۸)"
req POST /api/orders/PF-1204/stage "$BD/order-made.json" "$CJ_A"
say "16) کنترل کیفیت PF-1204 (۸→۹ + سند TR-1204)"
req POST /api/orders/PF-1204/stage "$BD/order-qc.json" "$CJ_A"
say "17) دریافت بار PF-1204 در دپو (حرکت‌های prod با ref=TR-1204)"
req POST /api/orders/PF-1204/stage "$BD/order-receive.json" "$CJ_A"
say "18) دریافت دوگانه PF-1204 — انتظار ۴۰۹ (idempotency)"
req POST /api/orders/PF-1204/stage "$BD/order-receive.json" "$CJ_A"
say "19) قبول در انبار PF-1204 (۹→۱۰)"
req POST /api/orders/PF-1204/stage "$BD/empty.json" "$CJ_A"
say "20) آماده‌سازی PF-1204 (۱۰→۱۱)"
req POST /api/orders/PF-1204/stage "$BD/order-prep.json" "$CJ_A"
say "21) تحویل PF-1204 (→done + حرکت‌های sale)"
req POST /api/orders/PF-1204/stage "$BD/order-deliver.json" "$CJ_A"

# --- هدایت PF-1206 (آژانسی: پرش مراحل تولید) ---
if [ "$S1206" = "5" ]; then
  say "22) قطعی‌سازی PF-1206 (۵→۹ پرش تولید)"
  req POST /api/orders/PF-1206/stage "$BD/order-finalize-agency.json" "$CJ_A"
fi
if [ "$S1206" = "9" ]; then
  say "23) آماده‌سازی PF-1206 (۹→۱۰)"
  req POST /api/orders/PF-1206/stage "$BD/order-prep2.json" "$CJ_A"
  say "24) تحویل PF-1206 (→done + حرکت sale)"
  req POST /api/orders/PF-1206/stage "$BD/order-deliver.json" "$CJ_A"
fi

say "25) موجودی نهایی — انبار دپو باید تابع حرکت‌ها باشد"
req GET /api/stock "" "$CJ_A"
req GET /api/moves "" "$CJ_A"
req GET "/api/orders/PF-1204" "" "$CJ_A"
show "PF-1204 final stage=$(jqp "d.get('stage')"), handoffs=$(jqp "json.dumps(d.get('handoffs',''),ensure_ascii=False)")"

say "26) نقش production (prod1) — ۲۰۰ و بدون فیلد پولی"
req POST /api/auth/login "$BD/login-prod.json" "$CJ_P"
req GET /api/jobs "" "$CJ_P"
show "jobs money keys: $(jqp "str([k for k in d.get('items',[{}])[0].keys() if k in ('price','value','cost')])")"
show "jobs sample keys: $(jqp "str(list(d.get('items',[{}])[0].keys()))")"
req GET /api/stock "" "$CJ_P"
show "stock money keys: $(jqp "str([k for k in d.get('items',[{}])[0].keys() if k in ('price','value','cost')])")"
show "stock sample keys: $(jqp "str(list(d.get('items',[{}])[0].keys()))")"
req GET /api/catalog/materials "" "$CJ_P"
show "materials money keys: $(jqp "str([k for k in d.get('items',[{}])[0].keys() if k in ('price','value','cost')])")"
show "materials sample keys: $(jqp "str(list(d.get('items',[{}])[0].keys()))")"
req GET /api/catalog/products "" "$CJ_P"
show "products money keys: $(jqp "str([k for k in d.get('items',[{}])[0].keys() if k in ('price','value','cost')])")"
show "products sample keys: $(jqp "str(list(d.get('items',[{}])[0].keys()))")"
req GET /api/moves "" "$CJ_P"
show "moves money keys: $(jqp "str([k for k in d.get('items',[{}])[0].keys() if k in ('price','value','cost')])")"

say "27) نقش sales (ali-sales) — بدون مجوز production → ۴۰۳"
req POST /api/auth/login "$BD/login-sales.json" "$CJ_S"
req GET /api/jobs "" "$CJ_S"
req POST /api/jobs "$BD/job-create.json" "$CJ_S"
req POST "/api/jobs/$JOB1/start" "$BD/empty.json" "$CJ_S"

say "28) نشست بدون ورود — ۴۰۱"
req GET /api/jobs "" /dev/null

say "29) جزئیات نهایی کار ۱"
req GET "/api/jobs/$JOB1" "" "$CJ_A"

say "پایان"
echo "DONE" >> "$OUT"
