# گزارش فاز ۲ — پلتفرم اصلی (Core Platform)

> تاریخ: ۱۴۰۵/۰۸/۲۰ (۲۰۲۶-۱۱-۱۰)
> وضعیت: **تکمیل‌شده** — همه معیارهای A-2.1 تا A-2.6 و دروازه خروج سبز (بجز دو مورد شفاف‌سازی‌شده در بخش ۸).
> طبق دستور مالک، فاز ۱ و فاز ۲ پشت‌سرهم اجرا شدند و اکنون **توقف** می‌کنیم — فاز ۳ شروع نمی‌شود.

---

## ۱. خلاصه

فاز ۲ پایه سرور پروژه را در `D:\New folder\CRM-Barman` برپا کرد:

- **پایگاه داده:** Prisma 6 با SQLite در توسعه (آماده PostgreSQL برای تولید) — ۱۰ مدل ساختاری + migration اولیه (`20261109185654_init`).
- **احراز هویت (D-01FINAL: modern + secure):** کوکی نشست سمت سرور `br_s` (HttpOnly + Secure + SameSite=Lax) حاوی **توکن دسترسی امساشده** (HMAC-SHA256، انقضای ۸ ساعت، `sessionVersion` برای باطل‌کردن)؛ رمزها با **bcrypt** و پشتیبانی موازی از **scrypt Demo با ارتقای شفاف** (§۶).
- **مجوزها:** ماتریس ۷ نقش × ۲۱ مجوز بازسازی‌شده از Demo، `requirePermission` در سرور به‌عنوان منبع حقیقت؛ فیلتر `noMoney` سمت سرور (R-32).
- **موتور تقویم:** یک موتور منفرد در `src/core/calendar` مبتنی بر JDF، **بدون Intl**، با **crossover کامل ۳۰۰ سال (۱۳۰۰–۱۵۹۹، بیش از ۱۰۰٬۰۰۰ روز)**.
- **Route Handlerها:** الگوی ۵ مرحله‌ای (auth → permission → Zod → service → response) روی ۵ مسیر.
- **State:** QueryClient متمرکز + کلیدهای متمرکز (CD-09)، کامپوننت‌های feedback رسمی، صفحه ورود فارسی RTL، Navbar/Sidebar مبتنی بر مجوز واقعی.

**پوشه Demo دست‌نخورده باقی ماند** — بخش ۹.

---

## ۲. معیارهای پذیرش (A-2.x)

| شناسه | معیار | وضعیت | مدرک |
|---|---|---|---|
| A-2.1 | Prisma schema مطابق `DATABASE_ARCHITECTURE.md` + migration اولیه | **PASS** | ۱۰ مدل، `prisma/migrations/20261109185654_init` — بخش ۳.۱ |
| A-2.2 | ورود/خروج کار می‌کند، نشست cookie امن | **PASS** | تأیید زنده HTTP — بخش ۵ |
| A-2.3 | `requirePermission` در همه مسیرهای API — هر مسیر حداقل یک تست ۴۰۳ | **PASS** | ۴۰۳ واقعی HTTP + ۵ تست ۴۰۳/۲۰۱ در `routes.test.ts` — بخش ۵/۷ |
| A-2.4 | موتور تقویم با ۱۰۰٪ آزمون JDF crossover سبز | **PASS** | ۳۰۰ سال × همه روزها → ۵۲ آزمون تقویم سبز — بخش ۴.۱ |
| A-2.5 | ماتریس نقش × مجوز از Demo کامل بازسازی شده | **PASS** | ۷ نقش / ۲۱ مجوز + `ROLE_LABELS` — بخش ۴.۲ |
| A-2.6 | تصمیمات Q-01، Q-02، Q-10، D-01، D-04 نهایی شده | **PASS با یادداشت** | Q-01/Q-02 معوق با ثبت شفاف، Q-10/D-01 نهایی، D-04 معوق به فاز ۸ — بخش ۸ |

