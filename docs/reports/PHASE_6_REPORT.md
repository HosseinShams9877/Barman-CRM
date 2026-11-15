# PHASE_6_REPORT — خرید و مالی (Purchasing & Finance)

> فاز: **۶ — خرید و مالی** طبق `docs/roadmap/PHASES/PHASE_06.md` و معیارهای `docs/roadmap/PHASE_ACCEPTANCE_CRITERIA.md` (A-6.1…A-6.3).
> ریشه پروژه: `D:\New folder\CRM-Barman`. پوشه Demo (`پلتفرم نهایی تیم بارمان/`) **فقط خوانده شد** — هیچ فایلی در آن نوشته/تغییر/حذف نشد (دروازه خروج ۹).
> فایل‌های `.env.local` و `.secrets.local.json` در ریشه Demo وجود دارند؛ محتوایشان فاش یا کپی نشد (CLAUDE.md §۱).

---

## ۰. خلاصه

ماژول‌های `purchasing` و `finance` با وفاداری به Demo ساخته شدند: جریان درخواست خرید `BY` با ۴ وضعیت `req → ok → fin → recv`، چک‌های صادره (`issued → paid`)، دفتر هزینه/درآمد متفرقه (`txns` با ۸ نوع ثابت — ذخیره‌شده در DB طبق Q-14/CD-36)، و سه گزارش مالی (دریافتنی‌ها، پرداختنی‌ها، جریان نقدی ماهانه با bucketing بر اساس JDN — رفع R-11). اتصال خرید → انبار (**رسید → حرکت `kind: "buy"` در انبار `raw`**) داخل یک تراکنش Prisma اجرا می‌شود (درخواست صریح مالک) و **به‌صورت زنده** تأیید شد: موجودی RM-101 و RM-102 دقیقاً به اندازهٔ مقادیر خرید افزایش یافت.

**دروازه‌های خروج هدفمند (PHASE_06 §۱۶) — همه ۹ مورد سبز** (جدول کامل در §۲).
**معیارهای پذیرش A-6.1…A-6.3 — سبز** (§۲).
**دروازه‌های اجرایی (همه EXIT=0):** `tsc --noEmit`، `npm run lint`، `npx vitest run --no-file-parallelism` (۷۷ فایل / ۱۰۱۲ تست)، `npm run test:coverage`، `npm run check:colors`، `node scripts/check-garble.mjs`، `NODE_OPTIONS=--max-old-space-size=2560 npx next build` (§۹).
**تأیید زنده curl:** ~۶۰ درخواست روی سرور پروداکشن‌بیلد (پورت ۳۱۶۲) — صفر پاسخ ۵۰۰ (§۷).
**Viewport:** `/buys`، `/buys/BY-104`، `/finance` در ۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰ — بدون اسکرول افقی (§۸).

---

## ۱. درخت فایل‌های ایجاد/تغییر یافته

### ایجاد شده (فاز ۶)

