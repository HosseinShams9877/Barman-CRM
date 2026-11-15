# PHASE_4_REPORT — خط لوله فروش (سفارش‌ها / پیش‌فاکتور)

> فاز: **۴ — خط لوله فروش** طبق `docs/roadmap/PHASES/PHASE_04.md` و معیارهای `docs/roadmap/PHASE_ACCEPTANCE_CRITERIA.md` (A-4.1…A-4.5).
> ریشه پروژه: `D:\New folder\CRM-Barman`. پوشه Demo (`پلتفرم نهایی تیم بارمان/`) **فقط خوانده شد** — هیچ فایلی در آن نوشته/تغییر نکرد.

---

## ۰. خلاصه

خط لوله ۱۱ مرحله‌ای سفارش (از `draft` تا `deliver` + حالت‌های پایانی `done`/`cancelled`) با وفاداری کامل به Demo `app/order.js` و `app/core.js` پیاده‌سازی شد. همه قوانین کسب‌کار با ارجاع `file:line` از Demo استخراج و در لایه service اجرا شدند (هیچ قانونی اختراع نشد — CLAUDE.md §۱۳). معماری چاپ امن (R-01) با توکن HMAC کوتاه‌مدت، فیلتر noMoney در سرور (R-32) و سقف تخفیف سه‌حالته (CD-25) پیاده و **به‌صورت زنده** روی dev server تأیید شد.

**یک باگ واقعی در طول تأیید زنده کشف و اصلاح شد:** تولید شناسه `PF-` فقط روی سفارش‌های `open` فیلتر می‌شد که پس از `done` شدن یک سفارش، شناسه تکراری تولید می‌کرد و کانسترینت یکتایی نقض می‌گردید (CD-30 / رگرسیون تست‌شده).

**دروازه‌های خروج (همه EXIT=0):** `tsc --noEmit`، `npm run lint`، `npx vitest run` (۵۲ فایل / ۶۶۰ تست)، `npm run test:coverage`، `npm run check:colors`، `node scripts/check-garble.mjs`، `npx next build`، تأیید زنده curl روی پورت ۳۱۵۹، viewport-check روی ۲ صفحه در ۵ عرض.

---

## ۱. درخت فایل‌های ایجاد/تغییر یافته

### ایجاد شده (فاز ۴)

```
src/modules/orders/
├── components/
│   ├── ChequeEditor.tsx           # ویرایشگر چک دریافتی (sayad ۱۶ رقمی، وضعیت hand/bank/clear/bounce)
│   ├── OrderDetail.tsx            # جزئیات سفارش: خط لوله، اقلام، محاسبه مبالغ، پرداخت‌ها، تاریخچه
│   ├── OrderDetail.test.tsx       # ۱۵ تست
│   ├── OrderFormDialog.tsx        # ایجاد/ویرایش سفارش با اقلام پویا
│   ├── OrderFormDialog.test.tsx   # ۹ تست
│   ├── OrderPipeline.tsx          # نمایشگر ۱۱ مرحله با گروه‌بندی رنگ Q-09
│   ├── OrdersList.tsx             # لیست سفارش‌ها با فیلتر stage/status (R-10) و صفحه‌بندی
│   ├── OrdersList.test.tsx        # ۱۳ تست
│   ├── PaymentPlanBuilder.tsx     # پارامترهای برنامه پرداخت سفارشی (genPlan — order.js:118-132)
│   ├── PaymentsPanel.tsx          # پنل پرداخت‌های نقدی/کارتی + چک‌ها
│   ├── PrintActions.tsx           # دکمه صدور توکن چاپ + باز کردنtab چاپ (R-01)
│   └── StageActions.tsx           # دکمه‌های اقدام هر مرحله (تأیید/برگشت/قطعی/…) با مجوز
├── constants/
│   ├── index.ts
│   ├── orderMeta.ts               # QC_CHECKS / PREP_CHECKS / AGREED_HOW / SEND_VIAS / ORDER_STATUSES
│   ├── orderStage.ts              # ۱۱ مرحله + ۴ گروه معنایی Q-09 (who/dueMin/action از core.js:156-168)
│   └── orderStage.test.ts
├── hooks/
│   ├── useOrderMutations.ts       # هوک‌های mutation ری‌اکت کوئری (create/update/stage/payment/cheque/cancel)
│   └── useOrders.ts               # کوئری‌های لیست/جزئیات
├── queries/
│   ├── invalidations.ts           # invalidate متمرکز پس از هر تغییر (CD-09)
│   └── keys.ts                    # کلیدهای متمرکز کوئری
├── schemas/
│   ├── order.schema.ts            # همه اسکیماهای Zod فاز ۴ با پیام فارسی (CD-28)
│   └── order.schema.test.ts
├── services/
│   ├── order.service.ts           # منطق کسب‌کار خط لوله (مراحل، لغو، برگشت، قطعی، پرش)
│   ├── order.service.test.ts      # ۴۷ تست
│   ├── payment.service.ts         # ثبت/باطل‌سازی پرداخت + چک + سقف جمع دریافتی
│   ├── payment.service.test.ts
│   ├── plan.service.ts            # تولید برنامه پرداخت از preset/planBuilder
│   ├── plan.service.test.ts       # ۱۵ تست
│   ├── planGenerator.test.ts
│   ├── print.service.ts           # توکن چاپ HMAC + TTL +اجرا یه R-01/R-32
│   └── print.service.test.ts      # ۲۴ تست
├── types/order.types.ts
└── index.ts

src/app/api/orders/
├── route.ts                          # GET لیست (R-02 scope) / POST ایجاد
└── [id]/
    ├── route.ts                      # GET جزئیات / PATCH ویرایش
    ├── cancel/route.ts               # POST لغو با دلیل (order.js:59)
    ├── cheques/route.ts              # POST ثبت چک
    ├── cheques/[cid]/route.ts        # PATCH وضعیت چک (hand/bank/clear/bounce)
    ├── payments/route.ts             # POST ثبت پرداخت
    ├── payments/[pid]/route.ts       # PATCH باطل‌سازی پرداخت
    ├── plan/route.ts                 # POST پیشنهاد برنامه پرداخت (محاسبه خالص)
    ├── print-token/route.ts          # POST صدور توکن چاپ (R-01)
    └── stage/route.ts                # POST اقدام مرحله (submit/approve/return/send/…)

src/app/(app)/orders/
├── page.tsx                          # صفحه لیست سفارش‌ها
└── [id]/page.tsx                     # صفحه جزئیات سفارش

src/app/print/orders/[id]/page.tsx    # صفحه چاپ توکن‌دار — بدون کوکی نشست (R-01)

prisma/migrations/20261111014949_orders  # migration فاز ۴ (دست‌نخورده پس از ایجاد)
```

