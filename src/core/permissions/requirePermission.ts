/**
 * اجرای مجوز در سرور — منبع حقیقت (CD-04 گام ۲ / AUTH_AND_PERMISSION_ARCHITECTURE).
 *
 * اصل راهبری: **پنهان کردن دکمه کافی نیست** (R-02). هر Route Handler باید
 * `requirePermission` را فرابخواند. کلاینت فقط برای UX پنهان می‌کند.
 *
 * اگر session برابر null باشد → ۴۰۱ (احراز هویت نشده).
 * اگر مجوز نداشته باشد → ۴۰۳ (احراز هویت شده، بدون مجوز).
 */
import type { Session } from "../auth/session";
import { forbidden, unauthorized } from "../errors";
import { PERMISSIONS, ROLES, rolesHavePermission, type Permission, type Role } from "./matrix";

export type { Permission, Role } from "./matrix";
export { PERMISSIONS, ROLES } from "./matrix";

/** آیا session این مجوز را دارد؟ (نسخه خواندنی — برای UX در کلاینت) */
export function hasPermission(session: Session | null, permission: Permission): boolean {
  if (!session) return false;
  return rolesHavePermission(session.roles, permission);
}

/**
 * اجرای یک مجوز در سرور — در صورت عدم احراز هویت ۴۰۱، در صورت عدم مجوز ۴۰۳.
 * این تابع در هر Route Handler قبل از خواندن ورودی فراخوانی می‌شود.
 */
export function requirePermission(session: Session | null, permission: Permission): void {
  if (!session) throw unauthorized();
  if (!rolesHavePermission(session.roles, permission)) {
    throw forbidden();
  }
}

/** اجرای داشتن حداقل یکی از مجوزها. */
export function requireAnyPermission(session: Session | null, permissions: Permission[]): void {
  if (!session) throw unauthorized();
  if (!permissions.some((p) => rolesHavePermission(session.roles, p))) {
    throw forbidden();
  }
}

/**
 * فیلتر مبالغ در سرور — R-32 / Q-07 (noMoney).
 *
 * نقش‌هایی که `money.view` ندارند نباید مبالغ را در پاسخ API دریافت کنند.
 * این تابع در serviceها هنگام ساخت پاسخ فراخوانی می‌شود.
 */
export function shouldHideMoney(session: Session | null): boolean {
  if (!session) return true;
  return !rolesHavePermission(session.roles, "money.view");
}

/** فهرست مجوزهای یک session — برای نمایش در UI مدیریت کاربران. */
export function listPermissions(session: Session | null): Permission[] {
  if (!session) return [];
  return PERMISSIONS.filter((p) => rolesHavePermission(session.roles, p));
}

/** نقش‌های مجاز یک session — برای نمایش. */
export function listRoles(session: Session | null): Role[] {
  if (!session) return [];
  return ROLES.filter((r) => session.roles.includes(r));
}
