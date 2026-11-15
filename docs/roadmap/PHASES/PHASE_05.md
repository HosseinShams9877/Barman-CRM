# PHASE 05 — تولید و انبار (Production & Warehouse)

> بازسازی `app/stock.js` و بخش تولید `app/prod.html`/`flow.js`: حرکت‌های انبار (`moves`) به‌عنوان **تنها منبع حقیقت موجودی**، کار تولید (`PJ`) با انفجار BOM و درصد ضایعات، و آستانه حداقل موجودی. این فاز وابستگی متقابل با فاز ۴ (رزرو سفارش) و فاز ۶ (رسید خرید) دارد.

---

## ۱. هدف فاز

انتقال جریان تولید و مدیریت انبار به پلتفرم جدید: موجودی همیشه از مجموع حرکت‌ها محاسبه می‌شود (هیچ فیلد موجودی ذخیره‌شده‌ای وجود ندارد — طبق قانون Demo)، کار تولید از `plan` تا `qc` و ورود به دپو طی می‌شود، مواد با کسر خودکار BOM مصرف می‌شوند، و کمبود موجودی زیر آستانه `min` هشدار و پیشنهاد درخواست خرید می‌دهد.

## ۲. پیش‌نیازها و وابستگی‌ها

- وابسته به **فاز ۲** (Prisma، مجوز سرور، تقویم، قالب‌بندی) و **فاز ۴** (سفارش و رزرو `resv` — رزرو روی سفارش ذخیره می‌شود، این فاز guard موجودی را اجرا می‌کند).
- وابسته به پاسخ: Q-07 (آیا نقش‌های production/warehouse می‌توانند سفارش‌ها را فقط‌خواندن ببینند؟) و Q-04 (الزام تأیید رزرو بدون بررسی موجودی).
- مرجع بازرسی: `app/stock.js` (تب ورود/خروج، حرکت‌ها، آستانه `min`)، `app/prod.html` + `flow.js` (کار تولید، BOM، QC)، `seed-data/meta.json` (۷۰ حرکت، ۱ کار `PJ`)، `DATA_MODEL.md` §۲.۷.

## ۳. دامنه کارها

۱. ماژول `inventory`: ثبت حرکت با ۹ نوع دقیقاً مطابق Demo: `open` (افتتاح)، `buy` (رسید خرید — از فاز ۶ صدا زده می‌شود)، `prod` (ورود محصول تولیدی)، `sale` (خروج فروش — از فاز ۴)، `use` (مصرف ماده در تولید)، `out` (خروج دستی)، `adj` (تعدیل)، `waste` (ضایعات)، `job` (ورود حاصل کار به دپو).
۲. موجودی محاسبه‌شده: جمع جبری `qty` (مثبت ورود، منفی خروج) برای هر `item` در هر انبار (`raw` مواد / `depot` محصول) — بدون ذخیره مقدار.
۳. آستانه `min` برای مواد: هشدار کسری + دکمه «درخواست خرید» که یک `BY status: req` در فاز ۶ ایجاد می‌کند (در این فاز فقط لینک داده‌ای فراهم می‌شود).
۴. ماژول `production`: کار تولید `PJ` با وضعیت‌های `plan` → `run` → `qc` → `sent`/`done` مطابق Demo.
۵. پیش‌نمایش زنده BOM در دیالوگ ایجاد کار (محاسبه‌ی مقدار مواد لازم قبل از تأیید — همان رفتار Demo).
۶. شروع کار: کسر خودکار مواد با حرکت‌های `kind: use` (مقدار منفی) برای هر قلم BOM.
۷. پایان اجرا → ثبت QC: مقدار سالم (`good`) و ضایعات (`waste` — حرکت `kind: waste`).
۸. ورود به دپو: حرکت `kind: job` با مقدار `good` و رجوع `ref` به `PJ`.
۹. guard موجودی برای رزرو سفارش (فاز ۴ `resv`): سرور بررسی می‌کند موجودی کافی موجود است (قانون Demo: رزرو بدون بررسی طبق `data-daccept` — در صورت پاسخ مثبت Q-04 با هشدار، در غیر این صورت با مسدودسازی).

## ۴. خارج از دامنه

- مدیریت کاتالوگ محصولات/مواد و ویرایشگر BOM (فاز ۷ — این فاز فقط BOM را می‌خواند).
- درخواست خرید و رسید خرید `BY` (فاز ۶ — این فاز فقط `BY` را ارجاع می‌دهد).
- خروج محصول فروش و اتصال `TR-` (فاز ۴).
- گزارش‌های انبار (فاز ۷).

## ۵. فایل‌ها و ساختار ماژول‌های ساخته‌شده