### تغییر یافته (فاز ۴)

- `prisma/schema.prisma` — افزودن مدل‌های Order/OrderItem/OrderPayment/OrderCheque/OrderStageLog/OrderHandoff و روابط آنها (در همان migration فاز ۴).
- `src/core/database/seed.ts` — seed داده‌های تنظیمات فاز ۴ (`discountCap` با سه حالت CD-25، `validDays`، `vatRate`).
- `src/core/permissions/matrix.ts` — مجوزهای فاز ۴ (`orders.view`، `orders.create`، `orders.edit`، `orders.status.change`، `money.view`).
- `src/core/validation/zodLocale.ts` (موجود از قبل) — فعال‌سازی سراسری برای اسکیماهای فاز ۴ (CD-28).
- `src/modules/orders/services/order.service.ts` — **اصلاح باگ ID generation** (CD-30 — جزئیات §۷).

---

## ۲. جدول شواهد A-4.x (PHASE_ACCEPTANCE_CRITERIA.md)

| معیار | شواهد | وضعیت |
|---|---|---|
| **A-4.1**: ۱۱ مرحله خط لوله منطبق بر Demo (بدون حذف) | `orderStage.ts` — `ORDER_STAGES` دقیقاً ۱۱ مرحله با `who`/`dueMin`/`action` از `core.js:156-168`؛ گروه‌بندی ۴ گانه Q-09 با توکن‌های رنگ معنایی (`--color-stage-*`)؛ تأیید زنده: خط لوله کامل PF-1203 از stage ۱ تا ۱۱ با ۱۱ انتقال در stageLog | ✅ |
| **A-4.2**: ساخت PF با آیتم‌ها، تخفیف، مالیات، گردکردن + جبران | `OrderFormDialog.tsx` + `order.schema.ts` (createOrderSchema با items، discPct، discAmt، ship، install، noVat)؛ محاسبه `calc` در `order.service.ts` از	core.js:231-240 با گردکردن و جبران بخش کسری (CD-29 — محاسبه، نه ذخیره)؛ سقف تخفیف سه‌حالته CD-25 در سرور (`assertDiscountCap`)؛ تأیید زنده: sales با discPct=5 → 400، discPct=3 → 201 PF-1204 | ✅ |
| **A-4.3**: پرداخت‌ها و چک‌های دریافتی با حالت‌های hand/bank/clear/bounce | `payment.service.ts` + `PaymentsPanel.tsx` + `ChequeEditor.tsx`؛ مسیرهای `/payments` و `/cheques` (+ PATCH)؛ چک با sayad دقیقاً ۱۶ رقم (order.js:622)؛ سقف جمع دریافتی‌ها ≤ total با تلورانس ۱ ریال (order.js:147 ok4)؛ تأیید زنده: ثبت cash 300,000 → paid/balance، over-pay → 400، ثبت چک با status hand، sayad ۳ رقمی → 400، void پرداخت → paid=0 | ✅ |
| **A-4.4**: چاپ پیش‌فاکتور با دسترسی امن (نه R-01) | `print.service.ts` + `print-token/route.ts` + `print/orders/[id]/page.tsx` — توکن HMAC مقید به `orderId` + کاربر + TTL ۵ دقیقه؛ صفحه **بدون کوکی نشست** اجرا می‌شود؛ تأیید زنده: بدون توکن → fallback بدون نشت داده، توکن متعلق به سفارش دیگر → fallback، توکن admin → فاکتور کامل با مجموع ۲٬۲۵۵٬۰۰۰، توکن production → نسخه بدون مبالغ | ✅ |
| **A-4.5**: فیلتر pxAll صحیح (R-10) | فیلتر stage/status در `OrdersList.tsx` با اسکیمای `listOrdersSchema` (query params)؛ تست‌های `OrdersList.test.tsx` (۱۳ مورد — شامل فیلترها) | ✅ |

