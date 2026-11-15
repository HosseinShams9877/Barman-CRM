# PHASE 03 — CRM سرنخ‌ها و مشتریان

> پیاده‌سازی ماژول‌های `customers` و `leads` بر اساس بازرسی `app/leads.js` (۵۶۸ خط) و `app/order.js` (نمایش حساب‌ها). مشتریان قبل از سرنخ‌ها ساخته می‌شوند چون هر سرنخ به یک حساب (account) متصل می‌شود.

---

## ۱. هدف فاز

بازسازی کامل بخش CRM دمو: مدیریت حساب‌ها/مشتریان (با مخاطبین و تلفن‌های چندگانه) و تخته سرنخ‌های دوخطی (خط تولید و خط آژانس) با ستون‌های مرحله‌بندی، تاریخچه پیگیری، پیگیری بعدی، واردات دسته‌ای و فیلترهای ذخیره‌شده.

## ۲. پیش‌نیازها و وابستگی‌ها

- وابسته به **فاز ۲** (Prisma، احراز هویت، مجوز سرور، تقویم، قالب‌بندی) — وابستگی سلب‌ناپذیر.
- وابسته به پاسخ: Q-05 (آیا تلفن حساب فقط‌خواندنی است؟)، Q-08 (تعریف سرنخ «از دست‌رفته»).
- مرجع بازرسی: `app/leads.js` (STAGEها، LINEها، نمودار سریع، واردات، «چی شد؟»)، `app/order.js` (ساختار `accounts` با `phones` و `contacts`)، `seed-data/meta.json` (۲۳ حساب، ۲۹ سرنخ).

## ۳. دامنه کارها

۱. ماژول `customers`: لیست حساب‌ها، ایجاد/ویرایش/غیرفعال‌سازی، مخاطبین چندگانه با نام/سمت/تلفن، تلفن‌های چندگانه با نوع.
۲. ماژول `leads`: تخته سرنخ‌ها با دو خط (تولید `prod` و آژانسی `agency`) و ۵ ستون مرحله `raw` (خام)، `opp` (فرصت)، `pf` (پیش‌فاکتور)، `won` (برد)، `lost` (باخت).
۳. جابه‌جایی سرنخ بین ستون‌ها (drag&drop در دسکتاپ؛ دکمه‌های جابه‌جایی در موبایل) با ثبت خودکار تاریخچه.
۴. حالت نمایش سریع (quick-view) سرنخ در modal.
۵. دیالوگ «چی شد؟» برای ثبت پیگیری: توضیح، تاریخ پیگیری بعدی، تغییر مرحله.
۶. تاریخچه پیگیری هر سرنخ با مهر زمانی.
۷. واردات دسته‌ای سرنخ‌ها از CSV با اعتبارسنجی و گزارش خطا.
۸. فیلترهای سرنخ (خط، مرحله، تخصیص، جستجوی متن) ذخیره‌شده برای هر کاربر (در UI state، نه در URL).

## ۴. خارج از دامنه

- تبدیل سرنخ به پیش‌فاکتور (فاز ۴).
- گزارش‌ها و داشبورد CRM (فاز ۷).
- ارسال پیامک (بخشی از Demo که به سرویس خارجی وابسته است — به تعویق افتاده).

## ۵. فایل‌ها و ساختار ماژول‌های ساخته‌شده

```
src/modules/customers/
├── components/ (AccountList, AccountForm, ContactEditor, PhoneEditor)
├── hooks/      (useAccounts, useAccount)
├── services/   (account.service.ts)
├── schemas/    (account.schema.ts — Zod)
├── types/      (account.types.ts)
├── constants/  (phone-kinds.ts)
├── queries/    (keys.ts + invalidations)
└── index.ts
src/modules/leads/
├── components/ (LeadBoard, LeadColumn, LeadCard, LeadQuickView, FollowupDialog, ImportDialog)
├── hooks/      (useLeads, useLeadMutations)
├── services/   (lead.service.ts, followup.service.ts)
├── schemas/    (lead.schema.ts, import.schema.ts)
├── types/
├── constants/  (STAGE.ts, LINE.ts — از Demo)
├── queries/
└── index.ts
src/app/(app)/customers/page.tsx, leads/page.tsx
src/app/api/customers/..., /api/leads/...
```

## ۶. مدل داده و تغییرات Schema

جداول جدید در این فاز:
- `accounts` (id با پیشوند `AC-`، name، kind، active، address، note)
- `account_phones` (kind، number)
- `account_contacts` (name، role، phone)
- `leads` (id با پیشوند `LD-`، accountId (nullable)، line: `prod|agency`، stage: `raw|opp|pf|won|lost`، title، amount (nullable)، ownerId، source، note)
- `lead_followups` (leadId، at، note، nextAt، byUserId)
- `lead_interest` (leadId، productId) برای محصولات موردعلاقه (در صورت وجود در Demo)
نام تخصیص: `ownerId` به `users` اشاره می‌کند. `nextAt` از نوع `String` با قالب `YYYY/MM/DD` ASCII (طبق خط‌مشی تاریخ).

## ۷. API و Route Handlerها

