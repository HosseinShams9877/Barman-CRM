# PHASE_3_REPORT — ماژول CRM (سرنخ‌ها + حساب‌ها)

> گزارش پایانی فاز ۳ پروژه BARMAN CRM.
> prose فارسی برای خوانایی؛ عناوین/جدول‌ها/شناسه‌ها انگلیسی (طبق دستورالعمل reporting format).
> تاریخ: ۲۰۲۶/۱۱/۱۰ (۱۴۰۵/۰۸/۲۰).

---

## ۰. خلاصه

فاز ۳ طبق `docs/roadmap/PHASES/PHASE_03.md` به‌صورت کامل پیاده‌سازی و تأیید شد:
ماژول‌های `src/modules/leads` و `src/modules/customers`، Route Handlerهای مربوطه،
صفحات `/leads` و `/customers`، migration پایگاه داده `20261110063607_crm_leads_customers`
(بدون دسترسی به migration فاز ۲)، و افزونگی تست‌ها.

**دروازه‌های اجرایی (همه exit 0):**

| # | دستور | خروجی واقعی |
|---|---|---|
| 1 | `npx tsc --noEmit` | exit 0 (بدون خطا) |
| 2 | `npm run lint` | exit 0 (eslint تمیز) |
| 3 | `npx vitest run` | exit 0 — **42 test file، 433 test** همگی سبز |
| 4 | `npm run test:coverage` | exit 0 — Statements 91.89%، Branches 80.98%، Functions 92.89%، Lines 94.53% |
| 5 | `npm run check:colors` | exit 0 — «check-hardcoded-colors: OK» |
| 6 | `node scripts/check-garble.mjs` | exit 0 — «check-garble: OK — ۲۳۰ فایل بررسی شد» |
| 7 | `npx next build` | exit 0 — Next.js 16.4.5 (Turbopack)؛ ۱۴ route تولید شد |

**تأیید مرورگر واقعی (CD-12، درگاه خروج ۸):** اسکریپت `scripts/viewport-check-auth.mjs`
با Chrome headless + CDP در ۵ عرض **۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰**:
- `/leads` → `viewport-check-auth: OK` (lang=fa، dir=rtl، بدون سرریز افقی، بورد با ۶ کارت در هر ۵ عرض)
- `/customers` → `viewport-check-auth: OK` (table با ۱۰ ردیف در هر ۵ عرض)

**تأیید API زنده (curl در برابر dev server روی پورت ۳۱۵۹):** ورود admin،
`POST /api/leads` → 201 با `id: LD-100x`، `PATCH /api/leads/[id]` با `{to, lostReason?}`
(جابه‌جایی مرحله و بازگشت از lost با lostFrom)، `POST /api/customers` → 201 با `id: AC-10x`.

---

## ۱. درخت فایل‌های ایجاد/تغییر یافته

### ایجاد شده (فاز ۳)

