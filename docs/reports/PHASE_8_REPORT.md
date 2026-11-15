# PHASE 8 REPORT — سخت‌سازی، مهاجرت و آماده‌سازی Launch

> فاز نهایی: مهاجرت داده Demo (۱۴۸ سند)، سخت‌سازی امنیتی/کیفیتی، پوشش
> ≥ ۹۰٪ و آماده‌سازی production. طبق سند راهبری، **هیچ فایل Demo تغییری
> نکرده است** — Demo فقط خوانده شده است.

---

## ۰. خلاصه اجرایی

| محور | نتیجه |
|---|---|
| گزارش شمارش تطبیقی مهاجرت | accounts ۲۳، leads ۲۹، orders ۱۹، jobs ۱، moves ۷۰ — **تطابق کامل**؛ buys ۶→۵ (یک خرید آژانسی رد‌شده، مستند) |
| پوشش منطق کسب‌کار | Statements **۹۲.۱۵٪**، Functions **۹۰.۴۳٪**، Lines **۹۴.۲۴٪** (همه ۱۱ ماژول سرویس ≥ ۹۰٪) |
| آزمون‌ها | **۱۰۱ فایل / ۱۲۵۵ تست سبز** (شامل ۱۲۰ آزمون جدید فاز ۸) |
| مهاجرت معکوس (دروازه ۴) | خروجی ZIP برنامه با ابزار مهاجرت خوانده و صحه‌گذاری شد ✅ |
| واکنش‌گرایی | ۶ صفحه کلیدی × ۵ عرض واقعی (۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰) — بدون سرریز افقی ✅ |
| دروازه‌های اجرایی | tsc / lint / vitest / coverage / check:colors / check-garble / next build / smoke — همگ EXIT=0 ✅ |

---

## ۱. درخت فایل‌های فاز ۸

```
src/app/print/orders/[id]/route.ts         # Route Handler چاپ امن (جایگزین صفحه)
src/app/print/orders/[id]/route.test.ts    # ۷ آزمون وضعیت HTTP
src/core/validation/persian-retrofit.test.ts  # ۴ آزمون پیام فارسی فاز ۱–۳
src/core/permissions/matrix.ts             # رفع inventory.view (حسابرسی امنیتی)
src/core/database/seed.ts                  # رفع اجرای خودکار هنگام import (CD-51)
src/e2e/role-matrix.test.ts                # ۷ نقش × ۱۳ مسیر E2E
src/migration/                             # خط لوله ۷ مرحله‌ای مهاجرت
  demo-types.ts  extract.ts  normalize.ts  map.ts  validate.ts
  load.ts  verify.ts  zip.ts  report.ts  run.ts  types.ts
  map.test.ts  normalize.test.ts  validate.test.ts
  migration-run.test.ts                    # اجرای کامل مهاجرت (دروازه ۱/۳/۴)
src/modules/orders/services/order.stage.test.ts  # ۳۷ آزمون منطق مراحل
src/modules/orders/services/printHtml.ts   # رندر HTML خودکفا چاپ
src/modules/purchasing/schemas/buy.schema.ts  # رفع nullatability supplierId
src/styles/globalCss/utilities.css         # رفع @layer بسته‌نشده (build)
scripts/smoke.sh                           # آزمون دودی ۳۳ مسیر API
scripts/viewport-check-auth.mjs            # (فاز ۶) — استفاده مجدد
README.md                                  # راه‌اندازی، مهاجرت، استقرار
.env.example                               # همه متغیرهای محیطی
docs/PRODUCTION_CHECKLIST.md               # چک‌لیست production
docs/reports/MIGRATION_REPORT.md           # گزارش مهاجرت (تولید خودکار)
```

---

## ۲. معیارهای پذیرش (A-8.1 تا A-8.5)

