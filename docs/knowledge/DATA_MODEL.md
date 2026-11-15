# DATA_MODEL — مدل داده نسخه نمایشی (as-is)

> Demo از یک **پایگاه داده سندی بدون اسکیمای سرور** استفاده می‌کند: هر سند یک فایل JSON مستقل است (یا یک ردیف `jsonb` در Postgres). رابطه‌ها با شناسه‌های رشته‌ای و در زمان اجرا در کلاینت پیاده می‌شوند. این سند چیدمان واقعی را ثبت می‌کند تا معماری هدف بتواند آن را به اسکیمای رابطه‌ای Prisma تبدیل کند.

## ۱. لایه ذخیره‌سازی

### ۱.۱ درایو فایل (سرور محلی)
```
data/
├── meta.json                     — سند یکتای کاتالوگ/فهرست‌ها/تنظیمات/کاربران
├── accounts/<AC-id>.json         — ۲۳ سند در Demo
├── leads/<LD-id>.json            — ۲۹ سند
├── orders/<PF-id>.json           — ۱۹ سند
├── buys/<BY-id>.json             — ۶ سند
├── jobs/<PJ-id>.json             — ۱ سند
├── moves/<id>.json               — ۷۰ سند
├── txns/                          — پوشه وجود ندارد (فقط در حافظه)
├── files/                         — پوشه وجود ندارد (temp demo آپلودی نیست)
└── seq-<KIND>.txt                 — ۵ فایل: AC, BY, LD, PF, PJ
```

### ۱.۲ درایو Postgres (Neon)
اسکیمای `barman` (نام از `PG_SCHEMA` در `server/config.js`):
- `docs(col text, id text, body jsonb, updated bigint, PK(col,id))` — همه سندها؛ `col='meta'` شناسه ثابت `main` دارد.
- `seq(kind text PK, n int)`.
- `files(id text PK, ext, data bytea, created bigint)`.
- `kv(k text PK, v jsonb)` — کلید `rev` برای کنترل نسخه.
- `migrate()` خودکار جداول را می‌سازد؛ `seedIfEmpty()` در صورت خالی بودن فقط `meta` را از `seed-data/meta.json` وارد می‌کند.

**نکته مهم**: دو درایو از نظر داده‌ها هم‌ارز هستند ولی **هیچ ایندکس رابطه‌ای وجود ندارد** — همه JOINها در کلاینت با اسکن snapshot انجام می‌شود.

## ۲. مجموعه‌ها و ساختار اسناد (فیلدهای مشاهده‌شده)

### ۲.۱ `meta` (یک سند)
```json
{
  "cat": {
    "products": [{ "id": "BR-101…BR-138 | a1…a8", "name", "line": "prod|agency",
                    "u": "م²|عدد", "price", "cost", "colors": [] }],
    "materials": [{ "id": "RM-101…RM-116", "name", "u", "price", "min" }],
    "bom": { "<productId>": [{ "m": "<RM-id>", "q": <number per م²> }] }
  },
  "suppliers": [{ "id": "s1…s7", "name", "kind": "raw|agency", "phone", … }],
  "users": [{ "id": "u1…u8", "name", "role", "color", "off"?, "phone"? }],
  "sources": [], "roles": [], "results": [], "lost": [], "projects": [], "channels": [], "waste": [],
  "settings": { "company", "companyEn"?, "tagline"?, "phone", "address", "bale"?,
                "vat": <percent>, "validDays": 3, "rate": 3,
                "discountCap": { "sales"?, "salesManager"?, "management"? } }
}
```

### ۲.۲ `accounts` (AC)
`id, name, kind: "company"|"person", city, phones[], contacts[{name, role, phone}], line, created`

### ۲.۳ `leads` (LD)
`id, acct, stage: "raw"|"opp"|"pf"|"won"|"lost", line, owner, src, srcNote, project, interest[], area, value, prob, next{t, what}, tries, hist[{kind, result, t, note}], lostWhy, note, order, created, updated`

### ۲.۴ `orders` (PF)
`id, acct, lead, items[{p, name, color, w, h, q, price}], sub, disc, ship, install, vat, total, pay: "cash"|"chq"|"credit", kind, resv, extraPays[], status, sentAt, created, by`

`status`: `new | sent | ok | pay | buy | prod | ready | ship | done | pending | cancel`

### ۲.۵ `buys` (BY)
`id, sup, items[{...}(raw با قیمت/مقدار)], status: "req"|"ok"|"fin"|"recv", chq[{amount, due, sayad?, status: "issued"|"paid"}], created, by`

