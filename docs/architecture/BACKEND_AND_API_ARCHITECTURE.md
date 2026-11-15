# BACKEND_AND_API_ARCHITECTURE — معماری بک‌اند و API هدف

> طرح (فاز صفر). طبق سند راهرسی: Route Handlers زیر `src/app/api/`، نازک، بدون منطق کسب‌کار.

## ۱. وضعیت موجود (Demo)

| جنبه | Demo |
|---|---|
| پروتکل | HTTP خام Node ≥20 (`server.js`، پورت ۸۰۹۰) |
| مسیرها | `/api/<col>` (GET/POST)، `/api/rev`، `/ping.js`، `/api/auth`، `/api/export` |
| پارس | دستی `JSON.parse` روی بدنه |
| اعتبارسنجی | **وجود ندارد** (R-13) |
| مجوز | فقط whitelist کالکشن + احراز هویت (R-02) |
| خطاها | پیام خام، وضعیت 400/500 |
| پایش | snapshot polling هر ۳ ثانیه (R-29) |

## ۲. طرح هدف

### ۲.۱ ساختار Route Handler

```ts
// src/app/api/leads/route.ts — الگوی ثابت
export async function GET(req: Request) {
  const session = await getSession();            // 1) احراز هویت
  if (!session) return unauthorized();
  requirePermission(session, "leads.view");      // 2) مجوز (سرور)
  const input = listLeadsQuerySchema.parse(req);  // 3) اعتبارسنجی Zod
  const rows = await leadsService.list(input);    // 4) سرویس ماژول
  return Response.json(rows);                     // 5) قالب خروجی
}
```

پنج قدم ثابت: **احراز هویت → مجوز → اعتبارسنجی → سرویس → پاسخ**. هیچ منطق کسب‌کاری در `route.ts` نباشد.

### ۲.۲ نقشه API

| مسیر | متد | هدف |
|---|---|---|
| `/api/auth/login` | POST | ورود، نشست cookie |
| `/api/auth/logout` | POST | خروج |
| `/api/auth/me` | GET | کاربر جاری |
| `/api/leads` | GET/POST | فهرست/ایجاد سرنخ |
| `/api/leads/[id]` | GET/PATCH | دریافت/به‌روزرسانی |
| `/api/leads/[id]/hist` | POST | افزودن پیگیری |
| `/api/accounts` | GET/POST | اشخاص/شرکت‌ها |
| `/api/orders` | GET/POST | فهرست/ایجاد PF |
| `/api/orders/[id]` | GET/PATCH | جزئیات/به‌روزرسانی |
| `/api/orders/[id]/status` | POST | تغییر وضعیت خط لوله |
| `/api/orders/[id]/pays` | POST | ثبت پرداخت |
| `/api/moves` | GET/POST | حرکت‌های انبار |
| `/api/jobs` | GET/POST | کارهای تولید |
| `/api/buys` | GET/POST | خریدها |
| `/api/txns` | GET | تراکنش‌های مالی |
| `/api/products` | GET/POST | کاتالوگ |
| `/api/materials` | GET/POST | مواد و BOM |
| `/api/users` | GET/PATCH | کاربران (مدیر) |
| `/api/settings` | GET/PATCH | تنظیمات |
| `/api/reports/[name]` | GET | گزارش‌ها |
| `/api/export` | GET | خروجی zip/CSV |

### ۲.۳ اصول طراحی

۱. **REST مسیر-محور**: اسامی جمع، متدهای استاندارد، `PATCH` برای به‌روزرسانی جزئی.
۲. **اعتبارسنجی دوگانه Zod**: اسکیمای مشترک در `src/modules/<m>/schemas` — هم در فرم کلاینت هم در Route Handler (درس از R-13).
۳. **کدهای وضعیت**: 200/201/204/400/401/403/404/409/500.
۴. **قابلیت پیش‌بینی خطا**: فرمت ثابت `{ error: { code, message, fields? } }` — کلاینت یک helper متمرکز در `src/core/api` دارد.
۵. **تراکنش‌ها**: عملیات چندمرحله‌ای (مثلاً تغییر وضعیت + حرکت انبار) در یک تراکنش Prisma.
۶. **بدون وضعیت (stateless)**: همه وضعیت در DB؛ نشست در cookie امن HttpOnly.
۷. **قابلیت تست**: سرویس‌ها مستقل از HTTP آزمون می‌شوند (`Vitest`).

### ۲.۴ همزمانی و sync

- جایگزینی polling با **React Query invalidation** متمرکز (R-29):
  - mutation‌ها cache را invalidate می‌کنند.
  - refetchOnFocus و staleTime مشخص.
- در صورت نیاز به push واقعی (چند کاربر همزمان روی یک سفارش): **WebSockets یا SSE** در Phase 6 (Q-15).

### ۲.۵ تفاوت‌های کلیدی با Demo

| Demo | هدف |
|---|---|
| whitelist کالکشن به‌جای مجوز | مجوز دقیق برای هر عملیات (`leads.view`، `orders.edit`…) |
| snapshot polling | API اختصاصی + React Query |
| اعتبارسنجی کلاینت‌فقط | Zod در سرور |
| HTML رشته‌ای | JSON + React |
| prompt() برای تأیید | دیالوگ‌های React (R-20) |