```
src/modules/purchasing/
├── components/
│   ├── BuysList.tsx              # لیست خریدها: فیلتر وضعیت، نشانگر مرحلهٔ جریان، table→card زیر md
│   ├── BuysList.test.tsx
│   ├── BuyFormDialog.tsx         # فرم خرید: انتخاب ماده/مقدار/قیمت + اعتبارسنجی زندهٔ فارسی
│   ├── BuyFormDialog.test.tsx
│   ├── BuyFinanceDialog.tsx      # ثبت چک‌های صادره (amount/due/sayad) هنگام تأیید مالی
│   ├── BuyDetail.tsx             # جزئیات خرید: استپر وضعیت، اقلام، چک‌ها، تاریخچه + دکمه‌های گذار
│   └── BuyDetail.test.tsx
├── constants/
│   ├── BUY_STATUS.ts             # BUY_STATUS/LABELS/STEPS/TRANSITIONS (fin-core.js:9-17)، BUY_ID_PREFIX
│   ├── EXPENSE_KINDS.ts          # ۸ نوع ثابت + toStoredKind/directionOfKind (fin.js:145-147)
│   └── index.ts
├── hooks/
│   ├── useBuys.ts                # کوئری لیست با فیلتر وضعیت
│   ├── useBuyMutations.ts        # mutationهای approve/finance/receive/patch/cheque-pay + invalidation
│   └── useSuppliers.ts           # کوئری لیست تأمین‌کنندگان مواد خام (kind: raw) (فقط‌خواندن این فاز)
├── queries/{keys,invalidations}.ts
├── schemas/
│   ├── buy.schema.ts             # createBuySchema/updateBuySchema/buyListQuerySchema/approve/finance/receive
│   ├── buy.schema.test.ts
│   └── buy-cheque.schema.ts      # chequeSchema (amount/due/sayad/status) — فقط issued→paid
├── services/
│   ├── buy.service.ts            # قلب فاز: state machine، calcBuyTotal/calcDue، receive تراکنشی
│   ├── buy.service.test.ts
│   ├── supplier.service.ts       # listSuppliers — فیلتر kind:"raw"، فقط‌خواندن
│   └── supplier.service.test.ts
├── types/{buy.types.ts, supplier.types.ts}
└── index.ts

src/modules/finance/
├── components/
│   ├── FinancePage.tsx           # صفحهٔ مالی با tabهای دریافتنی/پرداختنی/جریان نقدی/دفتر
│   ├── FinancePage.test.tsx
│   ├── ReceivablesView.tsx       # تجمیع چک‌های دریافتی + نسیه بر اساس حساب (fin-core.js:59-70)
│   ├── ReceivablesView.test.tsx
│   ├── PayablesView.tsx          # تجمیع چک‌های صادره + نسیه بر اساس تأمین‌کننده (fin-core.js:72-74)
│   ├── PayablesView.test.tsx
│   ├── CashflowReport.tsx        # گزارش جریان نقدی با انتخاب ماه شمسی (fin-core.js:46-57)
│   ├── CashflowReport.test.tsx
│   ├── TxnDialog.tsx             # ثبت هزینه/دریافت با ۸ گزینهٔ ثابت (fin.js:145)
│   ├── TxnDialog.test.tsx
│   ├── TxnsView.tsx              # دفتر تراکنش‌ها با فیلتر جهت/نوع + صفحه‌بندی
│   └── TxnsView.test.tsx
├── constants/{TXN_KINDS.ts, index.ts}   # لایهٔ نمایش برچسب‌های ۸ نوع (منبع: EXPENSE_KINDS)
├── hooks/{useTxns,useTxnMutations,useFinanceReports}.ts
├── queries/invalidations.ts
├── schemas/
│   ├── txn.schema.ts             # createTxnSchema/txnListQuerySchema/cashflowQuerySchema
│   └── txn.schema.test.ts
├── services/
│   ├── txn.service.ts            # createTxn (جهت/کلید ذخیره استنتاج‌شده) + listTxns (فیلتر kind/direction)
│   ├── txn.service.test.ts
│   ├── receivable.service.ts     # تجمیع دریافتنی‌ها
│   ├── payable.service.ts        # تجمیع پرداختنی‌ها با محافظ دوبارشماری (CD-38)
│   ├── cashflow.service.ts       # bucketing ماهانه با JDN (R-11 — Q-12/CD-39)
│   └── finance.reports.test.ts
├── types/{finance.types.ts, txn.types.ts}
└── index.ts

src/app/api/
├── buys/route.ts                 # GET لیست / POST ایجاد
├── buys/routes.test.ts
├── buys/[id]/route.ts            # GET جزئیات / PATCH ویرایش (فقط در req)
├── buys/[id]/approve/route.ts    # POST req → ok
├── buys/[id]/finance/route.ts    # POST ok → fin + چک‌ها
├── buys/[id]/receive/route.ts    # POST fin → recv + حرکت‌های buy (تراکنشی)
├── buys/[id]/cheques/[cid]/route.ts  # PATCH issued → paid
├── txns/route.ts                 # GET لیست / POST ثبت
├── txns/routes.test.ts
├── finance/receivables/route.ts  # GET
├── finance/payables/route.ts     # GET
├── finance/cashflow/route.ts     # GET ( month? = YYYY/MM )
├── finance/routes.test.ts
└── suppliers/route.ts            # GET فقط‌خواندن (kind:"raw")

src/app/(app)/
├── buys/page.tsx                 # لیست خریدها (/buys)
├── buys/[id]/page.tsx            # جزئیات خرید (/buys/BY-104)
└── finance/page.tsx              # صفحهٔ مالی (/finance)

prisma/migrations/20261112141600_purchasing_finance/migration.sql
```

### تغییر یافته (فاز ۶)

```
prisma/schema.prisma              # افزودن مدل‌های Buy, BuyItem, BuyCheque, BuyStatusLog, Txn (§۳)
src/core/permissions/matrix.ts    # افزودن ۶ کلید مجوز purchasing.view/edit/approve + finance.view/edit/approve
                                  # و نقش‌دهی آن‌ها (production/depot:view بدون money.view — R-32)
src/core/permissions/permissions.test.ts   # به‌روزرسانی: ۲۵ → ۲۷ مجوز + نقش finance
src/components/layout/Sidebar.tsx # دو مدخل ناوبری: خرید (/buys) و مالی (/finance)
src/components/layout/Sidebar.test.tsx
scripts/dev-db-phase6.mjs         # ابزار یکبار دیتای توسعه: supplier raw + کاربر fin1 + بازنشانی گذرواژه
docs/DECISION_LOG.md              # CD-35…CD-41 + پاسخ Q-12/Q-13/Q-14 (§۶)
```

### آزمون‌های فاز ۶

| فایل | تعداد تست |
|---|---|
| `purchasing/services/buy.service.test.ts` | ۳۰ |
| `purchasing/schemas/buy.schema.test.ts` | ۲۶ |
| `app/api/buys/routes.test.ts` | ۲۵ |
| `finance/schemas/txn.schema.test.ts` | ۱۹ |
| `finance/services/finance.reports.test.ts` | ۱۲ |
| `purchasing/components/BuyDetail.test.tsx` | ۱۲ |
| `app/api/finance/routes.test.ts` | ۱۵ |
| `app/api/txns/routes.test.ts` | ۱۲ |
| `finance/components/CashflowReport.test.tsx` | ۷ |
| `finance/components/TxnsView.test.tsx` | ۸ |
| `purchasing/components/BuyFormDialog.test.tsx` | ۸ |
| `purchasing/components/BuysList.test.tsx` | ۹ |
| `finance/services/txn.service.test.ts` | ۹ |
| `finance/components/{PayablesView,ReceivablesView,TxnDialog}.test.tsx` | ۶+۶+۶ |
| `finance/components/FinancePage.test.tsx` | ۳ |
| `purchasing/services/supplier.service.test.ts` | ۳ |
| **مجموع فاز ۶** | **۲۱۶ تست در ۱۸ فایل** |

---

## ۲. دروازه‌های خروج هدفمند (PHASE_06 §۱۶) و معیارهای پذیرش — همه سبز