```
src/modules/inventory/
├── components/ (MoveForm, MovesTable, StockView, StockAlerts,
│                MinThresholdBanner)
├── hooks/      (useMoves, useStock, useMoveMutations)
├── services/   (move.service.ts, stock.service.ts — محاسبه موجودی)
├── lib/        (signed-qty.ts — جمع جبری، kinds.ts)
├── schemas/    (move.schema.ts — Zod با kind/wh/qty علامت‌دار)
├── types/
├── constants/  (MOVE_KINDS.ts، WAREHOUSES.ts)
├── queries/
└── index.ts
src/modules/production/
├── components/ (JobList, JobForm, BomPreview, JobRunPanel,
│                QcDialog)
├── hooks/      (useJobs, useJobMutations)
├── services/   (job.service.ts, bom.service.ts)
├── schemas/    (job.schema.ts)
├── types/
├── constants/  (JOB_STATUS.ts)
├── queries/
└── index.ts
src/app/(app)/stock/page.tsx, /production/page.tsx, /production/[id]/page.tsx
src/app/api/moves/..., /api/stock/..., /api/jobs/...
```

## ۶. مدل داده و تغییرات Schema

- `moves` (id با پیشوند `mv`، wh: `raw|depot`، item (productId یا materialId)، qty عدد علامت‌دار، kind از ۹ نوع، ref (orderId/buyId/jobId nullable)، at، byUserId) — **این جدول تنها منبع حقیقت موجودی است.**
- `jobs` (id با پیشوند `PJ-`، productId، qty، status: `plan|run|qc|sent|done`، good، waste، bomSnapshot jsonb، createdBy)
- `stock_reservations` (orderId، item، qty) — رزروهای فاز ۴ (در دسترس هستند؛ این فاز فقط guard را اجرا می‌کند).
- **هیچ فیلد موجودی ذخیره نمی‌شود** — view محاسبه‌شده (یا کوئری تجمیعی Prisma) در هر بار ساخته می‌شود. در صورت نیاز کارایی، کش با invalidation روی `moves` مجاز است ولی منبع حقیقت `moves` باقی می‌ماند.

## ۷. API و Route Handlerها

| مسیر | روش | مجوز | توضیح |
|---|---|---|---|
| `/api/moves` | GET | `inventory:read` | با فیلتر wh/kind/item و صفحه‌بندی |
| `/api/moves` | POST | `inventory:write` | ثبت حرکت (اعتبارسنجی علامت qty بر اساس kind) |
| `/api/moves/[id]` | PATCH/DELETE | `inventory:write` | ویرایش/حذف با آزمون وابسته (به‌جز حرکت‌های ارجاع‌شده) |
| `/api/stock` | GET | `inventory:read` | موجودی محاسبه‌شده برای تمام اقلام |
| `/api/stock/alerts` | GET | `inventory:read` | موارد زیر آستانه `min` |
| `/api/jobs` | GET | `production:read` | لیست کارها با فیلتر وضعیت |
| `/api/jobs` | POST | `production:write` | ایجاد کار با BomPreview |
| `/api/jobs/[id]` | GET/PATCH | `production:read`/`production:write` | تغییر وضعیت طبق state machine |
| `/api/jobs/[id]/start` | POST | `production:write` | `plan → run` + حرکت‌های `use` |
| `/api/jobs/[id]/qc` | POST | `production:write` | ثبت good/waste + `run → qc` |
| `/api/jobs/[id]/receive` | POST | `inventory:write` | حرکت `kind: job` + `→ done` |
| `/api/reservations/check` | POST | `orders:read` | guard موجودی برای رزرو |

## ۸. مجوزها و امنیت

- `inventory:read/write` (نقش warehouse)، `production:read/write` (نقش production) — ماتریس طبق `USER_ROLES_AND_PERMISSIONS.md`.
- نقش‌های production/warehouse: **فیلتر پولی در سرور** (R-32) — قیمت مواد و ارزش موجودی در پاسخ API حذف می‌شود (قانون `noMoney` در Demo — فقط مطابق پاسخ Q-07).
- ثبت حرکت و کار تولید همیشه با `byUserId` و مهر زمانی UTC.
- ویرایش حرکت‌های ارجاع‌شده (حاصل خرید/فروش/تولید) ممنوع است — فقط حرکت‌های دستی (`open`، `out`، `adj`) قابل ویرایش/حذف.
- پنهان‌سازی دکمه در UI مجوز نیست — همه gateها در سرور.

## ۹. تقویم و تاریخ

- `moves.at` و `jobs.createdAt`: `YYYY/MM/DD` ASCII برای تاریخ روز + UTC ms برای مهر زمانی دقیق (طبق خط‌مشی تاریخ).
- پیش‌نمایش BOM و QC بدون تاریخ هستند؛ تاریخ نیایی نیست.