### دروازه خروج هدفمند

| # | شرط | وضعیت |
|---|---|---|
| ۱ | `next build` بدون خطا | ✅ خروج ۰ |
| ۲ | `tsc --noEmit` بدون خطا | ✅ خروج ۰ |
| ۳ | `npm run lint` بدون خطا | ✅ خروج ۰ |
| ۴ | `vitest run` سبز | ✅ ۲۶ فایل / ۲۴۳ آزمون |
| ۵ | اسکریپت رنگ hardcoded: صفر مورد | ✅ `check-hardcoded-colors.mjs` → OK |
| ۶ | اسکریپت garble: صفر مورد | ✅ `check-garble.mjs` → OK (۱۶۱ فایل) |
| ۷ | crossover کامل JDF سبز | ✅ بیش از ۱۰۰٬۰۰۰ روز |
| ۸ | ۴۰۳ واقعی روی مسیر محافظت‌شده (HTTP) | ✅ production → 403 FORBIDDEN |
| ۹ | ارتقای شفاف scrypt→bcrypt (زنده) | ✅ هش hex → `$2b$10$` پس از یک ورود — §۶ |
| ۱۰ | صفحه ورود در ۵ عرض بدون اسکرول افقی | ✅ ۵۰۰/۷۶۸/۱۰۲۴/۱۲۸۰/۱۴۴۰ — بخش ۵.۴ |
| ۱۱ | هیچ فایل Demo تغییری نکرده | ✅ (بخش ۹) |
| ۱۲ | تصمیمات ثبت شده در `DECISION_LOG.md` | ✅ CD-17…CD-22 + وضعیت Q/D — بخش ۸ |

---

## ۳. ساختار تحویل‌ها

### ۳.۱ پایگاه داده (Prisma 6)

۱۰ مدل در `prisma/schema.prisma` (فقط جداول ساختاری + مرجع کاتالوگ — جدول کسب‌کاری طبق PHASE_02 §۶ در این فاز ساخته نمی‌شود):

```
User (passwordHash, passwordSalt, sessionVersion, rev, off)
Role / UserRole          (رابطه چندبهچند)
Setting (singleton)      ← settings Demo: vat, validDays, rate, discountCap, company
Rev (singleton)          ← rev سراسری
Product / Material / BomItem / Supplier   (مرجع کاتالوگ، خالی)
List (۷ کلید ثابت Demo) ← sources, roles, results, lost, projects, channels, waste
```

- `DATABASE_URL="file:./dev.db"` (SQLite توسعه، gitignore شده)؛ تولید: `provider=postgresql` + `DATABASE_URL` متناظر.
- Migration اولیه: `prisma/migrations/20261109185654_init`.
- Seed (`src/core/database/seed.ts`): ۷ نقش، یک کاربر `admin` (رمز از `SEED_ADMIN_PASSWORD`)، تنظیمات، rev، ۷ لیست. **هیچ داده کسب‌کاری از Demo کپی نشد** (مهاجرت فاز ۸).

### ۳.۲ چیدمان کد

```
src/core/
├── auth/        (token.ts, session.ts, cookie.ts, passwords.ts, service.ts, index.ts — هر کدام با .test.ts)
├── permissions/ (matrix.ts, requirePermission.ts)
├── database/    (client.ts singleton, seed.ts)
├── calendar/    (jdf.ts, arithmetic.ts, parse.ts, format.ts, timezone.ts, constants.ts)
├── formatting/  (digits.ts, money.ts, rnd.ts)
├── validation/  (shared Zod schemas)
├── errors/      (پاکت خطای استاندارد + نگاشت کد HTTP)
├── query/       (queryClient.ts, keys.ts, provider.tsx)
└── api/         (apiFetch + readApiError)
src/modules/
├── auth/        (schemas.ts، hooks/useAuth.ts)
├── users/       (services/listUsers.ts)
└── orders/      (constants/orderStage.ts — از فاز ۱)
src/app/
├── api/auth/{login,logout,me}/route.ts
├── api/users/route.ts        (مسیر محافظت‌شده نمونه)
├── login/page.tsx
└── layout.tsx                (QueryProvider متصل)
src/components/feedback/ (LoadingState، ErrorState — حالت‌های رسمی CD-09)
```