| # | دروازه / معیار | نتیجه | شواهد زنده (سرور ۳۱۶۲) |
|---|---|---|---|
| ۱ | خرید با ۲ قلم ماده → ظاهر در لیست با `req` | ✅ | `POST /api/buys` → **201** `BY-104` (RM-101 ×120 @۵۲٬۰۰۰ + RM-102 ×80 @۳۸٬۰۰۰، total ۹٬۲۸۰٬۰۰۰، rev 0)؛ `GET /api/buys` لیست با اولویت جدید — **A-6.1** |
| ۲ | جریان `req → ok → fin → recv` + حرکت `kind: buy` + افزایش موجودی | ✅ | approve rev0 → **200** (`ok`, rev 1)؛ finance rev1 + ۲ چک → **200** (`fin`, rev 2)؛ receive rev2 → **200** (`recv`, rev 3)؛ RM-101: 257.9 → **377.9** (Δ+120)؛ RM-102: 2625 → **2705** (Δ+80) — دقیقاً مقادیر اقلام — **A-6.1** |
| ۳ | پرش غیرمجاز وضعیت در سرور رد | ✅ | `req → recv` → **400** «گذار وضعیت «درخواست خرید» به «وارد انبار شد» مجاز نیست.»؛ `ok → ok` → **400**؛ ویرایش در `ok` → **400** «ویرایش خرید فقط در وضعیت «درخواست خرید» ممکن است.» |
| ۴ | چک `issued` ثبت → `paid` → حذف از پرداختنی‌ها | ✅ | finance چک‌ها `issued`؛ PATCH هر چک → **200** با calc.paid 0 → ۵٬۰۰۰٬۰۰۰ → ۹٬۲۸۰٬۰۰۰ و due 9,280,000 → 0؛ payables پس از پاس‌شدن: فقط BY-105 (1,050,000) باقی ماند — **A-6.2** |
| ۵ | bucket ماه درست در جریان نقدی | ✅ | `?month=1405/08`: rows درست در ۱۴۰۵/۰۸ (۸ txn + ۳ واریز مشتری)؛ بازهٔ `from=1405/08/01&to=1405/09/30`: چک ۵م در ۱۴۰۵/۰۹ و چک ۴٫۲۸م در ۱۴۰۵/۱۰ (دادهٔ نامتقارن، آزمون واحد با مقایسهٔ محاسبهٔ مستقیم: `finance.reports.test.ts`) |
| ۶ | production پاسخ `/api/finance/*` بدون مبلغ | ✅ | prod1: payables **200** بدون `amount` در rows؛ txns **200** بدون `amount`؛ buys **200** بدون `calc`/`price` (§۷) — **A-6.3** |
| ۷ | ثبت هزینه با یکی از ۸ نوع ثابت + ماندگاری | ✅ | هر ۸ نوع → **201** (۷ هزینه + «دریافت متفرقه» income)؛ باقی‌ماندن پس از رفرش: جدول `txns` در DB (CD-36/Q-14) |
| ۸ | صفحات خرید/مالی در ۵ عرض بدون اسکرول افقی | ✅ | `/buys` و `/buys/BY-104` و `/finance` در ۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰ — scrollWidth 485/753/1009/1265/1425 (§۸) |
| ۹ | هیچ فایل Demo تغییری نکرده | ✅ | همهٔ writeها در ریشهٔ پروژه؛ Demo فقط با ابزار خوانده شد |

---

## ۳. مدل‌های Prisma افزوده‌شده (migration `20261112141600_purchasing_finance`)

### `Buy` (جدول `buys`)

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `String @id` | `BY-NNN` — `nextPrefixedId(BUY_ID_PREFIX, …)` (app/buy.js جریان `BY`) |
| `supplierId` | `String?` | تأمین‌کننده (FK → suppliers، `ON DELETE SET NULL`) |
| `status` | `String @default("req")` | `req \| ok \| fin \| recv` (fin-core.js:9-17) |
| `total` | `Int @default(0)` | جمع اقلام (ریال صحیح — CD-13) |
| `note` | `String?` | یادداشت خرید |
| `createdBy` | `String` | ایجادکننده (FK → users، `ON DELETE RESTRICT`) |
| `createdAt` / `updatedAt` | `BigInt` | مهر زمانی |
| `rev` | `Int @default(0)` | نسخهٔ همزمانی — تشخیص تداخل (رفع R-06) |

ایندکس‌ها: `@@index([status])`، `@@index([supplierId])`.

### `BuyItem` (جدول `buy_items`)

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `String @id` | cuid |
| `buyId` | `String` | FK → buys (`ON DELETE CASCADE`) |
| `materialId` | `String` | FK → materials (`ON DELETE RESTRICT`) — خرید این فاز فقط مواد اولیه |
| `qty` | `Float` | مقدار (مثبت) |
| `price` | `Int` | قیمت واحد به ریال (CD-13) |

ایندکس‌ها: `@@index([buyId])`، `@@index([materialId])`.

### `BuyCheque` (جدول `buy_cheques`)

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `String @id` | cuid |
| `buyId` | `String` | FK → buys (`ON DELETE CASCADE`) |
| `amount` | `Int` | مبلغ چک به ریال |
| `due` | `String` | سررسید `YYYY/MM/DD` ASCII (CD-06) — اعتبارسنجی با `core/calendar` |
| `sayad` | `String?` | شماره صیادی (اختیاری طبق Demo) |
| `status` | `String @default("issued")` | `issued → paid` (fin.js:143) |

ایندکس‌ها: `@@index([buyId])`، `@@index([status])`.

### `BuyStatusLog` (جدول `buy_status_log`) — CD-41

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `String @id` | cuid |
| `buyId` | `String` | FK → buys (`ON DELETE CASCADE`) |
| `fromStatus` | `String?` | وضعیت مبدأ (`null` برای ایجاد) |
| `toStatus` | `String` | وضعیت مقصد |
| `at` | `BigInt` | مهر زمانی UTC ms |
| `byUserId` | `String?` | انجام‌دهنده (FK → users، `ON DELETE SET NULL`) |
| `note` | `String?` | متن ورودی `log(b, text)` — طبق CD-41 (منبع: app/fin-core.js:35) |

