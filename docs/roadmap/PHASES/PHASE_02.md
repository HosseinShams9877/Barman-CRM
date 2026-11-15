# PHASE 02 — پلتفرم اصلی (Core Platform)

> این فاز پایه‌های فنی سرور را می‌سازد: پایگاه داده (Prisma 6 + SQLite برای توسعه/تست، PostgreSQL برای تولید)، احراز هویت سرور، مجوز RBAC، موتور واحد تقویم، قالب‌بندی و اعتبارسنجی. همه ماژول‌های فازهای بعدی وابسته به این فاز هستند.

---

## ۱. هدف فاز

پیاده‌سازی لایه `core` به‌گونه‌ای که هر مسیر API بتواند با الگوی ثابت ۵ مرحله‌ای کار کند و هر کامپوننت به تقویم و قالب‌بندی استاندارد دسترسی داشته باشد. خروجی نهایی: ورود/خروج امن، ماتریس نقش × مجوز بازسازی‌شده از Demo، موتور تقویم با ۱۰۰٪ آزمون تبادل (crossover) و Prisma schema اولیه.

## ۲. پیش‌نیازها و وابستگی‌ها

- وابسته به **فاز ۱** (پروژه TS، core skeleton، Vitest) — وابستگی سلب‌ناپذیر.
- وابسته به پاسخ نهایی: Q-01 (ضریب ۳ روی نرخ ارز — تا زمان پاسخ از مقدار Demo استفاده می‌شود)، Q-02 (discountCap صفر برای نقش sales — تا پاسخ، قانون Demo عیناً حفظ می‌شود)، Q-10 (قالب تاریخ نهایی)، D-01، D-04.
- مرجع بازرسی: `server/auth.js` (scrypt، cookie امضاشده `br_s`، invalidation نسخه‌ای)، `app/core.js` (JDF، تبدیل ارقام، rnd)، `server/drivers/pg.js` و `file.js` (رفتارهای مرجع).

## ۳. دامنه کارها

۱. نوشتن Prisma 6 schema مطابق `DATABASE_ARCHITECTURE.md` (~۲۴ جدول از تجزیه `meta` غول‌پیکر) و تولید migration اولیه روی SQLite (توسعه) با تطبیق PostgreSQL (تولید).
۲. لایه `core/database`: کلاینت Prisma تک‌نمونه (singleton)، seed اسکلت (بدون داده Demo — فقط کاربر پیش‌فرض admin).
۳. لایه `core/auth`: ورود با scrypt (الگوریتم Demo حفظ می‌شود)، نشست cookie با HttpOnly + Secure + SameSite، انقضای کوتاه (مثلاً ۸ ساعت به‌جای ۳۶۵ روز Demo) + refresh، invalidation با نسخه کاربر.
۴. لایه `core/permissions`: ماتریس نقش × مجوز ساخته‌شده از بازرسی Demo (۷ نقش: admin, manager, sales, ops, production, warehouse, finance؛ ~۲۰ مجوز) و تابع `requirePermission` سرور.
۵. مسیرهای API احراز هویت: `POST /api/auth/login`، `POST /api/auth/logout`، `GET /api/auth/me`.
۶. موتور `core/calendar`: تبدیل‌های JDF، JDN (فقط محاسبات داخلی)، کبیسه‌گیری، طول ماه‌ها، جمع/تفریق روز و ماه، قالب‌بندی و parse، عدم وابستگی به `Intl` (رفع R-16).
۷. لایه `core/formatting`: ارقام فارسی/لاتین در هر دو جهت، جداکننده `٬` و `٫`، تابع گردکردن `rnd` واحد (گرد به ۱۰۰٬۰۰۰ تومان دقیقاً مطابق Demo — رفع R-08).
۸. لایه `core/validation`: Zod schema‌های مشترک + تابع اعتبارسنجی سرور، و لایه `core/errors` با پاکت خطای استاندارد و نگاشت خطا→کد HTTP.
۹. `core/query`: ساخت QueryClient متمرکز (staleTime 30s، retry 2، gcTime 5min، refetchOnFocus) + provider و کلیدهای query متمرکز (بدون refetchInterval — ریسک R-29).
۱۰. کنترل هم‌زمانی خوش‌بینانه: فیلد `rev`/`updated` روی رکوردها برای تشخیص تداخل (رفع R-06) — جایگزین last-write-wins.

## ۴. خارج از دامنه

