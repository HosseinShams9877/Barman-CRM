# Production Checklist — استقرار BARMAN CRM

> چک‌لیست آماده‌سازی launch (PHASE_08 §۳.۱۰). هر مورد قبل از قطع
> نهایی Demo باید تأیید شود.

## ۱. پایگاه داده — PostgreSQL (فاز ۸ §۳.۱۰)

- [ ] `DATABASE_URL` در `.env` production به PostgreSQL تنظیم شده (مثلاً
      `postgresql://user:pass@host:5432/barman`).
- [ ] `prisma/schema.prisma` → `provider = "postgresql"` (تغییر موقت
      استقرار یا prisma دوگانه — مطابق فرآیند استقرار تیم).
- [ ] `npx prisma migrate deploy` روی پایگاه production — migrationهای
      فاز ۲ تا ۷ بدون تغییر اجرا می‌شوند (schema واحد SQLite/PostgreSQL).
- [ ] بررسی سازگاری: BigInt (CD-07)، JSON برای رنگ‌ها/BOM (هر دو
      پشتیبانی‌شده)، بدون enum (SQLite محدودیت ندارد).
- [ ] مهاجرت داده روی پایگاه تازه اجرا شده و `MIGRATION_REPORT.md`
      شمارش تطبیقی را تأیید می‌کند (accounts ۲۳، leads ۲۹، orders ۱۹،
      buys ۵ + ۱ رد‌شده مستند، jobs ۱، moves ۷۰).

## ۲. احراز هویت (D-01 / CD-17)

- [ ] `AUTH_SECRET` جدید با ۳۲+ نویسه تصادفی تولید شده (`openssl rand -hex 48`).
- [ ] `AUTH_COOKIE_SECURE=true` تنظیم شده (توکن فقط روی HTTPS).
- [ ] کوکی نشست: HttpOnly + SameSite + Secure (تأیید در PHASE_08 §۸).
- [ ] مجوزهای قدیمی Demo (PASS_*) غیرفعال‌اند — ورود فقط با رمز هش‌شده.

## ۳. رمز عبور کاربران (CD-54)

- [ ] همه ۸ کاربر با رمز اولیه `barman1405` ساخته شده‌اند — پیام
      هماهنگ‌سازی به کاربران ارسال شده و رمز اولیه پس از اولین ورود
      تغییر می‌کند.
- [ ] رمز مدیر production از `barman-admin-1405` تغییر کرده.

## ۴. برنامه

- [ ] `npm run build` بدون خطا با `NODE_OPTIONS=--max-old-space-size=2560`.
- [ ] `npm run start` پشت reverse proxy با HTTPS + HSTS.
- [ ] هدرهای امنیتی: CSP پایه، X-Content-Type-Options (PHASE_08 §۸).
- [ ] فایل `.env` production در git نیست (gitignore).

## ۵. پشتیبان‌گیری (معادل scripts/pg-backup)

- [ ] پشتیبان‌گیری دوره‌ای `pg_dump` تنظیم شده:
      ```bash
      pg_dump "$DATABASE_URL" --no-owner --no-privileges > backup-$(date +%Y%m%d).sql
      ```
- [ ] خروجی ZIP معادل Demo (`/api/export/zip`) برای بک‌آپ دادهای در
      دسترس مدیر فعال است (PHASE_07 CD-47 — همان چیدمان `data/`).
- [ ] بازیابی آزمون شده (restore روی پایگاه موقت).

## ۶. عملیات پس از launch

- [ ] نسخه بعدی شماره‌های series از Rev ادامه پیدا می‌کند (R-12 —
      PF-1220، LD-1033، AC-223، BY-307، PJ-502، TR-1211).
- [ ] پایش خطاها (`/api/health`) و لاگ‌های سرور.
- [ ] خرابی‌های مستند فاز ۸ (فهرست post-launch در PHASE_8_REPORT.md)
      به backlog منتقل شده‌اند.

## ۷. قطع Demo

- [ ] Demo (`پلتفرم نهایی تیم بارمان`) بعد از اعتبارسنجی نهایی
      داده‌ها، طبق تصمیم مالک غیرفعال می‌شود (PHASE_08 §۱۴ — نیاز به
      تأیید صریح مالک برای زمان قطع).
