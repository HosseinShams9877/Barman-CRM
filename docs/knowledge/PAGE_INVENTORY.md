# PAGE_INVENTORY — فهرست کامل صفحات Demo و رفتار هر یک

> هر صفحه از یک الگوی یکسان پیروی می‌کند: IIFE + `"use strict"`، `var X = window.BR` + نام‌های مستعار (`fa`, `money`, `esc`, `icon`, `$`)، `R = X.role()`، `ME = X.me()`، `LS = X.lists()`، `S = X.settings()`، `OPS = X.noMoney(R)`، فراخوانی `X.shell({...})` برای ساخت اسکلت، رندر رشته‌ای HTML، رویدادهای تفویض‌شده `click`/`change`/`focusout`/`input` روی `page` با ویژگی‌های `data-*`، تابع `paint()` برای باز‌رندری با حفظ `window.scrollY`.

## ۱. خلاصه صفحات

| صفحه | فایل‌ها (خط) | نقش‌های مجاز | تب‌ها | توضیح |
|---|---|---|---|---|
| ورود | `login.html` (۷۰) | همه (احراز هویت) | — | انتخاب نقش/کاربر، probe پورت محلی |
| داشبورد | `home.html` + `home.js` (۹۶) | همه | — | KPIها، فازهای سفارش، فعالیت‌ها |
| سرنخ‌ها | `leads.html` + `leads.js` (۵۶۸) | sales، salesManager، management، admin | کانبان raw/opp/pf/won/lost + فهرست | بزرگ‌ترین صفحه CRM |
| سفارش‌ها | `orders.html` + `orders.js` (۶۵) | sales، salesManager، management، admin | — | فهرست سفارش‌ها با فیلتر |
| سفارش | `order.html` + `order.js` (۷۷۸) | sales، salesManager، management، admin | خط لوله ۱۱ مرحله‌ای | ویرایش/صدور پیش‌فاکتور |
| جریان | `flow.html` + `flow.js` (۸۱) | management، admin | — | نمودار جریان سفارش‌ها |
| تولید | `prod.html` + `prod.js` (۱۳۷) | production، management، admin | ۴ تب | خط تولید، مصرف مواد، سوابق |
| انبار | `stock.html` + `stock.js` (۸۴) | production، depot، sales، salesManager، finance، management، admin | ۵ تب نقش‌محور | موجودی، ورود، خروج، حرکت‌ها |
| خرید | `buy.html` + `buy.js` (۲۹۳) | management، finance، admin | — | درخواست/تأیید/رسید خرید |
| مالی | `fin.html` + `fin.js` (۱۵۴) | finance، management، admin | ۲ تب × ۳ سبتاب | دریافتنی/پرداختنی/چک/هزینه |
| گزارش‌ها | `reports.html` + `reports.js` (۶۹) | management، admin | — | گزارش‌های فروش/تولید/مالی |
| مدیریت | `admin.html` + `admin.js` (۱۸۴) | admin (+ management برای برخی نماها) | ۹ تب | کاربران، کاتالوگ، BOM، فهرست‌ها، تنظیمات |
| پیش‌فاکتور چاپی | `customer.html` | **بدون احراز هویت** | — | خروجی چاپ پیش‌فاکتور |

## ۲. جزئیات هر صفحه

### ۲.۱ `login.html` — ورود
- پس‌زمینه gradient `linear-gradient(160deg,#0c2a62,#081a3e,#0a1f4a)`، لوگوی SVG.
- `#offline-note` وقتی `X.isLive()` نباشد نمایش داده می‌شود.
- اگر با پروتکل `file:` باز شود و سرور زنده نباشد، پورت‌ها را می‌آزماید: `tryPort(p)` از ۸۰۹۰ شروع و تا بالای ۸۱۰ ادامه می‌یابد، تگ `<script src="http://localhost:P/ping.js">` تزریق می‌کند (`server.js` در مسیر `/ping.js` مقدار `window.__BR_PORT=<PORT>` برمی‌گرداند) و سپس به `http://localhost:P/app/login.html` هدایت می‌شود.
- `HOME = {management:"home", admin:"admin", finance:"home", salesManager:"home", sales:"home", production:"prod", depot:"home"}` — مسیر پیش‌فرض پس از ورود هر نقش.
- دکمه‌های کاربر از `X.users()` با فیلتر `u.off`؛ کلیک → `X.setRole(r,u)` + هدایت.

