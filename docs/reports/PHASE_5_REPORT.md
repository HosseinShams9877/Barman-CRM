# PHASE_5_REPORT — تولید و انبار (Production & Warehouse)

> فاز: **۵ — تولید و انبار** طبق `docs/roadmap/PHASES/PHASE_05.md` و معیارهای `docs/roadmap/PHASE_ACCEPTANCE_CRITERIA.md` (A-5.1…A-5.4).
> ریشه پروژه: `D:\New folder\CRM-Barman`. پوشه Demo (`پلتفرم نهایی تیم بارمان/`) **فقط خوانده شد** — هیچ فایلی در آن نوشته/تغییر نکرد (دروازه خروج ۹).
> فایل‌های `.env.local` و `.secrets.local.json` در ریشه Demo وجود دارند؛ محتوایشان فاش یا کپی نشد (CLAUDE.md §۱).

---

## ۰. خلاصه

ماژول‌های `inventory` و `production` با وفاداری کامل به Demo (`app/stock.js`، `app/prod.js`، `app/core.js`) پیاده‌سازی شدند. **`moves` تنها منبع حقیقت موجودی است** — هیچ فیلد موجودی ذخیره‌شده‌ای وجود ندارد؛ موجودی هر بار با کوئری تجمیعی Prisma (`move.groupBy`) از جمع جبری `qty` محاسبه می‌شود. چرخه کامل کار تولید (`plan → run → qc → sent → done`) با کسر خودکار BOM، ثبت کیفیت و ورود به دپو پیاده و **به‌صورت زنده** روی سرور پروداکشن‌بیلد (پورت ۳۱۶۲) تأیید شد. اتصال فاز ۴ به فاز ۵ (سند `OrderHandoff` با پیشوند `TR-` → حرکت‌های `prod` و `sale`) نیز end-to-end تأیید شد.

**دروازه‌های خروج هدفمند (PHASE_05 §۱۶) — همه ۹ مورد سبز** (جدول کامل در §۲).

**دروازه‌های اجرایی (همه EXIT=0):** `tsc --noEmit`، `npm run lint`، `npx vitest run` (۵۹ فایل / ۷۹۶ تست — با `--no-file-parallelism`)، `npm run test:coverage`، `npm run check:colors`، `node scripts/check-garble.mjs` (۳۳۲ فایل)، `npx next build` (با `--max-old-space-size=2560`)، تأیید زنده curl (۵۵ درخواست، صفر ۵۰۰)، viewport-check روی ۳ صفحه در ۵ عرض.

---

## ۱. درخت فایل‌های ایجاد/تغییر یافته

### ایجاد شده (فاز ۵)

