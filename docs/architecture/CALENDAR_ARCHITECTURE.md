# CALENDAR_ARCHITECTURE — معماری موتور تقویم خورشیدی جلالی

> طرح (فاز صفر). طبق سند راهرسی: «برنامه جدید باید یک موتور متمرکز تقویم خورشیدی داشته باشد».

## ۱. وضع موجود (Demo)

See `docs/knowledge/DATE_AND_CALENDAR_POLICY.md`.

| جنبه | Demo | مشکل |
|---|---|---|
| الگوریتم | JDF (تبدیل JDN ↔ جلالی) در `app/core.js` | باقی‌مانده‌شده، درست |
| فرمت‌سازی | `Intl.DateTimeFormat("fa-IR-u-ca-persian(-nu-latn)")` با timeZone `Asia/Tehran` | وابسته به ICU (R-16) |
| نمای نمایش | `X.fa()` (فارسی)، `X.readDate` (datepicker) | پراکنده |
| ذخیره‌سازی | **دو قالب**: رشته Jalali `YYYY/MM/DD` (orders.sentAt، jobs.start/end، سررسید چک) **و** epoch ms (created، updated، moves.t، next.t، hist[].t) | **R-07 بحرانی** |
| bucketing ماه | `String(t).slice(0,7)` روی رشته Jalali | فقط در صورتی درست باشد که تاریخ رشته‌ای باشد — R-11 |
| خروجی | `jDate()` و `stamp()` در `server/export.js` | منطق تکراری |

## ۲. طرح هدف — موتور متمرکز

### ۲.۱ محل

```
src/core/calendar/
├── jdf.ts         — الگوریتم JDN ↔ (year, month, day) جلالی (بدون وابستگی به Intl)
├── format.ts      — قالب‌سازی: فارسی/لاتین، فقط‌تاریخ/زمان
├── parse.ts       — تجزیه `YYYY/MM/DD` (با ارقام فارسی یا لاتین)
├── arithmetic.ts  — جمع/تفاضل روز، ماه، سال؛ شروع/پایان ماه
├── timezone.ts    — تبدیل epoch ↔ تاریخ جلالی با Asia/Tehran
├── constants.ts   — نام ماه‌ها، روزهای هفته، طول ماه‌ها
└── index.ts       — API عمومی
```

### ۲.۲ سیاست قالب‌ها (از `DATE_AND_CALENDAR_POLICY.md`)

| نوع داده | قالب ذخیره | مثال |
|---|---|---|
| تاریخ (date-only) | رشته `YYYY/MM/DD` با **ارقام ASCII** | `1404/08/17` |
| لحظه (instant) | UTC timestamp (bigint/int) در DB | `1726250400000` |
| نمایش تاریخ در UI | ارقام فارسی | `۱۴۰۴/۰۸/۱۷` |
| JDN | **فقط نمایش داخلی محاسبات** — هرگز در API/DB | `2460915` |

قوانین:
۱. API contract‌ها تاریخ date-only را به‌صورت رشته `YYYY/MM/DD` با ارقام ASCII جابه‌جا می‌کنند.
۲. UI فقط از طریق `core/formatting` ارقام فارسی نمایش می‌دهد.
۳. تبدیل تاریخ date-only ↔ epoch ممنوع است (یکپارچگی نوع حفظ می‌شود) — مگر از طریق `core/calendar` با نیمه‌روز مرجع Asia/Tehran.

### ۲.۳ وابستگی به Intl

- موتور اصلی **JDF خالص** است — به Intl وابسته نیست.
- `Intl` فقط برای **ترجمه نام ماه‌ها** در صورت ساده‌تر بودن استفاده می‌شود، با fallback به `constants.ts`.
- این طراحی پاسخ به R-16 (در دسترس بودن ICU).

### ۲.۴ توابع کلیدی (API عمومی)

| تابع | امضا | هدف |
|---|---|---|
| `toJalali(jdn)` | `(n) → {y, m, d}` | تبدیل JDN به جلالی |
| `toJdn(y, m, d)` | `(n,n,n) → number` | تبدیل جلالی به JDN |
| `isLeap(y)` | `(n) → boolean` | سال کبیسه |
| `daysInMonth(y, m)` | `(n,n) → number` | طول ماه |
| `formatJalali(y,m,d, opts)` | → string | نمایش با ارقام فارسی/لاتین |
| `parseJalali(str)` | `(s) → {y,m,d}` | تجزیه `YYYY/MM/DD` |
| `addDays/addMonths/addYears` | محاسبات تاریخ |
| `startOfMonth/endOfMonth` | bucketing گزارش (Q-12) |
| `epochToJalali(ms)` | تبدیل instant به تاریخ جلالی (Asia/Tehran) |

### ۲.۵ Migration از منطق Demo

| Demo | `src/core/calendar` |
|---|---|
| `X.fa(t)` | `formatJalali` |
| `X.dateIn(str)` | `parseJalali` |
| `X.addJMonths(d, n)` | `addMonths` |
| `X.DAY(S)` | `constants.ts` |
| `X.readDate` | کامپوننت `DatePicker` با تقویم جلالی |
| `jDate(t)` در export.js | `formatJalali` (با جزئیات زمان) |

### ۲.۶ آزمون‌ها (See `TESTING_STRATEGY.md`)

- الگوریتم JDF در برابر ۱۰۰ سال (۱۳۰۰–۱۴۰۰ + ۱۴۰۰–۱۵۰۰) با مرجع `Intl` متقاطع می‌شود.
- **آزمون سال‌های کبیسه** و مرزهای ماه (به‌خصوص اسفند ۲۹/۳۰ روزه).
- مرز UTC/Tehran (نیمه‌شب رسمی ایران).
- parse → format چرخه یکتایی.