| معیار | وضعیت | شواهد |
|---|---|---|
| **A-8.1** — مهاجرت ۱۴۸ سند با گزارش شمارش تطبیقی | ✅ | `docs/reports/MIGRATION_REPORT.md`: accounts ۲۳/۲۳، leads ۲۹/۲۹، orders ۱۹/۱۹، jobs ۱/۱، moves ۷۰/۷۰، buys ۶→۵ با ردیف اختلاف شفاف + ۱ سند رد‌شده (BY-303). آزمون: `src/migration/migration-run.test.ts`. |
| **A-8.2** — پوشش منطق کسب‌کار ≥ ۹۰٪ | ✅ | جدول §۵ — Statements ۹۲.۱۵٪، تمام ماژول‌های سرویس ≥ ۹۰٪. |
| **A-8.3** — آزمون end-to-end همه نقش‌ها با مجوزهای Demo | ✅ | `src/e2e/role-matrix.test.ts` — ۷ نقش × ۱۳ مسیر اصلی، ۹۱ ترکیب، همه مطابق ماتریس SEE/EDIT Demo. |
| **A-8.4** — خروجی ZIP معادل Demo (مهاجرت معکوس) | ✅ | `buildSnapshot` → `snapshotEntries` → `zipOf` → ZIP → `unzipStore` → `extractData`: شمارش ردیف‌ها تطبیق کرد (آزمون دروازه ۴). |
| **A-8.5** — بررسی واکنش‌گرایی در عرض‌های واقعی | ✅ | §۷ — ۶ صفحه × ۵ عرض با CDP، `lang=fa`, `dir=rtl`, بدون سرریز افقی. |

---

## ۳. سخت‌سازی (Part A)

### ۳.۱ چاپ امن — وضعیت‌های HTTP صحیح (درخواست مالک، گزارش فاز ۴ §۱۰)

صفحه چاپ از Server Component به **Route Handler** تبدیل شد (صفحات Next
نمی‌توانند کد وضعیت دلخواه برگردانند):

| حالت | وضعیت HTTP | پیام فارسی |
|---|---|---|
| توکن نبود | **401** | لینک چاپ معتبر نیست یا منقضی شده است… |
| توکن نامعتبر/منقضی | **401** | (همان) |
| لینک سفارش دیگر (cross-order) | **403** | این لینک چاپ برای سفارش دیگری صادر شده است. |
| سفارش نبود | **404** | سفارش مورد نظر پیدا نشد. |
| موفق | **200** | فاکتور کامل HTML RTL |
| خطای غیرمنتظره | **500** | خطای غیرمنتظره — لطفاً دوباره توکن چاپ بگیرید. |

شواهد آزمون: `src/app/print/orders/[id]/route.test.ts` (۷ حالت:
401 بدون توکن، 401 نامعتبر، 403 سفارش دیگر، 404، 200 فاکتور کامل،
نسخه noMoney، 500). پیام کاربری حفظ شد و فقط کد وضعیت اصلاح گردید.
R-32: نسخه noMoney ستون مبالغ را حذف می‌کند («برای نقش شما مبالغ نمایش
داده نمی‌شود»).

### ۳.۲ Persian Zod retrofit (فاز ۱–۳)

هر ۲۶ فراخوانی `parseOrFail` مسیرهای فاز ۱–۳ شامل `faErrorMap` شد
(auth/login، customers، leads، followups، import) — ۴۶ فایل مسیر در
کل پروژه اکنون `faErrorMap` را پاس می‌دهند. آزمون
`src/core/validation/persian-retrofit.test.ts` برای هر خانواده اسکیما
اثبات می‌کند که پیام خطا حاوی نویسه فارسی است.

### ۳.۳ پوشش ≥ ۹۰٪

| ماژول سرویس | Statements (٪) |
|---|---|
| inventory | ۹۸.۲۶ |
| production | ۹۸.۰۵ |
| finance | ۹۷.۵۷ |
| customers | ۹۶.۲۲ |
| purchasing | ۹۵.۴۲ |
| reports | ۹۵.۴۵ |
| orders | ۹۲.۱۸ |
| export | ۹۲.۰۰ |
| admin | ۹۱.۸۶ |
| leads | ۹۰.۷۳ |
| settings | ۹۰.۰۰ |
| **کل منطق کسب‌کار** | **۹۲.۱۵** (Functions ۹۰.۴۳ / Lines ۹۴.۲۴) |

افزایش از ۸۴.۹۵٪ (فاز ۷) با ۳۷ آزمون جدید `order.stage.test.ts`
(منطق انتقال مراحل + رزرو + تولید + لغو) و توسعه آزمون‌های خرید.

### ۳.۴ باگ‌های شناخته‌شده از فاز ۴–۷