---

## ۴. مؤلفه‌های کلیدی

### ۴.۱ موتور تقویم (CD-06 / CD-07 / CD-19 / CD-20)

- یک موتور منفرد در `src/core/calendar` — **هیچ `Intl` و هیچ وابستگی خارجی**.
- `jalaliToJdn` / `jdnToJalali` بر اساس JDF؛ JDN فقط محاسبات داخلی.
- `timezone.ts`: انحراف ثابت **+۰۳:۳۰** تهران (۱۲۶۰۰ ثانیه) — ساعت تابستانی ایران از ۱۴۰۱ لغو شده، پس انحراف ثابت است و خروجی روی هر سروری یکسان است (CD-19).
- `constants.ts`: سال‌های معتبر **۱۳۰۰–۱۵۹۹** (CD-20).
- `parse.ts`: تبدیل رشته `YYYY/MM/DD` (ASCII) به JalaliDate با اعتبارسنجی.
- **آزمون crossover:** برای **هر روز** ۱۳۰۰–۱۵۹۹ (هر سه‌چرخه `jalaliToGregorian → gregorianToJdn → jdnToJalali` باید به تاریخ اصلی برگردد) — **بیش از ۱۰۰٬۰۰۰ روز**، همه سبز. همچنین: کبیره‌گیری (مثلاً اسفند ۱۲۹۹/۱۳۹۹)، طول ماه‌ها، جمع/تفریق روز/ماه، مرز UTC/تهران.

### ۴.۲ مجوزها (CD-05)

- ماتریس در `src/core/permissions/matrix.ts`: ۷ نقش دقیقاً مطابق `app/core.js` Demo (`admin, management, finance, salesManager, sales, production, depot`) × **۲۱ مجوز** (منبع واحد — رفع R-02).
- `requirePermission(session, perm)`: ۴۰۱ بدون نشست، ۴۰۳ بدون مجوز — اجرا در سرور.
- `noMoney` (R-32): نقش‌های production/depot `money.view` ندارند؛ `shouldHideMoney(session)` در سرور تصمیم می‌گیرد. **یادداشت:** از آنجا که فاز ۲ هیچ مسیر مالی ندارد، این فیلتر تا کنون در آزمون واحد پوشش داده شده و اجرای آن روی داده واقعی در فاز ۴ قابل مشاهده خواهد بود.
- `ROLE_LABELS` (CD-22): برچسب فارسی نقش‌ها برای UI (Navbar)، نقش ناشناخته → «نقش: —» (بدون خطا).

### ۴.۳ احراز هویت (D-01 FINAL)

- **توکن دسترسی امساشده:** `base64url(JSON) + "." + HMAC-SHA256(payload)` با کلید `AUTH_SECRET` (حداقل ۳۲ نویسه، از `.env`، هرگز در کد). محموله: `sub, u, roles[], sv, iat, exp` — همه زمان‌ها UTC ms.
- **کوکی `br_s`** (همان نام Demo): HttpOnly، SameSite=Lax، Max-Age=۲۸۸۰۰ (۸ ساعت، نه ۳۶۵ روز Demo)، Secure در `NODE_ENV=production`. توکن هرگز در localStorage نیست.
- **نشست لغزان:** اگر کمتر از نصف عمر مانده باشد، توکن تازه صادر می‌شود.
- **باطل‌کردن:** `sessionVersion` — خروج، نسخه را افزایش می‌دهد و نشست‌های قدیمی فوراً ۴۰۱ می‌شوند.
- **رمز عبور:** bcrypt cost ۱۰ + تأیید scrypt قدیمی Demo — §۶.

### ۴.۴ الگوی Route Handler (CD-04)