- ماژول‌های کسب‌کار (leads، customers، sales، …) — فازهای ۳ تا ۷.
- رویه مهاجرت داده از Demo — فاز ۸.
- SSE/WebSockets (Q-15 فقط در فاز ۸ در صورت تأیید).

## ۵. فایل‌ها و ساختار ماژول‌های ساخته‌شده

```
prisma/
├── schema.prisma          (datasource SQLite در dev، PG در prod)
└── migrations/            (migration اولیه)
src/core/
├── auth/        (session.ts, password.ts, cookie.ts, index.ts)
├── permissions/ (matrix.ts, requirePermission.ts, index.ts)
├── database/    (client.ts, seed.ts, index.ts)
├── calendar/    (jdf.ts, jdn.ts, format.ts, parse.ts, arithmetic.ts, constants.ts, index.ts)
├── formatting/  (digits.ts, money.ts, rnd.ts, index.ts)
├── validation/  (shared-schemas.ts, index.ts)
├── errors/      (envelope.ts, http-map.ts, index.ts)
├── query/       (client.ts, keys.ts, provider.tsx, index.ts)
├── api/         (response.ts, index.ts)
└── ... (logging, localization, utils از فاز ۱ تکمیل می‌شود)
src/app/api/auth/ (login/route.ts, logout/route.ts, me/route.ts)
src/components/feedback/ (LoadingState, ErrorState, EmptyState — استفاده از query)
```

## ۶. مدل داده و تغییرات Schema

schema اولیه مطابق `DATABASE_ARCHITECTURE.md`: `users` (با passwordHash، sessionVersion، roleها چندبهچند)، `settings`، `rev`، و جداول مرجع کاتالوگ (`products`، `materials`، `bom`، `suppliers`، `lists`).
**توجه:** migration در این فاز مجاز است چون فاز ۰ محدودیت Schema را فقط برای خود فاز صفر اعمال می‌کند؛ فاز ۲ طبق نقشه راه اجازه ایجاد migration اولیه دارد. هیچ جدول کسب‌کاری (orders، leads) در این فاز ساخته نمی‌شود — فقط زمانی که ماژول مربوطه در فاز خودش پیاده می‌شود.

## ۷. API و Route Handlerها

| مسیر | روش | مجوز | توضیح |
|---|---|---|---|
| `/api/auth/login` | POST | عمومی | اعتبار + ساخت نشست |
| `/api/auth/logout` | POST | احراز | نابودی نشست |
| `/api/auth/me` | GET | احراز | اطلاعات کاربر جاری + مجوزها |
| `/api/health` | GET | عمومی | وضعیت (از فاز ۱) |

الگوی ثابت همه مسیرهای آینده: auth → permission → Zod → service → response (با پاکت خطای استاندارد).

## ۸. مجوزها و امنیت

- `requirePermission` در سرور اجرا می‌شود — هر مسیر حداقل یک آزمون ۴۰۳ دارد (A-2.3).
- **فیلتر پولی در سرور** (رفع R-32): نقش ops در Demo با `X.noMoney` در کلاینت پول را پنهان می‌کند؛ در نسخه جدید فیلتر در سرور انجام می‌شود تا داده هرگز ارسال نشود.
- ماتریس نقش × مجوز تنها منبع `src/core/permissions/matrix.ts` است (رفع R-02).
- نشست: cookieHttpOnly، Secure در prod، SameSite=Lax، انقضای کوتاه؛ بدون ذخیره anything در `window.name` (رفع رفتار Demo).
- پنهان‌سازی دکمه در UI فقط تجربه کاربری است — مجوز واقعی همیشه سرور است (طبق اصل راهبری).

## ۹. تقویم و تاریخ

- موتور واحد `core/calendar` — هیچ کد تاریخ دیگری در پروژه مجاز نیست.
- قالب ذخیره‌سازی/قرارداد: تاریخ‌های محض `YYYY/MM/DD` با ارقام ASCII؛ در UI ارقام فارسی؛ JDN فقط محاسبات داخلی.
- مقاطع زمانی (instants): UTC milliseconds.
- تست‌های کلیدی: کبیسه‌های شمسی (مثلاً ۱۳۹۹)، طول متفاوت ماه اسفند، مرزUTC/تهران، تبادل JDF با الگوریتم مرجع برای ۱۰۰٪ تاریخ‌ها (crossover).
- رفع R-07 (دو قالب تاریخ همزمان در Demo): فقط یک قالب.

## ۱۰. رابط کاربری (کامپوننت‌ها)

