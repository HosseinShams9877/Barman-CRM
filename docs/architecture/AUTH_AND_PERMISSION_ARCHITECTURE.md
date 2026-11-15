# AUTH_AND_PERMISSION_ARCHITECTURE — معماری احراز هویت و مجوز هدف

> طرح (فاز صفر). این معماری مستقیماً پاسخ به ریسک‌های R-01 (سرور customer.html) و R-02 (مجوز کاملاً کلاینت‌محور) است. اصل راهبری: **«پنهان کردن دکمه کافی نیست»**.

## ۱. وضعیت موجود (Demo)

See `docs/knowledge/USER_ROLES_AND_PERMISSIONS.md`.

| لایه | مکانیزم | ارزیابی |
|---|---|---|
| احراز هویت | HMAC-SHA256 cookie `br_s`، نشست ۳۶۵ روزه، scrypt | نقاط ضعف: بدون expire سرور، بدون چرخش کلید |
| مجوز (سرور) | whitelist کالکشن در `server/api.js` | فقط در سطح کالکشن — فاقد مجوز عملیات |
| مجوز (کلاینت) | redirect سطح صفحه، `X.canView`، `X.can`، `noMoney`، ماتریس admin | کلیدی — قابل دور زدن |
| صفحه مشتری | `customer.html?o=…` **بدون احراز هویت** | R-01 بحرانی |

۷ نقش: management، admin، finance، salesManager، sales، production، depot. ۸ کاربر نمونه (u1…u8).

## ۲. طرح هدف

### ۲.۱ احراز هویت (Authentication)

| جنبه | طرح |
|---|---|
| نشست | cookie امن HttpOnly، SameSite=Lax، Secure در تولید |
| insignia | JWT امضاشده (یا نشست در DB) — توکن opaque توصیه می‌شود |
| انقضا | نشست کوتاه (مثلاً ۸ ساعت) + refresh؛ نه ۳۶۵ روز ثابت |
| ذخیره رمز | scrypt (همان الگوریتم Demo) با نمک یگانه |
| ورود | `/api/auth/login` (POST)، سازگار با throttling |

### ۲.۲ مجوز (Authorization) — سه لایه

```
لایه ۱: RBAC نقش‌ها     — هر نقش مجموعه‌ای از permissionها دارد
لایه ۲: مالکیت/قلمرو    — sales فقط سرنخ‌های خودش را می‌بیند (اگر طراحی شود)
لایه ۳: فیلتر داده      - داده‌های حساس (مالی) فقط برای نقش‌های مجاز
```

#### ماتریس مجوزها (آزادسازی از Demo)

| permissionپذیر | نقش‌های مجاز |
|---|---|
| `leads.view` | management, admin, salesManager, sales |
| `leads.create/edit` | management, admin, salesManager, sales |
| `leads.viewAll` | management, admin, salesManager (نه sales عادی) |
| `orders.view` | همه نقش‌ها (با جزئیات محدودشده برای production/depot — Q-07) |
| `orders.create/edit` | management, admin, salesManager, sales |
| `orders.status.change` | management, admin, sales (dependent on stage) |
| `production.view` | management, admin, production |
| `production.edit` | management, admin, production |
| `inventory.view` | management, admin, production, depot |
| `inventory.moves` | management, admin, depot |
| `purchasing.view` | management, admin, finance |
| `purchasing.edit` | management, admin, finance |
| `finance.view` | management, admin, finance |
| `finance.edit` | management, admin, finance |
| `customers.view` | management, admin, salesManager, sales |
| `admin.users` | management, admin |
| `admin.settings` | management, admin |
| `reports.view` | management, admin, finance, salesManager |
| `money.view` (مخفی‌سازی مبالغ) | management, admin, finance، salesManager — در غیر اینصورت `noMoney` |

#### نکات طراحی

۱. **اجبار در سرور**: هر Route Handler با `requirePermission(session, perm)` شروع می‌شود. هیچ استثنایی نیست.
۲. **هماهنگی کلاینت-سرور**: همان جدول در `src/core/permissions` به‌عنوان منبع واحد (single source of truth) — کلاینت فقط برای UX (پنهان کردن دکمه) از نسخه خواندنی استفاده می‌کند.
۳. **`?as=<role>` (جایگزین نقش)**: فقط برای management/admin با ثبت در log — در نسخه هدف، یک قابلیت دیباگ است که در تولید غیرفعال می‌شود.
۴. **`noMoney` (OPS)**: در نسخه هدف، **داده‌های مبلغ از سرور فیلتر می‌شوند**، نه اینکه در کلاینت پنهاب شوند (R-32).
۵. **`u.off` (غیرفعال‌سازی کاربر)**: سرور در زمان احراز هویت بررسی می‌کند — در حال حاضر فقط کلاینت چک می‌کند.
۶. **discountCap و SEE/EDIT FULL admin**: در سرور اعمال می‌شوند (در حال حاضر فقط کلاینت — R-02).

### ۲.۳ صفحه مشتری (چاپ پیش‌فاکتور) — R-01

| Demo | هدف |
|---|---|
| `customer.html?o=…` بدون احراز هویت | `/print/orders/[id]` با **access token یکبارمصرف/منقضی‌شونده** (signed) |

راهکار: لینک چاپ شامل یک token امضاشده با انقضای کوتاه (مثلاً ۳۰ دقیقه) است که فقط شناسه سفارش مشخص را باز می‌کند — بدون session cookie. این حداقل نیازمندی برای رفع آسیب‌پذیری است.

### ۲.۴ Security Checklist فازهای بعدی

- [ ] همه مسیرهای API با requirePermission پوشش داده شوند (review خودکار)
- [ ] تست penetration: دسترسی مستقیم به API با نقش پایین → expect 403
- [ ] throttling ورود
- [ ] چرخش کلید امضای cookie
- [ ].reporting خطاهای مجوز (log)

## ۳. مهاجرت نقش‌ها

هیچ نقش جدیدی اضافه نمی‌شود و حذف نمی‌شود — ۷ نقش Demo ثابت می‌مانند. ۸ کاربر نمونه انتقال می‌یابند (پسوردها نمی‌توانند منتقل شوند — نیاز به reset هماهنگ با کاربر).
