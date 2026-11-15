# PHASE 07 — مدیریت و گزارش (Admin & Reports)

> بازسازی `app/admin.js`، `app/reports.js` و `app/home.js`: پنل مدیریت (کاربران، کاتالوگ، BOM، فهرست‌ها، تنظیمات)، موتور گزارش با رفع مشکل `slice(0,7)` (R-11) و داشبورد خانه. این فاز بخش‌های غیرکسب‌کار را که به ماژول‌های فازهای ۳–۶ وابسته‌اند، تکمیل می‌کند.

---

## ۱. هدف فاز

انتقال کامل بخش مدیریت و گزارش: مدیریت کاربران/نقش‌ها با غیرفعال‌سازی، ویرایش کاتالوگ محصولات و مواد و ویرایشگر BOM، ویرایشگر ۷ فهرست (فقط دسترسی کامل)، تنظیمات شرکت (`vat`، `validDays`، `discountCap` هر نقش)، داشبورد خانه با خلاصه عملکرد، و گزارش‌های تجمیعی با bucketing تاریخ صحیح (رفع R-11).

## ۲. پیش‌نیازها و وابستگی‌ها

- وابسته به **فازهای ۳ تا ۶** (همه ماژول‌های کسب‌کار برای داشبورد و گزارش باید وجود داشته باشند).
- وابسته به پاسخ: Q-09 (پالت فازها — سه منبع متناقض در Demo: `home.js` ۴ فاز، `flow.js` ۵ فاز، `order.js` PHC).
- مرجع بازرسی: `app/admin.js` (تب‌های مدیریت، ۷ فهرست، تنظیمات)، `app/reports.js` (bucketing تاریخ با `slice(0,7)`)، `app/home.js` (داشبورد ۴ فاز)، `server/export.js` (خروجی zip/JSON/CSV)، `seed-data/meta.json` (ساختار `meta` غول‌پیکر — تجزیه شده در `DATABASE_ARCHITECTURE.md`).

## ۳. دامنه کارها

۱. ماژول `admin` — مدیریت کاربران: ایجاد، ویرایش، غیرفعال‌سازی (`off` طبق Demo — غیرفعال می‌شود ولی حذف نمی‌شود تا تاریخچه معتبر بماند)، تخصیص نقش.
۲. کاتالوگ محصولات: ایجاد/ویرایش/غیرفعال‌سازی با فیلدهای Demo (name، color، w، h، price...).
۳. کاتالوگ مواد: فیلدهای Demo (name، u واحد، price، min آستانه).
۴. ویرایشگر BOM: تعریف مواد هر محصول با مقدار مصرف (تأثیر مستقیم روی فاز ۵).
۵. ویرایشگر ۷ فهرست (دقیقاً ۷ مورد مطابق Demo — محتوای هر کدام در `MODULE_CATALOG.md`)، فقط برای دسترسی کامل.
۶. تنظیمات شرکت: `vat` (نرخ مالیات)، `validDays` (اعتبار پیش‌فاکتور)، `discountCap` هر نقش (ارتباط با فاز ۴).
۷. ماژول `reports`: گزارش‌های تجمیعی با bucketing ماهانه بر اساس JDN (رفع R-11)، فیلتر بازه تاریخ با date-picker فارسی.
۸. داشبورد خانه: خلاصه عملکرد (سرنخ‌های باز، سفارش‌های در جریان، هشدار موجودی، چک‌های نزد سررسید) با یک پالت فاز واحد (پاسخ Q-09).
۹. خروجی‌ها: ZIP کامل، JSON و CSV سرنخ‌ها — معادل `server/export.js` (آماده فاز ۸).

## ۴. خارج از دامنه

- پشتیبان‌گیری خودکار Postgres (`scripts/pg-backup.js`) — زیرساخت استقرار در فاز ۸.
- مهاجرت داده (فاز ۸).
- همه‌گیری عملکرد گزارش‌های پیچیده (در Demo نیست — اختراع نشو).

## ۵. فایل‌ها و ساختار ماژول‌های ساخته‌شده