### ۲.۶ `jobs` (PJ)
`id, prod, q, color, start, end, status: "plan"|"run"|"qc"|"sent"|"done", good, waste, recv?, created, by`

### ۲.۷ `moves` (حرکت انبار — بدون پیشوند در Demo)
`id, wh: "raw"|"depot", item, qty (مثبت ورودی/منفی خروج), kind: "open"|"buy"|"prod"|"sale"|"use"|"out"|"adj"|"waste"|"job", ref, t, by`

### ۲.۸ `txns` (تراکنش نقدی — فقط در حافظه)
`id: "TR-" + <PF id without prefix>, dir: +1|-1, amount, kind, who, note, by`

## ۳. شناسه‌ها و دنباله‌ها

- پیشوندها: `AC` (حساب)، `LD` (سرنخ)، `PF` (پیش‌فاکتور)، `BY` (خرید)، `PJ` (کار تولید)، `TR-` (تراکنش — از PF مشتق می‌شود، نه از `seq`).
- ساختار شناسه پایگاه: `PREFIX + number` (مثلاً `PF-1201`) — عدد از `nextSeq(kind, start)`.
- `nextSeq`: `GREATEST(seq, start) + 1` (ترکیب `ON CONFLICT … DO UPDATE` در PG، بازنویسی فایل در درایو فایل) — **بدون قفل ردیفی**، اما به لطف `GREATEST` از تکرار شماره جلوگیری می‌کند.
- `seq` دنباله گذرای هر کالکشن را همگن نگه می‌دارد (مثلاً `seq-PF.txt`).

## ۴. روابط (منطقی، در کلاینت پیاده می‌شوند)

| رابطه | میدان | نحوه پیاده‌سازی |
|---|---|---|
| حساب ← سرنخ | `lead.acct → account.id` | اسکنsnapshot کلاینت |
| سرنخ ← سفارش | `order.lead → lead.id` (و `lead.order`) | |
| حساب ← سفارش | `order.acct → account.id` | |
| سفارش ← حرکت | `move.ref → order.id` | |
| خرید ← حرکت | `move.ref → buy.id` | |
| کار ← حرکت | `move.ref → job.id` | |
| محصول/ماده ← حرکت | `move.item → cat.products[].id / cat.materials[].id` | |
| محصول ← BOM | `cat.bom[productId] → materials[].id` | |
| کاربر ← سرنخ/سفارش/... | `owner`, `by → users[].id` | |

## ۵. فیلدهای مجهول (محاسبه‌شده در کلاینت، ذخیره نمی‌شوند)

موجودی انبار (`X.onHand`)، رزرو (`X.reserved`)، موجودی آزاد (`X.freeQty`)، موجودی در راه (`pend`)، مانده حساب سفارش (`B.due`)، بدهی تأمین‌کننده، ارزش انبار، درصد ضایعات، KPIهای داشبورد — همه در هر بار رندر از نو محاسبه می‌شوند.

## ۶. نکات مهم برای مهاجرت

۱. **اسکیمای مسطح سندی → رابطه‌ای**: `meta` یک سند غول‌پیکر است که شش موجودیت منطقی در آن است (products، materials، bom، suppliers، users، lists + settings). تجزیه آن به جداول جدا (هرکدام با نسخه/تاریخچه) الزامی است.
۲. **`bom` یک کلید-مقدار با کلید خارجی ضمنی است** که به جدول BOM تبدیل خواهد شد.
۳. **`moves` تنها منبع حقیقت موجودی است** — هیچ فیلد موجودی ذخیره نیست. در معماری هدف، برای کارایی می‌توان مقادیر تجمیعی را در اختیار قرار داد ولی منبع حقیقت همچنان `moves` خواهد بود (جزئیات پیاده‌سازی در `MIGRATION_STRATEGY.md`).
۴. **تاریخ‌ها** به صورت `YYYY/MM/DD` خورشیدی با ارقام ASCII در رشته‌های `start`, `end`, `sentAt` و به صورت `Date.now()` میلی‌ثانیه‌ای در `created`, `t` ذخیره می‌شوند — دو معیار مختلف در کنار هم (→ `DATE_AND_CALENDAR_POLICY.md`).
۵. **آرایه‌های `phones[]`/`contacts[]`/`hist[]`/`items[]`** بدون هیچ اعتبارسنجی سرور هستند.