- صفحه ورود (راست‌چین، فارسی، پیام خطای فارسی).
- `Navbar` حالا نقش کاربر واقعی را نشان می‌دهد و منو بر اساس مجوزها فیلتر می‌شود (فیلتر UI نباید تنها لایه محافظت باشد).
- feedback components رسمی: `LoadingState`، `ErrorState` (با retry)، `EmptyState` — همه ماژول‌های بعدی ملزم به استفاده از این‌ها هستند.

## ۱۱. واکنش‌گرایی و breakpointها

- صفحه ورود در ۵ نقطه (۵۰۰، ۷۶۸، ۱۰۲۴، ۱۲۸۰، ۱۴۴۰) بررسی می‌شود — فرم روی عرض xs تمام‌عرض است.
- providerها و لایه‌های state بدون وابستگی به عرض هستند.

## ۱۲. آزمون‌ها

- **موتور تقویم:** ۱۰۰٪ تبادل JDF crossover سبز، کبیسه‌گیری، طول ماه، جمع/تفریق، parse معکوس.
- **مجوزها:** هر مسیر حداقل یک تست ۴۰۳ (پوشش ۱۰۰٪ مسیرها).
- **قالب‌بندی:** ارقام فارسی/لاتین، `rnd` گرد به ۱۰۰٬۰۰۰ (رفع R-08 drift)، جداکننده‌ها.
- **هش رمز عبور (scrypt):** تأیید هش مطابق با الگوریتم Demo برای سازگاری داده‌های مهاجرت‌شده در فاز ۸.
- **نشست:** انقضا، invalidated با sessionVersion.
- هدف پوشش این فاز: ۹۰٪ روی core.

## ۱۳. ریسک‌های این فاز

| ریسک | اثر | راهکار |
|---|---|---|
| R-02: مجوزها فقط در کلاینت | ریشه امنیتی | requirePermission + ماتریس واحد |
| R-06: last-write-wins | از دست رفتن داده | فیلد rev + تشخیص تداخل |
| R-07: دو قالب تاریخ | ناسازگاری | یک قالب واحد |
| R-08: drift گردکردن | اختلاف مبالغ | تابع rnd واحد |
| R-09/R-13: عدم اعتبارسنجی سرور | داده نامعتبر | Zod در هر مسیر |
| R-23: تفاوت دو درایور Demo | رفتار دوگانه | Prisma واحد |
| R-32: noMoney در کلاینت | نشت داده | فیلتر سرور |

## ۱۴. سوالات باز / تصمیمات لازم

- Q-01 (نرخ ۳ — قانون Demo: نرخ × ۳ برای محاسبه)، Q-02 (discountCap=0 برای sales)، Q-10 (قالب تاریخ نهایی)، D-01 (احراز هویت — نهایی)، D-04 (مدیریت فایل‌های پیوست).

## ۱۵. معیارهای پذیرش

See `PHASE_ACCEPTANCE_CRITERIA.md` — A-2.1 تا A-2.6 (schema + migration، ورود/خروج امن، requirePermission با تست ۴۰۳، تقویم ۱۰۰٪ سبز، ماتریس بازسازی‌شده، تصمیمات نهایی).

## ۱۶. برآورد زمان و منابع

- **۲ تا ۳ هفته**، یک توسعه‌دهنده.
- خروجی‌ها: core قابل استفاده + گزارش `docs/reports/PHASE_02_REPORT.md`.

---

## دروازه خروج هدفمند (Objective Exit Gate)

1. `npx prisma migrate dev` بدون خطا روی SQLite اجرا می‌شود و schema مطابق `DATABASE_ARCHITECTURE.md` است.
2. ورود با کاربر seed کار می‌کند؛ cookie HttpOnly در پاسخ دیده می‌شود؛ خروج نشست را باطل می‌کند.
3. فراخوانی یک مسیر محافظت‌شده بدون نشست → ۴۰۱؛ با نقش نادرست → ۴۰۳ (هر دو تست سبز).
4. درخواست به مسیرها به‌عنوان ops، فیلدهای پولی در پاسخ سرور وجود ندارند (تست R-32).
5. `vitest run` — ۱۰۰٪ تبادل تقویم سبز، همه مسیرها تست ۴۰۳ دارند.
6. صفحه ورود در عرض‌های ۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰ بدون اسکرول افقی بررسی شده (فقط عرض‌های واقعی).
7. Snapshots تاریخ: ذخیره با `YYYY/MM/DD` ASCII در همه schema‌ها تایید شده.
8. هیچ فایل Demo تغییری نکرده است.