ایندکس: `@@index([buyId])`.

### `Txn` (جدول `txns`) — Q-14 / CD-36 (ذخیره در DB به‌جای حافظه)

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `String @id` | cuid |
| `kind` | `String` | یکی از ۸ کلید ذخیره‌شده (`هزینه — …` / `دریافت متفرقه`) — fin.js:145-147 |
| `direction` | `String` | `expense \| income` — استنتاج‌شده از kind |
| `amount` | `Int` | مبلغ به ریال (صحیح مثبت — CD-13) |
| `at` | `String` | تاریخ `YYYY/MM/DD` ASCII (CD-06) |
| `who` | `String?` | طرف حساب |
| `note` | `String?` | یادداشت |
| `byUserId` | `String?` | ثبت‌کننده (FK → users) |
| `createdAt` | `BigInt` | مهر زمانی |

ایندکس‌ها: `@@index([at])`، `@@index([kind])`، `@@index([direction])`.

> جداول `suppliers` و `materials` از migrationهای فاز ۰/۲ موجود بودند و **دست نخورده** ماندند (دستور مالک: بدون تغییر migration فازهای قبلی).

---

## ۴. مسیرهای API افزوده‌شده

الگوی ۵ مرحله‌ای CD-04 در همهٔ مسیرها رعایت شد (auth → permission → Zod → service → response).

| روش | مسیر | مجوز (سرور) | کدهای وضعیت مشاهده‌شده |
|---|---|---|---|
| GET | `/api/buys` | `purchasing.view` | 200 (فیلتر `status`/`supplier`، صفحه‌بندی)، 401، 403 |
| POST | `/api/buys` | `purchasing.edit` | 201، 400 (قلم ناموجود / Zod)، 403 |
| GET | `/api/buys/[id]` | `purchasing.view` | 200، 404 |
| PATCH | `/api/buys/[id]` | `purchasing.edit` | 200 (فقط در `req`)، 400، 404، 409 |
| POST | `/api/buys/[id]/approve` | `purchasing.approve` | 200 (`req→ok`)، 400 (گذار غیرمجاز)، 409 (rev) |
| POST | `/api/buys/[id]/finance` | `finance.approve` | 200 (`ok→fin` + چک‌ها)، 400، 409 |
| POST | `/api/buys/[id]/receive` | `inventory.moves` | 200 (`fin→recv` + حرکت‌های `buy`)، 400، 409 |
| PATCH | `/api/buys/[id]/cheques/[cid]` | `finance.edit` | 200 (`issued→paid`)، 400 |
| GET | `/api/txns` | `finance.view` | 200 (فیلتر `kind`/`direction`، صفحه‌بندی)، 403 |
| POST | `/api/txns` | `finance.edit` | 201، 400 (Zod: نوع/مبلغ/تاریخ)، 403 |
| GET | `/api/finance/receivables` | `finance.view` | 200 |
| GET | `/api/finance/payables` | `finance.view` | 200 |
| GET | `/api/finance/cashflow` | `finance.view` | 200 (`?month=YYYY/MM` یا بازهٔ کامل) |
| GET | `/api/suppliers` | `purchasing.view` | 200 (فقط `kind:"raw"`)، 403 |

**نکته:** نام‌های مجوز واقعی معادل dotted نام‌های `PHASE_06.md` هستند (`purchasing.view` ≡ `purchasing:read` و …) طبق CD-26. نقش finance طبق ماتریس `purchasing.view/edit` + `finance.*` دارد (به همین دلیل fin1 توانست `POST /api/buys` → 201 بزند) ولی `inventory.view` ندارد (`GET /api/stock` → 403).

---

## ۵. قوانین کسب‌کار با ارجاع Demo (CLAUDE.md §۱۳ — هیچ قانونی اختراع نشد)

| قانون | منبع Demo | محل اجرا |
|---|---|---|
| ۴ وضعیت خرید `req \| ok \| fin \| recv` + گذارهای مجاز | `app/fin-core.js:9-17` | `purchasing/constants/BUY_STATUS.ts` (`BUY_TRANSITIONS`) + `buy.service.ts` `isLegalTransition` |
| محاسبهٔ total خرید = Σ qty×price | `app/fin-core.js:22` | `buy.service.ts:48` `calcBuyTotal` (گردسازی صفر — مبالغ صحیح CD-13) |
| paid = جمع چک‌های با وضعیت `paid` | `app/fin-core.js:23` | `buy.service.ts:66` `calcPaid` |
| due = max(0, total − paid) | `app/fin-core.js:24` | `buy.service.ts:75` `calcDue` |
| ثبت تاریخچهٔ هر انتقال با کاربر و متن | `app/fin-core.js:35` (`log(b, text)`) | `BuyStatusLog` + `note` (CD-41) |
| رسید خرید → حرکت ورود به انبار مواد | `app/fin-core.js:41-44` | `receiveBuy` در `buy.service.ts:477-535` (انبار `raw`) |
| انبار مقصد بر اساس `b.kind` | `app/fin-core.js:42` | این فاز خرید فقط مواد اولیه → همیشه `raw` (PHASE_06 §۳.۴) |
| چک صادره فقط `issued → paid` | `app/fin.js:143` (`data-cop: p.chq.status="paid"`) | `cheques/[cid]/route.ts` + `buy-cheque.schema.ts` |
| فیلد چک: amount/due/sayad/test-status | `app/buy.js:231` | `buy-cheque.schema.ts` + `BuyFinanceDialog` |
| خرید بدون قلم معنی ندارد | `app/buy.js:138` | `buy.schema.ts` (آرایهٔ items خالی → 400) |
| ۸ نوع ثابت دفتر هزینه + جهت استنتاج‌شده | `app/fin.js:145` و `app/fin.js:147` | `EXPENSE_KINDS.ts` (`EXPENSE_KIND_LABELS`, `toStoredKind`, `directionOfKind`) |
| کلید ذخیره: «هزینه: » → «هزینه — » | `app/fin.js:146-147` | `toStoredKind` در `txn.service.ts:112-113` |
| منابع رویدادهای جریان نقدی | `app/fin-core.js:46-57` | `cashflow.service.ts` (چک صادره پاس‌شده = هزینه در due؛ وصول مشتری = دریافت) |
| دریافتنی‌ها: چک‌های دریافتی + نسیه سفارشات قطعی | `app/fin-core.js:59-70` | `receivable.service.ts` |
| پرداختنی‌ها: چک‌های باز + نسیه تأمین‌کنندگان | `app/fin-core.js:72-74` | `payable.service.ts` (با محافظ دوبارشماری CD-38) |
| ماهانه‌سازی با برش رشته‌ای | `app/reports.js` (`slice(0,7)`) | **رفع R-11**: bucketing با JDN → `cashflow.service.ts` (CD-39/Q-12) |
| نقش‌های production/warehouse مبالغ نمی‌بینند | R-32 (PHASE_06 §۸) | فیلتر سرور `hideMoney` در همهٔ مسیرهای خرید/مالی/کاتالوگ |