```
prisma/
└── migrations/
    └── 20261110063607_crm_leads_customers/   ← migration جداول فاز ۳ (فاز ۲ دست‌نخورده)

src/app/
├── (app)/
│   ├── leads/page.tsx                        ← صفحه بورد سرنخ‌ها
│   └── customers/page.tsx                    ← صفحه لیست حساب‌ها
├── api/
│   ├── leads/
│   │   ├── route.ts                          ← GET (list) / POST (create)
│   │   ├── import/route.ts                   ← POST (واردات CSV)
│   │   ├── [id]/route.ts                     ← GET / PATCH (edit | move)
│   │   ├── [id]/followups/route.ts           ← GET / POST (پیگیری)
│   │   └── routes.test.ts                    ← ۳۱ تستRoute Handler
│   └── customers/
│       ├── route.ts                          ← GET (list) / POST (create)
│       ├── [id]/route.ts                     ← GET / PATCH
│       ├── [id]/deactivate/route.ts          ← POST (حذف نرم)
│       └── routes.test.ts                    ← ۲۱ تست Route Handler

src/modules/leads/
├── components/
│   ├── LeadBoard.tsx + LeadBoard.test.tsx        ← کانبان ۵ ستون + حالت‌های کوئری
│   ├── LeadColumn.tsx                            ← ستون مرحله (aria-label)
│   ├── LeadCard.tsx                              ← کارت سرنخ (مدیریت مجوز noMoney)
│   ├── LeadFormDialog.tsx + .test.tsx            ← ایجاد/ویرایش سرنخ
│   ├── LeadQuickView.tsx                         ← نمایش سریع + تاریخچه
│   ├── LostDialog.tsx + .test.tsx                ← دیالوگ دلیل از دست رفتن
│   ├── FollowupDialog.tsx + .test.tsx            ← دیالوگ «چی شد؟»
│   └── ImportDialog.tsx + .test.tsx              ← دیالوگ واردات CSV
├── hooks/ (useLeads, useLeadMutations, useLeadFilters)
├── services/ (lead.service.ts + .test.ts، followup.service.ts + .test.ts)
├── schemas/ (lead.schema.ts + .test.ts، import.schema.ts + .test.ts)
├── queries/ (keys.ts, invalidations.ts)
├── constants/ (STAGE.ts, LINE.ts, lists.ts)
├── types/lead.types.ts
└── index.ts

src/modules/customers/
├── components/
│   ├── AccountList.tsx + .test.tsx               ← جدول حساب‌ها
│   ├── AccountForm.tsx + .test.tsx               ← فرم حساب
│   ├── PhoneEditor.tsx                           ← ویرایشگر تلفن‌های چندگانه
│   └── ContactEditor.tsx                         ← ویرایشگر مخاطبین
├── hooks/ (useAccounts, useAccount)
├── services/ (account.service.ts + .test.ts)
├── schemas/ (account.schema.ts + .test.ts)
├── queries/ (keys.ts, invalidations.ts)
├── constants/ (account-kinds.ts, phone-kinds.ts)
├── types/account.types.ts
└── index.ts

scripts/
├── viewport-check.mjs                            ← بررسی CD-12 (عمومی)
└── viewport-check-auth.mjs                       ← بررسی CD-12 احراز‌هویت‌شده (CDP)
```

### تغییر یافته (فاز ۳)

| فایل | تغیییر |
|---|---|
| `prisma/schema.prisma` | افزودن مدل‌های فاز ۳ (Account, AccountPhone, AccountContact, Lead, LeadFollowup, LeadInterest) + یک کامنت اصلاح‌شده |
| `package.json` | افزودن script `test:coverage` (مجاز طبق دستور مالک) |
| `docs/DECISION_LOG.md` | ثبت CD-23 (قوانین جابه‌جایی مرحله) و CD-24 (ایجاد/ویرایش مستقیم حساب) |
| `docs/knowledge/VALIDATION_AND_BUSINESS_RULES.md` | افزودن بخش §۷ «قوانین CRM — سرنخ‌ها و حساب‌ها» (۵ زیربخش با ارجاع Demo) |

**پوشه Demo (`پلتفرم نهایی تیم بارمان/`):** هیچ فایلی تغییر/حذف/تغییر نام/کپی نشد.
تنها تعامل با آن، خواندن منابع کسب‌کار بوده است. فایل‌های `.env.local` و
`.secrets.local.json` در ریشه Demo همچنان وجود دارند (محتوایشان فاش/کپی نشد — طبق CLAUDE.md §۱).

---

## ۲. جدول شواهد A-3.x (PHASE_ACCEPTANCE_CRITERIA.md)