```
src/modules/admin/
├── components/ (UserManager, UserForm, ProductCatalog, MaterialCatalog,
│                BomEditor, ListsEditor, SettingsPanel)
├── hooks/      (useUsers, useProducts, useMaterials, useSettings)
├── services/   (user.service.ts, catalog.service.ts, bom.service.ts,
│                settings.service.ts, lists.service.ts)
├── schemas/    (user.schema.ts, product.schema.ts, material.schema.ts,
│                bom.schema.ts, settings.schema.ts)
├── types/
├── constants/  (LISTS.ts — ۷ فهرست)
├── queries/
└── index.ts
src/modules/reports/
├── components/ (ReportFilters, CashflowChart, LeadsReport, SalesReport)
├── hooks/      (useReports)
├── services/   (report.service.ts, bucketing.ts)
├── schemas/    (report-query.schema.ts)
├── types/
├── constants/
├── queries/
└── index.ts
src/modules/home/
├── components/ (Dashboard, StageSummary, AlertsWidget)
└── ...
src/app/(app)/admin/page.tsx, /reports/page.tsx, /page.tsx
src/app/api/admin/..., /api/reports/..., /api/export/...
```

## ۶. مدل داده و تغییرات Schema

- جداول این فاز قبلاً در فاز ۲ طبق `DATABASE_ARCHITECTURE.md` ساخته شده‌اند (تجزیه `meta`): `products`، `materials`، `bom`، `suppliers`، `lists`، `settings`، `users`.
- این فاز فقط API و UI روی آن‌ها می‌سازد — **هیچ Schema جدیدی**.
- تنظیمات در یک ردیف `settings` با کلید/مقدار نسخه‌بندی‌شده (استفاده از `rev` — رفع R-06).

## ۷. API و Route Handlerها

| مسیر | روش | مجوز | توضیح |
|---|---|---|---|
| `/api/admin/users` | GET/POST | `admin:write` | مدیریت کاربران |
| `/api/admin/users/[id]` | GET/PATCH | `admin:write` | ویرایش/غیرفعال‌سازی (حذف نرم) |
| `/api/admin/products` | GET/POST | `catalog:write` (GET برای همه) | کاتالوگ محصول |
| `/api/admin/products/[id]` | PATCH | `catalog:write` | ویرایش |
| `/api/admin/materials` | GET/POST | `catalog:write` | کاتالوگ مواد |
| `/api/admin/products/[id]/bom` | GET/PUT | `catalog:write` | ویرایشگر BOM |
| `/api/admin/lists` | GET/PUT | `admin:write` | ویرایشگر ۷ فهرست |
| `/api/admin/settings` | GET/PATCH | `admin:write` | تنظیمات شرکت |
| `/api/reports/[kind]` | GET | `reports:read` | با query بازه تاریخ — bucketing JDN |
| `/api/export/zip` | POST | `admin:write` | خروجی ZIP کامل |
| `/api/export/json` | POST | `admin:write` | خروجی JSON |
| `/api/export/leads-csv` | POST | `leads:read` | CSV سرنخ‌ها |

## ۸. مجوزها و امنیت

- `admin:write` تنها برای نقش admin (دسترسی کامل `FULL` طبق Demo) — تست ۴۰۳ برای همه مسیرهای `/api/admin/*`.
- `catalog:write` برای admin/manager؛ `reports:read` برای admin/manager/finance.
- غیرفعال‌سازی کاربر: نشست‌های او با `sessionVersion` باطل می‌شوند (پیوند با فاز ۲).
- **برای گزارش‌های ترکیبی، فیلتر نقش در سرور اعمال می‌شود** — نقش sales فقط داده خودش را در گزارش‌ها می‌بیند (قانون scoping).

## ۹. تقویم و تاریخ

- همه بازه‌های گزارش: `YYYY/MM/DD` ASCII در query و پاسخ.
- bucketing ماهانه با JDN (رفع R-11): تاریخ → JDN → (سال، ماه) شمسی؛ در Demo `slice(0,7)` روی رشته تاریخ فرض می‌کرد قالب یکنواخت است و در صورت تغییر قالب شکست می‌خورد.
- نمایش در UI فارسی با ارقام فارسی.

## ۱۰. رابط کاربری (کامپوننت‌ها)

