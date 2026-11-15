# DATABASE_ARCHITECTURE — معماری پایگاه داده هدف

> طرح (فاز صفر): طبق سند راهرسی، **هیچ اسکیمایی ساخته/تغییر داده نمی‌شود** تا Phase 2. این سند فقط طراحی است.

## ۱. وضعیت موجود (Demo)

دو درایور ذخیره‌سازی بدون اسکیما (See `docs/knowledge/DATA_MODEL.md`):

| درایور | مکان | ساختار |
|---|---|---|
| `server/drivers/file.js` | `data/` | `meta.json`، `<col>/<id>.json`، `seq-<KIND>.txt`، `files/<id>.<ext>` |
| `server/drivers/pg.js` | PostgreSQL | اسکیمای `barman`: `docs(col,id,jsonb,updated)`، `seq(kind,n)`، `files(id,ext,bytea,created)`، `kv(k,jsonb)` |

**ویژگی‌های کلیدی موجود (نقاط قوت قابل حفظ):**
- `nextSeq` با `INSERT … ON CONFLICT DO UPDATE SET n = GREATEST(seq.n, $2) + 1` — بدون قفل ردیف اما ضد دوگانگی (R-24).
- `updated bigint` (epoch ms) در هر سند — مهر زمانی.
- `migrate()` کاملاً idempotent (CREATE … IF NOT EXISTS).
- `seedIfEmpty()` فقط `meta` را در دیتابیس خالی می‌کارید.

**مشکلات موجود:**
- `meta` یک غول JSONی است (cat.products + materials + bom + suppliers + users + 7 lists + settings) — رقابت نوشتاری بالا (R-31).
- هیچrelation Constraintی وجود ندارد — یکپارچگی داده فقط در کلاینت (R-13).
- دو قالب تاریخ (Jalali string vs epoch ms) — R-07.
- آرایه‌های بدون اعتبارسنجی (phones, contacts, hist, interest…).

## ۲. طرح هدف

### ۲.۱ مدل رابطه‌ای

| جدول | کلید اصلی | هدف | منبع Demo |
|---|---|---|---|
| `users` | id | کاربران و نقش‌ها | `meta.users` |
| `roles` (enum) | — | ۷ نقش ثابت | USERS0 |
| `products` | id | کاتالوگ محصولات | `meta.cat.products` |
| `materials` | id | مواد خام | `meta.cat.materials` |
| `bom` | (productId, materialId) | درخت BOM | `meta.cat.bom` |
| `suppliers` | id | تأمین‌کنندگان | `meta.suppliers` |
| `lists` | id | ۷ فهرست (reasons, sources…) | `meta.lists` |
| `settings` | id (تک‌ردیفی) | تنظیمات (vat، rate، discountCap) | `meta.settings` |
| `accounts` | id | اشخاص/شرکت‌ها | `data/accounts` |
| `account_phones` | (accountId, idx) | تلفن‌ها | `accounts.phones` |
| `account_contacts` | id | مخاطبین | `accounts.contacts` |
| `leads` | id | سرنخ‌ها | `data/leads` |
| `lead_hist` | id | تاریخچه پیگیری | `leads.hist` |
| `lead_interest` | (leadId, productId) | محصولات موردنظر | `leads.interest` |
| `orders` | id | سفارش/پیش‌فاکتور | `data/orders` |
| `order_items` | id | ردیف‌های PF | `orders.items` |
| `order_pays` | id | پرداخت‌ها | `orders.pays` |
| `order_chques` | id | چک‌ها | `orders.chques` |
| `moves` | id | حرکت‌های انبار | `data/moves` |
| `jobs` | id | کارهای تولید | `data/jobs` |
| `buys` | id | خریدها | `data/buys` |
| `buy_items` | id | ردیف‌های خرید | `buys.items` |
| `txns` | id | تراکنش‌های مالی | `data/txns` |
| `files` | id | پیوست‌ها | `data/files` |
| `rev` | (single row) | شماره بازنگری | `kv.rev` |

### ۲.۲ قوانین یکپارچگی

۱. **برای هر سفارش، lead اختصاصی است** — `orders.leadId` (در Demo: `l.order` پیوند معکوس).
۲. **فیلتر pxAll**: `orders.status IN ('pf','pending','ready','ship','install','done')` (قانون در Demo: `o.status !== "won"` — R-10).
۳. **moves تنها منبع حقیقت موجودی** — `onHand` محاسبه می‌شود، نه ذخیره‌شده.
۴. **`txns` داده مشتق است**، نه اولیه (Q-14).
۵. **اعتبارسنجی آرایه‌ها** — تلفن‌ها/مخاطبین در جداول جداگانه با Constraint.

### ۲.۳ استراتژی تاریخ

| نوع | قالب | مثال |
|---|---|---|
| تاریخ (date-only) | رشته Jalali `YYYY/MM/DD` با ارقام ASCII | `1404/08/17` |
| لحظه (instant) | UTC timestamp در DB، نمایش Asia/Tehran | `created`، `updated`، `moves.t` |

(برای جزئیات `DATE_AND_CALENDAR_POLICY.md` و `CALENDAR_ARCHITECTURE.md` را ببینید — Q-10.)

### ۲.۴ Prisma

```prisma
// prisma/schema.prisma — فقط طرح فاز صفر
datasource db {
  provider = "postgresql" // توسعه: "sqlite"
  url      = env("DATABASE_URL")
}
generator client { provider = "prisma-client-js" }
```

- PostgreSQL در تولید، SQLite در توسعه/آزمون (طبق سند راهرسی).
- **Migrations** توسط Prisma Migrate در Phase 2 ایجاد می‌شوند (دستی نیستند).
- `seedIfEmpty` معادل: اسکریپت seed با `prisma db seed`.

### ۲.۵ امنیت داده

- رشته‌های اتصال فقط از متغیرهای محیطی (وجود `.env.local` گزارش شد — محتوا هرگز فاش نمی‌شود).
- پارامتر بستن (parameterized queries) — در همه جا (Prisma به‌طور پیش‌فرض).
- `updated` به‌عنوان مهر زمانی رکورد برای تشخیص تداخل optimistic.

## ۳. مهاجرت داده

See `MIGRATION_STRATEGY.md` برای جزئیات کامل. خلاصه:
1. خواندن snapshot از Demo (zip یا pg).
2. تجزیه `meta` به جداول.
3. نرمال‌سازی تاریخ‌ها (Q-10).
4. اعتبارسنجی + گزارش خطاها.
5. بارگذاری با تراکنش.
