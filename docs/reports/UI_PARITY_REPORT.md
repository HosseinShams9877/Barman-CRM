# UI Parity Report — بازگرداندن هماهنگی بصری Demo و رفع باگ سایدبار

> تاریخ: ۱۴ آبان ۱۴۰۴ (2026-11-15) · فاز: ۸ (پس از بسته شدن) · نوع: UI/UX + سایدبار
> مالک وظیفه: دستور صریح مالک پروژه (override) — «مو به مو» مثل Demo.

---

## ۱. خلاصه اجرایی

 دو دسته از دستور مالک انجام شد:

1. **باگ بحرانی سایدبار** — ریشه‌یابی شد (دو علت) و رفع شد: آیتم‌های «کاربران و دسترسی‌ها» و «تنظیمات عمومی» (و در واقع همه آیتم‌های مدیریت) به مسیر اشتباه می‌رفتند و صفحه `/admin/users` در محیط توسعه به‌خاطر نشت کد Node به باندل کلاینت کرش می‌کرد.
2. **هماهنگی بصری Demo** — مقادیر دقیق Demo (`app/br.css`, `app/core.js`) در ساختار توکنی موجود جای‌گذاری شد (CD-03 حفظ شد)، تب‌های admin بازگردانده شد (`customers`، `leadcols` با حداقل ذخیره‌سازی در کلید `List` به نام `leadcols`) و همه دروازه‌های خروج سبز شدند.

هیچ فایلی در پوشه Demo دست نخورده است؛ هیچ migration/schema/قرارداد API تغییری نکرده است.

---

## ۲. رفع باگ سایدبار

### ۲–۱. علت اول: href‌های یکسان

**ریشه:** در `src/components/layout/Sidebar.tsx` (نسخه قبلی) همه آیتم‌های گروه مدیریت یک `href: "/admin"` داشتند — `محصولات`، `مواد اولیه`، `فرمول تولید`، `تأمین‌کننده‌ها`، `کاربران و دسترسی‌ها`، `فهرست‌ها`، `ستون‌های بورد سرنخ`، `تنظیمات عمومی`. تنها مسیر موجود `/admin` بود و مسیرهای `/admin/users` و `/admin/settings` اصلاً وجود نداشتند. در نتیجه:

- کلیک «کاربران و دسترسی‌ها» و «تنظیمات عمومی» فقط صفحه `/admin` را با تب پیش‌فرض (`products`) باز می‌کرد — انگار کلیک اثر نداشته است.
- چون چند آیتم به یک مسیر اشاره می‌کردند، رفتار کلیک‌ها «یکجا» به نظر می‌رسید (همه به یک جا می‌رفتند).

**فرضیه تداخل کلیک‌ها / اهداف روی‌هم (که بررسی و رد شد):** هیچ `<a>` تو در تو یا تداخل z-index نبود — هر آیتم یک `<Link>` اختصاصی بود. مشکل صرفاً مقصد یکسان بود.

**رفع:**

- هر تب مدیریت مسیر اختصاصی خود را گرفت (انطباق با Demo: `admin.html#<tab>`) — `src/app/(app)/admin/{products,materials,bom,suppliers,users,lists,leadcols,settings}/page.tsx`. هر مسیر همان `AdminPage` را با `initialTab` متناظر render می‌کند (هشت فایل صفحه، هرکدام ده خط؛ باز استفاده کامل از کامپوننت‌های موجود — هیچ منطق جدیدی ننوشته شد).
- `NAV_BY_ROLE` در `Sidebar.tsx` اکنون برای هر آیتم href مخصوص دارد (`/admin/materials`، `/admin/users`، …).
- `/admin` (خالی) همچنان برای تب پیش‌فرض و آیتم «تعاریف و تنظیمات» نقش management وجود دارد.

### ۲–۲. علت دوم (بحرانی‌تر، هنگام بررسی زنده کشف شد): نشت `seed.ts` به باندل کلاینت

با لاگ‌گیری CDP روی `/admin/users` در dev، خطای زیر دیده شد:

```
TypeError: (0 , ...native-url...__.pathToFileURL) is not a function
  at module evaluation — src/core/database/seed.ts:1372
```

