# SOURCE_INVENTORY — فهرست کامل منابع نسخه نمایشی

> مسیر مبدأ: `D:\New folder\CRM-Barman` که فقط شامل پوشه `پلتفرم نهایی تیم بارمان` است. این پوشه تنها مکان مرجع پروژه است.
> هیچ فایل اصلی بازنویسی/حذف/جابجا نشده است؛ این فهرست صرفاً خروجی بازرسی فقط‌خواندنی است.

## ۱. درخت پروژه (با تعداد دقیق)

```
پلتفرم نهایی تیم بارمان/
├── .env.local                    (۲٬۷۸۵ بایت — فقط گزارش وجود: مقادیر هرگز خوانده/افشا نشده‌اند)
├── .secrets.local.json           (۱۵۵ بایت — فقط گزارش وجود)
├── .gitignore                    (۱۳ خط)
├── .vercel/                      (پیکربندی استقرار)
├── .vercelignore
├── README.md                     (۵٬۶۱۷ بایت)
├── index.html                    (۲۵۰ بایت — redirect به app/login.html)
├── package.json                  (تنها وابستگی: @neondatabase/serverless 1.2.0)
├── package-lock.json
├── server.js                     (۴٬۰۸۰ بایت — سرور استاتیک + API، پورت ۸۰۹۰)
├── start.bat                     (راه‌اندازی ویندوز با runtime/node.exe جاسازی)
├── vercel.json                   (استقرار: dist/، منطقه fra1، rewriteهای /api)
├── api/
│   └── index.js                  (نقطه ورود Serverless مشترک با server/api.js)
├── app/                          (۱۳ HTML + ۱۵ JS + ۱ CSS + ۲ فونت = ۳۱ فایل)
│   ├── admin.html  admin.js      (۱۸۴ خط)
│   ├── buy.html    buy.js        (۲۹۳ خط)
│   ├── customer.html             (۶٬۷۰۹ بایت — پیش‌فاکتور قابل چاپ، بدون فایل JS جدا)
│   ├── fin.html    fin.js        (۱۵۴ خط)
│   ├── flow.html   flow.js       (۸۱ خط)
│   ├── home.html   home.js       (۹۶ خط)
│   ├── leads.html  leads.js      (۵۶۸ خط)
│   ├── login.html                (۷۰ خط — انتخاب نقش، probe پورت 8090..8100)
│   ├── order.html  order.js      (۷۷۸ خط — بزرگ‌ترین صفحه: خط لوله ۱۱ مرحله‌ای)
│   ├── orders.html orders.js     (۶۵ خط)
│   ├── prod.html   prod.js       (۱۳۷ خط)
│   ├── reports.html reports.js   (۶۹ خط)
│   ├── stock.html  stock.js      (۸۴ خط)
│   ├── br.css                   (۳۱۹٬۶۶۹ بایت / ۳٬۸۶۴ خط)
│   ├── core.js                  (۸۹۹ خط — window.BR، ۵۲+ عضو)
│   ├── data.js                  (۲۵۶ خط — Store و همگام‌سازی)
│   ├── fin-core.js              (۷۶ خط — window.BRF)
│   ├── lead-core.js             (۱۴۲ خط — window.BRL)
│   └── fonts/ (Vazirmatn-Bold.woff2, Vazirmatn-Regular.woff2)
├── server/
│   ├── api.js                   (احراز هویت + فهرست سفید collectionها)
│   ├── auth.js                  (کوکی امضاشده، scrypt، تمدید لغزان)
│   ├── config.js                (PORT 8090، STORAGE، MODE، PASS_*، سهمیه‌ها)
│   ├── export.js                (zip بدون وابستگی، CSV سرنخ‌ها، gzip)
│   └── drivers/
│       ├── file.js              (data/ روی دیسک)
│       └── pg.js                (Postgres/Neon، اسکیمای barman)
├── scripts/
│   ├── pg-backup.js             (export/import/import-dir)
│   └── vercel-build.js          (ساخت dist/)
├── seed-data/
│   └── meta.json                (۴۶ محصول BR-101…BR-138، ۸ محصول نمایندگی a1…a8،
│                                  ۱۶ ماده RM-101…RM-116، ۷ تأمین‌کننده s1…s7،
│                                  ۷ فهرست، تنظیمات rate:3)
├── runtime/
│   └── node.exe                 (Node جاسازی برای start.bat بدون نصب)
├── data/                        (داده نمونه اجرای محلی — «نسخه نمایشی»)
│   ├── meta.json
│   ├── accounts/   ۲۳ سند (AC-101…AC-222)
│   ├── leads/      ۲۹ سند (LD-1001…LD-1032)
│   ├── orders/     ۱۹ سند (PF-1201…PF-1219)
│   ├── buys/       ۶ سند (BY-301…BY-306)
│   ├── jobs/       ۱ سند (PJ-501)
│   ├── moves/      ۷۰ سند حرکت انبار
│   └── seq-AC.txt seq-BY.txt seq-LD.txt seq-PF.txt seq-PJ.txt
└── بک‌آپ/
    └── بک‌آپ-کامل-بارمان-1405-08-17.zip
```

