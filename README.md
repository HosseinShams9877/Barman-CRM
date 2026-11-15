# BARMAN CRM — سامانه مدیریت ارتباط با مشتری و تولید دیوارپوش سه‌بعدی

> برنامه بازسازی‌شده Demo محلی (`پلتفرم نهایی تیم بارمان`) با Next.js 16
> App Router، TypeScript strict، Prisma 6 و React Query v5.
>
> **نکته:** پوشه `پلتفرم نهایی تیم بارمان/` (برنامه Demo) **فقط‌خواندنی** است
> و منبع حقیقت داده تا فعال‌سازی نهایی محسوب می‌شود. هیچ فایلی در آن نوشته
> یا تغییر نمی‌یابد (CLAUDE.md §۱).

---

## ۱. پیش‌نیازها

- Node.js ۲۲+ (توسعه با v24 آزمون شده)
- npm
- PostgreSQL برای تولید (توسعه/آزمون با SQLite کار می‌کند)

## ۲. راه‌اندازی توسعه

```bash
# نصب وابستگی‌ها
npm install

# ساخت schema پایگاه داده توسعه (SQLite) و seed اولیه
npx prisma db push
node --experimental-strip-types src/core/database/seed.ts

# اجرای سرور توسعه
npm run dev
```

ورود پیش‌فرض (پس از seed): کاربر `admin` با رمز `barman-admin-1405`
(قابل تغییر با `SEED_ADMIN_NAME`/`SEED_ADMIN_PASSWORD`).

## ۳. متغیرهای محیطی

`.env.example` را به `.env` کپی و مقداردهی کنید:

| متغیر | توضیح | پیش‌فرض |
|---|---|---|
| `DATABASE_URL` | رشته اتصال Prisma (SQLite توسعه / PostgreSQL تولید) | `file:./dev.db` |
| `AUTH_SECRET` | کلید امضای توکن (۳۲+ نویسه) — در تولید چرخش شود | — |
| `AUTH_COOKIE_SECURE` | ویژگی Secure کوکی نشست (تولید: `true`) | `false` |
| `SEED_ADMIN_NAME` / `SEED_ADMIN_PASSWORD` | کاربر مدیر seed | `admin` / `barman-admin-1405` |
| `NEXT_PUBLIC_LOG_LEVEL` | سطح لاگ کلاینت | `warn` |

## ۴. مهاجرت داده از Demo (فاز ۸)

مهاجرت کامل ۱۴۸ سند Demo در یک پایگاه داده **تازه** اجرا می‌شود — هرگز روی
پایگاه داده پر شده:

```bash
# ۱) ساخت پایگاه داده تازه (مثلاً فایل موقت) با schema
npx prisma db push --skip-generate --accept-data-loss

# ۲) اجرای مهاجرت — از طریق آزمون یکپارچه (مسیر Demo پیش‌فرض)
npx vitest run src/migration/migration-run.test.ts
```

دستور دوم: داده Demo را استخراج، نرمال‌سازی (CD-06/CD-07)، نگاشت،
اعتبارسنجی، بارگذاری تراکنشی و صحه‌گذاری می‌کند و گزارش Markdown در
`docs/reports/MIGRATION_REPORT.md` (شامل شمارش تطبیقی، ردیف‌های رد‌شده،
فیلدهای بدون معادل، آخرین شماره هر series و رمز اولیه کاربران) می‌نویسد.

متغیرهای اختیاری:

- `MIGRATION_TEST_DB` — مسیر فایل SQLite موقت (پیش‌فرض: تمپ سیستم).
- `MIGRATION_REPORT_OUT` — مسیر خروجی گزارش.
- یا `DATA_DIR` واقعی: `extractData(<dataDir>)` را مستقیم فراخوانی کنید
  (منابع: پوشه `data` یا ZIP استخراج‌شده از `/api/export/zip`).

**رمز اولیه همه ۸ کاربر مهاجرت‌شده** `barman1405` است (Demo هش رمز ذخیره
نمی‌کند — reset هماهنگ؛ MIGRATION_STRATEGY §۴ / CD-54). باید پس از اولین
ورود تغییر کند.

## ۵. دستورهای پرکاربرد

| دستور | توضیح |
|---|---|
| `npm run dev` | سرور توسعه (پورت ۳۰۰۰) |
| `npm run build` | ساخت production |
| `npm run start` | اجرای خروجی production |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | اجرای vitest |
| `npm run test:coverage` | پوشش آزمونی |
| `npm run check:colors` | بررسی عدم رنگ hardcoded (CD-03) |
| `npm run check:garble` | بررسی نویسه‌های نامعتبر فارسی |
| `npx vitest run --no-file-parallelism` | اجرای آزمون‌ها تک‌نخی (محدودیت RAM) |
| `bash scripts/smoke.sh` | آزمون دودی همه مسیرهای API |
| `node scripts/viewport-check-auth.mjs` | بررسی واکنش‌گرایی در ۵ عرض (CD-12) |

## ۶. استقرار production

چک‌لیست کامل در `docs/reports/PHASE_8_REPORT.md` (§ آماده‌سازی launch).
خلاصه:

۱. `DATABASE_URL` به PostgreSQL و `provider = "postgresql"` در
   `prisma/schema.prisma`؛ سپس `prisma migrate deploy`.
۲. چرخش `AUTH_SECRET` (۳۲+ نویسه تصادفی) و `AUTH_COOKIE_SECURE=true`.
۳. اجرای مهاجرت روی پایگاه داده production تازه.
۴. `npm run build && npm run start` پشت(reverse proxy) با HTTPS.
۵. پشتیبان‌گیری دوره‌ای: `pg_dump` (معادل pg-backup).

## ۷. ساختار پروژه

```
src/
  app/            # صفحات و Route Handlerهای Next.js (CD-04)
  core/           # auth, permissions, database, calendar, validation, …
  modules/        # customers, leads, orders, production, inventory,
                  # purchasing, finance, admin, reports, home, export
  components/     # ui, shared, layout, feedback
  migration/      # خط لوله مهاجرت Demo (فاز ۸)
docs/
  knowledge/      # ۱۵ سند دانش کسب‌کار
  architecture/   # ۱۲ سند معماری
  roadmap/        # نقشه راه و معیارهای پذیرش
  reports/        # گزارش فازها + MIGRATION_REPORT
  DECISION_LOG.md # تصمیمات CD/Q/D
```

## ۸. قوانین کلیدی

- منبع حقیقت موجودی: جدول `moves` — هیچ فیلد موجودی ذخیره نمی‌شود (CD-08).
- تاریخ خالص `YYYY/MM/DD` ASCII در ذخیره‌سازی؛ نمایش فارسی (CD-06).
- مهر زمانی: UTC ms (CD-07).
- مجوزها در سرور با `requirePermission` (CD-05)؛ نقش‌های تولید/انبار
  مبالغ دریافت نمی‌کنند (R-32).
- قانون کسب‌کار اختراع نمی‌شود — همه با ارجاع به Demo (CLAUDE.md §۱۳).
