# PHASE 06 — خرید و مالی (Purchasing & Finance)

> بازسازی `app/buy.html`/`app/buy.js` و `app/fin.html`/`app/fin.js`: جریان درخواست خرید (`BY`) از `req` تا `recv`، چک‌های صادره (`issued` → `paid`)، دریافتنی‌ها و پرداختنی‌ها، و دفتر هزینه‌های متفرقه (`txns`). تمام مبالغ فقط در لایه سرور و برای نقش‌های مجاز قابل دسترسی هستند.

---

## ۱. هدف فاز

انتقال کامل جریان خرید و مالی: درخواست خرید مواد با تأیید مدیر و تأیید مالی، رسید انبار (اتصال به فاز ۵)، مدیریت چک‌های صادره و پرداخت‌ها، محاسبه دریافتنی‌ها (چک‌های دریافتی مشتری از فاز ۴ + مطالبات نسیه) و پرداختنی‌ها (چک‌های خرید + مطالبات تأمین‌کنندگان)، و دفتر هزینه/درآمد متفرقه (در صورت تأیید Q-14، مانده دائمی).

## ۲. پیش‌نیازها و وابستگی‌ها

- وابسته به **فاز ۲** (مجوز سرور، تقویم، قالب‌بندی، Zod) و **فاز ۵** (رسید خرید → حرکت `kind: buy` در انبار `raw`).
- وابسته به **فاز ۴** برای داده‌های چک دریافتی و پرداخت سفارش (این فاز فقط پرداختنی‌های مرتبط را می‌خواند).
- وابسته به پاسخ: Q-12 (گزارش ماهانه با bucketing بر اساس JDN — موتور مشترک)، Q-13 (فایل‌ها/پیوست‌ها برای اسناد خرید)، Q-14 (آیا `txns` ذخیره شود یا فقط گزارش محاسبه‌شده).
- مرجع بازرسی: `app/fin.js` (rec/pay، `txns` با ۸ نوع هزینه ثابت، `data-exp`، tab پرداخت)، `app/buy.js` (جریان `BY`، `chq: issued|paid`)، `DATA_MODEL.md` بخش ۲.۵.

## ۳. دامنه کارها

۱. ماژول `purchasing`: درخواست خرید `BY` با اقلام مواد (مقدار/قیمت)، وضعیت‌های `req` → `ok` (تأیید مدیر خرید) → `fin` (تأیید مالی + ثبت چک) → `recv` (رسید انبار).
۲. هر تأیید یک رکورد تاریخچه با کاربر و مهر زمانی ایجاد می‌کند (استفاده از `rev` برای تشخیص تداخل — رفع R-06).
۳. ثبت چک صادره: `amount`، `due` (`YYYY/MM/DD`)، `sayad` اختیاری (طبق قانون Demo)، وضعیت `issued` → `paid`.
۴. رسید انبار: دکمه‌ای که حرکت `kind: buy` (مثبت) در انبار `raw` ایجاد می‌کند (فراخوانی ماژول inventory فاز ۵) و `BY` را به `recv` می‌برد.
۵. ماژول `finance` — بخش دریافتنی‌ها: تجمیع چک‌های دریافتی (از `order_cheques` فاز ۴) و مطالبات نسیه سفارش‌ها (مرجع `r.amount`) + `extraPays`.
۶. بخش پرداختنی‌ها: چک‌های صادره (`issued`/`paid`) + مطالبات تأمین‌کنندگان (مجموع `BY` تأییدشده و پرداخت‌نشده).
۷. دفتر هزینه/درآمد متفرقه (`txns`): ۸ نوع هزینه ثابت دقیقاً مطابق Demo + دریافت متفرقه — ذخیره‌شده در پایگاه داده در صورت پاسخ مثبت Q-14 (در Demo فقط در حافظه است).
۸. گزارش جریان نقدی ماهانه با bucketing تاریخ بر اساس JDN (رفع R-11 — به‌جای `slice(0,7)` رشته‌ای).
۹. محدودیت دید: نقش production/warehouse هیچ مبلغی نمی‌بینند (فیلتر سرور — R-32).

## ۴. خارج از دامنه

- چاپ چک و گزارش‌های مالی کامل (فاز ۷).
- کاتالوگ تأمین‌کنندگان (فاز ۷ — این فاز `suppliers` را فقط می‌خواند).
- پورسانت و تنخواه (در Demo وجود ندارد — اختراع نشو).

