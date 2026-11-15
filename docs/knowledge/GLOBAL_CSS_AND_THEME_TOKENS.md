# GLOBAL_CSS_AND_THEME_TOKENS — توکن‌های CSS نسخه نمایشی

> منبع: `app/br.css`. این سند **ارزش دقیق** همه توکن‌ها را ثبت می‌کند تا در معماری هدف مسیر `src/styles/globalCss/` بازسازی شود.

## ۱. بلوک `:root` اصلی (خط ۶)

```css
--bg:#f3f6fb;        /* پس‌زمینه صفحه */
--card:#ffffff;      /* پس‌زمینه کارت */
--line:#e4eaf3;      /* خط اصلی */
--line-2:#eef2f8;    /* خط ثانویه */
--ink:#0f1d3a;       /* متن اصلی */
--ink-2:#3a4a66;     /* متن ثانویه */
--muted:#6b7a93;     /* متن کم‌رنگ */
--blue:#1662d8;
--blue-700:#0f4fb8;
--blue-50:#eaf2ff;
--blue-100:#d8e7ff;
--navy:#0a2150;
--orange:#e8790f;
--orange-50:#fff3e5;
--orange-ink:#b25300;
--green:#18a058;
--green-50:#e8f7ee;
--green-ink:#0d7040;
--purple:#6a4fd8;
--purple-50:#f0ecff;
--red:#d63a3a;
--red-50:#fdecec;
--red-ink:#a92424;
--yellow-50:#fff8db;
--yellow-ink:#8a6400;
--radius:14px;
--radius-sm:10px;
--shadow:0 1px 2px rgba(15,35,80,.05),0 6px 20px rgba(15,35,80,.05);
--side:256px;
--font:"Vazirmatn",Tahoma,sans-serif;
```

## ۲. بلوک `:root` دوم (خط ۲۳۸۹ — حالت کارت/محدود)

بازنویسی محلی برای فضای کار (workbench): `--bg:#e8edf5; --line:#d8e0ec; --shadow` + بازنویسی کلاس‌های `card`, `tbl`, `ws-b`, `ws-sec`, `fl-list`, `ld-tile`.

## ۳. بخش حالت حداقل (خطوط ۳۵۵۳–۳۵۸۴)

قواعد اضافی برای چیدمان فشرده.

## ۴. قواعد پایه

```css
body { font-size:14px; line-height:1.75 }
.ltr { direction:ltr; unicode-bidi:isolate }
.icon { width:22px; height:22px; stroke-width:1.8 }
:focus-visible { outline:3px solid rgba(22,98,216,.45) }
```

## ۵. نقاط شکست (۱۲۴ پرس‌وجو)

`max-width`: ۴۸۰, ۵۲۰, ۵۶۰, ۶۰۰, ۶۴۰, ۷۰۰, ۷۲۰, ۷۶۰, ۸۰۰, ۹۰۰, ۱۰۰۰, ۱۰۲۴, ۱۱۰۰, ۱۱۸۰, ۱۲۰۰, ۱۲۵۰, ۱۳۲۰, ۱۴۰۰, ۱۴۴۰, ۱۵۰۰, ۱۵۶۰, ۱۶۰۰ (px)
`min-width`: ۱۰۲۵
`print`: بله
`container`: `(min-width:760px)`, `(min-width:720px)`

## ۶. رنگ‌های ثابت در JS (خارج از توکن‌ها)

- پرداخت: `cash #17a34a`، `chq #2f6ec`/`#2f6eec`، `credit #e0a12b`.
- خطوط تولید: `#e8790f`, `#1662d8`, `#6a4fd8`, `#18a058`.
- صفحه ورود: `linear-gradient(160deg,#0c2a62,#081a3e,#0a1f4a)`.
- `customer.html`: `#eef2f8`, `#fff`, `var(--navy)`, `#f6f8fc`, `#e3e8f0`.
- آواتار کاربر جدید: `"#" + Math.floor(Math.random()*0x777777+0x222222).toString(16)`.

**نکته**: این رنگ‌ها در معماری هدف باید به توکن‌های معنادار منتقل شوند (طبق سند راهبری: «رنگ‌های ثابت پراکنده ممنوع»).

## ۷. استراتژی مهاجرت (خلاصه)

- پوشه `src/styles/globalCss/` با فایل‌های: `tokens.css` (ارزش‌های بالا)، `themes.css` (حالت روشن/تیره)، `typography.css` (فونت/بسیط)، `layout.css` (چیدمان پایه)، `utilities.css` (کمکی)، `index.css` (ورودی).
- ورودی برنامه: `src/app/globals.css` که فقط `globalCss/index.css` را ایمپورت می‌کند.
- تنظیمات Tailwind رنگ‌ها را به همین توکن‌ها ارجاع می‌دهد.
- بررسی خودکار رنگ‌های ثابت در کد (lint script) — جزئیات در `GLOBAL_CSS_AND_THEME_ARCHITECTURE.md`.

## ۸. فونت

`app/fonts/Vazirmatn-Bold.woff2` و `Vazirmatn-Regular.woff2` (تنها وزن‌های موجود).
