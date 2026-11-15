/**
 * ماتریس مجوزها — منبع واحد حقیقت (AUTH_AND_PERMISSION_ARCHITECTURE §۲.۲).
 *
 * این جدول همان جدول آزادسازی‌شده از Demo است. هر دو سمت سرور و کلاینت از
 * همین ماژول استفاده می‌کنند — کلاینت فقط برای UX (پنهان‌سازی دکمه)،
 * سرور برای اجرای واقعی (R-02: پنهان کردن دکمه کافی نیست).
 *
 * نقش‌های Demo (۷ عدد — هیچ نقش جدیدی اضافه/حذف نمی‌شود):
 *   management, admin, finance, salesManager, sales, production, depot
 *
 * `money.view` (R-32 / noMoney): نقش‌هایی که این مجوز را ندارند نباید مبالغ
 * را در پاسخ API دریافت کنند — فیلتر در سرور (core/permissions/requirePermission).
 *
 * افزوده‌های فاز ۳ (CD-23 / PHASE_03 §۸): `leads.assign` (تغییر مالک سرنخ —
 * فقط management/admin/salesManager طبق Demo: تغییر owner در زمان ALLV)،
 * `leads.import` (واردات CSV)، `customers.create` و `customers.edit`
 * (مشتری‌نویسی — sales و salesManager طبق Demo).
 *
 * افزوده‌های فاز ۶ (PHASE_06 §۷): `purchasing.approve` (تأیید خرید req→ok —
 * management/admin طبق Demo ST.req.who="management") و `finance.approve`
 * (تأیید مالی خرید ok→fin — finance/management/admin).
 *
 * دید خرید/مالی برای production/depot (PHASE_06 دروازه خروج ۶ / R-32):
 * در Demo این نقش‌ها صفحات buy/fin را نمی‌بینند (ماتریس §۳ سند
 * USER_ROLES_AND_PERMISSIONS)، ولی الگوی noMoney در Demo این است که صفحاتی
 * که می‌بینند (مثل stock) را بدون مبلغ می‌بینند. PHASE_06 §§۹/۱۲۰/۱۵۶
 * صراحتاً می‌خواهد نقش production/warehouse پاسخ مسیرهای `/api/finance/*`
 * را **بدون مبلغ** دریافت کنند (نه ۴۰۳) — یعنی مجوز دید باقی می‌ماند و
 * فیلتر مبلغ در سرور اجرا می‌شود. این نقش‌ها `purchasing.view` و
 * `finance.view` دریافت می‌کنند ولی `money.view` نه (همان الگوی موجودی
 * فاز ۵).
 */
export const ROLES = [
  "management",
  "admin",
  "finance",
  "salesManager",
  "sales",
  "production",
  "depot",
] as const;

export type Role = (typeof ROLES)[number];

/**
 * برچسب فارسی نقش‌ها — منبع: نام نقش‌ها در Demo (app/core.js / meta.roles).
 * فقط برای نمایش در UI است؛ هیچ تصمیم مجوزی بر اساس آن گرفته نمی‌شود.
 */
export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  management: "مدیر",
  admin: "ادمین",
  finance: "مالی",
  salesManager: "مدیر فروش",
  sales: "کارشناس فروش",
  production: "تولید",
  depot: "انبار",
};

