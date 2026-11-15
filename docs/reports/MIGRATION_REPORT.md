# MIGRATION_REPORT — مهاجرت داده Demo → پایگاه داده جدید

- **تاریخ اجرا:** 2026-11-14T22:05:16.353Z
- **منبع:** `D:\New folder\CRM-Barman\پلتفرم نهایی تیم بارمان\data`
- **مدت اجرا:** 1109 میلی‌ثانیه
- **مراحل:** ۱ استخراج → ۲ تجزیه meta → ۳ نرمال‌سازی تاریخ → ۴ نقشه‌گذاری → ۵ اعتبارسنجی → ۶ بارگذاری تراکنشی → ۷ صحه‌گذاری

## ۱. خلاصه شمارش تطبیقی

| مجموعه | اسناد Demo | ردیف‌های بارگذاری‌شده | وضعیت |
|---|---:|---:|---|
| accounts | 23 | 23 | ✅ تطابق |
| leads | 29 | 29 | ✅ تطابق |
| orders | 19 | 19 | ✅ تطابق |
| buys | 6 | 5 | ⚠️ اختلاف |
| jobs | 1 | 1 | ✅ تطابق |
| moves | 70 | 70 | ✅ تطابق |
| meta | 1 | 1 | تنظیمات |

## ۲. شمارش همه جداول هدف

| جدول | ردیف‌ها |
|---|---:|
| accounts | 23 |
| bom | 210 |
| buyCheques | 4 |
| buyItems | 9 |
| buys | 5 |
| buyStatusLogs | 12 |
| cheques | 9 |
| contacts | 21 |
| followups | 113 |
| handoffs | 3 |
| interests | 23 |
| items | 20 |
| jobs | 1 |
| leads | 29 |
| lists | 7 |
| materials | 16 |
| moves | 70 |
| orders | 19 |
| payments | 7 |
| phones | 23 |
| products | 46 |
| rev | 6 |
| roles | 7 |
| settings | 1 |
| stageLogs | 83 |
| suppliers | 7 |
| txns | 0 |
| userRoles | 8 |
| users | 8 |

## ۳. اسناد/ردیف‌های رد‌شده (بدون اصلاح ساکت)

| مرحله | مجموعه | شناسه | دلیل |
|---|---|---|---|
| map | buys | BY-303 | خرید آژانسی — BuyItem فقط مواد خام را پشتیبانی می‌کند (schema فاز ۶) |

## ۴. اختلاف‌های شمارش

| مجموعه | مورد انتظار | واقعی |
|---|---:|---:|
| buys | 6 | 5 |

### ۴.۱ ارجاع‌های نرم ناموجود (به null تبدیل و گزارش شدند)

| مجموعه | شناسه | ارجاع | نوع |
|---|---|---|---|
| lead_followups | LD-1031/hmw698rxt9x3n | sys | byUserId/owner |

## ۵. فیلدهای Demo بدون معادل در مدل هدف

این فیلدها منتقل نمی‌شوند — تصمیمات نگاشت در §۶ مستند شده‌اند:

| مجموعه | فیلد | تعداد اسناد |
|---|---|---:|
| accounts | city | 13 |
| accounts | owner | 23 |
| accounts | src | 23 |
| buys | pay.method/note | 5 |
| buys | payments[].cash (bp1 — مدل هدف ندارد) | 2 |
| leads | area | 14 |
| leads | order (ارجاع از سمت سفارش حفظ می‌شود) | 12 |
| leads | prob | 20 |
| leads | sub/subs (زیرمرحله) | 2 |
| leads | tries | 8 |
| meta | feed (مدل هدف وجود ندارد) | 1 |
| orders | agencyShort | 1 |
| orders | agreed.by | 7 |
| orders | agreed.diff | 1 |
| orders | delivered.by | 3 |
| orders | plan (برنامه پرداخت — رسیدها منتقل می‌شوند) | 13 |
| orders | prod.shortReq=BY-306 | 2 |
| orders | resv (Q-04 معوق) | 3 |

## ۶. تصمیمات نگاشت (مستند — بدون اختراع قانون کسب‌کار)

| تصمیم | منبع |
|---|---|
| `accounts.kind`: company/person → customer | ACCOUNT_KINDS در target (UI taxonomy) |
| `leads.value = 0` → amount null | مقدار ۰ یعنی نامشخص |
| `leads.next` → یک رکورد LeadFollowup با nextAt | hist[]/next در Demo |
| `hist.kind = call` → note | kinds هدف: in/stage/note |
| `orders.plan` منتقل نمی‌شود — رسیدها (receipts) منتقل می‌شوند | برنامه پرداخت نمایشی است |
| `orders.pb` (موجود در PF-1217) → planBuilder | order.js planBuilder |
| `log` → OrderStageLog با fromStage/toStage استخراج‌شده از `times` | core.js:172 log() |
| `prod.handoff` → OrderHandoff با شناسه TR- اصلی (R-12) | order.js:731 |
| `prod.start/end` (ms) → `YYYY/MM/DD` | CD-06 |
| `prod.qc.good/waste` (per-product) → جمع‌جبری اعداد | qc هدف عددی است |
| وضعیت خرید: draft/req→req، fin→ok، wait→fin، done/disc→recv | fin-core.js:14 ST |
| خرید آژانسی رد می‌شود (BuyItem فقط مواد خام) | schema فاز ۶ |
| پسورد کاربران: reset هماهنگ با رمز اولیه | MIGRATION_STRATEGY §۴ |
| کاربر `sys` (سیستمی) در LeadFollowup → null + گزارش | core.js:127 |
| `meta.feed` منتقل نمی‌شود — مدل هدف وجود ندارد | — |
| `resv` (رزرو) منتقل نمی‌شود — Q-04 معوق | order.js:748 |

## ۷. آخرین شماره هر series (R-12)

ثبت‌شده در جدول `Rev` با کلید `seq:<KIND>` — شناسه‌های بعدی از max موجود ادامه می‌یابند.

| series | آخرین شماره |
|---|---:|
| AC | 222 |
| BY | 306 |
| LD | 1032 |
| PF | 1219 |
| PJ | 501 |
| TR | 1210 |

## ۸. نمونه‌گیری ۱۰٪

- پوشش: 29٪ از اسناد اصلی
- تطابق: 43 از 43 نمونه

## ۹. کاربران و رمز عبور اولیه

Demo هیچ هش رمزی در `data/` ذخیره نمی‌کند (ورود محلی با متغیرهای `PASS_*` سرور) — انتقال هش ممکن نیست.
رمز اولیه همه کاربران `barman1405` است (bcrypt cost ۱۰) — **باید پس از اولین ورود تغییر کند** (reset هماهنگ، MIGRATION_STRATEGY §۴).

| کاربر | نقش |
|---|---|
| امیرعلی رحیمی | management |
| شیما کریمی | admin |
| مهدی رضایی | finance |
| علی توکلی | salesManager |
| نگار صادقی | sales |
| رضا نوری | sales |
| حسین شریفی | production |
| کاوه بهرامی | depot |