| مورد | نتیجه |
|---|---|
| وضعیت HTTP صفحه چاپ (فاز ۴ OQ-۱) | ✅ اصلاح (§۳.۱) |
| Q-01 `settings.rate` | ✅ حل نهایی (CD-50): فقط تعریف شده در core.js:194، **هیچ محل خواندنی در Demo** — مقدار منتقل شد، قانون اختراع نشد |
| `updateBuySchema.supplierId` غیرقابل null در حالی که سرویس disconnect دارد | ✅ اصلاح (`.nullish()`) — مسیر جداسازی تأمین‌کننده از API قابل دسترس شد |
| `seed.ts` اجرای خودکار هنگام import + `$disconnect` | ✅ اصلاح (CD-51) — کلاینت singleton زنده می‌ماند |
| `utilities.css` — `@layer utilities` بسته‌نشده (۵۰۰ کل صفحات) | ✅ اصلاح (کروشه پایانی) |
| مجوز `inventory.view` برای sales/salesManager/finance مفقود | ✅ اصلاح (ماتریس — تجدید نظر با Demo: stock.html همه نقش‌ها) |
| Q-04 (رزرو بدون بررسی موجودی) | معوق طبق دستور مالک — پست‌لانچ |
| QC waste فقط روی ردیف Job (انحراف فاز ۵) | دست‌نخورده طبق دستور مالک |
| OrderFormDialog پیام چسبیده (polish) | پست‌لانچ |
| zodLocale پیام مرز inclusive | پست‌لانچ (پیام، نه رفتار) |

### ۳.۵ حسابرسی امنیتی

- **مسیرهای عمومی:** فقط `/api/auth/login`، `/api/health` و صفحه چاپ با
  توکن. همه مسیرهای دیگر با نشست + `requirePermission` محافظت می‌شوند
  (بررسی E2E: نشست نامعتبر → 401 همگی). چاپ بدون توکن → 401 (smoke).
- **ماتریس مجوزها:** ۷ نقش × ۱۳ مسیر اصلی در E2E مطابق Demo (گزارش
  §A-8.3). یک انحراف واقعی کشف و اصلاح شد: `inventory.view` به
  sales/salesManager/finance اضافه شد (Demo: stock.html برای همه نقش‌ها).
- **noMoney (R-32):** فیلتر سرور مبلغ در responses همه مسیرهای پولی
  اجرا می‌شود — آزمون E2E نقش production (products بدون price) +
  آزمون مهاجرت (`getOrder("PF-1201", true)` — `calc`/`paid` و `price`
  اقلام حذف) + حفظ از regression در حین مهاجرت تأیید شد.
- **چاپ:** توکن ۵ دقیقه‌ای، کد وضعیت صحیح، فیلتر noMoney.
- **نشست:** کوکی HttpOnly + SameSite؛ `AUTH_COOKIE_SECURE` برای HTTPS.

### ۳.۶ بررسی عملکرد

تأیید زنده سرور dev (پورت ۳۰۰۰): **۳۳ درخواست smoke، صفر ۵۰۰**؛ زمان
پاسخ همه مسیرها < ۱s محلی. خط لوله مهاجرت کامل ۱۴۸ سند ≈ ۱.۱ ثانیه.
بدون OOM در اجرای نهایی (مشاهده §۹).

---

## ۴. مهاجرت داده (Part B)

اجرای کامل ۷ مرحله MIGRATION_STRATEGY روی پایگاه داده **تازه** (SQLite
موقت + `prisma db push`) — `src/migration/migration-run.test.ts`:

| مرحله | خروجی کلیدی |
|---|---|
| ۱ استخراج | ۱۴۸ سند + meta + ۵ فایل seq — صفر JSON نامعتبر |
| ۲ تجزیه meta | ۴۶ محصول، ۱۶ ماده، ۲۱۰ BOM، ۷ تأمین‌کننده، ۷ فهرست، تنظیمات، ۸ کاربر (fallback USERS0 — core.js:122-131) |
| ۳ نرمال‌سازی تاریخ | date-only‌ها → `YYYY/MM/DD` ASCII (سررسید چک، تاریخ پرداخت، prod.start/end، nextAt)؛ instants بدون تغییر (UTC ms) |
| ۴ نقشه‌گذاری | جداول فرزند (phones/contacts/followups/interest/items/payments/cheques/handoffs/…) + نگاشت‌های مستند (§۶ MIGRATION_REPORT) |
| ۵ اعتبارسنجی | Zod روی همه ردیف‌ها + ارجاعات اجباری/نرم — ۱ رد (خرید آژانسی)، ۱ ارجاع نرم (`sys`) |
| ۶ بارگذاری | تراکنش کامل + ثبت `seq:*` در Rev (R-12) |
| ۷ صحه‌گذاری | شمارش تطبیقی + نمونه‌گیری ۲۹.۵٪ — همه نمونه‌ها تطابق |