**توجه:** پوشه `data/files/` وجود ندارد (هیچ فایل آپلودشده‌ای در نمونه نیست) و پوشره `data/txns/` هم وجود ندارد (مجموعه `txns` در حافظه خوانده می‌شود).

## ۲. آمار کلیدی

| سنجه | مقدار |
|---|---|
| خط کد JS اپ (بدون core) | ۲٬۹۸۳ خط در ۱۴ فایل صفحه‌ای |
| خط کد زیرساخت کلاینت (core+data+fin-core+lead-core) | ۱٬۳۷۳ خط |
| خط CSS | ۳٬۸۶۴ خط |
| توکن کلاس CSS یکتا | ۱٬۵۱۷ (۱٬۰۲۴ مورد = ۶۷٪ بدون ارجاع، ۴۰ خانواده پیشوندی کاملاً مرده) |
| بلوک قانون CSS | ۳٬۴۹۰ (۱٬۸۷۹ خط = ۵۳٪ در انتخابگرهای کاملاً مرده) |
| پرس‌وجوهای رسانه | ۱۲۴ مورد، ۳۴ ارزش یکتا از ۴۸۰px تا ۱۶۰۰px + ۲ container query (۷۶۰px/۷۲۰px) |
| سندهای داده نمونه | ۱۴۸ سند + ۵ فایل دنباله |
| وابستگی npm زمان اجرا | ۱ (فقط هنگام DATABASE_URL) |

## ۳. نگاشت بارگذاری اسکریپت هر صفحه

هر پوسته (به جز `login.html` و `customer.html` که فقط `data.js` + `core.js` می‌خوانند):

```
data.js → core.js → fin-core.js → lead-core.js → <page>.js     (همه با ?v=1108j)
```

## ۴. نقش فایل‌های متمایز

- `data.js`: شیء `Store` (بارگذاری/ذخیره/همگام‌سازی، fallback `window.name`)، ثابت‌های زمان، ارقام فارسی.
- `core.js`: `window.BR` (X) — تقویم جلالی، قالب‌پول، نقش‌ها، تنظیمات، نوار کناری، دیالوگ‌ها، datepicker.
- `fin-core.js`: `window.BRF` (B) — وضعیت‌های خرید، درخواست خرید، ورود انبار، جریان نقدی، دریافتنی/پرداختنی.
- `lead-core.js`: `window.BRL` (L) — مراحل سرنخ، ستون‌های کانبان، افزودن سرنخ/اکانت.
- `app/br.css`: تمام استایل؛ شامل دو بلوک `:root` (خط ۶ و خط ۲۳۸۹ برای حالت «در کارت») و بخش حالت حداقل در خطوط ۳۵۵۳–۳۵۸۴.

## ۵. خط زمانی تصادفی

- تاریخ آخرین تغییر فایل‌ها: همه ۹ نوامبر (زمان کپی/استقرار محلی) — ارزش تاریخی git ندارند (`.git` وجود دارد ولی فشرده‌سازی زمان‌دار توسط این عامل بررسی نشده است).
- نام بک‌آپ: `بک‌آپ-کامل-بارمان-1405-08-17.zip` (اریخ ۱۴۰۵/۰۸/۱۷ خورشیدی).