```
src/modules/inventory/
├── components/
│   ├── StockView.tsx              # جدول موجودی raw/depot با رنگ‌بندی کسری زیر min
│   ├── MovesTable.tsx             # لیست حرکت‌ها با فیلتر kind (۹ مقدار) + جستجو + صفحه‌بندی
│   ├── MoveFormDialog.tsx         # ثبت حرکت دستی (open/out/adj/waste)
│   └── EditMoveDialog.tsx         # ویرایش حرکت دستی (فقط open/out/adj)
├── constants/index.ts             # WAREHOUSES، MOVE_KINDS (۹)، MANUAL_ENTRY_KINDS، EDITABLE_KINDS، SIGN_BY_KIND
├── hooks/
│   ├── useMoves.ts                # کوئری لیست حرکت‌ها
│   ├── useCatalog.ts              # کوئری کاتالوگ محصولات/مواد
│   └── useMoveMutations.ts        # mutation ثبت/ویرایش/حذف حرکت
├── lib/kinds.ts                   # signedQty (علامت بر اساس kind)، isSystemKind
├── queries/{keys,invalidations}.ts
├── schemas/move.schema.ts         # Zod فارسی: createMoveSchema، updateMoveSchema، moveListQuerySchema، reservationCheckSchema
├── services/
│   ├── stock.service.ts           # computeOnHand (move.groupBy)، getStock، getStockAlerts، used30
│   └── move.service.ts            # createMove (guard موجودی)، updateMove (رد kind سیستمی)، deleteMove، listMoves
├── types/move.types.ts
└── index.ts

src/modules/production/
├── components/
│   ├── JobList.tsx                # لیست کارها با فیلتر وضعیت و جستجو
│   ├── JobDetail.tsx              # جزئیات کار: استپر وضعیت، BOM، دکمه‌های گذار
│   ├── JobFormDialog.tsx          # ایجاد کار با پیش‌نمایش زنده BOM
│   └── BomPreview.tsx             # پیش‌نمایش مواد لازم به ازای کل qty
├── constants/index.ts             # JOB_STATUS، JOB_STATUS_LABELS، JOB_STEP_NAMES، JOB_TRANSITIONS، JOB_ID_PREFIX
├── hooks/{useJobs,useJobMutations}.ts
├── queries/{keys,invalidations}.ts
├── schemas/job.schema.ts          # Zod فارسی: createJobSchema، updateJobSchema، qcSchema، receiveSchema
├── services/
│   ├── bom.service.ts             # computeBomNeed (انفجار BOM × qty)
│   └── job.service.ts             # قلب فاز: listJobs/createJob/startJob/updateJob/qcJob/receiveJob
├── types/job.types.ts
└── index.ts

src/app/api/
├── jobs/route.ts                  # GET لیست / POST ایجاد
├── jobs/[id]/route.ts             # GET جزئیات / PATCH گذار run→qc
├── jobs/[id]/start/route.ts       # POST plan→run + حرکت‌های use
├── jobs/[id]/qc/route.ts          # POST qc→sent + ثبت good/waste
├── jobs/[id]/receive/route.ts     # POST sent→done + حرکت job در دپو
├── moves/route.ts                 # GET لیست / POST ثبت دستی
├── moves/[id]/route.ts            # PATCH/DELETE ویرایش/حذف حرکت دستی
├── stock/route.ts                 # GET موجودی محاسبه‌شده
├── stock/alerts/route.ts          # GET مواد زیر آستانه min
└── catalog/{products,materials}/route.ts   # GET کاتالوگ (با فیلتر پولی R-32)

src/app/(app)/
├── production/page.tsx            # لیست کارهای تولید (/production)
├── production/[id]/page.tsx       # جزئیات کار (/production/PJ-503)
└── stock/page.tsx                 # موجودی و حرکت‌ها (/stock)

prisma/migrations/20261111161153_inventory_production_jobs/migration.sql
```

### تغییر یافته (فاز ۵)

```
prisma/schema.prisma          # افزودن مدل‌های Move، Job، OrderHandoff (§۳) + relation‌ها
scripts/phase5-verify.sh      # سناریوی تأیید زنده اصلی (۲۹ بخش)
scripts/phase5-verify2.sh     # تکمیل خط لوله سفارش (daccept/prep/delivery)
scripts/phase5-verify3.sh     # دروازه‌های باقی‌مانده §۱۶ (حرکت دستی، alerts، ویرایش سیستمی، ۴۰۳)
```

### ابزارهای پشتیبان (در طول فاز ساخته/استفاده شدند، در ریشه پروژه)

```
scripts/probe-stock.mjs       # بازرسی سریع موجودی از DB
scripts/probe-db.mjs          # بازرسی عمومی جداول
scripts/dev-reset-passwords.mjs  # بازنشانی گذرواژه‌های dev (admin/prod1/ali-sales)
scripts/aggregate-coverage.py   # تجمیع پوشش به ازای هر مسیر
scripts/viewport-check-auth.mjs  # بررسی واکنش‌گرایی با Chrome headless (CD-12)
```

### آزمون‌های فاز ۵

| فایل | تعداد تست |
|---|---|
| `production/services/job.service.test.ts` | ۲۹ |
| `production/schemas/job.schema.test.ts` | ۲۰ |
| `production/services/bom.service.test.ts` | ۱۲ |
| `inventory/services/move.service.test.ts` | ۲۷ |
| `inventory/schemas/move.schema.test.ts` | ۲۴ |
| `inventory/services/stock.service.test.ts` | ۱۷ |
| `inventory/lib/kinds.test.ts` | ۷ |
| **مجموع فاز ۵** | **۱۳۶ تست در ۷ فایل** |

---

## ۲. دروازه‌های خروج هدفمند (PHASE_05 §۱۶) — همه سبز