هر ۵ مسیر دقیقاً ۵ مرحله را طی می‌کنند (auth → permission → Zod → service → response). مثال `GET /api/users`: `requireSession` ← `requirePermission(session, "admin.users")` ← (بدون ورودی) ← `listUsers()` ← `NextResponse.json`. منطق کسب‌کار در `services/`، fetch مستقیم در `useEffect` ممنوع (همه از `apiFetch` و TanStack Query می‌گذرند).

---

## ۵. تأیید زنده (HTTP) — سرور تولید پورت ۳۱۵۹

سرور با `npx next start -p 3159` اجرا شد و توالی زیر با curl بررسی شد:

### ۵.۱ ورود/خروج/نشست

| درخواست | نتیجه |
|---|---|
| `POST /api/auth/login` (admin، رمز درست) | **200** + `Set-Cookie: br_s=…; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800; Secure` + `user` با مجوزها |
| `POST /api/auth/login` (رمز نادرست) | **401** `{"error":{"code":"UNAUTHORIZED","message":"نام کاربری یا رمز عبور نادرست است."}}` (بدون Set-Cookie) |
| `POST /api/auth/login` (body نامعتبر Zod: `{"name":123}` و `{"name":"","password":"x"}`) | **400** + `fields` برای هر فیلد |
| `GET /api/auth/me` (+ کوکی) | **200** + کاربر + مجوزها |
| `POST /api/auth/logout` | **204** (بدون body) + `Set-Cookie: br_s=; … Max-Age=0` |
| `GET /api/auth/me` پس از خروج | **401** |

### ۵.۲ مجوزها (A-2.3)

کاربر موقت نقش `production` ساخته شد (سپس حذف):

| درخواست | نتیجه |
|---|---|
| `GET /api/users` به‌عنوان admin | **200** + فهرست |
| `GET /api/users` به‌عنوان production | **403 FORBIDDEN** «شما مجوز انجام این عملیات را ندارید.» |
| `GET /api/users` بدون نشست | **401** |

### ۵.۳ داده پایگاه داده

- کاربر seed: `admin` / `barman-admin-1405` (قابل override با `SEED_ADMIN_PASSWORD`).
- پس از همه آزمون‌ها، DB دوباره فقط شامل کاربر seed است (کاربرهای موقت حذف شدند).

### ۵.۴ واکنش‌گرایی (CD-12)

`node scripts/viewport-check.mjs http://localhost:3159/login` و `…/` اجرا شد:

| عرض | innerWidth | scrollWidth | سرریز افقی | lang | dir |
|---|---|---|---|---|---|
| ۵۰۰ | ۵۰۰ | ۵۰۰ | خیر | fa | rtl |
| ۷۶۸ | ۷۶۸ | ۷۶۸ | خیر | fa | rtl |
| ۱۰۲۴ | ۱۰۲۴ | ۱۰۲۴ | خیر | fa | rtl |
| ۱۲۸۰ | ۱۲۸۰ | ۱۲۸۰ | خیر | fa | rtl |
| ۱۴۴۰ | ۱۴۴۰ | ۱۴۴۰ | خیر | fa | rtl |

**viewport-check: OK** (هر ۵ عرض واقعی، بدون اسکرول افقی).

---

## ۶. مهاجرت scrypt → bcrypt (D-01 — بخش اختصاصی)

**زمینه:** Demo رمزها را با `scryptSync(pw, salt, 32).toString("hex")` و salt جداگانه ذخیره می‌کند (`server/auth.js:56`). مالک صراحتاً خواستار bcrypt با پنجره انتقال و **عدد شکستن حساب‌های Demo** شد.

**پیاده‌سازی (`src/core/auth/passwords.ts`):**