## ۵. فایل‌ها و ساختار ماژول‌های ساخته‌شده

```
src/modules/purchasing/
├── components/ (BuyList, BuyForm, BuyApprovePanel, ChequePaymentEditor)
├── hooks/      (useBuys, useBuyMutations)
├── services/   (buy.service.ts)
├── schemas/    (buy.schema.ts, buy-cheque.schema.ts)
├── types/
├── constants/  (BUY_STATUS.ts, EXPENSE_KINDS.ts)
├── queries/
└── index.ts
src/modules/finance/
├── components/ (ReceivablesView, PayablesView, TxnDialog, CashflowReport)
├── hooks/      (useTxns, usePayables, useReceivables)
├── services/   (txn.service.ts, receivable.service.ts,
│                payable.service.ts, cashflow.service.ts)
├── schemas/    (txn.schema.ts)
├── types/
├── constants/  (TXN_KINDS.ts)
├── queries/
└── index.ts
src/app/(app)/buys/page.tsx, /buys/[id]/page.tsx, /finance/page.tsx
src/app/api/buys/..., /api/txns/..., /api/finance/...
```

## ۶. مدل داده و تغییرات Schema

- `buys` (id با پیشوند `BY-`، supplierId، status: `req|ok|fin|recv`، total، createdBy، rev)
- `buy_items` (buyId، materialId، qty، price)
- `buy_cheques` (buyId، amount، due `YYYY/MM/DD`، sayad nullable، status: `issued|paid`)
- `buy_status_log` (buyId، fromStatus، toStatus، at، byUserId)
- `txns` (در صورت تأیید Q-14: kind از ۸ نوع، amount، direction: `expense|income`، at `YYYY/MM/DD`، note)
- جداول `suppliers` و چک‌های دریافتی در فازهای ۲/۴ موجود هستند.

## ۷. API و Route Handlerها

| مسیر | روش | مجوز | توضیح |
|---|---|---|---|
| `/api/buys` | GET | `purchasing:read` | با فیلتر وضعیت و تأمین‌کننده |
| `/api/buys` | POST | `purchasing:write` | ایجاد `BY status: req` |
| `/api/buys/[id]` | GET/PATCH | `purchasing:read`/`purchasing:write` | ویرایش فقط در `req` |
| `/api/buys/[id]/approve` | POST | `purchasing:approve` | `req → ok` |
| `/api/buys/[id]/finance` | POST | `finance:approve` | `ok → fin` + ثبت چک |
| `/api/buys/[id]/receive` | POST | `inventory:write` | `fin → recv` + حرکت `kind: buy` |
| `/api/buys/[id]/cheques/[cid]` | PATCH | `finance:write` | `issued → paid` |
| `/api/txns` | GET/POST | `finance:read`/`finance:write` | دفتر هزینه (در صورت تأیید Q-14) |
| `/api/finance/receivables` | GET | `finance:read` | تجمیع چک‌های دریافتی و نسیه |
| `/api/finance/payables` | GET | `finance:read` | چک‌های صادره و مطالبات تأمین‌کنندگان |
| `/api/finance/cashflow` | GET | `finance:read` | bucketing ماهانه با JDN (رفع R-11) |

## ۸. مجوزها و امنیت

- `purchasing:read/write/approve`، `finance:read/write/approve` — ماتریس طبق `USER_ROLES_AND_PERMISSIONS.md`.
- نقش finance تنها نقشی است که مبالغ را می‌بیند؛ نقش production/warehouse پاسخ API فیلترشده دریافت می‌کند (تست R-32 در هر مسیر).
- هر جابه‌جایی وضعیت باید مسیر مجاز state machine باشد — پرش غیرمجاز در سرور رد می‌شود (Zod).
- تاریخ سررسید چک در سرور با `core/calendar` اعتبارسنجی می‌شود.

## ۹. تقویم و تاریخ

- `due` چک و `at` تراکنش‌ها: `YYYY/MM/DD` ASCII.
- bucketing ماهانه برای گزارش جریان نقدی: تبدیل تاریخ به JDN، سپس استخراج ماه شمسی (رفع R-11 — در Demo `slice(0,7)` فرض می‌کرد قالب تاریخ همیشه یکنواخت است).
- نمایش همه تاریخ‌ها در UI فارسی.