| # | دروازه | نتیجه | شواهد |
|---|---|---|---|
| ۱ | ثبت حرکت `open` و `out` و مشاهده موجودی محاسبه‌شده | ✅ | `POST /api/moves` open → **201** (`mvmwdan0f71v4g`, qty +10)؛ out → **201** (`mvmwdan0hwd89o`, qty −4 علامت‌دار در سرور)؛ RM-101: 251.9 → **257.9** دقیقاً برابر 251.9+10−4 |
| ۲ | جریان کامل کار تولید با BOM و موجودی نهایی | ✅ | PJ-503: ایجاد 201 با bomSnapshot، start 200 (۵ حرکت `use`)، PATCH 200 (run→qc)، QC 90/5 → 200، receive 90 → 200 (حرکت `job` qty 90 در دپو) |
| ۳ | good + waste > qty با خطای فارسی رد | ✅ | PJ-504 QC 80+30=110 > 100 → **400** «مجموع سالم و ضایعات (۱۱۰ مترمربع) نمی‌تواند بیشتر از مقدار کار (۱۰۰) باشد.» |
| ۴ | ماده زیر آستانه min در /api/stock/alerts | ✅ | **200** با ۲ مورد: RM-101 (onHand 251.9، min 2500، shortfall 2248.1) و RM-113 (83.685، min 100، shortfall 16.315) |
| ۵ | ویرایش حرکت سیستمی رد | ✅ | PATCH `kind=sale` (`mvmwd9f3xvx8at`) → **400** «این حرکت سیستمی است و قابل ویرایش نیست.»؛ PATCH `kind=use` (`mvmwd9aaw6i5ey`) → **400** |
| ۶ | نقش production پاسخ بدون قیمت/ارزش | ✅ | prod1: `noMoney:true`، ۵ endpoint همگی 200 با `money keys: []` (§۷) |
| ۷ | کاربر بدون مجوز `inventory.moves` نمی‌تواند حرکت ثبت کند | ✅ | ali-sales (sales) `POST /api/moves` → **403** «شما مجوز انجام این عملیات را ندارید.» |
| ۸ | صفحات در ۵ عرض بدون اسکرول افقی | ✅ | `/production`، `/production/PJ-503`، `/stock` در ۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰ — `viewport-check-auth: OK` (§۸) |
| ۹ | هیچ فایل Demo تغییری نکرده | ✅ | همه writeها در ریشه پروژه؛ Demo فقط با ابزار خوانده شد |

---

## ۳. مدل‌های Prisma افزودیده‌شده

### `Move` (جدول `moves`) — تنها منبع حقیقت موجودی

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `String @id` | `mv` + base36(timestamp) + تصادفی — `newMoveId()` (core.js:110) |
| `wh` | `String` | انبار: `"raw"` (مواد) یا `"depot"` (محصول) — app/stock.js:16 |
| `item` | `String` | شناسه محصول (depot) یا ماده خام (raw) |
| `qty` | `Float` | **مقدار علامت‌دار** — مجموع آن موجودی است (core.js:206) |
| `kind` | `String` | یکی از ۹ کلید `MOVE_KINDS` (app/stock.js:14) |
| `ref` | `String?` | شناسه سند مسبب (`PF-…` / `PJ-…`) — خالی برای حرکت‌های دستی |
| `at` | `BigInt` | زمان حرکت به UTC ms |
| `byUserId` | `String?` | ثبت‌کننده (خالی برای حرکت‌های سیستمی پیش از کاربر) |
| `note` | `String @default("")` | یادداشت |

ایندکس‌ها: `@@index([wh, item])`، `@@index([kind])`، `@@index([ref])`.

### `Job` (جدول `jobs`)

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `String @id` | `PJ-NNN` — `nextPrefixedId(JOB_ID_PREFIX, …)` (app/prod.js:119) |
| `productId` | `String` | محصول این کار (باید خط `prod` باشد — app/prod.js:74) |
| `qty` | `Float` | مقدار تولید (مثبت) |
| `color` | `String?` | رنگ انتخابی از رنگ‌های محصول |
| `end` | `BigInt?` | تاریخ پایان برنامه‌ریزی‌شده (پیش‌فرض امروز + ۳ روز — app/prod.js:75) |
| `status` | `String` | `plan \| run \| qc \| sent \| done` (app/prod.js:12) |
| `good` / `waste` | `Float?` | ثبت QC (`good + waste ≤ qty`) |
| `startedAt` / `qcAt` / `recvAt` | `BigInt?` | مهر زمانی هر گذار |
| `recvQty` | `Float?` | مقدار دریافت‌شده در دپو |
| `bomSnapshot` | `Json` | پیش‌نمایش BOM در زمان ایجاد `[{materialId, code, name, unit, qty, total, onHand, short}]` |
| `createdBy` | `String` | ایجادکننده |
| `createdAt` / `updatedAt` | `BigInt` | مهر زمانی |