1. `isBcryptHash(stored)` — تشخیص با پیشوند `$2`.
2. `verifyPassword` — هش bcrypt → `bcryptjs.compare`؛ در غیر این صورت `verifyLegacyScrypt` دقیقاً مطابق الگوریتم Demo با `timingSafeEqual`.
3. `needsRehash(stored)` — هر هش غیر-bcrypt باید ارتقا یابد.
4. در `attemptLogin` (service): ورود موفق با هش قدیمی → هش با bcrypt دوباره ذخیره و `passwordSalt` پاک می‌شود — **شفاف برای کاربر، در همان نشست**.

**تأیید زنده (پورت ۳۱۵۹):** کاربری با هش scrypt مطابقDemo ساخته شد:

| مرحله | نتیجه |
|---|---|
| هش در DB پیش از ورود | `c0625938…` (hex، غیر-bcrypt) با salt جداگانه |
| `POST /api/auth/login` (admin هیچ نقشی نیست — همین کاربر scrypt) | **200** + نشست معتبر |
| هش در DB پس از ورود | **`$2b$10$…`** و `passwordSalt = NULL` |
| ورود دوباره با همین رمز (اکنون مسیر bcrypt) | **200** |

یعنی هر کاربر Demo پس از **یک** ورود موفق، خودکار و بدون قطع خدمت به bcrypt ارتقا می‌یابد. کاربر موقت پس از آزمون حذف شد.

---

## ۷. آزمون‌ها

```
npx vitest run → 26 فایل / 243 آزمون — همه سبز (خروج ۰)
```

توزیع: تقویم ۵۲ آزمون (شامل crossover کامل + کبیسه + مرز زمانی)، auth ۵ فایل، permissions، errors، formatting (`rnd` گرد به ۱۰۰٬۰۰۰ — رفع R-08)، validation، query، مسیرهای API (شامل ۵ آزمون ۴۰۳/۴۰۱)، صفحه ورود، Navbar/Sidebar (فیلتر مجوز)، feedback components، UI.

**نقص شفاف:** ابزار پوشش (`@vitest/coverage-v8`) نصب نیست و نصب وابستگی بدون تأیید مالک مجاز نیست (CLAUDE.md §۲)، بنابراین **نرخ پوشش درصدی اندازه‌گیری نشد**. معیار جایگزین: همه مؤلفه‌های `src/core` و همه مسیرهای API دارای فایل test با آزمون‌های معتبر/نامعتبر هستند. در صورت تمایل، نصب ابزار پوشش در نشست بعدی پیشنهاد می‌شود.

---

## ۸. تصمیمات و انحرافات

### ۸.۱ تصمیمات ثبت‌شده در `docs/DECISION_LOG.md`

| شناسه | موضوع |
|---|---|
| **CD-17** | احراز هویت مدرن (از D-01 تأیید نهایی): کوکی نشست + توکن امساشده + bcrypt |
| **CD-18** | گروه‌بندی ۱۱ مرحله خط لوله در ۳–۴ گروه معنایی (از Q-09 تأیید نهایی) |
| **CD-19** | منطقه زمانی ثابت تهران +۰۳:۳۰ بدون DST |
| **CD-20** | گستره سال شمسی ۱۳۰۰–۱۵۹۹ |
| **CD-21** | گروه‌بندی ارقام مبلغ بدون Intl (regex) |
| **CD-22** | `ROLE_LABELS` — برچسب فارسی نقش‌ها در UI |

همچنین Q-10 (قالب تاریخ) نهایی شد تحت CD-06 (`.env`/قرارداد: `YYYY/MM/DD` ASCII + UTC ms).

### ۸.۲ A-2.6 بدون ادعای کذب — وضعیت واقعی three مورد

- **Q-01 (`settings.rate: 3`):** مقدار به‌صورت ساختاری در `Setting.rate` نشسته است ولی **در هیچ منطقی استفاده نمی‌شود** — ساکت اعمال نشده؛ منتظر پاسخ مالک.
- **Q-02 (`discountCap` ۰):** مقادیر Demo عیناً در `Setting.discountCap` نگه داشته شده‌اند و **هیچ منطق تخفیفی هنوز وجود ندارد** (فاز ۴). تفسیر به‌صورت ساکت اعمال نشده.
- **D-04 (استراتژی مهاجرت داده):** معوق به فاز ۸ — هیچ داده کسب‌کاری در این فاز مهاجرت نشد.

