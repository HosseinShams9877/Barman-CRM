# APPLICATION_STRUCTURE — ساختار پوشه‌های برنامه هدف

> طرح (فاز صفر): هیچ فایلی ساخته نشده است. ساختار طبق سند راهرسی اجباری است و پوشه `app/` فعلی جایگزین می‌شود (بدون حذف Demo — Demo در `app/` باقی می‌ماند تا مهاجرت کامل شود).

## ۱. ساختار ریشه

```
پلتفرم نهایی تیم بارمان/
├── src/
│   ├── app/                        — لایه رندر (Next.js App Router)
│   │   ├── (auth)/login/page.tsx
│   │   ├── (app)/<route>/page.tsx  — صفحات هر ماژول
│   │   ├── api/                    — Route Handlers نازک
│   │   │   ├── auth/route.ts
│   │   │   ├── leads/route.ts
│   │   │   ├── orders/route.ts
│   │   │   └── …
│   │   ├── layout.tsx              — اسکلت RTL، فونت، Providerها
│   │   └── globals.css             — فقط ایمپورت globalCss/index.css
│   ├── modules/                    — ماژول‌های کسب‌کار (۶+۲)
│   │   ├── leads/
│   │   ├── sales/
│   │   ├── production/
│   │   ├── inventory/
│   │   ├── purchasing/
│   │   ├── finance/
│   │   ├── customers/
│   │   └── admin/
│   ├── core/                       — هسته مشترک
│   │   ├── auth/
│   │   ├── permissions/
│   │   ├── database/               — Prisma client
│   │   ├── api/                    — fetch helper، خطاها
│   │   ├── calendar/               — موتور خورشیدی جلالی
│   │   ├── query/                  — QueryClient central
│   │   ├── validation/             — Zod helpers
│   │   ├── errors/
│   │   ├── formatting/             — پول/تعداد/تاریخ
│   │   ├── localization/           — فارسی/RTL
│   │   ├── logging/
│   │   └── utils/
│   ├── components/
│   │   ├── ui/                     — primitters (دکمه، ورودی، دیالوگ…)
│   │   ├── shared/                 — مشترک بین ماژول‌ها
│   │   ├── layout/                 — shell، sidebar، navbar
│   │   └── feedback/               — خطا/خالی/بارگذاری
│   └── styles/
│       └── globalCss/
│           ├── tokens.css
│           ├── themes.css
│           ├── typography.css
│           ├── layout.css
│           ├── utilities.css
│           └── index.css
├── prisma/
│   ├── schema.prisma
│   └── migrations/                 — ساخته نمی‌شوند تا Phase 2
├── docs/                           — خروجی فاز صفر (اینجا)
├── CLAUDE.md                       — راهنمای پروژه
└── … (فایل‌های موجود)
```

## ۲. ساختار هر ماژول

```
src/modules/<module>/
├── components/      — کامپوننت‌های اختصاصی ماژول
├── hooks/           — hookهای encapsulate شده (React Query + منطق محلی)
├── lib/             — منطق ناب کسب‌کار (محاسبات، قوانین)
├── services/        — فراخوانی API (fetch wrapper)
├── types/           — تایپ‌های اختصاصی
├── schemas/         — Zod schemas
├── constants/       — ثابت‌ها (نقش‌ها، وضعیت‌ها، رنگ‌های معنادار)
├── queries/         — query keys + تعریف‌های مرکزی
└── index.ts         — API عمومی ماژول
```

## ۳. قواعد وابستگی

۱. `src/app/**` فقط از `src/modules/*/index.ts` و `src/components/**` ایمپورت می‌کند.
۲. `src/modules/*` فقط از `src/core/*` و `src/components/{ui,feedback}` ایمپورت می‌کند.
۳. `src/modules/A` **نباید** مستقیماً از `src/modules/B` ایمپورت کند — فقط از طریق `index.ts` و در صورت نیاز با تأیید معماری (cross-module imports به شدت محدود می‌شوند).
۴. `src/core/*` **هرگز** از `src/modules` یا `src/components` ایمپورت نمی‌کند.
۵. `src/components/**` فقط از `src/core/{formatting,localization}` استفاده می‌کند (نه منطق کسب‌کار).
۶. `Route Handlers` دقیقاً همین مسیریابی ماژولی را برای سرویس‌ها دنبال می‌کنند.

## ۴. نگاشت مسیرهای Demo → مسیرهای هدف

| Demo | هدف | ماژول |
|---|---|---|
| `app/login.html` | `/login` | `core/auth` |
| `app/home.html` | `/` | `dashboard` در `components/layout` |
| `app/leads.html` | `/leads` | `leads` |
| `app/orders.html` | `/orders` | `sales` |
| `app/order.html?id=…` | `/orders/[id]` | `sales` |
| `app/customer.html?o=…` | `/print/orders/[id]` (**مسیر امن**) | `sales` |
| `app/flow.html` | `/flow` | `sales` (نمودار) |
| `app/prod.html` | `/production` | `production` |
| `app/stock.html` | `/inventory` | `inventory` |
| `app/buy.html` | `/purchasing` | `purchasing` |
| `app/fin.html` | `/finance` | `finance` |
| `app/reports.html` | `/reports` | `reports` (در Phase 7) |
| `app/admin.html` | `/admin/*` | `admin` |

## ۵. قواعد نام‌گذاری

- نام‌گذاری فایل کامپوننت: `kebab-case.tsx`؛ خود کامپوننت‌ها: `<FeatureName>.tsx`.
- query keys: `[module, entity, filter?]` — مثلاً `['leads', 'list', { stage }]`.
- Route Handlers: `route.ts` در مسیر جمع (مثلاً `api/leads/[id]/route.ts`).
- ثابت‌های وضعیت در `constants/` با نوع رشته‌ای (string union) و برچسب فارسی.