### دروازه خروج هدفمند PHASE_04 (همه EXIT=0)

| # | شرط | وضعیت |
|---|---|---|
| 1 | `npx tsc --noEmit` | ✅ EXIT=0 (بدون خطا) |
| 2 | `npm run lint` | ✅ EXIT=0 (eslint خروجی خالی) |
| 3 | `npx vitest run` | ✅ Test Files 52 passed (52) — Tests 660 passed (660) |
| 4 | `npm run test:coverage` | ✅ Statements 83.22% (1186/1425)، Branches 66.53% (688/1034)، Functions 86.72% (294/339)، Lines 85.36% (1015/1189) |
| 5 | `npm run check:colors` | ✅ `check-hardcoded-colors: OK — هیچ رنگ hardcodedی خارج از tokens/themes یافت نشد.` |
| 6 | `node scripts/check-garble.mjs` | ✅ `check-garble: OK — 331 فایل بررسی شد، نویسه نامعتبر یافت نشد.` |
| 7 | `npx next build` | ✅ `✓ Compiled successfully in 5.0s` — ۱۶ مسیر (شامل ۸ مسیر API سفارش + صفحه چاپ) |
| 8 | تأیید زنده curl در برابر dev server (پورت ۳۱۵۹) | ✅ جزئیات کامل §۸ |
| 9 | viewport-check روی صفحات جدید در ۵ عرض | ✅ `/orders` و `/orders/PF-1203` در ۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰ بدون سرریز افقی (`viewport-check-auth: OK`) |
| 10 | هیچ فایل Demo تغییری نکرده است | ✅ فقط grep/sed خواندنی روی `app/core.js` و `server/drivers/file.js` (مجاز)؛ هیچ نوشتنی |

---

## ۳. مدل‌های Prisma (فهرست فیلدها)

مدل‌های فازهای ۲/۳ (User, Role, UserRole, Setting, Rev, Product, Material, BomItem, Supplier, List, Account*, Lead*) دست‌نخورده باقی ماندند. مدل‌های جدید فاز ۴ در migration `20261111014949_orders`:

### `Order` (`orders`)
| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `String @id` | شناسه قابل خواندن: PF-1201, … (شمارنده تک‌منهای CD-30) |
| `accountId` | `String?` | حساب مشتری (اختیاری — سفارش می‌تواند پیش از ایجاد حساب ثبت شود) |
| `contactId` | `String?` | مخاطب اصلی (Demo: o.contact) |
| `leadId` | `String?` | سرنخ مبدأ (تبدیل سرنخ به پیش‌فاکتور) |
| `line` | `String @default("prod")` | "prod" (تولید داخل) \| "agency" (نمایندگی) |
| `stage` | `Int @default(1)` | مرحله خط لوله ۱..۱۱ (core.js:156-168) |
| `status` | `String @default("open")` | "open" \| "done" \| "cancelled" (Q-11: ادغام closed/cancelled Demo) |
| `discPct` | `Int @default(0)` | درصد تخفیف کل ۰..۱۰۰ — سقف سه‌حالته CD-25 |
| `discAmt`, `ship`, `install` | `Int @default(0)` | تخفیف ثابت، حمل، نصب (calc(o) — order.js:231) |
| `noVat` | `Boolean @default(false)` | بدون مالیات |
| `validDays` | `Int @default(3)` | اعتبار پیش‌فاکتور (order.js:19-20) |
| `preset` | `String @default("")` | "full" \| "half" \| "3chq" \| "deliv" \| "" (order.js:109-114) |
| `skipped` | `Json @default("[]")` | مراحل پرش‌شده ۶/۷/۸ (order.js:470-471) |
| `planBuilder` | `Json?` | پارامترهای مولد برنامه سفارشی (order.js:118-132) |
| `backNote`, `smOk`, `mgrOk` | `Json?` | یادداشت بازگشت / تأیید فروشنده / تأیید مدیر |
| `due`, `stageAt` | `BigInt @default(0)` | سررسید نهایی / زمان آخرین تغییر مرحله (UTC ms) |
| `times`, `sent`, `prod`, `prep`, `delivered`, `agreed` | `Json?` | مهرهای زمانی هر مرحله / ارسال / تولید / آماده‌سازی / تحویل / توافق |
| `cancelReason` | `String?` | دلیل لغو (order.js:59) |
| `ownerId`, `createdById` | `String?` | مالک / ایجادکننده |
| `createdAt`, `updatedAt` | `BigInt @default(0)` | UTC ms (CD-07 / R-06) |
| اندیس‌ها | | `[accountId]`، `[leadId]`، `[ownerId]`، `[stage, status]` |