## ۱۰. رابط کاربری (کامپوننت‌ها)

- `BuyList` با فیلتر وضعیت و نشانگر مرحله جریان (req → ok → fin → recv).
- `ChequePaymentEditor` برای ثبت و تغییر وضعیت چک صادره.
- `ReceivablesView`/`PayablesView` با تجمیع بر اساس حساب/تأمین‌کننده و جمع کل.
- `CashflowReport` با انتخاب ماه شمسی (date-picker فارسی).
- `TxnDialog` با ۸ نوع هزینه و دریافت متفرقه.
- حالت‌های Loading/Error/Empty اجباری.

## ۱۱. واکنش‌گرایی و breakpointها

- جداول مالی زیر `md` به card-list تبدیل می‌شوند (طبق `RESPONSIVE_ARCHITECTURE.md`).
- فرم خرید و چک: تک‌ستونه روی تمام عرض‌ها با اعتبارسنجی زنده.
- نمایش مبالغ با `rnd` و ارقام فارسی در همه عرض‌ها.
- عرض‌های آزمایش: ۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰.

## ۱۲. آزمون‌ها

- واحد: state machine خرید (پرش غیرمجاز رد می‌شود)، bucketing ماه با JDN (مقایسه با محاسبه مستقیم)، قانون جمع چک‌ها ≤ کل خرید.
- یکپارچه: جریان کامل `req → ok → fin → recv` با ایجاد حرکت `kind: buy` و افزایش موجودی.
- یکپارچه: پاسخ `/api/finance/*` برای نقش production بدون مبالغ (تست R-32).
- ۴۰۳ برای همه مسیرهای بدون مجوز.

## ۱۳. ریسک‌های این فاز

| ریسک | اثر | راهکار |
|---|---|---|
| R-11: bucketing نادرست | گزارش غلط | JDN + تست واحد |
| R-32: نشت مبالغ | داده محرمانه | فیلتر سرور در هر مسیر مالی |
| txns در حافظه (Q-14) | از دست رفتن داده | پاسخ Q-14 قبل از شروع |
| پاسخ دیرهنگام Q-13 | اسناد خرید بدون پیوست | طراحی schema مستقل از فایل |

## ۱۴. سوالات باز / تصمیمات لازم

- Q-12: نگاشت ماهانه با JDN برای گزارش‌ها.
- Q-13: آیا قابلیت آپلود فایل لازم است؟
- Q-14: آیا `txns` باید ذخیره شود یا فقط گزارش محاسبه‌شده؟

## ۱۵. معیارهای پذیرش

See `PHASE_ACCEPTANCE_CRITERIA.md` — A-6.1 تا A-6.3.

## ۱۶. برآورد زمان و منابع

- **۲ تا ۳ هفته**، یک توسعه‌دهنده.
- خروجی‌ها: دو ماژول purchasing و finance + گزارش `docs/reports/PHASE_06_REPORT.md`.

---

## دروازه خروج هدفمند (Objective Exit Gate)

1. یک درخواست خرید با ۲ قلم ماده ایجاد می‌شود و در لیست با وضعیت `req` ظاهر می‌شود.
2. جریان کامل `req → ok → fin → recv` توسط نقش‌های مجاز طی می‌شود و رسید انبار یک حرکت `kind: buy` مثبت ایجاد می‌کند (تست سبز: موجودی ماده افزایش می‌یابد).
3. پرش غیرمجاز وضعیت (مثلاً `req → recv` مستقیم) در سرور رد می‌شود (تست).
4. یک چک صادره با وضعیت `issued` ثبت و سپس به `paid` تغییر می‌کند و از پرداختنی‌ها حذف می‌شود.
5. گزارش جریان نقدی ماهانه داده‌ها را در bucket ماه درست قرار می‌دهد (تست واحد با داده نامتقارن — مقایسه با محاسبه مستقیم).
6. نقش production/warehouse پاسخ مسیرهای `/api/finance/*` را بدون مبلغ دریافت می‌کند (تست R-32).
7. یک هزینه با یکی از ۸ نوع ثابت ثبت می‌شود و در گزارش ظاهر می‌شود (در صورت تأیید Q-14، پس از رفرش هم باقی می‌ماند).
8. صفحات خرید و مالی در عرض‌های ۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰ بدون اسکرول افقی بررسی شده‌اند.
9. هیچ فایل Demo تغییری نکرده است.