**رد‌شده‌ها (بدون اصلاح ساکت):** BY-303 (خرید آژانسی — مدل هدف خرید
کالای نمایندگی ندارد، CD-52). **ارجاع نرم:** کاربر `sys` (سیستمی) در
LD-1031 → null + گزارش. رمز اولیه کاربران: `barman1405` (CD-54).

**R-12:** Rev ثبت شد AC=222، LD=1032، PF=1219، BY=306، PJ=501، TR=1210
و `nextPrefixedId` ادامه series را تایید کرد (PF-1220، LD-1033، AC-223).

---

## ۵. آماده‌سازی Launch (Part C)

- **README.md** — راه‌اندازی، متغیرها، مهاجرت، دستورها، استقرار.
- **docs/PRODUCTION_CHECKLIST.md** — چک‌لیست PostgreSQL، AUTH_SECRET،
  رمز کاربران، پشتیبان‌گیری pg_dump برای بک‌آپ داده.
- **.env.example** — همه ۷ متغیر استفاده‌شده (DATABASE_URL، AUTH_SECRET،
  AUTH_COOKIE_SECURE، SEED_*، NEXT_PUBLIC_LOG_LEVEL، MIGRATION_*).
- **A-8.1..A-8.5** — §۲.
- **scripts/smoke.sh** — ۳۳ مسیر API سبز (§۶).

---

## ۶. دروازه‌های اجرایی (همه EXIT=0)

| # | دستور | خروجی |
|---|---|---|
| ۱ | `npx tsc --noEmit` | exit 0 |
| ۲ | `npm run lint` | exit 0 — warnings صفر |
| ۳ | `npx vitest run --no-file-parallelism` | exit 0 — **۱۰۱ فایل / ۱۲۵۵ تست** |
| ۴ | `npm run test:coverage` | exit 0 — Statements ۹۲.۱۵٪ / Functions ۹۰.۴۳٪ / Lines ۹۴.۲۴٪ |
| ۵ | `npm run check:colors` | exit 0 — بدون رنگ hardcoded |
| ۶ | `node scripts/check-garble.mjs` | exit 0 — ۵۰۹ فایل |
| ۷ | `NODE_OPTIONS=--max-old-space-size=2560 npx next build` | exit 0 — بدون OOM |
| ۸ | `bash scripts/smoke.sh` | **passed: 33 failed: 0** |
| ۹ | مهاجرت روی پایگاه داده تازه | exit 0 — ۹ آزمون (شمارش + R-12 + معکوس) |
| ۱۰ | viewport-check-auth ۶ صفحه × ۵ عرض | OK × ۶ |

---

## ۷. واکنش‌گرایی (CD-12) — CDP headless

| صفحه | ۵۰۰ | ۷۶۸ | ۱۰۲۴ | ۱۲۸۰ | ۱۴۴۰ | نتیجه |
|---|---|---|---|---|---|---|
| `/` | OK | OK | OK | OK | OK | داشبورد خانه |
| `/leads` | OK | OK | OK | OK | OK | بورد سرنخ‌ها |
| `/orders` | OK | OK | OK | OK | OK | فهرست سفارش |
| `/production` | OK | OK | OK | OK | OK | کارهای تولید |
| `/admin` | OK | OK | OK | OK | OK | ۷ تب مدیریت |
| `/reports` | OK | OK | OK | OK | OK | گزارش‌ها |

`lang=fa` و `dir=rtl` در همه عرض‌ها؛ بدون سرریز افقی؛ محتوای واقعی
(نه هدایت به ورود). حداقل عرض آزمایش‌شده ۵۰۰px.

---