## ۱۰. رابط کاربری (کامپوننت‌ها)

- `StockView`: جدول موجودی با دو گروه (مواد `raw` / محصول `depot`)، نمایش رنگی کسری زیر `min` (با توکن معنایی `--color-danger-500`).
- `MovesTable`: فیلتر kind با ۹ مقدار، جستجوی قلم، صفحه‌بندی.
- `JobForm` با `BomPreview`: وارد کردن تعداد محصول و دیدن زنده لیست مواد و مقادیر لازم (همان دیالوگ Demo — پیش‌نمایش قبل از ایجاد).
- `QcDialog`: ثبت good/waste با اعتبارسنجی `good + waste ≤ qty` طبق قانون Demo.
- حالت‌های Loading/Error/Empty اجباری از `components/feedback`.

## ۱۱. واکنش‌گرایی و breakpointها

- جداول موجودی و حرکت زیر `md` به card-list تبدیل می‌شوند (طبق `RESPONSIVE_ARCHITECTURE.md`).
- فرم کار تولید: فرم تک‌ستونه روی همه عرض‌ها، `BomPreview` زیر `md` بالای فرم می‌چسبد.
- آستانه `min`: بنر هشدار تمام‌عرض زیر `sm`.
- عرض‌های آزمایش: ۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰ — فقط این عرض‌ها ضبط می‌شوند.

## ۱۲. آزمون‌ها

- واحد: جمع جبری qty با حرکت‌های مثبت/منفی، اعتبارسنجی علامت بر اساس kind، قانون `good + waste ≤ qty`، محاسبه BOM با تعداد و ضایعات.
- یکپارچه: جریان کامل `plan → run → qc → receive` با کسر مواد و ورود محصول؛ موجودی نهایی برابر مقدار مورد انتظار است (تست سبز).
- یکپارچه: نقش production پاسخ `/api/stock` بدون قیمت دریافت می‌کند (R-32 تست).
- ۴۰۳ برای مسیرهای بدون مجوز (warehouse / production جدا).

## ۱۳. ریسک‌های این فاز

| ریسک | اثر | راهکار |
|---|---|---|
| انحراف از قانون ۹ kind | داده ناقص | ثابت در `MOVE_KINDS` + تست واحد |
| محاسبه موجودی پرهزینه | کندی | کوئری تجمیعی Prisma + کش با invalidation |
| رزرو بدون بررسی (Q-04) | بیش‌فروشی | guard سرور با پاسخ Q-04 مشخص می‌شود |
| ویرایش حرکت‌های سیستمی | ناسازگاری | ممنوعیت در سرور + تست |
| R-19: منطق در رشته‌های HTML | سخت‌نگهداری | انتقال به `bom.service.ts` و `stock.service.ts` |

## ۱۴. سوالات باز / تصمیمات لازم

- Q-07: دید فقط‌خواندنی سفارش برای نقش‌های production/warehouse.
- Q-04: آیا تأیید رزرو بدون موجودی یک ویژگی عمدی برای مدیر است؟ (رفتاری در Demo)

## ۱۵. معیارهای پذیرش

See `PHASE_ACCEPTANCE_CRITERIA.md` — A-5.1 تا A-5.4.

## ۱۶. برآورد زمان و منابع

- **۲ تا ۳ هفته**، یک توسعه‌دهنده.
- خروجی‌ها: دو ماژول inventory و production + گزارش `docs/reports/PHASE_05_REPORT.md`.

---

## دروازه خروج هدفمند (Objective Exit Gate)

1. ثبت یک حرکت `open` و یک حرکت `out` و مشاهده موجودی محاسبه‌شده در `/api/stock` (تست سبز: جمع جبری درست).
2. جریان کار تولید: ایجاد `PJ`، پیش‌نمایش BOM، شروع (با حرکت‌های `use` ایجاد‌شده)، QC با good/waste، ورود به دپو با حرکت `kind: job` — همه با موفقیت و موجودی نهایی مطابق انتظار.
3. Good + waste بیشتر از qty کار با خطای فارسی رد می‌شود (تست).
4. ماده‌ای زیر آستانه `min` در `/api/stock/alerts` و بنر UI ظاهر می‌شود.
5. ویرایش یک حرکت `kind: sale` (سیستمی) با ۴۰۳/۴۰۰ رد می‌شود (تست).
6. نقش production پاسخ `/api/stock` را بدون قیمت/ارزش دریافت می‌کند (تست R-32).
7. کاربر بدون مجوز `inventory:write` نمی‌تواند حرکت ثبت کند (تست ۴۰۳ سبز).
8. صفحات انبار و تولید در عرض‌های ۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰ بدون اسکرول افقی صفحه بررسی شده‌اند.
9. هیچ فایل Demo تغییری نکرده است.