ایندکس‌ها: `@@index([status])`، `@@index([productId])`.

### `OrderHandoff` (جدول `order_handoffs`) — پل فاز ۴ به فاز ۵

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `String @id` | `TR-1204` — `TR-${orderId.slice(3)}` |
| `orderId` | `String` | سفارش مسبب (Cascade) |
| `lines` | `Json` | اقلام تحویلی `[{productId, qty, color}]` |
| `at` | `BigInt` | زمان تحویل به UTC ms |
| `byUserId` | `String?` | ثبت‌کننده |
| `note` | `String @default("")` | یادداشت (مثلاً «سالم: ۱») |

---

## ۴. مسیرهای API افزودیده‌شده

الگوی ۵ مرحله‌ای CD-04 در همه مسیرها رعایت شد (auth → permission → Zod → service → response).

| روش | مسیر | مجوز (سرور) | کدهای وضعیت مشاهده‌شده |
|---|---|---|---|
| GET | `/api/jobs` | `production.view` | 200، 401، 403 |
| POST | `/api/jobs` | `production.edit` | 201، 400، 403 |
| GET | `/api/jobs/[id]` | `production.view` | 200، 404 |
| PATCH | `/api/jobs/[id]` | `production.edit` | 200 (run→qc)، 409 |
| POST | `/api/jobs/[id]/start` | `production.edit` | 200، 400 (کمبود مواد)، 403 |
| POST | `/api/jobs/[id]/qc` | `production.edit` | 200، 400 (good+waste>qty)، 409 |
| POST | `/api/jobs/[id]/receive` | `inventory.moves` | 200، 400 |
| GET | `/api/moves` | `inventory.view` | 200 (با فیلتر `wh`/`kind`/`q`/صفحه‌بندی) |
| POST | `/api/moves` | `inventory.moves` | 201، 400 (قلم ناموجود در کاتالوگ)، 403 |
| PATCH | `/api/moves/[id]` | `inventory.moves` | 200، 400 (حرکت سیستمی) |
| DELETE | `/api/moves/[id]` | `inventory.moves` | 204 |
| GET | `/api/stock` | `inventory.view` | 200 (با فیلتر `wh`/`q`) |
| GET | `/api/stock/alerts` | `inventory.view` | 200 |
| GET | `/api/catalog/products` | `catalog.view` | 200 |
| GET | `/api/catalog/materials` | `catalog.view` | 200 |

**نکته:** مجوزهای واقعی معادل dotted نام‌های `PHASE_05.md` هستند (`inventory.view` ≡ `inventory:read`، `inventory.moves` ≡ `inventory:write`، `production.view` ≡ `production:read`، `production.edit` ≡ `production:write`) — طبق CD-26.

---

## ۵. قوانین کسب‌کار با ارجاع Demo (CLAUDE.md §۱۳ — هیچ قانونی اختراع نشد)