### ۲.۲ `home.html` — داشبورد
- KPIهای روز، فازهای سفارش در ۴ گروه (ناهماهنگ با ۵ فاز `flow.js`)، فهرست فعالیت‌های اخیر و هشدارها (سرنخ‌های معوق، سفارش‌های در انتظار، چک‌های نزد سررسید).

### ۲.۳ `leads.html` —CRM سرنخ‌ها (۵۶۸ خط)
- نمای کانبان با ستون‌های `raw`/`opp`/`pf`/`won`/`lost` ( ستون‌ها از فهرست `leadCols` در admin قابل ویرایش هستند — `BRL.colEditor`).
- کارت سرنخ: نام/شرکت، شهر، مرحله، کارشناس، ارزش، احتمال، پیگیری بعدی.
- دیالوگ سرنخ: ویرایش مرحله، خط محصول، منبع، پروژه، محصولات موردنظر، متراژ، ارزش، احتمال، یادداشت، تاریخچه تماس‌ها (`hist`)، دلیل از دست رفتن، تبدیل به پیش‌فاکتور (ایجاد PF و `l.order`).
- فیلتر بر اساس کارشناس/مرحله/جستجوی متن.

### ۲.۴ `orders.html` — فهرست سفارش‌ها
- فیلتر بر اساس وضعیت/کارشناس/جستجو؛ کلیک روی هر ردیف → `order.html?id=PF-…`.

### ۲.۵ `order.html` — پیش‌فاکتور (۷۷۸ خط، بزرگ‌ترین صفحه)
- خط لوله ۱۱ مرحله‌ای (`new`، `sent`، `ok`، `pay`، `buy`، `prod`، `ready`، `ship`، `done`، `pending`، `cancel`) — کلیک روی کارت مرحله، وضعیت را جابه‌جا می‌کند.
- ویرایشگر اقلام: محصول، رنگ (از `p.colors`)، عرض/طول (م² محاسبه می‌شود)، تعداد، قیمت واحد — جمع/تخفیف/کرایه/نصب/مالیات/جمع نهایی با گردکردن `rnd()`.
- نوع پرداخت (`cash`/`chq`/`credit`)، ثبت رزرو نقدی، طرح پرداخت، صدور/چاپ، بازگشت به مرحله قبلی.
- `TR-` شناسه تراکنش از `o.id.slice(3)` ساخته می‌شود.

### ۲.۶ `flow.html` — نمودار جریان
- نمایش خطی ۵ فازی سفارش‌ها (برخلاف ۴ فاز `home.js`) — ناهماهنگی شناخته‌شده.

### ۲.۷ `prod.html` — تولید (۴ تب)
- `TABS = [["","نمای کلی"], ["stock","تولید برای انبار"], ["use","خروج و مصرف مواد"], ["hist","سوابق تولید"]]`.
- `JST = {plan/run/qc/sent/done}` با رنگ‌های خاکستری/نارنجی/بنفش/آبی/سبز.
- `LANES` با `k=6..9` و رنگ‌های `#e8790f`، `#1662d8`، `#6a4fd8`، `#18a058`؛ `JLANE = {plan:7, run:7, qc:8, sent:9}`.
- نمای کلی: ۴ کاشی (صندوق ورودی، متراژ کارخانه روی مرحله ۷، تأخیر ساعت، درصد ضایعات)، نوار سلامت مواد (`r = h/min`، قرمز <1، نارنجی <1.5)، تخته خطوط.
- ایجاد کار PJ با پیش‌نمایش زنده BOM، شروع کار (کسر مواد با `kind:"use"`)، پایان اجرا → QC → ارسال به دپو → رسید در `stock.html#in`.