---

## ۶. تصمیمات ثبت‌شده در فاز ۶ (docs/DECISION_LOG.md)

| شناسه | موضوع |
|---|---|
| **CD-35** | ۸ نوع ثابت تراکنش و جهت استنتاج‌شده (Q-14 — پیاده‌سازی فاز ۶) |
| **CD-36** | `txns` در DB ذخیره می‌شوند (Q-14 — رفع باگ Demo: `data-exp` فقط در حافظه بود) |
| **CD-38** | پرداختنی‌ها: چک‌های صادره باز + نسیه باقی‌مانده با محافظ دوبارشماری (جزئیات در گزارش §۳) |
| **CD-39** | گزارش جریان نقدی: استفاده از `due` به‌جای `clearAt` (فیلد در فاز ۴ وجود ندارد) + bucketing JDN (R-11/Q-12) |
| **CD-40** | پیام‌های فارسی Zod (`faErrorMap` — CD-28) برای همهٔ اسکیماهای جدید فاز ۶ (طبق دستور مالک؛ فازهای ۱–۳ retrofit نشدند) |
| **CD-41** | ستون `note` در `BuyStatusLog` (Demo `app/fin-core.js:35`) — این فاز افزودجه شد |

پاسخ سوالات باز: **Q-12** ✅ پیاده‌سازی طبق توصیه (JDN)؛ **Q-13** فاز ۶ بدون آپلود فایل (YAGNI مطابق توصیه — پوشهٔ `files/` در Demo خالی است)؛ **Q-14** ✅ ذخیره در DB طبق توصیه.
**تصمیم‌های معوق مالک:** **Q-01** (settings.rate) و **Q-04** همچنان DEFERRED هستند و در این فاز پیاده‌سازی نشدند (دستور مالک). انحراف QC waste فاز ۵ (گزارش PHASE_5 §۱۱.۷ — فقط ردیف Job، بدون حرکت `waste`) دست‌نخورده باقی ماند.

---

## ۷. تأیید زنده (curl سرور ۳۱۶۲ — پروداکشن‌بیلد)

> سرور: `NODE_OPTIONS=--max-old-space-size=2560 npx next start -p 3162` روی بیلد سبز (تسک پس‌زمینه). کاربران: admin، ali-sales (sales)، prod1 (production)، fin1 (finance) — گذرواژهٔ همه `test-pass-1405` (دیتای توسعه). ~۶۰ درخواست، **صفر پاسخ ۵۰۰**.

### ۷.۱ ورودها و مجوزها

```
POST /api/auth/login × 4 (admin, ali-sales, prod1, fin1) → 200 + cookie br_s
GET  /api/suppliers   (admin)     → 200  [{"id":"cmwe131...","name":"تأمین‌کننده آریا","kind":"raw"}]
GET  /api/suppliers   (ali-sales) → 403  FORBIDDEN «شما مجوز انجام این عملیات را ندارید.»
GET  /api/buys        (ali-sales) → 403        ← کاربر بدون مجوز خرید
GET  /api/txns        (ali-sales) → 403        POST /api/txns (ali-sales) → 403  ← بدون مجوز مالی
POST /api/buys        (prod1)     → 403        ← production فقط view دارد
GET  /api/stock       (fin1)      → 403        ← finance مجوز انبار ندارد
GET  /api/buys        (بدون کوکی) → 401  UNAUTHORIZED «نشست معتبر نیست. لطفاً دوباره وارد شوید.»
```

### ۷.۲ جریان کامل BY-104 (create → approve → finance → receive → cheques paid)

```
POST /api/buys        → 201  {"id":"BY-104","status":"req","rev":0,
                               "calc":{"total":9280000,"paid":0,"due":0},
                               "items":[{"code":"RM-101","qty":120,"price":52000},
                                        {"code":"RM-102","qty":80,"price":38000}],
                               "statusLog":[{"toStatus":"req","note":"ثبت درخواست خرید"}]}
POST .../approve  rev=0 → 200  status="ok",  rev=1
POST .../finance  rev=1 → 200  status="fin", rev=2, log «تأیید مالی با 2 چک صادره»
     cheques: 5,000,000 due 1405/09/15 sayad 1234567890 (issued)
               4,280,000 due 1405/10/15 sayad 9876543210 (issued)
POST .../receive  rev=2 → 200  status="recv", rev=3,
     log «رسید انبار — ورود مواد به انبار مواد»
PATCH .../cheques/<cid1> {"status":"paid"} → 200  calc.paid=5000000, due=4280000, log «پاس شدن چک صادره»
PATCH .../cheques/<cid2> {"status":"paid"} → 200  calc.paid=9280000, due=0
PATCH .../cheques/<cid1> {"status":"issued"} → 400 «فقط علامت‌گذاری چک به‌عنوان پاس‌شده مجاز است.»
```