| معیار | شواهد | وضعیت |
|---|---|---|
| **A-3.1**: کانبان ۵ ستون با drag&drop (یا معادل کاربردی) در دسکتاپ و موبایل | `LeadBoard.tsx` (۵ ستون `raw/opp/pf/won/lost`)؛ drag&drop HTML5 در دسکتاپ و `<select>` انتقال مرحله در موبایل (`LeadBoard.test.tsx` — تست‌های select موبایل سبز)؛ تأیید مرورگر واقعی در ۵ عرض با محتوای seed شده | ✅ |
| **A-3.2**: ایجاد/ویرایش سرنخ با اعتبارسنجی معتبر | `LeadFormDialog.tsx` + `lead.schema.ts` (createLeadSchema/updateLeadSchema)؛ `lead.schema.test.ts` (۳۲ تست: معتبر/نامعتبر، حرکت مجاز/ممنوع)؛ Route: POST `/api/leads` ۲۰۱/۴۰۰/۴۰۹/۴۰۳/۴۰۱ | ✅ |
| **A-3.3**: تاریخچه پیگیری + پیگیری بعدی | `FollowupDialog.tsx` + `followup.service.ts`؛ `nextAt` با قالب `YYYY/MM/DD` ASCII و نمایش فارسی (CD-06)؛ Route: GET/POST `/api/leads/[id]/followups` | ✅ |
| **A-3.4**: مدیریت حساب (customers) با مخاطبین و تلفن‌ها | `AccountForm.tsx` + `PhoneEditor.tsx` + `ContactEditor.tsx`؛ مدل‌های Account/AccountPhone/AccountContact؛ Route: `/api/customers…` (GET/POST/PATCH/deactivate) | ✅ |
| **A-3.5**: فقط کاربران مجاز به سرنخ‌ها دسترسی دارند (تست ۴۰۳) | `requirePermission` در هر Route (منبع حقیقت سرور)؛ ۴۰۳ برای نقش production در **هر مسیر** (leads: ۴ مورد، customers: ۵ مورد — همه سبز در routes.test.ts) | ✅ |

### دروازه خروج هدفمند PHASE_03 §۱۶

| # | شرط | وضعیت |
|---|---|---|
| 1 | تخته در دو خط و ۵ ستون + جابه‌جایی مرحله (دسکتاپ drag&drop، موبایل دکمه/select) | ✅ (drag & drop + `select` موبایل؛ seed: ۶ سرنخ در خط prod) |
| 2 | جابه‌جایی مرحله یک رکورد تاریخچه با مهر زمانی ایجاد می‌کند | ✅ (`kind:"stage"`، `at: UTC ms` — `lead.service.ts` moveLeadStage) |
| 3 | دیالوگ «چی شد؟» با پیگیری و تاریخ بعدی | ✅ (`FollowupDialog` → POST followups) |
| 4 | واردات CSV: یک ردیف معتبر ذخیره، یک ردیف نامعتبر با پیام فارسی رد | ✅ (`importLeads` + `ImportDialog`؛ تست‌های سبز) |
| 5 | ایجاد حساب با ۲ مخاطب و ۲ تلفن | ✅ (تست سرویس + اثبات زنده: AC-107 با ۲ تلفن + ۱ مخاطب در dev DB) |
| 6 | کاربر بدون مجوز `leads:read` → ۴۰۳ | ✅ (تست production → ۴۰۳ در همه مسیرها) |
| 7 | sales فقط سرنخ‌های خودش را می‌بیند | ✅ (فیلتر `ownerId` در سرور — `listLeads` با `LeadListScope`؛ تست سبز) |
| 8 | تخته در ۵ عرض بدون اسکرول افقی | ✅ (`viewport-check-auth: OK` در ۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰) |
| 9 | هیچ فایل Demo تغییری نکرده است | ✅ (هیچ ابزاری در آن پوشه ننوشت) |

---

## ۳. مدل‌های Prisma (فهرست فیلدها)

مدل‌های فاز ۲ (User, Role, UserRole, Setting, Rev, Product, Material, BomItem, Supplier, List)
بدون تغییر باقی ماندند. مدل‌های جدید فاز ۳ در `prisma/schema.prisma`:

### `Account` (`accounts`)
| فیلد | نوع | یادداشت |
|---|---|---|
| `id` | `String @id` | شناسه خوانا: `AC-101, AC-102, …` |
| `name` | `String` | نام شخص/شرکت |
| `kind` | `String @default("unknown")` | `company \| person \| unknown` |
| `active` | `Boolean @default(true)` | حذف نرم |
| `address` | `String @default("")` | |
| `note` | `String @default("")` | |
| `createdAt` | `BigInt @default(0)` | UTC ms (CD-07) |
| `updatedAt` | `BigInt @default(0)` | UTC ms |
| relations | `phones`, `contacts`, `leads` | |

### `AccountPhone` (`account_phones`)
| فیلد | نوع |
|---|---|
| `id` | `String @id @default(cuid())` |
| `accountId` | `String` |
| `kind` | `String @default("")` |
| `number` | `String` (نرمالایزشده ۱۱ رقم) |
| relation | `account` |
| index/unique | `@@unique([accountId, number])`، `@@index([accountId])` |

### `AccountContact` (`account_contacts`)
| فیلد | نوع |
|---|---|
| `id` | `String @id @default(cuid())` |
| `accountId` | `String` |
| `name` | `String` |
| `role` | `String @default("")` |
| `phone` | `String @default("")` |
| relation | `account`، `@@index([accountId])` |

### `Lead` (`leads`)
| فیلد | نوع |
|---|---|
| `id` | `String @id` (خوانا: `LD-1001, …`) |
| `accountId` | `String?` |
| `line` | `String @default("prod")` (`prod \| agency`) |
| `stage` | `String @default("raw")` (`raw \| opp \| pf \| won \| lost`) |
| `title` | `String @default("")` |
| `amount` | `Int?` (ریال؛ گردکردن ۱۰۰ هزارتومانی به فاز ۴ موکل شد — R-08) |
| `ownerId` | `String?` |
| `source` | `String @default("")` (از لیست `sources`) |
| `note` | `String @default("")` |
| `lostReason` | `String?` (فقط هنگام `stage="lost"`) |
| `lostFrom` | `String?` (مرحله قبلی برای بازگرداندن) |
| `createdAt` / `updatedAt` | `BigInt @default(0)` (UTC ms) |
| relations | `account`, `owner`, `followups`, `interest` |
| index | `@@index([line, stage])`, `@@index([ownerId])`, `@@index([accountId])` |

### `LeadFollowup` (`lead_followups`)
| فیلد | نوع |
|---|---|
| `id` | `String @id @default(cuid())` |
| `leadId` | `String` |
| `at` | `BigInt` (UTC ms) |
| `kind` | `String @default("note")` (`in \| stage \| note \| lost`) |
| `result` | `String @default("")` (از لیست `results`) |
| `note` | `String @default("")` |
| `nextAt` | `String?` (`YYYY/MM/DD` ASCII — CD-06) |
| `byUserId` | `String?` |
| index | `@@index([leadId, at])` |

### `LeadInterest` (`lead_interest`)
| فیلد | نوع |
|---|---|
| `leadId` | `String` |
| `productId` | `String` |
| کلید | `@@id([leadId, productId])`، `@@index([productId])` |

---

## ۴. مسیرهای API (method + path + permission + status codes)

همه Route Handlerها طبق CD-04 دقیقاً ۵ مرحله را طی می‌کنند:
`auth → permission (requirePermission) → Zod → service → response`.