### ۲.۸ `stock.html` — انبار
- `TABS` بر اساس نقش: production `[raw, depot, moves]`، depot `[depot, in, out, moves]`، sales/salesManager/finance `[depot]`، management/admin هر پنج.
- `KIND = {open, buy, prod, sale, use, out, adj, waste, job}`.
- نمای دپو: موجودی/رزرو `X.reserved`/آزاد/در راه + ارزش کل انبار به قیمت فروش (مخفی برای `OPS`).
- نمای مواد: مصرف ۳۰ روزه، آستانه `min` با chip قرمز «کمتر از حداقل»، لینک خرید (management).
- نمای حرکت‌ها: فیلتر نقش/انبار، ۳۰۰ ردیف اخیر، ارجاع به `order.html?id=PF-…` / `buy.html#b=BY-…`.
- رویدادها: `hashchange`، `input#s-q`، `change#s-l/#s-w`، `br:sync` (به جز تب `out`).

### ۲.۹ `buy.html` — خرید (۲۹۳ خط)
- فهرست درخواست‌های خرید با وضعیت `req`/`ok`/`fin`/`recv`، دیالوگ ایجاد درخواست، تأیید مدیر، تأیید مالی، ثبت چک (`issued` → `paid`)، رسید انبار.
- `prompt()` برای بازگشت به مدیر خرید (ریسک UX).

### ۲.۱۰ `fin.html` — مالی
- `TABS = [["rec","دریافتنی‌ها"], ["pay","پرداختنی‌ها"]]`، هرکدام ۳ سبتاب: سررسیدها، بدهکاران، چک‌ها.
- فیلتر بازه ۷/۳۰/۹۰ روز/همه/دلخواه (ذخیره در `sessionStorage["br.finF"]`).
- `CST` (وضعیت چک): `hand` نزد صندوق، `bank` خوابانده به حساب، `clear` وصول شد، `bounce` برگشت خورد، `issued` صادر شده، `paid` پاس شد.
- ثبت هزینه/درآمد متفرقه در collection `txns`.

### ۲.۱۱ `reports.html` — گزارش‌ها (۶۹ خط)
- گزارش‌های فروش/تولید/مالی با باکت‌بندی ماهانه بر اساس `fa(...).slice(0,7)` (ماه شمسی).
- **باگ اولویت عملگرها** در `pfAll` (`a && b || c`) — ریسک فنی ثبت‌شده.

### ۲.۱۲ `admin.html` — مدیریت (۹ تب)
کاربران (`FULL` فقط ایجاد)، کاتالوگ محصولات (BR-1xx تولیدی، a-x نمایندگی)، مواد (RM-1xx با ۶ واحد)، ویرایشگر BOM (`data-bm/bq/bdel/badd/bsave`)، مشتریان (با فیلد تلفن غیرقابل ویرایش)، تأمین‌کنندگان (`raw`/`agency`)، ویرایشگر ۷ فهرست (`sources/roles/results/lost/projects/channels/waste`)، ستون‌های سرنخ، تنظیمات (نام شرکت، شعار، تلفن، آدرس، بله، `vat`، `validDays`، `discountCap` هر نقش).

### ۲.۱۳ `customer.html` — پیش‌فاکتور چاپی
- **بدون احراز هویت**: `?o=<id در URL>` → `X.get(decodeURIComponent(id))`.
- استایل‌های inline با کلاس‌های `.pf/.pf-h/.pf-b/.pf-meta/.pf-to/.tot/.pf-note/.pf-sign/.pf-bar` و رنگ‌های ثابت `#eef2f8`، `#fff`، `var(--navy)`، `#f6f8fc`، `#e3e8f0` + `@media print`.
- بارگذاری فقط `data.js` + `core.js`؛ دکمه `window.print()`.