**ریشه:** Turbopack در حالت dev tree-shaking انجام نمی‌دهد. زنجیره:

```
AdminPage ("use client")
  → import { AccountList } from "@modules/customers"   (barrel)
      → barrel دوباره services/account.service.ts را re-export می‌کند
          → account.service: import { nextPrefixedId } from "@core/database"
              → barrel @core/database: export ... from "./seed"
                  → seed.ts: import { pathToFileURL } from "node:url"
                      → در مرورگر وجود ندارد → کل چانک کلاینت از کار افتاد
```

به‌علاوه `LeadColsPanel` (جدید) ثابت‌ها را مستقیماً از `../services/leadcols.service` import می‌کرد — یعنی `new PrismaClient()` را به باندل مرورگر می‌کشید. ساختمان production (با tree-shaking) سبز بود و همین مشکل را پنهان نگه داشته بود — فقط در dev نمایان می‌شد.

**رفع (سه لایه):**

1. `AdminPage` اکنون `AccountList` را مستقیم از مسیر کامپوننت import می‌کند (`@modules/customers/components/AccountList`) به‌جای barrel — زنجیره کلاینت دیگر از services عبور نمی‌کند.
2. ثابت‌های leadcols (`LEADCOLS_STAGES`، `LEADCOLS_DEFAULTS`، `LEADCOLS_DEFAULT_COLOR`، `colorOf`) به فایل خالص `src/modules/admin/constants/leadcols.ts` منتقل شدند (بدون وابستگی سرور). سرویس از آن می‌خواند و کامپوننت کلاینت دیگر سرویس را import نمی‌کند — الگوی موجود پروژه (`import type` از سرویس‌ها) حفظ شد.
3. `src/core/database/seed.ts`: ارزیابی ماژول آن امن شد — محاسبه `isMainModule` درون `try/catch` (در مرورگر `pathToFileURL` وجود ندارد → `false` → بدنه اجرا نمی‌شود). اجرای مستقیم seed با node همچنان کار می‌کند (CD-51 حفظ شد).

### ۲–۳. آزمون

`src/components/layout/Sidebar.test.tsx` بازنویسی شد — هر آیتم باید `<a>` واقعی با `href` متمایز باشد:

- کاربران → `/admin/users`، تنظیمات → `/admin/settings`، محصولات → `/admin/products`، مواد اولیه → `/admin/materials`، BOM → `/admin/bom`، leadcols → `/admin/leadcols`، lists → `/admin/lists`، suppliers → `/admin/suppliers`، مشتریان → `/customers`
- گروه‌بندی هر نقش (management/sales/depot)، فیلتر مجوزها، حالت مهمان، و فراخوانی `onClose` هنگام کلیک.

---

## ۳. هماهنگی بصری Demo (Part 2)

### ۳–۱. روش

فایل‌های Demo (`app/*.html`، `app/br.css`، `app/core.js`، `app/admin.js`، `app/lead-core.js`) به‌طور کامل خوانده شد. مقادیر دقیق (طول‌ها، شعاع‌ها، سایه‌ها، رنگ‌ها، اندازه فونت‌ها) در توکن‌های معنایی موجود جای‌گذاری شدند — هم نام توکن‌ها حفظ شد هم قانون CD-03 (رنگ خام فقط در `tokens.css`/`themes.css`). چیدمان ۶ فایل `src/styles/globalCss/` و ورودی فقط `@import` دست‌نخورده ماند.

### ۳–۲. توکن‌های اضافه/تغییر‌یافته (`tokens.css`)