| مسیر | روش | مجوز | توضیح |
|---|---|---|---|
| `/api/customers` | GET | `customers:read` | لیست با جستجو و صفحه‌بندی |
| `/api/customers` | POST | `customers:write` | ایجاد حساب |
| `/api/customers/[id]` | GET/PATCH | `customers:read`/`customers:write` | جزئیات/ویرایش |
| `/api/leads` | GET | `leads:read` | با فیلتر line/stage/owner |
| `/api/leads` | POST | `leads:write` | ایجاد |
| `/api/leads/[id]` | GET/PATCH | `leads:read`/`leads:write` | جابه‌جایی مرحله در PATCH |
| `/api/leads/[id]/followups` | GET/POST | `leads:read`/`leads:write` | تاریخچه و ثبت «چی شد؟» |
| `/api/leads/import` | POST | `leads:write` | CSV با گزارش خطا |

هر مسیر: auth → permission → Zod → service → response. دامنه سرنخ برای نقش sales به سرنخ‌های خودش محدود می‌شود (قانون scoping در Demo).

## ۸. مجوزها و امنیت

- `customers:read/write`، `leads:read/write`، `leads:assign`، `leads:import`.
- تست ۴۰۳ هر مسیر الزامی است (A-3.5).
- sales فقط سرنخ‌های خودش را می‌بیند — فیلتر در سرور (نه در کلاینت).
- پنهان‌سازی دکمه‌ها بر اساس مجوز UI است؛ سرور منبع حقیقت است.

## ۹. تقویم و تاریخ

- `nextAt` (پیگیری بعدی) به‌صورت `YYYY/MM/DD` ASCII ذخیره و در UI فارسی نمایش داده می‌شود.
- تاریخچه پیگیری: مهر زمانی به‌صورت UTC ms.
- اعتبارسنجی parse تقویم در Zod با کمک `core/calendar`.

## ۱۰. رابط کاربری (کامپوننت‌ها)

- `LeadBoard` با ۵ ستون افقی، drag&drop (HTML5 در دسکتاپ، دکمه‌های انتقال در موبایل).
- `LeadCard` با عنوان، حساب، مبلغ (با گردکردن `rnd`)، نشانگر خط.
- `FollowupDialog` با textarea و date-picker فارسی.
- `AccountForm` با مدیریت مخاطبین و تلفن‌ها (افزودن/حذف داینامیک).
- استفاده اجباری از `LoadingState`، `ErrorState`، `EmptyState` برای همه حالت‌های query.

## ۱۱. واکنش‌گرایی و breakpointها

- زیر `md` (۷۶۸px): تخته به لیست عمودی تبدیل می‌شود (هر خط جدا) — استراتژی طبق `RESPONSIVE_ARCHITECTURE.md`.
- روی `md` و بالاتر: تخته ۵ ستون با اسکرول افقی کنترل‌شده.
- عرض‌های آزمایش: ۵۰۰، ۷۶۸، ۱۰۲۴، ۱۲۸۰، ۱۴۴۰ — فقط این عرض‌ها ضبط می‌شوند.

## ۱۲. آزمون‌ها

- واحد: schema‌ها (Zod) برای اطلاعات نادرست، جابه‌جایی مرحله مجاز/غیرمجاز، گردکردن مبلغ.
- یکپارچه: پرسش از API با نشست نقش‌های مختلف — sales می‌بیند/نمی‌بیند، ۴۰۳ برای کاربر بدون مجوز.
- UI: رندر تخته در حالت خالی/بارگذاری/خطا.

## ۱۳. ریسک‌های این فاز

| ریسک | اثر | راهکار |
|---|---|---|
| R-30: قوانین ضمنی (مثلاً تبدیل stage هنگام پیگیری) | رفتار ناقص | مستندسازی در `VALIDATION_AND_BUSINESS_RULES.md` و پیاده‌سازی عینی |
| R-19: منطق در رشته‌های HTML | سخت‌نگهداری | جزئیات در services و کامپوننت‌های React |
| از دست‌رفتگی drag&drop در موبایل | تجربه کاربری ضعیف | معادل دکمه‌ای (A-3.1) |

## ۱۴. سوالات باز / تصمیمات لازم

- Q-05: فقط‌خواندنی بودن تلفن حساب.
- Q-08: تعریف دقیق «سرنخ از دست‌رفته» و رفتار آن.

## ۱۵. معیارهای پذیرش

See `PHASE_ACCEPTANCE_CRITERIA.md` — A-3.1 تا A-3.5.

## ۱۶. برآورد زمان و منابع

- **۲ تا ۳ هفته**، یک توسعه‌دهنده.
- خروجی‌ها: دو ماژول فعال + گزارش `docs/reports/PHASE_03_REPORT.md`.

---

## دروازه خروج هدفمند (Objective Exit Gate)

1. تخته سرنخ‌ها در دو خط و ۵ ستون نمایش داده می‌شود و جابه‌جایی مرحله کار می‌کند (دسکتاپ drag&drop، موبایل دکمه).
2. جابه‌جایی مرحله یک رکورد تاریخچه با مهر زمانی ایجاد می‌کند.
3. دیالوگ «چی شد؟» با ذخیره پیگیری و تاریخ پیگیری بعدی کار می‌کند.
4. واردات CSV یک سرنخ معتبر را ذخیره و یک ردیف نامعتبر را با پیام خطای فارسی رد می‌کند.
5. ایجاد حساب با ۲ مخاطب و ۲ تلفن ذخیره و در لیست نمایش داده می‌شود.
6. کاربر بدون مجوز `leads:read` درخواست API را با ۴۰۳ دریافت می‌کند (تست سبز).
7. کاربر با نقش sales فقط سرنخ‌های خودش را در پاسخ API می‌بیند (تست سبز).
8. تخته در عرض‌های ۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰ بدون اسکرول افقی صفحه بررسی شده است.
9. هیچ فایل Demo تغییری نکرده است.