| قانون | منبع Demo | محل اجرا |
|---|---|---|
| ۹ نوع حرکت: `open/buy/prod/sale/use/out/adj/waste/job` | `app/stock.js:14` | `inventory/constants/index.ts` MOVE_KINDS |
| دو انبار `raw`/`depot` | `app/stock.js:16` | WAREHOUSES |
| موجودی = جمع جبری `qty` (مثبت ورود، منفی خروج) | `app/core.js:206` | `stock.service.ts` computeOnHand |
| علامت‌دهی qty هنگام ثبت | `app/stock.js:69`، `app/stock.js:88` | `lib/kinds.ts` signedQty |
| انواع حرکت مجاز در نمای دپو | `app/stock.js:53` | MANUAL_ENTRY_KINDS / EDITABLE_KINDS |
| انواع حرکت مجاز در نمای مواد | `app/stock.js:86` | MANUAL_ENTRY_KINDS |
| آستانه حداقل: `m.min && h < m.min` | `app/stock.js:27` | `getStockAlerts` (inventory/services/stock.service.ts) |
| دریافت حاصل کار در دپو + یادداشت «ورود تولید برای انبار» | `app/stock.js:73` | `job.service.ts:341-352` (حرکت `job`) |
| هشدار غیرمسدودکننده عدم تطابق مقدار دریافت با مقدار سالم | `app/stock.js:77` | `job.service.ts:336` |
| فقط محصولات خط `prod` برای کار تولید | `app/prod.js:74` | `createJob` (job.service.ts) |
| پیش‌فرض تاریخ پایان: امروز + ۳ روز | `app/prod.js:75` | JOB_END_DEFAULT_DAYS |
| شناسه کار: `X.nextId("PJ")` | `app/prod.js:119` | JOB_ID_PREFIX + nextPrefixedId |
| شروع کار + کسر مواد (shortage guard) | `app/prod.js:121` | `startJob` (job.service.ts) |
| پایان تولید → گذار به QC | `app/prod.js:123` | `updateJob` (job.service.ts) — قرار گرفته روی PATCH |
| ثبت کیفیت (good/waste) | `app/prod.js:124` | `qcJob` (job.service.ts) |
| برچسب‌های وضعیت کار | `app/prod.js:12` | JOB_STATUS_LABELS |
| نام مراحل استپر | `app/prod.js:80` | JOB_STEP_NAMES |
| QC سفارش: `why` اجباری هنگام ضایعات | `app/order.js:520` | orders/schemas (فاز ۴ — سند `TR-`) |
| چک‌لیست آماده‌سازی (۳ مورد) | `app/order.js:562` | PREP_CHECKS (فاز ۴) |
| دریافت دوگانه بار سفارش → ۴۰۹ | رفتار idempotency سند دریافت | order service (فاز ۴) |

**یک قانون جدید صریحاً طبق مشخصات فاز (نه از Demo):** `good + waste ≤ qty` در `qcJob` (job.service.ts:293-297). نظر PHASE_05 §۳.۷/§۱۲ (دروازه خروج ۳) این قانون در Demo بررسی نشده ولی باید در سرور اجرا شود — پیام فارسی آن در §۲ دروازه ۳ شناسنامه‌سازی شد.

---

## ۶. انواع حرکت انبار و محرک‌های آنها

| kind | علامت | دستی/سیستمی | محرک |
|---|---|---|---|
| `open` | + | دستی | `POST /api/moves` — موجودی اول دوره |
| `buy` | + | سیستمی | رسید خرید — **فاز ۶** (در این فاز رخ نمی‌دهد) |
| `prod` | + | سیستمی | `receive` مرحله ۹ سفارش — ورود بار تولید به دپو با `ref=PF-…` و یادداشت «ورود تولید TR-…» |
| `sale` | − | سیستمی | `deliver` سفارش — خروج تحویل مشتری (`ref=PF-…`) |
| `use` | − | سیستمی | `POST /api/jobs/[id]/start` — مصرف مواد BOM در انبار raw با `ref=PJ-…` و یادداشت «تولید برای انبار PJ-…» |
| `out` | − | دستی | `POST /api/moves` — خروج دستی |
| `adj` | ± | دستی | `POST /api/moves` — اصلاح شمارش (مقدار علامت‌دار مستقیم) |
| `waste` | − | دستی | `POST /api/moves` — ضایعات |
| `job` | + | سیستمی | `POST /api/jobs/[id]/receive` — ورود حاصل کار به دپو با `ref=PJ-…` |

**حرکت‌های مشاهده‌شده زنده:** `use` (−810 ×2 برای PJ-503/PJ-504 در raw)، `job` (+90 برای PJ-503 در depot)، `prod` (+1 با `ref=PF-1204` یادداشت «ورود تولید TR-1204»، +3 برای PF-1206)، `sale` (−1 و −3 با `ref=PF-1204`/`PF-1206`)، `open` (+10)، `out` (−4).

**موجودی محاسبه‌شده (A-5.1):** RM-101 = 1871.9 (seed) − 810 (PJ-503) − 810 (PJ-504) + 10 (open) − 4 (out) = **257.9** — دقیقاً مطابق `/api/stock` و `/api/catalog/materials`. کوئری: `prisma.move.groupBy({ by: ["wh","item"], _sum: { qty: true } })`. **هیچ فیلد موجودی در schema وجود ندارد** (بررسی schema.prisma).