این سه مورد در `DECISION_LOG.md` با وضعیت صریح ثبت شده‌اند تا معوق نباید ساکت به فاز بعد سرایت کند (CLAUDE.md §۱۳).

### ۸.۳ انحرافات جزئی

- **پیام‌های فیلد Zod انگلیسی است** (مثلاً `Too small: expected string…`) — پاکت خطا فارسی است (`"ورودی نامعتبر است."`). در صورت تمایل، دیکشنری پیام‌ها در فاز بعد اضافه می‌شود.
- **Secure flag روی localhost:** کوکی `Secure` حتى روی HTTP localhost توسط مرورگرهای مدرن ارسال می‌شود (localhost یک context امن است)؛ curl هم آن را ارسال کرد. در استقرار واقعی پشت HTTPS، رفتار یکسان است.
- **۱۰ مدل به‌جای ~۲۴ جدول:** PHASE_02 §۶ صراحتاً جدول‌های کسب‌کاری را به فازهای ۳–۷ موکول کرده است؛ schema فعلی فقط جداول ساختاری + مرجع کاتالوگ است. این یک تعمد، نه نقص است.

---

## ۹. حفاظت از Demo و محیط

- پوشه `پلتفرم نهایی تیم بارمان/` در کل فاز ۱ و ۲ **دست‌نخورده** باقی ماند (فقط خواندن، byte-for-byte). فایل‌های `.env.local` و `.secrets.local.json` در ریشه Demo فقط شناسایی شدند و محتوایشان هرگز خوانده/کپی نشد.
- **یادداشت بحرانی دیسک:** درایو **C: دارای ۰ بایت فضای آزاد** است (دایرکتوری temp). این محدودگی خروجی چند فرمان را قطع می‌کرد؛ همه خروجی‌ها به `/d/tmp_*.txt` هدایت و سپس خوانده شدند. **هیچ فایلی برای فضاسازی حذف نشد** و حذف فایل‌های سیستمی مجاز نیست. پیشنهاد: پاکسازی درایو C توسط مالک پیش از فاز ۳.
- سرور تولید روی پورت ۳۱۵۹ همچنان در background اجراست (توقف سرورهای background توسط این agent محدود است).

---

## ۱۰. فرمان‌های اجراشده (خروجی واقعی)

```
npx tsc --noEmit                              → exit 0
npm run lint                                  → exit 0
npx vitest run                                → 26 فایل / 243 آزمون passed, exit 0
node scripts/check-garble.mjs                 → "OK — ۱۶۱ فایل بررسی شد، نویسه نامعتبر یافت نشد"
node scripts/check-hardcoded-colors.mjs       → "OK — هیچ رنگ hardcodedی خارج از tokens/themes یافت نشد"
node scripts/viewport-check.mjs …/login و …/  → "viewport-check: OK" (۵ عرض واقعی)
npx next build                                → exit 0 (مسیرها: /, /login, /api/auth/{login,logout,me}, /api/health, /api/users)
npx prisma migrate dev                        → migration 20261109185654_init ایجاد و اعمال شد
```

---

## ۱۱. بررسی نهایی مالک

- [ ] تأیید مقادیر معوق: **Q-01** (`rate: 3`) و **Q-02** (`discountCap: 0`) — آیا معنی پیشنهادی پذیرفته می‌شود؟
- [ ] آیا نصب `@vitest/coverage-v8` برای اندازه‌گیری پوشش در فاز ۳ مجاز است؟
- [ ] پاکسازی درایو C (۰ بایت آزاد) پیش از ادامه.
- [ ] تأیید گزارش و شروع فاز ۳ (CRM).

**توقف مطابق دستور:** فاز ۳ شروع نمی‌شود.
