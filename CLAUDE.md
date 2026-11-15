# CLAUDE.md — BARMAN CRM (source of truth)

> این فایل قوانین پروژه را برای هر نشست کاری تعریف می‌کند. همه agentها باید این فایل را قبل از هر کاری بخوانند.
> زبان مستندات: فارسی. زبان کد و شناسه‌ها: انگلیسی.

---

## ۱. ریشه پروژه و حفاظت از Demo

- **تنها ریشه معتبر:** `D:\New folder\CRM-Barman`.
- پوشه `پلتفرم نهایی تیم بارمان/` (برنامه Demo) **فقط‌خواندنی** است: تغییر، حذف، تغییر نام، بازنویسی و انتقال فایل‌های آن **ممنوع** است.
- هیچ فایل پروژه‌ای نباید درون پوشه Demo نوشته شود.
- فایل‌های `.env.local` و `.secrets.local.json` در ریشه Demo وجود دارند — **فقط وجود آن‌ها گزارش می‌شود؛ محتوایشان هرگز فاش یا کپی نمی‌شود.**

## ۲. مرزهای مجوز فازها

- کار فعلی مجاز است فقط در چارچوب فازی باشد که مالک **به‌صورت صریح** تأیید کرده است.
- ممنوعات در هر فاز (مگر تأیید صریح مالک):
  - نصب، به‌روزرسانی یا حذف وابستگی‌ها؛
  - ایجاد یا تغییر Schema پایگاه داده و migrationها؛
  - تغییر پیکربندی برنامه موجود؛
  - شروع فاز بعدی بدون تأیید.
- هر فاز با گزارش `docs/reports/PHASE_<NN>_REPORT.md` بسته می‌شود و دروازه خروج هدفمند آن باید تکمیل شود.

## ۳. قوانین یک‌نفرگی

- **فقط یک Agent.** ایجاد، فراخوانی یا واگذاری کار به subagent **ممنوع** است.

## ۴. مجموعه‌تکنولوژی (CD-01)

- Next.js App Router + React + TypeScript **strict**
- Tailwind CSS
- Prisma **6** — PostgreSQL (تولید) / SQLite (توسعه و تست)
- TanStack React Query **v5**
- Zod — vitest — Playwright (حداقل)

## ۵. چیدمان پوشه‌ها (CD-02)

```
src/modules/<module>/{components,hooks,lib,services,types,schemas,constants,queries,index.ts}
src/core/{auth,permissions,database,api,calendar,query,validation,errors,formatting,localization,logging,utils}
src/components/{ui,shared,layout,feedback}
src/styles/globalCss/{tokens,themes,typography,layout,utilities,index}.css
src/app/globals.css   ← فقط @import، بدون style مستقیم
```

## ۶. الگوی Route Handlerها (CD-04)

هر Route Handler نازک است و دقیفاً این ۵ مرحله را به ترتیب طی می‌کند:

1. **auth** — نشست کاربر از کوکی سرور خوانده می‌شود.
2. **permission** — `requirePermission` در سرور (منبع حقیقت). پنهان‌سازی دکمه در UI مجوز نیست.
3. **Zod** — اعتبارسنجی ورودی (query، body، params).
4. **service** — منطق کسب‌کار در `services/`، نه در Route Handler.
5. **response** — پاکت خطای استاندارد + کد وضعیت مناسب.

ممنوع: منطق کسب‌کار در کامپوننت، fetch مستقیم در `useEffect`، دور زدن لایه service.

## ۷. CSS و تم (CD-03 / CD-16)

- رنگ‌ها فقط از توکن معنایی (مثلاً `var(--color-success)`). **رنگ hardcoded ممنوع** و با اسکریپت خودکار بررسی می‌شود.
- `src/app/globals.css` فقط `@import` دارد.
- CSS از نو نوشته می‌شود؛ کپی/مهاجرت CSS از Demo ممنوع (۶۷٪ مرده — R-17).

## ۸. تاریخ و تقویم (CD-06 / CD-07)

- تاریخ محض در ذخیره‌سازی و قراردادها: `YYYY/MM/DD` با ارقام ASCII.
- نمایش در UI: فارسی با ارقام فارسی.
- لحظه (timestamp): UTC ms.
- JDN فقط نمایش محاسبات داخلی (مثلاً bucketing ماهانه).
- فقط یک موتور تقویم در `core/calendar` (مبتنی بر JDF)؛ وابستگی به `Intl` ممنوع.

## ۹. مجوزها (CD-05)

- ماتریس نقش‌ها در `docs/knowledge/USER_ROLES_AND_PERMISSIONS.md` (بازسازی‌شده از Demo).
- نقش‌ها: admin، manager، sales، ops، production، warehouse، finance.
- قانون `noMoney`: نقش‌های production/warehouse باید مبالغ را در پاسخ API دریافت نکنند (فیلتر در سرور).

## ۱۰. State سرور (CD-09)

- QueryClient متمرکز + کلیدهای متمرکز + invalidation.
- loading/error/empty states برای هر کوئری اجباری است.
- polling پیش‌فرض ممنوع (مگر تأیید Q-15).

## ۱۱. واکنش‌گرایی (CD-12)

- ۵ breakpoint: xs <480، sm 480–767، md 768–1023، lg 1024–1279، xl ≥1280.
- عرض‌های آزمایش واقعی: **۵۰۰ / ۷۶۸ / ۱۰۲۴ / ۱۲۸۰ / ۱۴۴۰**. ادعای عرض آزمایش‌نشده ممنوع است.
- حداقل عرض قابل آزمایش در این محیط ۵۰۰px است.

## ۱۲. آزمون‌ها

- چارچوب: vitest + Testing Library (+ Playwright برای E2E حداقل).
- هر فاز آزمون‌های خود را همراه با پیاده‌سازی تحویل می‌دهد.
- موتور تقویم: تست crossover کامل JDF.
- پوشش نهایی ≥ ۹۰٪ روی منطق کسب‌کار.

## ۱۳. قوانین کسب‌کار

- **هیچ قانون کسب‌کاری اختراع نمی‌شود** — هر قانون از Demo با ارجاع به فایل/خط ثبت شده است (`docs/knowledge/VALIDATION_AND_BUSINESS_RULES.md`).
- `moves` تنها منبع حقیقت موجودی است — هیچ فیلد موجودی ذخیره نمی‌شود.
- تصمیم‌ها فقط در `docs/DECISION_LOG.md` ثبت/تغییر می‌یابند (شناسه‌های CD/Q/D)؛ تصمیم معوق نباید ساکت به فاز بعد سرایت کند.

## ۱۴. مستندات و مراجع

| موضوع | مرجع |
|---|---|
| دانش کسب‌کار | `docs/knowledge/` (۱۵ سند) |
| معماری | `docs/architecture/` (۱۲ سند) |
| نقشه راه | `docs/roadmap/MASTER_ROADMAP.md` + `PHASES/PHASE_NN.md` |
| معیارهای پذیرش | `docs/roadmap/PHASE_ACCEPTANCE_CRITERIA.md` |
| ریسک‌ها و نقاط عطف | `docs/roadmap/RISKS_AND_MILESTONES.md` |
| تصمیم‌ها | `docs/DECISION_LOG.md` |
| گزارش فاز صفر | `docs/reports/PHASE_0_REPORT.md` |