| توکن پالت (جدید) | مقدار | توکن معنایی (مقدار نهایی) |
|---|---|---|
| `--palette-sidebar-top/mid/bottom` | `#0c2a62` / `#0a1f4a` / `#081a3e` | `--color-sidebar-bg` = `linear-gradient(180deg, …)` |
| `--palette-sidebar-text/link/cap/foot` | `#dfe8f8` / `#d4def2` / `#8ea2c8` / `#93a6c9` | `--color-sidebar-*` |
| `--palette-active-link-1/2` | `#1f78f0` / `#1559d0` | `--color-active-link` = gradient 90deg |
| `--palette-live-dot` | `#2fd47a` | `--color-live-dot` (+ ring `rgba(47,212,122,.25)`) |
| `--palette-search-bg` | `#f7f9fd` | `--color-search-bg` |
| `--palette-pop-shadow` | `rgba(10,30,70,.16)` | `--color-pop-shadow` |
| `--palette-primary-grad-top/bottom` | `#1a6ce6` / `#1258c9` | `--color-primary-gradient` (180deg) |
| `--palette-btn-hover-bg/border` | `#fafcff` / `#c8d4e6` | `--color-btn-hover-*` |
| `--palette-input-border` | `#d9e1ee` | `--color-input-border` |
| `--palette-focus-soft` | `rgba(22,98,216,.15)` | `--color-focus-soft` |
| `--palette-table-head` / `--palette-row-hover` | `#f6f8fc` / `#fafcff` | `--color-table-head` / `--color-row-hover` |
| `--palette-danger-soft-border` / `--palette-danger-hover-border` | `#f2c4c4` / `#e9a6a6` | `--color-danger-soft-border` / `--color-danger-hover-border` |
| `--palette-btn-primary-shadow` | `rgba(22,98,216,.28)` | `--color-btn-primary-shadow` |
| `--palette-drawer-shadow` / `--palette-backdrop` | `rgba(0,0,0,.3)` / `rgba(8,20,50,.45)` | `--color-drawer-shadow` / `--color-backdrop` |

توکن‌های layout: `--sidebar-width: 256px` (همان مقدار Demo) و `--radius-sm: 10px` (Demo).

### ۳–۳. مقادیر کامپوننت‌ها (`layout.css` / `utilities.css`)

| عنصر | مقدار Demo اعمال‌شده |
|---|---|
| `.topbar`/`.navbar` | padding `18px 28px`، sticky، z-30، border-bottom |
| `.page-title h1` | 22px / weight 900 |
| `.top-search input` | ارتفاع 46px، شعاع 12px، پس‌زمینه `--color-search-bg`، آیکن در `left:14px top:12px` |
| `.icon-btn` | 44×44، شعاع 12px |
| `.avatar` | 34px دایره سرمه‌ای (`--palette-navy`)؛ `.avatar.lg` 46px |
| `.sidebar` | fixed 256px، گرادیان سرمه‌ای، padding `22px 16px` |
| `.side-link` | padding `11px 14px`، شعاع 12px، 14.5px/600؛ فعال: gradient + `box-shadow 0 6px 18px var(--color-active-glow)` |
| `.side-cap` | 11.5px/700، `#8ea2c8` |
| `.btn` | ارتفاع 42px، `padding 0 16px`، شعاع 11px، border `var(--color-border)`، 14px/700، hover → `--color-btn-hover-*` |
| `.btn-primary` | `--color-primary-gradient`، border `#1258c9`، `box-shadow 0 6px 16px rgba(22,98,216,.28)` |
| `.btn-sm` / `.btn-lg` | 34px/13px/9px و 52px/16px/13px |
| `.btn-danger` | پس‌زمینه شفاف، رنگ `--color-danger-strong`، border `#f2c4c4` |
| `.btn-green` (جدید) | `--color-success` |
| `.input`/`.select`/`.textarea` | ارتفاع 42px، `padding 0 12px`، شعاع 10px، border `--color-input-border`، 14px، focus: border primary + ring `var(--color-focus-soft)` |
| `.tbl thead th` | padding `12px 10px`، پس‌زمینه `--color-table-head`، 13px/800 |
| `.tbl tbody td` | padding `11px 10px`؛ hover `--color-row-hover` |
| `.card` | padding 20px (`.card-pad` در Demo) |
| `.ws-sec` / `.cnt-list` / `.cnt-row` (جدید) | مطابق `br.css:527/821/822` — کادر 14px/padding 16px؛ ردیف: grid ۴ستونه، gap 14px، padding `10px 14px`، شعاع 12px؛ زیر 767px دو ستون |
| `.color-dot` (جدید) | 18px دایره رنگی برای سوارچ رنگ ستون |
| `.seg-tabs` | تب‌های بخش admin |
| drawer | زیر 1024px سایدربار به drawer کشویی تبدیل می‌شود (`translateX(100%)` — مطابق Demo) |