| Method | Path | Permission | Status codes | تست |
|---|---|---|---|---|
| GET | `/api/leads` | `leads.view` (scopes با `leads.viewAll`) | 200, 400, 401, 403 | ✅ |
| POST | `/api/leads` | `leads.create` (+`leads.assign` اگر `ownerId`) | 201, 400, 401, 403, 409 | ✅ |
| GET | `/api/leads/[id]` | `leads.view` | 200, 401, 403, 404 | ✅ |
| PATCH | `/api/leads/[id]` | `leads.edit` (+`leads.assign` اگر `ownerId`) | 200, 400, 401, 403, 404 | ✅ |
| GET | `/api/leads/[id]/followups` | `leads.view` | 200, 401, 403, 404 | ✅ |
| POST | `/api/leads/[id]/followups` | `leads.edit` | 201, 400, 401, 403, 404, 409 | ✅ |
| POST | `/api/leads/import` | `leads.import` (+`leads.assign` اگر `ownerId`) | 200, 400, 401, 403 | ✅ |
| GET | `/api/customers` | `customers.view` | 200, 400, 401, 403 | ✅ |
| POST | `/api/customers` | `customers.create` | 201, 400, 401, 403, 409 | ✅ |
| GET | `/api/customers/[id]` | `customers.view` | 200, 401, 403, 404 | ✅ |
| PATCH | `/api/customers/[id]` | `customers.edit` | 200, 400, 401, 403, 404, 409 | ✅ |
| POST | `/api/customers/[id]/deactivate` | `customers.edit` | 204, 401, 403, 404 | ✅ |

**نقشه مجوزها:** نقش admin/management همه مجوزها را دارند؛ sales `leads.*` خودش را
می‌بیند (scoping در سرور با `LeadListScope.restrictToOwner`)؛ production/depot
هیچ مجوز CRM ندارند → ۴۰۳ در همه مسیرها (A-3.5). نقش `noMoney` در سطح سرور
فیلتر مبلغ را فعال می‌کند (قانون `noMoney` — CLAUDE.md §۹).

**پاکت خطای استاندارد:** همه خطاها با `{ error: { code, message, fields? } }`
و کد وضعیت مناسب بازمی‌گردند (`src/core/errors`).

---

## ۵. قوانین کسب‌کار با ارجاع (file:line)

منبع کامل: `docs/knowledge/VALIDATION_AND_BUSINESS_RULES.md` §۷. خلاصه با ارجاع‌های کلیدی:

| قانون | منبع Demo | پیاده‌سازی |
|---|---|---|
| تلفن سرنخ: ۱۱ رقم آغاز با ۰ | `app/lead-core.js:54` | `createLeadSchema` superRefine (`lead.schema.ts:41`) |
| تکرار تلفن → ۴۰۹ | `app/lead-core.js:55`، `app/leads.js:330` | `assertPhonesAvailable` (`account.service.ts:114`) |
| منبع ورود اجباری از لیست ثابت | `app/leads.js:324` | `leadSourceSchema` (`lead.schema.ts:26`) |
| line: `prod`/`agency`، پیش‌فرض prod | `app/core.js:199` | `leadLineSchema` (`lead.schema.ts:20`) |
| stage: ۵ مرحله | `app/server-export.js:48` | `leadStageSchema` (`lead.schema.ts:23`) |
| ورود به lost نیازمند دلیل + ذخیره lostFrom | `app/leads.js:474-475` | `moveStageSchema` (`lead.schema.ts:83` — refine خط ۹۶) |
| بازگرداندن از lost: رفتن به lostFrom (مگر `pf` → `opp`) | `app/leads.js:539` | `moveLeadStage` در `lead.service.ts` |
| رویداد تاریخچه kind=stage با متن «از ← به» | `app/lead-core.js:75` | `moveLeadStage` (`lead.service.ts` — `__tx.leadFollowup.create`) |
| نتیجه یا یادداشت پیگیری | `app/leads.js:399` | `createFollowupSchema` متداول |
| واردات CSV: رد تکراری خودکار + پیام فارسی | `app/leads.js:334` | `importLeads` در `lead.service.ts` |
| نوع حساب + نام اجباری برای non-unknown | `app/lead-core.js:57` | `createAccountSchema` superRefine (`account.schema.ts`) |
| نرمال‌سازی تلفن | `app/core.js:538` | `normalizePhone` (`src/core/formatting/phone.ts`) |