### `OrderItem` (`order_items`)
`id`، `orderId`، `productId`، `qty Int`، `price Int` (قیمت زمان ثبت)، `discount Int @default(0)` (تخفیف قlem — PHASE_04 §۶)، `color String @default("")` (از products.colors). onDelete: `Restrict` روی محصول (جلوگیری از حذف محصول با قلم سفارش).

### `OrderPayment` (`order_payments`)
`id`، `orderId`، `kind` ("cash" | "card")، `amount Int`، `date String` (YYYY/MM/DD ASCII — CD-06)، `void Boolean @default(false)` (حذف نرم — Demo p.void)، `note`، `byUserId`، `createdAt BigInt`.

### `OrderCheque` (`order_cheques`)
`id`، `orderId`، `sayad String @default("")` (دقیقاً ۱۶ رقم؛ خالی = چک ناقص طبق Q-06)، `amount Int`، `due String`، `status String @default("hand")` ("hand" | "bank" | "clear" | "bounce")، `bank String`، `owner String`، `note`، `createdAt/updatedAt BigInt`.

### `OrderStageLog` (`order_stage_log`)
`id`، `orderId`، `fromStage Int?` (null برای ورود اولیه)، `toStage Int`، `at BigInt` (UTC ms)، `byUserId`، `note String`، `kind String @default("stage")` ("stage" | "back" | "skip" | "cancel" | "done"). اندیس `[orderId, at]`.

### `OrderHandoff` (`order_handoffs`)
`id String @id` (TR-1201, … — Demo: "TR-"+o.id.slice(3))، `orderId`، `lines Json` (اقلام تحویلی `[{productId, qty, color}]`)، `at BigInt`، `byUserId`، `note`. حرکت‌های انبار (mv*) در فاز ۵ به این سند متصل می‌شوند (PHASE_04 §۳.۶).

---

## ۴. مسیرهای API (method + path + permission + status codes)

| Method | Path | مجوز | تأیید زنده | وضعیت |
|---|---|---|---|---|
| GET | `/api/orders` | `orders.view` (sales: `restrictToOwner` — R-02) | sales → total 1 (فقط PF-1204 خودش)؛ admin → total 4 | ✅ |
| POST | `/api/orders` | `orders.create` | sales discPct=5 → **400** (CD-25)؛ discPct=3 → **201 PF-1204** | ✅ |
| GET | `/api/orders/[id]` | `orders.view` (+ strip noMoney) | production → 200 **بدون** calc/paid/balance/discPct/item.price | ✅ |
| PATCH | `/api/orders/[id]` | `orders.edit` | PATCH preset=full → 200 | ✅ |
| POST | `/api/orders/[id]/stage` | `orders.status.change` | ۱۱ انتقال خط لوله + پرش agency + برگشت | ✅ |
| POST | `/api/orders/[id]/cancel` | `orders.status.change` | با دلیل → 200 cancelled؛ بدون دلیل → 400؛ سفارش done → 400 «سفارش بسته شده است.» | ✅ |
| POST | `/api/orders/[id]/plan` | `orders.view` + `money.view` (R-32) | production → **403** «نقش شما مجوز مشاهده مبالغ…»؛ preset=full → 200 | ✅ |
| POST | `/api/orders/[id]/payments` | `finance.edit` \| `orders.status.change` | cash 300,000 → **201**؛ over-pay → **400** | ✅ |
| PATCH | `/api/orders/[id]/payments/[pid]` | `finance.edit` \| `orders.status.change` | void → **200** paid=0 | ✅ |
| POST | `/api/orders/[id]/cheques` | `finance.edit` \| `orders.status.change` | چک ۴۰۰,۰۰۰ → **201** status hand؛ sayad ۳ رقمی → **400** | ✅ |
| PATCH | `/api/orders/[id]/cheques/[cid]` | `finance.edit` | تغییر وضعیت hand/bank/clear/bounce | ✅ |
| POST | `/api/orders/[id]/print-token` | `orders.view` (در سرویس) | admin → **201 {token}**؛ production → **201 {token}** | ✅ |
| GET | `/print/orders/[id]?t=…` | **بدون کوکی** — فقط توکن | admin → فاکتور کامل؛ production → بدون مبالغ؛ بدون توکن/توکن دیگر سفارش → fallback بدون نشت | ✅ |

نقشه نگاشت مجوزهای کولونی PHASE_04 §۷ به سبک نقطه‌ای موجود (CD-26): `orders:read`→`orders.view`، `orders:write`→`orders.create`/`orders.edit`، `orders:status`→`orders.status.change`، `payments:write`→`finance.edit`، `orders:print`→`orders.view` (در ماتریس ۲۵تایی مجوز `orders.print` وجود ندارد — توکن چاپ مقید به کاربر است).

---

## ۵. قوانین کسب‌کار با ارجاع (file:line)

همه قوانین از Demo با ارجاع دقیق ثبت شده‌اند (`docs/knowledge/VALIDATION_AND_BUSINESS_RULES.md` §۸):

