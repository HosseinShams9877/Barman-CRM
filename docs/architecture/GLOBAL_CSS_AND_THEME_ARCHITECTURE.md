# GLOBAL_CSS_AND_THEME_ARCHITECTURE — معماری CSS سراسری و تم

> طرح (فاز صفر). پاسخ مستقیم به R-17 (۶۷٪ توکن‌های CSS بدون ارجاع، ۵۳٪ خطوط در انتخابگرهای کاملاً مرده).

## ۱. وضعیت موجود (Demo)

See `docs/knowledge/GLOBAL_CSS_AND_THEME_TOKENS.md`.

| معیار | مقدار |
|---|---|
| اندازه `app/br.css` | ۳۱۹٬۶۶۹ بایت / ۳٬۸۶۴ خط |
| توکن‌های کلاس یکتا | ۱٬۵۱۷ (۱٬۰۲۴ بدون ارجاع = ۶۷٪) |
| بلوک‌های قانون | ۳٬۴۹۰ (۱٬۸۷۹ خط در انتخابگرهای کاملاً مرده = ۵۳٪) |
| مدیا کوئری‌ها | ۱۲۴ در ۳۴ عرض یکتا (۴۸۰…۱۶۰۰px) + ۲ container query |
| توکن‌های `:root` | ۳۱ متغیر (در دو جا تعریف شده‌اند) |
| رنگ‌های hardcoded در JS | خط تولید، چک‌ها، روش پرداخت (پرداخت/چک/نسیه) |

## ۲. طرح هدف

### ۲.۱ ساختار فایل‌ها (طبق سند راهرسی)

```
src/styles/globalCss/
├── tokens.css       — متغیرهای معنایی (رنگ، فاصله، شعاع، سایه)
├── themes.css       — تم روشن/تاریک (چرخه روی توکن‌ها)
├── typography.css   — فونت Vazirmatn، اندازه‌ها، ارتفاع خط، اعداد فارسی
├── layout.css       — اسکلت، sidebar، navbar، grid basics
├── utilities.css    — کلاس‌های کمکی (.ltr، .icon، .ellipsis…)
└── index.css        — فقط @importهای بالا

src/app/globals.css  — فقط `@import "../styles/globalCss/index.css";`
```

### ۲.۲ سیستم توکن

| دسته | مثال |
|---|---|
| رنگ پایه | `--color-bg`، `--color-surface`، `--color-text`، `--color-muted` |
| رنگ معنایی | `--color-success`، `--color-warning`، `--color-danger`، `--color-info` |
| رنگ نقش | `--color-role-management`… (۷ نقش با رنگ‌های Demo) |
| رنگ کسب‌کار | `--color-pay-cash`، `--color-pay-cheque`، `--color-pay-credit`، `--color-lane-1…4` |
| فاصله | `--space-1…--space-8` (مبتنی بر ۴px) |
| شعاع | `--radius-sm/md/lg` (Demo: ۱۰/۱۴) |
| سایه | `--shadow-sm/md/lg` |
| تایپوگرافی | `--font-size-base: 14px`، `--line-height-base: 1.75` |
| چیدمان | `--sidebar-width: 256px` (Demo: `--side`) |

### ۲.۳ قوانین

۱. **هیچ رنگ hardcoded**: Tailwind config به توکن‌ها متصل می‌شود (`colors: { bg: "var(--color-bg)" }`) — نه پالت مستقل.
۲. **رنگ‌های کسب‌کار در `constants`**: مقادیر معنایی (مثل `paymentTypeColor.cash`) در `src/modules/<m>/constants` به‌عنوان تایپ union + نگاشت به توکن CSS.
۳. **بررسی خودکار** (طبق سند راهرسی): اسکریپت CI که در `src/**/*.tsx` و `src/**/*.css` به دنبال الگوهای رنگ hardcoded بگردد (`#[0-9a-fA-F]{3,8}`، `rgb(`، `hsl(`) و خطا بدهد — مگر در فایل‌های توکن.
۴. **تنها یک منبع**: `tokens.css`. هیچ متغیر تکراری در جای دیگر (درس از دو `:root` Demo).
۵. **حالت minimal (دیده‌شدنی) حفظ می‌شود**: معادل `minimal-mode` Demo به‌عنوان یک کلاس `[data-minimal]` روی `<html>` که فقط مقادیر توکن را دوباره تعریف می‌کند.
۶. **تم تاریک**: `themes.css` با `[data-theme="dark"]` — آماده‌سازی برای آینده، نقش کلیدی: فقط توکن‌ها تغییر می‌کنند، نه کامپوننت‌ها.

### ۲.۴ Tailwind

- لایه ابزاری — ترکیب کلاس‌های کمکی برای ساختار، توکن‌ها برای رنگ.
- `@layer components` برای الگوهای تکراری (`.btn`، `.card`، `.input`).
- پلاگین `tailwindcss-rtl` (یا راهکار منطقی معادل) برای RTL.

### ۲.۵ RTL و فارسی

- `dir="rtl"` در `<html>` (Next.js metadata).
- ارقام فارسی فقط در نمایش — تبدیل توسط `core/formatting`، نه CSS.
- `.ltr` برای محتوای لاتین (کد، اعداد فنی) — استثنای دقیقاً مشخص.
- فونت Vazirmatn — خودمیزبان در `src/app/fonts/`.
- `unicode-bidi: isolate` در محتوای دوگانه.

### ۲.۶ مهاجرت CSS

See `MIGRATION_STRATEGY.md`. خلاصه: کلاس‌های Demo **منتقل نمی‌شوند** — هر کامپوننت جدید با Tailwind + توکن ساخته می‌شود. فقط مقادیر اساسی (اندازه، رنگ، شعاع) که در سیستم طراحی Demo نقش دارند استخراج و نرمال می‌شوند.