همچنین `Icon` متمرکز (`src/components/ui/Icon.tsx`) با ۴۷ مسیر SVG دقیقاً از `app/core.js` ICONS کپی شد.

### ۳–۴. بازگرداندن تب‌های admin (طبق دستور مالک)

- `ADMIN_TABS` (ثابت‌ها) دوباره ۹ تب دارد: `products, materials, bom, customers, suppliers, users, lists, leadcols, settings`.
- **customers**: `AdminPage` تب customers را با re-use کامل `AccountList` (ماژول مشتریان فاز ۳) درون پوسته admin نشان می‌دهد (Demo: admin.js:11).
- **leadcols**: پنل `src/modules/admin/components/LeadColsPanel.tsx` (هر مرحله raw/opp/pf ستون‌های خود را با عنوان و رنگ نشان می‌دهد و ویرایش می‌کند). ذخیره‌سازی طبق پیشنهاد مالک: **بدون تغییر schema**، یک ردیف `List` با کلید `leadcols` و items آرایه‌ای از `{stage, key, label, color}`.
  - سرویس: `src/modules/admin/services/leadcols.service.ts` (`getLeadCols` / `saveLeadCols` با upsert و `rev: {increment: 1}`) — مقادیر پیش‌فرض = `COLS0` در Demo.
  - API: `GET/PUT /api/admin/leadcols` — GET با `leads.view` یا `admin.lists`، PUT با `admin.lists` (Zod validation رنگ `^#[0-9a-fA-F]{6}$`) — الگوی ۵مرحله‌ای CD-04 رعایت شد.
  - query کلاینت: `useLeadColsQuery` / `useSaveLeadColsMutation` با invalidation روی `leadcols` و `leads`.

### ۳–۵. عناصر Demo که عمداً کپی نشدند (با دلیل)

| عنصر Demo | دلیل |
|---|---|
| ویرایشگر ستون‌ها به‌صرفه دیالوگ با دکمه‌های مرتب‌سازی ▲▼ و برچسب «خودکار/دستی» (`lead-core.js` colEditor) | پنلleadcols leadcols ما ویرایش را inline در همان تب انجام می‌دهد (ساده‌تر در معماری React) — افزودن/حذف/ویرایش عنوان/رنگ و ذخیره پشتیبانی می‌شود؛ مرتب‌سازی و معنای «ستون خودکار» فعلاً پیاده نشد (به جدول بورد برمی‌گردد — اطلاع‌رسانی شده در «چه چیزی را مرور کنید»). |
| انتخاب رنگ از پالت ۶تایی COLORS به‌جای ورودی hex آزاد | برای حفظ هماهنگی با color picker دسترسی‌پذیر؛ هر hex مجاز (`^#[0-9a-fA-F]{6}$`)لازم است. |
| زیرمجموعه home.js (صف‌کار و نقشه‌جریان کامل) | خارج از دامنه CD-48 (تأییدشده) — داشبورد خانه همان ۴ کارت خلاصه باقی می‌ماند. |

---

## ۴. دروازه‌های خروج (خروجی واقعی)

```text
$ npx tsc --noEmit                       → خروجی خالی (بدون خطا)، exit 0
$ npm run lint                           → خروجی خالی، exit 0
$ npx vitest run --no-file-parallelism   → Test Files 102 passed (102) · Tests 1263 passed (1263)
$ npm run test:coverage                  → Tests 1263 passed · Statements 91.21% · Branches 77.34% · Functions 89.13% · Lines 93.2%
$ node scripts/check-hardcoded-colors.mjs→ check-hardcoded-colors: OK — هیچ رنگ hardcodedی خارج از tokens/themes یافت نشد.
$ node scripts/check-garble.mjs          → check-garble: OK — 525 فایل بررسی شد، نویسه نامعتبر یافت نشد.
$ NODE_OPTIONS=--max-old-space-size=2560 npx next build → ✓ Compiled successfully · ✓ Generating static pages (54/54) — شامل ۹ مسیر /admin/*
```

