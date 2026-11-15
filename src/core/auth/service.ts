/**
 * سرویس احراز هویت — منطق کسب‌ور در ورود/خروج (CD-04 گام ۴).
 *
 * ورود با پیام یکسان برای «کاربر نبود» و «رمز اشتباه» (نشت وجود حساب ممنوع).
 *
 * **ارتقای شفاف scrypt → bcrypt (D-01):** اگر رمز با هش قدیمی scrypt تأیید شد،
 * بلافاصله با bcrypt دوباره هش و ذخیره می‌شود — کاربر متوجه نمی‌شود و
 * حساب‌های Demo بدون شکسته شدن منتقل می‌شوند.
 */
import { prisma } from "../database/client";
import { PERMISSION_MATRIX, PERMISSIONS, isNoMoneyRole } from "../permissions/matrix";
import type { Permission, Role } from "../permissions/matrix";
import { unauthorized } from "../errors";
import { buildExpiredCookie } from "./cookie";
import { hashPassword, needsRehash, verifyPassword } from "./passwords";
import { issueSession } from "./session";

/** اطلاعات عمومی کاربر برای پاسخ API — بدون هیچ داده حساس. */
export type PublicUser = {
  id: string;
  name: string;
  title: string | null;
  roles: Role[];
  permissions: Permission[];
  /** آیا این کاربر نباید مبالغ را ببیند (R-32 / noMoney)؟ */
  noMoney: boolean;
};

/** پیام یکسان خطای ورود — نشت وجود حساب کاربری ممنوع است. */
const LOGIN_FAILED = "نام کاربری یا رمز عبور نادرست است.";

export type LoginResult = {
  cookie: string;
  user: PublicUser;
};

/**
 * تلاش برای ورود — نام + رمز.
 *
 * مراحل: پیدا کردن کاربر → غیرفعال نبودن → تأیید رمز (bcrypt یا scrypt قدیمی)
 * → ارتقای شفاف هش در صورت نیاز → صدور نشست.
 */
export async function attemptLogin(name: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { name },
    include: { roles: { select: { roleKey: true } } },
  });

  if (!user) throwLoginFailed();
  if (user.off) throwLoginFailed();

  const ok = await verifyPassword(password, user.passwordHash, user.passwordSalt);
  if (!ok) throwLoginFailed();

  // ارتقای شفاف: هش scrypt قدیمی → bcrypt (D-01)
  if (needsRehash(user.passwordHash)) {
    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordSalt: null },
    });
  }

  const roles = user.roles.map((r) => r.roleKey) as Role[];
  const { cookie } = await issueSession({
    id: user.id,
    name: user.name,
    sessionVersion: user.sessionVersion,
    roles,
  });

  return { cookie, user: toPublicUser(user.id, user.name, user.title, roles) };
}

/** خروج — باطل‌کردن نشست در سرور (افزایش sessionVersion) + پاک کردن کوکی. */
export async function logout(userId: string): Promise<string> {
  await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
  return buildExpiredCookie();
}

/** ساخت پاسخ عمومی کاربر — شامل مجوزهای محاسبه‌شده برای UX کلاینت. */
export function toPublicUser(
  id: string,
  name: string,
  title: string | null,
  roles: Role[],
): PublicUser {
  return {
    id,
    name,
    title,
    roles,
    permissions: permissionsFor(roles),
    noMoney: isNoMoneyRole(roles),
  };
}

function throwLoginFailed(): never {
  throw unauthorized(LOGIN_FAILED);
}

/** محاسبه لیست مجوزهای یک مجموعه نقش — برای پاسخ `/me`. */
export function permissionsFor(roles: Role[]): Permission[] {
  const granted = new Set<Permission>();
  for (const role of roles) {
    const allowed = PERMISSION_MATRIX[role];
    if (!allowed) continue;
    for (const permission of PERMISSIONS) {
      if (allowed.includes(permission)) granted.add(permission);
    }
  }
  return [...granted];
}