---

## ۷. اتصال OrderHandoff (فاز ۴) به moves (فاز ۵)

تأیید زنده end-to-end روی سفارش PF-1204:

1. `qc` مرحله ۸→۹ → ایجاد سند `OrderHandoff` با شناسه **`TR-1204`**:
   `{"id":"TR-1204","lines":[{"productId":…,"qty":1,"color":""}],"at":…,"byName":"admin","note":"سالم: ۱"}`
2. `receive` مرحله ۹ → ایجاد حرکت `prod` با `id: mvmwd8ij1ez7f6`:
   `{"wh":"depot","item":"BR-101","qty":1,"kind":"prod","ref":"PF-1204","note":"ورود تولید TR-1204"}`
3. `daccept` ۹→۱۰، `prep` ۱۰→۱۱ (packs:1 + هر ۳ PREP_CHECKS)، `deliver` → `status:"done"` با حرکت `sale` `mvmwd9f3xvx8at`:
   `{"qty":-1,"kind":"sale","ref":"PF-1204","note":"تحویل به مشتری"}`
4. دریافت دوگانه → **409** «بار این سفارش قبلاً در انبار ثبت شده است.»

**تعیین شماره‌گذاری (JAN/inventory):** پرسش باز فاز ۴ («Jan/inventory — حرکت‌های انبار (mv*) و اتصال به سند تحویل») در این فاز solved شد:
- **`mv*`**: `mv + Date.now().toString(36) + random` — بازسازی `uid("mv")` در `app/core.js:110` (شمارنده متوالی نیست، مطابق Demo). مشاهده‌شده: `mvmwd8ij1ez7f6`، `mvmwdan0f71v4g`.
- **`TR-*`**: `TR-${orderId.slice(3)}` — Document id روی `OrderHandoff` (data model، مطابق Demo).
- **`PJ-*`**: `nextPrefixedId` با شمارنده مستقل از وضعیت (CD-30 — اصلاح فاز ۴): PJ-503، PJ-504.
- **`PF-*`**: فاز ۴، همان قانون CD-30.
- **اتصال**: فیلد `Move.ref` سند مسبب را نگه می‌دارد (`PF-…`/`PJ-…`) و `OrderHandoff.id` در `note` حرکت `prod` قرینه می‌شود — کوئری `GET /api/moves?kind=prod` این زنجیره را قابل ردیابی می‌کند (تأیید زنده در `phase5-verify2.txt` بخش A).

---

## ۸. واکنش‌گرایی (CD-12 / A-5.x / دروازه ۸)

`node scripts/viewport-check-auth.mjs <url> /d/tmp/cj-admin.txt` با Chrome headless نصب‌شده (`C:/Program Files/Google/Chrome/Application/chrome.exe`) — نصب Playwright در این محیط ممکن نیست. خروجی کامل در `/d/tmp/phase5-viewport.txt`:

| صفحه | 500px | 768px | 1024px | 1280px | 1440px | نتیجه |
|---|---|---|---|---|---|---|
| `/production` (۴ ردیف) | 485/500 | 753/768 | 1024/1024 | 1280/1280 | 1440/1440 | OK |
| `/production/PJ-503` (۵ ردیف) | 485/500 | 753/768 | 1024/1024 | 1280/1280 | 1440/1440 | OK |
| `/stock` (۳۶ ردیف) | 485/500 | 753/768 | 1009/1024 | 1265/1280 | 1425/1440 | OK |

(مقادیر `scrollWidth/innerWidth`؛ همه صفحات `lang=fa`، `dir=rtl`، محتوای واقعی، بدون هدایت به ورود.)

**خروجی نهایی هر سه اجرا: `viewport-check-auth: OK`** (exit 0). عرض ۵۰۰px حداقل قابل آزمایش در این محیط است (CLAUDE.md §۱۱).

---

## ۹. noMoney (R-32) با داده واقعی

ورود با کاربر `prod1` (نقش production): `noMoney: true`، مجوزها `[orders.view, production.view, production.edit, inventory.view]` (بدون `money.view`).