**قوانین ثبت‌شده در DECISION_LOG:** CD-23 (رفتار کامل جابه‌جایی مرحله)،
CD-24 (اجازه ایجاد/ویرایش مستقیم حساب در فاز ۳).
**هیچ قانون کسب‌کاری اختراع نشد** — همه با ارجاع Demo (CLAUDE.md §۱۳).

---

## ۶. پوشش آزمون‌ها

خروجی واقعی `npm run test:coverage` (تمام فایل‌های بررسی‌شده در `src/core` و `src/modules`):

```
All files          |   91.89% Stmts | 80.98% Branch | 92.89% Funcs | 94.53% Lines
 core/api          |     100 |  91.66 |   100 |   100
 core/auth         |   93.18 |  93.75 |   100 | 96.11
 core/calendar     |    91.5 |  77.46 | 96.42 | 94.61
 core/database     |   81.57 |  42.85 | 83.33 | 80.55
 core/formatting   |   96.29 |  78.12 |   100 |   100
 core/logging      |   80.95 |  81.81 |  87.5 | 84.21
 core/permissions  |   94.11 |     90 |   100 |   100
 core/query        |   61.53 |    100 | 55.55 | 66.66
 core/validation   |     100 |  84.61 |   100 |   100
 customers/services|   96.22 |  81.57 |    95 | 95.74
 leads/services    |    90.73 |   73.5 |  87.5 | 95.26
```

**خلاصه:** Statements **91.89%** (703/765)، Branches **80.98%** (345/426)،
Functions **92.89%** (183/197)، Lines **94.53%** (606/641).
منطق کسب‌کار ماژول‌های جدید: leads services 90.73% / customers services 96.22%.

**تعداد تست‌ها:** ۴۳۳ تست در ۴۲ فایل. از این تعداد **۱۷۹ تست** مستقیماً به فاز ۳
تعلق دارند: leads schemas ۳۸، leads services ۲۹، leads components ۲۰، customers
schemas ۱۵، customers services ۱۵، customers components ۱۰، leads routes ۳۱،
customers routes ۲۱.

---

## ۷. انحرافات و دلیل

| # | انحراف | دلیل | مستندسازی |
|---|---|---|---|
| D-1 | لغو پیش‌فاکتور هنگام انتقال به lost پیاده‌سازی نشده (`leads.js:476-477`) | پیش‌فاکتور در فاز ۴ ساخته می‌شود (PHASE_03 §۴) | VALIDATION_AND_BUSINESS_RULES §۷.۲ |
| D-2 | relax شده: پیگیری حداقل یکی از نتیجه/یادداشت | فرم ساده‌شده فاز ۳؛ Demo نتیجه را مشروط به پاسخ labeling کرده است | §۷.۳ |
| D-3 | شمارش `tries` (تماس‌ها در مرحله raw) پیاده‌سازی نشده | فیلدی در مدل Lead وجود ندارد — نیاز به schema change؛ به فاز ۴ موکل شد | §۷.۳ |
| D-4 | ایجاد/ویرایش مستقیم حساب مجاز است (Demo فقط از پرونده سرنخ) | تایید مالک فاز (PHASE_03 §۳)؛ تکرار با بررسی سمت سرور ۴۰۹ تضمین می‌شود | CD-24 |
| D-5 | مخاطبین/تلفن‌ها در AccountForm قابل ویرایش‌اند (Demo تلفن مخاطب را فقط‌خواندنی می‌کند) | تایید مالک (CD-24)؛ جلوگیری از تکرار در سرور | §۷.۵ |
| D-6 | گردکردن ۱۰۰ هزارتومانی `rnd` پیاده‌سازی نشده | مخصوص خطوط سفارش است — فاز ۴ (R-08)؛ `moneySchema` عدد صحیح غیرمنفی تضمین می‌کند | §۷.۱ + `schema.prisma:368` |
| D-7 | پیام‌های خطای Zod انگلیسی هستند | **دستور صریح مالک:** فرهنگ لغت فارسی به فاز بعد موکل شد | known limitation |
| D-8 | Q-01 (settings.rate) و Q-02 (settings.discountCap) پیاده‌سازی نشده | **دستور صریح مالک:** همچنان معوق به فاز ۴ | DECISION_LOG |