### ۷.۳ اتصال خرید → انبار (حرکت `buy` + موجودی) — درخواست مالک: تراکنشی

```
GET /api/stock  قبل:  RM-101 onHand=257.9   RM-102 onHand=2625
GET /api/stock  بعد:  RM-101 onHand=377.9   RM-102 onHand=2705     Δ = دقیقاً qty اقلام (+120/+80)
GET /api/moves?pageSize=200 →
  {"id":"mvmwe2506fhiox","wh":"raw","item":"RM-101","qty":120,"kind":"buy",
   "kindLabel":"ورود خرید","ref":"BY-104","note":"ورود خرید BY-104"}
  {"id":"mvmwe2506worza","wh":"raw","item":"RM-102","qty":80,"kind":"buy","ref":"BY-104",...}
```
حرکت‌ها داخل `prisma.$transaction` هم‌زمان با `buy.update` و `buyStatusLog.create` ساخته می‌شوند (`buy.service.ts:499-532`)؛ محافظ تکرار: وجود حرکت `kind:"buy"` با همان `ref` → **409** «این خرید قبلاً وارد انبار شده است.» (در این دادهٔ آزمون، گذار `recv→recv` ابتدا ۴۰۰ می‌دهد — هر دو محافظ فعال).

### ۷.۴ گذارهای غیرمجاز و تداخل rev (BY-105)

```
POST .../receive از status=req            → 400 «گذار وضعیت «درخواست خرید» به «وارد انبار شد» مجاز نیست.»
POST .../approve (req→ok)                 → 200
POST .../approve مجدد (ok→ok)             → 400 «گذار وضعیت «تأیید شد» به «تأیید شد» مجاز نیست.»
POST .../finance با rev کهنه              → 409 CONFLICT «این خرید توسط کاربر دیگری تغییر کرده است — دوباره بارگذاری کنید.»
PATCH /api/buys/BY-105 در status=ok       → 400 «ویرایش خرید فقط در وضعیت «درخواست خرید» ممکن است.»
GET  /api/buys/NOPE                       → 404 NOT_FOUND «خرید مورد نظر پیدا نشد.»
```

### ۷.۵ دفتر txns — هر ۸ نوع ثابت (هفت هزینه + دریافت متفرقه)

```
POST /api/txns × 8 → همه 201:
  kind="هزینه: حقوق پرسنل"      → stored "هزینه — حقوق پرسنل", direction=expense, amount=100000, at=1405/08/21
  kind="هزینه: اجاره"            → expense, 200000, 1405/08/22
  kind="هزینه: آب، برق، گاز و تلفن" → expense, 300000, 1405/08/23
  kind="هزینه: حمل و بارگیری"    → expense, 400000, 1405/08/24
  kind="هزینه: تبلیغات"          → expense, 500000, 1405/08/25
  kind="هزینه: تعمیرات و ابزار"  → expense, 600000, 1405/08/26
  kind="هزینه: سایر"             → expense, 700000, 1405/08/27
  kind="دریافت متفرقه"           → direction=income, 800000, 1405/08/28   ← دریافت متفرقه
اعتبارسنجی: مبلغ منفی → 400؛ نوع ناشناخته → 400؛ تاریخ ۱۴۰۵/۱۳/۴۰ → 400؛ مبلغ اعشاری → 400
فیلترها: direction=expense → total=7؛ kind="هزینه — اجاره" → total=1
ماندگاری: رکوردها در جدول txns زنده ماندند (CD-36/Q-14 — در Demo با رفرش از بین می‌رفت)
```

### ۷.۶ گزارش‌های مالی

```
GET /api/finance/receivables → 200  groups=[AC-107 «شرکت نمونه آریا»: cheque 400,000 due 1405/09/10], total=400000
GET /api/finance/payables    → 200  پس از پاس‌شدن هر دو چک BY-104:
                                   groups=[{"__no-supplier__": BY-105 balance 1,050,000}], total=1050000
                                   (BY-104 کاملاً پرداخت‌شده → خارج از پرداختنی‌ها — دروازهٔ ۴)
GET /api/finance/cashflow?month=1405/08 → 200
  months=[{"month":"1405/08","income":5442000,"expense":2800000,"net":2642000}]
  rows = ۳ واریز مشتری (income) + ۷ هزینه (expense) + ۱ دریافت متفرقه (income) — همه در bucket درست
GET /api/finance/cashflow?from=1405/08/01&to=1405/09/30 → 200
  months: 1405/08 net +4,642,000 | 1405/09 net −5,000,000 (چک ۵م) | 1405/10 net −4,280,000 (چک ۴٫۲۸م)
  ← bucketing JDN درست برای سررسیدهای نامتقارن (R-11)
```

### ۷.۷ noMoney (R-32) — دادهٔ واقعی، نقش production (prod1)