| Endpoint | کد | کلیدهای پولی در اولین ردیف |
|---|---|---|
| `GET /api/jobs` | 200 | `[]` — نمونه کلیدها: id, product, qty, status, … |
| `GET /api/stock` | 200 | `[]` — بدون price/value |
| `GET /api/catalog/materials` | 200 | `[]` — بدون price |
| `GET /api/catalog/products` | 200 | `[]` — بدون price |
| `GET /api/moves` | 200 | `[]` |

**مقایسه:** همان پاسخ‌ها با نشست admin دارای `price`/`value` هستند (مثلاً row اول `/api/stock?wh=raw` برای admin: `"price":120000,"value":10001520` — برای prod1 حذف شده). فیلتر در سرور انجام می‌شود (`shouldHideMoney` — پنهان‌سازی دکمه در UI مجاز نیست، CD-04).

**۴۰۳:** `ali-sales` (نقش sales، بدون `production.view`) → `GET /api/jobs`، `POST /api/jobs`، `POST /api/jobs/PJ-503/start` همگی **403**. **۴۰۱:** نشست بدون ورود → `{"error":{"code":"UNAUTHORIZED","message":"نشست معتبر نیست. لطفاً دوباره وارد شوید."}}`.

---

## ۱۰. پوشش آزمونها

`npm run test:coverage` (vitest) + `scripts/aggregate-coverage.py`:

| مسیر | Statements | Branches | Functions | Lines | فایل‌ها |
|---|---|---|---|---|---|
| `src/core` | ۹۰٫۸٪ | ۸۰٫۹٪ | ۹۰٫۸٪ | ۹۲٫۶٪ | ۴۴ |
| `src/modules/production` | ۹۸٫۱٪ | ۸۰٫۹٪ | ۱۰۰٪ | ۹۸٫۹٪ | ۲ |
| `src/modules/inventory` | ۹۸٫۳٪ | ۸۳٫۳٪ | ۱۰۰٪ | ۱۰۰٪ | ۳ |
| کل پروژه | ۸۱٫۸۷٪ | ۶۶٫۵٪ | ۸۴٫۱۹٪ | ۸۳٫۸۹٪ | — |

پوشش ≥ ۹۰٪ روی منطق کسب‌کار هدف **فاز ۸** است (A-8.2)؛ ماژول‌های جدید فاز ۵ بالای ۹۸٪ statements هستند. پایین بودن شاخص کل به دلیل فایل‌های UI/صفحات است که در فازهای بعدی تکمیل می‌شوند.

---

## ۱۱. انحرافات و دلایل آنها

۱. **`vitest run --no-file-parallelism`** — حافظه سیستم ~۳٫۷GB است؛ اجرای موازی فایل‌ها OOM می‌شود. همه ۷۹۶ تست در ۵۹ فایل به‌صورت سری سبز شدند (خروجی یکسان، فقط کندتر).
۲. **`NODE_OPTIONS=--max-old-space-size=2560` برای `next build`** — زیر ۲GB تخصیص، build با OOM متوقف می‌شود.
۳. **دیسک C تقریباً پر است (~۰٫۰۹ GB آزاد)** — `TEMP`/`TMP`/`TMPDIR` به `D:/tmp` هدایت شد؛ لاگ سرور و فایل‌های تأیید در `/d/tmp` نوشته شدند.
۴. **بدنه‌های فارسی از فایل‌های JSON خوانده شدند** (`--data-binary @file`) — ارسال مستقیم Persian با `-d` در پوسته Windows کدگذاری را خراب می‌کرد.
۵. **تأیید زنده در سه اسکریپت** (`phase5-verify.sh`/`2`/`3`) — سفارش PF-1204 از نشست قبل پیش از اجرای دوباره به مرحله ۹ رسیده بود و guardها به‌درستی اقدامات خارج از ترتیب را رد می‌کردند؛ خط لوله با اسکریپت دوم کامل شد. شمارش کل: ۵۵ درخواست، صفر ۵۰۰.
۶. **PASS ناموفق اولیه در دروازه ۱** — `itemId` باید cuid کاتالوگ باشد نه کد (`RM-101`)؛ سرور با 400 «قلم انتخاب‌شده در کاتالوگ وجود ندارد.» رد کرد (اعتبارسنجی صحیح) و با cuid صحیح 201 شد.
۷. **`qcJob` حرکت `kind: waste` ایجاد نمی‌کند** — PHASE_05 §۳.۷/§۷ یک حرکت `waste` هنگام ثبت کیفیت پیش‌بینی کرده بود؛ پیاده‌سازی `good`/`waste` را روی ردیف `Job` ثبت می‌کند (مطابق `data-jqc` دمو که حرکتی نمی‌سازد). ضایعات در موجودی معنا ندارند چون مواد همگی هنگام `start` کسر می‌شوند. **این انحراف عمداً به نفع وفاداری به Demo انتخاب شد و باید در بازبینی تأیید شود.**
۸. **سرور تأیید زنده در پایان نشست با فشار حافظه متوقف شد** (توسط harness) — همه ۵۵ درخواست تأیید پیش از آن ثبت شده‌اند؛ نیازی به راه‌اندازی مجدد نبود.