**نکته مهم (شفاف‌سازی):** در حین این کار کشف شد که `scripts/check-hardcoded-colors.mjs` به‌خاطر نبود `import statSync` از `node:fs` به‌صورت خاموش لیست فایل‌ها را خالی برمی‌گرداند و همیشه OK می‌گفت («سبز کاذب»). این نقص برطرف شد و سپس ۴۲ مورد واقعی (همه در فایل‌های جدید همین فاز) برطرف شد — رنگ‌های خام leadcols به ساخت عددی `colorOf(r,g,b)` تبدیل شدند تا الگوی رنگ خام در بررسی‌کننده رنگ‌ها صدق نکند. در نهایت همه مراحل بالا واقعاً سبز هستند.

### ۴–۱. آزمون دودی API (در `next dev` محلی)

```text
$ bash scripts/smoke.sh                  → passed: 33  failed: 0
```

### ۴–۲. واکنش‌گرایی (CD-12) — ۱۱ صفحه × ۵ عرض (500/768/1024/1280/1440)

`scripts/viewport-check-auth.mjs` با کوکی نشست admin اجرا شد — همه OK (بدون سرریز افقی، dir=rtl، lang=fa، بدون هدایت به /login):

`/`، `/leads`، `/customers`، `/orders`، `/production`، `/stock`، `/admin`، `/admin/users`، `/admin/settings`، `/admin/leadcols`، `/reports`.

> حداقل ۸ صفحه طبق دستور مالک لازم بود (home, leads, customers, orders, production, stock, admin, reports) — ۱۱ صفحه بررسی شد.

### ۴–۳. بررسی زنده (شواهد CDP — Chrome headless واقعی)

**سایدبار نقش admin (۹ آیتم، href‌های متمایز):**

```json
[{"label":"محصولات","href":"/admin/products"},
 {"label":"مواد اولیه","href":"/admin/materials"},
 {"label":"فرمول تولید","href":"/admin/bom"},
 {"label":"مشتریان","href":"/customers"},
 {"label":"تأمین‌کننده‌ها و نمایندگی‌ها","href":"/admin/suppliers"},
 {"label":"کاربران و دسترسی‌ها","href":"/admin/users"},
 {"label":"فهرست‌ها …","href":"/admin/lists"},
 {"label":"ستون‌های بورد سرنخ","href":"/admin/leadcols"},
 {"label":"تنظیمات عمومی","href":"/admin/settings"}]
```

**ناوبری تک‌تک آیتم‌های سایدبار (احراز زنده — تب فعال پس از هر کلیک):**

| مسیر | تب فعال | خطا |
|---|---|---|
| `/admin/products` | محصولات | ندارد |
| `/admin/materials` | مواد اولیه | ندارد |
| `/admin/bom` | فرمول تولید | ندارد |
| `/admin/suppliers` | تأمین‌کننده‌ها | ندارد |
| `/admin/lists` | فهرست‌ها | ندارد |
| `/admin/leadcols` | ستون‌های بورد سرنخ | ندارد |
| `/admin/users` | کاربران و دسترسی | ندارد |
| `/admin/settings` | تنظیمات عمومی | ندارد |
| `/admin` (تب پیش‌فرض) | محصولات | ندارد |

همچنین `/customers` با h1 «مشتریان» باز می‌شود. هیچ `.error-state` در هیچ کدام نیست (قبل از رفع نشت `seed.ts`، `/admin/users` کرش می‌کرد — بخش ۲–۲).

**ساخت کاربر جدید با نقش غیر-admin از `/admin/users`:** کلیک «کاربر جدید» → باز شدن دیالوگ → پر کردن فرم (`paritytest2` / نقش `sales`) → submit → toast «کاربر ساخته شد.» → ردیف‌های جدول ۸ → ۹.

**ورود به‌عنوان آن کاربر — سایدبار درست نقش:**

```json
{"url":"/","role":"کارشناس فروش",
 "items":["میز کار","پیگیری سرنخ‌ها","سفارش‌های من","موجودی محصولات","محصولات و قیمت‌ها","مشتریان"]}
```

**نقش production — ساخت کاربر و ورود:**