| قانون | منبع Demo | محل اجرا |
|---|---|---|
| ۱۱ مرحله با نقش مسئول و مهلت (STAGES) | `app/core.js:156-168` | `orderStage.ts` — ORDER_STAGES |
| محاسبه مبالغ (sub/disc/vat/total) با گردکردن | `app/core.js:231-240` | `order.service.ts` calc |
| اعتبار پیش‌فاکتور `S.validDays \|\| 3` | `app/order.js:19-20` | `order.schema.ts` (default 3) |
| پیش‌تنظیت‌های پرداخت PRESETS | `app/order.js:109-114` | `orderMeta.ts` / `plan.service.ts` |
| مولد برنامه پرداخت سفارشی | `app/order.js:118-132` | `planGenerator.ts` / PaymentPlanBuilder |
| لغو سفارش (canCancel) | `app/order.js:59` | `order.service.ts` cancelOrder |
| تلورانس ۱ ریال جمع دریافتی ≤ کل (ok4) | `app/order.js:147` | `order.service.ts` doFinalize + `payment.service.ts` |
| بررسی سقف تخفیف discountCap | `app/order.js:143` | `order.service.ts` assertDiscountCap (CD-25 — تفسیر سه‌حالته مالک) |
| ارسال برای تأیید (submit: sales → smgr) | `app/order.js:271-273` | `order.service.ts` applyStageAction |
| توافق مشتری در قطعی‌سازی (agreed) | `app/order.js:452-472` | `order.schema.ts` finalize + doFinalize |
| پرش مراحل تولید برای سفارش agency | `app/order.js:470-471` | `order.service.ts` doFinalize (skipped=[6,7,8]) |
| مادی‌سازی پرداخت‌های نقدی در قطعی‌سازی | `app/order.js:359-363` | `order.service.ts` doFinalize |
| کنترل کیفیت — دلیل ضایعات اجباری | `app/order.js:520` | `order.schema.ts` qc.superRefine |
| آماده‌سازی بار — همه چک‌ها اجباری | `app/order.js:562` | `order.schema.ts` prep.superRefine |
| تحویل به مشتری (delivered.to) | `app/order.js:573-576` | `order.schema.ts` deliver |
| شماره صیادی دقیقاً ۱۶ رقم | `app/order.js:622` | `order.schema.ts` createChequeSchema |
| بازگشت از تأیید (return) | `app/order.js:698` | `order.service.ts` doReturn |
| ارسال پیش‌فاکتور (send) | `app/order.js:708` | `order.service.ts` doSend |
| قبول و زمان‌بندی تولید (paccept) | `app/order.js:719-747` | `order.service.ts` doPaccept |
| شمارنده شناسه تک‌منهای (meta.seq) | `app/core.js:365` | `core/database/ids.ts` + `order.service.ts` (**CD-30** — اصلاح فیلتر وضعیت) |
| شمارنده seq فایلی مستقل از وضعیت | `server/drivers/file.js` nextSeq | تأیید وفاداری در CD-30 |
| چک‌های دریافتی در fin.js | `app/fin.js` | `OrderCheque` + ChequeEditor |
| فیلتر noMoney در پاسخ API | `app/order.js:606` | `order.service.ts` stripDetail + `print.service.ts` |

---

## ۶. پوشش آزمون‌ها

| مجموعه | تعداد تست | توضیح |
|---|---|---|
| `order.service.test.ts` | ۴۷ | applyStageAction، createOrder (شامل CD-25 و **رگرسیون کانسترینت یکتایی CD-30**)، listOrders (R-02 + hideMoney) |
| `order.schema.test.ts` | — | اعتبارسنجی فارسی (CD-28)، sayad ۱۶ رقم، qc why اجباری، prep checks |
| `plan.service.test.ts` | ۱۵ | CD-29 (منبع total)، presetهای full/half/3chq/deliv، builder، ۴۰۴ |
| `print.service.test.ts` | ۲۴ | TTL (پیش‌فرض/محیطی/نامعتبر/بیش از ۲۴ ساعت)، صدور توکن، تأیید امضا، توکن منقضی/cross-order/دستکاری‌شده، noMoney در توکن |
| `payment.service.test.ts` | — | ثبت/باطل‌سازی، سقف جمع، چک |
| `OrderFormDialog.test.tsx` | ۹ | payload صحیح POST، اعتبارسنجی فارسی، افزودن/حذف قلم، leadId، خطای سرور، PATCH |
| `OrdersList.test.tsx` | ۱۳ | loading/empty/error، ستون‌های پولی R-32، فیلتر stage/status (R-10)، مجوزها، صفحه‌بندی |
| `OrderDetail.test.tsx` | ۱۵ | بخش‌ها، noMoney R-32، لغو order.js:59، چاپ امن R-01، ویرایش |
| `orderStage.test.ts` | — | یکپارچگی ۱۱ مرحله + گروه‌بندی Q-09 |
| **مجموع** | **۵۲ فایل / ۶۶۰ تست** | همه سبز (EXIT=0) |