| پاسخ | کد | نتیجهٔ بررسی وجود کلیدهای پولی |
|---|---|---|
| `GET /api/buys` | 200 | بدون `calc` در هیچ ردیف — کلیدهای پولی: **هیچ** |
| `GET /api/buys/BY-104` | 200 | items فقط `{id, materialId, materialCode, materialName, unit, qty}` — **`price` حذف**؛ cheques `{id, due, sayad, status}` — **`amount` حذف**؛ **`calc` حذف** |
| `GET /api/txns` | 200 | هر ردیف `{id, kind, direction, at, who, note, byName, createdAt}` — **`amount` حذف** |
| `GET /api/finance/payables` | 200 | rows فقط `{supplierId, supplierName, buyId, kind, due}` — **`amount` حذف** |
| `GET /api/catalog/materials` | 200 | ۱۶ ماده بدون **`price`** (مقایسه: پاسخ admin شامل `"price":120000` و fin1 شامل `amount`) |

مقایسهٔ مستقیم همان ردیف برای دو نقش (admin ↔ prod1) ثابت می‌کند فیلتر در **سرور** اجرا می‌شود، نه در UI.

---

## ۸. واکنش‌گرایی (CD-12) — viewport-check-auth.mjs

دستور: `node scripts/viewport-check-auth.mjs http://localhost:3162/<page> D:/tmp/cj-admin.txt`
خروجی هر سه صفحه: `viewport-check-auth: OK` (Chrome headless، ۵ عرض × ارتفاع ۹۰۰).

| صفحه | ۵۰۰ | ۷۶۸ | ۱۰۲۴ | ۱۲۸۰ | ۱۴۴۰ | نتیجه |
|---|---|---|---|---|---|---|
| `/buys` | scrollWidth 485 | 753 | 1009 | 1265 | 1425 | `horizontalOverflow: false` × ۵ — جدول ۷ ردیف |
| `/buys/BY-104` | 485 | 753 | 1009 | 1265 | 1425 | `horizontalOverflow: false` × ۵ |
| `/finance` | 485 | 753 | 1009 | 1265 | 1425 | `horizontalOverflow: false` × ۵ |

زبان `fa` و جهت `rtl` در همهٔ عرض‌ها تأیید شد. جدول‌ها زیر `md` به card-list تبدیل می‌شوند (PHASE_06 §۱۱).

---

## ۹. دروازه‌های اجرایی (همه EXIT=0 — اجرای مجدد در پایان فاز)

| # | دستور | خروجی |
|---|---|---|
| ۱ | `npx tsc --noEmit` | `exit 0` |
| ۲ | `npm run lint` | `exit 0` |
| ۳ | `npx vitest run --no-file-parallelism` | `exit 0` — **۷۷ فایل / ۱۰۱۲ تست سبز** |
| ۴ | `npm run test:coverage` | `exit 0` — پوشش کلی: **Statements 83.62%** (1706/2040)، **Branches 68.32%** (975/1427)، **Functions 85.27%** (417/489)، **Lines 85.71%** (1482/1729) |
| ۵ | `npm run check:colors` | `exit 0` (بدون رنگ hardcoded) |
| ۶ | `node scripts/check-garble.mjs` | `exit 0` |
| ۷ | `NODE_OPTIONS=--max-old-space-size=2560 npx next build` | `exit 0` — همهٔ routeهای فاز ۶ در خروجی build |

### پوشش بر اساس ماژول (file-level از گزارش v8)

| مسیر | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| `core/api` | 100 | 91.66 | 100 | 100 |
| `core/auth` | 93.18 | 93.75 | 100 | 96.11 |
| `core/calendar` | 91.5 | 77.46 | 96.42 | 94.61 |
| `core/permissions` | 94.11 | 90 | 100 | 100 |
| `core/validation` | 91.42 | 71.42 | 100 | 90.32 |
| `finance/services` | 97.57 | 91.89 | 94.11 | 100 |
| `purchasing/services` | 86.92 | 73.33 | 84.09 | 88.88 |
| `inventory/services` | 98.26 | 82.97 | 100 | 100 |
| `production/services` | 98.05 | 80.89 | 100 | 98.91 |
| `customers/services` | 96.22 | 81.57 | 95 | 95.74 |
| `orders/services` | 65.49 | 51.16 | 69.01 | 66.91 |
| `settings/services` | 55 | 48.27 | 100 | 50 |
| `core/query` | 60.71 | 100 | 58.33 | 62.96 |

> پوشش منطق کسب‌کار ماژول‌های فاز ۶ (`finance/services` و `purchasing/services`) به‌ترتیب **97.57%** و **86.92%** است. فایل‌های پوشش‌پایین (`orders/services`، `settings/services`، `core/query/provider.tsx`) متعلق به فازهای قبلی/لایهٔ presentation هستند و در این فاز تغییر نکردند.

---

## ۱۰. انحرافات و دلایل