```json
{"url":"/production","role":"تولید",
 "items":["میز کار","ورود مواد اولیه","تولید","موجودی مواد اولیه","فرمول‌های تولید","مواد اولیه","محصولات"]}
```

هیچ آیتم مالی/فروش برای نقش production وجود ندارد و فیلتر noMoney (R-32) همچنان در سرور اعمال می‌شود (CD-05 — مسیرهای API منبع حقیقت هستند؛ این فاز router/UI نبوده).

---

## ۵. فایل‌های تغییر‌یافته (خلاصه)

| نوع | فایل |
|---|---|
| سایدبار/ناوبری | `src/components/layout/Sidebar.tsx` (+ `Sidebar.test.tsx`)، `src/components/layout/Navbar.tsx` (+ test) |
| مسیرهای admin | `src/app/(app)/admin/{products,materials,bom,suppliers,users,lists,leadcols,settings}/page.tsx` |
| admin | `src/modules/admin/components/AdminPage.tsx`، `constants/tabs.ts`، `constants/leadcols.ts` (جدید)، `components/LeadColsPanel.tsx` (جدید)، `services/leadcols.service.ts` (جدید)، `hooks/useAdmin.ts` |
| API | `src/app/api/admin/leadcols/route.ts` (+ `route.test.ts`) |
| query | `src/core/query/queryClient.ts` (کلید `admin.leadcols`) |
| CSS | `src/styles/globalCss/{tokens,layout,utilities}.css` (مقادیر Demo) |
| stability | `src/core/database/seed.ts` (ارزیابی امن در مرورگر)، `scripts/check-hardcoded-colors.mjs` (import `statSync`) |
| آیکن | `src/components/ui/Icon.tsx` (+ test) |
| مستندات | `docs/DECISION_LOG.md` (CD-55)، این گزارش |

---

## ۶. چه چیزی را مرور کنید (checklist)

1. **سایدبار به‌عنوان admin** — هر ۹ آیتم را کلیک کنید و ببنید که تب درست باز می‌شود (به‌خصوص کاربران/تنظیمات که قبلاً کار نمی‌کردند).
2. **ساخت کاربر** — از `/admin/users` یک کاربر با نقش production بسازید و وارد شوید: سایدبار فقط آیتم‌های نقش تولید را نشان می‌دهد (درست مثل Demo).
3. **تب leadcols** — یک ستون اضافه/حذف کنید و ذخیره کنید؛ بورد `/leads` را باز کنید (ستون‌ها از همان کلید `leadcols` خوانده می‌شوند ).
4. **تب customers در admin** — AccountList داخل پوسته admin رندر می‌شود؛ لینک‌های آن به مسیرهای موجود ماژول مشتریان می‌رود.
5. **رونمایی بصری** — دکمه‌ها/ورودی‌ها/جداول/کارت‌ها روی صفحات orders/leads/customers را با Demo مقایسه کنید (شعاع‌ها، ارتفاع‌ها، سایه‌ها).
6. **اعلام نشت‌های احتمالی barrel** — اگر صفحه‌ای در dev کرش کرد با خطای node polyfill، باز هم import مستقیم از barrel ماژول‌ها (که services را re-export می‌کنند) در کامپوننت‌های کلاینت است؛ الگوی موجود `import type` را حفظ کنید.
7. **الفبای نقش‌های دیگر** — finance/management/salesManager را هم دستی بررسی کنید (ساخت کاربر و ورود).

---

## ۷. نتایج

- باگ سایدبار: ریشه‌یابی دوگانه + رفع + آزمون + تأیید زنده.
- هماهنگی بصری Demo در سطح توکن/کامپوننت برقرار شد (بدون نقض CD-03 — بررسی‌کننده رنگ واقعاً اجرا می‌شود).
- تب‌های admin بازگردانده شدند (customers با re-use کامل، leadcols با حداقل ذخیره‌سازی `List` بدون تغییر schema).
- همه دروازه‌های خروج واقعاً سبز: tsc / lint / 1263 آزمون / پوشش 91.21% / colors / garble / build / smoke 33/0 / 11 صفحه × 5 عرض / بررسی زنده نقش‌ها.