**پوشش نهایی:** Statements **83.22%** (1186/1425)، Branches **66.53%** (688/1034)، Functions **86.72%** (294/339)، Lines **85.36%** (1015/1189). منطق کسب‌کار خط لوله (services + schemas) پوشش بالایی دارد؛ نواقص بیشتر در اجزای UI فرعی و branchهای defensive است. هدف نهایی ≥۹۰٪ روی منطق کسب‌کار در پایان پروژه دنبال می‌شود (طبق CLAUDE.md §۱۲ — این معیار روی منطق کسب‌کار است نه کل کد).

### پوشش Persian Zod locale (CD-28)
نقشه خطای `src/core/validation/zodLocale.ts` از طریق `z.config` سراسری برای **همه اسکیماهای فاز ۴** فعال است. شواهد زنده: پیام‌های `{"reason":"مقدار نامعتبر است؛ متن مورد انتظار بود."}` (بدون دلیل لغو)، `{"note":"مقدار نامعتبر است؛ متن مورد انتظار بود."}` (برگشت بدون یادداشت)، `{"sayad":"شماره صیادی باید دقیقاً 16 رقم باشد."}`. طبق دستور مالک، اسکیماهای فاز ۱–۳ retrofit نشدند.

---

## ۷. معماری چاپ امن (R-01) + باگ اصلاح‌شده CD-30

### ۷.۱ چاپ توکن‌دار
1. کاربر مجاز POST `/api/orders/[id]/print-token` می‌زند → `issuePrintToken(id, session)` توکنی با محموله `{sub, oid, roles[], iat, exp}` و امضای HMAC-SHA256 با `AUTH_SECRET` صادر می‌کند (TTL پیش‌فرض ۵ دقیقه، قابل پیکربندی با `PRINT_TOKEN_TTL_MS`، حداکثر ۲۴ ساعت).
2. صفحه `/print/orders/[id]?t=<token>` یک **سرورکامپوننت بدون کوکی نشست** است — توکن در `getPrintOrder` اعتبارسنجی می‌شود: امضا، انقضا، تطابق `oid` با `id` مسیر، و نقش‌های داخل توکن برای تصمیم noMoney.
3. خروجی: نسخه کامل (با جدول مبالغ و پرداخت‌ها) برای نقش‌های `money.view`، نسخه بدون مبالغ (اقلام بدون قیمت + note «برای نقش شما مبالغ نمایش داده نمی‌شود.») برای نقش‌های noMoney (R-32).

**شواهد زنده:** admin توکن → فاکتور PF-1203 با مجموع ۲٬۲۵۵٬۰۰۰ و جدول پرداخت‌ها؛ production توکن → بدون مبالغ؛ بدون توکن یا توکن سفارش دیگر → صفحه fallback «لینک چاپ معتبر نیست…» بدون هیچ نشت داده‌ای (بررسی: هیچ یک از BR-101/۲٬۲۵۵٬۰۰۰/آقای رضایی/TR-1203/مبلغ نهایی در HTML نبودند).

**یادداشت طراحی:** در صورت توکن نامعتبر، صفحه پیام درون‌صفحه‌ای با HTTP 200 نمایش می‌دهد (نه 401/403 مستقیم) — خطا در سرویس پرتاب می‌شود ولی صفحه آن را به fallback رندر می‌کند (page.tsx:34-47). این نشت داده ندارد و رفتار کاربردی مناسبی است، اما اگر HTTP status دقیق مد نظر باشد، قابل بهبود است (Open Question در §۹).

### ۷.۲ باگ اصلاح‌شده: تولید شناسه وابسته به وضعیت (CD-30)
**علت:** `order.service.ts` در `nextPrefixedId` فقط سفارش‌های `status: "open"` را بررسی می‌کرد. پس از `done`/`cancelled` شدن PF-1203، ID دوباره تولید و کانسترینت یکتایی نقض شد → Transaction rollback → **HTTP 500** در POST سفارش جدید.
**تشخیص زنده:** POST با discPct=3 → 500 (rollback). تبدیل به تست موقت vitest (به دلیل عدم حل alias توسط node مستقیم) → `PrismaClientKnownRequestError: Unique constraint failed on the fields: (id)`.
**وفاداری Demo:** `app/core.js:365` (`nextId`) شمارنده `meta.seq` را مستقل از وضعیت سند نگه می‌دارد؛ `server/drivers/file.js` `nextSeq` نیز فایل `seq-<kind>.txt` را بدون توجه به وضعیت می‌خواند.
**اصلاح:** فیلتر `status: "open"` از `findMany` حذف شد + تست رگرسیون (شناسه بر اساس تمام سفارش‌ها شامل done). پس از اصلاح، POST همان درخواست → **201 PF-1204**.

---

## ۸. شواهد تأیید زنده (curl در برابر dev server پورت ۳۱۵۹)