---

## ۸. Blockers / Open Questions

**Blockers:** هیچ‌کدام. همه دروازه‌های اجرایی exit 0 شدند و همه تست‌ها سبزند.

**یادداشت محیطی:** در طول اجرای `tsc` فشار حافظه سیستم (۱۵.۸GB کل، گاه تنها
~۰.۸GB آزاد — پراسس‌های خارج از کنترل این نشست) باعث چند بار خطای OOM در tsc؛ با redirect خروجی به فایل و اجرای مجدد پس از آزاد شدن RAM حل شد.
در اجرای نهایی هیچ خطایی نبود.

**Open Questions (موجودی، در JAN سیستم فعلی قابل حل نیست):**
- Q-01/Q-02: منطق `rate` و `discountCap` — معوق به فاز ۴ (دستور مالک).
- Q-05: فقط‌خواندنی بودن تلفن حساب — resolve دفاعی با CD-24 (قابل ویرایش، تکرار در سرور).
- Q-08: تعریف دقیق «سرنخ از دست‌رفته» — resolve دفاعی با CD-23.
- Persian Zod messages — معوق (دستور مالک)؛ known limitation.
- شمارش تماس `tries` — معوق به فاز ۴ (نیازمند تغییر schema).

**داده نمونه در dev DB (SQLite):** ۶ سرنخ (LD-1001…LD-1006 در مراحل
raw/raw/opp/pf/won/lost — دومی با lostReason «قیمت بالا»، lostFrom «raw») و
۴ حساب جدید (AC-107…AC-110) برای تأیید زنده UI. این داده‌ها فقط در
پایگاه توسعه هستند و روی migration یا seed رسمی تاثیری ندارند.

---

## ۹. چک‌لیست What to review

برای بازبینی فاز ۳، اولویت‌ها به این ترتیب:

1. **`src/modules/leads/services/lead.service.ts`** — منطق `moveLeadStage`
   (بازگشت از lost طبق leads.js:539) و scoping نقش sales (R-02).
2. **`src/modules/leads/schemas/lead.schema.ts:83-104`** — `moveStageSchema`
   و refine دلیل lost (leads.js:474).
3. **`src/modules/customers/services/account.service.ts:114`** —
   `assertPhonesAvailable` (۴۰۹ تکرار تلفن — قانون بحرانی یکتایی شماره).
4. **Route Handlerها** (`src/app/api/leads`، `src/app/api/customers`) —
   ترتیب ۵ مرحله‌ای CD-04 و یکنواختی status codes.
5. **`docs/knowledge/VALIDATION_AND_BUSINESS_RULES.md` §۷** — اعتبار ارجاعات Demo
   (قوانین ۷.۱–۷.۵) و انحرافات ثبت‌شده.
6. **`docs/DECISION_LOG.md`** — CD-23 / CD-24 و وضعیت معوق بودن Q-01/Q-02.
7. **`scripts/viewport-check-auth.mjs`** — روش تأیید CD-12 بدون Playwright
   (Chrome headless + CDP + کوکی نشست).
8. **`prisma/migrations/20261110063607_crm_leads_customers`** — مطابیت با
   مدل‌های schema.prisma (بدون دسترسی به init فاز ۲).

**نکته بازبینی:** دو utils تست (`type ListQuery` در `lead.service.test.ts` و
fixture در `LeadBoard.test.tsx`) برای مطابقت با امضاهای سرویس/نوع‌ها اصلاح شدند —
بدون تغییر در کد تولید.