- `UserManager`: جدول کاربران با نقش و وضعیت فعال/غیرفعال، دکمه غیرفعال‌سازی (با تأیید).
- `BomEditor`: ویرایشگر سطری با محاسبه زنده مقدار مصرف.
- `ListsEditor`: ۷ فهرست با ویرایش آیتم‌ها (افزودن/حذف/مرتب‌سازی).
- `SettingsPanel`: فرم تنظیمات با اعتبارسنجی Zod.
- `ReportFilters`: date-picker بازه فارسی + انتخاب نوع گزارش.
- `Dashboard`: کارت‌های خلاصه (سرنخ باز، سفارش جاری، هشدار موجودی، چک سررسید) — رنگ‌ها فقط از توکن معنایی.
- حالت‌های Loading/Error/Empty اجباری.

## ۱۱. واکنش‌گرایی و breakpointها

- جداول مدیریت زیر `md` به card-list تبدیل می‌شوند.
- داشبورد: شبکه ۴ ستونه روی `xl`، ۲ ستونه روی `md`، ۱ ستونه زیر `md`.
- ویرایشگر BOM زیر `md` به فرم پشته‌ای تبدیل می‌شود.
- عرض‌های آزمایش: ۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰.

## ۱۲. آزمون‌ها

- واحد: bucketing تاریخ (تست R-11: داده‌ای با قالب متناقض با خروجی یکنواخت)، اعتبارسنجی تنظیمات (مثلاً `vat` بین ۰ و ۱، `validDays` مثبت).
- یکپارچه: غیرفعال‌سازی کاربر → نشست او باطل می‌شود (تست)، ویرایش BOM → محاسبه فاز ۵ تأثیر می‌پذیرد.
- ۴۰۳ برای کاربر غیر admin روی `/api/admin/*` (تست).
- گزارش با نقش sales فقط داده خودش را برمی‌گرداند (تست scoping).

## ۱۳. ریسک‌های این فاز

| ریسک | اثر | راهکار |
|---|---|---|
| R-11: bucketing نادرست | گزارش غلط | JDN + تست واحد |
| ۷ فهرست نامشخص | دامنه ناقص | بازرسی دقیق `MODULE_CATALOG.md` قبل از پیاده‌سازی |
| داشبورد کند با داده زیاد | تجربه ضعیف | React Query با staleTime و تجمیع در سرور |
| R-17: استفاده از رنگ‌های Demo | ناسازگاری | فقط توکن‌های معنایی |

## ۱۴. سوالات باز / تصمیمات لازم

- Q-09: پالت و تعریف فازها (سه منبع متناقض در Demo باید به یک منبع واحد تبدیل شوند).

## ۱۵. معیارهای پذیرش

See `PHASE_ACCEPTANCE_CRITERIA.md` — A-7.1 تا A-7.3.

## ۱۶. برآورد زمان و منابع

- **۲ هفته**، یک توسعه‌دهنده.
- خروجی‌ها: ماژول‌های admin و reports و home + گزارش `docs/reports/PHASE_07_REPORT.md`.

---

## دروازه خروج هدفمند (Objective Exit Gate)

1. کاربر جدید ایجاد می‌شود؛ غیرفعال‌سازی او باعث می‌شود نشست فعلی‌اش فوراً باطل شود (تست).
2. یک محصول جدید با BOM (۲ ماده) ایجاد می‌شود و فاز ۵ مقدار مصرف را درست محاسبه می‌کند (تست سبز).
3. ویرایشگر ۷ فهرست برای کاربر غیر admin با ۴۰۳ رد می‌شود و برای admin کار می‌کند (تست).
4. تنظیمات (vat، validDays، discountCap) ذخیره و در فاز ۴ اعمال می‌شوند (تست).
5. گزارش ماهانه با bucketing درست برای داده نامتقارن (مقایسه با محاسبه مستقیم) سبز است (تست R-11).
6. داشبورد خانه ۴ کارت خلاصه را بدون خطا نمایش می‌دهد و در عرض‌های ۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰ بدون اسکرول افقی است.
7. خروجی ZIP معادل قالب Demo تولید می‌شود (آماده برای تست مهاجرت معکوس در فاز ۸).
8. گزارش با نقش sales فقط داده‌های خودش را شامل می‌شود (تست).
9. هیچ فایل Demo تغییری نکرده است.