**یادداشت فنی (نقص محیط، نه کد):** کلاینت Singleton پراسس پس از کرش موتور Prisma (OOM) reconnect نمی‌شود و آبشار ۵۰۰ تولید می‌کند — با سرور تازه حل می‌شود. در اجرای نهایی تأیید هیچ ۵۰۰‌ی وجود نداشت.

---

## ۱۲. Blockers / Open Questions

**Blockers:** هیچ‌کدام. همه دروازه‌های خروج §۱۶ (۹ از ۹) و همه دروازه‌های اجرایی EXIT=0 شدند.

**Open Questions (برای مالک):**

۱. **Q-01 (`settings.rate: 3`)** — طبق دستور مالک همچنان معوق؛ هیچ منطقی به آن وصل نشد.
۲. **Q-04 (تأیید رزرو بدون بررسی موجودی)** — باز است. `reservedQty` فعلاً 0 برمی‌گرداند ولی guard موجودی در `POST /api/reservations/check` اجرا می‌شود (مسدودسازی طبق PHASE_05 §۳.۹).
۳. **Q-07 (دید فقط‌خواندن سفارش برای نقش production/warehouse)** — نقش production دارای `orders.view` است (تأیید زنده در مجوزهای prod1).
۴. **حرکت `waste` هنگام QC** — §۱۱.۷: طبق Demo روی ردیف Job ثبت می‌شود، نه به‌عنوان حرکت. نیازمند تصمیم مالک.
۵. **درخواست خرید از آستانه min** — PHASE_05 §۳.۳: دکمه «درخواست خرید» در این فاز فقط لینک داده‌ای فراهم می‌کند؛ ایجاد `BY status: req` به فاز ۶ موکول شد.

---

## ۱۳. چک‌لیست What to review

برای بازبینی فاز ۵، اولویت‌ها به این ترتیب:

۱. **`src/modules/production/services/job.service.ts`** — قلب فاز: `createJob` (خط تولید app/prod.js:74)، `startJob` (shortage guard + تراکنش حرکت‌های `use`)، `updateJob` (گذار run→qc)، `qcJob` (قانون `good+waste ≤ qty`)، `receiveJob` (حرکت `job` + هشدار عدم تطابق).
۲. **`src/modules/production/services/bom.service.ts`** — `computeBomNeed` و snapshot در زمان ایجاد (پیش‌نمایش زنده).
۳. **`src/modules/inventory/services/stock.service.ts`** — `computeOnHand` با `move.groupBy`، `used30`، `getStockAlerts` (app/stock.js:27)، فیلتر noMoney.
۴. **`src/modules/inventory/services/move.service.ts`** — guard موجودی خروج دپو، محدودیت ویرایش حرکت‌های سیستمی.
۵. **`src/modules/inventory/lib/kinds.ts` + `constants/index.ts`** — ۹ kind و SIGN_BY_KIND (core.js:206، stock.js:69/88).
۶. **`prisma/schema.prisma`** (models Move/Job/OrderHandoff) و `migrations/20261111161153_inventory_production_jobs/migration.sql`.
۷. **سناریوهای تأیید زنده** `scripts/phase5-verify*.sh` — شواهد در `/d/tmp/phase5-verify*.txt`.

---

## ۱۴. پایان فاز

فاز ۵ با همه دروازه‌های خروج سبز بسته شد. **طبق دستور مالک، فاز ۶ شروع نشد.**
