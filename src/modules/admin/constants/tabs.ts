/**
 * تعریف تب‌های صفحه مدیریت — منبع: app/admin.js:10-13 (ALL/SEE/EDIT).
 *
 * نقش‌ها در Demo فقط تب‌های مربوط به خود را می‌بینند (SEE) و تعداد
 * کمتری می‌توانند ویرایش کنند (EDIT). `admin` و `management` (FULL)
 * همه را می‌بینند و ویرایش می‌کنند.
 *
 * این ثابت فقط برای نمایش کلاینت است — مجوز واقعی در سرور با
 * `requirePermission` exercised می‌شود (CD-05).
 */
import type { Permission } from "@core/permissions";

export type AdminTabKey =
  | "products"
  | "materials"
  | "bom"
  | "customers"
  | "suppliers"
  | "users"
  | "lists"
  | "leadcols"
  | "settings";

export type AdminTab = {
  key: AdminTabKey;
  label: string;
  /** مجوز خواندن داده‌های این تب (منبع حقیقت در سرور). */
  read: Permission;
  /** مجوز ویرایش این تب — `null` یعنی فقط مدیر کامل (admin/management). */
  write: Permission;
};

/**
 * ۹ تب صفحه مدیریت — مطابق admin.js:10 (ALL).
 *
 * تطبیق با Demo (admin.js:10-13):
 *  - products: همه نقش‌ها می‌بینند (SEE همه)، ویرایش فقط FULL
 *  - materials/bom: مدیران + production (SEE + EDIT)
 *  - customers: مدیران + finance + salesManager/sales (SEE + EDIT)
 *  - suppliers: مدیران + finance
 *  - users/lists/settings: فقط مدیران (FULL)
 *  - leadcols: ستون‌های بورد سرنخ — ذخیره در List key "leadcols"
 */
export const ADMIN_TABS: readonly AdminTab[] = [
  { key: "products", label: "محصولات", read: "catalog.products.read", write: "catalog.products.edit" },
  { key: "materials", label: "مواد اولیه", read: "catalog.materials.read", write: "catalog.materials.edit" },
  { key: "bom", label: "فرمول تولید", read: "catalog.bom.read", write: "catalog.bom.edit" },
  { key: "customers", label: "مشتریان", read: "customers.view", write: "customers.edit" },
  { key: "suppliers", label: "تأمین‌کننده‌ها", read: "catalog.suppliers.read", write: "catalog.suppliers.edit" },
  { key: "users", label: "کاربران و دسترسی", read: "admin.users", write: "admin.users" },
  { key: "lists", label: "فهرست‌ها", read: "admin.lists", write: "admin.lists" },
  { key: "leadcols", label: "ستون‌های بورد سرنخ", read: "admin.lists", write: "admin.lists" },
  { key: "settings", label: "تنظیمات عمومی", read: "admin.settings", write: "admin.settings" },
];