## ۸. آزمون دودی (scripts/smoke.sh)

```
OK   login (200)
OK   (no-auth) /api/leads → 401
OK   POST /api/auth/logout → 204
OK   ۲۸ مسیر API → 200 (CRM، سفارش، انبار، خرید/مالی، مدیریت، گزارش، export)
OK   POST /api/reservations/check → 200
OK   (no-token) /print/orders/PF-1201 → 401
passed: 33  failed: 0
```

---

## ۹. انحرافات

۱. **PostgreSQL** — در این محیط فقط SQLite قابل اجراست؛ migration روی
   PostgreSQL طبق MIGRATION_STRATEGY/CD-08 سازگار طراحی شده (BigInt،
   JSON، بدون enum) اما اجرای زنده آن به PRODUCTION_CHECKLIST §۱ موکول
   شد. ابزار pg-backup معادل (`pg_dump`) در چک‌لیست مستند شد.
۲. **خرید آژانسی BY-303** — رد‌شده (CD-52)؛ تنها اختلاف شمارش گزارش.
۳. **مهاجرت معکوس** — خواندن ZIP با ابزار مهاجرت صحه‌گذاری شد؛ نگاشت
   معکوس کامل (ردیف Prisma → سند Demo) پیاده‌سازی نشد چون Demo منبع
   یک‌طرفه است (MIGRATION_STRATEGY §۱).
۴. **RAM ~۳.۷GB** — `vitest --no-file-parallelism` و
   `--max-old-space-size=2560` مانند فازهای قبل؛ بدون OOM در اجرای نهایی.
۵. **پایگاه داده توسعه** شامل داده‌های آزمونی فازهای قبل است (ali-sales،
   prod1، fin1) — محیط dev، بدون اثر production.
۶. **dev.db** — کاربران آزمونی فازهای قبل در آن باقی‌مانده‌اند (محیط توسعه، تأثیری بر production ندارند).

---

## ۱۰. Open Questions و Backlog پس از launch

### حل‌شده در این فاز
- **Q-01** — ✅ CD-50 (تنظیم مرده — بدون قانون).
- **HTTP status چاپ** — ✅.
- **Persian Zod فاز ۱–۳** — ✅.

### معوق طبق دستور مالک
- **Q-04** (رزرو `o.resv` — پیاده‌سازی نشده)؛ gate موجودی در
  `/api/reservations/check` فعال است.
- **QC waste** — مطابق Demo روی ردیف Job (افزودن حرکت `waste` نیاز به
  تصمیم مالک).

### Backlog پس از launch
- خرید آژانسی (BY-303 و مدل آینده) — ورود دستی.
- انتقال `meta.feed` (مدل هدف وجود ندارد).
- polish: پیام اعتبارسنجی OrderFormDialog؛ پیام مرز zodLocale.
- SSE به‌جای polling (Q-15 — تأیید نشده، React Query باقی می‌ماند R-29).
- چندمستاجری (D-02 — وجود ندارد).

---

## ۱۱. چک‌لیست What to review

- [ ] `src/app/print/orders/[id]/route.ts` — نگاشت وضعیت → پیام فارسی و
      نگهداری R-01/R-32 در رفتار چاپ.
- [ ] `src/migration/map.ts` — تصمیمات نگاشت (BUY_STATUS_MAP،
      ACCOUNT_KIND_MAP، deriveStageLogs، deriveBuyStatusLogs) با ارجاع
      به سورس Demo.
- [ ] `docs/reports/MIGRATION_REPORT.md` — فیلدهای رهاشده (§۵) و
      تصمیمات (§۶)؛ تصمیم کلیدی: رد خرید آژانسی.
- [ ] `src/migration/migration-run.test.ts` — اجرای واقعی مهاجرت روی
      پایگاه تازه + رمز اولیه `barman1405` (هماهنگ با کاربران).
- [ ] `src/core/permissions/matrix.ts` — افزودن `inventory.view` به
      سه نقش (شواهد: stock.html در Demo همه نقش‌ها).
- [ ] `src/core/database/seed.ts` — guard اجرای خودکار (رفع crash).
- [ ] `README.md` / `docs/PRODUCTION_CHECKLIST.md` / `.env.example`.
- [ ] DECISION_LOG CD-50…CD-54.