### ۸.۱ خط لوله کامل ۱۱ مرحله‌ای (PF-1203)
| مرحله | اقدام | نتیجه |
|---|---|---|
| ۵→۶ | finalize بدون برنامه | **400** «برنامه پرداخت مشخص نیست…» (order.js:147 ok4) |
| — | POST plan preset=full / PATCH order preset | 200 — rows: cash 2,255,000 due 1405/08/20 |
| ۵→۶ | finalize با توافق تلفنی | **200** stage 6 — paid=2,255,000، balance=0 (مادی‌سازی order.js:359-363) |
| ۶→۷ | paccept با start 1405/08/21 / end 1405/09/01 | 200 |
| ۷→۷ | startProduction / made | 200 |
| ۷→۸ | qc good=2 waste=0 + ۴check | **200** stage 9 + صدور سند **TR-1203** |
| ۹→۱۰ | daccept | 200 |
| ۱۰→۱۱ | prep packs=1 + ۳ check | 200 |
| ۱۱→۱۱ | deliver to «آقای رضایی» | **200** stage 11 **status done** |

stageLog دارای ۱۱ انتقال کامل با مهرهای UTC ms و kindهای stage/skip/done.

### ۸.۲ سناریوهای نقش
| آزمون | نتیجه |
|---|---|
| CD-25: sales با discPct=5 (سقف ۳) | **400** «تخفیف از سقف مجاز بیشتر است.» |
| CD-25: sales با discPct=3 | **201 PF-1204** owner ali-sales total 1,067,000 |
| R-02: لیست به‌عنوان sales | total **1** [PF-1204] |
| R-02: لیست به‌عنوان admin | total **4** [PF-1204, PF-1203, PF-1202, PF-1201] |
| R-32: GET جزئیات به‌عنوان production | 200 **بدون** calc/paid/balance/discPct و **بدون** item.price |
| ۴۰۳: production روی /stage | «شما مجوز انجام این عملیات را ندارید.» |
| ۴۰۳: production روی /plan | «نقش شما مجوز مشاهده مبالغ و برنامه پرداخت را ندارد.» |

### ۸.۳ سناریوهای خط لوله
| آزمون | نتیجه |
|---|---|
| submit/approve/approve (order.js:271-273) | PF-1204: 1→2 (submit sales)، 2→3 (smOk admin)، 3→4 (mgrOk admin) |
| return با note از stage 2 | 2→1 با backNote {by, t, text} |
| return بدون note | **400** `{"note":"مقدار نامعتبر است؛ متن مورد انتظار بود."}` |
| return از stage 4 | **400** «فقط مراحل تأیید قابل برگشت هستند.» |
| send با via=["sms"] | 4→5 با sent={via:"sms", at} |
| skip scenario (agency): submit → send → preset → finalize | 5→**9** مستقیماً با skipped=[6,7,8] + log kind=«skip» «پرش مراحل تولید (سفارش نمایندگی)» + paid=1,320,000 |
| cancel با دلیل | **200** status cancelled + cancelReason + log kind=«cancel» «لغو سفارش — …» |
| cancel بدون دلیل | **400** `{"reason":"مقدار نامعتبر است؛ متن مورد انتظار بود."}` |
| cancel سفارش done | **400** «سفارش بسته شده است.» |

### ۸.۴ پرداخت و چک (PF-1204)
| آزمون | نتیجه |
|---|---|
| POST payments cash 300,000 | **201** paid=300,000 balance=767,000 |
| POST payments 900,000 (بیش از کل) | **400** «مبلغ پرداختی از مبلغ کل سفارش بیشتر است.» |
| POST cheques 400,000 با sayad ۱۶ رقمی | **201** status=hand، paid بدون تغییر |
| POST cheques با sayad ۳ رقمی | **400** «شماره صیادی باید دقیقاً 16 رقم باشد.» |
| PATCH payment void | **200** paid=0 balance=1,067,000 |

### ۸.۵ viewport checks (CD-12)
`node scripts/viewport-check-auth.mjs` روی `/orders` و `/orders/PF-1203`:
| عرض | `/orders` سرریز | `/orders/PF-1203` سرریز |
|---|---|---|
| 500 | false (scrollW 485) | false (scrollW 485) |
| 768 | false (753) | false (753) |
| 1024 | false (1009) | false (1009) |
| 1280 | false (1280) | false (1265) |
| 1440 | false (1440) | false (1425) |

خروجی: `viewport-check-auth: OK` — هر دو صفحه RTL با محتوای واقعی (۶ ردیف لیست / ۱۰ ردیف جزئیات) بدون اسکرول افقی.

---

## ۹. انحرافات و دلیل