export const PERMISSIONS = [
  "leads.view",
  "leads.create",
  "leads.edit",
  "leads.viewAll",
  "leads.assign",
  "leads.import",
  "orders.view",
  "orders.create",
  "orders.edit",
  "orders.status.change",
  "production.view",
  "production.edit",
  "inventory.view",
  "inventory.moves",
  "purchasing.view",
  "purchasing.edit",
  "purchasing.approve",
  "finance.view",
  "finance.edit",
  "finance.approve",
  "customers.view",
  "customers.create",
  "customers.edit",
  // --- فاز ۷: مدیریت و کاتالوگ (app/admin.js:9-13 — ماتریس SEE/EDIT) ---
  // خواندن تب‌های مدیریت: products برای همه نقش‌ها، materials/bom فقط
  // برای مدیران و تولید، suppliers برای مدیران و مالی.
  "catalog.products.read",
  "catalog.materials.read",
  "catalog.bom.read",
  "catalog.suppliers.read",
  // ویرایش کاتالوگ: products فقط مدیر کامل، materials/bom تولید هم
  // می‌تواند، suppliers مالی هم می‌تواند (admin.js:12 — EDIT).
  "catalog.products.edit",
  "catalog.materials.edit",
  "catalog.bom.edit",
  "catalog.suppliers.edit",
  // ۷ فهرست ثابت و تنظیمات/کاربران: فقط admin و management (FULL).
  "admin.lists",
  "admin.users",
  "admin.settings",
  "reports.view",
  "money.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type PermissionMatrix = Record<Role, ReadonlyArray<Permission>>;

const ALL: ReadonlyArray<Permission> = [...PERMISSIONS];

/**
 * ماتریس نقش → مجوزها — دقیقاً مطابق AUTH_AND_PERMISSION_ARCHITECTURE §۲.۲.
 * `admin` و `management` همه مجوزها را دارند.
 */
export const PERMISSION_MATRIX: PermissionMatrix = {
  management: ALL,
  admin: ALL,
  finance: [
    "purchasing.view",
    "purchasing.edit",
    "finance.view",
    "finance.edit",
    "finance.approve",
    "reports.view",
    "money.view",
    "orders.view",
    // فاز ۷: تب مشتریان و تأمین‌کننده‌ها در مدیریت (admin.js:11-12 —
    // SEE/EDIT finance).
    "customers.view",
    "customers.create",
    "customers.edit",
    "catalog.products.read",
    "catalog.suppliers.read",
    "catalog.suppliers.edit",
    // فاز ۸: صفحه انبار طبق Demo (stock.html — دید دپو برای مالی).
    "inventory.view",
  ],
  salesManager: [
    "leads.view",
    "leads.create",
    "leads.edit",
    "leads.viewAll",
    "leads.assign",
    "leads.import",
    "orders.view",
    "orders.create",
    "orders.edit",
    "orders.status.change",
    "customers.view",
    "customers.create",
    "customers.edit",
    "reports.view",
    "money.view",
    // فاز ۷: تب محصولات و مشتریان در مدیریت (admin.js:11 — SEE salesManager).
    "catalog.products.read",
    // فاز ۸: صفحه انبار طبق Demo (stock.html — دید دپو).
    "inventory.view",
  ],
  sales: [
    "leads.view",
    "leads.create",
    "leads.edit",
    "leads.import",
    "orders.view",
    "orders.create",
    "orders.edit",
    "orders.status.change",
    "customers.view",
    "customers.create",
    "customers.edit",
    // فاز ۷: تب محصولات و مشتریان در مدیریت (admin.js:11 — SEE sales).
    "catalog.products.read",
    // فاز ۸: صفحه انبار طبق Demo (stock.html — دید دپو).
    "inventory.view",
  ],
  production: [
    "orders.view",
    "production.view",
    "production.edit",
    "inventory.view",
    // دید خرید/مالی بدون مبلغ (R-32 / PHASE_06 دروازه خروج ۶)
    "purchasing.view",
    "finance.view",
    // فاز ۷: تب‌های محصولات/مواد/فرمول + ویرایش مواد و فرمول
    // (admin.js:11-12 — SEE/EDIT production).
    "catalog.products.read",
    "catalog.materials.read",
    "catalog.bom.read",
    "catalog.materials.edit",
    "catalog.bom.edit",
  ],
  depot: [
    "orders.view",
    "inventory.view",
    "inventory.moves",
    "purchasing.view",
    "finance.view",
    // فاز ۷: تب محصولات (admin.js:11 — SEE depot).
    "catalog.products.read",
  ],
};

/** آیا این نقش این مجوز را دارد؟ */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return PERMISSION_MATRIX[role]?.includes(permission) ?? false;
}

/** آیا هر یک از نقش‌ها این مجوز را دارند؟ */
export function rolesHavePermission(roles: Iterable<Role>, permission: Permission): boolean {
  for (const role of roles) {
    if (roleHasPermission(role, permission)) return true;
  }
  return false;
}

/**
 * نقش‌هایی که نباید مبالغ را ببینند (R-32 / Q-07: noMoney).
 * معکوس `money.view` در ماتریس بالا.
 */
export function isNoMoneyRole(roles: Iterable<Role>): boolean {
  return !rolesHavePermission(roles, "money.view");
}