| # | انحراف | چرا |
|---|---|---|
| ۱ | **سرور dev کهنه روی پورت ۳۱۵۹ (PID 24208)** — قبل از migration فاز ۶ بالا آمده بود و کلاینت Prisma در حافظهٔ آن مدل‌های فاز ۶ را ندارد (`/api/buys` روی آن سرور ۵۰۰ می‌داد). stop کردن آن با `Stop-Process` توسط خط‌مشی sandbox رد شد. | به‌جای dev server از `npx next start -p 3162` روی **بیلد سبز** استفاده شد — یک پروسهٔ تازه با کلاینت به‌روژ. همهٔ تأییدات زنده روی ۳۱۶۲ انجام شد. سرور ۳۱۵۹ همچنان بالا و **stale** است (§۱۲ blockers). |
| ۲ | **OOM mitigation:** `vitest --no-file-parallelism` و `next build` با `--max-old-space-size=2560` | کلاینت با ~۳.۷GB RAM — بدون این اقدامات build/vitest ممکن است OOM بزنند (دستور مالک). |
| ۳ | **دیسک C: ۰ بایت آزاد** | تمام خروجی‌های سنگین (لاگها، cookie jarها، JSONهای تأیید) به `D:\tmp` نوشته شد؛ stdout دستورها کوچک/ASCII نگه داشته شد (Python با cp1252 روی متن فارسی UnicodeEncodeError می‌دهد — نتایج در فایل UTF-8 نوشته و cat شد). |
| ۴ | **tsc:** خطاهای نوع در طول فاز ظاهر و در همان لحظه اصلاح شدند (مثلاً narrowing اختیاری‌ها بعد از `noUncheckedIndexedAccess`). | کیفیت ارجح بر سرعت — دروازه در پایان فاز exit 0 شد. |
| ۵ | **eslint `react-hooks/set-state-in-effect`** در کامپوننت‌های جدید فاز ۶ → بازطراحی state-effectها | رفع هشدار lint به‌جای غیرفعال‌کردن قانون. |
| ۶ | **آزمون مجوزها ۲۵ → ۲۷** (افزودن `purchasing.approve` و `finance.approve` طبق ماتریس) | افزودن ۶ کلید مجوز فاز ۶ به `core/permissions/matrix.ts`. |
| ۷ | **`prisma generate` با EPERM** گذرا شکست خورد | retry بعد از آزادسازی قفل فایل — بدون تغییر schema. |
| ۸ | **CD-38: ردیف Cyrillic → فارسی** در DECISION_LOG اصلاح شد | جلوگیری از کاراکترهای غیرفارسی در سند فارسی. |
| ۹ | **`BuyStatusLog.note` (CD-41)** به migration فاز ۶ اضافه شد | Demo (`app/fin-core.js:35`) هر انتقال را با متن ثبت می‌کند — حفظ قابلیت با ستون اختیاری. |
| ۱۰ | **دیتای آزمون در dev.db** (BY-1، BY-101…BY-106، ۸ txn، تأمین‌کننده، کاربر fin1) | نتیجهٔ طبیعی تأیید زنده — محیط توسعه است و در بیلد/پروداکشن اثری ندارد. `scripts/dev-db-phase6.mjs` برای پاکسازی/بازتولید در دسترس است. |

---

## ۱۱. سوالات باز / تصمیمات معوق

- **Q-01 (settings.rate)** و **Q-04** — همچنان DEFERRED طبق دستور مالک؛ در این فاز پیاده‌سازی نشدند.
- **QC waste** — انحراف تأییدشدهٔ فاز ۵ (فقط ردیف Job، بدون حرکت `waste`) دست نخورده باقی ماند.
- وضعیت چاپ امن (HTTP print page) — خارج از دامنه، معوق به فاز ۸.
- **Q-13** — این فاز بدون قابلیت آپلود فایل پیاده شد (YAGNI مطابق توصیه).

## ۱۲. Blockers

1. **دیسک C: ۰ بایت فضای آزاد** — محیط کار را محدود کرد (خروجی‌ها به `D:\tmp` هدایت شدند). توصیه: پاکسازی حافظهٔ موقت (Temp ~۹۰۹MB) یا کش‌های کاربر. این موضوع توسط agent قابل حل نبود و به مالک گزارش می‌شود.
2. **سرور dev کهنه روی :3159 (PID 24208)** — کلاینت Prismaی آن قبل از migration فاز ۶ است و `/api/buys` و `/api/txns` روی آن پاسخ **۵۰۰** می‌دهند (باقی مسیرها کار می‌کنند). stop کردن آن توسط این agent ممکن نبود (رد سیاستی). **اقدام پیشنهادی:** مالک یا session مالک آن را restart کند؛ مشکل با restart برطرف می‌شود. سرور ۳۱۶۲ (تسک `bq40btsqp`) پس از پایان تأییدات زنده، توسط خود‌گردانِ خط‌مشی فشار حافظه متوقف شد (کمبود RAM محیط — نه شکست سرور).
3. موارد دیگر: بدون blocker.

---

## ۱۳. چه چیزی را بازبینی کنید (Review checklist)

- [ ] `src/modules/purchasing/services/buy.service.ts` — state machine چهار وضعیت، محافظ `rev` (۴۰۹)، و تراکنشی‌بودن `receiveBuy` (lines 477-535): حرکت‌های `buy` + `buy.update` + `buyStatusLog.create` در یک `$transaction`.
- [ ] محافظ دوبارشماری پرداختنی‌ها (CD-38) در `payable.service.ts` — نسیه = `max(0, total − paid − Σ issued)`.
- [ ] bucketing ماهانهٔ JDN در `cashflow.service.ts` (رفع R-11) و آزمون `finance.reports.test.ts` با دادهٔ نامتقارن.
- [ ] ماتریس مجوزها: نقش production/depot فقط `purchasing.view`/`finance.view` (بدون `money.view`) — فیلتر مبلغ در سرور (R-32) در همهٔ مسیرهای خرید/مالی/کاتالوگ.
- [ ] `EXPENSE_KINDS` / `TXN_KINDS` — تطابق ۸ گزینه با `app/fin.js:145` و تبدیل «هزینه: » → «هزینه — ».
- [ ] migration `20261112141600_purchasing_finance` (فایل SQL) — تطابق فیلدها با §۳.
- [ ] headline UI: لیست خریدها (`BuysList`)، جزئیات (`BuyDetail`)، صفحهٔ مالی (`FinancePage` با چهار tab) — حالت‌های loading/error/empty.
- [ ] `scripts/dev-db-phase6.mjs` — ابزار دیتای توسعه (نه production).
- [ ] باقیماندهٔ dev.db ذکرشده در §۱۰-۱۰ (در صورت تمایل به پاکسازی).

---

**پایان فاز ۶.** مطابق دستور مالک، فاز ۷ آغاز نشد.