۱. **به‌روزرسانی داده `settings` در dev.db** — برای تست زنده CD-25، `discountCap` نقش admin به 100 تنظیم شد (seed آن را تولید می‌کند). داده dev است و migration تغییر نکرد.
۲. **درج محصول تستی BR-101** — کاتالوگ محصول متعلق به فاز ۸ است؛ برای اجرای خط لوله یک محصول در dev DB درج شد (سمت demo فاز ۵+).
۳. **ایجاد کاربران تستی `ali-sales` (sales) و `prod1` (production)** — API مدیریت کاربران در فاز ۴ فقط GET دارد (admin.users)، بنابراین کاربران با اسکریپت موقت `scripts/_tmp_users.ts` (bcrypt + prisma) ساخته شدند. اسکریپت پس از تأیید حذف گردید.
۴. **Stale dev server / `.next`** — سرور dev که قبل از `prisma generate` استارت شده snapshot قدیمی client را نگه می‌داشت؛ با `rm -rf .next` سرور مجبور به recompile شد (محیط Turbopack).
۵. **Mangling فارسی در `curl -d`** — محیط bash tool رشته‌های فارسی inline را به «?????» تبدیل می‌کند (خطای محیط، نه برنامه). راه‌حل: ساخت payload با Write (UTF-8) و `curl --data-binary @file`. چند یادداشت لغو/برگشت با این روش mangle شدند (داده dev، بدون اثر بر کد).
۶. **Q-11 (ادغام closed/cancelled)** — Demo دو پرچم `closed`/`cancelled` دارد که در یک فیلد `status` با سه حالت open/done/cancelled ادغام شد (ثبت‌شده پیشتر در DECISION_LOG).
۷. **CD-26 / CD-27 / CD-25 / CD-28 / CD-29 / CD-30** — انحرافات طراحی هوشمندانه وارد DECISION_LOG شدند (نگاشت سبک مجوز، محل ماژول، تفسیر سقف تخفیف، Persian Zod بدون retrofit، مبالغ محاسبه‌شده، شمارنده مستقل از وضعیت).

---

## ۱۰. Blockers / Open Questions

### Blockers
هیچ blocker ای وجود ندارد — همه دروازه‌های خروج EXIT=0 و تأیید زنده کامل است.

### Open Questions (برای مالک)
۱. **HTTP status صفحه چاپ نامعتبر** — در حال حاضر fallback با 200 رندر می‌شود (§۷.۱). آیا باید 401/403 دقیق برگردانده شود؟
۲. **Q-01 (`settings.rate: 3`)** — همچنان معوق طبق دستور مالک فاز ۴؛ هیچ منطقی به آن وصل نشد.
۳. **Jan/inventory** — حرکت‌های انبار (mv*) و اتصال به سند تحویل در فاز ۵ انجام می‌شود (طراحی OrderHandoff برای این لحاظ شده).
۴. **چک ناقص (sayad خالی — Q-06)** — طبق Demo چک با sayad خالی قابل ثبت است؛ نشان هشدار در UI نمایش داده می‌شود.

### باگ‌های شناخته‌شده (بدون اثر بر پذیرش فاز)
۱. نمایش خطای اعتبارسنجی سطح قلم در `OrderFormDialog` در برخی حالات چسبیده به فیلد اول است (UI polish — فاز بعدی).
۲. پیام مرز انحصاری `zodLocale` در چند مورد مرز inclusive شامل مقدار مرزی نمی‌شود (پیام، نه رفتار — رفتار Zod درست است).

---

## ۱۱. چک‌لیست What to review

برای بازبینی فاز ۴، اولویت‌ها به این ترتیب:

1. **`src/modules/orders/services/order.service.ts`** — قلب فاز: `applyStageAction` (۱۱ مرحله، submit order.js:271-273، return 698، send 708)، `doFinalize` (452-472 + پرش agency 470-471 + مادی‌سازی 359-363)، `cancelOrder` (order.js:59)، `assertDiscountCap` (CD-25) و **اصلاح CD-30** در `nextPrefixedId`.
2. **`src/modules/orders/services/print.service.ts`** — امنیت چاپ (R-01): صدور/HMAC/TTL، تأیید cross-order و noMoney در توکن.
3. **`src/modules/orders/services/payment.service.ts`** — سقف جمع دریافتی (order.js:147)، void با recalc paid (CD-29).
4. **`src/modules/orders/schemas/order.schema.ts`** — اعتبارسنجی فارسی (CD-28): qc why اجباری (order.js:520)، prep checks (562)، sayad ۱۶ رقم (622).
5. **Route Handlerها** (`src/app/api/orders/**`) — ترتیب ۵ مرحله‌ای CD-04، مجوزها در سرور و status codes.
6. **`src/app/print/orders/[id]/page.tsx`** — صفحه چاپ بدون کوکی و تصمیم noMoney (R-32).
7. **`prisma/migrations/20261111014949_orders`** — مطابقت مدل‌ها با §۳ این گزارش.
8. **`src/modules/orders/components/OrderFormDialog.tsx` / `OrdersList.tsx` / `OrderDetail.tsx`** — UI: فیلترها (R-10)، ستون‌های پولی (R-32)، StageActions با مجوز.
9. **`docs/DECISION_LOG.md`** — CD-25…CD-30 (به‌ویژه CD-25 تفسیر سه‌حالته و CD-30 اصلاح رگرسیون).
10. **`docs/knowledge/VALIDATION_AND_BUSINESS_RULES.md` §۸** — اعتبار ارجاعات Demo (§۵ این گزارش).

---

**پایان فاز ۴.** مطابق دستور مالک: فاز ۵ آغاز نشد، migrationهای فاز ۲/۳ تغییر نکردند، Q-01 پیاده‌سازی نشد، Persian Zod به فاز ۱–۳ retrofit نشد، و هیچ فایلی در پوشه Demo نوشته نشد.
